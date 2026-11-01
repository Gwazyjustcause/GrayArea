(()=>{'use strict';
const $=id=>document.getElementById(id);
const SAVE='grayarea-armory-builds-v1',VALUE='grayarea-armory-prices-v1',MONEY='grayarea-money-tool-v3';
let weapons=[],parts=[],selected=null,attached=[],localPrices={},saved=[],displayLimit=100;
try{localPrices=JSON.parse(localStorage.getItem(VALUE)||'{}')||{}}catch(e){}
try{saved=JSON.parse(localStorage.getItem(SAVE)||'[]');if(!Array.isArray(saved))saved=[]}catch(e){}
const el=(tag,txt,cls)=>{const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(cls)e.className=cls;return e};
const number=v=>{const n=Number(String(v??0).replace(/[$,\s]/g,''));return Number.isFinite(n)?Math.max(0,n):0};
const cash=n=>'$'+Math.round(n).toLocaleString('en-US');
const val=r=>Object.prototype.hasOwnProperty.call(localPrices,r.id)?number(localPrices[r.id]):number(r.value);
const saveLocals=()=>{try{localStorage.setItem(VALUE,JSON.stringify(localPrices));localStorage.setItem(SAVE,JSON.stringify(saved))}catch(e){console.warn(e)}};
const fallback=['M4A1','DDM4','M16A1','AKM','AK-74M','AK-12','AK-308','AKS-74U','G3','G36','FAMAS','Steyr AUG','AUG A3','UMP45','Benelli M4','Glock 18C','M14','SVD Dragunov','M700','MP5'].map(x=>({id:'weapons:'+x,name:x,dataset:'weapons',category:'weapons',slots:1,value:0,image:'',caliber:'',description:''}));
const PART_CLASSES=['Optics','Suppressors / muzzle','Handguards / rails','Barrels','Stocks / grips','Magazines','Tactical devices','Other parts'];
function classify(i){const key=(i.dataset+' '+i.category).toLowerCase(),name=i.name.toLowerCase();
if(/optic|scope|collimator|sight|magnifier/.test(key+' '+name))return 'Optics';
if(/suppressor|muzzle|compensator|silencer|flash hider|brake/.test(key+' '+name))return 'Suppressors / muzzle';
if(/handguard|rail|mount|receiver|dust cover|upper/.test(key+' '+name))return 'Handguards / rails';
if(/barrel|gas block/.test(key+' '+name))return 'Barrels';
if(/stock|pistol grip|foregrip|butt pad|buffer tube|handstop/.test(key+' '+name))return 'Stocks / grips';
if(/magazine|\bmag\b/.test(key+' '+name))return 'Magazines';
if(/tactical|laser|flashlight|weapon light|light switch/.test(key+' '+name))return 'Tactical devices';
return 'Other parts';}
function isWeapon(i){return /^(weapons|weapon|firearms|rifles|pistols|shotguns|smgs)$/i.test(i.dataset)||/^(rifle|assault rifle|pistol|smg|shotgun|carbine|dmr|sniper rifle)$/i.test(i.category);}
function isPart(i){if(isWeapon(i))return false;return /scope|collimator|suppressor|magazine|stock|barrel|handguard|muzzle|tactical|rail|mount|foregrip|pistol_grip|charging|receiver|optic|sight|weapon_part|weapon_attachment|parts|gas_block/i.test(i.dataset)||/suppressor|muzzle|scope|collimator|magazine|handguard|barrel|stock|foregrip|gas block|receiver|pistol grip|charging handle|optic|weapon light|rail mount|picatinny|buffer tube|flash hider/i.test(i.name);}
function parse(entry){const r=entry.raw||entry,dataset=String(entry.dataset||r.dataset||r.category||'items'),name=String(r.name||r.title||r.item_name||r.id||'Unnamed');
const size=String(r.grid_size||r.gridSize||'').match(/(\d+)\s*[x×]\s*(\d+)/i);
return{id:dataset+':'+String(r.id||name),name,dataset,category:String(r.category||r.type||dataset),value:number(r.sell_price??r.sellPrice??r.grayarea_price??0),slots:Math.max(1,size?Number(size[1])*Number(size[2]):(number(r.width||r.size_x||1)*number(r.height||r.size_y||1))),image:r.image||r.image_url||r.icon||'',caliber:String(r.caliber||r.calibre||''),description:String(r.description||'')};}
function listWeapons(){const q=$('weaponSearch').value.trim().toLowerCase(),visible=weapons.filter(x=>x.name.toLowerCase().includes(q)),root=$('weaponList');root.replaceChildren();$('weaponCount').textContent=String(visible.length);
for(const w of visible.slice(0,120)){const b=el('button');b.type='button';if(w.id===selected?.id)b.classList.add('selected');const image=w.image?el('img'):el('span','GA','arm-blank');if(w.image){image.src=w.image;image.loading='lazy';image.alt='';image.onerror=()=>image.replaceWith(el('span','GA','arm-blank'));}
const label=el('div');label.append(el('b',w.name),el('small',cash(val(w))+' · '+w.slots+' slots'));b.append(image,label);b.addEventListener('click',()=>pick(w));root.append(b)}}
function pick(w){selected=w;attached=[];$('wholePrice').value='';$('assembledSlots').value=String(w.slots||1);listWeapons();render();}
function listParts(){const root=$('partResults');root.replaceChildren();const q=$('partSearch').value.trim().toLowerCase(),klass=$('slotFilter').value;
if(!selected){root.append(el('p','Choose a weapon first.','arm-hint'));return;}
const shown=parts.filter(p=>!attached.includes(p.id)&&(!klass||classify(p)===klass)&&(!q||(p.name+' '+p.category).toLowerCase().includes(q)));
for(const part of shown.slice(0,displayLimit)){const btn=el('button');btn.type='button';const caption=el('span',part.name),value=el('b',val(part)?cash(val(part)):'PRICE ?');btn.append(caption,value);btn.addEventListener('click',()=>{attached.push(part.id);render()});root.append(btn)}
$('resultsNote').textContent=shown.length>displayLimit?('Showing first '+displayLimit+' of '+shown.length+' parts. Narrow your search.'):shown.length+' available matching parts. Compatibility is not validated.';}
function partById(id){return parts.find(p=>p.id===id)}
function calc(){if(!selected)return{sum:0,missing:0};const list=[selected,...attached.map(partById).filter(Boolean)];return{sum:list.reduce((a,b)=>a+val(b),0),missing:list.filter(x=>!val(x)).length};}
function editPrice(item){const answer=prompt('Current 0.5 sell value for '+item.name+' ($):',String(val(item)));if(answer===null)return;if(!/^\d+(?:\.\d{1,2})?$/.test(answer.trim())){alert('Enter a valid positive amount or 0.');return;}localPrices[item.id]=Number(answer);saveLocals();render();}
function render(){if(!selected){$('weaponName').textContent='No weapon selected';$('weaponInfo').textContent='Select a weapon to begin.';$('weaponImage').hidden=true;$('weaponFallback').hidden=false;listParts();return;}
$('weaponName').textContent=selected.name;$('weaponInfo').textContent=[selected.caliber,selected.category].filter(Boolean).join(' · ');$('basePrice').textContent=val(selected)?cash(val(selected)):'PRICE UNKNOWN';$('partsCount').textContent=String(attached.length);$('chosenCount').textContent=String(attached.length);$('weaponSlots').textContent=String(selected.slots||1);
const img=$('weaponImage');if(selected.image){img.src=selected.image;img.hidden=false;$('weaponFallback').hidden=true;img.onerror=()=>{img.hidden=true;$('weaponFallback').hidden=false}}else{img.hidden=true;$('weaponFallback').hidden=false;$('weaponFallback').textContent=selected.name.toUpperCase()}
const root=$('chosenParts');root.replaceChildren();for(const id of attached){const p=partById(id);if(!p)continue;const row=el('div',undefined,'arm-part-row'),info=el('div');info.append(el('b',p.name),el('small',classify(p)));const money=el('span',val(p)?cash(val(p)):'PRICE ?'),edit=el('button','EDIT $');edit.type='button';edit.addEventListener('click',()=>editPrice(p));const remove=el('button','×');remove.type='button';remove.title='Remove part';remove.addEventListener('click',()=>{attached=attached.filter(x=>x!==id);render()});row.append(info,money,edit,remove);row.style.gridTemplateColumns='1fr auto auto auto';root.append(row)}
if(!attached.length)root.append(el('p','No parts selected. Add them from the list above.','arm-hint'));
const c=calc();$('partsTotal').textContent=c.sum?cash(c.sum):'—';$('partsConfidence').textContent=c.missing?c.missing+' item(s) without a verified sale price — total is incomplete.':'All components have listed or entered prices.';
const whole=$('wholePrice').value.trim();if(whole!==''){const wholeValue=number(whole),diff=c.sum-wholeValue;$('bestResult').textContent=c.missing?'INCOMPLETE':diff>0?'SELL PARTS':diff<0?'SELL WHOLE':'SAME VALUE';$('bestDetail').textContent='Whole '+cash(wholeValue)+' vs parts '+cash(c.sum)+(c.missing?' (partial)':' · difference '+cash(Math.abs(diff)));}else{$('bestResult').textContent='—';$('bestDetail').textContent='Enter a whole-weapon sale price to compare.';}
listParts();listWeapons();}
function blueprint(){if(!selected)return null;const c=calc(),whole=$('wholePrice').value.trim();return{weaponId:selected.id,weaponName:selected.name,partIds:[...attached],basePrice:val(selected),parts:attached.map(id=>{const p=partById(id);return p?{name:p.name,price:val(p)}:null}).filter(Boolean),partsTotal:c.sum,priceMissing:c.missing,wholePrice:whole===''?null:number(whole),slots:Math.max(1,Number($('assembledSlots').value)||selected.slots),savedAt:new Date().toISOString()};}
function saves(){const root=$('savedList');root.replaceChildren();for(const build of saved){const b=el('button',build.weaponName+' · '+cash(build.wholePrice??build.partsTotal));b.type='button';b.addEventListener('click',()=>{const w=weapons.find(x=>x.id===build.weaponId)||weapons.find(x=>x.name===build.weaponName);if(!w){alert('This weapon is not in the current catalogue.');return;}selected=w;attached=(build.partIds||[]).filter(id=>parts.some(p=>p.id===id));$('assembledSlots').value=build.slots;$('wholePrice').value=build.wholePrice===null?'':build.wholePrice;render()});root.append(b)}}
function notify(s){$('armMessage').textContent=s;}
function toMoney(dest){const data=blueprint();if(!data)return alert('Select a weapon first.');if(data.priceMissing&&data.wholePrice===null&&!confirm('Some component prices are unknown, so the estimated sale value is incomplete. Continue?'))return;
const value=data.wholePrice===null?data.partsTotal:data.wholePrice;let state={};try{state=JSON.parse(localStorage.getItem(MONEY)||'{}')||{}}catch(e){}
state.custom=Array.isArray(state.custom)?state.custom:[];state.bag=state.bag&&typeof state.bag==='object'?state.bag:{};state.carrier=state.carrier&&typeof state.carrier==='object'?state.carrier:{};
const id='armory:'+Date.now()+':'+Math.random().toString(36).slice(2,8);state.custom.push({id,name:data.weaponName+(data.partIds.length?' + '+data.partIds.length+' parts':''),category:'MY WEAPONS',slots:data.slots,price:value,manual:true,image:selected.image||'',source:'ARMORY ESTIMATE'});
state[dest][id]=(state[dest][id]||0)+1;try{localStorage.setItem(MONEY,JSON.stringify(state));notify('Added '+data.weaponName+' to '+(dest==='bag'?'Backpack':'Carrier')+'. Open Money to see its value.');}catch(e){alert('Could not save to browser inventory.');}}
async function load(){try{const [raw,patch]=await Promise.all([fetch('data/catalog.json',{cache:'no-store'}).then(r=>r.ok?r.json():[]),fetch('data/admin-overrides.json',{cache:'no-store'}).then(r=>r.ok?r.json():{})]);const seen=new Map();for(const entry of Array.isArray(raw)?raw:[]){const item=parse(entry);if(!seen.has(item.id)||(!seen.get(item.id).value&&item.value))seen.set(item.id,item);}
const trashed=new Set(patch.trashed||[]);const entries=[...seen.values()].filter(x=>!trashed.has(x.id));for(const i of entries){const p=(patch.items||{})[i.id];if(!p)continue;if(typeof p.name==='string')i.name=p.name;if(typeof p.category==='string')i.category=p.category;if(Object.prototype.hasOwnProperty.call(p,'sell_price'))i.value=number(p.sell_price);if(Object.prototype.hasOwnProperty.call(p,'slots'))i.slots=Math.max(1,number(p.slots));if(typeof p.image==='string')i.image=p.image;}
for(const r of Array.isArray(patch.added)?patch.added:[]){if(!r?.name||trashed.has((r.dataset||'custom')+':'+r.id))continue;const item=parse({dataset:r.dataset||'custom',raw:r});item.slots=Math.max(1,number(r.slots));entries.push(item);}
weapons=entries.filter(isWeapon).sort((a,b)=>a.name.localeCompare(b.name));parts=entries.filter(isPart).sort((a,b)=>a.name.localeCompare(b.name));$('dataStatus').textContent=weapons.length+' weapons / '+parts.length+' parts in catalogue';
}catch(e){console.warn(e);$('dataStatus').textContent='Catalogue unavailable — fallback weapon list';weapons=fallback;parts=[]}
if(!weapons.length){weapons=fallback;$('dataStatus').textContent='Weapon data limited — fallback list loaded';}
listWeapons();saves();listParts();}
$('weaponSearch').addEventListener('input',listWeapons);$('partSearch').addEventListener('input',()=>{displayLimit=100;listParts()});$('slotFilter').addEventListener('change',()=>{displayLimit=100;listParts()});$('wholePrice').addEventListener('input',render);$('editBase').addEventListener('click',()=>selected&&editPrice(selected));
$('saveBuild').addEventListener('click',()=>{const b=blueprint();if(!b)return alert('Select a weapon first.');b.id='build:'+Date.now();saved.unshift(b);saved=saved.slice(0,30);saveLocals();saves();notify('Saved '+b.weaponName+' in this browser.');});
$('exportBuild').addEventListener('click',()=>{const b=blueprint();if(!b)return alert('Select a weapon first.');const blob=new Blob([JSON.stringify(b,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=el('a');link.href=url;link.download='grayarea-'+b.weaponName.replace(/[^a-z0-9-]/gi,'-')+'-build.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
$('addBackpack').addEventListener('click',()=>toMoney('bag'));$('addCarrier').addEventListener('click',()=>toMoney('carrier'));
load();
})();