import {mkdir,readFile,writeFile} from 'node:fs/promises';
const API='https://gzw-data.dev/api/v1';
const excluded=new Set(['tasks','vendors','metadata','removed_content','upcoming_content','cleanup','contracts','loot_containers']);
const get=async url=>{const r=await fetch(url,{headers:{'user-agent':'GrayArea-sync/1.0'}});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()};
const version=await get(`${API}/version`);
const names=(version.datasets||version.data?.datasets||[]).filter(n=>!n.startsWith('_')&&!excluded.has(n));
if(names.length<20)throw new Error(`Dataset discovery returned only ${names.length} categories`);
const output=[];
for(const dataset of names){
  try{const payload=await get(`${API}/${dataset}?all=true`);for(const raw of payload.data||[])output.push({dataset,raw});}
  catch(error){console.warn(`Skipped ${dataset}: ${error.message}`)}
}
if(output.length<300)throw new Error(`Safety check failed: only ${output.length} records`);
await mkdir('data',{recursive:true});
let old=[];try{old=JSON.parse(await readFile('data/catalog.json','utf8'))}catch{}
await writeFile('data/catalog.json',JSON.stringify(output,null,2)+'\n');
await writeFile('data/version.json',JSON.stringify({dataVersion:version.dataVersion||version.data?.dataVersion||null,syncedAt:new Date().toISOString(),records:output.length,categories:names.length,previousRecords:old.length},null,2)+'\n');
console.log(`Synced ${output.length} records across ${names.length} categories`);
