import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { createCharacter, updateCharacter, reviewAsset, logRender, profileKeys, identityAuthorityRoles, resolvedIdentityAuthority, setIdentityAuthorities, buildContinuumPack } from './service.mjs';
import { decodeBase64, downloadTrustedChatFile, uploadAsset, originalAsset, primaryIdentity } from './assets.mjs';
import { createChunkUpload, appendChunkUpload, finishChunkUpload, MAX_CHUNK_CHARS } from './oauth.mjs';

const base64=bytes=>{let value='';const chunk=32768;for(let i=0;i<bytes.length;i+=chunk)value+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(value);};
const publicAsset=a=>({id:a.id,characterId:a.characterId,title:a.title,mime:a.mime,sha256:a.sha256,byteLength:a.byteLength,kind:a.kind,status:a.status,locked:a.locked,createdAt:a.createdAt});

export async function handleMcp(request,env,store,auth) {
  const server=new McpServer({name:'Vivarium Character Encyclopedia',version:'0.4.0'});
  const profile=z.object(Object.fromEntries(profileKeys.map(k=>[k,z.string().max(4000).optional()]))).strict();
  const identity=z.object({immutable:z.string().max(4000).optional(),signature:z.string().max(4000).optional(),flexible:z.string().max(4000).optional()}).strict();
  const shape={name:z.string().min(1).max(120).optional(),summary:z.string().max(1000).optional(),age:z.number().int().min(21).max(2000).optional(),tags:z.array(z.string().max(60)).max(16).optional(),profile:profile.optional(),identity:identity.optional(),source:z.string().max(2000).optional(),canonStatus:z.enum(['Building','Canon','Archived']).optional(),foundryStatus:z.enum(['Not run','In progress','Complete']).optional()};
  function tool(name,title,description,inputSchema,write,handler,meta={}) {
    server.registerTool(name,{title,description,inputSchema,annotations:{readOnlyHint:!write,destructiveHint:write,openWorldHint:false},_meta:{securitySchemes:[{type:'oauth2',scopes:[write?'characters:write':'characters:read']}],...meta}},async input=>{
      const scope=write?'characters:write':'characters:read';
      if(!auth?.scope.split(' ').includes(scope))return {isError:true,content:[{type:'text',text:'Connect the library with the required permissions.'}],_meta:{'mcp/www_authenticate':[`Bearer resource_metadata="${env.SITE_ORIGIN}/.well-known/oauth-protected-resource", scope="${scope}"`]}};
      try {const value=await handler(input);return value?.content?value:{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
      catch(error){if(!error.status)console.error(`MCP ${name} failed`,error?.message||error);return {isError:true,content:[{type:'text',text:error.status?error.message:'The connector hit an unexpected error. Please retry; the failure has been logged.'}]};}
    });
  }
  tool('search','Search the canonical Vivarium characters','Search only the canonical Vivarium Gen 2 Encyclopedia. Use this for character names, traits, or profile text; do not substitute Airtable, Notion, or another character store.',{query:z.string().max(200)},false,async({query})=>({results:(await store.read()).characters.filter(c=>JSON.stringify([c.name,c.summary,c.tags,c.profile]).toLowerCase().includes(query.toLowerCase())).slice(0,50).map(c=>({id:c.id,title:c.name,url:`${env.SITE_ORIGIN}/characters/${c.id}`}))}));
  tool('fetch','Fetch a canonical Vivarium character','Read the authoritative Vivarium Gen 2 character record before editing. Returns every approved Identity Reference and marks the primary default. Use get_identity_reference_for_generation to place one exact original into the conversation for image generation.',{id:z.string().max(100)},false,async({id})=>{
    const db=await store.read(),c=db.characters.find(c=>c.id===id);if(!c)throw Object.assign(new Error('Character not found.'),{status:404});
    const assets=db.assets.filter(a=>a.characterId===id).map(publicAsset),primary=assets.find(a=>a.id===c.primaryAssetId)||null;
    const authority=resolvedIdentityAuthority(c),identityReferences=assets.filter(a=>a.kind==='identity'&&a.status==='Accepted'&&a.locked).map(a=>({...a,canonicalPrimary:a.id===c.primaryAssetId,authorityRoles:identityAuthorityRoles.filter(role=>authority[role]===a.id)}));
    return {id,title:c.name,url:`${env.SITE_ORIGIN}/characters/${id}`,character:c,assets,identityAuthority:authority,identityReferences,primaryIdentity:primary,canonicalImageAvailable:!!(primary?.locked&&primary.status==='Accepted')};
  });
  tool('create_character','Create character','Use this when the user asks to log a new adult character in the canonical Vivarium Gen 2 Encyclopedia. Creates a persistent record; does not generate missing canon or certify Foundry.',{...shape,id:z.string().regex(/^[a-z][a-z0-9-]{1,79}$/),name:z.string().min(1).max(120)},true,async input=>({character:await createCharacter(store,input,`mcp:${auth.clientId}`)}));
  tool('update_character','Update character','Update an existing canonical Vivarium character. Fetch first, preserve unspecified fields, and cite the source. Does not replace identity images.',{id:z.string().max(100),changes:z.object(shape).strict()},true,async({id,changes})=>({character:await updateCharacter(store,id,changes,`mcp:${auth.clientId}`)}));
  tool('log_render','Log render source','Log an HTTPS render source in Review without downloading it. Use upload_image when ChatGPT has the actual image and the original bytes must live in the Encyclopedia.',{id:z.string().max(100),characterId:z.string().max(100),title:z.string().max(180),sourceUrl:z.string().url().max(2000),notes:z.string().max(4000).optional()},true,async input=>({asset:await logRender(store,input,`mcp:${auth.clientId}`)}));
  const uploadInput=z.object({characterId:z.string().max(100),title:z.string().min(1).max(180),file:z.any().optional(),imageBase64:z.string().optional()}).strict().refine(v=>!!v.file!==!!v.imageBase64,{message:'Provide exactly one ChatGPT file or base64 image.'});
  tool('upload_image','Upload an original image','Upload the actual PNG, JPEG, or WebP bytes to a character Gallery. Pass an attached or mounted file in file. For a mounted path, follow the returned connector-native chunk instructions; no external network request is needed. The image always enters Review and cannot become canonical until approve_identity_reference is called with explicit approval.',uploadInput,true,async input=>{
    let bytes;
    if(typeof input.file==='string') {
      if(/^https:\/\//i.test(input.file))bytes=await downloadTrustedChatFile(input.file);
      else {
        const uploadId=await createChunkUpload(env,{owner:auth.owner,clientId:auth.clientId,characterId:input.characterId,title:input.title});
        return {uploadRequired:true,transport:'mcp-chunks',uploadId,maxChunkBase64Chars:MAX_CHUNK_CHARS,expiresInSeconds:900,localFile:input.file,instructions:`Base64-encode localFile without a data-URL prefix. Call append_image_chunk sequentially from index 0 with chunks no longer than ${MAX_CHUNK_CHARS} characters, then call finish_image_upload with the original byte length and SHA-256. Do not use curl or another network request.`};
      }
    } else if(input.file&&typeof input.file.download_url==='string')bytes=await downloadTrustedChatFile(input.file.download_url);
    else if(input.file)throw Object.assign(new Error('Pass the attached file path, or a ChatGPT file object with download_url.'),{status:400});
    else bytes=decodeBase64(input.imageBase64);
    return {asset:publicAsset(await uploadAsset(env,store,{characterId:input.characterId,title:input.title,bytes},`mcp:${auth.clientId}`)),nextStep:'Review the image, then call approve_identity_reference only with the user’s explicit approval.'};
  },{'openai/fileParams':['file']});
  tool('append_image_chunk','Append original image bytes','Continue a mounted-file upload created by upload_image. Send base64 chunks in exact sequential order; each chunk may contain at most 80000 characters.',{uploadId:z.string().regex(/^[a-f0-9]{64}$/),index:z.number().int().min(0),imageBase64Chunk:z.string().min(1).max(MAX_CHUNK_CHARS)},true,async({uploadId,index,imageBase64Chunk})=>appendChunkUpload(env,auth,uploadId,index,imageBase64Chunk));
  tool('finish_image_upload','Finish original image upload','Finish a connector-native chunk upload, verify the exact original byte length and SHA-256, and store it in Review.',{uploadId:z.string().regex(/^[a-f0-9]{64}$/),expectedByteLength:z.number().int().min(1).max(12*1024*1024),expectedSha256:z.string().regex(/^[a-f0-9]{64}$/)},true,async({uploadId,expectedByteLength,expectedSha256})=>{
    const pending=await finishChunkUpload(env,auth,uploadId),bytes=decodeBase64(pending.data);
    const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
    if(bytes.byteLength!==expectedByteLength||sha256!==expectedSha256)throw Object.assign(new Error('Uploaded chunks do not match the original file. Start upload_image again.'),{status:409});
    return {asset:publicAsset(await uploadAsset(env,store,{characterId:pending.characterId,title:pending.title,bytes},`mcp:${auth.clientId}`)),verifiedOriginal:true,nextStep:'The original is stored in Review. Promote it only after explicit user approval.'};
  });
  tool('review_render','Review a render','Set a noncanonical render to Review, Accepted, or Rejected. This never promotes or locks identity.',{assetId:z.string().max(100),status:z.enum(['Review','Accepted','Rejected']),notes:z.string().max(4000).optional()},true,async({assetId,status,notes})=>({asset:publicAsset(await reviewAsset(store,assetId,{status,notes},`mcp:${auth.clientId}`))}));
  tool('approve_identity_reference','Approve and lock an identity reference','Promote one uploaded image into an Accepted locked identity reference. Call only after the user explicitly approves that exact asset. This is the connector equivalent of the UI approval checkbox and lock action.',{assetId:z.string().max(100),confirmIdentityApproval:z.literal(true),notes:z.string().max(4000).optional()},true,async({assetId,notes})=>({asset:publicAsset(await reviewAsset(store,assetId,{status:'Accepted',promoteIdentity:true,confirmIdentity:true,notes},`mcp:${auth.clientId}`))}));
  tool('list_identity_references','List approved identity references','List every locked Accepted image in a character’s Identity References tab. The primary image is marked as the default, but any listed assetId may be selected for generation.',{characterId:z.string().max(100)},false,async({characterId})=>{
    const db=await store.read(),character=db.characters.find(c=>c.id===characterId);if(!character)throw Object.assign(new Error('Character not found.'),{status:404});
    const authority=resolvedIdentityAuthority(character),identityReferences=db.assets.filter(a=>a.characterId===characterId&&a.kind==='identity'&&a.status==='Accepted'&&a.locked).map(a=>({...publicAsset(a),canonicalPrimary:a.id===character.primaryAssetId,authorityRoles:identityAuthorityRoles.filter(role=>authority[role]===a.id)}));
    return {characterId,characterName:character.name,primaryAssetId:character.primaryAssetId,identityAuthority:authority,identityReferences};
  });
  tool('set_identity_authority','Assign an identity authority role','Assign or clear one structured authority role using a locked Accepted Identity Reference. Roles include overall identity, face, body, hair, tattoos, style, expression, wardrobe, and other. Setting primary-identity also changes the character’s primary default.',{characterId:z.string().max(100),role:z.enum(identityAuthorityRoles),assetId:z.string().max(100).nullable()},true,async({characterId,role,assetId})=>setIdentityAuthorities(store,characterId,{[role]:assetId},`mcp:${auth.clientId}`));
  const generationReferenceInput=z.object({characterId:z.string().max(100),assetId:z.string().max(100).optional(),role:z.enum(identityAuthorityRoles).optional()}).strict().refine(v=>!(v.assetId&&v.role),{message:'Provide either assetId or role, not both.'});
  tool('get_identity_reference_for_generation','Get an identity reference for image generation','Return the exact stored original for image generation as an MCP image content block. Select by assetId or authority role; omit both to use the primary identity. After this succeeds, use this returned image directly as the image-generation reference (the most recent conversation image); do not ask for or invent a local filesystem path.',generationReferenceInput,false,async({characterId,assetId,role})=>{
    const db=await store.read(),character=db.characters.find(c=>c.id===characterId);if(!character)throw Object.assign(new Error('Character not found.'),{status:404});
    const authority=resolvedIdentityAuthority(character),selectedId=assetId||(role?authority[role]:character.primaryAssetId),asset=db.assets.find(a=>a.id===selectedId);
    if(!asset||asset.characterId!==characterId||asset.kind!=='identity'||asset.status!=='Accepted'||!asset.locked)throw Object.assign(new Error('Select an image from this character’s locked Accepted Identity References.'),{status:404});
    const found=await originalAsset(env,store,asset.id),metadata={asset:publicAsset(asset),characterId,characterName:character.name,selectedRole:role||null,authorityRoles:identityAuthorityRoles.filter(key=>authority[key]===asset.id),canonicalPrimary:asset.id===character.primaryAssetId,sha256:asset.sha256,generationReady:true,referenceHandoff:'Use the returned MCP image content block as the image-generation reference.'};
    return {content:[{type:'text',text:`Generation-ready Vivarium identity reference: ${asset.title}. SHA-256 ${asset.sha256}. Use the attached image block directly as the next image-generation reference.`},{type:'image',data:base64(found.bytes),mimeType:asset.mime}],structuredContent:metadata};
  });
  tool('build_continuum_pack','Build a complete CONTINUUM pack','Build the character’s complete generation handoff: primary and scoped identity references, authority roles, exact hashes, immutable/signature/flexible traits, face architecture, body silhouette, movement language, attraction channel, and ready-to-use prompt context. Returns up to five assigned originals as MCP image blocks in authority order.',{characterId:z.string().max(100)},false,async({characterId})=>{
    const pack=await buildContinuumPack(store,characterId),content=[{type:'text',text:`CONTINUUM pack ready for ${pack.character.name}. ${pack.references.length} locked identity references; ${pack.generationReferenceAssetIds.length} attached for generation. Use the attached image blocks directly as references and use promptContext as identity guidance.`}];
    for(const id of pack.generationReferenceAssetIds){const found=await originalAsset(env,store,id);content.push({type:'image',data:base64(found.bytes),mimeType:found.asset.mime});}
    return {content,structuredContent:{...pack,generationReady:pack.generationReferenceAssetIds.length>0,referenceHandoff:'Use the returned MCP image content blocks as the next image-generation references.'}};
  });
  tool('fetch_original_image','Fetch exact canonical image bytes','Return an actual original image binary through MCP, not metadata. With characterId, this resolves only the locked Accepted primary identity image for CONTINUUM. With assetId, it retrieves that exact uploaded original.',z.object({characterId:z.string().max(100).optional(),assetId:z.string().max(100).optional()}).strict().refine(v=>!!v.characterId!==!!v.assetId,{message:'Provide exactly one characterId or assetId.'}),false,async input=>{
    const found=input.characterId?await primaryIdentity(env,store,input.characterId):await originalAsset(env,store,input.assetId);
    const asset=found.asset,metadata={asset:publicAsset(asset),characterId:asset.characterId,canonicalPrimary:!!input.characterId,sha256:asset.sha256};
    return {content:[{type:'text',text:`Exact Vivarium original: ${asset.title}. SHA-256 ${asset.sha256}. This image block contains the stored binary.`},{type:'image',data:base64(found.bytes),mimeType:asset.mime}],structuredContent:metadata};
  });
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);return transport.handleRequest(request);
}
