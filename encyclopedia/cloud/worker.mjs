import seed from '../seed.json';
import staticAssets from '../.generated-assets.mjs';
import { cloudStore } from './store.mjs';
import { fail, string, createCharacter, updateCharacter, reviewAsset, logRender } from './service.mjs';
import { oauth, authenticatedToken, getOwner, claimOwner } from './oauth.mjs';
import { handleMcp } from './mcp.mjs';
import { boundedStream, uploadAsset, originalAsset } from './assets.mjs';

const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; img-src 'self' blob:; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
const bounded=(request,max)=>boundedStream(request.body,request.headers.get('content-length'),max);
const readJson=async req=>JSON.parse(new TextDecoder().decode(await bounded(req,100000)));
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
        if(Number(request.headers.get('content-length'))>17*1024*1024)fail(413,'Tool request too large.');
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
        const bytes=await bounded(request,12*1024*1024);
        const characterId=string(url.searchParams.get('characterId'),100),title=string(url.searchParams.get('title')||'Untitled render',180);
        return json(await uploadAsset(env,store,{characterId,title,bytes},actor),201);
      }
      const assetRoute=path.match(/^\/api\/assets\/([a-zA-Z0-9-]+)$/);
      if(assetRoute&&request.method==='PATCH')return json(await reviewAsset(store,assetRoute[1],await readJson(request),actor));
      const media=path.match(/^\/media\/([a-zA-Z0-9-]+)$/);
      if(media&&request.method==='GET') {
        const {asset,bytes}=await originalAsset(env,store,media[1]);
        return new Response(bytes,{headers:{...headers,'Content-Type':asset.mime,'Content-Disposition':`inline; filename="${asset.filename}"`,'X-Vivarium-SHA256':asset.sha256}});
      }
      if(request.method==='GET') {
        const a=staticAssets[path]||((path==='/'||path==='/characters'||/^\/characters\/[a-z0-9-]+$/.test(path))?staticAssets['/index.html']:null);
        if(a)return new Response(a.body,{headers:{...headers,'Content-Type':a.type}});
      }
      fail(404,'Page not found.');
    }catch(error){const status=error.status||(error instanceof SyntaxError?400:500);if(status===500)console.error('Library request failed',error.message);return json({error:status===500?'The library could not complete this request. Please try again.':error.message},status);}
  }
};
