import { fail, string, event } from './service.mjs';

export const MAX_IMAGE_BYTES=12*1024*1024;

export function trustedChatFileUrl(value) {
  let url;try{url=new URL(value);}catch{return null;}
  const host=url.hostname.toLowerCase();
  const trusted=host==='files.oaiusercontent.com'||host.endsWith('.oaiusercontent.com')||/^oaisdmntpr[a-z0-9-]*\.blob\.core\.windows\.net$/.test(host);
  return url.protocol==='https:'&&!url.username&&!url.password&&trusted?url:null;
}

export async function downloadTrustedChatFile(value,maxRedirects=3) {
  let url=trustedChatFileUrl(value);if(!url)fail(400,'The attached file must come from ChatGPT’s protected file service.');
  for(let redirects=0;redirects<=maxRedirects;redirects++) {
    const response=await fetch(url,{redirect:'manual'});
    if(response.status>=300&&response.status<400) {
      if(redirects===maxRedirects)fail(400,'ChatGPT redirected the attached image too many times.');
      const location=response.headers.get('location');url=trustedChatFileUrl(location?new URL(location,url).href:'');
      if(!url)fail(400,'ChatGPT redirected the attached image outside its protected file service.');
      continue;
    }
    if(!response.ok)fail(400,'ChatGPT could not provide the attached image.');
    return boundedStream(response.body,response.headers.get('content-length'));
  }
}

export function imageType(bytes) {
  if([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))return ['png','image/png'];
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return ['jpg','image/jpeg'];
  const start=new TextDecoder().decode(bytes.slice(0,12));
  if(start.startsWith('RIFF')&&start.endsWith('WEBP'))return ['webp','image/webp'];
  fail(415,'Use a PNG, JPEG, or WebP image.');
}

export async function boundedStream(body,contentLength,max=MAX_IMAGE_BYTES) {
  if(Number(contentLength)>max)fail(413,'File is too large.');
  if(!body)return new Uint8Array();
  const reader=body.getReader(),parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();fail(413,'File is too large.');}parts.push(value);}
  const out=new Uint8Array(size);let offset=0;for(const part of parts){out.set(part,offset);offset+=part.length;}return out;
}

export function decodeBase64(value) {
  if(typeof value!=='string'||value.length===0||value.length>MAX_IMAGE_BYTES*4/3+16||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail(400,'Provide valid base64 image data.');
  let binary;try{binary=atob(value);}catch{fail(400,'Provide valid base64 image data.');}
  if(binary.length>MAX_IMAGE_BYTES)fail(413,'File is too large.');
  const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return bytes;
}

export async function uploadAsset(env,store,{characterId,title,bytes},actor) {
  characterId=string(characterId,100);title=string(title||'Untitled render',180);
  const [ext,mime]=imageType(bytes);
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  const db=await store.read();if(!db.characters.some(c=>c.id===characterId))fail(404,'Character not found.');
  if(db.assets.some(a=>a.characterId===characterId&&a.sha256===sha256))fail(409,'This image is already in this character’s library.');
  const id=crypto.randomUUID(),filename=`${id}.${ext}`;
  await env.BUCKET.put(filename,bytes,{httpMetadata:{contentType:mime}});
  try{return await store.mutate(db=>{
    if(db.assets.some(a=>a.characterId===characterId&&a.sha256===sha256))fail(409,'This image is already in this character’s library.');
    const asset={id,characterId,title,filename,mime,sha256,byteLength:bytes.byteLength,kind:'render',status:'Review',locked:false,createdAt:new Date().toISOString(),metadata:{}};
    db.assets.push(asset);event(db,'render-uploaded',characterId,actor,{assetId:id});return asset;
  });}catch(error){await env.BUCKET.delete(filename);throw error;}
}

export async function originalAsset(env,store,id) {
  const asset=(await store.read()).assets.find(a=>a.id===id);if(!asset?.filename)fail(404,'Original image has not been uploaded.');
  const file=await env.BUCKET.get(asset.filename);if(!file)fail(404,'Image not found.');
  return {asset,bytes:new Uint8Array(await file.arrayBuffer())};
}

export async function primaryIdentity(env,store,characterId) {
  const db=await store.read(),character=db.characters.find(c=>c.id===characterId);if(!character)fail(404,'Character not found.');
  const asset=db.assets.find(a=>a.id===character.primaryAssetId);
  if(!asset||asset.characterId!==character.id||asset.kind!=='identity'||asset.status!=='Accepted'||asset.locked!==true)fail(404,'This character does not have a locked Accepted primary identity image.');
  if(!asset.filename)fail(404,'The primary identity record has no original binary. Upload the original before using it for CONTINUUM.');
  const file=await env.BUCKET.get(asset.filename);if(!file)fail(404,'The primary identity original is missing from storage.');
  return {character,asset,bytes:new Uint8Array(await file.arrayBuffer())};
}
