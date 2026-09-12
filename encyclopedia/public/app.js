import { registerSiteTools } from '/site-tools.js';
const app = document.querySelector('#app');
const lightbox = document.querySelector('#lightbox');
const editor = document.querySelector('#editor');
let library, query = '', filter = 'All characters', tab = 'profile', galleryFilter = 'All images';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gem = '<img class="gem" src="/VIVARIUM_GEM_OFFICIAL_GEN2.png" alt="">';
const masterLogo = '<img class="brand-master" src="/VIVARIUM_GEM_OFFICIAL_GEN2.png" alt="Official Vivarium Gen 2 logo">';
const fields = { whySheWorks:'Why she works', faceArchitecture:'Face architecture', bodySilhouette:'Body silhouette', attractionChannel:'Attraction channel', movementLanguage:'Movement language', identityNucleus:'Identity nucleus', contradiction:'Contradiction engine', voice:'Voice', occupation:'Occupation & skills', privateWorld:'Private world', relationshipPromise:'Relationship promise', backstory:'Backstory' };
const identityFields = {immutable:'Immutable traits',signature:'Signature traits',flexible:'Flexible traits'};
const authorityRoles = {'primary-identity':['💎','Overall identity'],'face':['◉','Face'],'body':['◇','Body silhouette'],'hair':['⌁','Hair'],'tattoos':['✦','Tattoos'],'style':['◆','Styling / heat'],'expression':['◌','Expression'],'wardrobe':['▱','Wardrobe'],'other':['·','Other']};
const atmosphereThemes=[
  {name:'Amethyst archive',accent:'#c7b4f2',secondary:'#805ca8',background:'#111014'},
  {name:'Copper hush',accent:'#e3a477',secondary:'#9d5d53',background:'#15100f',words:['auburn','copper','warm','domestic','soft','intimate']},
  {name:'Electric champagne',accent:'#f0d99f',secondary:'#c78aad',background:'#151313',words:['blonde','bright','electric','feminine','gold','direct']},
  {name:'After-hours emerald',accent:'#9ecbb3',secondary:'#497c6d',background:'#0d1412',words:['green','hazel','botanical','restorer','quiet','measured']},
  {name:'Midnight signal',accent:'#9eb8ef',secondary:'#596aa4',background:'#0c1018',words:['night','after-hours','nocturnal','calm','blue']},
  {name:'Velvet voltage',accent:'#e09ad6',secondary:'#8b4fa5',background:'#150d17',words:['alt','punk','goth','provocative','heat','wild']},
  {name:'Crimson private room',accent:'#e59b9d',secondary:'#934653',background:'#170d10',words:['red','romantic','intense','tempting','private']}
];
let activeAtmosphere=null,atmosphereRun=0;
const hash=value=>[...value].reduce((n,char)=>Math.imul(n^char.charCodeAt(0),16777619)>>>0,2166136261);
const hexRgb=hex=>[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16));
const rgbHex=rgb=>'#'+rgb.map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('');
const mix=(a,b,amount)=>rgbHex(hexRgb(a).map((value,index)=>value+(hexRgb(b)[index]-value)*amount));
function rgbHsl(r,g,b){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min,l=(max+min)/2;let h=0;if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;}return[h,d?d/(1-Math.abs(2*l-1)):0,l];}
function hslHex(h,s,l){const c=(1-Math.abs(2*l-1))*s,x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;let rgb=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];return rgbHex(rgb.map(value=>(value+m)*255));}
function semanticAtmosphere(c){
  const text=JSON.stringify([c.name,c.summary,c.tags,c.profile,c.identity]).toLowerCase(),variant=c.visualAtmosphere?.variant||0;
  let best=atmosphereThemes[0],score=0;
  for(const theme of atmosphereThemes.slice(1)){const next=(theme.words||[]).filter(word=>text.includes(word)).length;if(next>score){best=theme;score=next;}}
  if(!score)best=atmosphereThemes[(hash(c.id)+variant)%atmosphereThemes.length];
  else if(variant)best=atmosphereThemes[(atmosphereThemes.indexOf(best)+variant)%atmosphereThemes.length];
  const motion=/electric|playful|provocative|wild|quick|dance/.test(text)?'shimmer':/calm|quiet|measured|deliberate|still/.test(text)?'drift':/intense|bold|direct/.test(text)?'pulse':'drift';
  return {...best,motion,strength:c.visualAtmosphere?.strength||'subtle'};
}
function setAtmosphere(value){
  activeAtmosphere=value;const root=document.documentElement;
  root.style.setProperty('--char-accent',value.accent);root.style.setProperty('--char-secondary',value.secondary);root.style.setProperty('--char-bg',value.background);root.style.setProperty('--accent',mix(value.accent,'#ffffff',.13));
  document.body.dataset.atmosphere=value.strength||'subtle';document.body.dataset.motion=value.motion||'drift';
}
function clearAtmosphere(){setAtmosphere({name:'Vivarium archive',accent:'#c7b4f2',secondary:'#805ca8',background:'#111114',motion:'still',strength:'subtle'});delete document.body.dataset.character;}
async function sampledAccent(asset,variant=0){
  if(!asset)return null;const image=new Image();image.src=`/media/${encodeURIComponent(asset.id)}`;
  try{await image.decode();const canvas=document.createElement('canvas');canvas.width=canvas.height=36;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0,36,36);const bins=Array.from({length:12},()=>({weight:0,h:0,s:0,l:0}));const pixels=context.getImageData(0,0,36,36).data;
    for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<220)continue;const [h,s,l]=rgbHsl(pixels[i],pixels[i+1],pixels[i+2]);if(s<.16||l<.12||l>.9)continue;const weight=s*(1-Math.abs(l-.55));const bin=bins[Math.floor(h/30)%12];bin.weight+=weight;bin.h+=h*weight;bin.s+=s*weight;bin.l+=l*weight;}
    const bin=bins.sort((a,b)=>b.weight-a.weight)[0];if(!bin.weight)return null;return hslHex((bin.h/bin.weight+variant*7)%360,Math.max(.42,Math.min(.75,bin.s/bin.weight)),.69);
  }catch{return null;}
}
async function applyAtmosphere(c){
  document.body.dataset.character=c.id;const run=++atmosphereRun,configured=c.visualAtmosphere||{},base=semanticAtmosphere(c);
  if(configured.mode==='locked'&&configured.palette){setAtmosphere({...base,...configured.palette,motion:configured.motion||base.motion,strength:configured.strength||base.strength,name:'Locked atmosphere'});return;}
  setAtmosphere({...base,motion:configured.motion||base.motion});const accent=await sampledAccent(assetFor(c),configured.variant||0);
  if(run!==atmosphereRun||current()?.id!==c.id||!accent)return;
  const directedAccent=mix(accent,base.accent,.58);
  setAtmosphere({...base,accent:directedAccent,secondary:mix(directedAccent,base.secondary,.55),background:mix('#0c0b0f',directedAccent,configured.strength==='immersive'?.19:.1),motion:configured.motion||base.motion,name:`${base.name} · identity sampled`});
}
const assetFor = c => library.assets.find(a => a.id === c.primaryAssetId);
const assetsFor = c => library.assets.filter(a => a.characterId === c.id);
const authorityFor = c => ({...(c.identityAuthority||{}),...(c.primaryAssetId?{'primary-identity':c.primaryAssetId}:{})});
const rolesFor = (c,id) => Object.keys(authorityRoles).filter(role=>authorityFor(c)[role]===id);
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
  app.innerHTML = `<aside class="sidebar"><a class="brand" href="/characters">${gem}<span>VIVARIUM<small>CHARACTER ENCYCLOPEDIA</small></span></a><div class="side-label">YOUR COLLECTION</div><a class="side-link active" href="/characters"><span>▦</span> Characters <b>${library.characters.length}</b></a><div class="side-note"><span class="live-dot"></span> GEN 2 COLLECTION<p>Specific people.<br>Living worlds.</p></div><div class="sidebar-bottom">${masterLogo}<span>Identity comes first.<small>Official Gen 2 brand lock</small></span></div></aside><div class="workspace"><header class="topbar"><span>THE VIVARIUM ARCHIVE</span><span class="top-status"><i class="live-dot"></i> ${library.hosted ? 'Private cloud library' : 'Local library'}</span></header>${content}<footer>VIVARIUM <span>Every face has a world behind it.</span><span>GENERATION 02</span></footer></div>`;
  app.querySelectorAll('a[href^="/characters"]').forEach(a => a.addEventListener('click', e => { if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); nav(a.getAttribute('href')); } }));
  app.querySelectorAll('img[data-asset]').forEach(img => img.addEventListener('error', () => { const p = document.createElement('div'); p.className = 'missing-image'; p.textContent = 'Reference unavailable · restore the original asset'; img.replaceWith(p); }, { once:true }));
}
function picture(asset, className = '', contain = false) {
  if(asset?.storage==='linked')return `<div class="image-wrap missing-image ${className}">${gem}<span>Linked render<br>Original awaiting upload</span></div>`;
  return asset ? `<div class="image-wrap ${className} ${contain ? 'contain' : ''}"><img data-asset="${esc(asset.id)}" src="/media/${esc(asset.id)}" alt="${esc(asset.title)}">${gem}</div>` : `<div class="image-wrap missing-image ${className}">${gem}<span>Identity reference awaits</span></div>`;
}
function render() {
  if (!library) return;
  document.title = current() ? `${current().name} · Vivarium` : 'Vivarium · Character Encyclopedia';
  if (location.pathname === '/' || location.pathname === '/characters') {clearAtmosphere();return renderCollection();}
  const c = current();
  if (!c) { frame('<main><h1>Character not found</h1><p>This character is not in your library.</p><a href="/characters">Return to characters →</a></main>'); return; }
  renderCharacter(c);applyAtmosphere(c);
}
function renderCollection() {
  frame(`<main><div class="eyebrow">THE COLLECTION / GENERATION 02</div><div class="page-heading"><div><h1>Characters<span class="heading-dot">.</span></h1><p>A living archive of distinct identities and the worlds they inhabit.</p></div><span class="collection-count">${String(library.characters.length).padStart(2,'0')}<small>CHARACTERS</small></span></div><div class="toolbar"><button id="new-character">+ Add character</button><label class="search"><span>⌕</span><input id="search" type="search" placeholder="Find a character, trait, or world…" aria-label="Search characters" value="${esc(query)}"><kbd>/</kbd></label><label class="select-wrap"><span class="sr-only">Filter characters</span><select id="filter">${['All characters','Identity locked','Building','Foundry ready'].map(v=>`<option ${v===filter?'selected':''}>${v}</option>`).join('')}</select></label></div><div class="result-bar"><span id="result-count"></span><span>CURATED BY IDENTITY <span class="muted">↗</span></span></div><div class="character-grid" id="results"></div><section class="collection-note"><div class="line-icon">${gem}</div><div><h3>One identity. A thousand possible moments.</h3><p>Canonical references preserve who she is. The gallery holds everywhere she goes.</p></div></section></main>`);
  document.querySelector('#new-character').onclick=createCharacterForm;
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
  frame(`<main class="dossier"><div class="atmosphere-layer" aria-hidden="true"><i></i><i></i><i></i></div><a class="back" href="/characters">← All characters</a><div class="dossier-layout"><aside class="portrait-panel"><button class="hero-image" data-open="${esc(assetFor(c)?.id || '')}" aria-label="Open primary identity reference">${picture(assetFor(c), '', true)}</button><div class="portrait-caption">${gem}<div><strong>${assetFor(c)?.locked ? 'Primary identity · Locked' : 'Primary identity awaits'}</strong><small>FULL IDENTITY REFERENCE</small></div></div><div class="reference-note">The reference owns identity.<br>The next image owns the moment.</div></aside><div class="dossier-content" data-initial="${esc(c.name.charAt(0))}"><div class="eyebrow">CHARACTER DOSSIER <span>/ GEN ${c.generation} — ${String(c.sequence).padStart(2,'0')}</span></div><h1>${esc(c.name)}</h1><div class="status-row">${badge(c.canonStatus)}${badge(`Foundry · ${c.foundryStatus}`)}${c.age ? badge(`${c.age} years`) : ''}<button id="atmosphere-control" class="atmosphere-chip">✦ Atmosphere · ${c.visualAtmosphere?.mode==='locked'?'Locked':'Auto'}</button></div><p class="intro">${esc(c.summary)}</p><button id="continuum-pack" class="continuum-button"><span>${gem}<b>BUILD CONTINUUM PACK</b></span><small>Identity map · exact originals · generation context</small><i>↗</i></button><nav class="tabs" aria-label="Character sections">${[['profile','Profile',''],['gallery','Gallery',assets.filter(a=>a.kind==='render').length],['identity','Identity References',refs.length]].map(([key,label,count])=>`<button data-tab="${key}" aria-current="${tab===key?'page':'false'}" class="${tab===key?'selected':''}">${label} ${count!==''?`<small>${count}</small>`:''}</button>`).join('')}</nav><div id="section">${section}</div></div></div></main>`);
  app.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ tab=b.dataset.tab; render(); }));
  app.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openImage(b.dataset.open)));
  document.querySelector('#edit-profile')?.addEventListener('click',()=>editProfile(c));
  document.querySelector('#continuum-pack')?.addEventListener('click',()=>showContinuumPack(c));
  document.querySelector('#atmosphere-control')?.addEventListener('click',()=>showAtmosphere(c));
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
function assetCard(a) { const c=library.characters.find(c=>c.id===a.characterId),roles=a.kind==='identity'&&c?rolesFor(c,a.id):[];return `<button class="asset-card" data-open="${esc(a.id)}">${picture(a,'',true)}<div><strong>${esc(a.title)}</strong>${badge(a.locked?'◇ Locked':a.status,a.locked?'lock':'')}${roles.length?`<span class="role-line">${roles.map(role=>esc(authorityRoles[role][1])).join(' · ')}</span>`:''}</div></button>`; }
function identity(c) {
  const refs=assetsFor(c).filter(a=>a.kind==='identity');
  const map=authorityFor(c);
  return `<div class="section-heading"><div><span class="eyebrow">THE VISUAL SOURCE OF TRUTH</span><h2>Identity References</h2></div>${badge(`${refs.length} locked`,'lock')}</div><div class="callout violet"><strong>Preserve the person. Change the scene.</strong><p>Each reference can own a precise part of identity. Open a locked reference to assign its authority roles.</p></div><section class="identity-map"><div class="identity-map-title"><span class="eyebrow">${esc(c.name.toUpperCase())} · IDENTITY MAP</span><strong>${Object.values(map).filter(Boolean).length} roles assigned</strong></div><div class="identity-map-grid">${Object.entries(authorityRoles).map(([role,[icon,label]])=>{const a=refs.find(a=>a.id===map[role]);return `<button ${a?'data-open="'+esc(a.id)+'"':'disabled'}><span>${icon}</span><small>${esc(label)}</small><strong>${a?esc(a.title):'Unset'}</strong></button>`;}).join('')}</div></section><div class="asset-grid identity-grid">${refs.map(assetCard).join('')}</div>${!refs.length?'<p class="empty">Add an image in Gallery, review it, and explicitly lock it as an identity reference.</p>':''}<div class="trait-stack">${[['immutable','01','Immutable','Protect aggressively.'],['signature','02','Signature','Reuse selectively.'],['flexible','03','Flexible','Explore freely.']].map(([key,n,label,rule])=>`<section><span>${n}</span><div><h3>${label} <small>${rule}</small></h3><p>${esc(c.identity[key] || 'Not recorded yet.')}</p></div></section>`).join('')}</div>`;
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
  const c=current(),assigned=new Set(rolesFor(c,a.id));
  lightbox.innerHTML=`<div class="viewer-toolbar"><span>${esc(a.title)}</span><div><button id="previous" aria-label="Previous image" ${viewerIndex===0?'disabled':''}>←</button><span>${viewerIndex+1} / ${viewerIds.length}</span><button id="next" aria-label="Next image" ${viewerIndex===viewerIds.length-1?'disabled':''}>→</button><button id="close-viewer" aria-label="Close image viewer">✕</button></div></div><div class="viewer-body">${picture(a,'',true)}<aside>${badge(a.locked?'◇ IDENTITY LOCKED':a.status,a.locked?'lock':'')}<h2>${esc(a.title)}</h2><p>${a.locked?'This image is a visual authority. Assign exactly what it owns below.':'Review this moment without changing the character’s identity.'}</p><dl><dt>Added</dt><dd>${new Date(a.createdAt).toLocaleDateString()}</dd><dt>Role</dt><dd>${a.kind==='identity'?'Identity reference':'Render'}</dd></dl>${a.locked?`<fieldset class="authority-picker"><legend>Reference authority</legend>${Object.entries(authorityRoles).map(([role,[icon,label]])=>`<label><input type="checkbox" name="authority" value="${role}" ${assigned.has(role)?'checked':''}><span>${icon}</span>${esc(label)}</label>`).join('')}<button id="save-authority">Save authority map</button></fieldset>`:`<div class="review-buttons"><button data-status="Accepted">Accept render</button><button class="quiet" data-status="Rejected">Mark rejected</button><button class="quiet" data-status="Review">Return to review</button></div><details><summary>Make an identity reference</summary><p>Lock this image as a canonical visual authority. This cannot be undone through gallery controls.</p><label class="confirm"><input id="confirm-lock" type="checkbox"> I approve this image as an identity reference.</label><button id="promote" disabled>Lock identity reference</button></details>`}<a class="download" href="${a.storage === 'linked' ? esc(a.sourceUrl) : '/media/'+a.id}" download="${esc(a.title)}.${a.filename?.split('.').pop() || 'png'}">${a.storage === 'linked' ? 'Open source link ↗' : 'Download original ↗'}</a><p id="viewer-error" role="alert"></p></aside></div>`;
  document.querySelector('#close-viewer').onclick=()=>lightbox.close();
  document.querySelector('#previous').onclick=()=>stepViewer(-1);
  document.querySelector('#next').onclick=()=>stepViewer(1);
  lightbox.querySelectorAll('[data-status]').forEach(b=>b.onclick=()=>review(a,{status:b.dataset.status}));
  document.querySelector('#confirm-lock')?.addEventListener('change',e=>document.querySelector('#promote').disabled=!e.target.checked);
  document.querySelector('#promote')?.addEventListener('click',()=>review(a,{status:'Accepted',promoteIdentity:true,confirmIdentity:true}));
  document.querySelector('#save-authority')?.addEventListener('click',()=>saveAuthority(c,a,assigned));
}
function stepViewer(n) { if(viewerIndex+n>=0 && viewerIndex+n<viewerIds.length) {viewerIndex+=n;drawViewer();} }
async function review(a,payload) {
  try { await api(`/api/assets/${a.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}); await reload(); drawViewer(); notify(payload.promoteIdentity?'Identity reference locked.':'Review saved.'); }
  catch(e){document.querySelector('#viewer-error').textContent=e.message;}
}
async function saveAuthority(c,a,previous) {
  const chosen=new Set([...lightbox.querySelectorAll('input[name="authority"]:checked')].map(input=>input.value)),assignments={};
  for(const role of Object.keys(authorityRoles)){if(chosen.has(role))assignments[role]=a.id;else if(previous.has(role))assignments[role]=null;}
  const button=document.querySelector('#save-authority');button.disabled=true;
  try{await api(`/api/characters/${c.id}/identity-authority`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({assignments})});await reload();drawViewer();notify('Identity authority map saved.');}
  catch(error){document.querySelector('#viewer-error').textContent=error.message;button.disabled=false;}
}
function showAtmosphere(c) {
  editor.classList.remove('wide');const palette=activeAtmosphere||semanticAtmosphere(c),configured=c.visualAtmosphere||{};
  editor.innerHTML=`<form class="atmosphere-editor"><div class="section-heading"><div><span class="eyebrow">VISUAL ATMOSPHERE</span><h2>${esc(c.name)} · living palette</h2></div><button type="button" id="close-editor" aria-label="Close atmosphere editor">✕</button></div><p>The dossier reads her canonical identity reference and character DNA automatically. Lock a palette only when you want it to stop evolving.</p><div class="atmosphere-preview" style="--preview-accent:${esc(palette.accent)};--preview-secondary:${esc(palette.secondary)};--preview-bg:${esc(palette.background)}"><span>${gem}</span><div><small>${c.visualAtmosphere?.mode==='locked'?'LOCKED ART DIRECTION':'AUTOMATIC ART DIRECTION'}</small><strong>${esc(palette.name||'Custom atmosphere')}</strong><em>${assetFor(c)?'Canonical identity sampled':'Profile DNA · ready for first identity reference'}</em></div></div><div class="palette-fields"><label>Light<input type="color" name="accent" value="${esc(palette.accent)}"></label><label>Signal<input type="color" name="secondary" value="${esc(palette.secondary)}"></label><label>Room<input type="color" name="background" value="${esc(palette.background)}"></label></div><div class="create-grid"><label class="edit-field">Atmosphere strength<select name="strength"><option value="subtle" ${configured.strength!=='immersive'?'selected':''}>Subtle</option><option value="immersive" ${configured.strength==='immersive'?'selected':''}>Immersive</option></select></label><label class="edit-field">Motion language<select name="motion">${[['drift','Slow drift'],['shimmer','Faceted shimmer'],['pulse','Soft pulse'],['still','Still']].map(([value,label])=>`<option value="${value}" ${(configured.motion||palette.motion)===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="atmosphere-actions"><button type="button" class="quiet" id="reset-atmosphere">Reset to Vivarium</button><button type="button" class="quiet" id="regenerate-atmosphere">Regenerate Auto</button><button type="submit">Save & lock atmosphere</button></div><p id="edit-error" role="alert"></p></form>`;
  document.querySelector('#close-editor').onclick=()=>editor.close();
  const save=async visualAtmosphere=>{try{await api(`/api/characters/${c.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({visualAtmosphere})});await reload();editor.close();notify(visualAtmosphere?.mode==='locked'?'Atmosphere locked.':'Automatic atmosphere refreshed.');}catch(error){document.querySelector('#edit-error').textContent=error.message;}};
  editor.querySelector('form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target);save({mode:'locked',strength:data.get('strength'),motion:data.get('motion'),variant:configured.variant||0,palette:{accent:data.get('accent'),secondary:data.get('secondary'),background:data.get('background')}});};
  document.querySelector('#regenerate-atmosphere').onclick=()=>{const data=new FormData(editor.querySelector('form'));save({mode:'auto',strength:data.get('strength'),motion:data.get('motion'),variant:((configured.variant||0)+1)%100});};
  document.querySelector('#reset-atmosphere').onclick=()=>save(null);
  editor.showModal();
}
async function showContinuumPack(c) {
  try {
    editor.classList.remove('wide');
    const pack=await api(`/api/characters/${c.id}/continuum-pack`),roles=Object.entries(pack.identityAuthority.roles).filter(([,value])=>value);
    editor.innerHTML=`<div class="continuum-dialog"><div class="section-heading"><div><span class="eyebrow">GENERATION HANDOFF</span><h2>${esc(c.name)} · CONTINUUM Pack</h2></div><button type="button" id="close-editor" aria-label="Close CONTINUUM pack">✕</button></div><p>Everything needed to preserve this identity across a new moment.</p><div class="pack-stats"><span><b>${pack.references.length}</b> locked references</span><span><b>${roles.length}</b> authority roles</span><span><b>${pack.generationReferenceAssetIds.length}</b> generation images</span></div><section class="pack-map">${Object.entries(authorityRoles).map(([role,[icon,label]])=>{const ref=pack.identityAuthority.roles[role];return `<div><span>${icon}</span><small>${esc(label)}</small><strong>${ref?esc(ref.title):'Unset'}</strong>${ref?`<code>${esc(ref.sha256.slice(0,12))}…</code>`:''}</div>`;}).join('')}</section><label class="pack-context">Generation-ready prompt context<textarea readonly rows="12">${esc(pack.promptContext)}</textarea></label><div class="editor-actions"><span id="edit-error" role="alert"></span><button class="quiet" id="download-pack">Download JSON</button><button id="copy-pack">Copy CONTINUUM Pack</button></div></div>`;
    document.querySelector('#close-editor').onclick=()=>editor.close();
    document.querySelector('#copy-pack').onclick=async()=>{await navigator.clipboard.writeText(JSON.stringify(pack,null,2));notify('CONTINUUM Pack copied.');};
    document.querySelector('#download-pack').onclick=()=>{const link=document.createElement('a');link.href=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));link.download=`${c.id}-continuum-pack.json`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);};
    editor.showModal();
  } catch(error){notify(error.message);}
}
function editProfile(c) {
  editor.classList.remove('wide');
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
function createCharacterForm() {
  editor.classList.add('wide');
  const textareas=(group,definitions)=>Object.entries(definitions).map(([key,label])=>`<label class="edit-field">${label}<textarea name="${group}.${key}" maxlength="4000" rows="3"></textarea></label>`).join('');
  editor.innerHTML=`<form class="character-create-form"><div class="section-heading"><div><span class="eyebrow">MANUAL CHARACTER SLOT</span><h2>A new identity</h2></div><button type="button" id="close-editor" aria-label="Close character form">✕</button></div><p>Create the complete dossier now, or leave unfinished fields open for later development.</p><fieldset class="form-section"><legend>Core record</legend><div class="create-grid"><label class="edit-field">Name<input name="name" required maxlength="120" autocomplete="off" placeholder="e.g. Inez Vale"></label><label class="edit-field">Character ID<input name="id" required pattern="[a-z][a-z0-9-]{1,79}" autocomplete="off" placeholder="e.g. inez-vale"><small>Permanent lowercase ID used by ChatGPT and links.</small></label><label class="edit-field">Adult age<input name="age" type="number" min="21" max="2000" required></label><label class="edit-field">Tags<input name="tags" maxlength="975" placeholder="Quiet confidence, Restorer, Slow burn"><small>Separate up to 16 tags with commas.</small></label><label class="edit-field">Canon status<select name="canonStatus"><option>Building</option><option>Canon</option><option>Archived</option></select></label><label class="edit-field">Foundry status<select name="foundryStatus"><option>Not run</option><option>In progress</option><option>Complete</option></select></label></div><label class="edit-field">Identity summary<textarea name="summary" maxlength="1000" rows="3"></textarea></label><label class="edit-field">Source / provenance note<input name="source" maxlength="2000" placeholder="Where this established canon came from"></label></fieldset><fieldset class="form-section"><legend>Identity rules</legend><p>These become the immutable, signature, and flexible layers in every CONTINUUM Pack.</p><div class="create-columns">${textareas('identity',identityFields)}</div></fieldset><fieldset class="form-section"><legend>Character profile</legend><p>Every field shown on the finished Profile tab is available here.</p><div class="create-columns">${textareas('profile',fields)}</div></fieldset><div class="editor-actions"><span id="edit-error" role="alert"></span><button type="submit">Create character slot</button></div></form>`;
  document.querySelector('#close-editor').onclick=()=>editor.close();
  const form=editor.querySelector('form'),name=form.elements.name,id=form.elements.id;
  let idWasEdited=false;
  id.addEventListener('input',()=>{idWasEdited=true;});
  name.addEventListener('input',()=>{if(!idWasEdited)id.value=name.value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);});
  form.onsubmit=async e=>{
    e.preventDefault();const data=new FormData(form),button=form.querySelector('[type=submit]');button.disabled=true;
    const collect=prefix=>Object.fromEntries([...data.entries()].filter(([key])=>key.startsWith(prefix+'.')).map(([key,value])=>[key.slice(prefix.length+1),value]));
    const input={id:data.get('id'),name:data.get('name'),age:Number(data.get('age')),summary:data.get('summary'),tags:String(data.get('tags')||'').split(',').map(value=>value.trim()).filter(Boolean),canonStatus:data.get('canonStatus'),foundryStatus:data.get('foundryStatus'),identity:collect('identity'),profile:collect('profile')};
    if(data.get('source'))input.source=data.get('source');
    try{const c=await api('/api/characters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});await reload();editor.close();nav('/characters/'+c.id);notify(`${c.name} is ready to develop.`);}
    catch(error){document.querySelector('#edit-error').textContent=error.message;button.disabled=false;}
  };
  editor.showModal();
}
editor.addEventListener('close',()=>editor.classList.remove('wide'));
reload().then(()=>registerSiteTools({api,reload,navigate:nav})).catch(e=>{app.innerHTML=`<main class="empty"><h1>The library couldn’t open</h1><p>${esc(e.message)}</p><button id="retry">Try again</button></main>`;document.querySelector('#retry').onclick=()=>location.reload();});
