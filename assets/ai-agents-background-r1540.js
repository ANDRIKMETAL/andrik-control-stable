(()=>{'use strict';
const names=['music','social'];let busy=false;
const el=id=>document.getElementById(id);
function time(t){if(!Number.isFinite(Number(t))||Number(t)<=0)return 'неизвестно';return new Date(Number(t)).toLocaleString('ru-RU');}
function status(v){if(!v)return 'ожидает первого запуска Cron';const age=Date.now()-Number(v.checkedAt);const issues=Array.isArray(v.report?.issues)?v.report.issues.length:0;
 const name={ok:'успешно',running:'выполняется',error:'ошибка',unavailable:'нет доступа'}[v.status]||String(v.status);
 let out=name+' · '+time(v.checkedAt)+' · проблем: '+issues;
 if(age>8*3600000)out+=' · ⚠️ отчёт старше 8 часов';
 if(v.report?.error)out+=' · '+String(v.report.error).slice(0,180);
 return out;}
function render(j){const a=j?.agents||{};for(const name of names){const e=el(name+'-background');if(e)e.textContent='Фоновый '+name.toUpperCase()+': '+status(a[name]);}
 const f=el('background-feedback');if(f&&!busy){const n=names.filter(x=>a[x]);f.textContent=n.length===2?'Состояние обновлено. Оба агента имеют записи о фоновых проверках.': 'Ожидается первый запуск: '+names.filter(x=>!a[x]).map(x=>x.toUpperCase()).join(', ');}}
async function load(){try{const r=await fetch('/api/control/agents/background/status',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();if(!j.ok)throw Error(j.error||'Ошибка');render(j);}catch(e){const f=el('background-feedback');if(f&&!busy)f.textContent='Не удалось получить статус: '+e.message;}}
async function run(){if(busy)return;busy=true;const b=el('background-run'),f=el('background-feedback');if(b)b.disabled=true;if(f)f.textContent='Запускаю серверную проверку MUSIC и SOCIAL…';try{const r=await fetch('/api/control/agents/background/run',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||'HTTP '+r.status);render(j);if(f)f.textContent='Проверка завершена. Теперь обнови MANAGER — задачи сформированы по найденным проблемам.';}catch(e){if(f)f.textContent='Ошибка фоновой проверки: '+e.message;}finally{busy=false;if(b)b.disabled=false;}}
document.addEventListener('DOMContentLoaded',()=>{el('background-run')?.addEventListener('click',run);el('background-refresh')?.addEventListener('click',load);load();document.addEventListener('visibilitychange',()=>{if(!document.hidden)load();});setInterval(()=>{if(!document.hidden&&!busy)load();},60000);});})();
