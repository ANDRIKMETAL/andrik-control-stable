#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$SERVER.bak-before-r799-$STAMP"
WORK="$(mktemp /tmp/andrik-r799-server.XXXXXX.mjs)"
trap 'rm -f "$WORK"' EXIT

rollback(){
  echo '⚠️ R799 live-check не прошёл — возвращаю предыдущий server.mjs.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 8
  systemctl is-active "$SERVICE" || true
}

for c in node python3 systemctl cp install ps; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Copy CURRENT live server — no download, no transport replacement'
cp -a "$SERVER" "$WORK"

echo '[2/6] Patch ONLY the broken finite fade -> proven R787 absolute alpha-mask fade'
python3 - "$WORK" <<'PY'
from pathlib import Path
import sys,re
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
old="""  if(Number(trackDuration)>VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736+VIDEO_FADE_IN_SECONDS_R736+VIDEO_FADE_LEAD_SECONDS_R735+1){
    const d=Number(trackDuration);
    const outAt=Math.max(0,d-VIDEO_FADE_SECONDS_R726-VIDEO_BLACK_HOLD_SECONDS_R736-VIDEO_FADE_LEAD_SECONDS_R735);
    const recoverLocal=VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736;
    if(endFadeToBlack){
      // MP3 -> real video: fade to black and keep black only until this feeder ends.
      const maskDur=Math.max(VIDEO_FADE_SECONDS_R726+0.12,d-outAt+0.12);
      maskChain=`color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS}:d=${maskDur.toFixed(3)},format=yuva420p,fade=t=in:st=0:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1,setpts=PTS-STARTPTS+${outAt.toFixed(3)}/TB[blackmask];`;
    }else{
      // MP3 -> MP3: exact R795 viewer timing, but mask exists only for the transition.
      const maskDur=VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736+VIDEO_FADE_IN_SECONDS_R736+0.08;
      maskChain=`color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS}:d=${maskDur.toFixed(3)},format=yuva420p,fade=t=in:st=0:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1,fade=t=out:st=${recoverLocal.toFixed(3)}:d=${VIDEO_FADE_IN_SECONDS_R736.toFixed(2)}:alpha=1,setpts=PTS-STARTPTS+${outAt.toFixed(3)}/TB[blackmask];`;
    }
    finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=0:eof_action=pass:eval=init:format=yuv420[outv]';
  }
"""
new="""  if(Number(trackDuration)>VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736+VIDEO_FADE_IN_SECONDS_R736+VIDEO_FADE_LEAD_SECONDS_R735+1){
    // R799 FADE-ONLY RESTORE: exact viewer-proven R787 absolute alpha-mask clock.
    // The base picture is untouched; only BLACK mask alpha changes at feeder PTS.
    const outAt=Math.max(0,Number(trackDuration)-VIDEO_FADE_SECONDS_R726-VIDEO_BLACK_HOLD_SECONDS_R736-VIDEO_FADE_LEAD_SECONDS_R735);
    const recoverAt=outAt+VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736;
    maskChain=endFadeToBlack
      ? `color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1[blackmask];`
      : `color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1,fade=t=out:st=${recoverAt.toFixed(3)}:d=${VIDEO_FADE_IN_SECONDS_R736.toFixed(2)}:alpha=1[blackmask];`;
    finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]';
  }
"""
if old not in s:
    if 'R799 FADE-ONLY RESTORE' in s:
        print('R799 fade already present')
    else:
        raise SystemExit('СТОП: expected R796 finite fade block not found — NOTHING CHANGED')
else:
    s=s.replace(old,new,1)
# Metadata only; no transport/config code.
s=re.sub(r"version:\s*'R796-MAX-CPU-HEADROOM-TICKER36-COMPACT-EQ-FADE-PRESERVED-R795'",
         "version: 'R799-FADE-ONLY-R787-RESTORE-R798-PRESERVED'",s,count=1)
s=s.replace("fadeEngineR795:'R793-ALPHA-MASK-065-BLACK-HOLD-RECOVER',",
            "fadeEngineR795:'R787-ABSOLUTE-TIMELINE-ALPHA-MASK-065-BLACK-HOLD-RECOVER',",1)
