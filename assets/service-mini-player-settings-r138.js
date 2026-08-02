(() => {
  'use strict';
  const STORAGE_KEY='andrik-control-mini-player-visible';
  const toggle=document.getElementById('miniPlayerVisibilityToggle');
  const state=document.getElementById('miniPlayerVisibilityState');
  const message=document.getElementById('miniPlayerVisibilityMessage');
  if(!toggle)return;

  const readVisible=()=>{
    try{return localStorage.getItem(STORAGE_KEY)!=='0'}catch(_){return true}
  };

  const applyTopDirect=visible=>{
    try{
      if(window.top===window.self)return false;
      if(window.top.location.origin!==location.origin)return false;
      if(typeof window.top.__ANDRIK_APPLY_MINI_PLAYER_VISIBILITY__==='function'){
        window.top.__ANDRIK_APPLY_MINI_PLAYER_VISIBILITY__(visible);
        return true;
      }
      const doc=window.top.document;
      const dock=doc.getElementById('andrik-control-player-dock');
      doc.documentElement.classList.toggle('andrik-mini-player-hidden',visible===false);
      if(dock){
        dock.classList.toggle('is-user-hidden',visible===false);
        if(visible===false)dock.classList.remove('is-open');
      }
      return Boolean(dock);
    }catch(_){return false}
  };
  const broadcast=visible=>{
    const detail={visible,source:'service-settings-r138'};
    applyTopDirect(visible);
    window.dispatchEvent(new CustomEvent('andrik-mini-player-visibility',{detail}));
    try{
      const channel=new BroadcastChannel('andrik-control-ui');
      channel.postMessage({type:'mini-player-visibility',visible,source:'service-settings-r138'});
      setTimeout(()=>channel.close(),80);
    }catch(_){}
    try{window.top?.postMessage?.({type:'andrik-mini-player-visibility',visible,source:'service-settings-r138'},location.origin)}catch(_){}
  };

  const render=visible=>{
    toggle.checked=visible;
    if(state){
      state.textContent=visible?'Включён':'Выключен';
      state.classList.toggle('is-ready',visible);
      state.classList.toggle('is-warning',!visible);
    }
    if(message){
      message.textContent=visible
        ?'Кнопка видна во всех разделах Control.'
        :'Кнопка и шторка скрыты. Музыка продолжит играть, если уже была запущена.';
    }
  };

  render(readVisible());

  toggle.addEventListener('change',()=>{
    const visible=Boolean(toggle.checked);
    try{localStorage.setItem(STORAGE_KEY,visible?'1':'0')}catch(_){}
    render(visible);
    broadcast(visible);
  });

  window.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY)return;
    render(event.newValue!=='0');
  });

  try{
    const channel=new BroadcastChannel('andrik-control-ui');
    channel.addEventListener('message',event=>{
      if(event.data?.type==='mini-player-visibility')render(event.data.visible!==false);
    });
  }catch(_){}
  const syncNow=()=>{const visible=readVisible();render(visible);broadcast(visible)};
  setTimeout(syncNow,120);
  setTimeout(syncNow,900);
  window.addEventListener('pageshow',syncNow,{passive:true});
})();