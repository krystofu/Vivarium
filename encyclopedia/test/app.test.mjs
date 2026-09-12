import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { createApp } from '../server.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
async function fixture(t) {
  const dataDir=await mkdtemp(join(tmpdir(),'vivarium-test-'));
  let server=await createApp({dataDir}); server.listen(0,'127.0.0.1'); await once(server,'listening');
  let origin=`http://127.0.0.1:${server.address().port}`;
  const close=async()=>{server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));};
  t.after(async()=>{await close();await rm(dataDir,{recursive:true,force:true});});
  return { request:(path,options)=>fetch(origin+path,options), restart:async()=>{await close();server=await createApp({dataDir});server.listen(0,'127.0.0.1');await once(server,'listening');origin=`http://127.0.0.1:${server.address().port}`;} };
}
const patch=data=>({method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
test('real routes, seed, and unknown route handling',async t=>{
  const f=await fixture(t);
  for(const path of ['/characters','/characters/zara-solano','/app.js','/styles.css','/favicon.svg','/VIVARIUM_GEM_OFFICIAL_GEN2.png']) assert.equal((await f.request(path)).status,200);
  const officialGem=Buffer.from(await (await f.request('/VIVARIUM_GEM_OFFICIAL_GEN2.png')).arrayBuffer());assert.equal(createHash('sha256').update(officialGem).digest('hex'),'e3b2839e7e6486e9baacd70189ac7ac63eaab0f8b9c3ba1b0b75ccaa45a17535');
  const db=await (await f.request('/api/library')).json();
  assert.equal(db.characters[0].foundryStatus,'Not run');assert.equal(db.assets.length,0);
  assert.equal((await f.request('/secret.env')).status,404);
});
test('manual character slots accept every dossier field',async t=>{
  const f=await fixture(t);
  const input={id:'manual-inez',name:'Manual Inez',age:28,summary:'A complete hand-entered identity.',tags:['Measured','Restorer'],canonStatus:'Canon',foundryStatus:'In progress',source:'Manual curator entry',visualAtmosphere:{mode:'locked',strength:'immersive',motion:'drift',variant:2,palette:{accent:'#aabbcc',secondary:'#223344',background:'#101214'}},identity:{immutable:'Exact face.',signature:'Dry humor.',flexible:'Wardrobe.'},profile:{whySheWorks:'Specific personhood.',faceArchitecture:'Angular oval.',bodySilhouette:'Tall and lean.',attractionChannel:'Competence.',movementLanguage:'Deliberate.',identityNucleus:'Repair what others discard.',contradiction:'Guarded but generous.',voice:'Measured and dry.',occupation:'Restorer.',privateWorld:'Dusty studio.',relationshipPromise:'Earned trust.',backstory:'Established manually.'}};
  const response=await f.request('/api/characters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  assert.equal(response.status,201,await response.clone().text());const character=await response.json();
  assert.equal(character.canonStatus,'Canon');assert.equal(character.foundryStatus,'In progress');assert.deepEqual(character.tags,input.tags);
  assert.deepEqual(character.identity,input.identity);assert.deepEqual(character.profile,input.profile);assert.deepEqual(character.visualAtmosphere,input.visualAtmosphere);assert.equal(character.provenance[0].source,input.source);
  const appSource=await (await f.request('/app.js')).text();
  assert.match(appSource,/Create character slot/);assert.match(appSource,/Character profile/);assert.match(appSource,/collect\('profile'\)/);assert.match(appSource,/collect\('identity'\)/);
});
test('uploads persist, duplicate bytes are rejected, original bytes are preserved',async t=>{
  const f=await fixture(t);
  const upload=()=>f.request('/api/assets?characterId=zara-solano&title=Test',{method:'POST',body:png});
  const response=await upload();assert.equal(response.status,201);const asset=await response.json();
  assert.equal(asset.status,'Review');assert.equal(asset.locked,false);
  assert.equal((await upload()).status,409);
  assert.deepEqual(Buffer.from(await (await f.request(`/media/${asset.id}`)).arrayBuffer()),png);
  await f.restart();const db=await (await f.request('/api/library')).json();
  assert.equal(db.assets[0].sha256,asset.sha256);assert.equal(db.events[0].type,'render-uploaded');
});
test('accepted renders do not become identity; explicit identity lock is immutable',async t=>{
  const f=await fixture(t);
  const a=await (await f.request('/api/assets?characterId=zara-solano',{method:'POST',body:png})).json();
  assert.equal((await f.request(`/api/assets/${a.id}`,patch({status:'Accepted'}))).status,200);
  let db=await (await f.request('/api/library')).json();assert.equal(db.characters[0].primaryAssetId,null);
  assert.equal((await f.request(`/api/assets/${a.id}`,patch({status:'Accepted',promoteIdentity:true}))).status,400);
  assert.equal((await f.request(`/api/assets/${a.id}`,patch({status:'Accepted',promoteIdentity:true,confirmIdentity:true}))).status,200);
  assert.equal((await f.request(`/api/assets/${a.id}`,patch({status:'Rejected'}))).status,409);
  let response=await f.request('/api/characters/zara-solano/identity-authority',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignments:{face:a.id,body:a.id}})});assert.equal(response.status,200,await response.clone().text());
  const pack=await (await f.request('/api/characters/zara-solano/continuum-pack')).json();assert.equal(pack.identityAuthority.roles.face.assetId,a.id);assert.deepEqual(pack.references[0].authorityRoles,['primary-identity','face','body']);assert.equal(pack.generationReferenceAssetIds[0],a.id);
  await f.restart();db=await (await f.request('/api/library')).json();
  assert.equal(db.characters[0].primaryAssetId,a.id);assert.equal(db.characters[0].identityAuthority.face,a.id);assert.equal(db.assets[0].locked,true);assert.equal(db.assets[0].status,'Accepted');
});
test('invalid requests cannot write unsupported files, characters, status, or fields',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/assets?characterId=zara-solano',{method:'POST',body:'<svg onload="alert(1)"/>'})).status,415);
  assert.equal((await f.request('/api/assets?characterId=unknown',{method:'POST',body:png})).status,404);
  assert.equal((await f.request('/api/assets?characterId=zara-solano',{method:'POST',body:Buffer.alloc(12*1024*1024+1)})).status,413);
  assert.equal((await f.request('/api/characters/zara-solano',patch({profile:{madeUp:'wrong'}}))).status,400);
  assert.equal((await f.request('/api/characters/zara-solano',{method:'PATCH',body:'{'})).status,400);
  assert.equal((await f.request('/api/assets/missing',patch({status:'Accepted'}))).status,404);
  assert.equal((await f.request('/api/characters/zara-solano/identity-authority',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignments:{face:'missing'}})})).status,400);
  assert.equal((await f.request('/api/characters/zara-solano',patch({visualAtmosphere:{mode:'locked',palette:{accent:'purple'}}}))).status,400);
});
test('cross-origin requests blocked and security headers present',async t=>{
  const f=await fixture(t);
  assert.equal((await f.request('/api/library',{headers:{Origin:'https://malicious.example'}})).status,403);
  const response=await f.request('/characters');assert.equal(response.headers.get('x-content-type-options'),'nosniff');
  assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('concurrent edits do not lose fields and survive restart',async t=>{
  const f=await fixture(t);
  const results=await Promise.all([
    f.request('/api/characters/zara-solano',patch({profile:{voice:'A distinct voice.'}})),
    f.request('/api/characters/zara-solano',patch({profile:{occupation:'Restorer.'}}))
  ]);results.forEach(r=>assert.equal(r.status,200));
  await f.restart();const db=await (await f.request('/api/library')).json();
  assert.equal(db.characters[0].profile.voice,'A distinct voice.');assert.equal(db.characters[0].profile.occupation,'Restorer.');assert.equal(db.events.length,2);
});
