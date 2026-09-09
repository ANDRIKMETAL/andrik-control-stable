(()=>{
'use strict';
const q=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
const box=q('#radioAudioSyncR949'); if(!box)return;
const buttons=all('[data-audio-delay-r949]'),current=q('[data-audio-sync-current-r949]'),msg=q('[data-audio-sync-msg-r949]');
const slider=q('[data-audio-delay-slider-r972]'),nudges=all('[data-audio-delay-nudge-r972]');
let applying=false,lastMs=0,fullRange=false,lastOutcomeAt=0;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const clamp=v=>Math.max(-2000,Math.min(2000,Math.round((Number(v)||0)/50)*50));
const fmt=value=>{const ms=Number(value)||0;return ms>0?`+${ms}`:ms<0?`−${Math.abs(ms)}`:'0';};
function setDisabled(v){buttons.forEach(b=>b.disabled=v||(!fullRange&&Math.abs(Number(b.dataset.audioDelayR949))>500));nudges.forEach(b=>b.disabled=v);if(slider){slider.disabled=v;slider.min=fullRange?'-2000':'-500';slider.max=fullRange?'2000':'500';}}
function paint(ms){ms=clamp(ms);lastMs=ms;current.textContent=`${fmt(ms)} ms`;if(slider)slider.value=String(ms);buttons.forEach(b=>b.classList.toggle('active',Number(b.dataset.audioDelayR949)===ms));}
function message(text,kind=''){msg.textContent=text;msg.dataset.kind=kind;}
function markOutcome(text,kind){lastOutcomeAt=Date.now();message(text,kind);}
async function api(path,opts={},timeoutMs=15000){
  const ctl=new AbortController();
  const timer=setTimeout(()=>ctl.abort(),timeoutMs);
  try{
    const r=await fetch(path,{...opts,signal:ctl.signal,credentials:'include',cache:'no-store',headers:{accept:'application/json','cache-control':'no-cache',...(opts.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw Object.assign(new Error(d?.error||d?.message||`HTTP ${r.status}`),{data:d,status:r.status});
    return d;
  }catch(e){
    if(e?.name==='AbortError')throw Object.assign(new Error('таймаут связи с панелью'),{transient:true,cause:e});
    if(e instanceof TypeError || /Failed to fetch|NetworkError|fetch/i.test(String(e?.message||'')))e.transient=true;
    throw e;
  }finally{clearTimeout(timer);}
}
function agentSupportsR972(ver){const m=String(ver||'').match(/R(\d+)/i);return Boolean(m&&Number(m[1])>=972);}
function stateMs(d){const v=Number(d?.agent?.status?.audioDelayMsR949);return Number.isFinite(v)?clamp(v):null;}
function matchingCommand(d,ms){const c=d?.command;return c&&c.action==='audio-delay'&&Number(c.delayMs)===Number(ms)?c:null;}
async function status({quiet=false}={}){
  const d=await api('/api/control/radio-remote-r627/status?ts='+Date.now(),{},12000);
  const ver=String(d?.agent?.version||'');
  fullRange=agentSupportsR972(ver);
  const ms=stateMs(d); if(ms!==null)paint(ms);
  if(!/R\d+/i.test(ver)){
    if(!quiet)message(`VPS Agent ${ver||'—'} · нет совместимого агента`,'warn');
    setDisabled(true);
  }else if(!applying){
    setDisabled(false);
    // Не затираем только что показанный результат обычным heartbeat-сообщением.
    if(!quiet && Date.now()-lastOutcomeAt>20000){
      message(fullRange?`Активно: ${fmt(lastMs)} ms · VPS R972+ ±2000 ms · применяется к следующему клипу/заставке`:`VPS Agent ${ver} · пока доступно только ±500 ms. Установи VPS R972 для диапазона ±2000 ms.`,'warn');
    }
  }
  return d;
}

// R973: статус может кратко не открыться на телефоне. Это НЕ ошибка команды.
// Игнорируем одиночные сетевые сбои и продолжаем подтверждение по D1/VPS до 5 минут.
async function waitResult(id,ms){
  const until=Date.now()+300000;
  let transient=0;
  while(Date.now()<until){
    await sleep(1800);
    let d;
    try{d=await api('/api/control/radio-remote-r627/status?ts='+Date.now(),{},12000);transient=0;}
    catch(e){
      if(e?.transient){
        transient++;
        message(`📡 VPS работает. Восстанавливаю связь с панелью… попытка ${transient}`,'busy');
        continue;
      }
      throw e;
    }
    const saved=stateMs(d);
    if(saved===ms && (!id || d?.command?.id===id || d?.result?.id===id)){
      paint(ms);
      return {ok:true,recoveredByState:true,id:id||d?.command?.id||d?.result?.id||''};
    }
    const result=d?.result;
    if(id&&result?.id===id){
      if(!result.ok)throw new Error(result.output||'VPS returned error');
      paint(ms);return result;
    }
    if(id&&d?.command?.id===id&&d.command.state==='error')throw new Error('Команда завершилась ошибкой');
  }
  throw new Error('VPS не подтвердил применение за 5 минут');
}

// Если ответ на POST потерялся, команда могла уже попасть в D1 и выполняться на VPS.
// Находим её по action+delayMs или подтверждаем по реальному сохранённому targetMs.
async function recoverLostSubmit(ms){
  const until=Date.now()+300000;
  let attempts=0;
  while(Date.now()<until){
    await sleep(attempts?2200:700); attempts++;
    let d;
    try{d=await api('/api/control/radio-remote-r627/status?ts='+Date.now(),{},12000);}catch(e){if(e?.transient){message(`📡 Ответ потерян, проверяю VPS… ${attempts}`,'busy');continue;}throw e;}
    const saved=stateMs(d);
    if(saved===ms){paint(ms);return {ok:true,applied:true,via:'state'};}
    const c=matchingCommand(d,ms);
    if(c){
      message(`✅ VPS принял ${fmt(ms)} ms. Обработка файлов идёт, жду завершения…`,'busy');
      return await waitResult(c.id,ms);
    }
    // Если уже есть финальный result этой команды, command всё ещё хранит delayMs и state done/error.
    if(d?.command?.action==='audio-delay'&&Number(d.command.delayMs)===ms&&['done','error'].includes(String(d.command.state||''))){
      if(d.command.state==='error')throw new Error(d?.result?.output||'VPS завершил команду с ошибкой');
      if(saved===ms){paint(ms);return {ok:true,applied:true,via:'done-state'};}
    }
    // После нескольких успешных опросов без нашей команды считаем, что POST действительно не дошёл.
    if(attempts>=5)return null;
  }
  return null;
}

async function apply(ms){
  ms=clamp(ms);
  if(!fullRange&&Math.abs(ms)>500){message('⚠️ Сначала установи VPS R972 — старый агент принимает только ±500 ms.','warn');return;}
  if(applying)return;
  applying=true;setDisabled(true);message(`Применяю ${fmt(ms)} ms… радио НЕ перезапускается`,'busy');
  try{
    let sent=null;
    try{
      sent=await api('/api/control/radio-remote-r627/command',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'audio-delay',delayMs:ms})},18000);
    }catch(e){
      // 409 command-busy с ТЕМ ЖЕ значением — не ошибка: предыдущий тап уже выполняет нужную команду.
      const busy=e?.data?.command;
      if(e?.data?.error==='command-busy'&&busy?.action==='audio-delay'&&Number(busy.delayMs)===ms){
        message(`✅ ${fmt(ms)} ms уже принято VPS. Жду завершения…`,'busy');
        await waitResult(busy.id,ms);
        markOutcome(`✅ ${fmt(ms)} ms применено. Проверяй СЛЕДУЮЩУЮ заставку/клип.`,'ok');
        return;
      }
      if(e?.transient){
        message(`📡 Ответ панели потерялся. Команда могла уже уйти на VPS — проверяю…`,'busy');
        const recovered=await recoverLostSubmit(ms);
        if(recovered){markOutcome(`✅ ${fmt(ms)} ms применено на VPS. Краткий обрыв связи восстановлен автоматически.`,'ok');return;}
        throw new Error('связь оборвалась до отправки команды — нажми значение ещё раз');
      }
      throw e;
    }
    const id=sent?.command?.id;
    if(!id)throw new Error('VPS не вернул ID команды');
    await waitResult(id,ms);
    markOutcome(`✅ ${fmt(ms)} ms применено. Проверяй СЛЕДУЮЩУЮ заставку/клип.`,'ok');
  }catch(e){
    if(e?.data?.error==='command-busy')markOutcome('⚠️ VPS занят другой командой. Подожди её завершения и нажми ещё раз.','warn');
    else markOutcome(`❌ ${e.message||e}`,'error');
  }finally{
    applying=false;setDisabled(false);
    status({quiet:true}).catch(()=>{});
  }
}
buttons.forEach(b=>b.addEventListener('click',()=>apply(Number(b.dataset.audioDelayR949))));
nudges.forEach(b=>b.addEventListener('click',()=>apply(lastMs+Number(b.dataset.audioDelayNudgeR972||0))));
if(slider){slider.addEventListener('input',()=>paint(Number(slider.value)));slider.addEventListener('change',()=>apply(Number(slider.value)));}
status().catch(e=>message(`Нет связи с VPS: ${e.message||e}`,'error'));
setInterval(()=>{if(!applying)status().catch(()=>{})},15000);
})();
