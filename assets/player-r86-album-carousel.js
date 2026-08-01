/* ANDRIK Player v55.00 FINAL STABLE R86
   Circular mobile album carousel: right swipe = next, left swipe = previous. */
(()=>{
  'use strict';
  if(window.__andrikR86AlbumCarouselReady)return;
  window.__andrikR86AlbumCarouselReady=true;

  const shell=document.getElementById('playerShell');
  const visual=shell?.querySelector('.visual-side');
  if(!shell||!visual||typeof loadCollection!=='function'||typeof COLLECTIONS!=='object')return;

  const ORDER=['illusion','ocean','hits'].filter(key=>COLLECTIONS[key]);
  if(ORDER.length<2)return;

  // Explicit transparent rails in the free space to the left and right of the cover.
  for(const side of ['left','right']){
    const zone=document.createElement('div');
    zone.className=`r86-album-swipe-zone is-${side}`;
    zone.dataset.albumSwipeZone=side;
    zone.setAttribute('aria-hidden','true');
    visual.appendChild(zone);
  }

  let tracking=false;
  let pointerId=null;
  let startX=0;
  let startY=0;
  let switching=false;

  const currentIndex=()=>{
    const index=ORDER.indexOf(currentKey);
    return index>=0?index:ORDER.indexOf('ocean');
  };
  const neighbor=step=>ORDER[(currentIndex()+step+ORDER.length)%ORDER.length];
  const blocked=target=>Boolean(target.closest?.('button,a,input,iframe,.lyrics-panel,.youtube-stage.is-visible,.lyrics-cover-button'));

  function clearMotion(){
    visual.classList.remove('r86-album-out-next','r86-album-out-prev','r86-album-in-next','r86-album-in-prev');
  }

  function switchAlbum(step){
    if(switching)return;
    const key=neighbor(step);
    if(!key||key===currentKey||!COLLECTIONS[key])return;
    switching=true;
    const direction=step>0?'next':'prev';
    const wasPlaying=document.getElementById('app')?.classList.contains('playing')||false;
    clearMotion();
    visual.classList.add(direction==='next'?'r86-album-out-next':'r86-album-out-prev');
    window.setTimeout(()=>{
      loadCollection(key,true,wasPlaying);
      clearMotion();
      // Incoming artwork comes from the opposite edge, like a real carousel.
      visual.classList.add(direction==='next'?'r86-album-in-next':'r86-album-in-prev');
      window.setTimeout(()=>{
        clearMotion();
        switching=false;
      },280);
    },145);
  }

  function begin(event){
    if(document.body.classList.contains('site-mode')||event.pointerType==='mouse'||blocked(event.target))return;
    tracking=true;
    pointerId=event.pointerId;
    startX=event.clientX;
    startY=event.clientY;
    try{visual.setPointerCapture(pointerId)}catch(_){ }
  }

  function end(event){
    if(!tracking||event.pointerId!==pointerId)return;
    tracking=false;
    const dx=event.clientX-startX;
    const dy=event.clientY-startY;
    try{visual.releasePointerCapture(pointerId)}catch(_){ }
    pointerId=null;
    if(Math.abs(dx)<54||Math.abs(dx)<Math.abs(dy)*1.18)return;
    event.preventDefault();
    // Requested behavior: swipe right -> next playlist; swipe left -> previous album.
    switchAlbum(dx>0?1:-1);
  }

  visual.addEventListener('pointerdown',begin,{passive:true});
  visual.addEventListener('pointerup',end,{passive:false});
  visual.addEventListener('pointercancel',()=>{tracking=false;pointerId=null},{passive:true});
  visual.addEventListener('dragstart',event=>event.preventDefault());
})();
