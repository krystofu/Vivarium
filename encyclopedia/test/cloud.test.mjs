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

  const alternatePng=Buffer.from([137,80,78,71,13,10,26,10,5,6,7,8]);
  response=await call(51,'upload_image',{characterId:'zara-solano',title:'Alternate identity reference',imageBase64:alternatePng.toString('base64')});result=(await response.json()).result;const alternateId=result.structuredContent.asset.id;
  response=await call(52,'approve_identity_reference',{assetId:alternateId,confirmIdentityApproval:true});result=(await response.json()).result;assert.equal(result.structuredContent.asset.locked,true);
  response=await call(53,'list_identity_references',{characterId:'zara-solano'});result=(await response.json()).result;assert.ok(result.structuredContent,JSON.stringify(result));assert.equal(result.structuredContent.identityReferences.length,2);assert.equal(result.structuredContent.identityReferences.find(a=>a.id===assetId).canonicalPrimary,true);assert.equal(result.structuredContent.identityReferences.find(a=>a.id===alternateId).canonicalPrimary,false);
  response=await call(54,'get_identity_reference_for_generation',{characterId:'zara-solano',assetId:alternateId});result=(await response.json()).result;assert.equal(result.content[1].type,'image');assert.deepEqual(Buffer.from(result.content[1].data,'base64'),alternatePng);assert.equal(result.structuredContent.canonicalPrimary,false);assert.equal(result.structuredContent.generationReady,true);
  response=await call(55,'get_identity_reference_for_generation',{characterId:'zara-solano'});result=(await response.json()).result;assert.deepEqual(Buffer.from(result.content[1].data,'base64'),png);assert.equal(result.structuredContent.canonicalPrimary,true);
  response=await call(551,'set_identity_authority',{characterId:'zara-solano',role:'face',assetId:alternateId});result=(await response.json()).result;assert.equal(result.structuredContent.assignments.face,alternateId);
  response=await call(552,'get_identity_reference_for_generation',{characterId:'zara-solano',role:'face'});result=(await response.json()).result;assert.deepEqual(Buffer.from(result.content[1].data,'base64'),alternatePng);assert.equal(result.structuredContent.selectedRole,'face');
  response=await call(553,'set_identity_authority',{characterId:'zara-solano',role:'body',assetId:assetId});result=(await response.json()).result;assert.equal(result.structuredContent.assignments.body,assetId);
  response=await call(554,'build_continuum_pack',{characterId:'zara-solano'});result=(await response.json()).result;assert.equal(result.structuredContent.identityAuthority.roles.face.assetId,alternateId);assert.equal(result.structuredContent.references.length,2);assert.equal(result.content.filter(c=>c.type==='image').length,2);assert.deepEqual(Buffer.from(result.content[1].data,'base64'),png);assert.deepEqual(Buffer.from(result.content[2].data,'base64'),alternatePng);
  response=await call(56,'create_character',{id:'inez-test',name:'Inez Test',age:25});result=(await response.json()).result;assert.equal(result.structuredContent.character.id,'inez-test');
  response=await call(561,'update_character',{id:'inez-test',changes:{visualAtmosphere:{mode:'locked',strength:'immersive',motion:'still',palette:{accent:'#abcdef',secondary:'#334455',background:'#101214'}}}});result=(await response.json()).result;assert.ok(result.structuredContent,JSON.stringify(result));assert.equal(result.structuredContent.character.visualAtmosphere.palette.accent,'#abcdef');
  response=await call(57,'get_identity_reference_for_generation',{characterId:'inez-test',assetId:alternateId});result=(await response.json()).result;assert.equal(result.isError,true);assert.match(result.content[0].text,/locked Accepted Identity References/);

  response=await call(6,'upload_image',{characterId:'zara-solano',title:'Mounted-file fallback test',file:'/mnt/data/reference.png'});result=(await response.json()).result;
  assert.ok(result.structuredContent,JSON.stringify(result));assert.equal(result.structuredContent.transport,'mcp-chunks');const uploadId=result.structuredContent.uploadId;
  const mountedPng=Buffer.from([137,80,78,71,13,10,26,10,9,8,7,6]),encoded=mountedPng.toString('base64'),mountedHash=(await import('node:crypto')).createHash('sha256').update(mountedPng).digest('hex');
  response=await call(7,'append_image_chunk',{uploadId,index:0,imageBase64Chunk:encoded.slice(0,8)});result=(await response.json()).result;assert.equal(result.structuredContent.nextIndex,1);
  response=await call(8,'append_image_chunk',{uploadId,index:1,imageBase64Chunk:encoded.slice(8)});result=(await response.json()).result;assert.equal(result.structuredContent.nextIndex,2);
  response=await call(9,'finish_image_upload',{uploadId,expectedByteLength:mountedPng.length,expectedSha256:mountedHash});result=(await response.json()).result;
  assert.equal(result.structuredContent.asset.status,'Review');assert.equal(result.structuredContent.asset.title,'Mounted-file fallback test');assert.equal(result.structuredContent.verifiedOriginal,true);
  response=await call(10,'finish_image_upload',{uploadId,expectedByteLength:mountedPng.length,expectedSha256:mountedHash});result=(await response.json()).result;assert.equal(result.isError,true);assert.match(result.content[0].text,/expired/);
});
test('linked renders stay in Review and cross-origin writes are rejected',async t=>{
  const f=await fixture(t);await f.request('/api/library');
  let response=await f.request('/api/render-links',{method:'POST',headers:{Origin:f.origin,'Content-Type':'application/json'},body:JSON.stringify({id:'zara-linked-1',characterId:'zara-solano',title:'City moment',sourceUrl:'https://example.com/zara.jpg'})});
  assert.equal(response.status,201,await response.clone().text());assert.equal((await response.json()).status,'Review');
  response=await f.request('/api/characters/zara-solano',{method:'PATCH',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
});
