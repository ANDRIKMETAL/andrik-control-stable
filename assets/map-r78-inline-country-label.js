(()=>{
  'use strict';
  if(window.__andrikR78InlineCountryLabelReady)return;
  window.__andrikR78InlineCountryLabelReady=true;

  const map=document.getElementById('worldMap');
  if(!map)return;

  const decode=value=>{
    try{return decodeURIComponent(String(value||''))}
    catch(_){return String(value||'')}
  };
  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const countryToFlag=code=>{
    const cc=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(cc))return '🌍';
    return String.fromCodePoint(...[...cc].map(char=>127397+char.charCodeAt(0)));
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  let activeCountry='';
  let activeCode='';
  let followRaf=0;
  let followUntil=0;

  function markerByCountry(country){
    const wanted=String(country||'').trim();
    if(!wanted)return null;
    return [...map.querySelectorAll('.world-map-dot[data-country]')]
      .find(marker=>decode(marker.dataset.country).trim()===wanted)||null;
  }

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,.world-map-dot[aria-current="true"]');
  }

  function ensureLabel(){
    let node=document.getElementById('landscapeCountryLabelR78');
    if(!node){
      node=document.createElement('button');
      node.type='button';
      node.id='landscapeCountryLabelR78';
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
      node.setAttribute('aria-label','Вернуться к общей карте мира');
      node.setAttribute('title','Вернуться к общей карте мира');
      node.innerHTML='<span class="r78-country-flag" aria-hidden="true"></span><span class="r78-country-name"></span>';
      map.appendChild(node);
    }else if(node.parentElement!==map){
      map.appendChild(node);
    }
    return node;
  }

  function hide(){
    const node=ensureLabel();
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
  }

  function activate(country,code=''){
    activeCountry=String(country||'').trim();
    activeCode=String(code||'').trim().toUpperCase();
    if(!activeCountry){
      hide();
      return;
    }
    follow(1300);
  }

  function currentSelection(){
    let marker=markerByCountry(activeCountry);
    let country=activeCountry;

    if(!marker){
      marker=selectedMarker();
      country=marker?decode(marker.dataset.country).trim():'';
    }

    if(!marker||!country)return null;
    const code=String(activeCode||marker.dataset.code||'').trim().toUpperCase();
    return {marker,country,code};
  }

  function update(){
    const node=ensureLabel();
    if(!isLandscape())return hide();

    const current=currentSelection();
    if(!current)return hide();

    const flag=countryToFlag(current.code||current.marker.dataset.code||'');
    node.querySelector('.r78-country-flag').textContent=flag;
    node.querySelector('.r78-country-name').textContent=current.country;
    node.hidden=false;
    node.setAttribute('aria-hidden','false');

    const markerRect=current.marker.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const labelWidth=Math.max(70,node.offsetWidth||150);
    const labelHeight=Math.max(20,node.offsetHeight||24);

    const rawLeft=(markerRect.left-mapRect.left)+(markerRect.width/2);
    const half=labelWidth/2;
    const left=clamp(rawLeft,12+half,mapRect.width-12-half);

    let top=(markerRect.bottom-mapRect.top)+10;
    if(top+labelHeight>mapRect.height-7){
      top=Math.max(7,(markerRect.top-mapRect.top)-labelHeight-9);
    }

    node.style.setProperty('left',`${left.toFixed(1)}px`,'important');
    node.style.setProperty('top',`${top.toFixed(1)}px`,'important');
  }

  function follow(ms=900){
    followUntil=Math.max(followUntil,performance.now()+ms);
    if(followRaf)return;
    const tick=now=>{
      update();
      if(now<followUntil)followRaf=requestAnimationFrame(tick);
      else followRaf=0;
    };
    followRaf=requestAnimationFrame(tick);
  }

  function rememberTarget(target){
    const marker=target?.closest?.('.world-map-dot[data-country]');
    if(!marker)return false;
    activate(decode(marker.dataset.country).trim(),marker.dataset.code||'');
    return true;
  }

  /* Capture the newly touched country before delayed old selected classes can interfere. */
  document.addEventListener('pointerdown',event=>{
    if(isLandscape())rememberTarget(event.target);
  },true);

  document.addEventListener('click',event=>{
    if(isLandscape())rememberTarget(event.target);
  },true);

  window.addEventListener('andrik:country-focus-changed',event=>{
    const detail=event?.detail||{};
    if(detail.focused&&detail.country){
      const country=String(detail.country).trim();
      const marker=markerByCountry(country);
      activate(country,marker?.dataset?.code||'');
    }else{
      activate('','');
    }
  });


  function goWorldR371(event){
    if(!isLandscape())return;
    event?.preventDefault?.();
    event?.stopPropagation?.();

    const runtime=window.__andrikWorldMapRuntime;
    if(runtime?.goWorld){
      runtime.goWorld();
    }else if(runtime?.clearSelection){
      runtime.clearSelection();
    }else{
      window.dispatchEvent(new CustomEvent('andrik:country-focus-changed',{
        detail:{focused:false,country:''}
      }));
    }

    activeCountry='';
    activeCode='';
    hide();

    setTimeout(()=>{
      const node=ensureLabel();
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
    },20);
  }

  const labelButton=ensureLabel();
  labelButton.addEventListener('pointerdown',event=>{
    if(!isLandscape())return;
    event.stopPropagation();
  },true);
  labelButton.addEventListener('click',goWorldR371,true);
  labelButton.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){
      goWorldR371(event);
    }
  },true);

  const observer=new MutationObserver(()=>{
    if(activeCountry)follow(500);
    else update();
  });
  observer.observe(map,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style','aria-current','data-focus-country']});

  window.addEventListener('resize',()=>follow(400),{passive:true});
  window.addEventListener('orientationchange',()=>{
    setTimeout(update,80);
    setTimeout(()=>follow(500),260);
  },{passive:true});
  window.addEventListener('pageshow',()=>setTimeout(update,120),{passive:true});

  ensureLabel();
  setTimeout(update,300);
  setTimeout(update,900);
})();
