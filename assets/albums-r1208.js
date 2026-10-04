(()=>{'use strict';
const buttons=[...document.querySelectorAll('[data-album-download]')];if(!buttons.length)return;
const lang=(document.documentElement.lang||'ru').toLowerCase();
const copy={
ru:{ready:'⬇ Скачать архив ZIP',wait:'ZIP ещё не создан',size:'ZIP'},
uk:{ready:'⬇ Завантажити ZIP-архів',wait:'ZIP ще не створено',size:'ZIP'},
sk:{ready:'⬇ Stiahnuť ZIP archív',wait:'ZIP ešte nie je vytvorený',size:'ZIP'},
en:{ready:'⬇ Download ZIP archive',wait:'ZIP not created yet',size:'ZIP'}
}[lang]||{ready:'⬇ Download ZIP archive',wait:'ZIP not created yet',size:'ZIP'};
const fmt=n=>{n=Number(n||0);if(!n)return '';const mb=n/1024/1024;return mb>=1024?(mb/1024).toFixed(1)+' GB':mb.toFixed(mb>=100?0:1)+' MB'};
const endpoint=slug=>'/api/music/album-download?album='+encodeURIComponent(slug);
const setReady=(b,slug,z)=>{
b.classList.remove('is-disabled');
b.href=(z&&z.downloadUrl)||endpoint(slug);
b.textContent=copy.ready;
b.setAttribute('aria-disabled','false');
if(slug==='trika')b.setAttribute('download','ANDRIK-TRIKA-MP3-320kbps.zip');
if(z?.size)b.title=`${copy.size}: ${fmt(z.size)}`;else b.title=copy.ready;
};
const setMissing=b=>{
b.classList.add('is-disabled');b.removeAttribute('href');b.removeAttribute('download');
b.setAttribute('aria-disabled','true');b.textContent=copy.wait;
};
buttons.forEach(b=>{
const slug=String(b.dataset.albumDownload||'');
if(slug==='trika')setReady(b,slug,null); else setMissing(b);
});
fetch('/api/music/albums/status',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('HTTP '+r.status))).then(d=>{
const map=new Map((d.albums||[]).map(a=>[a.slug,a]));
buttons.forEach(b=>{
const slug=String(b.dataset.albumDownload||''),a=map.get(slug),z=a?.zip;
if(z?.exists)setReady(b,slug,z);
else if(slug!=='trika')setMissing(b);
});
}).catch(()=>{ });
})();
