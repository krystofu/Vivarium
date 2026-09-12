import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
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
  for(const path of ['/characters','/characters/zara-solano','/app.js','/styles.css','/favicon.svg']) assert.equal((await f.request(path)).status,200);
  const db=await (await f.request('/api/library')).json();
  assert.equal(db.characters[0].foundryStatus,'Not run');assert.equal(db.assets.length,0);
  assert.equal((await f.request('/secret.env')).status,404);
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
