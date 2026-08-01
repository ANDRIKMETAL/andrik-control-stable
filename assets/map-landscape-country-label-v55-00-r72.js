(()=>{
  'use strict';
  if(window.__andrikR72CountryLabelReady)return;
  window.__andrikR72CountryLabelReady=true;

  const map=document.getElementById('worldMap');
  const list=document.getElementById('worldCountries');
  if(!map||!list)return;

  const isLandscape=()=>window.matchMedia?.('(orientation:landscape)')?.matches===true;
  const onMap=()=>document.body?.dataset?.analyticsPage==='map';
  const decode=v=>{try{return decodeURIComponent(String(v||''))}catch(_){return String(v||'')}};
  const countryToFlag=code=>{
    const cc=String(code||'').trim().toUpperCase();
    if(!/^[A-Z]{2}$/.test(cc))return '🌍';
    return String.fromCodePoint(...[...cc].map(ch=>127397+ch.charCodeAt(0)));
  };
  const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

  function selectedMarker(){
    return map.querySelector('.world-map-dot.is-selected,.world-map-dot[aria-current="true"]');
  }

  function selectedCountry(){
    const direct=String(map.dataset.focusCountry||list.dataset.selectedCountry||'').trim();
    if(direct)return direct;
    const marker=selectedMarker();
    return marker?decode(marker.dataset.country).trim():'';
  }

  function selectedSource(country){
    const all=[...list.querySelectorAll('.world-country-button,.world-country-selected-card')];
    return all.find(node=>decode(node.dataset.country).trim()===country)||null;
  }

  function ensureLabel(){
    let node=document.getElementById('landscapeCountryLabelR72');
    if(!node){
      node=document.createElement('div');
      node.id='landscapeCountryLabelR72';
      node.hidden=true;
      node.setAttribute('aria-hidden','true');
      node.innerHTML='<span class="r72-country-dot" aria-hidden="true"></span><span class="r72-country-flag" aria-hidden="true"></span><span class="r72-country-name"></span>';
      document.body.appendChild(node);
    }
    return node;
  }

  function hide(){
    const node=ensureLabel();
    node.hidden=true;
    node.setAttribute('aria-hidden','true');
    node.style.removeProperty('left');
    node.style.removeProperty('top');
  }

  function update(){
    const label=ensureLabel();
    if(!isLandscape()||!onMap())return hide();

    const marker=selectedMarker();
    const country=selectedCountry();
    if(!marker||!country)return hide();

    const source=selectedSource(country);
    const code=String(source?.dataset?.code||marker?.dataset?.code||'').trim().toUpperCase();
    const flag=(source?.querySelector('.world-country-flag')?.textContent||'').trim()||countryToFlag(code);
    const name=(source?.querySelector('.world-country-name')?.textContent||country).trim()||country;

    label.querySelector('.r72-country-flag').textContent=flag;
    label.querySelector('.r72-country-name').textContent=name;
    label.hidden=false;
    label.setAttribute('aria-hidden','false');

    const markerRect=marker.getBoundingClientRect();
    const mapRect=map.getBoundingClientRect();
    const labelWidth=Math.max(50,label.offsetWidth||140);
    const labelHeight=Math.max(18,label.offsetHeight||22);
    const centerX=markerRect.left+markerRect.width/2;
    const safeHalf=labelWidth/2;
    const left=clamp(centerX,mapRect.left+10+safeHalf,mapRect.right-10-safeHalf);
    let top=markerRect.bottom+12;
    const maxTop=mapRect.bottom-labelHeight-8;
    if(top>maxTop)top=Math.max(mapRect.top+8,markerRect.top-labelHeight-10);
    label.style.setProperty('left',left.toFixed(1)+'px','important');
    label.style.setProperty('top',top.toFixed(1)+'px','important');
  }

  const schedule=()=>{
    clearTimeout(schedule._t1);
    clearTimeout(schedule._t2);
    schedule._t1=setTimeout(update,0);
    schedule._t2=setTimeout(update,120);
  };

  new MutationObserver(schedule).observe(map,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-focus-country','aria-current']});
  new MutationObserver(schedule).observe(list,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-selected-country','aria-pressed','data-country','data-code']});
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class','data-analytics-page']});

  window.addEventListener('resize',schedule,{passive:true});
  window.addEventListener('orientationchange',()=>{setTimeout(update,80);setTimeout(update,260)},{passive:true});
  window.addEventListener('pageshow',schedule,{passive:true});
  window.addEventListener('andrik:country-focus-changed',()=>{setTimeout(update,40);setTimeout(update,220)});
  document.addEventListener('click',event=>{
    if(event.target.closest?.('.world-map-dot,.world-country-button,.world-country-selected-card')){
      setTimeout(update,30);
      setTimeout(update,190);
    }
  },true);

  update();
  setTimeout(update,250);
  setTimeout(update,900);
})();