s=s.replace("fadeRuntimePolicyR796:'FINITE-WINDOW-ALPHA-MASK-EOF-PASS-065-005-080',",
            "fadeRuntimePolicyR796:'R799-R787-ABSOLUTE-ALPHA-MASK-065-005-080',\n      fadeRestoreR799:'ONLY-FADE-CHANGED-YOUTUBE-TRANSPORT-PRESERVED',",1)
p.write_text(s,encoding='utf-8')
PY
node --check "$WORK" >/dev/null

echo '[3/6] HARD GUARD: YouTube/RTMPS transport must be byte-identical BEFORE/AFTER'
python3 - "$SERVER" "$WORK" <<'PY'
from pathlib import Path
import hashlib,sys,re
before=Path(sys.argv[1]).read_text(encoding='utf-8')
after=Path(sys.argv[2]).read_text(encoding='utf-8')
def block(s):
 a='function h264EncoderArgsR721(){'; b='async function visualLoopOffsetR735'
 i=s.find(a); j=s.find(b,i+1)
 if i<0 or j<0: raise SystemExit('СТОП: transport block boundaries not found')
 return s[i:j]
bb,aa=block(before),block(after)
print('BEFORE transport SHA256:',hashlib.sha256(bb.encode()).hexdigest())
print('AFTER  transport SHA256:',hashlib.sha256(aa.encode()).hexdigest())
if bb!=aa: raise SystemExit('СТОП: YouTube/RTMPS transport changed — NOTHING INSTALLED')
keys=['STREAM_URL','STREAM_BACKUP_URL','DUAL_INGEST_ENABLED_R792','OUTPUT_FIFO_QUEUE_PACKETS_R750','OUTPUT_TIMESHIFT_SECONDS','VIDEO_INPUT_QUEUE_PACKETS_R732','AUDIO_INPUT_QUEUE_PACKETS_R732']
def decls(s):
 out=[]
 for k in keys:
  m=re.search(rf'^const\s+{re.escape(k)}\s*=.*$',s,re.M)
  if m: out.append(m.group(0))
 return '\n'.join(out)
if decls(before)!=decls(after): raise SystemExit('СТОП: ingest/FIFO constants changed — NOTHING INSTALLED')
for x in [
 'R799 FADE-ONLY RESTORE',
 'fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1',
 'fade=t=out:st=${recoverAt.toFixed(3)}:d=${VIDEO_FADE_IN_SECONDS_R736.toFixed(2)}:alpha=1',
 "finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]'",
]:
 if x not in after: raise SystemExit('СТОП: fade marker missing: '+x)
if 'setpts=PTS-STARTPTS+${outAt.toFixed(3)}/TB[blackmask]' in after:
 raise SystemExit('СТОП: broken shifted finite fade still present')
print('✅ TRANSPORT UNCHANGED. Fade-only patch verified.')
PY

echo '[4/6] Backup + install ONE file'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$WORK" "$SERVER"

echo '[5/6] One controlled restart + automatic rollback on failure'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 16
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/6] Live proof'
S1="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$S1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(d.get('version')=='R799-FADE-ONLY-R787-RESTORE-R798-PRESERVED' and d.get('publisherRunning') is True and d.get('fadeRestoreR799')=='ONLY-FADE-CHANGED-YOUTUBE-TRANSPORT-PRESERVED')
raise SystemExit(0 if ok else 1)
PY
then
 echo '❌ R799 status failed'; printf '%s\n' "$S1" | python3 -m json.tool 2>/dev/null || true; rollback; exit 5
fi
printf '%s\n' "$S1" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("FADE:",d.get("fadeRuntimePolicyR796"));print("DUAL:",d.get("youtubeDualIngestEnabled"));print("BACKUP:",d.get("youtubeBackupIngestArmed"));print("ERROR:",d.get("lastError"))'
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 8 || true
echo "BACKUP FILE: $BACKUP"
echo '✅ ТОЛЬКО затемнение: R787 absolute alpha-mask restored.'
echo '✅ YouTube transport/systemd/RTMPS/FIFO/stream key/assets untouched.'
