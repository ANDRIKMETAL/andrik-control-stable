const VERSION='R461';
const ORIGIN='https://control.andrikmetal.com';
const ALLOWED=new Set(['*/2 * * * *','*/5 * * * *','*/15 * * * *']);

export default {
  async fetch(request,env){
    const u=new URL(request.url);
    if(u.pathname==='/health') return json({ok:true,worker:'andrik-central-cron',version:VERSION,schedules:[...ALLOWED]});
    if(u.pathname==='/run'&&request.method==='POST'){
      if(!auth(request,env)) return json({ok:false,error:'unauthorized'},401);
      const cron=u.searchParams.get('cron')||'*/2 * * * *';
      return json(await run(cron,env,Date.now()));
    }
    return new Response('ANDRIK Central Cron '+VERSION+'\nHealth: /health',{headers:{'content-type':'text/plain; charset=utf-8'}});
  },
  async scheduled(controller,env,ctx){ctx.waitUntil(run(String(controller.cron||''),env,controller.scheduledTime));}
};

async function run(cron,env,scheduledTime){
  if(!ALLOWED.has(cron)){console.log('Ignored cron',cron);return {ok:true,ignored:true,cron};}
  const key=secret(env),q=new URLSearchParams({cron,source:'andrik-central-cron-r461',scheduledTime:String(scheduledTime||Date.now())});
  const h={'x-cron-key':key,'authorization':'Bearer '+key,'x-andrik-cron':cron,'x-andrik-cron-source':'andrik-central-cron-r461','accept':'application/json','user-agent':'ANDRIK-Central-Cron/R461'};
  await post('/api/automation/summary-checkpoint?'+q,h,12000);
  const gateway=await post('/api/automation/cron-gateway?'+q,h,28000);
  console.log('ANDRIK cron OK',cron,gateway?.task||'done');
  return {ok:true,cron,gateway};
}

async function post(path,headers,timeout){
  const r=await fetch(ORIGIN+path,{method:'POST',headers,signal:AbortSignal.timeout(timeout)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.ok===false) throw new Error(path+' HTTP '+r.status+' '+String(data.error||data.details||'').slice(0,240));
  return data;
}
function secret(env){const k=String(env.CRON_SECRET||'').trim();if(!k)throw new Error('CRON_SECRET is missing');return k;}
function auth(r,env){const k=String(env.CRON_SECRET||'').trim(),a=String(r.headers.get('authorization')||'');return !!k&&(r.headers.get('x-cron-key')===k||a==='Bearer '+k);}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
