#!/usr/bin/env bash
set -Eeuo pipefail

SERVER="/opt/andrik-radio/radio247/server.mjs"
AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
MON="/usr/local/sbin/andrik-radio-load-r988"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACK="/opt/andrik-radio/backups/PRE-R989-LAZY-MONITOR-MEDIA-PICKER-$STAMP"

mkdir -p "$BACK"
cp -a "$SERVER" "$BACK/server.mjs"
cp -a "$AGENT" "$BACK/andrik-radio-web-agent-r803.mjs"

echo "=== ANDRIK R989 · LAZY LOAD + SAFE MEDIA PICKER ==="
echo "Backup: $BACK"

cat > "$MON" <<'PY'
#!/usr/bin/env python3
import os,re,json,time,subprocess

def snap():
    with open('/proc/stat') as f: v=[int(x) for x in f.readline().split()[1:]]
    idle=v[3]+(v[4] if len(v)>4 else 0)
    return idle,sum(v)
a=snap();time.sleep(.35);b=snap();dt=max(1,b[1]-a[1]);di=max(0,b[0]-a[0]);cpu=max(0.0,min(100.0,(1.0-di/dt)*100.0))
mem={}
with open('/proc/meminfo') as f:
    for line in f:
        m=re.match(r'^([^:]+):\s+(\d+)',line)
        if m: mem[m.group(1)]=int(m.group(2))
rt=mem.get('MemTotal',0);ra=mem.get('MemAvailable',0);ru=max(0,rt-ra);st=mem.get('SwapTotal',0);sf=mem.get('SwapFree',0);su=max(0,st-sf)
model='CPU'
try:
    with open('/proc/cpuinfo') as f:
        for line in f:
            if line.lower().startswith('model name'):
                model=line.split(':',1)[1].strip();break
except: pass
cores=os.cpu_count() or 1;l1,l5,l15=os.getloadavg();p={'visual':0.0,'publisher':0.0,'radioNode':0.0,'mp3Decoder':0.0,'otherFfmpeg':0.0}
try:
    out=subprocess.run(['ps','-eo','pcpu=,args='],capture_output=True,text=True,timeout=4).stdout
    for line in out.splitlines():
        parts=line.strip().split(None,1)
        if len(parts)<2: continue
        try: pc=float(parts[0])
        except: continue
        args=parts[1];low=args.lower()
        if 'radio247/server.mjs' in args: p['radioNode']+=pc
        if 'ffmpeg' in low:
            if 'rtmps://' in low or 'youtube.com/live' in low: p['publisher']+=pc
            elif re.search(r'\.mp3(?:\s|$)',args,re.I): p['mp3Decoder']+=pc
            elif re.search(r'stream-morning-master-r703|live-ticker|andrik-qr|subscribe-right|like-right',args,re.I): p['visual']+=pc
            else: p['otherFfmpeg']+=pc
except: pass
rp=(ru/rt*100.0) if rt else 0.0;norm=l1/cores
if cpu>=92 or rp>=95 or norm>=1.50: level,label='critical','КРИТИЧЕСКАЯ'
elif cpu>=75 or rp>=80 or norm>=1.00: level,label='high','ВЫСОКАЯ'
else: level,label='normal','НОРМА'
print(json.dumps({'version':'R988','state':{'level':level,'label':label},'cpu':{'model':model,'cores':cores,'totalPct':round(cpu,1)},'processes':{k:round(v,1) for k,v in p.items()},'memory':{'ramUsedMB':round(ru/1024),'ramTotalMB':round(rt/1024),'ramPct':round(rp,1),'swapUsedMB':round(su/1024),'swapTotalMB':round(st/1024)},'load':{'one':round(l1,2),'five':round(l5,2),'fifteen':round(l15,2)}},ensure_ascii=False,separators=(',',':')))
PY
chmod 0755 "$MON"

echo "✅ R988 monitor installed"

python3 - "$AGENT" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text();marker='// R989-LOAD-AND-SAFE-NEXT'
if marker in s:
    print('✅ agent already patched')
    raise SystemExit(0)
anchor="  if(action==='status'){"
if anchor not in s: raise SystemExit('❌ AGENT ANCHOR NOT FOUND — no write')
insert=r'''  // R989-LOAD-AND-SAFE-NEXT
  if(action==='load-r988'){
    const r=await runAsync('/usr/local/sbin/andrik-radio-load-r988',[],8000);
    return {ok:r.ok,output:r.ok?`R988_LOAD ${r.output}`:`R988_LOAD_ERROR\n${r.output}`};
  }
  if(action==='queue-pick-r989'){
    const mediaType=clean(command.mediaType||'').toLowerCase();
    const key=clean(command.key||'').replace(/^\/+/, '');
    const title=clean(command.title||'');
    if(!['track','clip'].includes(mediaType))return {ok:false,output:'R989 QUEUE PICK ❌ invalid media type'};
    if(!key||key.includes('..')||key.includes('\\'))return {ok:false,output:'R989 QUEUE PICK ❌ invalid key'};
    try{
      const d=await localControlR721(`/control/queue-pick-r989?type=${encodeURIComponent(mediaType)}&key=${encodeURIComponent(key)}&title=${encodeURIComponent(title)}`);
      return {ok:Boolean(d?.ok),output:`R989_QUEUE ${JSON.stringify(d)}`};
    }catch(e){return {ok:false,output:`R989 QUEUE PICK ❌\n${e.message||e}`};}
  }
'''
p.write_text(s.replace(anchor,insert+anchor,1))
print('✅ agent R989 patched')
PY

