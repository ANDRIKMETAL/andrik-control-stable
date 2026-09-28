/* ANDRIK R1199 — hard muted hero autoplay + clean radio titles + compact default radio art. */
(()=>{'use strict';
if(!document.body.classList.contains('home-r1190'))return;
const lang=(document.documentElement.lang||'ru').split('-')[0],T={
ru:{play:'▶ Слушать',pause:'Ⅱ Пауза',error:'Не удалось включить песню. Открой альбом или попробуй ещё раз.',live:'Сейчас в эфире',radio:'ANDRIK METAL RADIO',offline:'Эфир сейчас недоступен',unknown:'Статус эфира временно недоступен',pending:'Название песни уточняется',next:'Далее: ',open:'Открыть эфир на YouTube'},
en:{play:'▶ Listen',pause:'Ⅱ Pause',error:'Could not play this song. Open the album or try again.',live:'On air now',radio:'ANDRIK METAL RADIO',offline:'The stream is currently unavailable',unknown:'Live status is temporarily unavailable',pending:'Checking the current song',next:'Next: ',open:'Open the stream on YouTube'},
uk:{play:'▶ Слухати',pause:'Ⅱ Пауза',error:'Не вдалося ввімкнути пісню. Відкрий альбом або спробуй знову.',live:'Зараз в ефірі',radio:'ANDRIK METAL RADIO',offline:'Ефір зараз недоступний',unknown:'Статус ефіру тимчасово недоступний',pending:'Уточнюємо назву пісні',next:'Далі: ',open:'Відкрити ефір на YouTube'},
sk:{play:'▶ Počúvať',pause:'Ⅱ Pozastaviť',error:'Skladbu sa nepodarilo spustiť. Otvor album alebo skús znova.',live:'Práve hrá',radio:'ANDRIK METAL RADIO',offline:'Vysielanie je teraz nedostupné',unknown:'Stav vysielania je dočasne nedostupný',pending:'Overujeme názov skladby',next:'Ďalej: ',open:'Otvoriť vysielanie na YouTube'}
}[lang]||null;
const t=T||{play:'▶ Listen',pause:'Ⅱ Pause',error:'Could not play.',radio:'ANDRIK METAL RADIO',unknown:'Live status unavailable',pending:'Checking current song',next:'Next: ',offline:'Stream unavailable',open:'Open on YouTube'};
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection;
const hero=document.querySelector('.h-hero'),video=document.getElementById('homeHeroVideo'),toggle=document.getElementById('heroMotionToggle');
let heroVisible=true,manualPause=false,manualPlay=false,radioVisible=false,radioTimer=0,radioBusy=false,radioController=null,heroRetryTimer=0,heroLastTime=-1,heroStallCount=0;
function primeHeroVideo(){
 if(!video)return;
 const src='/assets/lyra-hero-r1192.mp4';
 if(src&&!video.getAttribute('src'))video.src=src;
 video.preload='auto';
 video.muted=true;video.defaultMuted=true;
 video.setAttribute('muted','');
 video.setAttribute('playsinline','');
 video.setAttribute('autoplay','');
}
function retryHeroVideo(delay=240){
 clearTimeout(heroRetryTimer);
 heroRetryTimer=setTimeout(()=>{if(heroVisible&&!document.hidden&&motionAllowed())syncHero()},delay);
}
const coverByAlbum={'silent':'silent-cover-r1159.webp','beyond':'beyond-cover-r601.webp','trika':'trika-third-album-cover-r479.webp','ocean':'ocean-cover-v5148-clean.webp','illusion-of-life':'illusion-of-life-static-v52.jpg'};
const norm=s=>String(s||'').toLowerCase().replace(/ё/g,'е').replace(/\.(mp3|wav)$/i,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const artByTitle=new Map();
const safeURL=(raw,hosts)=>{try{const u=new URL(raw,location.href);return (u.protocol==='https:'||u.origin===location.origin)&&hosts.includes(u.hostname)?u.href:''}catch{return ''}};
async function getJSON(url,signal){const c=signal?null:new AbortController(),timer=c?setTimeout(()=>c.abort(),8000):0;try{const r=await fetch(url,{cache:'no-store',headers:{accept:'application/json'},signal:signal||c.signal});if(!r.ok)throw Error('HTTP '+r.status);const d=await r.json();if(d.ok===false)throw Error('unavailable');return d}finally{clearTimeout(timer)}}
function motionAllowed(){return !manualPause}
function syncHero(){
 if(!video)return;
 const shouldPlay=!document.hidden&&motionAllowed();
 if(!shouldPlay){video.pause();if(toggle){toggle.textContent='▶';toggle.setAttribute('aria-label',toggle.dataset.playLabel)}return}
 primeHeroVideo();
 video.muted=true;video.defaultMuted=true;video.playsInline=true;
 const attempt=video.play();
 if(attempt?.catch)attempt.catch(()=>{if(toggle){toggle.textContent='▶';toggle.setAttribute('aria-label',toggle.dataset.playLabel)}retryHeroVideo(350)});
}
if(toggle){
 toggle.hidden=false;
 toggle.addEventListener('click',()=>{if(video.paused){manualPause=false;manualPlay=true}else{manualPause=true;manualPlay=false}syncHero()});
}
if(video){
 primeHeroVideo();
 video.addEventListener('loadeddata',()=>{if(!document.hidden&&motionAllowed())syncHero()});
 video.addEventListener('canplay',()=>{if(heroVisible&&!document.hidden&&motionAllowed())syncHero()});
 video.addEventListener('playing',()=>{if(!heroVisible||document.hidden||!motionAllowed()){video.pause();return}video.classList.add('is-ready');if(toggle){toggle.textContent='Ⅱ';toggle.setAttribute('aria-label',toggle.dataset.pauseLabel)}});
 video.addEventListener('pause',()=>{video.classList.remove('is-ready');if(!document.hidden&&motionAllowed()&&!manualPause)retryHeroVideo(180)});
 video.addEventListener('error',()=>{video.classList.remove('is-ready');const src='/assets/lyra-hero-r1192.mp4';setTimeout(()=>{try{video.src=src;video.load();retryHeroVideo(120)}catch(_){/* noop */}},160)});
}
document.addEventListener('pointerdown',()=>{if(manualPause)return;manualPlay=true;syncHero()},{once:true,passive:true});
// R1200 immediate muted autoplay: do not wait for IntersectionObserver.
requestAnimationFrame(()=>syncHero());setTimeout(()=>syncHero(),120);setTimeout(()=>syncHero(),700);
const heroWatchdogR1200=setInterval(()=>{
 if(!video||document.hidden||!motionAllowed())return;
 const now=Number(video.currentTime||0);
 const stalled=video.readyState>=2&&heroLastTime>=0&&Math.abs(now-heroLastTime)<0.03;
 heroLastTime=now;
 if(video.paused||video.readyState<2||stalled){
   video.classList.remove('is-ready');
   heroStallCount++;
   if(heroStallCount>=2){try{video.muted=true;video.defaultMuted=true;video.load()}catch(_){}}
   syncHero();
 }else heroStallCount=0;
},1200);
reduced.addEventListener?.('change',()=>{manualPlay=false;syncHero()});
connection?.addEventListener?.('change',()=>{manualPlay=false;syncHero()});
let lastMeaningfulRadioTitle='',lastMeaningfulNextTitle='';
const isInsertTitle=value=>/^(?:заставка|вставка|спецвставка|идент|джингл|station\b|bumper\b)|(?:\b(?:30|60)\s*мин\b)/i.test(String(value||'').trim());
const meaningfulTitle=value=>{const v=String(value||'').trim();return v&&!isInsertTitle(v)?v:''};
function showRadio(d){
 const card=document.getElementById('radio'),title=document.getElementById('radioTrack'),note=document.getElementById('radioNote'),img=card.querySelector('img');
 const age=d?Date.now()-Date.parse(d.lastSeen||''):Infinity;
 const fresh=!!(d?.online&&Number.isFinite(age)&&age>=-60000&&age<90000);
 const live=fresh&&d.service==='active'&&d.publisher===true&&d.producer===true&&d.transportHealthy!==false&&Number(d.rtmpsEstablishedConnectionsR792)>0;
 card.classList.toggle('is-live',live);
 const current=live?meaningfulTitle(d.current):'';
 const upcoming=Array.isArray(d?.upcoming)?d.upcoming:[];
 const queued=upcoming.find(x=>['track','clip'].includes(String(x?.type||'').toLowerCase())&&meaningfulTitle(x?.title||x?.name));
 const next=live?(meaningfulTitle(queued?.title||queued?.name)||meaningfulTitle(d.next)):'';
 if(current)lastMeaningfulRadioTitle=current;
 if(next&&norm(next)!==norm(current))lastMeaningfulNextTitle=next;
 if(current&&norm(lastMeaningfulNextTitle)===norm(current))lastMeaningfulNextTitle='';
 const shown=current||lastMeaningfulRadioTitle||t.radio;
 title.textContent=live?shown:t.radio;
 const nextShown=next||lastMeaningfulNextTitle;
 note.textContent=live?(nextShown?t.next+nextShown:t.next+t.pending):(!fresh?t.unknown:t.offline);
 note.hidden=false;
 const cover=live?artByTitle.get(norm(shown)):null;
 const src='/assets/'+(cover||'andrik-radio-mini-r1199.webp');if(img.getAttribute('src')!==src)img.src=src;
}
async function pollRadio(){
 clearTimeout(radioTimer);if(!radioVisible||document.hidden||radioBusy)return;radioBusy=true;radioController=new AbortController();const timeout=setTimeout(()=>radioController?.abort(),8000);
 try{const d=await getJSON('/api/public/radio-diagnostics-r803',radioController.signal);if(radioVisible&&!document.hidden)showRadio(d)}catch{if(radioVisible&&!document.hidden)showRadio(null)}finally{clearTimeout(timeout);radioBusy=false;radioController=null;if(radioVisible&&!document.hidden)radioTimer=setTimeout(pollRadio,30000)}
}
const players=new Map();
function attachPlayer(root,track){
 if(!root||root.querySelector('audio'))return;
 const src=safeURL(track.url,['music.andrikmetal.com',location.hostname]);if(!src)return;
 const button=document.createElement('button');button.type='button';button.className='h-button h-secondary h-player-button';button.textContent=t.play;button.setAttribute('aria-label',t.play+' — '+track.title);button.setAttribute('aria-pressed','false');
 const audio=document.createElement('audio');audio.controls=true;audio.preload='none';audio.hidden=true;audio.className='h-native-audio';audio.src=src;audio.setAttribute('aria-label',track.title);
 const error=document.createElement('span');error.className='h-player-error';error.hidden=true;error.setAttribute('role','status');
 root.replaceChildren(button,audio,error);players.set(audio,button);
 function reflect(){button.textContent=audio.paused?t.play:t.pause;button.setAttribute('aria-label',(audio.paused?t.play:t.pause)+' — '+track.title);button.setAttribute('aria-pressed',String(!audio.paused))}
 button.addEventListener('click',async()=>{error.hidden=true;if(!audio.paused){audio.pause();return}audio.hidden=false;try{await audio.play()}catch{error.textContent=t.error;error.hidden=false;reflect()}});
 audio.addEventListener('play',reflect);audio.addEventListener('pause',reflect);audio.addEventListener('ended',reflect);audio.addEventListener('error',()=>{error.textContent=t.error;error.hidden=false;reflect()});
}
document.addEventListener('play',e=>{if(e.target.tagName!=='AUDIO')return;document.querySelectorAll('audio').forEach(a=>{if(a!==e.target&&!a.paused)a.pause()})},true);
let albumsLoaded=false,albumsPending=false;
async function loadAlbums(){if(albumsLoaded||albumsPending)return;albumsPending=true;try{const d=await getJSON('/api/music/albums/status');const albums=Array.isArray(d.albums)?d.albums:[];for(const a of albums)for(const tr of a.tracks||[])if(coverByAlbum[a.slug])artByTitle.set(norm(tr.title),coverByAlbum[a.slug]);document.querySelectorAll('[data-home-pick]').forEach(card=>{const a=albums.find(a=>a.slug===card.dataset.album);const track=a?.tracks?.find(x=>norm(x.title)===norm(card.dataset.homePick));if(track)attachPlayer(card.querySelector('.h-pick-player'),track)});albumsLoaded=true}catch{}finally{albumsPending=false}}
const silentTitles=new Set(['Dance of Deth','Mind Is A Trap','Выбора нет','Жизнь идёт сама','Monument to the Great Void','I Run Away','Вспышка Узнавания','Что есть Истина','No choice','Стирай','Верни меня','Дверь освобождения','Ты проснулся живой','Сила знает путь','You Are Already That','Всё есть Брахман','Ты уже то','You Are The Light','Вне времени','Заветная звезда','Свобода','Тишина','Ты уже достоин','Горячий Асфальт','Полные карманы','Ах эти розы','А я скажу нет'].map(norm));
async function loadNews(){
 await Promise.allSettled([
 (async()=>{const d=await getJSON('/api/music/singles');const tracks=(Array.isArray(d.tracks)?d.tracks:[]).filter(x=>!String(x.key||'').startsWith('covers/')&&!silentTitles.has(norm(x.title||x.name)));tracks.sort((a,b)=>(Date.parse(b.publishedAt||b.uploaded)||0)-(Date.parse(a.publishedAt||a.uploaded)||0));const newest=tracks[0];if(!newest)return;document.getElementById('latestSingleTitle').textContent=newest.title||newest.name||'ANDRIK';attachPlayer(document.getElementById('latestSinglePlayer'),{...newest,title:newest.title||newest.name||'ANDRIK'})})(),
 (async()=>{const d=await getJSON('/api/public/youtube-latest');if(!/^[A-Za-z0-9_-]{11}$/.test(d.latest?.videoId||''))return;const link=document.getElementById('homeLatestVideo'),url='https://www.youtube.com/watch?v='+d.latest.videoId;link.href=url;link.dataset.webUrl=url;document.getElementById('homeVideoTitle').textContent=d.latest.title||'ANDRIK'})()
 ]);
}
if('IntersectionObserver'in window){
 const visibility=new IntersectionObserver(entries=>{for(const e of entries){const n=e.target;n.classList.toggle('is-inview',e.isIntersecting);if(n===hero){heroVisible=e.isIntersecting;if(e.isIntersecting)syncHero()}if(n.id==='radio'){radioVisible=e.isIntersecting;if(radioVisible){loadAlbums();pollRadio()}else{clearTimeout(radioTimer);radioController?.abort()}}if(n.hasAttribute('data-home-reveal')&&e.isIntersecting){n.classList.add('is-revealed');if(n.id==='start')loadAlbums()}}},{threshold:.01});
 document.querySelectorAll('.h-hero,[data-home-observe],.h-breathe,[data-home-reveal]').forEach(n=>visibility.observe(n));
}else{heroVisible=true;radioVisible=true;syncHero();pollRadio();loadAlbums()}
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('is-page-hidden',document.hidden);syncHero();if(document.hidden){clearTimeout(radioTimer);radioController?.abort()}else{pollRadio()}});
window.addEventListener('pagehide',()=>{video?.pause();clearInterval(heroWatchdogR1200);clearTimeout(heroRetryTimer);clearTimeout(radioTimer);radioController?.abort()});
window.addEventListener('pageshow',()=>{syncHero();pollRadio()});
document.body.classList.toggle('is-page-hidden',document.hidden);heroVisible=true;primeHeroVideo();requestAnimationFrame(()=>{syncHero();setTimeout(syncHero,180);setTimeout(syncHero,650);setTimeout(syncHero,1800)});loadNews();
})();
