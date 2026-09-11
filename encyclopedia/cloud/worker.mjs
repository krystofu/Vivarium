import seed from '../seed.json';
import staticAssets from '../.generated-assets.mjs';
import { cloudStore } from './store.mjs';
import { fail, string, createCharacter, updateCharacter, reviewAsset, logRender, event } from './service.mjs';
import { oauth, authenticatedToken, getOwner, claimOwner } from './oauth.mjs';
import { handleMcp } from './mcp.mjs';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
async function bounded(request,max) {
  if(Number(request.headers.get('content-length'))>max)fail(413,'File is too large.');
  if(!request.body)return new Uint8Array();
  const reader=request.body.getReader(),parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'File is too large.');}parts.push(value);}
  const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}
const readJson=async req=>JSON.parse(new TextDecoder().decode(await bounded(req,100000)));
function imageType(bytes) {
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return ['png','image/png'];
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['jpg','image/jpeg'];
  const start=new TextDecoder().decode(bytes.slice(0,12));if(start.startsWith('RIFF')&&start.endsWith('WEBP'))return ['webp','image/webp'];
  fail(415,'Use a PNG, JPEG, or WebP image.');
}
export default {
  async fetch(request,env) {
    try {
      if(!env.SITE_ORIGIN)fail(503,'The site is being configured.');
      const url=new URL(request.url),path=url.pathname;
      if(url.origin!==env.SITE_ORIGIN)fail(403,'Untrusted site origin.');
      const requestOrigin=request.headers.get('origin');
      if(requestOrigin&&requestOrigin!==env.SITE_ORIGIN)fail(403,'Untrusted request origin.');
      if(path.startsWith('/.well-known/')||path.startsWith('/oauth/')) {
        if(Number(request.headers.get('content-length'))>16000)fail(413,'OAuth request too large.');
        return await oauth(request,env);
      }
      const store=cloudStore(env,seed);
      if(path==='/api/mcp') {
        const auth=await authenticatedToken(request,env);
        if(!auth)return new Response(JSON.stringify({error:'unauthorized'}),{status:401,headers:{...headers,'Content-Type':'application/json','WWW-Authenticate':`Bearer resource_metadata="${env.SITE_ORIGIN}/.well-known/oauth-protected-resource", scope="characters:read characters:write"`}});
        if(Number(request.headers.get('content-length'))>100000)fail(413,'Tool request too large.');
        return await handleMcp(request,env,store,auth);
      }
      if(path==='/styles.css'||path==='/favicon.svg') {const a=staticAssets[path];return new Response(a.body,{headers:{...headers,'Content-Type':a.type}});}
      const user=request.headers.get('oai-authenticated-user-id');
      if(path==='/api/session')return json({signedIn:!!user,userId:user||null,ownerConfigured:!!await getOwner(env),hosted:true,connectionUrl:env.SITE_ORIGIN+'/api/mcp'});
      if(!user) {
        if(!path.startsWith('/api/')&&!path.startsWith('/media/'))return Response.redirect(env.SITE_ORIGIN+'/signin-with-chatgpt?return_to='+encodeURIComponent(path+url.search),302);
        return json({error:'Please sign in to open your library.'},401);
      }
      // The first authenticated visitor can only be the owner because the initial
      // Sites access policy is owner-only. Persist that stable ID before any data read.
      await claimOwner(env,user);
      const actor=`owner:${user}`;
      if(path==='/api/library'&&request.method==='GET') {
        const db=await store.read();return json({...db,hosted:true,assets:db.assets.map(a=>({...a,url:a.filename?`/media/${a.id}`:null}))});
      }
      if(path==='/api/characters'&&request.method==='POST')return json(await createCharacter(store,await readJson(request),actor),201);
      const characterRoute=path.match(/^\/api\/characters\/([a-z0-9-]+)$/);
      if(characterRoute&&request.method==='PATCH')return json(await updateCharacter(store,characterRoute[1],await readJson(request),actor));
      if(path==='/api/render-links'&&request.method==='POST')return json(await logRender(store,await readJson(request),actor),201);
      if(path==='/api/assets'&&request.method==='POST') {
        const bytes=await bounded(request,12*1024*1024),[ext,mime]=imageType(bytes);
        const characterId=string(url.searchParams.get('characterId'),100),title=string(url.searchParams.get('title')||'Untitled render',180);
        const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
        const db=await store.read();if(!db.characters.some(c=>c.id===characterId))fail(404,'Character not found.');
        if(db.assets.some(a=>a.characterId===characterId&&a.sha256===sha256))fail(409,'This image is already in this character’s library.');
        const id=crypto.randomUUID(),filename=`${id}.${ext}`;
        await env.BUCKET.put(filename,bytes,{httpMetadata:{contentType:mime}});
        const asset=await store.mutate(db=>{
          if(db.assets.some(a=>a.characterId===characterId&&a.sha256===sha256))fail(409,'This image is already in this character’s library.');
          const a={id,characterId,title,filename,mime,sha256,kind:'render',status:'Review',locked:false,createdAt:new Date().toISOString(),metadata:{}};
          db.assets.push(a);event(db,'render-uploaded',characterId,actor,{assetId:id});return a;
        });return json(asset,201);
      }
      const assetRoute=path.match(/^\/api\/assets\/([a-zA-Z0-9-]+)$/);
      if(assetRoute&&request.method==='PATCH')return json(await reviewAsset(store,assetRoute[1],await readJson(request),actor));
      const media=path.match(/^\/media\/([a-zA-Z0-9-]+)$/);
      if(media&&request.method==='GET') {
        const a=(await store.read()).assets.find(a=>a.id===media[1]);if(!a?.filename)fail(404,'Original image has not been uploaded.');
        const file=await env.BUCKET.get(a.filename);if(!file)fail(404,'Image not found.');
        return new Response(file.body,{headers:{...headers,'Content-Type':a.mime}});
      }
      if(request.method==='GET') {
        const a=staticAssets[path]||((path==='/'||path==='/characters'||/^\/characters\/[a-z0-9-]+$/.test(path))?staticAssets['/index.html']:null);
        if(a)return new Response(a.body,{headers:{...headers,'Content-Type':a.type}});
      }
      fail(404,'Page not found.');
    }catch(error){const status=error.status||(error instanceof SyntaxError?400:500);if(status===500)console.error('Library request failed',error.message);return json({error:status===500?'The library could not complete this request. Please try again.':error.message},status);}
  }
};
