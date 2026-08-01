(() => {
  'use strict';
  if (window.__ANDRIK_CONTROL_PLAYER_R132__) return;
  window.__ANDRIK_CONTROL_PLAYER_R132__ = true;

  const MAIN_ORIGIN='https://andrikmetal.com';
  const CONTROL_ORIGIN='https://control.andrikmetal.com';
  const COOKIE='andrik_player_state';
  const VISIBILITY_KEY='andrik-control-mini-player-visible';
  const referrerOrigin=(()=>{try{return new URL(document.referrer).origin}catch(_){return ''}})();
  const insideMainPlayer=window.self!==window.top && referrerOrigin===MAIN_ORIGIN;
  const nestedInsideControl=window.self!==window.top && referrerOrigin===CONTROL_ORIGIN;
  if(nestedInsideControl)return;



  const OWNER_KEY_SESSION='andrik-comments-admin-key';
  const OWNER_KEY_LOCAL='andrik-comments-admin-key-persistent';
  const OWNER_SYNC_STAMP='andrik-owner-session-sync-r132';

  const syncOwnerSession=async()=>{
    let key='';
    try{key=localStorage.getItem(OWNER_KEY_LOCAL)||sessionStorage.getItem(OWNER_KEY_SESSION)||''}catch(_){}
    if(!key)return;
    try{
      const last=Number(localStorage.getItem(OWNER_SYNC_STAMP)||0);
      if(Date.now()-last<6*60*60*1000)return;
    }catch(_){}
    try{
      const response=await fetch('/api/control/owner-session',{
        method:'POST',
        credentials:'include',
        cache:'no-store',
        headers:{authorization:`Bearer ${key}`,accept:'application/json','content-type':'application/json'},
        body:'{}'
      });
      if(response.ok){try{localStorage.setItem(OWNER_SYNC_STAMP,String(Date.now()))}catch(_){}}
    }catch(_){}
  };

  const icons={
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6Zm8 0h4v14h-4Z"/></svg>',
    prev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6V5Zm3.5 7L19 5v14l-9.5-7Z"/></svg>',
    next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2V5ZM5 5l9.5 7L5 19V5Z"/></svg>',
    expand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5h2V6.4l4.3 4.3 1.4-1.4L6.4 5H8V3Zm8 0v2h1.6l-4.3 4.3 1.4 1.4L19 6.4V8h2V3h-5ZM9.3 13.3 5 17.6V16H3v5h5v-2H6.4l4.3-4.3-1.4-1.4Zm5.4 0-1.4 1.4 4.3 4.3H16v2h5v-5h-2v1.6l-4.3-4.3Z"/></svg>'
  };

  const readCookie=()=>{
    try{
      const pair=document.cookie.split('; ').find(item=>item.startsWith(`${COOKIE}=`));
      return pair?JSON.parse(decodeURIComponent(pair.slice(COOKIE.length+1))):null;
    }catch(_){return null}
  };

  const cleanControlUrl=()=>{
    const url=new URL(location.href);
    ['player-shell','_updated','v'].forEach(key=>url.searchParams.delete(key));
    return url.href;
  };

  const playerUrl=(autoplay=false)=>{
    const state=readCookie()||{};
    const params=new URLSearchParams({lang:'ru',control:'1',site:cleanControlUrl(),resume:'1'});
    if(state.collection)params.set('collection',state.collection);
    if(autoplay)params.set('autoplay','1');
    return `${MAIN_ORIGIN}/player.html?${params.toString()}`;
  };

  const dock=document.createElement('div');
  dock.id='andrik-control-player-dock';
  dock.innerHTML=`
    <button id="andrik-control-player-button" type="button" data-playing="false" aria-label="Открыть мини-плеер">
      <span class="andrik-control-player-icon">${icons.play}</span>
      <span class="andrik-player-wave" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <section id="andrik-control-player-panel" aria-label="Мини-плеер ANDRIK">
      <div class="andrik-control-player-head">
        <img class="andrik-control-player-art" alt="" src="/assets/andrik-eye-v22-192.png">
        <div class="andrik-control-player-copy"><small>ANDRIK PLAYER</small><strong>Открыть музыку</strong></div>
        <button class="andrik-control-player-expand" type="button" aria-label="Открыть полный плеер">${icons.expand}</button>
      </div>
      <div class="andrik-control-player-progress"><span></span></div>
      <div class="andrik-control-player-controls">
        <button data-action="prev" type="button" aria-label="Предыдущий трек">${icons.prev}</button>
        <button data-action="toggle" class="main" type="button" aria-label="Воспроизвести">${icons.play}</button>
        <button data-action="next" type="button" aria-label="Следующий трек">${icons.next}</button>
        <button data-action="open" class="open-label" type="button">Большой плеер</button>
      </div>
    </section>`;
  document.body.appendChild(dock);

  const readPlayerVisible=()=>{
    try{return localStorage.getItem(VISIBILITY_KEY)!=='0'}catch(_){return true}
  };
  const applyPlayerVisibility=visible=>{
    const show=visible!==false;
    dock.classList.toggle('is-user-hidden',!show);
    document.documentElement.classList.toggle('andrik-mini-player-hidden',!show);
    if(!show){
      dock.classList.remove('is-open');
      const button=dock.querySelector('#andrik-control-player-button');
      button?.setAttribute('aria-expanded','false');
    }
  };
  applyPlayerVisibility(readPlayerVisible());


  const mainButton=dock.querySelector('#andrik-control-player-button');
  const mainIcon=dock.querySelector('.andrik-control-player-icon');
  const panel=dock.querySelector('#andrik-control-player-panel');
  const art=dock.querySelector('.andrik-control-player-art');
  const collection=dock.querySelector('.andrik-control-player-copy small');
  const title=dock.querySelector('.andrik-control-player-copy strong');
  const progress=dock.querySelector('.andrik-control-player-progress span');
  const toggle=dock.querySelector('[data-action="toggle"]');
  let state=readCookie()||{};

  // R132: всегда начинаем только с круглой кнопки.
  dock.classList.remove('is-open');
  mainButton.setAttribute('aria-expanded','false');
  if(insideMainPlayer)document.documentElement.classList.add('andrik-control-inside-player');

  const render=next=>{
    state={...state,...(next||{})};
    const fresh=Date.now()-Number(state.updatedAt||0)<15000;
    const playing=Boolean(state.playing&&(insideMainPlayer||fresh));
    mainButton.dataset.playing=playing?'true':'false';
    mainIcon.innerHTML=playing?icons.pause:icons.play;
    toggle.innerHTML=playing?icons.pause:icons.play;
    toggle.setAttribute('aria-label',playing?'Пауза':'Воспроизвести');
    collection.textContent=state.collectionName||'ANDRIK PLAYER';
    title.textContent=state.title||'Открыть музыку';
    progress.style.width=`${Math.max(0,Math.min(100,Number(state.progress||0)*100))}%`;
    if(state.artwork)art.src=state.artwork;
    mainButton.setAttribute('aria-label',playing?'Музыка играет — открыть мини-плеер':'Открыть мини-плеер');
  };

  const send=type=>{
    if(insideMainPlayer)window.parent.postMessage({type},MAIN_ORIGIN);
    else location.href=playerUrl(type==='andrik-control-player-toggle');
  };

  mainButton.addEventListener('click',()=>{
    const opened=dock.classList.toggle('is-open');
    mainButton.setAttribute('aria-expanded',String(opened));
  });
  dock.querySelector('[data-action="toggle"]').addEventListener('click',()=>send('andrik-control-player-toggle'));
  dock.querySelector('[data-action="prev"]').addEventListener('click',()=>send('andrik-control-player-prev'));
  dock.querySelector('[data-action="next"]').addEventListener('click',()=>send('andrik-control-player-next'));
  dock.querySelector('[data-action="open"]').addEventListener('click',()=>send('andrik-control-player-open'));
  dock.querySelector('.andrik-control-player-expand').addEventListener('click',()=>send('andrik-control-player-open'));
  document.addEventListener('pointerdown',event=>{
    if(!dock.classList.contains('is-open')||dock.contains(event.target))return;
    dock.classList.remove('is-open');
    mainButton.setAttribute('aria-expanded','false');
  },{passive:true});
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    dock.classList.remove('is-open');
    mainButton.setAttribute('aria-expanded','false');
  });


  const forceClosed=()=>{
    dock.classList.remove('is-open');
    mainButton.setAttribute('aria-expanded','false');
  };
  window.addEventListener('pageshow',forceClosed);
  window.addEventListener('orientationchange',forceClosed);
  window.addEventListener('resize',()=>{
    if(window.matchMedia('(orientation:landscape)').matches) forceClosed();
  },{passive:true});


  document.addEventListener('click',event=>{
    const anchor=event.target?.closest?.('a[href]');
    if(!anchor||anchor.hasAttribute('download'))return;
    let url;try{url=new URL(anchor.href,location.href)}catch(_){return}

    if(url.origin===MAIN_ORIGIN&&url.pathname==='/'){
      event.preventDefault();
      if(insideMainPlayer)send('andrik-control-player-open');
      else location.href=`${MAIN_ORIGIN}/?controlReturn=${encodeURIComponent(cleanControlUrl())}`;
      return;
    }

    if(insideMainPlayer&&url.origin===CONTROL_ORIGIN){
      const current=new URL(location.href);
      if(url.pathname===current.pathname&&url.search===current.search&&url.hash)return;
      event.preventDefault();

      if(url.pathname==='/site-update-admin.html' || url.pathname.startsWith('/cache-reset')){
        url.searchParams.delete('player-shell');
        window.open(url.href,'_top');
        return;
      }

      url.searchParams.set('player-shell','1');
      url.searchParams.set('v','55.00-r132');
      location.href=url.href;
    }
  },true);

  window.addEventListener('storage',event=>{
    if(event.key===VISIBILITY_KEY)applyPlayerVisibility(event.newValue!=='0');
  });

  window.addEventListener('andrik-mini-player-visibility',event=>{
    applyPlayerVisibility(event.detail?.visible!==false);
  });

  try{
    const visibilityChannel=new BroadcastChannel('andrik-control-ui');
    visibilityChannel.addEventListener('message',event=>{
      if(event.data?.type==='mini-player-visibility'){
        applyPlayerVisibility(event.data.visible!==false);
      }
    });
  }catch(_){}

  window.addEventListener('message',event=>{
    if(event.origin===CONTROL_ORIGIN&&event.data?.type==='andrik-mini-player-visibility'){
      applyPlayerVisibility(event.data.visible!==false);
      return;
    }
    if(event.origin!==MAIN_ORIGIN||!event.data)return;
    if(event.data.type==='andrik-player-state')render(event.data.state);
  });
syncOwnerSession();
  render(state);
  if(insideMainPlayer){
    window.parent.postMessage({type:'andrik-control-player-ready'},MAIN_ORIGIN);
  }else{
    window.setInterval(()=>render(readCookie()||{}),1800);
  }
})();
