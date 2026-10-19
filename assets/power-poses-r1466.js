import * as T from './vendor/three-r170.module.min.js';
const smooth=x=>{x=T.MathUtils.clamp(x,0,1);return x*x*(3-2*x);},up=new T.Vector3(0,1,0);
function setWeapon(root,weapon,grip,axis,handAt,twoHands=true){
 const u=root.userData,bat=weapon==='bat',g=bat?u.bat:u.blade;u.blade.visible=!bat;u.bat.visible=bat;axis.normalize();
 for(let pass=0;pass<18;pass++)for(const [i,offset]of [[1,0],[0,bat?.16:.11]]){if(i===0&&!twoHands)continue;const p=grip.clone().addScaledVector(axis,offset),d=p.sub(u.limbs[i].arm.position),len=d.length();if(len>.605)grip.addScaledVector(d,-(len-.605)/len);}
 g.position.copy(grip).addScaledVector(axis,bat?-.085:0);g.quaternion.setFromUnitVectors(up,axis);g.updateMatrix();
 handAt(u.limbs[1],new T.Vector3(0,bat?.085:0,0).applyMatrix4(g.matrix),1);
 if(twoHands)handAt(u.limbs[0],new T.Vector3(0,bat?.245:.11,0).applyMatrix4(g.matrix),-1);
}
function overhead(root,weapon,q,hit,handAt){
 const u=root.userData,wind=smooth(q/(hit*.55)),cut=smooth((q-hit*.55)/(hit*.45)),follow=smooth((q-hit)/.17),recover=smooth((q-.80)/.20);
 const rest=new T.Vector3(.12,1.24,.27),load=new T.Vector3(.02,1.73,-.025),impact=new T.Vector3(0,1.08,.38),end=new T.Vector3(.05,1.01,.27);
 const grip=rest.clone().lerp(load,wind).lerp(impact,cut).lerp(end,follow).lerp(rest,recover),axis=new T.Vector3(0,.96,.18).lerp(new T.Vector3(0,.62,-.78),wind).lerp(new T.Vector3(.02,-.78,.63),cut).lerp(new T.Vector3(.04,-.86,.5),follow).lerp(new T.Vector3(0,.96,.18),recover);
 setWeapon(root,weapon,grip,axis,handAt);u.body.rotation.x=-.10*wind+.34*cut*(1-recover);u.body.rotation.y=-.25*wind+.42*cut*(1-recover);u.body.position.y-=.10*cut*(1-recover);
 for(const l of u.limbs){l.leg.rotation.x-=.16*cut*(1-recover);l.shin.rotation.x+=.35*cut*(1-recover);}u.head.rotation.x=.08*cut;
 const trace=u.bladeTrace;trace.visible=weapon==='sword'&&q>hit*.55&&q<hit+.16;trace.position.set(0,1.2,.25);trace.rotation.set(0,0,0);trace.scale.setScalar(.8);if(trace.visible)trace.material.opacity=.23;
 if(weapon==='bat'&&q>hit*.55&&q<hit+.16){u.batTrail.visible=false;}
}
export function posePowerCombat(root,a,time,weapon,handAt){
 const u=root.userData;if(a?.kind!=='airCleave')u.airSamples=null;
 if(!a)return;const q=T.MathUtils.clamp(a.t/a.duration,0,1),selected=a.finishWeapon||weapon?.selected||'sword';
 if(a.kind==='airCleave'){
  const pose=a.phase==='load'?Math.min(.27,a.phaseT/.18*.27):a.phase==='cut'?.27+Math.min(1,a.phaseT/.16)*.40:.67+Math.min(1,a.phaseT/.32)*.33;
  overhead(root,selected,pose,.46,handAt);
  if(a.phase!=='recover'){u.limbs[0].leg.rotation.x-=.40;u.limbs[0].shin.rotation.x+=.72;u.limbs[1].leg.rotation.x+=.18;u.limbs[1].shin.rotation.x+=.45;}
  if(u.airAttack!==a||!u.airSamples){u.airAttack=a;u.airSamples=[];u.airSampleAt=-1;}
  const trace=a.phase==='cut'&&a.phaseT<.24;
  if(selected==='bat'&&trace){
   u.body.updateMatrix();u.bat.updateMatrix();const matrix=u.body.matrix.clone().multiply(u.bat.matrix);
   if(u.airSampleAt!==a.t){u.airSamples.push([new T.Vector3(0,.48,0).applyMatrix4(matrix),new T.Vector3(0,1.13,0).applyMatrix4(matrix)]);if(u.airSamples.length>9)u.airSamples.shift();u.airSampleAt=a.t;}
   const attr=u.batTrail.geometry.attributes.position;for(let i=0;i<u.airSamples.length;i++)for(let j=0;j<2;j++){const p=u.airSamples[i][j];attr.setXYZ(i*2+j,p.x,p.y,p.z);}attr.needsUpdate=true;u.batTrail.geometry.setDrawRange(0,Math.max(0,u.airSamples.length-1)*6);u.batTrail.visible=u.airSamples.length>1;
  }
  return;
 }
 if(a.kind==='finish'){overhead(root,selected,q,(a.hitAt??.63)/a.duration,handAt);return;}
 if(a.kind==='meteor'){overhead(root,selected,q,(a.hitAt??.46)/a.duration,handAt);u.limbs[0].leg.rotation.x-=Math.sin(q*Math.PI)*.45;u.limbs[1].shin.rotation.x+=Math.sin(q*Math.PI)*.55;return;}
 if(a.kind==='palm'){
  const reach=smooth(q/.46)*(1-smooth((q-.55)/.45));handAt(u.limbs[0],new T.Vector3(-.13+.12*reach,1.43+.13*reach,.19+.35*reach),-1);u.body.rotation.y=.30*reach;u.body.rotation.x=.04*reach;
  for(const f of u.limbs[0].hand.userData.fingers){f.position.y=-.030;f.position.z=.010;f.scale.y=.022;f.rotation.x=-.1;}return;
 }
 if(a.kind==='airKick'){
  const tuck=smooth(q/.28),extension=smooth((q-.25)/.22)*(1-smooth((q-.64)/.36));u.body.rotation.x=-.18*extension;u.body.rotation.y=.32*Math.sin(q*Math.PI);
  u.limbs[1].leg.rotation.set(-.65*tuck-.92*extension,0,.07);u.limbs[1].shin.rotation.x=1.2*tuck*(1-extension);u.limbs[0].leg.rotation.x=.25;u.limbs[0].shin.rotation.x=.95;handAt(u.limbs[0],new T.Vector3(-.20,1.48,.15),-1);return;
 }
 if(a.kind==='rage'){
  const starts=[0,.39,.76,1.11,1.47],index=Math.min((a.rageCount||5)-1,Math.floor((a.t+.02)/.37)),f=T.MathUtils.clamp((a.t-starts[index])/.42,0,1),pulse=Math.sin(f*Math.PI),side=index%2?-1:1;
  if(index===4){overhead(root,selected,f,.45,handAt);return;}
  if(index===2){u.limbs[1].leg.rotation.x=-1.45*pulse;u.limbs[1].shin.rotation.x=.35*(1-pulse);u.body.rotation.y=Math.PI*2*smooth(f/.80);u.body.rotation.x=-.12*pulse;return;}
  const grip=new T.Vector3(side*(.20-.38*smooth(f)),1.46-.21*pulse,.18+.25*pulse),axis=new T.Vector3(side*(1-2*smooth(f)),.12+.17*Math.cos(f*Math.PI),.28+.65*pulse);
  setWeapon(root,selected,grip,axis,handAt,selected==='bat');if(selected==='sword')handAt(u.limbs[0],new T.Vector3(-.20,1.47,.17),-1);
  u.body.rotation.y=side*(-.45+.95*smooth(f));u.body.rotation.x=.10*pulse;for(const l of u.limbs)l.shin.rotation.x+=.20*pulse;
 }
}
