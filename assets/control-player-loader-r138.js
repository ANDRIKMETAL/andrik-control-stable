(() => {
  'use strict';

  const CONTROL_ORIGIN='https://control.andrikmetal.com';
  const KEY='andrik-control-mini-player-visible';

  const readVisible=()=>{
    try{return localStorage.getItem(KEY)!=='0'}catch(_){return true}
  };

  const targetWindow=()=>{
    try{
      if(window.self!==window.top && window.top.location.origin===location.origin)return window.top;
    }catch(_){}
    return window;
  };

  const ensure=()=>{
    const target=targetWindow();
    let doc;
    try{doc=target.document}catch(_){return}

    const visible=readVisible();
    doc.documentElement.classList.toggle('andrik-mini-player-hidden',visible===false);

    if(typeof target.__ANDRIK_APPLY_MINI_PLAYER_VISIBILITY__==='function'){
      target.__ANDRIK_APPLY_MINI_PLAYER_VISIBILITY__(visible);
    }

    const dock=doc.getElementById('andrik-control-player-dock');
    if(dock){
      dock.classList.toggle('is-user-hidden',visible===false);
      return;
    }

    if(!doc.querySelector('link[data-andrik-player-r138]')){
      const link=doc.createElement('link');
      link.rel='stylesheet';
      link.href='/assets/control-player-bridge-r138.css?v=55.00-r138';
      link.dataset.andrikPlayerR138='css';
      doc.head.appendChild(link);
    }

    if(!doc.querySelector('script[data-andrik-player-r138]')){
      const script=doc.createElement('script');
      script.src='/assets/control-player-bridge-r138.js?v=55.00-r138';
      script.defer=true;
      script.dataset.andrikPlayerR138='js';
      doc.head.appendChild(script);
    }
  };

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensure,{once:true});
  }else{
    ensure();
  }

  window.addEventListener('pageshow',ensure,{passive:true});
  window.addEventListener('focus',ensure,{passive:true});
  window.addEventListener('storage',event=>{
    if(event.key===KEY)ensure();
  });

  try{
    const channel=new BroadcastChannel('andrik-control-ui');
    channel.addEventListener('message',event=>{
      if(event.data?.type==='mini-player-visibility')ensure();
    });
  }catch(_){}

  window.setInterval(ensure,1500);
})();