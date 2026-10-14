import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three-r170.module.min.js';
import {createLyra,poseGuitar} from '../assets/lyra-hero-r1314.js';
const root=createLyra(),u=root.userData,p={grounded:true,vx:0,vz:0};
for(const upper of [false,true]){
 const a={kind:'punch',upper,t:0,duration:upper?.62:.48,hitAt:upper?.31:.24};
 poseGuitar(root,null,0,0,false,p);poseGuitar(root,a,0,1,false,p);
 a.t=a.hitAt;poseGuitar(root,a,0,1+a.t,false,p);root.updateMatrixWorld(true);
 const h=u.limbs[upper?0:1].hand.getWorldPosition(new T.Vector3());
 assert(upper?h.y>1.65:h.z>.55,'impact pose at gameplay hitAt');
 assert(u.limbs[upper?1:0].hand.getWorldPosition(new T.Vector3()).y>1.5,'offhand guard');
}
poseGuitar(root,null,0,3,false,{...p,grounded:false,vy:6});poseGuitar(root,null,0,3.2,false,{...p,grounded:false,vy:6});assert.equal(u.body.position.y,0,'no duplicate jump height');
for(const kind of ['attack','scream','kick'])for(let i=0;i<60;i++){
 const a={kind,t:i/60,duration:1,hitAt:.5};poseGuitar(root,a,0,5+i/60,false,p);root.updateMatrixWorld(true);
 root.traverse(o=>assert(o.matrixWorld.elements.every(Number.isFinite)));
 if(kind==='scream')assert(u.microphone.visible);
}
console.log('PASS actual game adapter: contact timing, offhand guard, physics jump, guitar/microphone/kick finite poses');
