/* ANDRIK R477 — native fast MP3 library inside album spoilers. Existing main player is untouched. */
(()=>{'use strict';
  const albums=[
    {id:'album-illusion',folder:'albums/illusion-of-life',expected:11},
    {id:'album-ocean',folder:'albums/ocean',expected:10},
    {id:'album-trika',folder:'albums/trika',expected:17}
  ];

  const trikaCanonicalR517=[null,'Персонаж','Плен иллюзий','Другой путь','Вечный покой','Тёмная ночь души','Мир затих','Бессмертный крик','Жидкий, как ртуть','Начало пути','Белый холст','Проснись','Радость бытия','Свет проектора','Сними 3D-очки','Битва теней','I Am','Наблюдатель'];
  const lang=(document.documentElement.lang||'ru').toLowerCase();
  const i18n={
    ru:{open:'Быстро прослушать треки',hint:'Нативный MP3-плеер: мгновенная перемотка, скорость и скачивание.',loading:'Загрузка треков…',download:'Скачать MP3',tracks:'треков',empty:'MP3 этого альбома пока не найдены.',error:'Не удалось загрузить список. Нажми, чтобы повторить.',retry:'Повторить'},
    uk:{open:'Швидко прослухати треки',hint:'Нативний MP3-плеєр: швидке перемотування, швидкість і завантаження.',loading:'Завантаження треків…',download:'Завантажити MP3',tracks:'треків',empty:'MP3 цього альбому поки не знайдено.',error:'Не вдалося завантажити список. Натисни, щоб повторити.',retry:'Повторити'},
    sk:{open:'Rýchlo prehrať skladby',hint:'Natívny MP3 prehrávač: okamžité pretáčanie, rýchlosť a sťahovanie.',loading:'Načítavam skladby…',download:'Stiahnuť MP3',tracks:'skladieb',empty:'MP3 tohto albumu zatiaľ neboli nájdené.',error:'Zoznam sa nepodarilo načítať. Skús znova.',retry:'Skúsiť znova'},
    en:{open:'Quick track preview',hint:'Native MP3 player: instant seeking, playback speed and downloads.',loading:'Loading tracks…',download:'Download MP3',tracks:'tracks',empty:'No MP3 files found for this album yet.',error:'Could not load the list. Tap to retry.',retry:'Retry'}
  }[lang]||null;
  const copy=i18n||{open:'Quick track preview',hint:'Native MP3 player: instant seeking, playback speed and downloads.',loading:'Loading tracks…',download:'Download MP3',tracks:'tracks',empty:'No MP3 files found for this album yet.',error:'Could not load the list. Tap to retry.',retry:'Retry'};
  let libraryPromise=null;
  const normalizeNumber=v=>{const m=String(v||'').match(/\d+/);const n=m?parseInt(m[0],10):0;return Number.isFinite(n)&&n>0?n:0};
  const titleScore=t=>{const title=String(t?.title||'');let s=0;if(/[А-Яа-яЁёІіЇїЄє]/.test(title))s+=100;if(title)s+=20;if(!/^track\s*\d+$/i.test(title.trim()))s+=5;const u=Date.parse(String(t?.uploaded||''));if(Number.isFinite(u))s+=Math.min(4,u/1e15);return s};
  const loadLibrary=()=>{
    if(libraryPromise)return libraryPromise;
    libraryPromise=fetch('/api/music/downloads?ts='+Date.now(),{cache:'no-store'}).then(async r=>{const d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(d.error||('HTTP '+r.status));return Array.isArray(d.tracks)?d.tracks:[]}).catch(e=>{libraryPromise=null;throw e});
    return libraryPromise;
  };
  function selectTracks(all,folder){
    const source=all.filter(t=>String(t.folder||'').toLowerCase()===folder.toLowerCase());
    const numbered=new Map(),loose=[];
    for(const t of source){
      const n=normalizeNumber(t.track);
      if(!n){loose.push(t);continue}
      const cur=numbered.get(n);
      if(!cur||titleScore(t)>titleScore(cur))numbered.set(n,t);
    }
    const picked=[...numbered.entries()].sort((a,b)=>a[0]-b[0]).map(([,t])=>t);
    loose.sort((a,b)=>String(a.title||a.key||'').localeCompare(String(b.title||b.key||''),'ru',{numeric:true,sensitivity:'base'}));
    return picked.concat(loose);
  }
  function makeStatus(text,kind='loading'){
    const el=document.createElement('div');el.className='album-fast-status-r477 '+kind;el.textContent=text;return el;
  }
  function renderTracks(details,def,tracks){
    const body=details.querySelector('.album-fast-body-r477');body.replaceChildren();
    const summaryCount=details.querySelector('.album-fast-summary-count-r477');
    if(summaryCount)summaryCount.textContent=`${tracks.length} ${copy.tracks}`;
    if(!tracks.length){body.appendChild(makeStatus(copy.empty,'empty'));return}
    const card=document.getElementById(def.id),cover=card?.querySelector('.album-art img');
    const intro=document.createElement('div');intro.className='album-fast-intro-r477';
    if(cover){const img=document.createElement('img');img.className='album-fast-cover-r477';img.alt='';img.loading='lazy';img.decoding='async';img.src=cover.currentSrc||cover.getAttribute('src')||'';intro.appendChild(img)}
    const introText=document.createElement('div');introText.className='album-fast-intro-text-r477';
    const albumName=card?.querySelector('.album-name')?.textContent?.trim()||'ANDRIK';
    const strong=document.createElement('strong');strong.textContent=albumName;
    const small=document.createElement('span');small.textContent=copy.hint;
    introText.append(strong,small);intro.appendChild(introText);body.appendChild(intro);
    const list=document.createElement('div');list.className='album-fast-track-list-r477';
    tracks.forEach((t,index)=>{
      const row=document.createElement('section');row.className='album-fast-track-r477';
      const head=document.createElement('div');head.className='album-fast-track-head-r477';
      const num=document.createElement('span');num.className='album-fast-track-num-r477';const n=normalizeNumber(t.track)||index+1;num.textContent=String(n).padStart(2,'0');
      const title=document.createElement('strong');title.className='album-fast-track-title-r477';title.textContent=String(def.folder==='albums/trika'&&trikaCanonicalR517[n]?trikaCanonicalR517[n]:(t.title||t.key?.split('/').pop()?.replace(/\.mp3$/i,'').replace(/[_-]+/g,' ')||`Track ${n}`));
      const download=document.createElement('a');download.className='album-fast-download-r477';download.href='/api/music/download?key='+encodeURIComponent(t.key);download.textContent='⬇ MP3';download.title=copy.download;download.setAttribute('aria-label',`${copy.download}: ${title.textContent}`);
      head.append(num,title,download);
      const audio=document.createElement('audio');audio.className='album-fast-audio-r477';audio.controls=true;audio.preload='metadata';audio.playsInline=true;audio.src=t.url||('https://music.andrikmetal.com/'+t.key);audio.setAttribute('aria-label',title.textContent);
      audio.addEventListener('play',()=>{document.querySelectorAll('.album-fast-audio-r477').forEach(other=>{if(other!==audio&&!other.paused)other.pause()})});
      row.append(head,audio);list.appendChild(row);
    });
    body.appendChild(list);
  }
  async function hydrate(details,def,force=false){
    if(details.dataset.loaded==='1'&&!force)return;
    const body=details.querySelector('.album-fast-body-r477');
    body.replaceChildren(makeStatus(copy.loading));details.dataset.loaded='0';
    try{const all=await loadLibrary();const tracks=selectTracks(all,def.folder);renderTracks(details,def,tracks);details.dataset.loaded='1'}
    catch(e){console.warn('ANDRIK fast album library',e);const box=makeStatus(copy.error,'error');const retry=document.createElement('button');retry.type='button';retry.className='album-fast-retry-r477';retry.textContent=copy.retry;retry.addEventListener('click',()=>hydrate(details,def,true));box.appendChild(retry);body.replaceChildren(box)}
  }
  function mount(def){
    const card=document.getElementById(def.id),info=card?.querySelector('.album-info');if(!info||info.querySelector('.album-fast-library-r477'))return;
    const details=document.createElement('details');details.className='album-fast-library-r477';details.dataset.albumFolder=def.folder;
    const summary=document.createElement('summary');summary.className='album-fast-summary-r477';
    const icon=document.createElement('span');icon.className='album-fast-summary-icon-r477';icon.textContent='🎧';
    const copyBox=document.createElement('span');copyBox.className='album-fast-summary-copy-r477';
    const label=document.createElement('strong');label.textContent=copy.open;
    const count=document.createElement('span');count.className='album-fast-summary-count-r477';count.textContent=`${def.expected} ${copy.tracks}`;
    copyBox.append(label,count);
    const chevron=document.createElement('span');chevron.className='album-fast-chevron-r477';chevron.textContent='⌄';
    summary.append(icon,copyBox,chevron);
    const body=document.createElement('div');body.className='album-fast-body-r477';body.appendChild(makeStatus(copy.loading));
    details.append(summary,body);details.addEventListener('toggle',()=>{if(details.open)hydrate(details,def)});
    info.appendChild(details);
  }
  albums.forEach(mount);
})();
