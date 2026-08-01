(()=>{
  const $=id=>document.getElementById(id);
  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const params=new URLSearchParams(location.search);
  const commentId=String(params.get('commentId')||'').trim();
  const videoId=String(params.get('videoId')||'').trim();
  let parentId=commentId;
  let commentUrl=videoId?`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&lc=${encodeURIComponent(commentId)}`:'https://www.youtube.com/@andrikmetal';

  const escapeHtml=value=>String(value??'').replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  function readKey(){try{return localStorage.getItem(KEY_LOCAL)||sessionStorage.getItem(KEY_SESSION)||''}catch(_){return''}}
  function saveKey(value){try{sessionStorage.setItem(KEY_SESSION,value);localStorage.setItem(KEY_LOCAL,value)}catch(_){}}
  function status(text,type=''){const el=$('youtubeReplyStatus');if(!el)return;el.textContent=text;el.className=`reply-status${type?` is-${type}`:''}`}
  function authHeaders(){const key=readKey();return key?{authorization:`Bearer ${key}`}:{}}
  async function api(url,options={}){
    const headers={accept:'application/json',...authHeaders(),...(options.headers||{})};
    const response=await fetch(url,{cache:'no-store',...options,headers});
    const data=await response.json().catch(()=>({}));
    if(response.status===401){
      const entered=prompt('Введите ключ администратора Control');
      if(entered){saveKey(entered.trim());return api(url,options)}
    }
    if(!response.ok)throw new Error(data.error||`HTTP ${response.status}`);
    return data;
  }
  async function load(){
    if(!commentId){$('youtubeReplyComment').innerHTML='<div class="admin-empty">В уведомлении отсутствует ID комментария.</div>';status('Откройте комментарий через YouTube.','error');return}
    try{
      const data=await api(`/api/control/youtube-comment?commentId=${encodeURIComponent(commentId)}`);
      const item=data.comment||{};
      parentId=item.parentId||item.id||commentId;
      commentUrl=item.url||commentUrl;
      $('youtubeReplyOpen').href=commentUrl;
      $('youtubeReplyComment').innerHTML=`<strong>💬 ${escapeHtml(item.author||'Зритель YouTube')}</strong><p>${escapeHtml(item.text||'Комментарий без текста')}</p><span class="reply-meta">${escapeHtml(item.publishedAt||'')}</span>`;
      setTimeout(()=>$('youtubeReplyText')?.focus(),120);
    }catch(error){
      $('youtubeReplyComment').innerHTML=`<div class="admin-empty">Не удалось загрузить комментарий: ${escapeHtml(error.message)}</div>`;
      status('Проверьте подключение YouTube Studio в Control.','error');
    }
  }
  async function send(){
    const text=String($('youtubeReplyText')?.value||'').trim();
    if(!text){status('Сначала напишите ответ.','error');$('youtubeReplyText')?.focus();return}
    const button=$('youtubeReplySend');
    button.disabled=true;button.textContent='Публикуем…';status('Отправляем ответ в YouTube…');
    try{
      await api('/api/control/youtube-comment/reply',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({commentId,parentId,videoId,text})
      });
      status('✅ Ответ опубликован от канала ANDRIK.','success');
      button.textContent='Ответ опубликован';
      $('youtubeReplyText').disabled=true;
    }catch(error){
      status(`Не удалось опубликовать: ${error.message}`,'error');
      button.disabled=false;button.textContent='Опубликовать ответ';
    }
  }
  $('youtubeReplySend')?.addEventListener('click',send);
  $('youtubeReplyText')?.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter')send()});
  load();
})();