python3 - "$SERVER" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]);s=p.read_text();marker='// R989: safe arbitrary next-media selection from Control.'
if marker not in s:
    anchor='function publicStatus(){'
    if anchor not in s: raise SystemExit('❌ SERVER FUNCTION ANCHOR NOT FOUND — no write')
    insert=r'''// R989: safe arbitrary next-media selection from Control.
// Never rewrites the already-armed boundary of the media that is currently LIVE.
// If a boundary is already active, the chosen item is placed immediately AFTER the
// committed NEXT. This keeps the proven transition timing untouched.
function queuePickSafeR989(type,key,title=''){
  const mediaType=String(type||'').trim().toLowerCase();
  const wanted=String(key||'').trim().replace(/^\/+/, '');
  const wantedTitle=cleanText(title||'');
  if(!['track','clip'].includes(mediaType))return {ok:false,error:'invalid-media-type'};
  if(!wanted||wanted.includes('..')||wanted.includes('\\'))return {ok:false,error:'invalid-media-key'};
  const source=mediaType==='clip'?clipLibrary:library;
  const item=source.find(x=>String(x?.key||'')===wanted) || (wantedTitle?source.find(x=>cleanText(x?.title||'')===wantedTitle):null);
  if(!item)return {ok:false,error:'media-not-found',type:mediaType,key:wanted,title:wantedTitle};
  if(!queue.length)return {ok:false,error:'queue-not-ready'};
  const selectedId=primaryIdentity(item);
  const firstFuture=Math.min(queue.length,queueIndex+1);
  const immediate=queue[firstFuture]||null;
  if(immediate && primaryIdentity(immediate)===selectedId){
    const out={ok:true,alreadyNext:true,safe:true,position:1,type:mediaType,key:wanted,title:shortText(item.title||wantedTitle||'ANDRIK',120),upcoming:upcomingQueueR942(6)};
    state.lastManualQueuePickR989={...out,at:new Date().toISOString()};
    return out;
  }
  const armedBoundary=Boolean(state.producerRunning||clipActive||stationHandoffActiveR804);
  let insertAt=Math.min(queue.length,firstFuture+(armedBoundary?1:0));
  for(let i=queue.length-1;i>=firstFuture;i--){
    if(primaryIdentity(queue[i])!==selectedId)continue;
    queue.splice(i,1);if(i<insertAt)insertAt--;
  }
  insertAt=Math.max(firstFuture,Math.min(queue.length,insertAt));
  queue.splice(insertAt,0,item);state.queueLength=queue.length;
  if(mediaType==='track')prefetchTrack(item);else prefetchPreparedClipR742(item);
  const position=Math.max(1,insertAt-firstFuture+1);
  const out={ok:true,alreadyNext:false,safe:true,position,afterCommittedNext:Boolean(armedBoundary),type:mediaType,key:wanted,title:shortText(item.title||wantedTitle||'ANDRIK',120),upcoming:upcomingQueueR942(6)};
  state.lastManualQueuePickR989={...out,at:new Date().toISOString()};
  return out;
}

'''
    s=s.replace(anchor,insert+anchor,1)
endpoint="      else if(url.pathname==='/control/queue-move')result=moveUpcomingQueueR942(url.searchParams.get('offset'),url.searchParams.get('direction'));"
newendpoint=endpoint+"\n      else if(url.pathname==='/control/queue-pick-r989')result=queuePickSafeR989(url.searchParams.get('type'),url.searchParams.get('key'),url.searchParams.get('title')||'');"
if "/control/queue-pick-r989" not in s:
    if endpoint not in s: raise SystemExit('❌ SERVER ENDPOINT ANCHOR NOT FOUND — no write')
    s=s.replace(endpoint,newendpoint,1)
status="    lastManualQueueMoveR942:state.lastManualQueueMoveR942||null,"
if 'lastManualQueuePickR989:' not in s:
    if status not in s: raise SystemExit('❌ SERVER STATUS ANCHOR NOT FOUND — no write')
    s=s.replace(status,status+"\n    lastManualQueuePickR989:state.lastManualQueuePickR989||null,",1)
p.write_text(s)
print('✅ server R989 patched on disk')
PY

node --check "$AGENT"
node --check "$SERVER"

# Restart only the lightweight web agent so R988 monitor is immediately available.
# The radio itself is deliberately NOT restarted by this installer.
for unit in andrik-radio-web.service andrik-radio-web-agent.service andrik-radio-web-agent-r803.service; do
  if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^${unit}"; then
    systemctl restart "$unit" 2>/dev/null || true
    if systemctl is-active --quiet "$unit"; then echo "✅ agent restarted: $unit"; break; fi
  fi
done

echo
echo "=== R988 LOCAL TEST ==="
"$MON" | python3 -m json.tool

echo
echo "======================================================"
echo "✅ R989 files installed"
echo "✅ R988 lazy monitor can work after agent heartbeat"
echo "✅ radio stream was NOT restarted"
echo "⚠ queue picker server code activates on next radio restart"
echo "   Activate later with: sudo systemctl restart andrik-radio.service"
echo "======================================================"
