const lateral=(s,e)=>s.race?.version===1464?(e.lane||0)-s.race.offset:e.x-s.p.x;
export function bikeKick(s){const r=s.race;if(!r?.mounted||r.finished||r.countdown>0||r.kickCD>0)return false;const near=s.rivals.filter(e=>!(e.disabled>0)&&Math.abs(e.z-s.p.z)<4.3&&Math.abs(lateral(s,e))<3.8).sort((a,b)=>Math.hypot(lateral(s,a),a.z-s.p.z)-Math.hypot(lateral(s,b),b.z-s.p.z))[0];r.kick={t:0,side:near?Math.sign(lateral(s,near))||1:1,hit:false};r.kickCD=.85;s.emit('bikeKickWind');return true;}
export function updateBikeCombat(s,dt){const r=s.race;if(!r)return;r.kickCD=Math.max(0,(r.kickCD||0)-dt);
 for(const e of s.rivals){e.disabled=Math.max(0,(e.disabled||0)-dt);e.fallen=Math.max(0,(e.fallen||0)-dt);}
 if(!r.kick)return;const a=r.kick;a.t+=dt;if(!a.hit&&a.t>.20){a.hit=true;const foe=s.rivals.find(e=>!(e.disabled>0)&&Math.abs(e.z-s.p.z)<4.3&&Math.abs(lateral(s,e))<3.8&&Math.sign(lateral(s,e))===a.side&&s.p.y<1.4);if(foe){foe.disabled=4;foe.fallen=1.4;foe.fallSide=a.side;r.knockouts=(r.knockouts||0)+1;const firstReward=!foe.kickRewarded;if(firstReward){foe.kickRewarded=true;s.crystals+=2;}s.emit('bikeKickHit',{x:foe.x,z:foe.z});s.emit('notice',{text:'Соперник сбит ногой!'+(firstReward?' · +2 кристалла':'')});}}
 if(a.t>.65)r.kick=null;
}
export function poseRidingKick(hero,kick){if(!kick)return;const t=kick.t/.65,pulse=Math.sin(Math.PI*Math.min(1,t)),u=hero.userData,l=u.limbs[kick.side<0?0:1];u.body.rotation.z-=kick.side*pulse*.15;l.leg.rotation.set(-.58*pulse,0,kick.side*1.38*pulse);l.shin.rotation.x=1.6*(1-pulse)+.15*pulse;}
