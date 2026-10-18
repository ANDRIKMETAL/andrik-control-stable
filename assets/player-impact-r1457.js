import {move} from './portrait-core-r1295.js?v=r1466';
export function knockPlayer(state,source,damage=20,power=5){
 const p=state.p,before=p.hp;state.damage(damage);if(p.hp>=before||state.dead)return false;
 const gap=Math.hypot(p.x-source.x,p.z-source.z),dx=gap>.01?p.x-source.x:Math.sin(source.yaw||0),dz=gap>.01?p.z-source.z:Math.cos(source.yaw||0),d=Math.hypot(dx,dz)||1;
 state.attack=null;state.queued=false;p.down=.95;p.downTotal=.95;p.knockX=dx/d*power;p.knockZ=dz/d*power;p.knockT=.32;p.vx=p.vz=0;p.inv=Math.max(p.inv,1.25);p.vy=Math.max(p.vy,2.7);p.grounded=false;
 state.emit('playerKnockdown',{x:p.x,z:p.z});state.emit('notice',{text:'Лира сбита с ног — сейчас поднимется. Уходи из отмеченного круга до прыжка босса.'});return true;
}
export function updatePlayerImpact(state,dt){
 const p=state.p;if(!(p.down>0))return false;p.down=Math.max(0,p.down-dt);
 if(p.knockT>0){const step=Math.min(dt,p.knockT);move(p,p.knockX*step,p.knockZ*step,state.geo.walls);p.knockT=Math.max(0,p.knockT-dt);}
 if(!p.down){p.knockT=0;p.knockX=p.knockZ=0;}return true;
}
export function posePlayerImpact(hero,p){
 if(!(p.down>0))return;const u=hero.userData,q=p.down/Math.max(.1,p.downTotal||.95),fall=Math.min(1,(1-q)*7),recover=Math.min(1,q/.30),a=fall*recover;
 u.body.rotation.z=-1.28*a;u.body.position.y=.42*a;u.head.rotation.x=.15*a;
 for(const [i,l]of u.limbs.entries()){l.leg.rotation.x=(i?-.25:.35)*a;l.shin.rotation.x=.75*a;l.arm.rotation.x=-.6*a;l.fore.rotation.x=-1.1*a;}
}
