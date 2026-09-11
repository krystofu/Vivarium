import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { createCharacter, updateCharacter, logRender, profileKeys } from './service.mjs';

export async function handleMcp(request,env,store,auth) {
  const server=new McpServer({name:'Vivarium Character Encyclopedia',version:'0.2.0'});
  const profile=z.object(Object.fromEntries(profileKeys.map(k=>[k,z.string().max(4000).optional()]))).strict();
  const identity=z.object({immutable:z.string().max(4000).optional(),signature:z.string().max(4000).optional(),flexible:z.string().max(4000).optional()}).strict();
  const shape={name:z.string().min(1).max(120).optional(),summary:z.string().max(1000).optional(),age:z.number().int().min(21).max(2000).optional(),tags:z.array(z.string().max(60)).max(16).optional(),profile:profile.optional(),identity:identity.optional(),source:z.string().max(2000).optional(),canonStatus:z.enum(['Building','Canon','Archived']).optional(),foundryStatus:z.enum(['Not run','In progress','Complete']).optional()};
  function tool(name,title,description,inputSchema,write,handler) {
    server.registerTool(name,{title,description,inputSchema,annotations:{readOnlyHint:!write,destructiveHint:write,openWorldHint:false},_meta:{securitySchemes:[{type:'oauth2',scopes:[write?'characters:write':'characters:read']}] }},async input=>{
      const scope=write?'characters:write':'characters:read';
      if(!auth?.scope.split(' ').includes(scope))return {isError:true,content:[{type:'text',text:'Connect the library with the required permissions.'}],_meta:{'mcp/www_authenticate':[`Bearer resource_metadata="${env.SITE_ORIGIN}/.well-known/oauth-protected-resource", scope="${scope}"`]}};
      try {const value=await handler(input);return {content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value};}
      catch(error){return {isError:true,content:[{type:'text',text:error.status?error.message:'Unable to update the library. Please retry.'}]};}
    });
  }
  tool('search','Search characters','Use this when looking for characters by name, traits, or profile text. Returns matching IDs and profile links.',{query:z.string().max(200)},false,async({query})=>({results:(await store.read()).characters.filter(c=>JSON.stringify([c.name,c.summary,c.tags,c.profile]).toLowerCase().includes(query.toLowerCase())).slice(0,50).map(c=>({id:c.id,title:c.name,url:`${env.SITE_ORIGIN}/characters/${c.id}`}))}));
  tool('fetch','Fetch character','Use this when reading a character before editing. Returns established profile, identity, render records, and source links. Missing fields are unknown, not an invitation to invent canon.',{id:z.string().max(100)},false,async({id})=>{
    const db=await store.read(),c=db.characters.find(c=>c.id===id);if(!c)throw Object.assign(new Error('Character not found.'),{status:404});
    return {id,title:c.name,url:`${env.SITE_ORIGIN}/characters/${id}`,text:JSON.stringify({character:c,assets:db.assets.filter(a=>a.characterId===id)}),metadata:{generation:c.generation,canonStatus:c.canonStatus,foundryStatus:c.foundryStatus}};
  });
  tool('create_character','Create character','Use this when the user asks to log a new adult character. Creates a persistent Gen 2 record; does not generate missing canon or certify Foundry. Use a stable unique lowercase slug.',{...shape,id:z.string().regex(/^[a-z][a-z0-9-]{1,79}$/),name:z.string().min(1).max(120)},true,async input=>({character:await createCharacter(store,input,`mcp:${auth.clientId}`)}));
  tool('update_character','Update character','Use this when the user authorizes changes to an existing character. Fetch first, preserve unspecified fields, and cite the source in source. Does not replace identity images.',{id:z.string().max(100),changes:z.object(shape).strict()},true,async({id,changes})=>({character:await updateCharacter(store,id,changes,`mcp:${auth.clientId}`)}));
  tool('log_render','Log render source','Use this when logging a new render with its existing HTTPS source link. Records it in Review without fetching the remote image or declaring it canonical. Binary uploads use the website gallery.',{id:z.string().max(100),characterId:z.string().max(100),title:z.string().max(180),sourceUrl:z.string().url().max(2000),notes:z.string().max(4000).optional()},true,async input=>({asset:await logRender(store,input,`mcp:${auth.clientId}`)}));
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);return transport.handleRequest(request);
}
