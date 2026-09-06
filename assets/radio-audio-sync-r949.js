(()=>{
'use strict';
const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const box=q('#radioAudioSyncR949'); if(!box)return;
const buttons=all('[data-audio-delay-r949]'),current=q('[data-audio-sync-current-r949]'),msg=q('[data-audio-sync-msg-r949]');
let applying=false;
function paint(ms){ms=Number(ms)||0;current.textContent=`${ms} ms`;buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.audioDelayR949)===ms));}
function message(text,kind=''){msg.textContent=text;msg.dataset.kind=kind;}
async function api(path,opts={}){const r=await fetch(path,{...opts,credentials:'include',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d?.error||d?.message||`HTTP ${r.status}`),{data:d,status:r.status});return d;}
async function status(){const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());const ver=String(d?.agent?.version||'');const ms=d?.agent?.status?.audioDelayMsR949;if(Number.isFinite(Number(ms)))paint(Number(ms));if(!/R(?:949|95\d|9[6-9]\d)/i.test(ver)){message(`VPS Agent ${ver||'—'} · сначала установи R949`,'warn');buttons.forEach(b=>b.disabled=true);}else if(!applying){buttons.forEach(b=>b.disabled=false);message(`Активно: +${Number(ms)||0} ms · следующий клип/заставка · без рестарта`,'ok');}return d;}
async function waitResult(id,ms){const until=Date.now()+300000;while(Date.now()<until){await new Promise(r=>setTimeout(r,1800));const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());const result=d?.result;if(result?.id===id){if(!result.ok)throw new Error(result.output||'VPS returned error');paint(ms);return result;}if(d?.command?.id===id&&d.command.state==='error')throw new Error('Команда завершилась ошибкой');}throw new Error('VPS не подтвердил применение за 5 минут');}
async function apply(ms){if(applying)return;applying=true;buttons.forEach(b=>b.disabled=true);message(`Применяю +${ms} ms… радио НЕ перезапускается`,'busy');try{const d=await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'audio-delay',delayMs:ms})});await waitResult(d?.command?.id,ms);message(`✅ +${ms} ms применено. Проверяй СЛЕДУЮЩУЮ заставку/клип.`,'ok');}catch(e){message(e?.data?.error==='command-busy'?'⚠️ VPS занят другой командой. Подожди и нажми ещё раз.':`❌ ${e.message||e}`,'error');}finally{applying=false;buttons.forEach(b=>b.disabled=false);status().catch(()=>{});}}
buttons.forEach(b=>b.addEventListener('click',()=>apply(Number(b.dataset.audioDelayR949))));
status().catch(e=>message(`Нет связи с R949: ${e.message||e}`,'error')); setInterval(()=>{if(!applying)status().catch(()=>{})},15000);
})();
