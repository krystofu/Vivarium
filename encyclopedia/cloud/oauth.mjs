import { fail, string } from './service.mjs';
const now=()=>Math.floor(Date.now()/1000);
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');
export async function hash(value) {return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),v=>v.toString(16).padStart(2,'0')).join('');}
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const scopes=['characters:read','characters:write'];
const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...extra}});
function redirectAllowed(value) {
  try {const u=new URL(value);return u.protocol==='https:'&&u.hostname==='chatgpt.com'&&!u.search&&!u.hash&&(u.pathname==='/connector_platform_oauth_redirect'||/^\/connector\/oauth\/[a-zA-Z0-9_-]+$/.test(u.pathname));}catch{return false;}
}
export async function authenticatedToken(request,env) {
  const value=request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];if(!value)return null;
  const row=await env.DB.prepare('SELECT payload FROM oauth_grants WHERE hash = ? AND kind = ? AND expires > ?').bind(await hash(value),'access',now()).first();
  if(!row)return null;const data=JSON.parse(row.payload);
  const owner=await getOwner(env);if(!owner||data.owner!==owner||data.resource!==env.SITE_ORIGIN+'/api/mcp')return null;
  return data;
}
export async function getOwner(env) {return (await env.DB.prepare('SELECT user_id FROM app_owner WHERE id = ?').bind('owner').first())?.user_id||null;}
export async function claimOwner(env,user) {
  await env.DB.prepare('INSERT OR IGNORE INTO app_owner (id, user_id, claimed_at) VALUES (?, ?, ?)').bind('owner',user,now()).run();
  const owner=await getOwner(env);if(owner!==user)fail(403,'This is a private Vivarium library.');return owner;
}
async function saveGrant(env,kind,payload,expires) {
  const token=randomToken();await env.DB.prepare('INSERT INTO oauth_grants (hash, kind, payload, expires) VALUES (?, ?, ?, ?)').bind(await hash(token),kind,JSON.stringify(payload),expires).run();return token;
}
const MAX_CHUNK_CHARS=80000,MAX_UPLOAD_CHARS=12*1024*1024*4/3+16;
export { MAX_CHUNK_CHARS };
export async function createChunkUpload(env,payload) {
  return saveGrant(env,'asset-chunks',{...payload,nextIndex:0,data:''},now()+900);
}
async function chunkUpload(env,auth,token) {
  if(!/^[a-f0-9]{64}$/.test(token||''))fail(404,'Chunked upload not found.');
  const digest=await hash(token),row=await env.DB.prepare('SELECT payload FROM oauth_grants WHERE hash = ? AND kind = ? AND expires > ?').bind(digest,'asset-chunks',now()).first();
  if(!row)fail(410,'This chunked upload expired. Start upload_image again.');
  const data=JSON.parse(row.payload);
  if(data.owner!==auth.owner||data.clientId!==auth.clientId)fail(403,'This chunked upload belongs to another connector session.');
  return {digest,data};
}
export async function appendChunkUpload(env,auth,token,index,chunk) {
  if(!Number.isInteger(index)||index<0)fail(400,'Chunk index must be a nonnegative integer.');
  if(typeof chunk!=='string'||!chunk.length||chunk.length>MAX_CHUNK_CHARS||!/^[A-Za-z0-9+/]*={0,2}$/.test(chunk))fail(400,`Each chunk must be 1-${MAX_CHUNK_CHARS} base64 characters.`);
  const {digest,data}=await chunkUpload(env,auth,token);if(index!==data.nextIndex)fail(409,`Expected chunk index ${data.nextIndex}.`);
  if(data.data.length+chunk.length>MAX_UPLOAD_CHARS)fail(413,'File is too large.');
  data.data+=chunk;data.nextIndex++;
  await env.DB.prepare('UPDATE oauth_grants SET payload = ? WHERE hash = ? AND kind = ?').bind(JSON.stringify(data),digest,'asset-chunks').run();
  return {uploadId:token,nextIndex:data.nextIndex,receivedBase64Chars:data.data.length};
}
export async function finishChunkUpload(env,auth,token) {
  const {digest,data}=await chunkUpload(env,auth,token);
  const removed=await env.DB.prepare('DELETE FROM oauth_grants WHERE hash = ? AND kind = ? RETURNING hash').bind(digest,'asset-chunks').first();
  if(!removed)fail(409,'This chunked upload was already finished.');return data;
}
async function issue(env,payload) {
  const access=await saveGrant(env,'access',payload,now()+3600);
  const refresh=await saveGrant(env,'refresh',payload,now()+30*86400);
  return json({access_token:access,token_type:'Bearer',expires_in:3600,refresh_token:refresh,scope:payload.scope});
}
async function clientFor(env,id) {
  const row=await env.DB.prepare('SELECT * FROM oauth_clients WHERE id = ? AND expires > ?').bind(id,now()).first();
  if(!row)fail(400,'Unknown or expired OAuth client. Reconnect the app.');return row;
}
export async function oauth(request,env) {
  const origin=env.SITE_ORIGIN,url=new URL(request.url),path=url.pathname;
  if(path==='/.well-known/oauth-protected-resource'||path==='/.well-known/oauth-protected-resource/api/mcp')return json({resource:origin+'/api/mcp',authorization_servers:[origin],scopes_supported:scopes});
  if(path==='/.well-known/oauth-authorization-server'||path==='/.well-known/openid-configuration')return json({issuer:origin,authorization_endpoint:origin+'/oauth/authorize',token_endpoint:origin+'/oauth/token',registration_endpoint:origin+'/oauth/register',revocation_endpoint:origin+'/oauth/revoke',response_types_supported:['code'],grant_types_supported:['authorization_code','refresh_token'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:scopes,authorization_response_iss_parameter_supported:true});
  if(path==='/oauth/register'&&request.method==='POST') {
    const input=await request.json();
    if(!Array.isArray(input.redirect_uris)||!input.redirect_uris.length||input.redirect_uris.length>4||!input.redirect_uris.every(redirectAllowed))fail(400,'Only the documented ChatGPT OAuth callback is supported.');
    if(input.token_endpoint_auth_method&&input.token_endpoint_auth_method!=='none')fail(400,'This public client uses PKCE without a client secret.');
    const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM oauth_clients WHERE expires > ?').bind(now()).first();if(count.n>=100)fail(429,'Too many registered clients.');
    const id=crypto.randomUUID(),name=string(input.client_name||'ChatGPT',100);
    await env.DB.prepare('INSERT INTO oauth_clients (id, redirects, name, expires) VALUES (?, ?, ?, ?)').bind(id,JSON.stringify(input.redirect_uris),name,now()+365*86400).run();
    return json({client_id:id,client_name:name,redirect_uris:input.redirect_uris,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']},201);
  }
  if(path==='/oauth/authorize'&&['GET','POST'].includes(request.method)) {
    const user=request.headers.get('oai-authenticated-user-id');
    if(!user)return Response.redirect(origin+'/signin-with-chatgpt?return_to='+encodeURIComponent(path+url.search),302);
    await claimOwner(env,user);
    if(request.method==='POST'&&request.headers.get('origin')!==origin)fail(403,'Invalid authorization origin.');
    const p=request.method==='POST'?new URLSearchParams(await request.text()):url.searchParams;
    const client=await clientFor(env,p.get('client_id'));
    const redirect=p.get('redirect_uri');if(!JSON.parse(client.redirects).includes(redirect))fail(400,'Redirect URI does not match the registered client.');
    if(p.get('response_type')!=='code'||p.get('code_challenge_method')!=='S256'||! /^[A-Za-z0-9_-]{43}$/.test(p.get('code_challenge')||''))fail(400,'Authorization requires an S256 PKCE challenge.');
    if(p.get('resource')!==origin+'/api/mcp')fail(400,'Invalid resource audience.');
    const requested=(p.get('scope')||scopes.join(' ')).split(' ').filter(Boolean);
    if(!requested.length||requested.some(s=>!scopes.includes(s)))fail(400,'Invalid scopes.');
    if((p.get('state')||'').length>1000)fail(400,'Invalid state.');
    if(request.method==='GET') {
      const fields=['client_id','redirect_uri','response_type','code_challenge','code_challenge_method','resource','scope','state'];
      const hidden=fields.map(k=>`<input type="hidden" name="${k}" value="${escape(p.get(k)||'')}">`).join('');
      return new Response(`<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Connect Vivarium</title><link rel="stylesheet" href="/styles.css"></head><body><main><div class="eyebrow">VIVARIUM / PRIVATE CONNECTION</div><h1>Connect ${escape(client.name)}?</h1><p>This connection can ${requested.includes('characters:write')?'read and update':'read'} your character library. All writes are recorded. Canonical identity references remain protected.</p><form method="post" action="/oauth/authorize">${hidden}<button name="decision" value="approve">Approve connection</button> <button name="decision" value="deny" class="quiet">Cancel</button></form></main></body></html>`,{headers:{'Content-Type':'text/html','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'self'; form-action 'self' https://chatgpt.com; frame-ancestors 'none'; base-uri 'none'"}});
    }
    const target=new URL(redirect);target.searchParams.set('state',p.get('state')||'');target.searchParams.set('iss',origin);
    if(p.get('decision')!=='approve')target.searchParams.set('error','access_denied');
    else {
      const code=await saveGrant(env,'code',{owner:user,clientId:client.id,redirect,challenge:p.get('code_challenge'),resource:origin+'/api/mcp',scope:requested.join(' ')},now()+120);
      target.searchParams.set('code',code);
    }
    return Response.redirect(target.href,302);
  }
  if(path==='/oauth/token'&&request.method==='POST') {
    const p=new URLSearchParams(await request.text());await clientFor(env,p.get('client_id'));
    const kind=p.get('grant_type')==='authorization_code'?'code':p.get('grant_type')==='refresh_token'?'refresh':null;
    if(!kind)fail(400,'Unsupported grant type.');
    const token=p.get(kind==='code'?'code':'refresh_token');if(!token)fail(400,'Missing grant.');
    const digest=await hash(token);
    const row=await env.DB.prepare('SELECT payload FROM oauth_grants WHERE hash = ? AND kind = ? AND expires > ?').bind(digest,kind,now()).first();
    if(!row)fail(400,'Expired or consumed grant.');const data=JSON.parse(row.payload);
    if(data.clientId!==p.get('client_id')||data.resource!==p.get('resource')||data.owner!==await getOwner(env))fail(400,'Invalid grant binding.');
    if(kind==='code') {
      const verifier=p.get('code_verifier')||'';if(!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier))fail(400,'Invalid PKCE verifier.');
      const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
      const challenge=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
      if(challenge!==data.challenge||p.get('redirect_uri')!==data.redirect)fail(400,'PKCE or redirect verification failed.');
    }
    const consumed=await env.DB.prepare('DELETE FROM oauth_grants WHERE hash = ? RETURNING hash').bind(digest).first();if(!consumed)fail(400,'Grant already consumed.');
    return issue(env,{owner:data.owner,clientId:data.clientId,resource:data.resource,scope:data.scope});
  }
  if(path==='/oauth/revoke'&&request.method==='POST') {
    const p=new URLSearchParams(await request.text());const row=await env.DB.prepare('SELECT payload FROM oauth_grants WHERE hash = ?').bind(await hash(p.get('token')||'')).first();
    if(row){const data=JSON.parse(row.payload);if(data.clientId===p.get('client_id'))await env.DB.prepare('DELETE FROM oauth_grants WHERE json_extract(payload, ?) = ?').bind('$.clientId',data.clientId).run();}
    return json({});
  }
  return json({error:'not_found'},404);
}
