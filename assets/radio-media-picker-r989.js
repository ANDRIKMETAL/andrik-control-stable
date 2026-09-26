(()=>{'use strict';
const modal=document.getElementById('radioMediaPickerR989');if(!modal)return;
const title=document.getElementById('radioPickerTitleR989'),body=document.getElementById('radioPickerBodyR989'),back=document.getElementById('radioPickerBackR989'),close=document.getElementById('radioPickerCloseR989'),toast=document.getElementById('radioPickerToastR989');
let mode='all',view='all',tracks=[],clips=[],groups=[],activeGroup=null,busy=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,opts={}){const r=await fetch(path,{credentials:'include',cache:'no-store',headers:{accept:'application/json',...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.message||d.error||`HTTP ${r.status}`),{status:r.status,data:d});return d}
// R1161: owner-requested library order for manual NEXT selection.
// Singles and covers are both stored under singles/ in R2, so the picker separates
// them by title without moving or duplicating the source files.
const coverMap={
 singles:'/assets/singles-picker-cover-r1161.webp',
 covers:'/assets/lira-guitar.webp',
 silent:'/assets/silent-picker-cover-r1161.webp',
 beyond:'/assets/beyond-cover-r601.webp',
 trika:'/assets/trika-third-album-cover-r479.webp',
 ocean:'/assets/ocean-cover-v51-crop.webp',
 'illusion-of-life':'/assets/illusion-of-life-static-v52.jpg'
};
const labelMap={singles:'Синглы',covers:'Каверы',silent:'Silent',beyond:'BEYOND',trika:'ТРИКА',ocean:'OCEAN','illusion-of-life':'Illusion of Life'};
const normalizeTitleR1161=v=>String(v||'').replace(/\.[a-z0-9]{2,5}$/i,'').replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim().toLocaleLowerCase('ru-RU');
function isCoverTrackR1161(t){
 const raw=String(t?.title||t?.name||(t?.key||'').split('/').pop()||'');
 const n=normalizeTitleR1161(raw);
 if(n==='а я скажу нет')return true;
 return /(?:^|[\s(\[—–-])(?:ai\s*)?cover(?:$|[\s)\]—–-])|(?:^|[\s(\[—–-])кавер(?:$|[\s)\]—–-])/iu.test(raw);
}
function groupTracks(){
 const m=new Map();
 const ensure=slug=>{if(!m.has(slug))m.set(slug,{slug,label:labelMap[slug]||slug.replace(/[-_]+/g,' '),cover:coverMap[slug]||'/assets/lira-guitar.webp',tracks:[]});return m.get(slug)};
 for(const t of tracks){
   const key=String(t.key||'');
   let slug='singles';
   const a=key.match(/^albums\/([^/]+)\//i);
   if(a)slug=a[1].toLowerCase();
   else if(/^singles\//i.test(key)&&isCoverTrackR1161(t))slug='covers';
   const g=ensure(slug);
   // Official album names may arrive in metadata with different casing; keep the
   // owner-defined card label above, while track rows retain their own title.
   g.tracks.push(t);
 }
 groups=[...m.values()].filter(g=>g.tracks.length);
 const order=['singles','covers','silent','beyond','trika','ocean','illusion-of-life'];
 groups.sort((a,b)=>{const ai=order.indexOf(a.slug),bi=order.indexOf(b.slug);return (ai<0?99:ai)-(bi<0?99:bi)||a.label.localeCompare(b.label,'ru')});
 for(const g of groups)g.tracks.sort((a,b)=>(Number(a.track)||999)-(Number(b.track)||999)||String(a.title||'').localeCompare(String(b.title||''),'ru'));
}
function videoMeta(c){if(Number(c?.bumperSlot||0))return {icon:'📻',label:`ЗАСТАВКА ${Number(c.bumperSlot)}`};if(c?.special60min)return {icon:'⚡',label:'СПЕЦЗАСТАВКА · 60 МИН'};if(c?.special30min)return {icon:'⚡',label:'СПЕЦЗАСТАВКА · 30 МИН'};return {icon:'🎬',label:'КЛИП · ANDRIK'}}
function trackRow(t,groupLabel='ANDRIK'){const sub=groupLabel==='Каверы'?'Каверы':groupLabel==='Синглы'?'Синглы ANDRIK':(t.album||groupLabel);return `<button class="r989-media-row" type="button" data-r989-pick-track="${encodeURIComponent(t.key)}" data-r989-title="${esc(t.title||'')}"><i>♪</i><span class="r989-media-copy"><strong>${esc(t.title||t.key)}</strong><small>${esc(sub)}</small></span><em>СЛЕД.</em></button>`}
function clipRow(c){const m=videoMeta(c);return `<button class="r989-media-row" type="button" data-r989-pick-clip="${encodeURIComponent(c.key)}" data-r989-title="${esc(c.title||'')}"><i>${m.icon}</i><span class="r989-media-copy"><strong>${esc(c.title||c.key)}</strong><small>${esc(m.label)}</small></span><em>СЛЕД.</em></button>`}
function showAlbums(){view='albums';activeGroup=null;title.textContent='Выбрать песню в очередь';back.hidden=true;body.innerHTML=`<p class="r989-picker-note">Выбери раздел или альбом, затем песню. Нажатый трек станет следующим после текущего — эфир не прерывается.</p><div class="r989-album-grid">${groups.map((g,i)=>`<button class="r989-album-card" type="button" data-r989-album="${i}"><img src="${esc(g.cover)}" alt=""><span class="r989-album-copy"><strong>${esc(g.label)}</strong><small>${g.tracks.length} треков</small></span></button>`).join('')}</div>`}
function showGroup(i){activeGroup=groups[i];if(!activeGroup)return;view='songs';title.textContent=activeGroup.label;back.hidden=false;body.innerHTML=`<input id="radioPickerSearchR989" class="r989-picker-search" placeholder="Поиск песни"><div class="r989-media-list" id="radioPickerListR989"></div>`;const q=document.getElementById('radioPickerSearchR989');const render=()=>{const needle=String(q.value||'').trim().toLowerCase();const arr=activeGroup.tracks.filter(x=>!needle||String(x.title||x.key||'').toLowerCase().includes(needle));document.getElementById('radioPickerListR989').innerHTML=arr.map(t=>trackRow(t,activeGroup.label)).join('')||'<div class="r989-picker-loading">Ничего не найдено</div>'};q.addEventListener('input',render);render();setTimeout(()=>q.focus(),80)}
function showClips(){view='clips';title.textContent='Клипы / заставки';back.hidden=mode==='clips';body.innerHTML=`<p class="r989-picker-note">Можно выбрать обычный клип, заставку или спецвставку. Выбранный элемент станет №1 после текущего эфира.</p><input id="radioPickerSearchR989" class="r989-picker-search" placeholder="Найти клип или заставку"><div class="r989-media-list" id="radioPickerListR989"></div>`;const q=document.getElementById('radioPickerSearchR989');const render=()=>{const needle=String(q.value||'').trim().toLowerCase();const arr=clips.filter(x=>!needle||`${x.title||''} ${x.key||''} ${videoMeta(x).label}`.toLowerCase().includes(needle));document.getElementById('radioPickerListR989').innerHTML=arr.map(clipRow).join('')||'<div class="r989-picker-loading">Ничего не найдено</div>'};q.addEventListener('input',render);render();setTimeout(()=>q.focus(),80)}
function showAll(){view='all';title.textContent='Найти и поставить следующим';back.hidden=true;body.innerHTML=`<p class="r989-picker-note">Ищи по всей библиотеке: песни, клипы, заставки и спецвставки. Выбор атомарно становится первым в очереди после текущего элемента.</p><input id="radioPickerSearchR989" class="r989-picker-search" placeholder="Название песни, клипа или заставки"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px"><button type="button" class="r989-media-row" data-r989-browse="tracks" style="grid-template-columns:36px 1fr!important"><i>♪</i><span class="r989-media-copy"><strong>Песни по альбомам</strong><small>${tracks.length} MP3</small></span></button><button type="button" class="r989-media-row" data-r989-browse="clips" style="grid-template-columns:36px 1fr!important"><i>🎬</i><span class="r989-media-copy"><strong>Клипы / заставки</strong><small>${clips.length} видео</small></span></button></div><div class="r989-media-list" id="radioPickerListR989"></div>`;const q=document.getElementById('radioPickerSearchR989');const out=document.getElementById('radioPickerListR989');const render=()=>{const needle=String(q.value||'').trim().toLowerCase();if(!needle){const station=clips.filter(x=>Number(x?.bumperSlot||0)||x?.special30min||x?.special60min);out.innerHTML=(station.length?`<div class="r989-picker-note" style="margin-top:4px">Быстрый выбор заставок:</div>${station.map(clipRow).join('')}`:'<div class="r989-picker-loading">Начни вводить название для поиска по всей библиотеке.</div>');return}const t=tracks.filter(x=>`${x.title||''} ${x.album||''} ${x.key||''}`.toLowerCase().includes(needle)).slice(0,40);const c=clips.filter(x=>`${x.title||''} ${x.key||''} ${videoMeta(x).label}`.toLowerCase().includes(needle)).slice(0,30);out.innerHTML=[...t.map(trackRow),...c.map(clipRow)].join('')||'<div class="r989-picker-loading">Ничего не найдено</div>'};q.addEventListener('input',render);render();setTimeout(()=>q.focus(),80)}
async function loadTracks(){const d=await api('/api/music/downloads?ts='+Date.now());tracks=Array.isArray(d?.tracks)?d.tracks:[];groupTracks()}
async function loadClips(){const d=await api('/api/control/radio-clips-r691?ts='+Date.now());const raw=[...(Array.isArray(d?.clips)?d.clips:[]),...(Array.isArray(d?.builtIn)?d.builtIn:[])];const seen=new Set();clips=raw.filter(x=>{const k=String(x?.key||x?.url||x?.title||'');if(!k||seen.has(k)||Number(x?.size||1)<=0)return false;seen.add(k);return true}).sort((a,b)=>{const rank=x=>x?.special60min?0:x?.special30min?1:Number(x?.bumperSlot||0)?2:3;return rank(a)-rank(b)||Number(a?.bumperSlot||0)-Number(b?.bumperSlot||0)||String(a?.title||'').localeCompare(String(b?.title||''),'ru')})}
async function openPicker(kind){mode=kind||'all';modal.hidden=false;document.body.style.overflow='hidden';body.innerHTML='<div class="r989-picker-loading">Загружаю библиотеку…</div>';title.textContent=mode==='all'?'Выбор эфира':mode==='clips'?'Клипы / заставки':'MP3';back.hidden=true;try{if(mode==='clips'){await loadClips();showClips()}else if(mode==='tracks'){await loadTracks();showAlbums()}else{await Promise.all([loadTracks(),loadClips()]);showAll()}}catch(e){body.innerHTML=`<div class="r989-picker-loading">❌ ${esc(e.message||e)}</div>`}}
function closePicker(){modal.hidden=true;document.body.style.overflow='';busy=false}
async function wait(id){const until=Date.now()+35000;while(Date.now()<until){await new Promise(r=>setTimeout(r,1800));const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());if(d?.result?.id===id&&d.result.finishedAt)return d.result;}throw new Error('VPS не подтвердил очередь')}
async function pick(mediaType,key,titleText,button){if(busy)return;busy=true;if(button){button.disabled=true;const em=button.querySelector('em');if(em)em.textContent='…'}try{const sent=await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'queue-pick-r989',mediaType,key:decodeURIComponent(key),title:titleText||''})});const r=await wait(sent?.command?.id||'');if(!r.ok)throw new Error(String(r.output||'queue failed'));const m=String(r.output||'').match(/R989_QUEUE\s+(\{[\s\S]*\})/);const d=m?JSON.parse(m[1]):{};toast.textContent=d?.alreadyNext?`✅ ${titleText}: уже стоит следующим.`:`✅ ${titleText}: поставлен следующим.`;toast.dataset.kind='ok';closePicker();window.dispatchEvent(new Event('andrik:radio-queue-refresh-r989'));}catch(e){toast.textContent=e?.data?.error==='command-busy'?'⚠ VPS занят другой командой. Повтори через несколько секунд.':`❌ ${e.message||e}`;toast.dataset.kind='bad';if(button){button.disabled=false;const em=button.querySelector('em');if(em)em.textContent='СЛЕД.'}}finally{busy=false}}
document.querySelectorAll('[data-media-picker-open-r989]').forEach(el=>{el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('click',()=>openPicker(el.dataset.mediaPickerOpenR989));el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openPicker(el.dataset.mediaPickerOpenR989)}})});
close.addEventListener('click',closePicker);back.addEventListener('click',()=>{if(mode==='tracks'&&view==='songs')showAlbums();else if(mode==='all'&&view!=='all')showAll();else closePicker()});modal.addEventListener('click',e=>{if(e.target===modal)closePicker()});
body.addEventListener('click',e=>{const browse=e.target.closest('[data-r989-browse]');if(browse){if(browse.dataset.r989Browse==='tracks'){view='albums';showAlbums();back.hidden=false}else showClips();return}const a=e.target.closest('[data-r989-album]');if(a){showGroup(Number(a.dataset.r989Album));return}const t=e.target.closest('[data-r989-pick-track]');if(t){pick('track',t.dataset.r989PickTrack,t.dataset.r989Title,t);return}const c=e.target.closest('[data-r989-pick-clip]');if(c)pick('clip',c.dataset.r989PickClip,c.dataset.r989Title,c)});
})();
