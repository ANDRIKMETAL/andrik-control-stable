(()=>{
'use strict';
const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const box=q('#radioAudioSyncR949'); if(!box)return;
const buttons=all('[data-audio-delay-r949]'),current=q('[data-audio-sync-current-r949]'),msg=q('[data-audio-sync-msg-r949]');
const slider=q('[data-audio-delay-slider-r972]'),nudges=all('[data-audio-delay-nudge-r972]');
let applying=false,lastMs=0,fullRange=false;
const clamp=v=>Math.max(-2000,Math.min(2000,Math.round((Number(v)||0)/50)*50));
const fmt=value=>{const ms=Number(value)||0;return ms>0?`+${ms}`:ms<0?`−${Math.abs(ms)}`:'0';};
function setDisabled(v){buttons.forEach(b=>b.disabled=v||(!fullRange&&Math.abs(Number(b.dataset.audioDelayR949))>500));nudges.forEach(b=>b.disabled=v);if(slider){slider.disabled=v;slider.min=fullRange?'-2000':'-500';slider.max=fullRange?'2000':'500';}}
function paint(ms){ms=clamp(ms);lastMs=ms;current.textContent=`${fmt(ms)} ms`;if(slider)slider.value=String(ms);buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.audioDelayR949)===ms));}
function message(text,kind=''){msg.textContent=text;msg.dataset.kind=kind;}
async function api(path,opts={}){const r=await fetch(path,{...opts,credentials:'include',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache',...(opts.headers||{})}});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(d?.error||d?.message||`HTTP ${r.status}`),{data:d,status:r.status});return d;}
function agentSupportsR972(ver){const m=String(ver||'').match(/R(\d+)/i);return Boolean(m&&Number(m[1])>=972);}
async function status(){const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());const ver=String(d?.agent?.version||'');fullRange=agentSupportsR972(ver);const ms=d?.agent?.status?.audioDelayMsR949;if(Number.isFinite(Number(ms)))paint(Number(ms));if(!/R\d+/i.test(ver)){message(`VPS Agent ${ver||'—'} · нет совместимого агента`,'warn');setDisabled(true);}else if(!applying){setDisabled(false);message(fullRange?`Активно: ${fmt(lastMs)} ms · R972 ±2000 ms · применяется к следующему клипу/заставке`:`VPS Agent ${ver} · пока доступно только ±500 ms. Установи VPS R972 для диапазона ±2000 ms.`,'warn');}return d;}
async function waitResult(id,ms){const until=Date.now()+300000;while(Date.now()<until){await new Promise(r=>setTimeout(r,1800));const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now());const result=d?.result;if(result?.id===id){if(!result.ok)throw new Error(result.output||'VPS returned error');paint(ms);return result;}if(d?.command?.id===id&&d.command.state==='error')throw new Error('Команда завершилась ошибкой');}throw new Error('VPS не подтвердил применение за 5 минут');}
async function apply(ms){ms=clamp(ms);if(!fullRange&&Math.abs(ms)>500){message('⚠️ Сначала установи VPS R972 — старый агент принимает только ±500 ms.','warn');return;}if(applying)return;applying=true;setDisabled(true);message(`Применяю ${fmt(ms)} ms… радио НЕ перезапускается`,'busy');try{const d=await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'audio-delay',delayMs:ms})});await waitResult(d?.command?.id,ms);message(`✅ ${fmt(ms)} ms применено. Проверяй СЛЕДУЮЩУЮ заставку/клип.`,'ok');}catch(e){message(e?.data?.error==='command-busy'?'⚠️ VPS занят другой командой. Подожди и нажми ещё раз.':`❌ ${e.message||e}`,'error');}finally{applying=false;setDisabled(false);status().catch(()=>{});}}
buttons.forEach(b=>b.addEventListener('click',()=>apply(Number(b.dataset.audioDelayR949))));
nudges.forEach(b=>b.addEventListener('click',()=>apply(lastMs+Number(b.dataset.audioDelayNudgeR972||0))));
if(slider){slider.addEventListener('input',()=>paint(Number(slider.value)));slider.addEventListener('change',()=>apply(Number(slider.value)));}
status().catch(e=>message(`Нет связи с VPS: ${e.message||e}`,'error'));setInterval(()=>{if(!applying)status().catch(()=>{})},15000);
})();
