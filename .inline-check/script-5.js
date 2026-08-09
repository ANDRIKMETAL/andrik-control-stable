
(function(){
  function hasOwnerKey(){
    try{return !!(localStorage.getItem('andrik-comments-admin-key-persistent')||sessionStorage.getItem('andrik-comments-admin-key'));}
    catch(_){return false;}
  }
  function mapHasData(){
    return !!document.querySelector('#worldMap .world-map-dot, #worldCountries .world-country-button, #worldCountries [data-country], .world-country-button');
  }
  function writeConfirmed(){
    var auth=document.getElementById('analyticsAuthText');
    var current=String(auth&&auth.textContent||'').trim();
    if(!auth||!/Проверяем доступ|обновляем данные/i.test(current))return false;
    if(!hasOwnerKey()||!mapHasData())return false;
    auth.textContent='Доступ подтверждён';
    var strip=document.getElementById('analyticsAuthStrip');
    if(strip)strip.classList.add('is-ready');
    var mirror=document.querySelector('.r83-poster-auth-text');
    if(mirror)mirror.textContent='Доступ подтверждён';
    var poster=document.querySelector('.r83-poster-auth');
    if(poster)poster.classList.add('is-ok');
    return true;
  }
  function begin(){
    var attempts=0;
    var timer=setInterval(function(){
      attempts+=1;
      if(writeConfirmed()||attempts>=20)clearInterval(timer);
    },400);
    writeConfirmed();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});
  else begin();
  window.addEventListener('pageshow',function(){setTimeout(writeConfirmed,250);},{passive:true});
})();
