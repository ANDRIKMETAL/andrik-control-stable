export function gameShareUrl(origin=location.origin,locale){const url=new URL('/dreaming-of-lira.html?play=1',origin);if(locale==='en'||locale==='ru')url.searchParams.set('lang',locale);return url.href;}
const css=`
.game1471-share-host{position:relative!important}
.game1471-share{position:absolute;right:12px;top:10px;z-index:5;font-family:system-ui}
.game1471-share>button{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;border-radius:50%!important;padding:10px!important;display:grid!important;place-items:center!important;border:1px solid #b7d7de88!important;background:#102535e8!important;color:#d7f5f1!important;cursor:pointer;touch-action:manipulation}
.game1471-share svg{width:21px;height:21px;display:block;fill:none;stroke:currentColor;stroke-width:1.7}
.game1471-share-menu{position:absolute;right:0;top:50px;box-sizing:border-box;width:min(264px,76vw);padding:10px;border:1px solid #b7d7de88;border-radius:14px;background:#0b1929;box-shadow:0 8px 30px #0008;color:#e0edf3;font:13px/1.4 system-ui}
.game1471-share-menu[hidden]{display:none!important}
.game1471-share-menu button{display:block!important;width:100%!important;min-height:44px!important;margin:4px 0!important;border:1px solid #8ebfc74d!important;border-radius:9px!important;padding:10px!important;background:#1a3043!important;color:#edf9f8!important;text-align:left;cursor:pointer;touch-action:manipulation;font:600 13px system-ui!important}
.game1471-share-menu p{margin:6px 2px!important;font:12px/1.4 system-ui!important;color:#b7cedd!important}
.game1471-share-menu input{display:block;width:100%;box-sizing:border-box;min-height:36px;padding:7px;color:#e6f3fa;background:#06101d;border:1px solid #91b6c766;border-radius:6px;font:11px system-ui;user-select:all}
.game1471-share-menu button[hidden],.game1471-share-menu input[hidden]{display:none!important}
#liraMenu .game1471-share{top:0;right:0}
#liraMenu .lira3d-menu-panel>.lira3d-brand{padding-right:52px;box-sizing:border-box}
`;
export function createGameShare(host,{signal,origin,nav=globalThis.navigator}={}){
 if(!host||host.querySelector('.game1471-share'))return;host.classList.add('game1471-share-host');
 const style=document.createElement('style');style.textContent=css;host.append(style);
 const wrap=document.createElement('div');wrap.className='game1471-share';const button=document.createElement('button');button.type='button';button.title='Поделиться игрой';button.setAttribute('aria-label','Поделиться игрой');button.setAttribute('aria-expanded','false');button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="3"/><circle cx="18" cy="5" r="3"/><circle cx="18" cy="19" r="3"/><path d="M7.7 10.5l7.6-4M7.7 13.5l7.6 4"/></svg>';
 const menu=document.createElement('div');menu.className='game1471-share-menu';menu.hidden=true;menu.setAttribute('aria-label','Поделиться прямой ссылкой');
 const native=document.createElement('button'),copy=document.createElement('button'),status=document.createElement('p'),fallback=document.createElement('input');native.type=copy.type='button';native.textContent='Передать в приложение';copy.textContent='Скопировать ссылку';status.textContent='Ссылка сразу открывает игру.';status.setAttribute('role','status');fallback.type='text';fallback.readOnly=true;fallback.hidden=true;fallback.setAttribute('aria-label','Прямая ссылка на игру');
 const url=gameShareUrl(origin||location.origin,globalThis.window?.AndrikI18n?.locale);fallback.value=url;native.hidden=typeof nav?.share!=='function';menu.append(native,copy,status,fallback);wrap.append(button,menu);host.append(wrap);
 function close(){menu.hidden=true;button.setAttribute('aria-expanded','false');}
 button.addEventListener('click',()=>{const open=menu.hidden;menu.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open){status.textContent='Ссылка сразу открывает игру.';(native.hidden?copy:native).focus?.();}},{signal});
 native.addEventListener('click',async()=>{try{await nav.share({title:'Dreaming of Líra · ANDRIK',text:'Пройди семь миров вместе с Лирой.',url});close();}catch(e){if(e?.name!=='AbortError')status.textContent='Передача недоступна. Можно скопировать ссылку.';}},{signal});
 copy.addEventListener('click',async()=>{
  let ok=false;try{if(nav?.clipboard?.writeText){await nav.clipboard.writeText(url);ok=true;}}catch{}
  if(!ok){fallback.hidden=false;fallback.focus();fallback.select();try{ok=!!document.execCommand?.('copy');}catch{}}
  status.textContent=ok?'Ссылка скопирована.':'Выдели и скопируй ссылку ниже.';if(ok){fallback.hidden=true;copy.textContent='Скопировано ✓';}
 },{signal});
 document.addEventListener('pointerdown',e=>{if(!wrap.contains(e.target))close();},{signal});
 wrap.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close();button.focus?.();}},{signal});
 signal?.addEventListener('abort',()=>{wrap.remove();style.remove();},{once:true});
 return {url,close,button};
}
