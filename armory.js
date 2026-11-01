(()=>{
'use strict';
const $=id=>document.getElementById(id);
const BUILD_KEY='grayarea-armory-builds-v1',PRICE_KEY='grayarea-armory-prices-v1',MONEY_KEY='grayarea-money-tool-v3';
let references=[],weapons=[],items=[],parts=[],selected=null,attached=[],personalPrices={},saved=[],patchVersion='',moneyState={};
try{personalPrices=JSON.parse(localStorage.getItem(PRICE_KEY)||'{}')||{}}catch(e){}
try{saved=JSON.parse(localStorage.getItem(BUILD_KEY)||'[]');if(!Array.isArray(saved))saved=[]}catch(e){}
try{moneyState=JSON.parse(localStorage.getItem(MONEY_KEY)||'{}')||{}}catch(e){}
const node=(tag,content,cls)=>{const e=document.createElement(tag);if(content!==undefined)e.textContent=content;if(cls)e.className=cls;return e};
const num=v=>{const n=Number(String(v??0).replace(/[$,\s]/g,''));return Number.isFinite(n)?Math.max(0,n):0};
const dollars=v=>'$'+Math.round(num(v)).toLocaleString('en-US');
const norm=s=>String(s??'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
function persist(){try{localStorage.setItem(PRICE_KEY,JSON.stringify(personalPrices));localStorage.setItem(BUILD_KEY,JSON.stringify(saved));}catch(e){console.warn('Browser saving unavailable',e)}}
const price=i=>Object.prototype.hasOwnProperty.call(personalPrices,i.id)?num(personalPrices[i.id]):Object.prototype.hasOwnProperty.call(moneyState.prices||{},i.id)?num(moneyState.prices[i.id]):num(i.value);
function classify(i){const key=(i.dataset+' '+i.category+' '+i.name).toLowerCase();
if(/scope|optic|collimator|sight|magnifier|reflex/.test(key))return 'Optics';
if(/muzzle|suppressor|silencer|flash hider|brake|compensator/.test(key))return 'Muzzles';
if(/handguard|rail|mount|upper receiver|dust cover/.test(key))return 'Handguards';
if(/barrel|gas block/.test(key))return 'Barrels';
if(/stock|grip|buffer tube|buttpad|handstop/.test(key))return 'Stocks / grips';
if(/magazine|\bmag\b/.test(key))return 'Magazines';
if(/tactical|laser|weapon light|flashlight/.test(key))return 'Tactical devices';
return 'Other parts';}
function looksLikeWeapon(i){return /^(weapons|weapon|rifles|pistols|shotguns|smgs|firearms)$/.test(i.dataset.toLowerCase())||/^(rifle|assault rifle|pistol|smg|shotgun|carbine|dmr|sniper rifle|weapon)$/.test(i.category.toLowerCase());}
function looksLikePart(i){if(looksLikeWeapon(i))return false;return /barrel|stock|optic|scope|suppressor|muzzle|magazine|handguard|rail|collimator|pistol_grip|weapon_part|tactical_device|charging_handle|foregrip|laser|weapon_attachment|grip|receiver|mount|magazine/.test((i.dataset+' '+i.category).toLowerCase())||/suppressor|handguard|foregrip|pistol grip|picatinny|flash hider|gas block|weapon light|charging handle|buffer tube|optical sight/.test(i.name.toLowerCase());}
function itemRecord(entry){const raw=entry.raw||entry;const dataset=String(entry.dataset||raw.dataset||raw.category||'items'),name=String(raw.name||raw.title||raw.item_name||raw.id||'Unknown');
const grid=String(raw.grid_size||raw.gridSize||'').match(/(\d+)\s*[x×]\s*(\d+)/i),slots=grid?Number(grid[1])*Number(grid[2]):(num(raw.width||raw.size_x||0)*num(raw.height||raw.size_y||0));
return{id:dataset+':'+String(raw.id||name),name,dataset,category:String(raw.category||raw.type||dataset),image:raw.image||raw.image_url||raw.imageUrl||raw.icon||'',value:num(raw.sell_price??raw.sellPrice??raw.grayarea_price??0),slots:slots||null,raw};}
function applyPublished(list,patch){const hidden=new Set(Array.isArray(patch.trashed)?patch.trashed:[]);let output=list.filter(x=>!hidden.has(x.id));const changes=patch.items&&typeof patch.items==='object'?patch.items:{};
for(const i of output){const p=changes[i.id];if(!p)continue;if(typeof p.name==='string')i.name=p.name;if(typeof p.category==='string')i.category=p.category;if(typeof p.image==='string')i.image=p.image;
if(Object.prototype.hasOwnProperty.call(p,'sell_price'))i.value=num(p.sell_price);
if(Object.prototype.hasOwnProperty.call(p,'slots'))i.slots=Math.max(1,Math.floor(num(p.slots)));i.published=true;}
for(const add of Array.isArray(patch.added)?patch.added:[]){if(!add||!add.name||hidden.has((add.dataset||'custom')+':'+add.id))continue;const r=itemRecord({dataset:add.dataset||'custom',raw:add});r.slots=Math.max(1,Math.floor(num(add.slots)||1));r.published=true;output.push(r);}
return output;}
function stat(raw,keys){if(!raw)return null;const match=s=>String(s).toLowerCase().replace(/[^a-z0-9]/g,'');const wanted=new Set(keys.map(match));for(const [k,v]of Object.entries(raw)){if(!wanted.has(match(k)))continue;
if(v===null||v===undefined||v===''||typeof v==='object')continue;const txt=String(v).trim();if(!txt||txt==='—'||txt==='N/A'||txt==='None')continue;return txt.slice(0,55)}
if(raw.numeric_values&&typeof raw.numeric_values==='object')for(const [k,v]of Object.entries(raw.numeric_values)){if(wanted.has(match(k))&&v&&typeof v.value!=='undefined')return String(v.value)+(v.unit?' '+v.unit:'');}return null;}
const stats=[
['FIRE RATE',['fire_rate','fire rate','rate of fire','rpm','rate_of_fire','rof']],
['ACCURACY',['accuracy','accuracy_moa','moa','accuracy (moa)']],
['RECOIL',['recoil','recoil_control','recoil control','recoil reduction']],
['ERGONOMICS',['ergonomics','ergo','ergonomic']],
['HANDLING',['weapon_handling','weapon handling','handling']],
['WEIGHT',['weight','weight_kg','mass']],
['MUZZLE VELOCITY',['muzzle_velocity','muzzle velocity','velocity']],
['RELOAD SPEED',['reload_speed','reload speed','reload_time']],
['MAGAZINE',['capacity','magazine capacity','magazine_capacity','mag capacity']],
['FIRE MODES',['fire_modes','fire modes','firing_modes','firing mode']],
['DURABILITY',['durability','condition']],
['MANUFACTURER',['manufacturer','brand']],
['VENDOR',['sold_by','vendor','trader']],
['BUY PRICE',['buy_price','purchase_price','buy price']]
];
const ammoInfo={
'556x45':['5.56 SP / HPBT','M855','M855A1 / M995'],
'545x39':['5.45 SP','7N10 PP','BP / BS'],
'762x39':['7.62 SP / HP','7.62 PS','7.62 BP'],
'762x51':['7.62 SP','M80','M61'],
'762x54r':['7N1 (verify)','7N1','Higher penetration round — verify'],
'9x19':['9mm HP','9mm FMJ','AP — verify availability'],
'45acp':['.45 HP','.45 FMJ','AP — not confirmed'],
'12gauge':['00 Buckshot','Slug','Armor-piercing load — not confirmed'],
'300aacblackout':['.300 BLK SP','.300 BLK CQ','.300 BLK AP — verify'],
'46x30':['FMJ / standard (verify)','AP (verify)','High-pen load (verify)']
};
function showWeapons(){const q=$('weaponSearch').value.trim().toLowerCase(),cls=$('classFilter').value,caliber=$('caliberFilter').value;
const filtered=weapons.filter(w=>(!q||(w.name+' '+w.caliber+' '+w.category).toLowerCase().includes(q))&&(!cls||w.category===cls)&&(!caliber||w.caliber===caliber));
$('visibleCount').textContent=String(filtered.length);const root=$('weaponList');root.replaceChildren();
for(const w of filtered){const b=node('button');b.type='button';if(selected===w)b.classList.add('selected');const left=node('div');left.append(node('b',w.name),node('small',w.caliber||'Calibre unknown'));b.append(left,node('span',w.historicalRank?'OLD R'+w.historicalRank:'0.5','intel-rank'));b.addEventListener('click',()=>choose(w));root.append(b);}
if(!filtered.length)root.append(node('p','No matching weapons.','intel-empty'));}
function showStats(){const root=$('statGrid');root.replaceChildren();let count=0;for(const [label,keys] of stats){const value=stat(selected?.catalog?.raw,keys);if(!value)continue;const div=node('div',undefined,'intel-stat');div.append(node('small',label),node('strong',value));root.append(div);count++;}
$('statsBadge').textContent=count?count+' CATALOGUE FIELDS':'NO VERIFIED STAT FIELDS';
if(!count)root.append(node('div','The current catalogue has no measured stats for this exact weapon variant.','intel-empty'));}
function showAmmo(){const root=$('ammoPanel');root.replaceChildren();const values=ammoInfo[norm(selected?.caliber)]||null;
if(!values){root.append(node('div','No ammunition recommendations verified for this calibre.','intel-empty'));return;}
for(const [n,label] of ['UNARMOURED','MIXED ARMOUR','HEAVY ARMOUR'].entries()){const card=node('div');card.append(node('small',label),node('b',values[n]));root.append(card);}}
function choose(w){selected=w;attached=[];$('wholePrice').value='';$('assembledSlots').value=String(w.catalog?.slots||1);showWeapons();render();}
function render(){if(!selected)return;
$('weaponName').textContent=selected.name;$('weaponClass').textContent=selected.category.toUpperCase();$('weaponCaliber').textContent=selected.caliber||'Calibre not confirmed';
$('weaponRank').textContent=selected.historicalRank?'R'+selected.historicalRank+' (OLD)':'—';
const hasQuote=!!selected.catalog;const p=hasQuote?price(selected.catalog):0;
$('weaponPrice').textContent=p?dollars(p):'—';$('weaponSlots').textContent=selected.catalog?.slots?String(selected.catalog.slots):'—';
$('weaponFootnote').textContent=(selected.historicalRank?'Rank from older indexed GZW Loadout list; 0.5 may differ. ':'')+(hasQuote?(selected.catalog.published?'Price from Gray Area Admin.':'Price from community catalogue; 0.5 unverified.'):'No exact matching weapon-price record yet.');
const img=$('weaponImage'),alt=$('weaponPlaceholder');if(selected.catalog?.image){img.src=selected.catalog.image;img.alt=selected.name;img.hidden=false;alt.hidden=true;img.onerror=()=>{img.hidden=true;alt.hidden=false;alt.textContent='NO IMAGE';};}else{img.hidden=true;alt.hidden=false;alt.textContent='NO IMAGE';}
showStats();showAmmo();partsList();selectedList();total();showWeapons();}
function partClass(i){return classify(i)}
function partsList(){const root=$('partResults');root.replaceChildren();const q=$('partSearch').value.trim().toLowerCase(),cls=$('slotFilter').value;
const visible=parts.filter(x=>(!q||(x.name+' '+x.category).toLowerCase().includes(q))&&(!cls||partClass(x)===cls)&&!attached.includes(x.id));
for(const p of visible.slice(0,90)){const button=node('button');button.type='button';button.append(node('span',p.name),node('b',price(p)?dollars(price(p)):'PRICE ?'));button.addEventListener('click',()=>{attached.push(p.id);selectedList();partsList();total()});root.append(button);}
if(!visible.length)root.append(node('p','No matching parts.','intel-empty'));
$('partCount').textContent=parts.length+' in catalogue';}
function selectedList(){const root=$('selectedParts');root.replaceChildren();let count=0;
for(const id of attached){const p=parts.find(x=>x.id===id);if(!p)continue;count++;const row=node('div'),info=node('div');info.append(node('b',p.name),node('small',partClass(p)));
const amount=node('span',price(p)?dollars(price(p)):'PRICE ?');const controls=node('div'),edit=node('button','SET $'),remove=node('button','×');
edit.type='button';edit.title='Set this item’s personal sale price';edit.addEventListener('click',()=>editPrice(p));
remove.type='button';remove.title='Remove this part';remove.addEventListener('click',()=>{attached=attached.filter(x=>x!==id);selectedList();partsList();total()});controls.append(edit,remove);row.append(info,amount,controls);root.append(row);}
$('selectedPartsCount').textContent=String(count);if(!count)root.append(node('div','No parts selected.','intel-empty'));}
function valueSummary(){const base=selected?.catalog;const selectedItems=[...(base?[base]:[]),...attached.map(id=>parts.find(x=>x.id===id)).filter(Boolean)];const estimated=selectedItems.reduce((a,b)=>a+price(b),0),missing=selectedItems.filter(x=>!price(x)).length;return{estimated,missing,hasBase:!!base};}
function total(){if(!selected)return;const v=valueSummary(),quote=$('wholePrice').value,number=quote===''?null:num(quote);
$('estimatedValue').textContent=v.estimated?dollars(v.estimated):'—';$('estimateStatus').textContent=v.missing+' missing prices'+(!v.hasBase?' · base gun not in catalogue':'');
if(number===null){$('compareValue').textContent='—';$('compareDetail').textContent='Enter a whole-weapon quote to compare.';}
else{$('compareValue').textContent=v.missing?'PARTIAL ESTIMATE':v.estimated>number?'PARTS':v.estimated<number?'WHOLE GUN':'EQUAL';
$('compareDetail').textContent=dollars(v.estimated)+' parts & base vs '+dollars(number)+' whole';}}
function editPrice(item){if(!item)return alert('No matching catalogue record for this weapon. Set an actual whole-gun sale quote below.');const answer=prompt('Your observed sell price for '+item.name+' ($)',String(price(item)||''));if(answer===null)return;if(!/^\d+(?:\.\d{1,2})?$/.test(answer.trim()))return alert('Enter a valid price.');personalPrices[item.id]=Number(answer);persist();render();}
function makeBuild(){if(!selected)return null;const v=valueSummary(),whole=$('wholePrice').value;return{weaponId:selected.catalog?.id||('reference:'+selected.name),weaponName:selected.name,partIds:[...attached],slots:Math.max(1,Math.floor(Number($('assembledSlots').value)||1)),wholePrice:whole===''?null:Number(whole),partsTotal:v.estimated,priceMissing:v.missing,savedAt:new Date().toISOString()};}
function savedList(){const root=$('savedBuilds');root.replaceChildren();for(const s of saved.slice(0,25)){const b=node('button',s.weaponName+' · '+dollars(s.wholePrice??s.partsTotal));b.type='button';b.addEventListener('click',()=>{const w=weapons.find(w=>w.name===s.weaponName||w.catalog?.id===s.weaponId);if(!w)return alert('This weapon is not currently available.');selected=w;attached=(s.partIds||[]).filter(id=>parts.some(p=>p.id===id));$('assembledSlots').value=String(s.slots||1);$('wholePrice').value=s.wholePrice===null?'':String(s.wholePrice);render()});root.append(b);}
if(!saved.length)root.append(node('span','No saved builds yet.','intel-empty'));}
function toMoney(dest){const build=makeBuild();if(!build)return alert('Select a weapon first.');const v=valueSummary();
if(build.wholePrice===null&&v.missing&&!confirm('Some component or base prices are missing. Continue with a partial estimate?'))return;
const estimated=build.wholePrice===null?v.estimated:build.wholePrice;
let state={};try{state=JSON.parse(localStorage.getItem(MONEY_KEY)||'{}')||{}}catch(e){}
state.custom=Array.isArray(state.custom)?state.custom:[];for(const p of ['bag','carrier'])if(!state[p]||typeof state[p]!=='object')state[p]={};
const id='armory:'+Date.now()+':'+Math.random().toString(36).slice(2,8);
state.custom.push({id,name:build.weaponName+(build.partIds.length?' + '+build.partIds.length+' parts':''),price:estimated,slots:build.slots,category:'MY WEAPONS',image:selected.catalog?.image||'',source:'ARMORY'});state[dest][id]=(state[dest][id]||0)+1;
try{localStorage.setItem(MONEY_KEY,JSON.stringify(state));$('actionStatus').textContent='Added '+build.weaponName+' to '+(dest==='bag'?'Backpack':'Carrier')+'.';}catch(e){alert('Cannot save Money inventory in this browser.');}}
async function readJSON(path,fallback){try{const response=await fetch(path,{cache:'no-store'});return response.ok?await response.json():fallback}catch(e){return fallback}}
async function load(){const [refs,cat,published]=await Promise.all([readJSON('data/weapon-reference.json',{weapons:[]}),readJSON('data/catalog.json',[]),readJSON('data/admin-overrides.json',{})]);
references=Array.isArray(refs.weapons)?refs.weapons:[];const raw=Array.isArray(cat)?cat:[];const map=new Map();
for(const entry of raw){const i=itemRecord(entry);if(!map.has(i.id)||(!map.get(i.id).value&&i.value))map.set(i.id,i);}
items=applyPublished([...map.values()],published);
const possible=items.filter(looksLikeWeapon);
const matched=new Set();
weapons=references.filter(x=>!Array.isArray(published.trashed)||!published.trashed.includes('weapons:'+x.name)).map(ref=>{const exact=possible.find(i=>norm(i.name)===norm(ref.name));if(exact)matched.add(exact.id);return{...ref,catalog:exact||null}});
for(const extra of possible){if(matched.has(extra.id)||weapons.some(w=>norm(w.name)===norm(extra.name)))continue;weapons.push({name:extra.name,category:extra.category||'Weapon',caliber:stat(extra.raw,['caliber','calibre','ammo type'])||'',historicalRank:null,source:'Community item catalogue',catalog:extra})}
weapons.sort((a,b)=>a.category.localeCompare(b.category)||a.name.localeCompare(b.name));
parts=items.filter(looksLikePart).sort((a,b)=>a.name.localeCompare(b.name));$('weaponTotal').textContent=String(weapons.length);
$('dataStatus').textContent=references.length+' public weapon records + '+Math.max(0,weapons.length-references.length)+' catalogue additions · '+parts.length+' part entries';
for(const field of [['classFilter',[...new Set(weapons.map(w=>w.category))]],['caliberFilter',[...new Set(weapons.map(w=>w.caliber).filter(Boolean))]]]){const control=$(field[0]);for(const item of field[1].sort()){const option=node('option',item);option.value=item;control.append(option);}}
showWeapons();const first=weapons.find(x=>norm(x.name)==='m4a1')||weapons[0];if(first)choose(first);savedList();}
for(const id of ['weaponSearch','classFilter','caliberFilter'])$(id).addEventListener(id==='weaponSearch'?'input':'change',showWeapons);
for(const id of ['partSearch','slotFilter'])$(id).addEventListener(id==='partSearch'?'input':'change',partsList);
$('wholePrice').addEventListener('input',total);
$('editPrice').addEventListener('click',()=>editPrice(selected?.catalog));
$('saveBuild').addEventListener('click',()=>{const b=makeBuild();if(!b)return;saved.unshift(b);saved=saved.slice(0,30);persist();savedList();$('actionStatus').textContent='Build saved on this browser.';});
$('exportBuild').addEventListener('click',()=>{const b=makeBuild();if(!b)return;const blob=new Blob([JSON.stringify(b,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='grayarea-'+b.weaponName.replace(/[^a-z0-9]+/gi,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('addBackpack').addEventListener('click',()=>toMoney('bag'));$('addCarrier').addEventListener('click',()=>toMoney('carrier'));
load();
})();