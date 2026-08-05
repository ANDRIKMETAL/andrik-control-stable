(() => {
  'use strict';
  if (window.__ANDRIK_EYE_COLOR_LOCK_R270__) return;
  window.__ANDRIK_EYE_COLOR_LOCK_R270__ = true;
  const root=document.documentElement;
  const body=document.body;
  const path=String(location.pathname||'').toLowerCase();
  const section=String(body?.dataset?.controlSection||'').toLowerCase();
  const blueSections=new Set(['service','monitor','releases','discussion']);
  const isBlueAdmin=blueSections.has(section)||path.includes('service-admin')||path.includes('observability-admin')||path.includes('lyrics-admin')||path.includes('comments-admin');
  const isUpdate=body?.classList.contains('site-update-page')||path.includes('site-update-admin');

  const style=document.createElement('style');
  style.id='andrik-eye-color-lock-r270';
  style.textContent=`
    html[data-r270-eye="blue"] .control-center-logo .logo-ok{
      filter:brightness(1.42) saturate(2.48) hue-rotate(78deg) contrast(1.08)
        drop-shadow(0 0 15px rgba(202,246,255,.99))
        drop-shadow(0 0 38px rgba(70,178,255,.97))
        drop-shadow(0 0 60px rgba(74,198,255,.92))!important
    }
    html[data-r270-eye="yellow"] .control-center-logo .logo-ok{
      filter:brightness(1.50) saturate(2.52) sepia(.48) hue-rotate(-18deg) contrast(1.10)
        drop-shadow(0 0 15px rgba(255,248,190,.99))
        drop-shadow(0 0 38px rgba(255,188,40,.97))
        drop-shadow(0 0 60px rgba(255,220,82,.92))!important
    }
    html[data-r270-eye="green"] .control-center-logo .logo-ok{
      filter:brightness(1.24) saturate(1.62)
        drop-shadow(0 0 14px rgba(168,255,209,.98))
        drop-shadow(0 0 36px rgba(31,255,150,.86))
        drop-shadow(0 0 56px rgba(86,255,177,.78))!important
    }
    html[data-r270-eye="red"] .control-center-logo .logo-ok{
      filter:brightness(1.24) saturate(2.28) hue-rotate(238deg) contrast(1.09)
        drop-shadow(0 0 15px rgba(255,142,153,.98))
        drop-shadow(0 0 38px rgba(255,39,68,.84))
        drop-shadow(0 0 60px rgba(255,70,91,.78))!important
    }
  `;
  document.head.appendChild(style);

  const has=(node,status)=>Boolean(node?.classList.contains(`is-${status}`));
  const touched=node=>Boolean(node)&&/\bis-(?:running|done|warn|error|skipped)\b/.test(node.className);
  const updateColor=()=>{
    const stages=document.getElementById('siteUpdateStages');
    if(!stages)return 'green';
    const items=[...stages.querySelectorAll('[data-stage]')];
    const step=name=>stages.querySelector(`[data-stage="${name}"]`);
    const check=step('check'), backup=step('backup'), commit=step('commit'), release=step('release'), deploy=step('deploy'), protect=step('protect');
    const result=document.getElementById('siteUpdateResultState');
    const msg=`${result?.textContent||''} ${document.getElementById('siteUpdateDeployMessage')?.textContent||''} ${document.getElementById('siteUpdateResultText')?.textContent||''}`;
    if(items.some(x=>has(x,'error'))||result?.classList.contains('is-error')||/ошиб|сбой|failed|failure|критичес|неуда/i.test(msg))return 'red';
    if(has(protect,'running')||has(protect,'done')||has(protect,'warn'))return has(protect,'warn')?'red':'blue';
    const protectUntouched=protect&&!touched(protect);
    if(has(deploy,'running')||has(deploy,'warn')||(has(deploy,'done')&&protectUntouched))return 'yellow';
    if([check,backup,commit,release].some(x=>touched(x)))return 'green';
    return 'green';
  };
  const sync=()=>{
    if(isBlueAdmin){
      root.dataset.r270Eye='blue';
      root.dataset.andrikSectionLock='blue';
      root.dataset.andrikHeaderState='blue';
      return;
    }
    if(isUpdate){
      const color=updateColor();
      root.dataset.r270Eye=color;
      root.dataset.andrikHeaderState=color;
    }
  };
  sync();
  if(isBlueAdmin||isUpdate){
    const target=isUpdate?(document.getElementById('siteUpdateStages')||body):root;
    new MutationObserver(sync).observe(target,{subtree:true,childList:true,attributes:true,attributeFilter:['class','data-andrik-header-state','data-andrik-section-lock']});
    window.addEventListener('pageshow',sync,{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();},{passive:true});
    [100,400,1000,2000].forEach(ms=>setTimeout(sync,ms));
  }
})();
