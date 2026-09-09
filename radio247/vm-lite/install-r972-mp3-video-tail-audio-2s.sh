#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
AGENT=/usr/local/lib/andrik-radio-web-agent-r803.mjs
HELPER=/usr/local/sbin/andrik-audio-sync-r949
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BASE/backups/PRE-R972-MP3-VIDEO-TAIL-$STAMP"
mkdir -p "$BACKUP"
cp -a "$SERVER" "$BACKUP/server.mjs"
cp -a "$AGENT" "$BACKUP/agent.mjs" 2>/dev/null || true
cp -a "$HELPER" "$BACKUP/audio-sync" 2>/dev/null || true

python3 - "$SERVER" "$AGENT" "$HELPER" <<'PY'
from pathlib import Path
import sys
server,agent,helper=map(Path,sys.argv[1:])

h=helper.read_text()
old_h='(( TARGET >= -500 && TARGET <= 500 && TARGET % 50 == 0 )) || { echo "target must be -500..500 step 50"; exit 21; }'
new_h='(( TARGET >= -2000 && TARGET <= 2000 && TARGET % 50 == 0 )) || { echo "target must be -2000..2000 step 50"; exit 21; }'
if old_h in h:
    h=h.replace(old_h,new_h,1)
elif new_h not in h:
    raise SystemExit('helper range anchor not found')
h=h.replace('ANDRIK AUDIO SYNC R958 · BIDIRECTIONAL','ANDRIK AUDIO SYNC R972 · BIDIRECTIONAL ±2S')
if '-2000' not in h or '2000' not in h: raise SystemExit('helper patch failed')
helper.write_text(h)

if agent.exists():
    a=agent.read_text()
    old_ver="const AGENT_VERSION_R803='R958';"
    new_ver="const AGENT_VERSION_R803='R972';"
    if old_ver in a:
        a=a.replace(old_ver,new_ver,1)
    elif new_ver not in a:
        raise SystemExit('agent version anchor not found')
    old_range="if(!Number.isFinite(delayMs)||delayMs<-500||delayMs>500||delayMs%50!==0)return {ok:false,output:'AUDIO OFFSET ❌ invalid value (-500..+500 step 50)'};"
    new_range="if(!Number.isFinite(delayMs)||delayMs<-2000||delayMs>2000||delayMs%50!==0)return {ok:false,output:'AUDIO OFFSET ❌ invalid value (-2000..+2000 ms step 50)'};"
    if old_range in a:
        a=a.replace(old_range,new_range,1)
    elif new_range not in a:
        raise SystemExit('agent range anchor not found')
    agent.write_text(a)

s=server.read_text()
const_anchor='const AUDIO_GAP_BRIDGE_CHUNK_R824 = Buffer.alloc(AUDIO_GAP_BRIDGE_SAMPLES_R824*2*2); // s16le stereo silence, 20 ms'
if 'MP3_TO_VIDEO_TAIL_GUARD_MS_R972' not in s:
    if const_anchor not in s: raise SystemExit('server constant anchor not found')
    s=s.replace(const_anchor,const_anchor+'\nconst MP3_TO_VIDEO_TAIL_GUARD_MS_R972 = Math.max(0,Math.min(4000,Number(process.env.ANDRIK_MP3_VIDEO_TAIL_GUARD_MS||2000))); // R972 MP3 audio-tail guard before video insert',1)
old_td='      trackDuration:duration,\n      previewReload:false,'
new_td='      trackDuration:duration+(isVideoHandoffR738(actualNextR736)?MP3_TO_VIDEO_TAIL_GUARD_MS_R972/1000:0),\n      previewReload:false,'
if old_td in s: s=s.replace(old_td,new_td,1)
elif new_td not in s: raise SystemExit('server trackDuration anchor not found')
old_exit="""      producer.once('exit',(code,signal)=>{\n        try{source.unpipe(audioSink);}catch(_){}\n        if(!stopping)startMasterAudioGapBridgeR824('mp3-ended');\n        state.producerRunning=false;\n        producer=null;\n        if(code===0 || stopping) resolve();\n        else reject(new Error(`decoder exit ${code||signal}`));\n      });"""
new_exit="""      producer.once('exit',(code,signal)=>{\n        try{source.unpipe(audioSink);}catch(_){}\n        const exitOkR972=(code===0||stopping);\n        const videoNextR972=Boolean(actualNextR736&&isVideoHandoffR738(actualNextR736));\n        if(!stopping)startMasterAudioGapBridgeR824(videoNextR972?'mp3-ended-video-tail-guard-r972':'mp3-ended');\n        state.producerRunning=false;\n        producer=null;\n        if(!exitOkR972){reject(new Error(`decoder exit ${code||signal}`));return;}\n        if(!stopping&&videoNextR972&&MP3_TO_VIDEO_TAIL_GUARD_MS_R972>0){\n          state.mp3VideoTailGuardActiveR972=true;\n          state.mp3VideoTailGuardMsR972=MP3_TO_VIDEO_TAIL_GUARD_MS_R972;\n          state.lastMp3VideoTailGuardAtR972=new Date().toISOString();\n          setTimeout(()=>{state.mp3VideoTailGuardActiveR972=false;resolve();},MP3_TO_VIDEO_TAIL_GUARD_MS_R972);\n          return;\n        }\n        resolve();\n      });"""
if old_exit in s: s=s.replace(old_exit,new_exit,1)
elif 'videoNextR972' not in s: raise SystemExit('server producer-exit anchor not found')
server.write_text(s)
PY

chmod 0755 "$HELPER"
node --check "$SERVER"
node --check "$AGENT" 2>/dev/null || true
bash -n "$HELPER"
systemctl restart andrik-radio-web-agent.service 2>/dev/null || true
systemctl restart andrik-radio.service
sleep 10

echo '=== VERIFY R972 ==='
grep -n 'MP3_TO_VIDEO_TAIL_GUARD_MS_R972' "$SERVER" | head -1
grep -n "AGENT_VERSION_R803='R972'" "$AGENT" | head -1 || true
grep -n -- '-2000' "$HELPER" | head -2
systemctl is-active andrik-radio.service
echo "BACKUP: $BACKUP"
