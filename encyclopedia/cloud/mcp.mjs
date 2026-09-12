import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { createCharacter, updateCharacter, reviewAsset, logRender, profileKeys } from './service.mjs';
import { decodeBase64, boundedStream, uploadAsset, originalAsset, primaryIdentity } from './assets.mjs';

const base64=bytes=>{let value='';const chunk=32768;for(let i=0;i<bytes.length;i+=chunk)value+=String.fromCharCode(...bytes.subarray(i,i+chunk));return btoa(value);};
const publicAsset=a=>({id:a.id,characterId:a.characterId,title:a.title,mime:a.mime,sha256:a.sha256,byteLength:a.byteLength,kind:a.kind,status:a.status,locked:a.locked,createdAt:a.createdAt});

export async function handleMcp(request,env,store,auth) {
  const server=new McpServer({name:'Vivarium Character Encyclopedia',version:'0.3.0'});
  const profile=z.object(Object.fromEntries(profileKeys.map(k=>[k,z.string().max(4000).optional()]))).strict();
  const identity=z.object({immutable:z.string().max(4000).optional(),signature:z.string().max(4000).optional(),flexible:z.string().max(4000).optional()}).strict();
  const shape={name:z.string().min(1).max(120).optional(),summary:z.string().max(1000).optional(),age:z.number().int().min(21).max(2000).optional(),tags:z.array(z.string().max(60)).max(16).optional(),profile:profile.optional(),identity:identity.optional(),source:z.string().max(2000).optional(),canonStatus:z.enum(['Building','Canon','Archived']).optional(),foundryStatus:z.enum(['Not run','In progress','Complete']).optional()};
  function tool(name,title,description,inputSchema,write,handler,meta={}) {
    server.registerTool(name,{title,description,inputSchema,annotations:{readOnlyHint:!write,destructiveHint:write,openWorldHint:false},_meta:{securitySchemes:[{type:'oauth2',scopes:[write?'characters:write':'characters:read']}],...meta}},async input=>{
      const scope=write?'characters:write':'characters:read';
      if(!auth?.scope.split(' ').includes(scope))return {isError:true,content:[{type:'text',text:'Connect the library with the required permissions.'}],_meta:{'mcp/www_authenticate':[`Bearer resource_metadata="${env.SITE_ORIGIN}/.well-known/oauth-protected-resource", scope="${scope}"`]}};
      try {const value=await handler(input);return value?.content?value:{content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
      catch(error){return {isError:true,content:[{type:'text',text:error.status?error.message:'Unable to update the library. Please retry.'}]};}
    });
  }
  tool('search','Search the canonical Vivarium characters','Search only the canonical Vivarium Gen 2 Encyclopedia. Use this for character names, traits, or profile text; do not substitute Airtable, Notion, or another character store.',{query:z.string().max(200)},false,async({query})=>({results:(await store.read()).characters.filter(c=>JSON.stringify([c.name,c.summary,c.tags,c.profile]).toLowerCase().includes(query.toLowerCase())).slice(0,50).map(c=>({id:c.id,title:c.name,url:`${env.SITE_ORIGIN}/characters/${c.id}`}))}));
  tool('fetch','Fetch a canonical Vivarium character','Read the authoritative Vivarium Gen 2 character record before editing. Returns the exact primary identity asset ID when one exists. To retrieve its original image bytes, call fetch_original_image with characterId.',{id:z.string().max(100)},false,async({id})=>{
    const db=await store.read(),c=db.characters.find(c=>c.id===id);if(!c)throw Object.assign(new Error('Character not found.'),{status:404});
    const assets=db.assets.filter(a=>a.characterId===id).map(publicAsset),primary=assets.find(a=>a.id===c.primaryAssetId)||null;
    return {id,title:c.name,url:`${env.SITE_ORIGIN}/characters/${id}`,character:c,assets,primaryIdentity:primary,canonicalImageAvailable:!!(primary?.locked&&primary.status==='Accepted')};
  });
  tool('create_character','Create character','Use this when the user asks to log a new adult character in the canonical Vivarium Gen 2 Encyclopedia. Creates a persistent record; does not generate missing canon or certify Foundry.',{...shape,id:z.string().regex(/^[a-z][a-z0-9-]{1,79}$/),name:z.string().min(1).max(120)},true,async input=>({character:await createCharacter(store,input,`mcp:${auth.clientId}`)}));
  tool('update_character','Update character','Update an existing canonical Vivarium character. Fetch first, preserve unspecified fields, and cite the source. Does not replace identity images.',{id:z.string().max(100),changes:z.object(shape).strict()},true,async({id,changes})=>({character:await updateCharacter(store,id,changes,`mcp:${auth.clientId}`)}));
  tool('log_render','Log render source','Log an HTTPS render source in Review without downloading it. Use upload_image when ChatGPT has the actual image and the original bytes must live in the Encyclopedia.',{id:z.string().max(100),characterId:z.string().max(100),title:z.string().max(180),sourceUrl:z.string().url().max(2000),notes:z.string().max(4000).optional()},true,async input=>({asset:await logRender(store,input,`mcp:${auth.clientId}`)}));
  const uploadInput=z.object({characterId:z.string().max(100),title:z.string().min(1).max(180),file:z.object({download_url:z.string().url(),file_id:z.string().optional()}).strict().optional(),imageBase64:z.string().optional()}).strict().refine(v=>!!v.file!==!!v.imageBase64,{message:'Provide exactly one ChatGPT file or base64 image.'});
  tool('upload_image','Upload an original image','Upload the actual PNG, JPEG, or WebP bytes to a character Gallery. The image always enters Review and cannot become canonical until approve_identity_reference is called with explicit approval.',uploadInput,true,async input=>{
    let bytes;
    if(input.file){const url=new URL(input.file.download_url);if(url.protocol!=='https:'||url.username||url.password)throw Object.assign(new Error('The attached file must use a secure download URL.'),{status:400});const response=await fetch(url,{redirect:'error'});if(!response.ok)throw Object.assign(new Error('ChatGPT could not provide the attached image.'),{status:400});bytes=await boundedStream(response.body,response.headers.get('content-length'));}
    else bytes=decodeBase64(input.imageBase64);
    return {asset:publicAsset(await uploadAsset(env,store,{characterId:input.characterId,title:input.title,bytes},`mcp:${auth.clientId}`)),nextStep:'Review the image, then call approve_identity_reference only with the user’s explicit approval.'};
  },{'openai/fileParams':['file']});
  tool('review_render','Review a render','Set a noncanonical render to Review, Accepted, or Rejected. This never promotes or locks identity.',{assetId:z.string().max(100),status:z.enum(['Review','Accepted','Rejected']),notes:z.string().max(4000).optional()},true,async({assetId,status,notes})=>({asset:publicAsset(await reviewAsset(store,assetId,{status,notes},`mcp:${auth.clientId}`))}));
  tool('approve_identity_reference','Approve and lock an identity reference','Promote one uploaded image into an Accepted locked identity reference. Call only after the user explicitly approves that exact asset. This is the connector equivalent of the UI approval checkbox and lock action.',{assetId:z.string().max(100),confirmIdentityApproval:z.literal(true),notes:z.string().max(4000).optional()},true,async({assetId,notes})=>({asset:publicAsset(await reviewAsset(store,assetId,{status:'Accepted',promoteIdentity:true,confirmIdentity:true,notes},`mcp:${auth.clientId}`))}));
  tool('fetch_original_image','Fetch exact canonical image bytes','Return an actual original image binary through MCP, not metadata. With characterId, this resolves only the locked Accepted primary identity image for CONTINUUM. With assetId, it retrieves that exact uploaded original.',z.object({characterId:z.string().max(100).optional(),assetId:z.string().max(100).optional()}).strict().refine(v=>!!v.characterId!==!!v.assetId,{message:'Provide exactly one characterId or assetId.'}),false,async input=>{
    const found=input.characterId?await primaryIdentity(env,store,input.characterId):await originalAsset(env,store,input.assetId);
    const asset=found.asset,metadata={asset:publicAsset(asset),characterId:asset.characterId,canonicalPrimary:!!input.characterId,sha256:asset.sha256};
    return {content:[{type:'text',text:`Exact Vivarium original: ${asset.title}. SHA-256 ${asset.sha256}. This image block contains the stored binary.`},{type:'image',data:base64(found.bytes),mimeType:asset.mime}],structuredContent:metadata};
  });
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);return transport.handleRequest(request);
}
