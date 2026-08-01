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

  const broadcast=visible=>{
    const detail={visible,source:'service-settings'};
    window.dispatchEvent(new CustomEvent('andrik-mini-player-visibility',{detail}));
    try{
      const channel=new BroadcastChannel('andrik-control-ui');
      channel.postMessage({type:'mini-player-visibility',visible});
      channel.close();
    }catch(_){}
    try{
      window.top?.postMessage?.({type:'andrik-mini-player-visibility',visible},location.origin);
    }catch(_){}
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
})();