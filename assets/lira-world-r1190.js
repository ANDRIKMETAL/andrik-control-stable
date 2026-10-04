import * as T from './vendor/three-r170.module.min.js';
import {material,box,sphere,cylinder,cone,ring,sign,mesh,batch} from './lira-models-r1190.js?v=55.00-r1238';
const stone=material('#607e92',.88,.08),road=material('#2b4155',.38,.35),iron=material('#27343e',.47,.65),warm=material('#d5aa6a',.45,.1,.5);
export function buildWorld(mode){
const group=new T.Group(),tiles=[],animated=[];
const ground=['city','bar','bike','ocean','ruins','cavern'].includes(mode);
if(ground){
const floor=box(group,240,-4,0,1600,8,260,mode==='ruins'?material('#403c3d',.86):mode==='ocean'?stone:road);floor.userData.follow=true;
if(mode==='city'||mode==='bike'){
box(group,240,-1,-106,1600,9,42,stone);
for(let i=0;i<13;i++){const tile=cityTile(i,mode);tile.position.x=i*135;group.add(tile);tiles.push(tile);}
for(let i=0;i<16;i++){const puddle=sphere(group,i*93,.12,21+(i%3)*28,26+i%5*5,.13,6+i%4,material('#536d7c',.12,.78));puddle.userData.groundLoop=true;}
for(let i=0;i<20;i++){const stripe=box(group,i*95,-.02,95,38,.1,1.7,material('#b9b397',.6));stripe.userData.groundLoop=true;}
}
if(mode==='bar'){
box(group,240,88,-145,560,176,12,'#211f26');box(group,240,41,-82,360,64,29,'#493a31');box(group,240,75,-79,380,6,40,'#786148');
for(let j=0;j<3;j++){box(group,235,94+j*24,-135,300,3,15,iron);for(let i=0;i<17;i++){cylinder(group,105+i*16,103+j*24,-125,2.7,16,material(i%2?'#485a52':'#6d4942',.27,.4));}}
sign(group,'NO CHOICE',240,177,-134,150,'#d4b47e',27);
for(const x of [58,143,338,423]){cylinder(group,x,25,-37,2.5,50,iron);cylinder(group,x,51,-37,12,5,'#5d3440');}
for(const x of [32,440]){box(group,x,60,-67,34,105,22,iron);for(const y of [31,65,92])sphere(group,x,y,-54,12,12,1,material('#0e1821'));}
for(let i=0;i<10;i++)box(group,i*60,-.01,0,1,.1,225,'#807063');
}
if(mode==='ocean'||mode==='ruins'){
for(let i=0;i<14;i++){const tile=new T.Group();tile.position.x=i*155;group.add(tile);tiles.push(tile);column(tile,0,0,-116,mode==='ruins');if(i%3===0)column(tile,53,0,-131,mode==='ruins');if(i%2)box(tile,27,117,-115,80,9,26,stone);
for(let j=0;j<3;j++){const r=mesh(tile,new T.DodecahedronGeometry(12+j*3),stone,j*25-25,6,-81-j*9);r.rotation.set(j,1,i*.42);r.scale.y=.5;}
if(mode==='ruins'){const flame=cone(tile,69,32,-90,6,25,material('#d87943',.4,.1,1.7));flame.userData.keep=true;animated.push(flame);cylinder(tile,69,16,-90,5,18,iron);}
}
for(let i=0;i<20;i++){const slab=box(group,i*89,-.3,0,86,.5,225,material(mode==='ruins'?'#5b514a':'#607580',.86));slab.userData.groundLoop=true;}
if(mode==='ocean'){
const sea=new T.Mesh(new T.PlaneGeometry(4000,1500,60,24),new T.MeshStandardMaterial({color:'#276987',metalness:.6,roughness:.28}));sea.rotation.x=-Math.PI/2;sea.position.set(240,-11,-900);group.add(sea);animated.push(sea);sea.userData.water=true;
const eye=ring(group,380,245,-540,52,1.8,material('#9fb8c4',.4,.2,.6));eye.scale.y=.46;sphere(group,380,245,-540,12,20,8,material('#abcbd0',.3,.2,.7));
}else{
const volcano=cone(group,530,80,-650,210,340,material('#2c262c',.95));volcano.scale.z=.7;
sphere(group,530,245,-650,27,14,22,material('#c16a43',.5,0,.7));
}
}
}
if(mode==='cavern'){
for(let i=0;i<12;i++){
const tile=new T.Group();tile.position.x=i*155;group.add(tile);tiles.push(tile);
const rock=mesh(tile,new T.DodecahedronGeometry(1),material('#243e49'),0,48,-115,76,85,38);rock.rotation.z=i*.42;
cone(tile,35,135,-95,17,80,material('#304a56')).rotation.z=Math.PI;
for(let j=0;j<3;j++){const crystal=cone(tile,-22+j*12,15+j*4,-65,5,25+j*7,material('#4ecbbf',.25,.3,.7));crystal.rotation.z=(j-1)*.35;}
}
}
if(mode==='tower'){
for(let i=0;i<8;i++){box(group,i*86-65,140,-68,21,800,28,stone);for(let j=0;j<7;j++)box(group,i*86-65,j*66-50,-51,33,5,32,iron);}
for(let j=0;j<8;j++)box(group,240,j*70-30,-100,680,5,14,iron);
}
if(mode==='tetris'){
box(group,240,119,-17,193,212,20,iron);box(group,240,119,-4,160,192,6,material('#080f1c',.5,.3));
for(let x=0;x<=10;x++)box(group,160+x*16,119,.1,.4,192,.5,'#344451');
for(let y=0;y<=12;y++)box(group,240,23+y*16,.1,160,.4,.5,'#344451');
for(const x of [148,332]){box(group,x,119,0,4,214,10,material('#bdac85',.4,.6));}
}
if(mode!=='bar'&&mode!=='tetris'){
const far=new T.InstancedMesh(new T.BoxGeometry(1,1,1),material(mode==='ruins'?'#30282d':'#253240',.94),36),o=new T.Object3D();
for(let i=0;i<36;i++){const h=65+(i*59)%170;o.position.set(i*95-800,h/2,-350-(i%3)*120);o.scale.set(40+(i*13)%42,h,40);o.updateMatrix();far.setMatrixAt(i,o.matrix);}group.add(far);far.userData.skyLoop=true;
const moon=sphere(group,440,310,-700,50,50,50,material(mode==='ruins'?'#c19774':'#bfccd4',.9,0,.4));moon.castShadow=false;moon.userData.skyLoop=true;
if(mode==='space'){
moon.scale.set(160,160,160);moon.position.set(640,150,-880);moon.material=material('#435f75',.85,.1,.2);
const orbit=ring(group,640,150,-880,230,6,material('#817b83',.6,.4));orbit.rotation.x=1.1;orbit.rotation.z=.3;orbit.userData.skyLoop=true;
}
}
const points=new Float32Array((mode==='space'?600:240)*3);for(let i=0;i<points.length/3;i++){points[i*3]=(Math.sin(i*123.4)*.5+.5)*1700-600;points[i*3+1]=(Math.sin(i*321.7)*.5+.5)*650;points[i*3+2]=-110-Math.abs(Math.sin(i*57.9))*800;}
const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(points,3));const particles=new T.Points(geo,new T.PointsMaterial({color:mode==='ruins'?'#d09f73':'#b1c5d1',size:mode==='space'?1.4:.7,transparent:true,opacity:.6,sizeAttenuation:true}));group.add(particles);
for(const tile of tiles)batch(tile);
return {group,tiles,animated,particles,mode};
}
function column(p,x,y,z,ruins){box(p,x,y+5,z,36,10,34,stone);cylinder(p,x,y+58,z,10,102,stone);for(let i=0;i<8;i++){const a=i*Math.PI/4;cylinder(p,x+Math.cos(a)*9,y+59,z+Math.sin(a)*9,1.4,95,material('#637077',.86));}box(p,x,y+112,z,30,10,28,stone);if(ruins)box(p,x+3,y+122,z,34,11,29,stone).rotation.z=.08;}
function cityTile(i,mode){
const g=new T.Group(),h=112+(i*31)%66,c=material(['#465971','#4f506b','#456775','#61516a'][i%4],.85,.12);
box(g,0,h/2,-151,131,h,64,c);box(g,0,h+3,-150,140,6,69,iron);box(g,0,5,-116,135,11,13,stone);
for(let row=0;row<3;row++)for(let col=0;col<3;col++){const x=-41+col*40,y=39+row*41;if(y>h-13)continue;box(g,x,y,-117,22,29,2,iron);box(g,x,y,-115,17,24,1,material(i%3===row?'#d5a35a':'#507c97',.33,.55,i%3===row?.26:.02));box(g,x,y,-113.9,1.5,26,.8,iron);}
box(g,48,30,-115,24,56,4,iron);box(g,48,49,-112,18,9,1,material('#655849',.5,.3,.08));
if(i%2===0){cylinder(g,-52,62,-93,1.6,124,iron);box(g,-43,123,-93,22,2.5,3,iron);box(g,-35,121,-93,16,3,10,warm);const pool=sphere(g,-35,.14,-64,32,.12,24,material('#88795e',.25,.55));pool.castShadow=false;}
if(i%3===0){sign(g,['ANDRIK','NO CHOICE','WAKE UP'][Math.floor(i/3)%3],0,96,-113,102,'#d9bc83',19);box(g,-34,19,-86,30,30,23,'#334842');box(g,-34,35,-86,33,3,25,iron);}
if(mode==='bike'){g.position.z=-30;}
return g;
}
export function moveWorld(world,camera,time){
for(const t of world.tiles){const base=t.userData.base??(t.userData.base=t.position.x);t.position.x=base+Math.floor((camera-base+900)/((world.mode==='city'||world.mode==='bike'?135:155)*world.tiles.length))*(world.mode==='city'||world.mode==='bike'?135:155)*world.tiles.length;t.visible=t.position.x>camera-260&&t.position.x<camera+900;}
for(const c of world.group.children){if(c.userData.follow)c.position.x=camera+240;if(c.userData.groundLoop){const b=c.userData.base??(c.userData.base=c.position.x);c.position.x=b+Math.floor((camera-b+1100)/1500)*1500;}if(c.userData.skyLoop){const b=c.userData.base??(c.userData.base=c.position.x);c.position.x=b+camera*.75;}}
for(const a of world.animated){if(a.userData.water){const v=a.geometry.attributes.position;for(let i=0;i<v.count;i++){v.setZ(i,Math.sin(v.getX(i)*.028+time*.7)*2.4+Math.cos(v.getY(i)*.023+time*.5)*2);}v.needsUpdate=true;}else{a.scale.y=1+Math.sin(time*7+a.position.x)*.2;}}
world.particles.position.x=camera*.8;world.particles.position.y=-time*(world.mode==='space'?0:1.5)%35;
}
