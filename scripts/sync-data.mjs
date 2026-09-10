import {mkdir,readFile,writeFile} from 'node:fs/promises';
const API='https://gzw-data.dev/api/v1';
const WIKI='https://gray-zone-warfare.fandom.com/api.php';
const excluded=new Set(['tasks','vendors','metadata','removed_content','upcoming_content','cleanup','contracts','loot_containers']);
const get=async url=>{const r=await fetch(url,{headers:{'user-agent':'GrayArea-sync/1.0'}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()};
const key=value=>String(value||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').trim();
const chunks=(values,size)=>Array.from({length:Math.ceil(values.length/size)},(_,i)=>values.slice(i*size,(i+1)*size));
const similarity=(a,b)=>{const A=new Set(key(a).split(' ').filter(Boolean)),B=new Set(key(b).split(' ').filter(Boolean));const shared=[...A].filter(x=>B.has(x)).length;return shared/Math.max(A.size,B.size,1)};
await mkdir('data',{recursive:true});
let old=[];try{old=JSON.parse(await readFile('data/catalog.json','utf8'))}catch{}
let oldVersion={};try{oldVersion=JSON.parse(await readFile('data/version.json','utf8'))}catch{}
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
const output=[...merged.values()];

// Reuse images attached to the same item in another dataset before asking Fandom.
const knownImages=new Map();
for(const {raw} of output){if(raw.image){knownImages.set(key(raw.id),raw.image);knownImages.set(key(raw.name),raw.image)}}
for(const {raw} of old){if(raw?.image){knownImages.set(key(raw.id),raw.image);knownImages.set(key(raw.name),raw.image)}}
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

// Fuzzy fallback for titles that differ slightly from their wiki page. Limit the
// daily work and retain matches in catalog.json, so coverage improves over time.
const fuzzyCandidates=output.filter(({raw})=>!raw.image&&raw.name&&!String(raw.name).includes('???'));
const searchStart=Math.min(Number(oldVersion.imageSearchCursor)||160,Math.max(fuzzyCandidates.length-1,0));
const stillMissing=[...fuzzyCandidates.slice(searchStart),...fuzzyCandidates.slice(0,searchStart)].slice(0,160);
const findWikiImage=async entry=>{
  try{
    const url=`${WIKI}?action=query&format=json&generator=search&gsrnamespace=0&gsrlimit=3&gsrsearch=${encodeURIComponent(`intitle:${entry.raw.name}`)}&prop=pageimages&piprop=original`;
    const payload=await get(url);
    const candidates=Object.values(payload.query?.pages||{}).filter(p=>p.original?.source).map(p=>({...p,score:similarity(entry.raw.name,p.title)})).sort((a,b)=>b.score-a.score);
    if(candidates[0]?.score>=0.66){entry.raw.image=candidates[0].original.source;entry.raw.image_source='fandom-search';return 1}
  }catch(error){console.warn(`Fandom search skipped for ${entry.raw.name}: ${error.message}`)}
  return 0;
};
for(const batch of chunks(stillMissing,8))wikiMatches+=(await Promise.all(batch.map(findWikiImage))).reduce((a,b)=>a+b,0);
if(output.length<300)throw new Error(`Safety check failed: only ${output.length} records`);
await writeFile('data/catalog.json',JSON.stringify(output,null,2)+'\n');
const withImages=output.filter(({raw})=>raw.image).length;
const imageSearchCursor=fuzzyCandidates.length?(searchStart+stillMissing.length)%fuzzyCandidates.length:0;
await writeFile('data/version.json',JSON.stringify({dataVersion:version.dataVersion||version.data?.dataVersion||null,syncedAt:new Date().toISOString(),records:output.length,categories:names.length,previousRecords:old.length,images:withImages,imageCoverage:Number((withImages/output.length*100).toFixed(1)),imagesReused:reused,imagesFromFandom:wikiMatches,imageSearchCursor},null,2)+'\n');
console.log(`Synced ${output.length} records across ${names.length} categories; ${withImages} images (${(withImages/output.length*100).toFixed(1)}%)`);
