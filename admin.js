(()=>{
'use strict';
const OWNER='Gwazyjustcause',REPO='GrayArea',BRANCH='main',FILE='data/admin-overrides.json';
const $=id=>document.getElementById(id);
const empty=()=>({version:2,updatedAt:null,items:{},added:[],trashed:[]});
let token='',account='',remoteSha='',doc=empty(),catalog=[],selectedKey=null,edited=new Set(),images=new Map(),photo=null,limit=100,busy=false,showTrash=false;
const text=(id,msg)=>{$(id).textContent=msg;};
function num(v){const n=Number(String(v??0).replace(/[$,\s]/g,''));return Number.isFinite(n)&&n>=0?n:0;}
function dom(tag,txt,className){const e=document.createElement(tag);if(txt!==undefined)e.textContent=txt;if(className)e.className=className;return e;}
function slug(s){return String(s||'item').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,55)||'item';}
function toBase64(str){const b=new TextEncoder().encode(str);let out='';for(let i=0;i<b.length;i+=8192)out+=String.fromCharCode(...b.subarray(i,i+8192));return btoa(out);}
function fromBase64(value){const binary=atob(String(value||'').replace(/\s/g,''));const bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);return new TextDecoder().decode(bytes);}
const url=path=>'https://api.github.com'+path;
async function api(path,options={}){if(!token)throw Error('Connect to GitHub first.');const res=await fetch(url(path),{method:options.method||'GET',headers:{Accept:'application/vnd.github+json',Authorization:'Bearer '+token,'X-GitHub-Api-Version':'2022-11-28',...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store'});
let data;try{data=await res.json()}catch(e){data={};}
if(!res.ok)throw Error((data.message||'GitHub request failed')+' (HTTP '+res.status+')');return data;}
const contentPath=path=>'/repos/'+OWNER+'/'+REPO+'/contents/'+path.split('/').map(encodeURIComponent).join('/');
async function readRemote(){const file=await api(contentPath(FILE)+'?ref='+encodeURIComponent(BRANCH));remoteSha=file.sha;doc=JSON.parse(fromBase64(file.content));if(!doc||typeof doc!=='object')throw Error('Invalid editor data.');if(!doc.items||typeof doc.items!=='object')doc.items={};if(!Array.isArray(doc.added))doc.added=[];if(!Array.isArray(doc.trashed))doc.trashed=[];}
async function write(path,base64,sha,message){const body={message,branch:BRANCH,content:base64};if(sha)body.sha=sha;return api(contentPath(path),{method:'PUT',body});}
function normal(x){const r=x.raw||x,dataset=String(x.dataset||r.dataset||r.category||'items'),name=String(r.name||r.title||r.item_name||r.id||'Unknown');const size=String(r.grid_size||r.gridSize||'').match(/(\d+)\s*[x×]\s*(\d+)/i);
const slots=Math.max(1,size?Number(size[1])*Number(size[2]):(num(r.width||r.size_x||1)*num(r.height||r.size_y||1)));
return {key:dataset+':'+String(r.id||name),id:String(r.id||name),dataset,name,category:String(r.category||dataset),price:num(r.sell_price??r.sellPrice??r.grayarea_price??0),slots,width:size?Number(size[1]):num(r.width||r.size_x||0)||null,height:size?Number(size[2]):num(r.height||r.size_y||0)||null,image:String(r.image||r.image_url||r.imageUrl||r.icon||''),model3d:String(r.model3d||''),description:String(r.description||r.short_description||''),custom:false};}
function recordList(){const out=catalog.map(r=>{const p=doc.items[r.key]||{};return {...r,...p,price:Object.prototype.hasOwnProperty.call(p,'sell_price')?num(p.sell_price):r.price,key:r.key,custom:false};});
for(const x of doc.added){if(!x||typeof x.name!=='string')continue;out.push({key:(x.dataset||'custom')+':'+x.id,id:x.id,dataset:x.dataset||'custom',name:x.name,category:x.category||x.dataset||'custom',price:num(x.sell_price),slots:num(x.slots)||1,width:x.width||null,height:x.height||null,image:x.image||'',model3d:x.model3d||'',description:x.description||'',custom:true});}
return out.map(r=>({...r,trashed:doc.trashed.includes(r.key)}));}
function current(){return recordList().find(r=>r.key===selectedKey)||null;}
function isStaged(key){return edited.has(key);}
function imagePreview(path){const img=$('imagePreview');if(path){img.src=path;img.hidden=false;$('emptyPreview').hidden=true;img.onerror=()=>{img.hidden=true;$('emptyPreview').hidden=false;};}else{img.removeAttribute('src');img.hidden=true;$('emptyPreview').hidden=false;}}
function fill(key){selectedKey=key;photo=null;$('itemImage').value='';$('itemForm').hidden=false;
const fresh=key==='__new__',item=fresh?{name:'',category:'loot_items',dataset:'loot_items',price:0,slots:1,description:'',image:'',model3d:''}:current();
if(!item){$('itemForm').hidden=true;return;}
text('formHeading',fresh?'ADD NEW ITEM':'EDIT ITEM');text('formSubheading',fresh?'Create a new public item.':'ID: '+key+(edited.has(key)?' · Pending changes':''));
$('itemName').value=item.name;$('itemCategory').value=item.category;$('itemDataset').value=item.dataset;$('itemDataset').disabled=!fresh;$('itemPrice').value=String(item.price);$('itemSlots').value=String(item.slots);$('itemWidth').value=item.width||'';$('itemHeight').value=item.height||'';$('itemDescription').value=item.description;$('itemImageUrl').value=item.image||'';
imagePreview(images.get(key)?.preview||item.image);
$('deleteItem').hidden=fresh||item.trashed;$('restoreItem').hidden=fresh||!item.trashed;$('revertItem').hidden=fresh||item.custom||!doc.items[key];}
function list(){const q=$('filter').value.trim().toLowerCase();const all=recordList().filter(r=>r.trashed===showTrash&&(r.name+' '+r.category+' '+r.dataset+' '+r.key).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name));
const root=$('itemList');root.replaceChildren();text('totalCount',all.length.toLocaleString('en-US'));text('trashCount',String(doc.trashed.length));
for(const item of all.slice(0,limit)){const btn=dom('button',undefined,'editor-item'+(item.key===selectedKey?' selected':''));btn.type='button';const picture=item.image?dom('img'):dom('span','GA','no-image');
if(item.image){picture.src=images.get(item.key)?.preview||item.image;picture.alt='';picture.loading='lazy';picture.onerror=()=>{picture.replaceWith(dom('span','GA','no-image'));};}
const info=dom('div');info.append(dom('strong',item.name),dom('small',item.category+' · $'+Math.round(item.price).toLocaleString('en-US')));
if(item.trashed)info.append(dom('small','IN TRASH','changed'));if(edited.has(item.key))info.append(dom('small','UNPUBLISHED EDIT','changed'));btn.append(picture,info);btn.addEventListener('click',()=>{fill(item.key);list();});root.append(btn);}
$('loadMore').hidden=all.length<=limit;}
function count(){const n=edited.size;const uploading=images.size;text('changeCount',n?n+' PENDING CHANGE'+(n===1?'':'S'):'NO CHANGES');
text('message',n?'Publish to make '+n+' edit'+(n===1?'':'s')+' visible to everyone.'+(uploading?' '+uploading+' image(s) queued.':''):'Edit an item or add a new one to begin.');
$('publish').disabled=n===0||busy;}
async function compress(file){if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type))throw Error('Please select PNG, JPG, WebP or GIF.');if(file.size>20*1024*1024)throw Error('Image is too large (20 MB maximum).');
const objectUrl=URL.createObjectURL(file);try{const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Cannot read this image.'));image.src=objectUrl;});
const max=1100,ratio=Math.min(1,max/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
const data=canvas.toDataURL('image/webp',.84);if(!data.startsWith('data:image/webp;base64,'))throw Error('WebP export is not supported in this browser.');
return {base64:data.slice('data:image/webp;base64,'.length),preview:data};}finally{URL.revokeObjectURL(objectUrl);}}
$('itemImage').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{photo=await compress(file);imagePreview(photo.preview);text('formSubheading','Image ready · click ADD TO CHANGES to queue it.');}catch(err){photo=null;alert(err.message);}});
$('itemImageUrl').addEventListener('change',()=>{if(!photo)imagePreview($('itemImageUrl').value.trim());});
function validateImageUrl(value){if(!value)return true;if(/^https:\/\/[^\s]+$/i.test(value))return true;if(/^admin-images\/[A-Za-z0-9._/-]+$/.test(value)&&!value.includes('..'))return true;return false;}
$('itemForm').addEventListener('submit',e=>{e.preventDefault();const name=$('itemName').value.trim(),category=$('itemCategory').value.trim(),dataset=$('itemDataset').value.trim().toLowerCase(),price=Number($('itemPrice').value),slots=Number($('itemSlots').value),description=$('itemDescription').value.trim(),imageURL=$('itemImageUrl').value.trim(),widthText=$('itemWidth').value.trim(),heightText=$('itemHeight').value.trim();if(!name||!category||!Number.isFinite(price)||price<0||!Number.isInteger(slots)||slots<1||slots>9999)return;
if(Boolean(widthText)!==Boolean(heightText)){alert('Fill both grid dimensions, or leave both blank if unknown.');return;}const width=widthText?Number(widthText):null,height=heightText?Number(heightText):null;if(widthText&&(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>15||height>15)){alert('Grid dimensions must be between 1 and 15.');return;}const cells=width?width*height:slots;
if(selectedKey==='__new__'&&!/^[a-z0-9_]+$/.test(dataset)){alert('Dataset must use lowercase letters, numbers and underscores.');return;}
if(!photo&&!validateImageUrl(imageURL)){alert('Image URL must start with https:// or be a path under admin-images/.');return;}
const fresh=selectedKey==='__new__';let key=selectedKey,record;
if(fresh){const itemId='editor-'+slug(name)+'-'+Date.now().toString(36)+'-'+crypto.randomUUID().slice(0,6);key=dataset+':'+itemId;record={id:itemId,dataset,name,category,sell_price:price,slots:cells,description,image:imageURL};if(width){record.width=width;record.height=height;}doc.added.push(record);}
else{record={name,category,sell_price:price,slots:cells,description,image:imageURL};if(width){record.width=width;record.height=height;}const added=doc.added.find(x=>(x.dataset+':'+x.id)===key);if(added)Object.assign(added,record);else doc.items[key]=record;}
if(photo){const path='admin-images/'+slug(name)+'-'+crypto.randomUUID().slice(0,10)+'.webp';record.image=path;images.set(key,{path,base64:photo.base64,preview:photo.preview});}
else if(images.has(key)&&record.image!==images.get(key).path)images.delete(key);
edited.add(key);fill(key);list();count();text('syncStatus','Draft updated · not published yet.');});
$('newItem').addEventListener('click',()=>{fill('__new__');list();$('itemName').focus();});
$('revertItem').addEventListener('click',()=>{if(!selectedKey||!doc.items[selectedKey]||!confirm('Remove this published item override after you publish?'))return;delete doc.items[selectedKey];images.delete(selectedKey);edited.add(selectedKey);const key=selectedKey;list();fill(key);count();});
$('deleteItem').addEventListener('click',()=>{const item=current();if(!item||item.trashed||!confirm('Move '+item.name+' to trash? It will be hidden from Money and Loot Prices after publishing. You can restore it later.'))return;
if(!doc.trashed.includes(item.key))doc.trashed.push(item.key);images.delete(item.key);edited.add(item.key);selectedKey=null;$('itemForm').hidden=true;text('formHeading','MOVED TO TRASH');text('formSubheading','Publish changes to hide this item from the public website.');list();count();});
$('restoreItem').addEventListener('click',()=>{const item=current();if(!item||!item.trashed)return;doc.trashed=doc.trashed.filter(k=>k!==item.key);edited.add(item.key);selectedKey=null;$('itemForm').hidden=true;text('formHeading','ITEM RESTORED');text('formSubheading','Publish changes to show it on the public website again.');list();count();});
$('showActive').addEventListener('click',()=>{showTrash=false;selectedKey=null;$('itemForm').hidden=true;$('showActive').classList.add('selected');$('showTrash').classList.remove('selected');limit=100;list();});
$('showTrash').addEventListener('click',()=>{showTrash=true;selectedKey=null;$('itemForm').hidden=true;$('showTrash').classList.add('selected');$('showActive').classList.remove('selected');limit=100;list();});
$('filter').addEventListener('input',()=>{limit=100;list();});
$('loadMore').addEventListener('click',()=>{limit+=100;list();});
$('discard').addEventListener('click',async()=>{if(edited.size&&!confirm('Discard all unpublished edits?'))return;try{await readRemote();edited.clear();images.clear();selectedKey=null;$('itemForm').hidden=true;list();count();text('syncStatus','Reloaded published changes from GitHub.');}catch(e){alert(e.message);}});
$('disconnect').addEventListener('click',()=>{token='';account='';doc=empty();edited.clear();images.clear();catalog=[];selectedKey=null;$('workspace').hidden=true;$('loginPanel').hidden=false;$('itemForm').hidden=true;text('syncStatus','Disconnected.');});
async function load(){text('syncStatus','Loading published edits…');await readRemote();text('syncStatus','Loading item catalogue…');try{const resp=await fetch('data/catalog.json',{cache:'no-store'});if(!resp.ok)throw Error('HTTP '+resp.status);const data=await resp.json();if(!Array.isArray(data))throw Error('Invalid catalogue');const seen=new Set();catalog=[];for(const raw of data){const item=normal(raw);if(seen.has(item.key))continue;seen.add(item.key);catalog.push(item);}text('syncStatus',catalog.length+' wiki items loaded · '+doc.added.length+' admin-added items.');}catch(e){catalog=[];text('syncStatus','Catalogue unavailable, but you can add items and edit existing published additions.');console.warn(e);}
edited.clear();images.clear();selectedKey=null;$('itemForm').hidden=true;list();count();}
$('connectForm').addEventListener('submit',async e=>{e.preventDefault();const candidate=$('token').value.trim();if(!candidate)return;$('connectButton').disabled=true;text('connectButton','CONNECTING…');token=candidate;
try{const user=await api('/user');if(String(user.login||'').toLowerCase()!==OWNER.toLowerCase())throw Error('This editor only permits the repository owner.');
const repo=await api('/repos/'+OWNER+'/'+REPO);if(repo.permissions&&repo.permissions.push===false)throw Error('Your token cannot write to this repository. Grant Contents: Read and write for GrayArea.');
account=user.login;$('token').value='';text('account',account);$('loginPanel').hidden=true;$('workspace').hidden=false;await load();
}catch(err){token='';$('workspace').hidden=true;$('loginPanel').hidden=false;alert('Connection failed: '+err.message);}
finally{$('connectButton').disabled=false;text('connectButton','CONNECT TO GITHUB');}});
$('publish').addEventListener('click',async()=>{if(busy||!edited.size)return;if(!confirm('Publish '+edited.size+' changes to the live Gray Area website?'))return;
busy=true;$('publish').disabled=true;text('message','Uploading images and saving changes…');
try{let uploaded=0;for(const [key,file] of images){const stillUsed=(doc.items[key]&&doc.items[key].image===file.path)||doc.added.some(x=>(x.dataset+':'+x.id)===key&&x.image===file.path);
if(!stillUsed)continue;
text('message','Uploading image '+(++uploaded)+' of '+images.size+'…');
await write(file.path,file.base64,null,'Add Gray Area item image '+key);
}
doc.version=2;doc.updatedAt=new Date().toISOString();const result=await write(FILE,toBase64(JSON.stringify(doc,null,2)+'\n'),remoteSha,'Publish '+edited.size+' Gray Area item changes');
remoteSha=result.content.sha;const published=edited.size;images.clear();edited.clear();selectedKey=null;$('itemForm').hidden=true;list();count();text('syncStatus','Published '+published+' change(s) · GitHub commit '+result.commit.sha.slice(0,8));text('message','Saved to GitHub. The public website may take a short time to update.');}
catch(err){text('message','Publish failed: '+err.message+'. Your draft is still available here.');alert('Could not publish: '+err.message+'\nYour unsaved edits are still in this open tab.');}
finally{busy=false;count();}});
})();
