import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const holder=document.getElementById('arm3dViewport');
const info=document.getElementById('arm3dMessage');
const label=document.getElementById('modelType');
const fallback=document.getElementById('weaponFallback');
let renderer,scene,camera,controls,root=null,markers=[],procedural=[],active=null,preview='',wire=false,serial=0,ready=false;
const colors={steel:0x2c3532,dark:0x141b19,rail:0x38413c,polymer:0x282e27,metal:0x666d63,wood:0x604531,highlight:0xb3e66a};
const mats={
steel:new THREE.MeshStandardMaterial({color:colors.steel,metalness:.67,roughness:.39}),
dark:new THREE.MeshStandardMaterial({color:colors.dark,metalness:.45,roughness:.53}),
rail:new THREE.MeshStandardMaterial({color:colors.rail,metalness:.65,roughness:.42}),
polymer:new THREE.MeshStandardMaterial({color:colors.polymer,roughness:.82}),
metal:new THREE.MeshStandardMaterial({color:colors.metal,metalness:.75,roughness:.33}),
wood:new THREE.MeshStandardMaterial({color:colors.wood,roughness:.7}),
active:new THREE.MeshStandardMaterial({color:colors.highlight,emissive:0x628c31,emissiveIntensity:.28,metalness:.4,roughness:.46}),
preview:new THREE.MeshStandardMaterial({color:0xd3ffc1,emissive:0x77b755,emissiveIntensity:.45,transparent:true,opacity:.8})
};
function report(t){info.textContent=t;}
function append(group,geo,material,x,y,z){const mesh=new THREE.Mesh(geo,mats[material]||material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);procedural.push(mesh);return mesh;}
function block(group,x,y,z,sx,sy,sz,mat='steel'){return append(group,new THREE.BoxGeometry(sx,sy,sz),mat,x,y,z);}
function tube(group,x,y,z,length,radius,mat='steel'){const mesh=append(group,new THREE.CylinderGeometry(radius,radius,length,18),mat,x,y,z);mesh.rotation.z=Math.PI/2;return mesh;}
function tapered(group,x,y,z,a,b,h,mat='steel'){return append(group,new THREE.CylinderGeometry(a,b,h,8),mat,x,y,z);}
function shape(group,type){const n=(active?.name||'').toLowerCase(),pistol=/glock|1911|m9a1|pistol|alien/.test(n),shotgun=/m870|mossberg|benelli|shotgun|590/.test(n),smg=/mp5|mp7|ump|skorpion|smg/.test(n),ak=/\bak|mosin|sks|svd|vz\.?\s*58/.test(n),bolt=/mosin|m700|remington 788/.test(n),bullpup=/aug|famas/.test(n);
const scale=pistol?.54:smg?.78:bolt?1.13:1;
group.scale.setScalar(scale);
// This geometry is original, intentionally generic and not a specific game asset.
block(group,.1,0,0,1.15,.46,.38,ak?'steel':'rail');
block(group,-.76,.10,0,1.20,.28,.40,ak?'wood':'polymer');
block(group,-.86,.27,0,1.25,.065,.40,'rail');
tube(group,-1.52,.12,0,1.0,.086,'metal');
tube(group,-1.57,.12,0,1.05,.064,'dark');
tube(group,-2.05,.12,0,.18,.108,'metal');
block(group,.40,-.42,0,.19,.70,.28,ak?'wood':'polymer').rotation.z=-.25;
block(group,-.04,-.45,0,.31,.69,.20,'metal').rotation.z=ak?-.36:.07;
block(group,-.09,-.09,.214,.58,.10,.022,'dark');
if(!pistol&&!bullpup){block(group,1.08,-.08,0,.72,.15,.18,'dark');block(group,1.53,-.045,0,.30,.55,.36,ak?'wood':'polymer');block(group,1.65,-.02,0,.11,.62,.38,'dark');}
if(bullpup){block(group,1.00,-.13,0,.85,.56,.38,'polymer');block(group,.76,-.55,0,.21,.65,.22,'metal').rotation.z=.08;}
if(pistol){block(group,.35,.02,0,.55,.29,.34,'rail');block(group,.37,-.38,0,.22,.55,.28,'polymer');}
if(shotgun){tube(group,-1.10,-.10,.15,1.45,.075,'metal');block(group,.35,-.20,0,.52,.23,.34,'polymer');}
if(ak){block(group,.06,.34,0,.94,.12,.29,'steel');block(group,-1.04,-.01,.05,.68,.28,.33,'wood');}
if(bolt){block(group,.82,-.12,0,1.1,.29,.30,'wood');tube(group,-1.52,.07,0,1.15,.058,'dark');}
for(let i=0;i<13;i++){const x=-1.33+i*.095;block(group,x,.30,0,.045,.04,.35,'dark');}
for(let i=0;i<5;i++){const x=-.88+i*.12;block(group,x,.04,.21,.05,.045,.055,'steel');}
return {pistol,shotgun,smg,ak,bullpup};}
const slotPos={
'Optics':[.04,.48,.0],
'Suppressors / muzzle':[-2.29,.12,.0],
'Handguards / rails':[-.95,.1,.0],
'Barrels':[-1.6,.12,0],
'Stocks / grips':[1.40,-.03,0],
'Magazines':[-.04,-.56,0],
'Tactical devices':[-1.06,.02,.39],
'Other parts':[.35,-.12,.28]
};
function moduleFor(group,slot,mat='active'){const pos=slotPos[slot]||slotPos['Other parts'];const g=new THREE.Group();g.position.set(...pos);group.add(g);
if(slot==='Optics'){block(g,0,.12,0,.48,.13,.19,mat);block(g,.02,.29,0,.24,.24,.24,'dark');tube(g,0,.30,0,.40,.105,mat);}
else if(slot==='Suppressors / muzzle'){tube(g,-.17,0,0,.65,.14,mat);tube(g,-.49,0,0,.05,.145,'metal');}
else if(slot==='Stocks / grips'){block(g,.18,.03,0,.54,.44,.37,mat);block(g,.47,.06,0,.11,.6,.42,'dark');}
else if(slot==='Magazines'){block(g,.04,-.22,0,.28,.59,.25,mat).rotation.z=.18;}
else if(slot==='Tactical devices'){tube(g,0,-.04,.06,.31,.11,mat);block(g,0,.10,0,.32,.1,.2,'dark');}
else if(slot==='Handguards / rails'){block(g,-.1,-.01,0,.75,.35,.37,mat);}
else if(slot==='Barrels'){tube(g,-.13,0,0,.50,.097,mat);}
else{block(g,0,0,0,.23,.21,.17,mat);}
return g;}
function addMarkers(group,enabled=true){markers=[];if(!enabled)return;for(const [slot,pos]of Object.entries(slotPos)){const point=new THREE.Mesh(new THREE.SphereGeometry(.07,12,12),new THREE.MeshBasicMaterial({color:0xb3e66a,transparent:true,opacity:.84}));point.position.set(...pos);point.userData.slot=slot;group.add(point);markers.push(point);}}
function wipe(){if(root){scene.remove(root);root.traverse(x=>{if(x.geometry)x.geometry.dispose();if(x.material&&!Object.values(mats).includes(x.material)){if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material.dispose();}})}
root=new THREE.Group();scene.add(root);markers=[];procedural=[];}
function cameraReset(){if(!controls)return;camera.position.set(0,1.25,7.8);controls.target.set(0,-.05,0);controls.update();}
async function loadAsset(path,id){const current=++serial;
try{const data=await new GLTFLoader().loadAsync(path);if(current!==serial)return;
const model=data.scene;model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),longest=Math.max(size.x,size.y,size.z)||1;
const container=new THREE.Group();container.add(model);model.scale.setScalar(4.4/longest);model.updateMatrixWorld(true);
let box=new THREE.Box3().setFromObject(model);const center=box.getCenter(new THREE.Vector3());model.position.sub(center);root.add(container);
label.textContent='3D MODEL · LICENSED / USER SUPPLIED';report('Actual 3D model · drag to rotate · wheel to zoom');fallback.hidden=true;
}catch(e){if(current!==serial)return;report('3D file unavailable · showing generic 3D reference');proceduralScene();}}
function proceduralScene(){wipe();const g=new THREE.Group();root.add(g);shape(g);const set=new Set(active?.parts||[]);for(const slot of set)if(slotPos[slot])moduleFor(g,slot);if(preview&&!set.has(preview)&&slotPos[preview])moduleFor(g,preview,'preview');addMarkers(g);
label.textContent='GENERIC 3D DEMO · NOT IN-GAME MODEL';fallback.hidden=true;report('Drag to rotate · scroll to zoom · click green points to choose a part');}
function show(data){active=data;preview='';if(!ready)return;if(!data?.name){wipe();label.textContent='3D PREVIEW';report('Select a weapon to begin');fallback.hidden=false;return;}
wipe();if(typeof data.model3d==='string'&&(/^(https:\/\/|admin-models\/)/.test(data.model3d))){loadAsset(data.model3d,data.id);}else{serial++;proceduralScene();}
cameraReset();}
function onPreview(slot){if(!ready||!active?.name||active?.model3d)return;preview=slot||'';proceduralScene();}
function pick(event){if(!ready||!markers.length)return;const bounds=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-((event.clientY-bounds.top)/bounds.height)*2+1);
const raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);const hit=raycaster.intersectObjects(markers,false);if(!hit.length)return;
const slot=hit[0].object.userData.slot;const selector=document.getElementById('slotFilter');if(selector){selector.value=slot;selector.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('partSearch')?.focus();}
report('Selected '+slot+' · choose a matching item below');}
function init(){try{scene=new THREE.Scene();scene.background=new THREE.Color(0x0a100c);
camera=new THREE.PerspectiveCamera(36,1,.1,200);renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;holder.append(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xc7edc3,0x1a2319,2.3));const key=new THREE.DirectionalLight(0xffffff,3.4);key.position.set(-2,5,7);scene.add(key);const fill=new THREE.DirectionalLight(0x81a8ce,1.7);fill.position.set(3,1,-5);scene.add(fill);
const grid=new THREE.GridHelper(12,20,0x304b31,0x1e3121);grid.position.y=-1.45;scene.add(grid);
controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.enablePan=false;controls.minDistance=3;controls.maxDistance=14;controls.minPolarAngle=.20;controls.maxPolarAngle=Math.PI-.20;
const resize=()=>{const w=Math.max(holder.clientWidth,200),h=Math.max(holder.clientHeight,220);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);};
new ResizeObserver(resize).observe(holder);resize();cameraReset();ready=true;
holder.addEventListener('click',pick);holder.addEventListener('mousemove',event=>{const bounds=renderer.domElement.getBoundingClientRect(),mouse=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(mouse,camera);renderer.domElement.style.cursor=ray.intersectObjects(markers).length?'pointer':'grab';});
document.getElementById('reset3d')?.addEventListener('click',cameraReset);
document.getElementById('wire3d')?.addEventListener('click',()=>{wire=!wire;for(const p of procedural)p.material.wireframe=wire;});
window.addEventListener('grayarea:3d-update',ev=>show(ev.detail));
window.addEventListener('grayarea:3d-preview',ev=>onPreview(ev.detail?.slot||''));
show(window.grayArea3DData||null);
function frame(){if(!renderer)return;requestAnimationFrame(frame);controls.update();renderer.render(scene,camera)}frame();
}catch(e){console.warn('3D preview unavailable:',e);report('3D unavailable in this browser · 2D image fallback');label.textContent='2D FALLBACK';holder.hidden=true;}}
init();