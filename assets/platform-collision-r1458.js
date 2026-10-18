// Resolve the visible 0.6 m deck as a solid box. Small walking steps remain automatic.
export function collidePlatforms(state,old){
 const p=state.p,r=.27,body=1.78,epsilon=.04;
 for(const f of state.geo.platforms){if(f.gone||f.refuge)continue;const bottom=f.h-.6,foot=Math.max(old.y,p.y);
  if(f.h<=foot+(old.grounded&&p.vy<=0?.36:.04)||Math.min(old.y,p.y)+body<=bottom+epsilon)continue;
  const left=f.x-f.w/2-r,right=f.x+f.w/2+r,back=f.z-f.d/2-r,front=f.z+f.d/2+r;
  if(p.x<=left||p.x>=right||p.z<=back||p.z>=front)continue;
  if(old.x<=left){p.x=left-epsilon;p.vx=0;}else if(old.x>=right){p.x=right+epsilon;p.vx=0;}
  else if(old.z<=back){p.z=back-epsilon;p.vz=0;}else if(old.z>=front){p.z=front+epsilon;p.vz=0;}
  else {const options=[{n:Math.abs(p.x-left),axis:'x',value:left-epsilon},{n:Math.abs(right-p.x),axis:'x',value:right+epsilon},{n:Math.abs(p.z-back),axis:'z',value:back-epsilon},{n:Math.abs(front-p.z),axis:'z',value:front+epsilon}].sort((a,b)=>a.n-b.n);p[options[0].axis]=options[0].value;p[options[0].axis==='x'?'vx':'vz']=0;}
 }
 // Hitting an overhead deck from underneath must stop the ascent.
 if(p.vy>0)for(const f of state.geo.platforms){if(f.gone)continue;const bottom=f.h-.6;if(old.y+body<=bottom+.02&&p.y+body>bottom&&Math.abs(p.x-f.x)<f.w/2+r&&Math.abs(p.z-f.z)<f.d/2+r){p.y=bottom-body-.02;p.vy=0;}}
}
