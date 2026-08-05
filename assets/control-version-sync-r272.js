(() => {
  'use strict';
  if(window.__ANDRIK_VERSION_SYNC_R272__)return;
  window.__ANDRIK_VERSION_SYNC_R272__=true;
  const RELEASE='R272';
  const FULL='Live Web AI · ANDRIK · v55.00 LIVE WEB AI FINAL R272';
  const setText=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
  const setAttr=(node,name,value)=>{if(node&&node.getAttribute(name)!==value)node.setAttribute(name,value);};
  const apply=()=>{
    if(document.documentElement.dataset.andrikRelease!==RELEASE)document.documentElement.dataset.andrikRelease=RELEASE;
    let meta=document.querySelector('meta[name="andrik-control-release"]');
    if(!meta){meta=document.createElement('meta');meta.name='andrik-control-release';document.head.appendChild(meta);}
    if(meta.content!==RELEASE)meta.content=RELEASE;
    document.querySelectorAll('[data-andrik-version]').forEach(node=>setText(node,RELEASE));
    document.querySelectorAll('.control-split-number-r181').forEach(node=>setText(node,RELEASE));
    document.querySelectorAll('.control-split-version-r181').forEach(node=>setAttr(node,'aria-label',`Live Web AI, версия ${RELEASE}`));
    document.querySelectorAll('.control-version-footer').forEach(footer=>{
      const strong=footer.querySelector('strong');
      const span=footer.querySelector('span');
      if(document.body.classList.contains('control-home-page')){
        setText(strong,'Live Web AI');
        setText(span,RELEASE);
      }else if(strong){
        setText(strong,FULL);
      }
      if(footer.dataset.release!==RELEASE)footer.dataset.release=RELEASE;
      setAttr(footer,'aria-label',`Текущая версия ${RELEASE}`);
    });
    try{if(localStorage.getItem('andrik-control-runtime-version')!=='55.00-r272')localStorage.setItem('andrik-control-runtime-version','55.00-r272');}catch(_){}
  };
  let scheduled=false;
  const scheduleApply=()=>{
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;apply();});
  };
  apply();
  document.addEventListener('DOMContentLoaded',apply,{once:true});
  window.addEventListener('pageshow',apply,{passive:true});
  const observer=new MutationObserver(scheduleApply);
  if(document.body)observer.observe(document.body,{subtree:true,childList:true,characterData:true});
})();
