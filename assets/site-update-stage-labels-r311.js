/* R313 — installer stage label integrity guard. */
(()=>{
  'use strict';
  if(window.__ANDRIK_STAGE_LABELS_R313__) return;
  window.__ANDRIK_STAGE_LABELS_R313__=true;
  const labels={
    check:['1','ZIP'], backup:['2','Backup'], commit:['3','Commit'],
    release:['4','Release'], deploy:['5','Сайт'], protect:['6','Защита']
  };
  let applying=false;
  const apply=()=>{
    if(applying) return;
    const root=document.getElementById('siteUpdateStages');
    if(!root) return;
    applying=true;
    try{
      Object.entries(labels).forEach(([name,[num,text]])=>{
        const cell=root.querySelector(`[data-stage="${name}"]`);
        if(!cell) return;
        let b=cell.querySelector(':scope>b');
        let span=cell.querySelector(':scope>span');
        if(!b){ b=document.createElement('b'); cell.prepend(b); }
        if(!span){ span=document.createElement('span'); cell.append(span); }
        if(b.textContent!==num) b.textContent=num;
        if(span.textContent!==text) span.textContent=text;
      });
      root.hidden=false;
    }finally{ applying=false; }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply,{once:true});
  else apply();
  const start=()=>{
    const root=document.getElementById('siteUpdateStages');
    if(!root) return;
    const observer=new MutationObserver(()=>{ if(!applying) requestAnimationFrame(apply); });
    observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','style','hidden']});
    [50,200,600,1200].forEach(ms=>setTimeout(apply,ms));
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
