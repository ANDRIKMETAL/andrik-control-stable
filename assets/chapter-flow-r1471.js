// Keep the last rendered doorway on screen during fade-out. Simulation and
// rendering resume under the black overlay, without opening the pause menu.
export function createChapterFlow(root,{signal,now=()=>performance.now()}={}){
 const shade=document.createElement('div');shade.className='chapter1471-fade';shade.setAttribute('aria-hidden','true');shade.hidden=true;root.append(shade);
 let started=-Infinity,active=false;
 function update(){
  if(!active)return;const t=(now()-started)/1000;
  shade.style.opacity=String(t<.2?Math.min(1,t/.2):t<.30?1:Math.max(0,1-(t-.30)/.30));
  if(t>=.60){active=false;shade.hidden=true;shade.style.opacity='0';}
 }
 signal?.addEventListener('abort',()=>{active=false;shade.remove();},{once:true});
 return {begin(){if(active)return;started=now();active=true;shade.hidden=false;shade.style.opacity='0';root.dataset.presentation='true';},update,
  get busy(){update();return active;},get renderReady(){update();return !active||now()-started>=220;}};
}
