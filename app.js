const API='https://gzw-data.dev/api/v1';
const PAGE_SIZE=48;
const preferred=['loot_items','weapons','ammo','keys','keycards','medical','backpacks','helmets','vests','plate_carriers','gear','provisions','food','drinks','throwables','night_vision','magazines','suppressors','collimators','scopes','stocks','barrels','handguards','muzzle_devices','tactical_devices','task_items','electronics','jewellery','tools','apparel_items'];
let items=[],filtered=[],shown=PAGE_SIZE,category='all';
const $=s=>document.querySelector(s);
const clean=s=>String(s??'').replaceAll('_',' ');
const num=v=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)?n:0};
const money=v=>num(v)?`$${num(v).toLocaleString()}`:'—';
const field=(o,names)=>{for(const n of names)if(o[n]!==undefined&&o[n]!==null&&o[n]!=='')return o[n];return null};
function normalise(raw,dataset){
  const name=field(raw,['name','title','item_name','Name'])||clean(raw.id)||'Unknown item';
  const value=num(field(raw,['sell_price','sellPrice','price','value','vendor_price','Price']));
  const width=num(field(raw,['width','size_x','gridWidth']))||1,height=num(field(raw,['height','size_y','gridHeight']))||1;
  const image=field(raw,['image','image_url','imageUrl','icon','thumbnail']);
  const type=field(raw,['type','category','class'])||clean(dataset);
  const text=JSON.stringify(raw).toLowerCase();
  const mission=/task|quest|mission/.test(dataset)||/task item|quest item/.test(text);
  const decision=mission?'mission':value>=500?'sell':/weapon|ammo|medical|key|armor|helmet|vest|night_vision/.test(dataset)?'keep':'inspect';
  return {id:`${dataset}:${raw.id||name}`,name,value,slots:width*height,image,type,dataset,decision,description:field(raw,['description','short_description','details']),raw};
}
async function json(url){const r=await fetch(url);if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()}
async function load(){
  try{
    let cached=[];
    try{const local=await fetch('data/catalog.json',{cache:'no-store'});if(local.ok)cached=await local.json()}catch{}
    if(Array.isArray(cached)&&cached.length){
      items=cached.map(x=>normalise(x.raw||x,x.dataset||'items'));
      try{const meta=await fetch('data/version.json',{cache:'no-store'});if(meta.ok){const v=await meta.json();$('#dataVersion').textContent=(v.dataVersion||'SYNCED DATA').slice(0,10)}}catch{}
      renderAfterLoad();return
    }
    const version=await json(`${API}/version`);
    const available=version.datasets||version.data?.datasets||preferred;
    const selected=preferred.filter(x=>available.includes(x));
    const sets=await Promise.allSettled(selected.map(async d=>({d,p:await json(`${API}/${d}?all=true`)})));
    items=sets.flatMap(x=>x.status==='fulfilled'?(x.value.p.data||[]).map(i=>normalise(i,x.value.d)):[]);
    $('#dataVersion').textContent=(version.dataVersion||version.data?.dataVersion||'LIVE DATA').slice(0,10);
    renderAfterLoad();
  }catch(e){$('#status').innerHTML='Field data is temporarily unavailable. <button onclick="location.reload()">Try again</button>';console.error(e)}
}
function renderAfterLoad(){
  const unique=new Map();for(const i of items)if(!unique.has(i.id))unique.set(i.id,i);items=[...unique.values()];
  $('#itemCount').textContent=items.length.toLocaleString();
  $('#categoryCount').textContent=new Set(items.map(i=>i.dataset)).size;
  buildCategories();apply();
}
function buildCategories(){
  const counts={};for(const i of items)counts[i.dataset]=(counts[i.dataset]||0)+1;
  $('#categories').innerHTML=`<button class="category-button active" data-cat="all">All items <small>${items.length}</small></button>`+Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`<button class="category-button" data-cat="${c}">${clean(c)} <small>${n}</small></button>`).join('');
  document.querySelectorAll('.category-button').forEach(b=>b.onclick=()=>{category=b.dataset.cat;shown=PAGE_SIZE;document.querySelectorAll('.category-button').forEach(x=>x.classList.toggle('active',x===b));apply()});
}
function apply(){
  const q=$('#search').value.trim().toLowerCase();
  filtered=items.filter(i=>(category==='all'||i.dataset===category)&&(!q||`${i.name} ${i.type} ${i.dataset} ${i.description||''}`.toLowerCase().includes(q)));
  const sort=$('#sort').value;
  filtered.sort(sort==='value-desc'?(a,b)=>b.value-a.value:sort==='value-slot'?(a,b)=>(b.value/b.slots)-(a.value/a.slots):sort==='category'?(a,b)=>a.dataset.localeCompare(b.dataset)||a.name.localeCompare(b.name):(a,b)=>a.name.localeCompare(b.name));
  $('#resultTitle').textContent=category==='all'?(q?`Search: ${q}`:'All field items'):clean(category);
  render();
}
function esc(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function card(i){return `<button class="item-card" data-id="${esc(i.id)}"><span class="decision ${i.decision}">${i.decision}</span><div class="item-image">${i.image?`<img loading="lazy" src="${esc(i.image)}" alt="" onerror="this.parentNode.innerHTML='<span class=image-fallback>GA</span>'">`:'<span class="image-fallback">GA</span>'}</div><span class="tag">${esc(clean(i.dataset))}</span><h3>${esc(i.name)}</h3><div class="card-meta"><span>${i.slots} slot${i.slots===1?'':'s'}</span><span class="price">${money(i.value)}</span></div></button>`}
function render(){
  $('#status').hidden=filtered.length>0;
  $('#status').textContent=items.length?(filtered.length?'':'No field items match this search.'):'Loading field data…';
  $('#grid').innerHTML=filtered.slice(0,shown).map(card).join('');
  $('#loadMore').hidden=shown>=filtered.length;
  $('#loadMore').textContent=`LOAD MORE · ${Math.min(filtered.length-shown,PAGE_SIZE)} OF ${filtered.length-shown}`;
  document.querySelectorAll('.item-card').forEach(c=>c.onclick=()=>openDetail(items.find(i=>i.id===c.dataset.id)));
}
function openDetail(i){
  if(!i)return;const skip=new Set(['image','image_url','imageUrl','icon','thumbnail','description','name','title']);
  const fields=Object.entries(i.raw).filter(([k,v])=>!skip.has(k)&&['string','number','boolean'].includes(typeof v)&&String(v).length<100).slice(0,16);
  $('#detailContent').innerHTML=`<article class="detail"><div class="detail-top"><div class="detail-image">${i.image?`<img src="${esc(i.image)}" alt="${esc(i.name)}">`:'<span class="image-fallback">GA</span>'}</div><div><span class="tag">${esc(clean(i.dataset))}</span><h2>${esc(i.name)}</h2><p>${esc(i.description||'No field description is currently available.')}</p></div></div><div class="detail-grid"><div class="detail-stat"><small>Sell value</small><b>${money(i.value)}</b></div><div class="detail-stat"><small>Inventory</small><b>${i.slots} slot${i.slots===1?'':'s'}</b></div><div class="detail-stat"><small>Value / slot</small><b>${money(i.value/i.slots)}</b></div></div><div class="raw-fields">${fields.map(([k,v])=>`<div class="raw-field"><span>${esc(clean(k))}</span><b>${esc(v)}</b></div>`).join('')}</div></article>`;
  $('#detailDialog').showModal();
}
$('#search').addEventListener('input',()=>{shown=PAGE_SIZE;apply()});
$('#sort').addEventListener('change',apply);
$('#loadMore').onclick=()=>{shown+=PAGE_SIZE;render()};
$('#clearFilters').onclick=()=>{category='all';$('#search').value='';shown=PAGE_SIZE;document.querySelectorAll('.category-button').forEach((x,n)=>x.classList.toggle('active',n===0));apply()};
$('.dialog-close').onclick=()=>$('#detailDialog').close();
$('#detailDialog').addEventListener('click',e=>{if(e.target===$('#detailDialog'))$('#detailDialog').close()});
document.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement!==$('#search')){e.preventDefault();$('#search').focus()}});
load();
