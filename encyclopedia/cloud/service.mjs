export const profileKeys=['identityNucleus','contradiction','voice','occupation','privateWorld','relationshipPromise','backstory','attractionChannel','movementLanguage','faceArchitecture','bodySilhouette','whySheWorks'];
export const fail=(status,message)=>{throw Object.assign(new Error(message),{status});};
export function string(value,max=4000) {if(typeof value!=='string'||value.length>max)fail(400,'Invalid text value.');return value.trim();}
export function object(value) {if(!value||typeof value!=='object'||Array.isArray(value))fail(400,'Expected an object.');return value;}
function allowed(input,keys) {object(input);if(Object.keys(input).some(k=>!keys.includes(k)))fail(400,'Unknown field.');}
export function profile(input) {allowed(input,profileKeys);return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,string(v)]));}
export function traits(input) {allowed(input,['immutable','signature','flexible']);return Object.fromEntries(Object.entries(input).map(([k,v])=>[k,string(v)]));}
export function characterInput(input,creating=false) {
  allowed(input,['id','name','summary','age','tags','profile','identity','canonStatus','foundryStatus','source']);
  const output={};
  for(const key of ['id','name','summary','source']) if(input[key]!==undefined)output[key]=string(input[key],key==='summary'?1000:key==='source'?2000:120);
  if(creating&&(!output.id||!output.name))fail(400,'Character ID and name are required.');
  if(output.id&&!/^[a-z][a-z0-9-]{1,79}$/.test(output.id))fail(400,'Use a lowercase character ID with letters, numbers and hyphens.');
  if(input.age!==undefined){if(!Number.isInteger(input.age)||input.age<21||input.age>2000)fail(400,'Set an adult age of 21 or older.');output.age=input.age;}
  if(input.tags!==undefined){if(!Array.isArray(input.tags)||input.tags.length>16)fail(400,'Use up to 16 tags.');output.tags=input.tags.map(v=>string(v,60));}
  if(input.profile!==undefined)output.profile=profile(input.profile);
  if(input.identity!==undefined)output.identity=traits(input.identity);
  if(input.canonStatus!==undefined){if(!['Building','Canon','Archived'].includes(input.canonStatus))fail(400,'Invalid canon status.');output.canonStatus=input.canonStatus;}
  if(input.foundryStatus!==undefined){if(!['Not run','In progress','Complete'].includes(input.foundryStatus))fail(400,'Invalid Foundry status.');output.foundryStatus=input.foundryStatus;}
  return output;
}
export function event(db,type,characterId,actor,detail={}) {db.events.push({id:crypto.randomUUID(),type,characterId,actor,at:new Date().toISOString(),...detail});}
export async function createCharacter(store,input,actor) {
  const clean=characterInput(input,true);
  return store.mutate(db=>{
    const existing=db.characters.find(c=>c.id===clean.id);
    if(existing)fail(409,'This character ID already exists. Fetch it before updating.');
    const {source,...values}=clean;
    const c={generation:2,sequence:Math.max(0,...db.characters.map(c=>c.sequence||0))+1,canonStatus:'Building',foundryStatus:'Not run',summary:'',primaryAssetId:null,tags:[],profile:{},identity:{immutable:'',signature:'',flexible:''},provenance:source?[{source,at:new Date().toISOString()}]:[],extensions:{},...values};
    db.characters.push(c);event(db,'character-created',c.id,actor);return c;
  });
}
export async function updateCharacter(store,id,input,actor) {
  const clean=characterInput(input);if(clean.id!==undefined&&clean.id!==id)fail(400,'Character IDs cannot be changed.');
  return store.mutate(db=>{
    const c=db.characters.find(c=>c.id===id);if(!c)fail(404,'Character not found.');
    const {profile:detail,identity,source,...values}=clean;
    Object.assign(c,values);if(detail)Object.assign(c.profile,detail);if(identity)Object.assign(c.identity,identity);
    if(source)c.provenance.push({source,at:new Date().toISOString()});
    event(db,'character-updated',id,actor,{fields:Object.keys(clean)});return c;
  });
}
export async function reviewAsset(store,id,input,actor) {
  allowed(input,['status','promoteIdentity','confirmIdentity','notes']);
  if(!['Review','Accepted','Rejected'].includes(input.status))fail(400,'Invalid review status.');
  const notes=input.notes===undefined?undefined:string(input.notes);
  return store.mutate(db=>{
    const a=db.assets.find(a=>a.id===id);if(!a)fail(404,'Image not found.');
    if(a.locked)fail(409,'Canonical identity references are locked. Add a new reference instead.');
    if(input.promoteIdentity===true&&(input.confirmIdentity!==true||input.status!=='Accepted'))fail(400,'Explicit identity approval is required.');
    a.status=input.status;if(notes!==undefined)a.metadata.curatorNotes=notes;
    if(input.promoteIdentity===true){a.kind='identity';a.locked=true;const c=db.characters.find(c=>c.id===a.characterId);if(!c.primaryAssetId)c.primaryAssetId=a.id;}
    event(db,a.locked?'identity-locked':`render-${a.status.toLowerCase()}`,a.characterId,actor,{assetId:a.id});return a;
  });
}
export async function logRender(store,input,actor) {
  allowed(input,['id','characterId','title','sourceUrl','notes']);
  const id=string(input.id,100),characterId=string(input.characterId,100),title=string(input.title,180),sourceUrl=string(input.sourceUrl,2000),notes=string(input.notes||'');
  if(!/^[a-zA-Z0-9-]{2,100}$/.test(id))fail(400,'Provide a stable render ID.');
  let url;try{url=new URL(sourceUrl);}catch{fail(400,'Provide an HTTPS source link.');}
  if(url.protocol!=='https:'||url.username||url.password)fail(400,'Provide an HTTPS source link without credentials.');
  return store.mutate(db=>{
    if(!db.characters.some(c=>c.id===characterId))fail(404,'Character not found.');
    if(db.assets.some(a=>a.id===id))fail(409,'Render ID already exists.');
    const a={id,characterId,title,sourceUrl,kind:'render',status:'Review',locked:false,createdAt:new Date().toISOString(),metadata:{curatorNotes:notes},storage:'linked'};
    db.assets.push(a);event(db,'render-logged',characterId,actor,{assetId:id});return a;
  });
}
