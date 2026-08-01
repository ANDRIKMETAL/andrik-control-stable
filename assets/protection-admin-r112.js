(() => {
  'use strict';

  const KEY_SESSION='andrik-comments-admin-key';
  const KEY_LOCAL='andrik-comments-admin-key-persistent';
  const AUTO_RECOVERY_KEY='andrik-site-update-auto-recovery';
  const byId=id=>document.getElementById(id);

  const escapeHtml=value=>String(value??'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const formatDate=value=>{
    if(!value)return '—';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return String(value);
    return new Intl.DateTimeFormat('ru-RU',{
      day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'
    }).format(date);
  };

  const getKey=()=>byId('protectionAdminKey').value.trim();

  function loadStored(){
    try{
      byId('protectionAdminKey').value=
        localStorage.getItem(KEY_LOCAL)||
        sessionStorage.getItem(KEY_SESSION)||'';
      byId('protectionAutoRecovery').checked=
        localStorage.getItem(AUTO_RECOVERY_KEY)!=='0';
    }catch(_){
      byId('protectionAutoRecovery').checked=true;
    }
  }

  function state(element,status,label){
    element.className=`protection-state ${status==='good'?'is-good':status==='warn'?'is-warn':status==='bad'?'is-bad':''}`;
    element.textContent=label;
  }

  async function api(path,options={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),options.timeoutMs||25000);
    try{
      const response=await fetch(path,{
        ...options,
        signal:controller.signal,
        headers:{
          accept:'application/json',
          authorization:`Bearer ${getKey()}`,
          ...(options.headers||{})
        }
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(data.message||data.error||`HTTP ${response.status}`);
      return data;
    }finally{clearTimeout(timer)}
  }

  function item(icon,title,detail,status){
    const label=status==='good'?'ВКЛ':status==='warn'?'ПРОВЕРЬ':'НЕТ';
    return `<div class="security-item">
      <span class="icon">${icon}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>
      <b>${label}</b>
    </div>`;
  }

  function renderEvents(events=[]){
    const labels={
      'honeypot':'Бот пойман ловушкой',
      'turnstile-failed':'Turnstile отклонил запрос',
      'comment-rate-limit':'Лимит комментариев',
      'comment-like-rate-limit':'Лимит лайков',
      'comment-report-rate-limit':'Лимит жалоб',
      'spam-block':'Спам заблокирован'
    };
    byId('protectionEvents').innerHTML=events.length
      ?events.map(event=>`<div class="security-event"><div><strong>${escapeHtml(labels[event.kind]||event.kind)}</strong><small>${escapeHtml(event.detail||event.path||'')}</small></div><time>${escapeHtml(formatDate(event.createdAt))}</time></div>`).join('')
      :'<div class="admin-empty">За последние сутки блокировок нет.</div>';
  }

  function render(data){
    const score=Math.max(0,Math.min(100,Number(data.score||0)));
    byId('protectionScoreRing').style.setProperty('--score',score);
    byId('protectionScore').textContent=`${score}%`;
    byId('protectionScoreTitle').textContent=
      score>=85?'Сильная защита':score>=65?'Хорошая защита':'Нужна настройка';
    byId('protectionScoreText').textContent=data.summary||'Проверка завершена.';
    state(byId('protectionOverallState'),score>=85?'good':score>=65?'warn':'bad',score>=85?'Защищено':score>=65?'Хорошо':'Настроить');

    const guard=data.guard||{};
    state(byId('protectionGuardState'),
      guard.connected&&guard.status?.ok?'good':guard.configured?'warn':'bad',
      guard.connected&&guard.status?.ok?'Работает':guard.configured?'Нет ответа':'Не подключён'
    );
    byId('protectionGuardMessage').textContent=
      guard.message||'Guard ещё не подключён к Control.';
    byId('protectionGuardMeta').textContent=
      guard.status?.status?.finishedAt
        ?`Последняя проверка: ${formatDate(guard.status.status.finishedAt)} · ${guard.status.status.action||'none'}`
        :'Ожидается первая проверка.';
    const guardLink=byId('protectionGuardOpen');
    guardLink.hidden=!guard.url;
    if(guard.url)guardLink.href=guard.url;

    const app=data.application||{};
    byId('protectionApplicationList').innerHTML=[
      item('🔑','ADMIN_KEY',app.adminKey?'Серверный доступ владельца настроен.':'Секрет владельца отсутствует.',app.adminKey?'good':'bad'),
      item('🧩','Cloudflare Turnstile',app.turnstile?'Комментарии проходят серверную проверку токена.':'Нужно добавить TURNSTILE_SECRET_KEY.',app.turnstile?'good':'warn'),
      item('🗄️','D1 и антиспам',app.d1?'Лимиты, дубликаты и журнал блокировок активны.':'База COMMENTS_DB не подключена.',app.d1?'good':'bad'),
      item('🧱','Защитные заголовки',data.headers?.hsts&&data.headers?.frame?'HSTS и защита от встраивания активны.':'Проверь HSTS/X-Frame-Options.',data.headers?.hsts&&data.headers?.frame?'good':'warn')
    ].join('');

    const edge=data.edge||{};
    byId('protectionEdgeList').innerHTML=[
      item('🌊','DDoS L3/L4/L7',edge.ddos?'Автоматическая защита Cloudflare активна на edge.':'Не подтверждено.',edge.ddos?'good':'warn'),
      item('🧰','WAF Managed Rules','Free Managed Ruleset доступен; включение проверяется в Cloudflare Security.',edge.waf==='on'?'good':'warn'),
      item('🤖','Bot Fight Mode','Блокирует известные автоматические боты; включается в Cloudflare Security.',edge.bot==='on'?'good':'warn'),
      item('⏱️','Rate Limiting','Дополнительные серверные лимиты комментариев, лайков и жалоб активны.',app.d1?'good':'warn')
    ].join('');

    const mail=data.phishing||{};
    byId('protectionPhishingList').innerHTML=[
      item('📨','SPF',mail.spf?'Запись найдена: домен ограничивает разрешённых отправителей.':'SPF не найден.',mail.spf?'good':'warn'),
      item('🛡️','DMARC',mail.dmarc?`Политика: ${mail.dmarcPolicy||'найдена'}.`:'DMARC не найден — домен легче подделать в письмах.',mail.dmarc?(mail.dmarcPolicy==='reject'||mail.dmarcPolicy==='quarantine'?'good':'warn'):'bad'),
      item('🖼️','Anti-frame',data.headers?.frame?'Страницы нельзя незаметно встроить в чужой сайт.':'Нужен X-Frame-Options или CSP frame-ancestors.',data.headers?.frame?'good':'warn'),
      item('🔒','HTTPS / HSTS',data.headers?.hsts?'Браузер принудительно использует HTTPS.':'HSTS не подтверждён.',data.headers?.hsts?'good':'warn')
    ].join('');

    const counts=data.events?.counts||{};
    const fields=[
      ['protectionKpiBots',counts.honeypot||0],
      ['protectionKpiTurnstile',counts['turnstile-failed']||0],
      ['protectionKpiSpam',counts['spam-block']||0],
      ['protectionKpiLimits',
        (counts['comment-rate-limit']||0)+
        (counts['comment-like-rate-limit']||0)+
        (counts['comment-report-rate-limit']||0)]
    ];
    fields.forEach(([id,value])=>byId(id).textContent=String(value));
    renderEvents(data.events?.recent||[]);

    byId('protectionMessage').textContent=`Проверено: ${formatDate(data.checkedAt)}`;
  }

  async function refresh(){
    const button=byId('protectionRefresh');
    button.disabled=true;
    byId('protectionMessage').textContent='Проверяем защиту…';
    try{
      const data=await api('/api/control/protection/status',{timeoutMs:40000});
      render(data);
      try{
        sessionStorage.setItem(KEY_SESSION,getKey());
        if(byId('protectionRemember').checked)localStorage.setItem(KEY_LOCAL,getKey());
      }catch(_){}
    }catch(error){
      state(byId('protectionOverallState'),'bad','Ошибка');
      byId('protectionMessage').textContent=error.message;
    }finally{button.disabled=false}
  }

  async function runGuard(){
    const button=byId('protectionGuardRun');
    button.disabled=true;
    byId('protectionGuardMessage').textContent='Guard выполняет полную проверку…';
    try{
      const data=await api('/api/control/protection/guard-run',{
        method:'POST',
        headers:{'content-type':'application/json'},
        body:'{}',
        timeoutMs:120000
      });
      byId('protectionGuardMessage').textContent=data.message||'Guard завершил проверку.';
      await refresh();
    }catch(error){
      byId('protectionGuardMessage').textContent=`Guard: ${error.message}`;
    }finally{button.disabled=false}
  }

  loadStored();
  byId('protectionRefresh').addEventListener('click',refresh);
  byId('protectionVerify').addEventListener('click',refresh);
  byId('protectionGuardRun').addEventListener('click',runGuard);
  byId('protectionAutoRecovery').addEventListener('change',()=>{
    try{
      localStorage.setItem(AUTO_RECOVERY_KEY,byId('protectionAutoRecovery').checked?'1':'0');
    }catch(_){}
  });
  byId('protectionAdminKey').addEventListener('keydown',event=>{
    if(event.key==='Enter'){event.preventDefault();refresh()}
  });
  if(getKey())refresh();
})();
