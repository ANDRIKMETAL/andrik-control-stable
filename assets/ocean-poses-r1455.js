const clamp=x=>Math.max(0,Math.min(1,x));
export function poseOceanBoss(root,e,state){
 const u=root.userData;if(!u?.limbs||e.hp<=0)return;
 const a=e.oceanAction,wind=a&&a.t<a.wind,q=a?clamp(wind?a.t/a.wind:(a.t-a.wind)/a.active):0,pulse=wind?q:Math.sin(Math.PI*q);
 u.body.rotation.set(0,0,0);u.head.rotation.set(0,0,0);
 for(const [i,l]of u.limbs.entries()){const stride=e.mode==='chase'||a?.kind==='charge'&&!wind?Math.sin(state.time*9+i*Math.PI)*.5:0;l.leg.rotation.x=stride;l.shin.rotation.x=Math.max(0,-stride)*.65+.10;l.arm.rotation.set(-.55,0,(i?1:-1)*.17);l.fore.rotation.x=-1.1;}
 if(!a)return;
 if(e.mode==='recover'){u.body.rotation.x=.12;for(const l of u.limbs){l.arm.rotation.x=.1;l.fore.rotation.x=-.3;}return;}
 if(a.kind==='cut'){const l=u.limbs[1];u.body.rotation.y=wind?-.5*q:.65*pulse;l.arm.rotation.x=wind?-.6-.8*q:-1.45*pulse;l.fore.rotation.x=wind?-1.35:-.5*(1-q);}
 else if(a.kind==='charge'){u.body.rotation.x=wind?-.1*q:.4;for(const l of u.limbs){l.arm.rotation.x=-.85;l.fore.rotation.x=-1.25;}}
 else if(a.kind==='slam'){u.body.rotation.x=wind?-.15*q:.5*pulse;for(const l of u.limbs){l.arm.rotation.x=wind?-2.55*q:-2.55+3.3*q;l.fore.rotation.x=wind?-.65:0;l.shin.rotation.x=.35;}}
 else if(a.kind==='volley'){for(const [i,l]of u.limbs.entries()){l.arm.rotation.x=-1.6*pulse;l.arm.rotation.z=(i?1:-1)*.4*pulse;l.fore.rotation.x=-.3;}}
}
