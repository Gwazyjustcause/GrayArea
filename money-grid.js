(()=>{
'use strict';
const $=id=>document.getElementById(id),STORE='grayarea-raid-grid-v1',LEGACY='grayarea-money-tool-v3';
const empty=()=>({gear:{bag:'bag-7',carrier:'carrier-12'},placements:[],manual:[],prices:{},dims:{}});
let gear=[],items=[],byId=new Map(),state=empty(),selectedId=null,selectedUid=null,rotated=false,limit=65,history=[],dragged=null,gearLoaded=false,catalogLoaded=false;
try{const raw=JSON.parse(localStorage.getItem(STORE)||'null');if(raw&&Array.isArray(raw.placements)&&raw.gear)state={...empty(),...raw,gear:{...empty().gear,...raw.gear},prices:raw.prices||{},dims:raw.dims||{},manual:Array.isArray(raw.manual)?raw.manual:[]};}
catch(e){console.warn('Could not read saved raid',e)}
const n=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=value;if(cls)x.className=cls;return x};
const fmt=value=>'$'+Math.round(Number(value)||0).toLocaleString('en-US');
const number=value=>{const result=Number(String(value??0).replace(/[$,\s]/g,''));return Number.isFinite(result)?Math.max(0,result):0};
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
const isWeapon=item=>!!item&&(/weapon|firearm|rifle|pistol|shotgun|carbine|smg|sniper|dmr/i.test(item.category+' '+item.dataset)||/\b(M4A1|DDM4|AKM|AK-74|AUG|G36|G3|FAMAS|UMP45|M16|M700|SKS|SVD|MP5|Glock)\b/i.test(item.name));
function save(){try{localStorage.setItem(STORE,JSON.stringify(state))}catch(e){console.warn('Unable to save local raid',e)}}
function checkpoint(){history.push(JSON.stringify(state));if(history.length>40)history.shift()}
function info(message){$('raidMessage').textContent=message}
function selected(){return byId.get(selectedId)||null}
function currentGear(zone){return gear.find(g=>g.id===state.gear[zone])||gear.find(g=>g.kind===zone)||{id:'fallback-'+zone,name:'Unverified grid',cols:4,rows:4,sling:false,kind:zone}}
function value(item){return item?number(Object.prototype.hasOwnProperty.call(state.prices,item.id)?state.prices[item.id]:item.price):0}
function sizes(item){return state.dims[item.id]||{w:item.w,h:item.h}}
function oriented(item,turn=false){const s=sizes(item);return{w:turn?s.h:s.w,h:turn?s.w:s.h}}
function colliding(zone,x,y,w,h,ignore=null,arr=state.placements){return arr.filter(p=>p.zone===zone&&p.uid!==ignore&&x<p.x+p.w&&p.x<x+w&&y<p.y+p.h&&p.y<y+h)}
function inBounds(zone,x,y,w,h){const g=currentGear(zone);return x>=0&&y>=0&&x+w<=g.cols&&y+h<=g.rows}
function candidate(item,zone,x,y,turn=false,ignore=null){const d=oriented(item,turn);if(zone==='sling'){if(!currentGear('bag').sling||!isWeapon(item))return null;const replaced=state.placements.filter(p=>p.zone==='sling'&&p.uid!==ignore);return {zone,x:0,y:0,w:1,h:1,turn,swap:replaced,lost:replaced.reduce((a,p)=>a+value(byId.get(p.itemId)),0)}}
if(!inBounds(zone,x,y,d.w,d.h))return null;
const swap=colliding(zone,x,y,d.w,d.h,ignore);
return{zone,x,y,w:d.w,h:d.h,turn,swap,lost:swap.reduce((a,p)=>a+value(byId.get(p.itemId)),0)}}
function placementsFor(item,ignore=null){if(!item)return[];const d=sizes(item);const all=[];
for(const zone of ['bag','carrier']){const g=currentGear(zone);for(const turn of (d.w===d.h?[false]:[false,true])){const size=oriented(item,turn);if(size.w>g.cols||size.h>g.rows)continue;
for(let y=0;y<=g.rows-size.h;y++)for(let x=0;x<=g.cols-size.w;x++)all.push(candidate(item,zone,x,y,turn,ignore));}}
if(currentGear('bag').sling&&isWeapon(item))all.push(candidate(item,'sling',0,0,false,ignore));
return all.filter(Boolean)}
function recommendation(item,ignore=null){if(!item)return null;const options=placementsFor(item,ignore),free=options.filter(x=>!x.swap.length);
if(free.length){const preferred=free.sort((a,b)=>(a.zone==='sling'?-1:0)-(b.zone==='sling'?-1:0)||a.y-b.y||a.x-b.x)[0];return {...preferred,status:'TAKE',gain:ignore?0:value(item)};}
const beneficial=options.filter(x=>value(item)>x.lost&&x.swap.length).sort((a,b)=>a.lost-b.lost||a.swap.length-b.swap.length);
return beneficial.length?{...beneficial[0],status:'SWAP',gain:value(item)-beneficial[0].lost}:null}
function parseItem(entry){const r=entry.raw||entry,cat=String(entry.dataset||r.dataset||r.category||'items'),name=String(r.name||r.title||r.item_name||r.id||'Untitled item');
const size=String(r.grid_size||r.gridSize||r.inventory_size||'').match(/(\d+)\s*[x×]\s*(\d+)/i);
const w=size?Number(size[1]):number(r.width||r.size_x||r.gridWidth||0),h=size?Number(size[2]):number(r.height||r.size_y||r.gridHeight||0);
const known=w>0&&h>0;const cells=number(r.slots||r.slot_count||0);
return{id:cat+':'+String(r.id||name),name,category:String(r.category||cat),dataset:cat,price:number(r.sell_price??r.sellPrice??r.grayarea_price??0),w:known?Math.min(15,w):1,h:known?Math.min(15,h):Math.max(1,Math.min(15,cells||1)),known,image:r.image||r.image_url||r.icon||'',source:'WIKI REFERENCE'};}
function refreshRecordMap(){byId=new Map();for(const item of items)byId.set(item.id,item);for(const item of state.manual){if(item?.id)byId.set(item.id,item);}}
function imageNode(item){if(!item.image)return n('span',isWeapon(item)?'GUN':'LOOT','no-img');const pic=n('img');pic.src=item.image;pic.alt='';pic.loading='lazy';pic.onerror=()=>pic.replaceWith(n('span','LOOT','no-img'));return pic}
function lootList(){const q=$('searchItems').value.trim().toLowerCase(),onlyGuns=$('weaponsOnly').checked,unpriced=$('showUnpriced').checked,sort=$('sortItems').value;
const list=[...byId.values()].filter(i=>(!q||(i.name+' '+i.category).toLowerCase().includes(q))&&(!onlyGuns||isWeapon(i))&&(unpriced||value(i)>0));
list.sort(sort==='price'?(a,b)=>value(b)-value(a):sort==='name'?(a,b)=>a.name.localeCompare(b.name):(a,b)=>value(b)/(sizes(b).w*sizes(b).h)-value(a)/(sizes(a).w*sizes(a).h));
const host=$('lootResults');host.replaceChildren();for(const item of list.slice(0,limit)){const row=n('button',undefined,'raid-loot-item'+(selectedId===item.id?' active':''));row.type='button';row.draggable=true;row.setAttribute('aria-label','Choose '+item.name);row.append(imageNode(item));
const info=n('span');info.append(n('strong',item.name),n('small',sizes(item).w+'×'+sizes(item).h+(item.known?'':' · verify shape')));
const cost=n('span',fmt(value(item)),'loot-money');cost.append(n('small',fmt(value(item)/(sizes(item).w*sizes(item).h))+'/cell'));row.append(info,cost);
row.addEventListener('click',()=>choose(item.id));row.addEventListener('dragstart',e=>{dragged={id:item.id,uid:null};selectedId=item.id;selectedUid=null;rotated=false;e.dataTransfer.setData('text/plain',item.id);e.dataTransfer.effectAllowed='copyMove';});row.addEventListener('dragend',()=>{dragged=null});host.append(row)}
if(!list.length)host.append(n('p','No matching items. Enable unpriced items or add your own.','raid-uncertain'));
$('loadMore').hidden=list.length<=limit;$('loadMore').textContent='SHOW MORE ('+(list.length-limit)+')';}
function choose(itemId,placementUid=null){selectedId=itemId;selectedUid=placementUid;const p=state.placements.find(x=>x.uid===placementUid);rotated=!!p?.turn;renderAll();}
function setGearWarn(){const warnings=['bag','carrier'].map(z=>currentGear(z)).filter(g=>g.unverified&&g.notes).map(g=>g.name+': '+g.notes);$('gearWarning').hidden=!warnings.length;$('gearWarning').textContent=warnings.length?'Wiki conflict — '+warnings.join(' | '):''}
function renderGearSelectors(){for(const z of ['bag','carrier']){const el=$ (z+'Gear');el.replaceChildren();for(const g of gear.filter(x=>x.kind===z)){const option=n('option',g.name+' · '+g.cols+'×'+g.rows+(g.sling?' + sling':''));option.value=g.id;el.append(option)}el.value=state.gear[z];}
setGearWarn();}
function renderZone(zone){const g=currentGear(zone),host=$(zone+'Grid');host.replaceChildren();host.style.setProperty('--cols',g.cols);host.style.setProperty('--rows',g.rows);
const item=selected(),ignore=selectedUid;
for(let y=0;y<g.rows;y++)for(let x=0;x<g.cols;x++){const cell=n('button','', 'raid-cell');cell.type='button';cell.dataset.x=x;cell.dataset.y=y;cell.setAttribute('aria-label',zone+' row '+(y+1)+' column '+(x+1));
if(item){const loc=candidate(item,zone,x,y,rotated,ignore);if(loc)cell.classList.add(loc.swap.length?'blocked':'preview')}
cell.style.gridColumn=String(x+1);cell.style.gridRow=String(y+1);
cell.addEventListener('click',()=>clickPlace(zone,x,y));cell.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='move';});cell.addEventListener('drop',e=>{e.preventDefault();acceptDrop(zone,x,y)});host.append(cell)}
for(const p of state.placements.filter(x=>x.zone===zone)){const data=byId.get(p.itemId);if(!data)continue;const card=n('button',undefined,'raid-placed'+(p.uid===selectedUid?' active':''));card.type='button';card.draggable=true;card.style.gridColumn=(p.x+1)+' / span '+p.w;card.style.gridRow=(p.y+1)+' / span '+p.h;card.style.zIndex='3';card.title=data.name+' · '+fmt(value(data))+' · '+p.w+'×'+p.h;card.append(imageNode(data),n('strong',data.name),n('small',fmt(value(data))));
card.addEventListener('click',e=>{e.stopPropagation();choose(data.id,p.uid);info('Selected '+data.name+'. Click another location to move, or press REMOVE.');});
card.addEventListener('dragstart',e=>{dragged={id:data.id,uid:p.uid};selectedId=data.id;selectedUid=p.uid;rotated=!!p.turn;e.dataTransfer.setData('text/plain',data.id);e.dataTransfer.effectAllowed='move';});card.addEventListener('dragend',()=>{dragged=null});
card.addEventListener('dragover',e=>{e.preventDefault();});card.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();const rect=card.getBoundingClientRect(),x=p.x+Math.min(p.w-1,Math.max(0,Math.floor((e.clientX-rect.left)/rect.width*p.w))),y=p.y+Math.min(p.h-1,Math.max(0,Math.floor((e.clientY-rect.top)/rect.height*p.h)));acceptDrop(zone,x,y)});
host.append(card)}
let occupied=0,earnings=0,count=0;for(const p of state.placements.filter(p=>p.zone===zone)){occupied+=p.w*p.h;earnings+=value(byId.get(p.itemId));count++}
$(zone+'Filled').textContent=occupied+' / '+g.cols*g.rows;$(zone+'Value').textContent=fmt(earnings);$(zone+'Space').textContent=(g.cols*g.rows-occupied)+' empty cells';
$(zone+'Name').textContent=g.name;$(zone+'Dims').textContent=g.cols+' × '+g.rows+' grid';}
function renderSling(){const exists=currentGear('bag').sling,section=$('slingContainer'),slot=$('slingSlot');section.hidden=!exists;if(!exists)return;
const occupied=state.placements.find(p=>p.zone==='sling');const item=occupied?byId.get(occupied.itemId):null;
slot.textContent=item?item.name+' · '+fmt(value(item)):'EMPTY WEAPON SLOT';slot.classList.toggle('occupied',!!item);
slot.onclick=()=>{if(item){choose(item.id,occupied.uid);info('Weapon sling selected. Use REMOVE or click an empty space to move it.')}else{const i=selected();if(!i)return info('Select a weapon from FOUND LOOT.');attemptPlace('sling',0,0)}};
slot.ondragover=e=>{e.preventDefault()};slot.ondrop=e=>{e.preventDefault();acceptDrop('sling',0,0)};}
function renderStats(){let total=0,cells=0,count=0;for(const p of state.placements){const i=byId.get(p.itemId);if(!i)continue;count++;total+=value(i);if(p.zone!=='sling')cells+=p.w*p.h}
$('haulValue').textContent=fmt(total);$('raidScore').textContent=fmt(cells?total/cells:0);$('itemCount').textContent=String(count);}
function renderSelected(){const item=selected(),placement=state.placements.find(p=>p.uid===selectedUid);$('selectedName').textContent=item?.name||'Choose an item';
$('selectedValue').textContent=item?fmt(value(item)):'—';$('selectedShape').textContent=item?oriented(item,rotated).w+'×'+oriented(item,rotated).h:'—';$('selectedDensity').textContent=item?fmt(value(item)/(sizes(item).w*sizes(item).h)):'—';
const warning=$('shapeWarning');warning.hidden=!!(!item||item.known||state.dims[item.id]);warning.textContent=warning.hidden?'':'No confirmed item dimensions. Using a provisional '+sizes(item).w+'×'+sizes(item).h+' shape; use EDIT to set the real size.';
const rec=item?recommendation(item,selectedUid):null;const advice=$('adviceLabel'),body=$('adviceText'),gain=$('adviceGain'),wrapper=advice.parentNode;
wrapper.classList.remove('swap','leave');
if(!item){advice.textContent='READY';body.textContent='Choose an item to see if it physically fits.';gain.textContent='';}
else if(placement){advice.textContent='PACKED';body.textContent='Already in '+(placement.zone==='sling'?'weapon sling':placement.zone)+'. Click a free cell to move it.';gain.textContent=fmt(value(item))+' carried';}
else if(rec){advice.textContent=rec.status;body.textContent=rec.zone==='sling'?'Fits in the dedicated weapon sling.':rec.status==='SWAP'?'Replace '+rec.swap.length+' item(s), giving up '+fmt(rec.lost)+'.':'Fits in the '+rec.zone+' at '+(rec.x+1)+','+(rec.y+1)+'.';
gain.textContent=rec.status==='SWAP'?'+'+fmt(rec.gain)+' extra value':fmt(value(item))+' added';if(rec.status==='SWAP')wrapper.classList.add('swap');}
else{advice.textContent='LEAVE';body.textContent='No room or profitable swap at the current sale value. You can still replace loot manually.';gain.textContent='';wrapper.classList.add('leave')}
$('autoPack').disabled=!item||!!placement||!rec;$('rotateItem').disabled=!item||!!placement&&placement.zone==='sling';$('removeItem').disabled=!placement;$('editItem').disabled=!item;}
function renderAll(){lootList();renderZone('bag');renderZone('carrier');renderSling();renderSelected();renderStats();}
function attemptPlace(zone,x,y){const item=selected();if(!item)return info('Choose an item first.');
const p=state.placements.find(p=>p.uid===selectedUid);const location=candidate(item,zone,x,y,rotated,selectedUid);if(!location){info(zone==='sling'?'Weapon sling accepts weapons only.':'That shape does not fit at this position. Try rotating the item.');return}
if(location.swap.length){const lost=location.lost;if(!confirm('Replace '+location.swap.length+' item(s) worth '+fmt(lost)+' with '+item.name+' worth '+fmt(value(item))+'?'))return;}
checkpoint();
state.placements=state.placements.filter(q=>q.uid!==selectedUid&&!location.swap.some(s=>s.uid===q.uid));
const newP={uid:selectedUid||uid(),itemId:item.id,zone:location.zone,x:location.x,y:location.y,w:location.w,h:location.h,turn:location.turn};
state.placements.push(newP);selectedUid=null;rotated=false;save();info((p?'Moved ':'Packed ')+item.name+' into '+(zone==='sling'?'weapon sling':zone)+'.');renderAll();}
function clickPlace(zone,x,y){attemptPlace(zone,x,y)}
function acceptDrop(zone,x,y){if(!dragged)return;selectedId=dragged.id;selectedUid=dragged.uid;const p=state.placements.find(x=>x.uid===selectedUid);rotated=!!p?.turn;attemptPlace(zone,x,y);dragged=null;}
function autoPack(){const item=selected();if(!item)return;const plan=recommendation(item,selectedUid);if(!plan)return info('No free space or profitable swap found.');rotated=plan.turn;attemptPlace(plan.zone,plan.x,plan.y)}
function changeEquipment(zone,id){const before=state.gear[zone];if(before===id)return;const next=gear.find(x=>x.id===id);if(!next)return;
const originals=state.placements.filter(p=>p.zone===zone);
const sling=zone==='bag'?state.placements.find(p=>p.zone==='sling'):null;
if(sling&&!next.sling){info('Remove the weapon from the sling before switching to this backpack.');$(zone+'Gear').value=before;return}
const kept=state.placements.filter(p=>p.zone!==zone);const reordered=originals.slice().sort((a,b)=>b.w*b.h-a.w*a.h);
let placed=[];
for(const item of reordered){let found=false;for(let y=0;y<=next.rows-item.h&&!found;y++)for(let x=0;x<=next.cols-item.w&&!found;x++){if(!colliding(zone,x,y,item.w,item.h,null,kept.concat(placed)).length){placed.push({...item,x,y});found=true;}}if(!found){$(zone+'Gear').value=before;info('Cannot fit your existing loot into '+next.name+'. Remove items first.');return;}}
checkpoint();state.gear[zone]=id;state.placements=kept.concat(placed);save();setGearWarn();renderAll();info('Equipped '+next.name+' ('+next.cols+'×'+next.rows+').')}
function rotate(){if(!selected())return;const placed=state.placements.find(x=>x.uid===selectedUid);if(placed){if(placed.zone==='sling')return;const d=oriented(selected(),!placed.turn);if(!inBounds(placed.zone,placed.x,placed.y,d.w,d.h)||colliding(placed.zone,placed.x,placed.y,d.w,d.h,placed.uid).length)return info('Cannot rotate here: not enough continuous space.');checkpoint();placed.turn=!placed.turn;placed.w=d.w;placed.h=d.h;rotated=placed.turn;save()}else rotated=!rotated;renderAll();}
function remove(){if(!selectedUid)return;const found=state.placements.find(x=>x.uid===selectedUid);if(!found)return;checkpoint();state.placements=state.placements.filter(x=>x.uid!==selectedUid);selectedUid=null;save();renderAll();info('Removed item from inventory.')}
function changeValue(){const item=selected();if(!item)return;const before=value(item),raw=prompt('Vendor sale price for '+item.name+' ($):',String(before));if(raw===null)return;if(!/^\d+(\.\d{1,2})?$/.test(raw.trim()))return alert('Enter a valid positive price or zero.');
const dim=sizes(item);const width=prompt('Item WIDTH in inventory cells:',String(dim.w));if(width===null)return;const height=prompt('Item HEIGHT in inventory cells:',String(dim.h));if(height===null)return;const w=Number(width),h=Number(height);if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>15||h>15)return alert('Enter whole-number dimensions from 1 to 15.');
const used=state.placements.filter(x=>x.itemId===item.id);if(used.length&&(dim.w!==w||dim.h!==h))return alert('Remove this item from the grid before changing its shape.');
checkpoint();state.prices[item.id]=Number(raw);state.dims[item.id]={w,h};save();renderAll();info('Saved personal price and dimensions for '+item.name+'.')}
async function loadData(){try{const [gearResponse,catalogResponse,patchResponse]=await Promise.all([fetch('data/carry-gear.json',{cache:'no-store'}),fetch('data/catalog.json',{cache:'no-store'}),fetch('data/admin-overrides.json',{cache:'no-store'})]);
if(!gearResponse.ok)throw Error('Equipment data unavailable');const equipment=await gearResponse.json();gear=Array.isArray(equipment.items)?equipment.items:[];
const catalogue=catalogResponse.ok?await catalogResponse.json():[],patch=patchResponse.ok?await patchResponse.json():{};const unique=new Map();
for(const x of (Array.isArray(catalogue)?catalogue:[])){const item=parseItem(x);if(!unique.has(item.id)||(!unique.get(item.id).price&&item.price))unique.set(item.id,item)}
const trashed=new Set(Array.isArray(patch.trashed)?patch.trashed:[]);items=[...unique.values()].filter(x=>!trashed.has(x.id));
for(const item of items){const change=patch.items?.[item.id];if(!change)continue;if(typeof change.name==='string'&&change.name.trim())item.name=change.name;
if(typeof change.category==='string')item.category=change.category;if(Object.prototype.hasOwnProperty.call(change,'sell_price'))item.price=number(change.sell_price);
if(Object.prototype.hasOwnProperty.call(change,'slots')&&(!item.known))item.h=Math.min(15,Math.max(1,number(change.slots)));if(typeof change.image==='string')item.image=change.image;item.source='ADMIN EDIT'}
for(const r of Array.isArray(patch.added)?patch.added:[]){if(!r?.name||trashed.has((r.dataset||'custom')+':'+r.id))continue;const i=parseItem({dataset:r.dataset||'custom',raw:r});if(r.slots&&!i.known)i.h=Math.min(15,Math.max(1,number(r.slots)));items.push(i)}
const old=localStorage.getItem(LEGACY);if(!localStorage.getItem(STORE)&&old){try{const previous=JSON.parse(old);state.manual=(Array.isArray(previous.custom)?previous.custom:[]).map(i=>({id:i.id,name:i.name,price:number(i.price),category:i.category||'MY ITEMS',dataset:i.category||'personal',image:i.image||'',w:1,h:Math.max(1,Math.min(15,number(i.slots)||1)),known:false}));
state.prices={...previous.prices};refreshRecordMap();let migrated=0,unpacked=0;for(const zone of ['bag','carrier'])for(const [itemId,quantity]of Object.entries(previous[zone]||{})){const item=byId.get(itemId);if(!item)continue;for(let k=0;k<Math.min(100,quantity);k++){const plan=placementsFor(item).find(p=>p.zone===zone&&!p.swap.length);if(!plan){unpacked++;continue}state.placements.push({uid:uid(),itemId,zone,x:plan.x,y:plan.y,w:plan.w,h:plan.h,turn:plan.turn});migrated++}}
info('Imported '+migrated+' older inventory items.'+(unpacked?' '+unpacked+' could not fit; your old Money backup remains intact.':''));}catch(e){console.warn('Legacy migration not available',e)}}
refreshRecordMap();$('catalogStatus').textContent=items.length+' catalogue items';gearLoaded=true;catalogLoaded=true;
}catch(e){console.warn(e);gear=[{id:'bag-7',name:'4×4 backpack (offline)',kind:'bag',cols:4,rows:4,sling:false},{id:'carrier-12',name:'3×3 carrier (offline)',kind:'carrier',cols:3,rows:3,sling:false}];catalogLoaded=true;$('catalogStatus').textContent='Catalogue unavailable — manual items work';info('Could not load live data. Add your own items and try refreshing later.')}
refreshRecordMap();for(const zone of ['bag','carrier'])if(!gear.some(g=>g.id===state.gear[zone]))state.gear[zone]=gear.find(g=>g.kind===zone)?.id||state.gear[zone];renderGearSelectors();renderAll();save();}
$('searchItems').addEventListener('input',()=>{limit=65;lootList()});$('weaponsOnly').addEventListener('change',()=>{if($('weaponsOnly').checked)$('showUnpriced').checked=true;lootList()});$('showUnpriced').addEventListener('change',lootList);$('sortItems').addEventListener('change',lootList);
$('loadMore').addEventListener('click',()=>{limit+=65;lootList()});
for(const zone of ['bag','carrier']){$(zone+'Gear').addEventListener('change',e=>changeEquipment(zone,e.target.value));$('clear'+zone[0].toUpperCase()+zone.slice(1)).addEventListener('click',()=>{const removals=state.placements.filter(p=>p.zone===zone);if(!removals.length)return;if(!confirm('Remove all '+removals.length+' items from '+zone+'?'))return;checkpoint();state.placements=state.placements.filter(p=>p.zone!==zone);save();renderAll()});}
$('autoPack').addEventListener('click',autoPack);$('rotateItem').addEventListener('click',rotate);$('removeItem').addEventListener('click',remove);$('editItem').addEventListener('click',changeValue);
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;if(e.key.toLowerCase()==='r'&&selected()){e.preventDefault();rotate();}});
$('manualItem').addEventListener('submit',e=>{e.preventDefault();const name=$('manualName').value.trim(),price=Number($('manualPrice').value),w=Number($('manualWidth').value),h=Number($('manualHeight').value);if(!name||!Number.isFinite(price)||price<0||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>15||h>15)return;
checkpoint();const item={id:'manual:'+uid(),name,price,category:'MY ITEMS',dataset:'personal',w,h,known:true,image:'',source:'PERSONAL'};state.manual.push(item);save();refreshRecordMap();e.target.reset();$('manualWidth').value=1;$('manualHeight').value=1;choose(item.id);info('Added '+item.name+' to your personal loot list.');});
$('undo').addEventListener('click',()=>{const old=history.pop();if(!old)return info('Nothing to undo.');state=JSON.parse(old);refreshRecordMap();renderGearSelectors();renderAll();save();info('Undid previous action.')});
$('resetRaid').addEventListener('click',()=>{if(!state.placements.length)return;if(!confirm('Clear all items from this raid? Your personal prices and items will remain.'))return;checkpoint();state.placements=[];selectedUid=null;save();renderAll();info('Raid inventory cleared.')});
$('saveBackup').addEventListener('click',()=>{const data={exportedAt:new Date().toISOString(),source:'Gray Area Raid Loot Planner',...state},blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=n('a');a.href=url;a.download='grayarea-raid-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
loadData();
})();