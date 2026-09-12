import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Miniflare } from 'miniflare';
import { trustedChatFileUrl } from '../cloud/assets.mjs';

test('connector uploads accept only protected ChatGPT file URLs',()=>{
  assert.equal(trustedChatFileUrl('https://files.oaiusercontent.com/file/test').hostname,'files.oaiusercontent.com');
  assert.equal(trustedChatFileUrl('https://sdmntprcentralus.oaiusercontent.com/files/test').hostname,'sdmntprcentralus.oaiusercontent.com');
  assert.equal(trustedChatFileUrl('https://example.com/image.png'),null);
  assert.equal(trustedChatFileUrl('http://files.oaiusercontent.com/image.png'),null);
});

async function fixture(t) {
  const origin='https://vivarium-connector-test.invalid';
  const mf=new Miniflare({modules:true,scriptPath:'dist/server/index.js',compatibilityDate:'2026-05-03',d1Databases:['DB'],r2Buckets:['BUCKET'],bindings:{SITE_ORIGIN:origin}});
  const db=await mf.getD1Database('DB');
  for(const file of ['drizzle/0000_lazy_colleen_wing.sql','drizzle/0001_great_marvel_apes.sql']) {
    const statements=(await readFile(file,'utf8')).replaceAll('--> statement-breakpoint','').split(';').map(value=>value.trim()).filter(Boolean);
    for(const sql of statements)await db.prepare(sql).run();
  }
  t.after(()=>mf.dispose());
  const ownerHeaders={'oai-authenticated-user-id':'owner-1','oai-authenticated-user-email':'owner@example.test'};
  return {origin,request:(path,options={})=>mf.dispatchFetch(origin+path,{...options,headers:{...ownerHeaders,...options.headers}}),anonymous:(path,options={})=>mf.dispatchFetch(origin+path,options)};
}
test('hosted library is private, claims one owner, and persists character changes',async t=>{
  const f=await fixture(t);
  assert.equal((await f.anonymous('/characters',{redirect:'manual'})).status,302);
  let response=await f.request('/api/library');assert.equal(response.status,200,await response.clone().text());
  const seed=await response.json();assert.equal(seed.characters[0].name,'Zara Solano');
  response=await f.request('/api/characters',{method:'POST',headers:{Origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify({id:'inez-test',name:'Inez Test',age:25})});
  assert.equal(response.status,201);
  response=await f.request('/api/characters/inez-test',{method:'PATCH',headers:{Origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify({profile:{voice:'Measured and dry.'}})});
  assert.equal(response.status,200);assert.equal((await response.json()).profile.voice,'Measured and dry.');
  assert.equal((await f.anonymous('/api/library',{headers:{'oai-authenticated-user-id':'intruder'}})).status,403);
});
test('OAuth discovery, registration, owner consent and PKCE token exchange work',async t=>{
  const f=await fixture(t);
  const metadata=await (await f.anonymous('/.well-known/oauth-authorization-server')).json();assert.equal(metadata.issuer,f.origin);assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
  const openid=await (await f.anonymous('/.well-known/openid-configuration')).json();assert.equal(openid.authorization_endpoint,f.origin+'/oauth/authorize');
  let response=await f.anonymous('/oauth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'ChatGPT',redirect_uris:['https://chatgpt.com/connector_platform_oauth_redirect'],token_endpoint_auth_method:'none'})});
  assert.equal(response.status,201);const client=await response.json();
  const verifier='A'.repeat(43),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)),challenge=Buffer.from(digest).toString('base64url');
  const params=new URLSearchParams({client_id:client.client_id,redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect',response_type:'code',code_challenge:challenge,code_challenge_method:'S256',resource:f.origin+'/api/mcp',scope:'characters:read characters:write',state:'state-1'});
  response=await f.request('/oauth/authorize?'+params,{redirect:'manual'});assert.equal(response.status,200,await response.clone().text());assert.match(response.headers.get('content-security-policy'),/form-action 'self' https:\/\/chatgpt\.com/);assert.match(await response.text(),/Approve connection/);
  params.set('decision','approve');response=await f.request('/oauth/authorize',{method:'POST',redirect:'manual',headers:{Origin:f.origin,'Content-Type':'application/x-www-form-urlencoded'},body:params});
  assert.equal(response.status,302);const callback=new URL(response.headers.get('location')),code=callback.searchParams.get('code');assert.ok(code);assert.equal(callback.searchParams.get('iss'),f.origin);
  const tokenBody=new URLSearchParams({grant_type:'authorization_code',client_id:client.client_id,redirect_uri:'https://chatgpt.com/connector_platform_oauth_redirect',code,code_verifier:verifier,resource:f.origin+'/api/mcp'});
  response=await f.anonymous('/oauth/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:tokenBody});assert.equal(response.status,200);const token=await response.json();assert.equal(token.token_type,'Bearer');assert.ok(token.access_token);
  assert.equal((await f.anonymous('/api/mcp')).status,401);
  response=await f.anonymous('/api/mcp',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'test',version:'1'}}})});
  assert.equal(response.status,200);assert.equal((await response.json()).result.serverInfo.name,'Vivarium Character Encyclopedia');
  const call=async(id,name,args)=>f.anonymous('/api/mcp',{method:'POST',headers:{Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:args}})});
  const png=Buffer.from([137,80,78,71,13,10,26,10,1,2,3,4]);
  response=await call(2,'upload_image',{characterId:'zara-solano',title:'Connector exact-byte test',imageBase64:png.toString('base64')});
  let result=(await response.json()).result;assert.equal(result.isError,undefined);const assetId=result.structuredContent.asset.id;assert.equal(result.structuredContent.asset.status,'Review');
  response=await call(3,'fetch_original_image',{characterId:'zara-solano'});result=(await response.json()).result;assert.equal(result.isError,true);assert.match(result.content[0].text,/locked Accepted primary/);
  response=await call(4,'approve_identity_reference',{assetId,confirmIdentityApproval:true});result=(await response.json()).result;assert.equal(result.structuredContent.asset.locked,true);
  response=await call(5,'fetch_original_image',{characterId:'zara-solano'});result=(await response.json()).result;assert.equal(result.content[1].type,'image');assert.deepEqual(Buffer.from(result.content[1].data,'base64'),png);assert.equal(result.structuredContent.canonicalPrimary,true);
});
test('linked renders stay in Review and cross-origin writes are rejected',async t=>{
  const f=await fixture(t);await f.request('/api/library');
  let response=await f.request('/api/render-links',{method:'POST',headers:{Origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify({id:'zara-linked-1',characterId:'zara-solano',title:'City moment',sourceUrl:'https://example.com/zara.jpg'})});
  assert.equal(response.status,201,await response.clone().text());assert.equal((await response.json()).status,'Review');
  response=await f.request('/api/characters/zara-solano',{method:'PATCH',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
});
