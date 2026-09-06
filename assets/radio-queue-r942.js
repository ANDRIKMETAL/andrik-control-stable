(()=>{
'use strict';
const list=document.getElementById('radioQueueListR942');
if(!list)return;
const msg=document.getElementById('radioQueueMsgR942');
const cur=document.getElementById('radioCurrentTitleR942');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=t=>t==='clip'?'🎬':t==='bumper'?'📻':t==='special'?'⚡':'♪';
const fmtDur=v=>{v=Number(v)||0;if(v<=0)return'';const m=Math.floor(v/60),s=Math.floor(v%60);return `${m}:${String(s).padStart(2,'0')}`};
let rows=[],busy=false;
async function api(path,opts={}){const r=await fetch(path,{credentials:'include',cache:'no-store',headers:{accept:'application/json',...(opts.headers||{})},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d.message||d.error||`HTTP ${r.status}`),{status:r.status,data:d});return d;}
function render(){
 if(!rows.length){list.innerHTML='<div class="radio-queue-empty-r942">Очередь пока не получена.</div>';return;}
 list.innerHTML=rows.slice(0,6).map((r,i)=>`<div class="radio-queue-row-r942" data-qrow="${i}"><div class="radio-queue-num-r942">${i+1}</div><div class="radio-queue-icon-r942 radio-queue-type-${esc(r.type)}">${icon(r.type)}</div><div class="radio-queue-copy-r942"><b>${esc(r.title||'Без названия')}</b><small>${esc(r.type==='track'?'ANDRIK':r.type==='clip'?'КЛИП':r.type==='bumper'?'ЗАСТАВКА':'СПЕЦ')}</small></div><div class="radio-queue-dur-r942">${fmtDur(r.duration)}</div><button type="button" class="radio-queue-more-r942" data-qmore="${i}" aria-label="Действия">⋯</button><div class="radio-queue-menu-r942"><button type="button" data-qmove="up" data-qindex="${i}" ${i===0?'disabled':''}>↑ Переместить выше</button><button type="button" data-qmove="down" data-qindex="${i}" ${i>=rows.length-1?'disabled':''}>↓ Переместить ниже</button></div></div>`).join('');
}
async function refresh(){
 try{const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());const s=d?.agent?.status||{};if(cur)cur.textContent=String(s.current||'Радио готово');rows=Array.isArray(s.upcomingR942)?s.upcomingR942.slice(0,6):[];render();}
 catch(e){if(msg)msg.textContent='Очередь: '+e.message;}
}
async function move(index,direction){
 if(busy)return;busy=true;if(msg)msg.textContent='Перемещаю…';
 try{await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'queue-move',offset:index,direction})});if(msg)msg.textContent='✅ Команда отправлена на OVH.';setTimeout(refresh,3500);setTimeout(refresh,8000);}
 catch(e){if(msg)msg.textContent='❌ '+(e.status===409?'OVH выполняет другую команду. Повтори через несколько секунд.':e.message);}
 finally{busy=false;}
}
list.addEventListener('click',e=>{const more=e.target.closest('[data-qmore]');if(more){const row=more.closest('.radio-queue-row-r942');document.querySelectorAll('.radio-queue-row-r942.open').forEach(x=>{if(x!==row)x.classList.remove('open')});row?.classList.toggle('open');return;}const b=e.target.closest('[data-qmove]');if(b&&!b.disabled){const row=b.closest('.radio-queue-row-r942');row?.classList.remove('open');move(Number(b.dataset.qindex)||0,b.dataset.qmove);}});
document.addEventListener('click',e=>{if(!e.target.closest('.radio-queue-row-r942'))document.querySelectorAll('.radio-queue-row-r942.open').forEach(x=>x.classList.remove('open'))});
refresh();setInterval(()=>{if(!document.hidden)refresh()},7000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();
