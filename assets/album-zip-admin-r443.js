/* ANDRIK R443 — R2 album ZIP inspector / builder */
(()=>{'use strict';
  const root=document.getElementById('albumZipCardR443'); if(!root)return;
  const grid=document.getElementById('albumZipGridR443'), status=document.getElementById('albumZipStatusR443'), refresh=document.getElementById('albumZipRefreshR443');
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const size=n=>{n=Number(n||0);if(!n)return '0 Б';const u=['Б','КБ','МБ','ГБ'];let i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`};
  const auth=()=>{const h={};const k=document.getElementById('lyricsAdminKey')?.value?.trim();if(k)h['x-admin-key']=k;return h};
  const setStatus=(t,kind='')=>{status.textContent=t;status.dataset.kind=kind};
  function renderAlbum(a){
    const zip=a.zip||{}, tracks=a.tracks||[], complete=Number(a.trackCount||0)>=Number(a.expectedTracks||0);
    return `<article class="album-zip-item-r443" data-album="${esc(a.slug)}">
      <div><span class="eyeline">ANDRIK · R2</span><strong>${esc(a.label)}</strong></div>
      <div class="album-zip-stats-r443">
        <span class="album-zip-pill-r443 ${complete?'ok':'warn'}">MP3: ${Number(a.trackCount||0)} / ${Number(a.expectedTracks||0)}</span>
        <span class="album-zip-pill-r443">${esc(size(a.totalBytes))}</span>
        <span class="album-zip-pill-r443 ${zip.exists?'ok':'warn'}">ZIP: ${zip.exists?esc(size(zip.size)):'нет'}</span>
      </div>
      <div class="album-zip-tracks-r443">${tracks.length?tracks.map((t,i)=>`<div class="album-zip-track-r443"><span>${esc(String(t.track||i+1).padStart(2,'0'))}. ${esc(t.title||t.key)}</span><span>${esc(size(t.size))}</span></div>`).join(''):'<div class="admin-empty">MP3 не найдены.</div>'}</div>
      <div class="album-zip-actions-r443">
        <button class="btn album-zip-check-r443" type="button">Проверить</button>
        <button class="btn btn-primary album-zip-build-r443" type="button" ${tracks.length?'':'disabled'}>${zip.exists?'↻ Пересобрать ZIP':'📦 Собрать ZIP'}</button>
        <a class="btn album-zip-download-r443" ${zip.exists?`href="${esc(zip.downloadUrl)}"`:'aria-disabled="true"'}>${zip.exists?'⬇ Скачать готовый ZIP':'ZIP ещё не создан'}</a>
      </div>
    </article>`;
  }
  async function load(album=''){
    setStatus(album?'Проверяем альбом в R2…':'Проверяем два альбома в R2…');
    try{
      const url='/api/control/music/albums'+(album?'?album='+encodeURIComponent(album):'');
      const r=await fetch(url,{headers:auth(),cache:'no-store'}),d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.message||d.error||('HTTP '+r.status));
      if(album){const current=grid.querySelector(`[data-album="${CSS.escape(album)}"]`),a=d.albums?.[0];if(current&&a)current.outerHTML=renderAlbum(a)}
      else grid.innerHTML=(d.albums||[]).map(renderAlbum).join('')||'<div class="admin-empty">Альбомы не найдены.</div>';
      const total=(d.albums||[]).reduce((s,a)=>s+Number(a.trackCount||0),0);setStatus(`R2 доступен ✅ Найдено ${total} MP3 в проверенных альбомах.`,'ok');
    }catch(e){setStatus('Ошибка проверки R2: '+e.message,'error');if(!album)grid.innerHTML='<div class="admin-empty">Не удалось прочитать R2.</div>'}
  }
  async function build(album,button){
    if(!album||button.disabled)return;
    const card=button.closest('.album-zip-item-r443');card?.classList.add('is-building');setStatus('Собираем ZIP прямо из MP3 в R2. Файлы не удаляются и не переносятся…');
    try{
      const r=await fetch('/api/control/music/albums/build?album='+encodeURIComponent(album),{method:'POST',headers:auth(),cache:'no-store'}),d=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(d.message||d.error||('HTTP '+r.status));
      setStatus(d.message||'ZIP собран и сохранён в R2 ✅','ok');await load(album);
    }catch(e){setStatus('Ошибка сборки ZIP: '+e.message,'error')}finally{card?.classList.remove('is-building')}
  }
  refresh?.addEventListener('click',()=>load());
  grid?.addEventListener('click',e=>{const card=e.target.closest('[data-album]');if(!card)return;const album=card.dataset.album;if(e.target.closest('.album-zip-check-r443'))load(album);const b=e.target.closest('.album-zip-build-r443');if(b)build(album,b)});
  setTimeout(()=>load(),350);
})();
