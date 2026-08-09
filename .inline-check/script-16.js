
(()=>{
  'use strict';
  const init=()=>{
    const list=document.getElementById('worldCountries');
    const card=list?.closest('.analytics-map-top');
    if(!list||!card||list.dataset.r256ScrollBound==='1')return;
    list.dataset.r256ScrollBound='1';

    const rail=document.createElement('span');
    rail.className='country-scroll-rail-r256';
    rail.setAttribute('aria-hidden','true');
    rail.innerHTML='<i class="country-scroll-thumb-r256"></i>';
    card.appendChild(rail);
    const thumb=rail.firstElementChild;

    const expanded=()=>list.classList.contains('is-expanded');
    const maxScroll=()=>Math.max(0,list.scrollHeight-list.clientHeight);
    const updateRail=()=>{
      const can=expanded()&&maxScroll()>2;
      rail.classList.toggle('is-visible',can);
      if(!can)return;
      const cardRect=card.getBoundingClientRect();
      const listRect=list.getBoundingClientRect();
      const h=Math.max(80,list.clientHeight);
      rail.style.top=Math.max(0,listRect.top-cardRect.top)+'px';
      rail.style.right='5px';
      rail.style.height=h+'px';
      const th=Math.max(34,Math.round(h*(list.clientHeight/list.scrollHeight)));
      const range=Math.max(0,h-th-2);
      const y=Math.round(range*(list.scrollTop/Math.max(1,maxScroll())));
      thumb.style.height=th+'px';
      thumb.style.transform='translateY('+y+'px)';
    };

    // Direct touch scrolling: this bypasses the parent map/swipe handler on Android.
    let active=false,startY=0,startScroll=0,moved=false;
    list.addEventListener('touchstart',e=>{
      if(!expanded()||e.touches.length!==1)return;
      active=true;moved=false;startY=e.touches[0].clientY;startScroll=list.scrollTop;
      e.stopPropagation();
    },{capture:true,passive:true});
    list.addEventListener('touchmove',e=>{
      if(!active||!expanded()||e.touches.length!==1)return;
      const dy=e.touches[0].clientY-startY;
      if(Math.abs(dy)>2)moved=true;
      if(moved){
        e.preventDefault();
        e.stopPropagation();
        list.scrollTop=Math.max(0,Math.min(maxScroll(),startScroll-dy));
        updateRail();
      }
    },{capture:true,passive:false});
    const endTouch=e=>{if(!active)return;active=false;e.stopPropagation();setTimeout(()=>{moved=false;},90);};
    list.addEventListener('touchend',endTouch,{capture:true,passive:true});
    list.addEventListener('touchcancel',endTouch,{capture:true,passive:true});

    // Block the parent pointer swipe without disabling native vertical scrolling.
    const stopPointer=e=>{if(expanded())e.stopPropagation();};
    list.addEventListener('pointerdown',stopPointer,{capture:true,passive:true});
    list.addEventListener('pointermove',stopPointer,{capture:true,passive:true});
    list.addEventListener('pointerup',stopPointer,{capture:true,passive:true});
    list.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();}},true);
    list.addEventListener('wheel',e=>{
      if(!expanded())return;
      e.preventDefault();e.stopPropagation();
      list.scrollTop=Math.max(0,Math.min(maxScroll(),list.scrollTop+e.deltaY));
      updateRail();
    },{passive:false});

    list.addEventListener('scroll',updateRail,{passive:true});
    new MutationObserver(()=>requestAnimationFrame(()=>{if(!expanded())list.scrollTop=0;updateRail();})).observe(list,{attributes:true,attributeFilter:['class'],childList:true,subtree:true});
    new ResizeObserver(updateRail).observe(list);
    addEventListener('resize',updateRail,{passive:true});
    addEventListener('orientationchange',()=>setTimeout(updateRail,140),{passive:true});
    setTimeout(updateRail,0);setTimeout(updateRail,260);setTimeout(updateRail,900);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
  addEventListener('pageshow',init,{passive:true});
})();
