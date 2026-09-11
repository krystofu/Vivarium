const app = document.querySelector('#app');
const lightbox = document.querySelector('#lightbox');
const editor = document.querySelector('#editor');
let library, query = '', filter = 'All characters', tab = 'profile', galleryFilter = 'All images';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gem = '<img class="gem" src="/favicon.svg" alt="">';
const fields = { whySheWorks:'Why she works', faceArchitecture:'Face architecture', bodySilhouette:'Body silhouette', attractionChannel:'Attraction channel', movementLanguage:'Movement language', identityNucleus:'Identity nucleus', contradiction:'Contradiction engine', voice:'Voice', occupation:'Occupation & skills', privateWorld:'Private world', relationshipPromise:'Relationship promise', backstory:'Backstory' };
const assetFor = c => library.assets.find(a => a.id === c.primaryAssetId);
const assetsFor = c => library.assets.filter(a => a.characterId === c.id);
const current = () => library.characters.find(c => c.id === location.pathname.split('/')[2]);
const badge = (text, kind = '') => `<span class="badge ${kind}">${esc(text)}</span>`;
let noticeTimer;
function notify(message) {
  clearTimeout(noticeTimer);
  document.querySelector('#notice').textContent = message;
  noticeTimer = setTimeout(() => { document.querySelector('#notice').textContent = ''; }, 6500);
}
async function api(path, options) {
  const response = await fetch(path, options); const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Something went wrong.'); return data;
}
async function reload() { library = await api('/api/library'); render(); }
function nav(path) { history.pushState({}, '', path); tab = 'profile'; render(); window.scrollTo(0,0); }
function frame(content) {
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="/characters">${gem}<span>VIVARIUM<small>CHARACTER ENCYCLOPEDIA</small></span></a><div class="side-label">YOUR COLLECTION</div><a class="side-link active" href="/characters"><span>▦</span> Characters <b>${library.characters.length}</b></a><div class="side-note"><span class="live-dot"></span> GEN 2 COLLECTION<p>Specific people.<br>Living worlds.</p></div><div class="sidebar-bottom">${gem}<span>Identity comes first.<small>Vivarium · Personal library</small></span></div></aside><div class="workspace"><header class="topbar"><span>THE VIVARIUM ARCHIVE</span><span class="top-status"><i class="live-dot"></i> Local library</span></header>${content}<footer>VIVARIUM <span>Every face has a world behind it.</span><span>GENERATION 02</span></footer></div>`;
  app.querySelectorAll('a[href^="/characters"]').forEach(a => a.addEventListener('click', e => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); nav(a.getAttribute('href')); } }));
  app.querySelectorAll('img[data-asset]').forEach(img => img.addEventListener('error', () => { const p = document.createElement('div'); p.className = 'missing-image'; p.textContent = 'Reference unavailable · restore the original asset'; img.replaceWith(p); }, { once:true }));
}
function picture(asset, className = '', contain = false) {
  return asset ? `<div class="image-wrap ${className} ${contain ? 'contain' : ''}"><img data-asset="${esc(asset.id)}" src="/media/${esc(asset.id)}" alt="${esc(asset.title)}">${gem}</div>` : `<div class="image-wrap missing-image ${className}">${gem}<span>Identity reference awaits</span></div>`;
}
function render() {
  if (!library) return;
  document.title = current() ? `${current().name} · Vivarium` : 'Vivarium · Character Encyclopedia';
  if (location.pathname === '/' || location.pathname === '/characters') return renderCollection();
  const c = current();
  if (!c) { frame('<main><h1>Character not found</h1><p>This character is not in your library.</p><a href="/characters">Return to characters →</a></main>'); return; }
  renderCharacter(c);
}
function renderCollection() {
  frame(`<main><div class="eyebrow">THE COLLECTION / GENERATION 02</div><div class="page-heading"><div><h1>Characters<span class="heading-dot">.</span></h1><p>A living archive of distinct identities and the worlds they inhabit.</p></div><span class="collection-count">${String(library.characters.length).padStart(2,'0')}<small>CHARACTERS</small></span></div><div class="toolbar"><label class="search"><span>⌕</span><input id="search" type="search" placeholder="Find a character, trait, or world…" aria-label="Search characters" value="${esc(query)}"><kbd>/</kbd></label><label class="select-wrap"><span class="sr-only">Filter characters</span><select id="filter">${['All characters','Identity locked','Building','Foundry ready'].map(v=>`<option ${v===filter?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="result-bar"><span id="result-count"></span><span>CURATED BY IDENTITY <span class="muted">↗</span></span></div><div class="character-grid" id="results"></div><section class="collection-note"><div class="line-icon">${gem}</div><div><h3>One identity. A thousand possible moments.</h3><p>Canonical references preserve who she is. The gallery holds everywhere she goes.</p></div></section></main>`);
  drawResults();
  document.querySelector('#search').addEventListener('input', e => { query = e.target.value; drawResults(); });
  document.querySelector('#filter').addEventListener('change', e => { filter = e.target.value; drawResults(); });
}
function drawResults() {
  const matches = library.characters.filter(c => {
    const haystack = [c.name,c.summary,...c.tags,...Object.values(c.profile)].join(' ').toLowerCase();
    return haystack.includes(query.toLowerCase().trim()) && (filter==='All characters' || filter==='Identity locked' && !!assetFor(c)?.locked || filter==='Building' && c.canonStatus==='Building' || filter==='Foundry ready' && c.foundryStatus==='Complete');
  });
  document.querySelector('#result-count').textContent = `${matches.length} ${matches.length===1?'character':'characters'}${query ? ` matching “${query}”` : ' in your collection'}`;
  document.querySelector('#results').innerHTML = matches.length ? matches.map(c => `<a class="character-card" href="/characters/${esc(c.id)}">${picture(assetFor(c))}<div class="card-top">${badge(`GEN ${c.generation} / ${String(c.sequence).padStart(2,'0')}`)}${assetFor(c)?.locked ? badge('◇ IDENTITY LOCKED','lock') : ''}</div><div class="card-bottom"><span class="card-kicker">${esc(c.tags.join(' · '))}</span><h2>${esc(c.name)}<span>↗</span></h2><p>${esc(c.summary)}</p><div class="card-meta">${badge(c.canonStatus)}<span>${assetsFor(c).length} ${assetsFor(c).length===1?'image':'images'} <span aria-hidden="true">·</span> ${c.age ? `${c.age} years` : 'Age not set'}</span></div></div></a>`).join('') : '<div class="empty"><span>⌕</span><h2>No characters found</h2><p>Try a different name or clear your filters.</p><button id="clear-search">Clear filters</button></div>';
  document.querySelectorAll('.character-card').forEach(a => a.addEventListener('click', e => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); nav(a.getAttribute('href')); } }));
  document.querySelector('#clear-search')?.addEventListener('click', () => { query=''; filter='All characters'; renderCollection(); });
}
function renderCharacter(c) {
  const assets = assetsFor(c), refs = assets.filter(a => a.kind==='identity');
  const section = tab === 'profile' ? profile(c) : tab === 'gallery' ? gallery(c) : identity(c);
  frame(`<main class="dossier"><a class="back" href="/characters">← All characters</a><div class="dossier-layout"><aside class="portrait-panel"><button class="hero-image" data-open="${esc(assetFor(c)?.id || '')}" aria-label="Open primary identity reference">${picture(assetFor(c), '', true)}</button><div class="portrait-caption">${gem}<div><strong>${assetFor(c)?.locked ? 'Primary identity · Locked' : 'Primary identity awaits'}</strong><small>FULL IDENTITY REFERENCE</small></div></div><div class="reference-note">The reference owns identity.<br>The next image owns the moment.</div></aside><div class="dossier-content"><div class="eyebrow">CHARACTER DOSSIER <span>/ GEN ${c.generation} — ${String(c.sequence).padStart(2,'0')}</span></div><h1>${esc(c.name)}</h1><div class="status-row">${badge(c.canonStatus)}${badge(`Foundry · ${c.foundryStatus}`)}${c.age ? badge(`${c.age} years`) : ''}</div><p class="intro">${esc(c.summary)}</p><nav class="tabs" aria-label="Character sections">${[['profile','Profile',''],['gallery','Gallery',assets.filter(a=>a.kind==='render').length],['identity','Identity References',refs.length]].map(([key,label,count])=>`<button data-tab="${key}" aria-current="${tab===key?'page':'false'}" class="${tab===key?'selected':''}">${label} ${count!==''?`<small>${count}</small>`:''}</button>`).join('')}</nav><div id="section">${section}</div></div></div></main>`);
  app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ tab=b.dataset.tab; render(); }));
  app.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openImage(b.dataset.open)));
  document.querySelector('#edit-profile')?.addEventListener('click',()=>editProfile(c));
  document.querySelector('#gallery-filter')?.addEventListener('change',e=>{galleryFilter=e.target.value; render();});
  const drop = document.querySelector('#dropzone');
  if (drop) {
    document.querySelector('#upload').addEventListener('change', e=>uploadFiles(c,e.target.files));
    for (const type of ['dragenter','dragover']) drop.addEventListener(type,e=>{e.preventDefault(); drop.classList.add('dragging');});
    for (const type of ['dragleave','drop']) drop.addEventListener(type,e=>{e.preventDefault(); drop.classList.remove('dragging');});
    drop.addEventListener('drop',e=>uploadFiles(c,e.dataTransfer.files));
  }
}
function profile(c) {
  return `<div class="section-heading"><div><span class="eyebrow">THE PERSON BEHIND THE IMAGE</span><h2>Character profile</h2></div><button id="edit-profile" class="quiet">Edit profile ↗</button></div><div class="profile-fields">${Object.entries(fields).map(([key,label])=>`<section class="profile-field ${c.profile[key]?'':'unwritten'}"><h3>${label}</h3><p>${esc(c.profile[key] || 'Not developed yet.')}</p></section>`).join('')}</div><div class="callout"><strong>Room to become.</strong><p>Unwritten fields stay open until her character is developed. Visual identity is established independently of Foundry completion.</p></div>`;
}
function uploadBox() { return '<label id="dropzone" class="dropzone"><span class="upload-icon">↥</span><strong>Drop new renders here</strong><span>or <u>browse images</u> · PNG, JPEG, WebP · up to 12 MB each</span><input id="upload" type="file" multiple accept="image/png,image/jpeg,image/webp"><small>New images arrive in Review. Identity stays protected.</small></label>'; }
function gallery(c) {
  const renders = assetsFor(c).filter(a=>a.kind==='render');
  const visible = renders.filter(a=>galleryFilter==='All images' || a.status===galleryFilter);
  return `<div class="section-heading"><div><span class="eyebrow">MOMENTS, NOT REPLACEMENTS</span><h2>Render gallery</h2></div><select id="gallery-filter" aria-label="Filter renders">${['All images','Review','Accepted','Rejected'].map(v=>`<option ${galleryFilter===v?'selected':''}>${v}</option>`).join('')}</select></div>${uploadBox()}<div class="asset-grid">${visible.map(assetCard).join('')}</div>${!visible.length ? `<div class="empty small"><h3>${renders.length?'No images in this view':'Her next moment belongs here.'}</h3><p>${renders.length?'Choose another review status.':'Add a render to begin the gallery. Her primary reference lives in Identity References.'}</p></div>`:''}`;
}
function assetCard(a) { return `<button class="asset-card" data-open="${esc(a.id)}">${picture(a,'',true)}<div><strong>${esc(a.title)}</strong>${badge(a.locked?'◇ Locked':a.status,a.locked?'lock':'')}</div></button>`; }
function identity(c) {
  const refs=assetsFor(c).filter(a=>a.kind==='identity');
  return `<div class="section-heading"><div><span class="eyebrow">THE VISUAL SOURCE OF TRUTH</span><h2>Identity References</h2></div>${badge(`${refs.length} locked`,'lock')}</div><div class="callout violet"><strong>Preserve the person. Change the scene.</strong><p>Accepted identity references are protected from ordinary gallery edits. New renders never replace the primary reference automatically.</p></div><div class="asset-grid identity-grid">${refs.map(assetCard).join('')}</div>${!refs.length?'<p class="empty">Add an image in Gallery, review it, and explicitly lock it as an identity reference.</p>':''}<div class="trait-stack">${[['immutable','01','Immutable','Protect aggressively.'],['signature','02','Signature','Reuse selectively.'],['flexible','03','Flexible','Explore freely.']].map(([key,n,label,rule])=>`<section><span>${n}</span><div><h3>${label} <small>${rule}</small></h3><p>${esc(c.identity[key] || 'Not recorded yet.')}</p></div></section>`).join('')}</div>`;
}
async function uploadFiles(c, files) {
  if (!files.length) return;
  const input=document.querySelector('#upload'); if(input) input.disabled=true;
  let count=0; const errors=[];
  for(const file of files) {
    try {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>12*1024*1024) throw new Error(`${file.name}: use PNG, JPEG, or WebP up to 12 MB.`);
      notify(`Adding ${file.name}…`);
      await api(`/api/assets?characterId=${encodeURIComponent(c.id)}&title=${encodeURIComponent(file.name.replace(/\.[^.]+$/,''))}`, {method:'POST',headers:{'Content-Type':file.type},body:file}); count++;
    } catch(e) { errors.push(e.message); }
  }
  await reload(); notify(`${count} ${count===1?'image':'images'} added to Review.${errors.length?' '+errors.join(' '):''}`);
}
let viewerIds=[], viewerIndex=0;
function openImage(id) {
  const a=library.assets.find(a=>a.id===id); if(!a) return;
  viewerIds=assetsFor(current()).filter(x=>x.kind===a.kind).map(x=>x.id); viewerIndex=viewerIds.indexOf(id);
  drawViewer(); lightbox.showModal();
}
function drawViewer() {
  const a=library.assets.find(a=>a.id===viewerIds[viewerIndex]);
  lightbox.innerHTML=`<div class="viewer-toolbar"><span>${esc(a.title)}</span><div><button id="previous" aria-label="Previous image" ${viewerIndex===0?'disabled':''}>←</button><span>${viewerIndex+1} / ${viewerIds.length}</span><button id="next" aria-label="Next image" ${viewerIndex===viewerIds.length-1?'disabled':''}>→</button><button id="close-viewer" aria-label="Close image viewer">✕</button></div></div><div class="viewer-body">${picture(a,'',true)}<aside>${badge(a.locked?'◇ IDENTITY LOCKED':a.status,a.locked?'lock':'')}<h2>${esc(a.title)}</h2><p>${a.locked?'This image is a visual authority. Its original file and identity role are protected.':'Review this moment without changing the character’s identity.'}</p><dl><dt>Added</dt><dd>${new Date(a.createdAt).toLocaleDateString()}</dd><dt>Role</dt><dd>${a.kind==='identity'?'Full identity reference':'Render'}</dd></dl>${!a.locked?`<div class="review-buttons"><button data-status="Accepted">Accept render</button><button class="quiet" data-status="Rejected">Mark rejected</button><button class="quiet" data-status="Review">Return to review</button></div><details><summary>Make an identity reference</summary><p>Lock this image as a canonical visual authority. This cannot be undone through gallery controls.</p><label class="confirm"><input id="confirm-lock" type="checkbox"> I approve this image as an identity reference.</label><button id="promote" disabled>Lock identity reference</button></details>`:''}<a class="download" href="/media/${a.id}" download="${esc(a.title)}.${a.filename.split('.').pop()}">Download original ↗</a><p id="viewer-error" role="alert"></p></aside></div>`;
  document.querySelector('#close-viewer').onclick=()=>lightbox.close();
  document.querySelector('#previous').onclick=()=>stepViewer(-1);
  document.querySelector('#next').onclick=()=>stepViewer(1);
  lightbox.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>review(a,{status:b.dataset.status}));
  document.querySelector('#confirm-lock')?.addEventListener('change',e=>document.querySelector('#promote').disabled=!e.target.checked);
  document.querySelector('#promote')?.addEventListener('click',()=>review(a,{status:'Accepted',promoteIdentity:true,confirmIdentity:true}));
}
function stepViewer(n) { if(viewerIndex+n>=0 && viewerIndex+n<viewerIds.length) {viewerIndex+=n;drawViewer();} }
async function review(a,payload) {
  try { await api(`/api/assets/${a.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); await reload(); drawViewer(); notify(payload.promoteIdentity?'Identity reference locked.':'Review saved.'); }
  catch(e){document.querySelector('#viewer-error').textContent=e.message;}
}
function editProfile(c) {
  editor.innerHTML=`<form><div class="section-heading"><h2>Edit ${esc(c.name)}</h2><button type="button" id="close-editor" aria-label="Close profile editor">✕</button></div><p>Write established character details. Empty fields remain undeveloped.</p>${Object.entries(fields).map(([key,label])=>`<label class="edit-field">${label}<textarea name="${key}" maxlength="4000" rows="3">${esc(c.profile[key]||'')}</textarea></label>`).join('')}<div class="editor-actions"><span id="edit-error" role="alert"></span><button type="submit">Save profile</button></div></form>`;
  document.querySelector('#close-editor').onclick=()=>editor.close();
  editor.querySelector('form').onsubmit=async e=>{
    e.preventDefault(); const button=editor.querySelector('[type=submit]'); button.disabled=true;
    try { await api(`/api/characters/${c.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:Object.fromEntries(new FormData(e.target))})}); await reload(); editor.close(); notify('Profile saved.'); }
    catch(err) {document.querySelector('#edit-error').textContent=err.message;button.disabled=false;}
  }; editor.showModal();
}
window.addEventListener('popstate',()=>{tab='profile';render();});
window.addEventListener('keydown',e=>{
  if(lightbox.open && ['ArrowLeft','ArrowRight'].includes(e.key)) {e.preventDefault();stepViewer(e.key==='ArrowLeft'?-1:1);}
  if(e.key==='/' && !lightbox.open && !editor.open && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { const search=document.querySelector('#search'); if(search){e.preventDefault();search.focus();} }
});
reload().catch(e=>{app.innerHTML=`<main class="empty"><h1>The library couldn’t open</h1><p>${esc(e.message)}</p><button id="retry">Try again</button></main>`;document.querySelector('#retry').onclick=()=>location.reload();});
