import * as T from './vendor/three-r170.module.min.js';
export function createEnemyReadability(geometries,materials){
 const ring=new T.RingGeometry(.62,.76,24),box=new T.BoxGeometry(1,1,1);geometries.add(ring);geometries.add(box);
 const mat=(color)=>{const m=new T.MeshBasicMaterial({color,transparent:true,opacity:.82,depthWrite:false});materials.add(m);return m;};
 const amber=mat('#ffc26a'),blue=mat('#72e5e0'),red=mat('#ed6d80'),back=mat('#172634');
 const q=new T.Quaternion();
 function enemy(root,e,state,camera){
  let fx=root.userData.readability1448;
  if(!fx){
   const scale=Math.max(.001,root.scale.x),bounds=new T.Box3().setFromObject(root),height=Math.max(1,bounds.max.y-bounds.min.y);
   const marker=new T.Group();marker.scale.setScalar(1/scale);marker.position.y=.055/scale;root.add(marker);
   const halo=new T.Mesh(ring,amber);halo.rotation.x=-Math.PI/2;marker.add(halo);
   const aim=new T.Mesh(box,amber);aim.scale.set(.10,.025,1.0);aim.position.set(0,.025,1.13);marker.add(aim);
   const hp=new T.Group();hp.position.y=(height+.25)/scale;hp.scale.setScalar(1/scale);root.add(hp);
   const background=new T.Mesh(box,back);background.scale.set(1.12,.105,.025);hp.add(background);
   const fill=new T.Mesh(box,red);fill.position.z=.025;hp.add(fill);
   fx={marker,halo,aim,hp,fill,expiry:0};root.userData.readability1448=fx;
  }
  const targeted=state.attack?.aim?.target===e.id,weak=e.tactic?.exposed>0||e.kind==='boss'&&(e.boss1468?state.bossOpen>0:e.oceanRevision||e.worldRevision===1457?e.mode==='recover':state.bossOpen>0),warning=['windup','strike','aim'].includes(e.mode)&&!(e.down>0);
  fx.marker.visible=e.hp>0&&(weak||warning||targeted);fx.halo.material=weak||targeted&&!warning?blue:amber;fx.aim.visible=warning&&!weak;
  if(e.hit>0)fx.expiry=state.time+2.2;
  fx.hp.visible=e.hp>0&&e.kind!=='boss'&&state.time<fx.expiry;
  fx.fill.scale.set(1.06*Math.max(0,e.hp/e.max),.066,.025);fx.fill.position.x=-.53+.53*Math.max(0,e.hp/e.max);
  if(fx.hp.visible){root.getWorldQuaternion(q);fx.hp.quaternion.copy(q.invert().multiply(camera.quaternion));}
  if(e.kind==='boss'&&root.userData.chest&&e.bossRevision)root.userData.chest.material=weak?blue:amber;
 }
 function bossMarker(telegraph,beam,state){
  const e=state.living.find(e=>e.kind==='boss'&&e.bossRevision);if(!e)return;
  const a=state.bossAction;telegraph.visible=!!a&&a.t<a.wind;beam.visible=!!a&&['charge','volley'].includes(a.kind);
  if(!a)return;
  if(a.kind==='slam'){telegraph.position.set(e.x,.08,e.z);telegraph.scale.setScalar(5.2);}
  else {telegraph.position.set(e.x+Math.sin(a.yaw)*2,.08,e.z+Math.cos(a.yaw)*2);telegraph.scale.setScalar(a.kind==='kick'?1.8:1.4);}
  if(beam.visible){const length=a.kind==='charge'?a.travel+2:10;beam.position.set(a.startX+Math.sin(a.yaw)*length/2,.065,a.startZ+Math.cos(a.yaw)*length/2);beam.rotation.y=a.yaw;beam.scale.set(a.kind==='charge'?1.7:.18,.035,length);telegraph.visible=false;}
 }
 return {enemy,bossMarker};
}
