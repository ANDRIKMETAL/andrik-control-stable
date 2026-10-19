// Keep the last rendered doorway on screen during fade-out. Simulation and
// rendering resume under the black overlay, without opening the pause menu.
export function createChapterFlow(root,{signal,now=()=>performance.now()}={}){
 const shade=document.createElement('div');shade.className='chapter1471-fade';shade.setAttribute('aria-hidden','true');shade.hidden=true;root.append(shade);
 const title=document.createElement('div');title.className='chapter1472-title';title.hidden=true;title.setAttribute('role','status');
 const name=document.createElement('strong');title.append(name);root.append(title);
 let started=-Infinity,active=false,mode='fade',duration=.60;
 function update(){
  if(!active)return;const t=(now()-started)/1000;
  if(mode==='title'){
   title.style.opacity=String(Math.min(1,t/.24,(duration-t)/.35));
   if(t>=duration){active=false;title.hidden=true;title.style.opacity='0';}
   return;
  }
  shade.style.opacity=String(t<.2?Math.min(1,t/.2):t<.30?1:Math.max(0,1-(t-.30)/.30));
  if(t>=.60){active=false;shade.hidden=true;shade.style.opacity='0';}
 }
 signal?.addEventListener('abort',()=>{active=false;shade.remove();title.remove();},{once:true});
 return {begin(){if(active)return;mode='fade';duration=.60;started=now();active=true;shade.hidden=false;shade.style.opacity='0';root.dataset.presentation='true';},
  showTitle(text){mode='title';duration=4;started=now();active=true;shade.hidden=true;name.textContent=text;title.hidden=false;title.style.opacity='0';root.dataset.presentation='true';},update,
  get busy(){update();return active;},get renderReady(){update();return !active||mode==='title'||now()-started>=220;}};
}
