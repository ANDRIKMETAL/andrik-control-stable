(() => {
  'use strict';

  const BUILD='55.00-r141';
  const MAIN_ORIGIN='https://andrikmetal.com';
  const STORAGE_KEY='andrik-control-mini-player-visible';
  const COOKIE_KEY='andrik_player_state';
  const CHANNEL='andrik-control-ui';

  const getHostWindow=()=>{
    let current=window;
    while(current.parent && current.parent!==current){
      try{
        if(current.parent.location.origin!==location.origin)break;
        current=current.parent;
      }catch(_){break}
    }
    return current;
  };

  const hostWindow=getHostWindow();

  const readVisible=()=>{
    try{return localStorage.getItem(STORAGE_KEY)!=='0'}catch(_){return true}
  };

  const tellHost=visible=>{
    try{
      const api=hostWindow.__ANDRIK_MINI_PLAYER_R141__;
      if(api?.setVisible){
        api.setVisible(visible);
        return true;
      }
      const doc=hostWindow.document;
      doc.documentElement.classList.toggle('andrik-mini-player-hidden',visible===false);
      const dock=doc.getElementById('andrik-control-mini-r141');
      if(dock){
        dock.classList.toggle('is-user-hidden',visible===false);
        if(visible===false)dock.classList.remove('is-open');
        return true;
      }
    }catch(_){}
    return false;
  };

  if(hostWindow!==window){
    const sync=()=>tellHost(readVisible());
    sync();
    window.addEventListener('pageshow',sync,{passive:true});
    window.addEventListener('storage',event=>{
      if(event.key===STORAGE_KEY)sync();
    });
    try{
      const channel=new BroadcastChannel(CHANNEL);
      channel.addEventListener('message',event=>{
        if(event.data?.type==='mini-player-visibility')sync();
      });
    }catch(_){}
    window.setTimeout(sync,250);
    window.setTimeout(sync,900);
    return;
  }

  if(window.__ANDRIK_MINI_PLAYER_R141__){
    window.__ANDRIK_MINI_PLAYER_R141__.setVisible(readVisible());
    return;
  }

  const doc=document;
  const root=doc.documentElement;
  const body=doc.body;
  if(!body)return;

  const icons={
    play:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7Z"/></svg>',
    pause:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h4v14H6Zm8 0h4v14h-4Z"/></svg>',
    prev:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h2v14H6V5Zm3.5 7L19 5v14l-9.5-7Z"/></svg>',
    next:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 5h2v14h-2V5ZM5 5l9.5 7L5 19V5Z"/></svg>',
    expand:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5h2V6.4l4.3 4.3 1.4-1.4L6.4 5H8V3Zm8 0v2h1.6l-4.3 4.3 1.4 1.4L19 6.4V8h2V3h-5ZM9.3 13.3 5 17.6V16H3v5h5v-2H6.4l4.3-4.3-1.4-1.4Zm5.4 0-1.4 1.4 4.3 4.3H16v2h5v-5h-2v1.6l-4.3-4.3Z"/></svg>'
  };

  const readState=()=>{
    try{
      const pair=doc.cookie.split('; ').find(item=>item.startsWith(`${COOKIE_KEY}=`));
      return pair?JSON.parse(decodeURIComponent(pair.slice(COOKIE_KEY.length+1))):{};
    }catch(_){return {}}
  };

  const cleanControlUrl=()=>{
    const url=new URL(location.href);
    ['player-shell','_updated','v'].forEach(key=>url.searchParams.delete(key));
    return url.href;
  };

  const insidePlayer=(()=>{
    if(new URLSearchParams(location.search).get('player-shell')==='1')return true;
    try{return new URL(doc.referrer).origin===MAIN_ORIGIN}catch(_){return false}
  })();

  const playerUrl=(autoplay=false)=>{
    const state=readState();
    const params=new URLSearchParams({
      lang:'ru',
      control:'1',
      site:cleanControlUrl(),
      resume:'1'
    });
    if(state.collection)params.set('collection',state.collection);
    if(autoplay)params.set('autoplay','1');
    return `${MAIN_ORIGIN}/player.html?${params.toString()}`;
  };

  doc.getElementById('andrik-control-player-dock')?.remove();
  doc.getElementById('andrik-control-mini-r141')?.remove();

  const dock=doc.createElement('div');
  dock.id='andrik-control-mini-r141';
  dock.innerHTML=`
    <button class="andrik-mini-r141-button" type="button" aria-label="Открыть мини-плеер" aria-expanded="false">
      <span class="andrik-mini-r141-icon">${icons.play}</span>
      <span class="andrik-mini-r141-wave" aria-hidden="true"><i></i><i></i><i></i></span>
    </button>
    <section class="andrik-mini-r141-panel" aria-label="Мини-плеер ANDRIK">
      <div class="andrik-mini-r141-head">
        <img class="andrik-mini-r141-art" src="/assets/andrik-eye-v22-192.png" alt="">
        <div class="andrik-mini-r141-copy">
          <small>ANDRIK PLAYER</small>
          <strong>Открыть музыку</strong>
        </div>
        <button class="andrik-mini-r141-expand" type="button" aria-label="Открыть большой плеер">${icons.expand}</button>
      </div>
      <div class="andrik-mini-r141-progress"><span></span></div>
      <div class="andrik-mini-r141-controls">
        <button data-action="prev" type="button" aria-label="Предыдущий трек">${icons.prev}</button>
        <button data-action="toggle" class="main" type="button" aria-label="Воспроизвести">${icons.play}</button>
        <button data-action="next" type="button" aria-label="Следующий трек">${icons.next}</button>
        <button data-action="open" class="open-label" type="button">Большой плеер</button>
      </div>
    </section>`;
  body.appendChild(dock);

  const button=dock.querySelector('.andrik-mini-r141-button');
  const icon=dock.querySelector('.andrik-mini-r141-icon');
  const panel=dock.querySelector('.andrik-mini-r141-panel');
  const art=dock.querySelector('.andrik-mini-r141-art');
  const collection=dock.querySelector('.andrik-mini-r141-copy small');
  const title=dock.querySelector('.andrik-mini-r141-copy strong');
  const progress=dock.querySelector('.andrik-mini-r141-progress span');
  const toggle=dock.querySelector('[data-action="toggle"]');
  let currentState=readState();

  const setVisible=visible=>{
    const show=visible!==false;
    root.classList.toggle('andrik-mini-player-hidden',!show);
    dock.classList.toggle('is-user-hidden',!show);
    if(!show){
      dock.classList.remove('is-open');
      button.setAttribute('aria-expanded','false');
    }
    return show;
  };

  const setStoredVisible=visible=>{
    try{localStorage.setItem(STORAGE_KEY,visible?'1':'0')}catch(_){}
    setVisible(visible);
    try{
      const channel=new BroadcastChannel(CHANNEL);
      channel.postMessage({type:'mini-player-visibility',visible,source:'r141'});
      window.setTimeout(()=>channel.close(),50);
    }catch(_){}
  };

  const render=next=>{
    currentState={...currentState,...(next||{})};
    const fresh=Date.now()-Number(currentState.updatedAt||0)<20000;
    const playing=Boolean(currentState.playing&&(insidePlayer||fresh));
    button.dataset.playing=playing?'true':'false';
    icon.innerHTML=playing?icons.pause:icons.play;
    toggle.innerHTML=playing?icons.pause:icons.play;
    toggle.setAttribute('aria-label',playing?'Пауза':'Воспроизвести');
    collection.textContent=currentState.collectionName||'ANDRIK PLAYER';
    title.textContent=currentState.title||'Открыть музыку';
    progress.style.width=`${Math.max(0,Math.min(100,Number(currentState.progress||0)*100))}%`;
    if(currentState.artwork)art.src=currentState.artwork;
  };

  const command=type=>{
    if(insidePlayer){
      try{
        window.parent.postMessage({type},MAIN_ORIGIN);
        return;
      }catch(_){}
    }
    location.href=playerUrl(type==='andrik-control-player-toggle');
  };

  button.addEventListener('click',()=>{
    const open=dock.classList.toggle('is-open');
    button.setAttribute('aria-expanded',String(open));
  });
  dock.querySelector('[data-action="toggle"]').addEventListener('click',()=>command('andrik-control-player-toggle'));
  dock.querySelector('[data-action="prev"]').addEventListener('click',()=>command('andrik-control-player-prev'));
  dock.querySelector('[data-action="next"]').addEventListener('click',()=>command('andrik-control-player-next'));
  dock.querySelector('[data-action="open"]').addEventListener('click',()=>command('andrik-control-player-open'));
  dock.querySelector('.andrik-mini-r141-expand').addEventListener('click',()=>command('andrik-control-player-open'));

  doc.addEventListener('pointerdown',event=>{
    if(!dock.classList.contains('is-open')||dock.contains(event.target))return;
    dock.classList.remove('is-open');
    button.setAttribute('aria-expanded','false');
  },{passive:true});

  window.addEventListener('storage',event=>{
    if(event.key===STORAGE_KEY)setVisible(event.newValue!=='0');
  });

  try{
    const channel=new BroadcastChannel(CHANNEL);
    channel.addEventListener('message',event=>{
      if(event.data?.type==='mini-player-visibility'){
        setVisible(event.data.visible!==false);
      }
    });
  }catch(_){}

  window.addEventListener('message',event=>{
    if(event.origin===location.origin && event.data?.type==='andrik-mini-player-visibility'){
      setStoredVisible(event.data.visible!==false);
      return;
    }
    if(event.origin===MAIN_ORIGIN && event.data?.type==='andrik-player-state'){
      render(event.data.state||{});
    }
  });

  window.__ANDRIK_MINI_PLAYER_R141__={
    build:BUILD,
    setVisible,
    setStoredVisible,
    isVisible:()=>!dock.classList.contains('is-user-hidden'),
    dock
  };

  setVisible(readVisible());
  dock.classList.remove('is-open');
  button.setAttribute('aria-expanded','false');
  render(currentState);

  if(insidePlayer){
    const ready=()=>window.parent.postMessage({type:'andrik-control-player-ready',build:BUILD},MAIN_ORIGIN);
    ready();
    window.setTimeout(ready,250);
    window.setTimeout(ready,900);
  }else{
    window.setInterval(()=>render(readState()),1600);
  }
})();