(() => {
  'use strict';
  const KEY='andrik-control-mini-player-visible';
  const CHANNEL='andrik-control-ui';
  const toggle=document.getElementById('miniPlayerVisibilityToggle');
  if(!toggle)return;

  const getHostWindow=()=>{
    let current=window;
    while(current.parent&&current.parent!==current){
      try{
        if(current.parent.location.origin!==location.origin)break;
        current=current.parent;
      }catch(_){break}
    }
    return current;
  };

  const readVisible=()=>{
    try{return localStorage.getItem(KEY)!=='0'}catch(_){return true}
  };

  const apply=visible=>{
    const host=getHostWindow();
    try{
      if(host.__ANDRIK_MINI_PLAYER_R141__?.setVisible){
        host.__ANDRIK_MINI_PLAYER_R141__.setVisible(visible);
      }else{
        host.document.documentElement.classList.toggle('andrik-mini-player-hidden',visible===false);
        const dock=host.document.getElementById('andrik-control-mini-r141');
        if(dock){
          dock.classList.toggle('is-user-hidden',visible===false);
          if(visible===false)dock.classList.remove('is-open');
        }
      }
    }catch(_){}
    toggle.checked=visible;
  };

  const publish=visible=>{
    try{localStorage.setItem(KEY,visible?'1':'0')}catch(_){}
    apply(visible);
    try{
      const channel=new BroadcastChannel(CHANNEL);
      channel.postMessage({type:'mini-player-visibility',visible,source:'service-r141'});
      setTimeout(()=>channel.close(),60);
    }catch(_){}
    try{
      window.top.postMessage({type:'andrik-mini-player-visibility',visible,source:'service-r141'},location.origin);
    }catch(_){}
  };

  toggle.addEventListener('change',()=>publish(Boolean(toggle.checked)));
  window.addEventListener('storage',event=>{
    if(event.key===KEY)apply(event.newValue!=='0');
  });

  apply(readVisible());
  setTimeout(()=>apply(readVisible()),250);
  setTimeout(()=>apply(readVisible()),900);
  window.addEventListener('pageshow',()=>apply(readVisible()),{passive:true});
})();