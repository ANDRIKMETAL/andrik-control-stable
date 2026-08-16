const V='R462',ORIGIN='https://control.andrikmetal.com';
const OK=new Set(['*/2 * * * *','*/5 * * * *','*/15 * * * *']);
export default{
  async fetch(r,e){const u=new URL(r.url);if(u.pathname==='/health')return j({ok:true,worker:'andrik-central-cron',version:V,schedules:[...OK],secretConfigured:!!String(e.CENTRAL_CRON_SECRET_R462||'').trim()});
    if(u.pathname==='/run'&&r.method==='POST'){if(!auth(r,e))return j({ok:false,error:'unauthorized'},401);return j(await run(u.searchParams.get('cron')||'*/2 * * * *',e,Date.now()));}
    return new Response('ANDRIK Central Cron '+V+'\nHealth: /health',{headers:{'content-type':'text/plain; charset=utf-8'}});},
  async scheduled(c,e,x){x.waitUntil(run(String(c.cron||''),e,c.scheduledTime));}
};
async function run(cron,e,t){if(!OK.has(cron))return {ok:true,ignored:true,cron};const k=secret(e),q=new URLSearchParams({cron,source:'andrik-central-cron-r462',scheduledTime:String(t||Date.now())});
  const h={'x-cron-key':k,'authorization':'Bearer '+k,'x-andrik-cron':cron,'x-andrik-cron-source':'andrik-central-cron-r462','accept':'application/json','user-agent':'ANDRIK-Central-Cron/R462'};
  await post('/api/automation/summary-checkpoint?'+q,h,12000);const g=await post('/api/automation/cron-gateway?'+q,h,28000);console.log('ANDRIK cron OK',cron,g?.task||'done');return {ok:true,cron,gateway:g};}
async function post(p,h,t){const r=await fetch(ORIGIN+p,{method:'POST',headers:h,signal:AbortSignal.timeout(t)}),d=await r.json().catch(()=>({}));if(!r.ok||d.ok===false)throw new Error(p+' HTTP '+r.status+' '+String(d.error||d.details||'').slice(0,240));return d;}
function secret(e){const k=String(e.CENTRAL_CRON_SECRET_R462||'').trim();if(!k)throw new Error('CENTRAL_CRON_SECRET_R462 is missing');return k;}
function auth(r,e){const k=String(e.CENTRAL_CRON_SECRET_R462||'').trim(),a=String(r.headers.get('authorization')||'');return !!k&&(r.headers.get('x-cron-key')===k||a==='Bearer '+k);}
function j(d,s=200){return new Response(JSON.stringify(d),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
