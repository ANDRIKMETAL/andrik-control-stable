(()=>{
  'use strict';
  if(window.__ANDRIK_CITY_R372__) return;
  window.__ANDRIK_CITY_R372__=true;

  const NS='http://www.w3.org/2000/svg';
  const map=document.getElementById('worldMap');
  if(!map) return;

  const CITY_NAMES=new Map(Object.entries({
    'bratislava':'Братислава','košice':'Кошице','kosice':'Кошице',
    'voronezh':'Воронеж','donetsk':'Донецк','dnipro':'Днепр','dnepr':'Днепр',
    'odessa':'Одесса','odesa':'Одесса','mykolaiv':'Николаев','nikolaev':'Николаев',
    'kharkiv':'Харьков','kharkov':'Харьков','kyiv':'Киев','kiev':'Киев',
    'moscow':'Москва','saint petersburg':'Санкт-Петербург','st petersburg':'Санкт-Петербург'
  }));

  const fmt=n=>new Intl.NumberFormat('ru-RU').format(Math.max(0,Number(n||0)));
  const cityName=raw=>{
    const original=String(raw||'').trim();
    if(!original)return 'Город / регион';
    return CITY_NAMES.get(original.toLocaleLowerCase('ru'))||original;
  };
  const countWord=value=>{
    const n=Math.abs(Math.trunc(Number(value||0))),n10=n%10,n100=n%100;
    if(n10===1&&n100!==11)return 'включение';
    if(n10>=2&&n10<=4&&!(n100>=12&&n100<=14))return 'включения';
    return 'включений';
  };

  function labelNode(){
    let node=document.getElementById('countryCityTapLabelR372');
    if(!node){
      node=document.createElement('div');
      node.id='countryCityTapLabelR372';
      node.hidden=true;
      node.setAttribute('aria-live','polite');
      map.appendChild(node);
    }
    return node;
  }

  function showCity(marker){
    if(!marker)return;
    const name=cityName(marker.dataset.city||'');
    const value=Math.max(0,Number(marker.dataset.value||0));
    const node=labelNode();

    map.querySelectorAll('.country-city-marker-r360.is-city-selected-r372')
      .forEach(el=>el.classList.remove('is-city-selected-r372'));
    marker.classList.add('is-city-selected-r372');

    node.textContent=`${name} · ${fmt(value)} ${countWord(value)}`;
    node.hidden=false;
    node.classList.remove('is-hiding-r372');
    requestAnimationFrame(()=>node.classList.add('is-visible-r372'));

    clearTimeout(node.__hideR372);
    clearTimeout(node.__removeR372);
    node.__hideR372=setTimeout(()=>{
      node.classList.remove('is-visible-r372');
      node.classList.add('is-hiding-r372');
      node.__removeR372=setTimeout(()=>{
        node.hidden=true;
        node.classList.remove('is-hiding-r372');
      },360);
    },3200);
  }

  function addAnimate(el,attr,values,dur,begin){
    const a=document.createElementNS(NS,'animate');
    a.dataset.r372=attr;
    a.setAttribute('attributeName',attr);
    a.setAttribute('values',values);
    a.setAttribute('dur',dur);
    a.setAttribute('begin',begin);
    a.setAttribute('repeatCount','indefinite');
    a.setAttribute('calcMode','spline');
    a.setAttribute('keyTimes','0;0.72;1');
    a.setAttribute('keySplines','.16 1 .3 1;.4 0 .6 1');
    el.appendChild(a);
    try{a.beginElement();}catch(_){}
  }

  function setupMarker(marker){
    if(marker.dataset.r372Pulse==='1')return;
    marker.dataset.r372Pulse='1';

    const point=marker.querySelector('.country-city-point-r360');
    const halo=marker.querySelector('.country-city-halo-r360');
    if(!point||!halo)return;

    point.style.setProperty('animation','none','important');
    point.setAttribute('opacity','1');

    halo.querySelectorAll('animate').forEach(a=>a.remove());
    halo.style.setProperty('animation','none','important');
    halo.classList.add('country-city-native-halo-r372');

    const base=Math.max(12,Number(halo.getAttribute('r')||18));
    halo.setAttribute('r',String(base));
    halo.setAttribute('opacity','.78');
    addAnimate(halo,'r',`${base};${(base*2.65).toFixed(1)};${(base*2.85).toFixed(1)}`,'2.45s','0s');
    addAnimate(halo,'opacity','.78;.14;0','2.45s','0s');

    // Second native ring half a cycle behind for a clearly visible continuous pulse.
    const extra=document.createElementNS(NS,'circle');
    extra.classList.add('country-city-native-halo-r372','country-city-native-halo-r372-extra');
    extra.setAttribute('cx',point.getAttribute('cx')||'0');
    extra.setAttribute('cy',point.getAttribute('cy')||'0');
    extra.setAttribute('r',String(base));
    extra.setAttribute('opacity','.58');
    marker.insertBefore(extra,point);
    addAnimate(extra,'r',`${base};${(base*2.45).toFixed(1)};${(base*2.72).toFixed(1)}`,'2.45s','-1.225s');
    addAnimate(extra,'opacity','.58;.10;0','2.45s','-1.225s');
  }

  function sync(){
    map.querySelectorAll('.country-city-marker-r360').forEach(setupMarker);
  }

  // Pointer-up is more reliable than click inside the landscape map gesture layer.
  map.addEventListener('pointerup',event=>{
    const marker=event.target?.closest?.('.country-city-marker-r360');
    if(marker&&map.contains(marker))showCity(marker);
  },true);
  map.addEventListener('click',event=>{
    const marker=event.target?.closest?.('.country-city-marker-r360');
    if(marker&&map.contains(marker))showCity(marker);
  },true);

  new MutationObserver(()=>requestAnimationFrame(sync))
    .observe(map,{subtree:true,childList:true});
  ['andrik:country-deep-changed','andrik:country-focus-changed','andrik:ecosystem-layer-changed','andrik:audience-data']
    .forEach(name=>window.addEventListener(name,()=>requestAnimationFrame(sync),{passive:true}));

  labelNode();
  sync();
})();