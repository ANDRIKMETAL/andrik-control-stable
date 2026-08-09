/* ANDRIK R353 — overlay-level manual touch scrolling, before old map gestures can intercept. */
(()=>{
 'use strict';
 if(window.__ANDRIK_COUNTRY_SCROLL_R353__)return;
 window.__ANDRIK_COUNTRY_SCROLL_R353__=true;
 const bind=()=>{
   const list=document.getElementById('worldCountries');
   const overlay=document.querySelector('.country-scroll-overlay-r258');
   if(!list||!overlay||overlay.dataset.r353ScrollBound==='1')return false;
   overlay.dataset.r353ScrollBound='1';
   const active=()=>overlay.classList.contains('is-open')&&list.classList.contains('is-expanded')&&list.parentNode===overlay;
   let tracking=false,startY=0,startScroll=0,moved=false;
   overlay.addEventListener('touchstart',e=>{
     if(!active()||e.touches.length!==1||!list.contains(e.target))return;
     tracking=true;moved=false;startY=e.touches[0].clientY;startScroll=list.scrollTop;
   },{capture:true,passive:true});
   overlay.addEventListener('touchmove',e=>{
     if(!tracking||!active()||e.touches.length!==1)return;
     const dy=e.touches[0].clientY-startY;
     if(Math.abs(dy)>2)moved=true;
     if(!moved)return;
     const max=Math.max(0,list.scrollHeight-list.clientHeight);
     list.scrollTop=Math.max(0,Math.min(max,startScroll-dy));
     e.preventDefault();
     e.stopPropagation();
   },{capture:true,passive:false});
   const finish=e=>{
     if(!tracking)return;
     tracking=false;
     if(moved)e.stopPropagation();
     setTimeout(()=>{moved=false},70);
   };
   overlay.addEventListener('touchend',finish,{capture:true,passive:true});
   overlay.addEventListener('touchcancel',finish,{capture:true,passive:true});
   overlay.addEventListener('wheel',e=>{
     if(!active()||!list.contains(e.target))return;
     e.preventDefault();e.stopPropagation();
     const max=Math.max(0,list.scrollHeight-list.clientHeight);
     list.scrollTop=Math.max(0,Math.min(max,list.scrollTop+e.deltaY));
   },{capture:true,passive:false});
   return true;
 };
 const boot=()=>{
   if(bind())return;
   let n=0;const timer=setInterval(()=>{if(bind()||++n>30)clearInterval(timer)},50);
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 addEventListener('pageshow',boot,{passive:true});
})();
