import {mkdir,readFile,writeFile} from 'node:fs/promises';
const API='https://gzw-data.dev/api/v1';
const WIKI='https://gray-zone-warfare.fandom.com/api.php';
const excluded=new Set(['tasks','vendors','metadata','removed_content','upcoming_content','cleanup','contracts','loot_containers']);
const get=async url=>{const r=await fetch(url,{headers:{'user-agent':'GrayArea-sync/1.0'}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()};
const key=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const chunks=(values,size)=>Array.from({length:Math.ceil(values.length/size)},(_,i)=>values.slice(i*size,(i+1)*size));
await mkdir('data',{recursive:true});
let old=[];try{old=JSON.parse(await readFile('data/catalog.json','utf8'))}catch{}
const version=await get(`${API}/version`);
const names=(version.datasets||version.data?.datasets||[]).filter(n=>!n.startsWith('_')&&!excluded.has(n));
if(names.length<20)throw new Error(`Dataset discovery returned only ${names.length} categories`);
const imported=[];
for(const dataset of names){
  try{const payload=await get(`${API}/${dataset}?all=true`);for(const raw of payload.data||[])imported.push({dataset,raw});}
  catch(error){console.warn(`Skipped ${dataset}: ${error.message}`)}
}
// The wiki scraper sometimes emits a light image record and a separate detailed
// record with the same ID. Merge them instead of discarding either half.
const merged=new Map();
for(const entry of imported){
  const id=key(entry.raw.id||entry.raw.name);
  const recordKey=`${entry.dataset}:${id}`;
  const previous=merged.get(recordKey);
  if(previous)previous.raw={...previous.raw,...entry.raw,image:entry.raw.image||previous.raw.image};
  else merged.set(recordKey,{dataset:entry.dataset,raw:{...entry.raw}});
}
const datasetRecords=[...merged.values()];

// Remove calibre/family headings emitted by wiki tables. They are not inventory
// items and often carry the icon of one child variant (for example SP or AP).
const namesByDataset=new Map();
for(const entry of datasetRecords){const list=namesByDataset.get(entry.dataset)||[];list.push(key(entry.raw.name));namesByDataset.set(entry.dataset,list)}
const isFamilyHeading=entry=>{
  const raw=entry.raw,name=key(raw.name);
  const useful=Object.entries(raw).filter(([field,value])=>!['id','name','image','image_source'].includes(field)&&value!==null&&value!==''&&value!==undefined);
  return useful.length===0&&name&&(namesByDataset.get(entry.dataset)||[]).some(other=>other!==name&&other.startsWith(`${name} `));
};
const withoutFamilies=datasetRecords.filter(entry=>!isFamilyHeading(entry));
const removedFamilies=datasetRecords.length-withoutFamilies.length;

// Broad aggregate datasets repeat items already present in specific datasets.
// Keep one canonical exact-name record, favouring richer and more specific data.
const broad=new Set(['items','gear','provisions','weapon_parts','valuables','auxiliary']);
const quality=entry=>Object.values(entry.raw).filter(v=>v!==null&&v!==''&&v!==undefined).length+(entry.raw.sell_price?5:0)+(entry.raw.image?3:0)-(broad.has(entry.dataset)?4:0);
const canonical=new Map();
for(const entry of withoutFamilies){
  const identity=key(entry.raw.name||entry.raw.id);
  const previous=canonical.get(identity);
  if(!previous||quality(entry)>quality(previous))canonical.set(identity,entry);
}
const output=[...canonical.values()];
const duplicatesRemoved=withoutFamilies.length-output.length;

// Reuse images attached to the same item in another dataset before asking Fandom.
const knownImages=new Map();
for(const {raw} of output){if(raw.image){knownImages.set(key(raw.id),raw.image);knownImages.set(key(raw.name),raw.image)}}
for(const {raw} of old){if(raw?.image&&raw.image_source!=='fandom-search'){knownImages.set(key(raw.id),raw.image);knownImages.set(key(raw.name),raw.image)}}
let reused=0;
for(const {raw} of output){
  if(!raw.image){const image=knownImages.get(key(raw.id))||knownImages.get(key(raw.name));if(image){raw.image=image;raw.image_source='matched-wiki-record';reused++}}
}

// Exact page-title lookups are batched to remain polite to the community wiki.
const missing=output.filter(({raw})=>!raw.image&&raw.name&&!String(raw.name).includes('???'));
let wikiMatches=0;
for(const batch of chunks(missing,40)){
  try{
    const titles=batch.map(({raw})=>raw.name).join('|');
    const url=`${WIKI}?action=query&format=json&redirects=1&prop=pageimages&piprop=original&titles=${encodeURIComponent(titles)}`;
    const payload=await get(url);
    const byTitle=new Map(Object.values(payload.query?.pages||{}).filter(p=>p.original?.source).map(p=>[key(p.title),p.original.source]));
    const redirects=new Map((payload.query?.redirects||[]).map(r=>[key(r.from),key(r.to)]));
    for(const entry of batch){const title=key(entry.raw.name);const image=byTitle.get(title)||byTitle.get(redirects.get(title));if(image){entry.raw.image=image;entry.raw.image_source='fandom-page';wikiMatches++}}
  }catch(error){console.warn(`Fandom image lookup skipped: ${error.message}`)}
}

if(output.length<300)throw new Error(`Safety check failed: only ${output.length} records`);
await writeFile('data/catalog.json',JSON.stringify(output,null,2)+'\n');
const withImages=output.filter(({raw})=>raw.image).length;
await writeFile('data/version.json',JSON.stringify({dataVersion:version.dataVersion||version.data?.dataVersion||null,syncedAt:new Date().toISOString(),records:output.length,categories:new Set(output.map(entry=>entry.dataset)).size,previousRecords:old.length,images:withImages,imageCoverage:Number((withImages/output.length*100).toFixed(1)),imagesReused:reused,imagesFromFandom:wikiMatches,duplicatesRemoved,nonItemFamiliesRemoved:removedFamilies},null,2)+'\n');
console.log(`Synced ${output.length} records across ${names.length} categories; ${withImages} images (${(withImages/output.length*100).toFixed(1)}%)`);
