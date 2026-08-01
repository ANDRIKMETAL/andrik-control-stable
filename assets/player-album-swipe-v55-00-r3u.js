/* ANDRIK Player v55.00 R3U — gesture-only album switching in the full player. */
(() => {
  'use strict';
  const shell=document.getElementById('playerShell');
  if(!shell||typeof loadCollection!=='function'||typeof COLLECTIONS!=='object')return;
  const ORDER=['illusion','ocean','hits'].filter(key=>COLLECTIONS[key]);
  if(ORDER.length<2)return;
  let startX=0,startY=0,pointerId=null,tracking=false;
  const indexOfCurrent=()=>{const i=ORDER.indexOf(currentKey);return i>=0?i:ORDER.indexOf('ocean')};
  const neighbor=step=>ORDER[(indexOfCurrent()+step+ORDER.length)%ORDER.length];
  const switchTo=key=>{
    if(!key||!COLLECTIONS[key]||key===currentKey)return;
    const wasPlaying=document.getElementById('app')?.classList.contains('playing')||false;
    shell.classList.add('is-album-switching');
    loadCollection(key,true,wasPlaying);
    window.setTimeout(()=>shell.classList.remove('is-album-switching'),420);
  };
  const blocked=target=>Boolean(target.closest?.('button,a,input,iframe,.youtube-stage,.lyrics-panel,.progress-area,.transport,.track-community-actions'));
  shell.addEventListener('pointerdown',event=>{
    if(document.body.classList.contains('site-mode')||event.pointerType==='mouse'||blocked(event.target))return;
    pointerId=event.pointerId;startX=event.clientX;startY=event.clientY;tracking=true;
  },{passive:true});
  shell.addEventListener('pointerup',event=>{
    if(!tracking||event.pointerId!==pointerId)return;
    tracking=false;pointerId=null;
    const dx=event.clientX-startX,dy=event.clientY-startY;
    if(Math.abs(dx)<64||Math.abs(dx)<Math.abs(dy)*1.25)return;
    switchTo(dx>0?neighbor(1):neighbor(-1));
  },{passive:true});
  shell.addEventListener('pointercancel',()=>{tracking=false;pointerId=null},{passive:true});
})();
