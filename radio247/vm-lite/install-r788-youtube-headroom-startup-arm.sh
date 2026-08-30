#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r788.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r788-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R788 live-check не прошёл — возвращаю предыдущий server.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 12
  echo 'ROLLBACK STATUS:'
  systemctl is-active "$SERVICE" || true
  curl -sS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E '"version"|"publisherRunning"|"transportHealthy"|"lastError"' || true
}

for c in curl node python3 ffmpeg ffprobe systemctl journalctl grep ss awk install cp; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/7] Download R788 server'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r788-$STAMP" -o "$REMOTE"

echo '[2/7] Static safety audit'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R788-YOUTUBE-HEADROOM-STARTUP-ARM-R787-PRESERVED",
 "const OUTPUT_TIMESHIFT_SECONDS = 10",
 "const LOUDNESS_BACKGROUND_ENABLED_R788 = false",
 "R788-LIBRARY-FIRST-FIRST-ITEM-OWNS-FIRST-FEEDER-NO-EARLY-VIDEO-QUEUE",
 "masterInputQueueBlockCount",
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 8",
 "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8",
 "const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'",
 "R787-MPEGTS-MONOTONIC-OFFSET-NO-BACKWARD-DTS-NO-SECOND-ENCODE",
 "R784-ALL5-BEST-AUDIO-STREAM+OFFLINE-PCM-LEAD-TRIM+PREPARED-RMS-VERIFY",
]
missing=[x for x in required if x not in s]
forbidden=['force_original_aspect_ratio=increase','crop=',"'-f','rawvideo'"]
found=[x for x in forbidden if x in s]
# R788 must not pre-start a normal video feeder before the first real queue item.
start=s.index('async function radioLoop()')
loop=s.index('while(!stopping)',start)
pre=s[start:loop]
if 'await ensureNormalVideoFeederR721({force:true});' in pre:
    found.append('early startup video feeder')
if missing:
    print('СТОП: missing R788 markers:', ', '.join(missing)); raise SystemExit(3)
if found:
    print('СТОП: forbidden regression:', ', '.join(found)); raise SystemExit(3)
print('R788 static audit OK')
PY

# Re-prove permanent no-crop geometry independently of the live service.
FIT="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
check_fit(){
  local src="$1" expected="$2" got
  got="$(ffmpeg -nostdin -hide_banner -loglevel info -f lavfi -i "color=white:s=${src}:r=25" -frames:v 5 \
    -vf "$FIT,cropdetect=limit=16:round=2:reset=1" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -n1 || true)"
  echo "NO-CROP ${src}: ${got}"
  [ "$got" = "$expected" ] || { echo "СТОП: геометрия ${src} не FIT+PAD"; exit 3; }
}
check_fit 640x480 'crop=1440:1080:240:0'
check_fit 1080x1920 'crop=608:1080:656:0'
check_fit 2560x1080 'crop=1920:810:0:134'
check_fit 1920x1080 'crop=1920:1080:0:0'

echo '[3/7] Backup current R787'
cp -a "$SERVER" "$BACKUP"

echo '[4/7] Install R788 + one restart'
install -m 0644 "$REMOTE" "$SERVER"
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 20
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[5/7] Status / A-V movement'
STATUS1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R788-YOUTUBE-HEADROOM-STARTUP-ARM-R787-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 int(d.get('outputTimeshiftSeconds') or 0)==10 and
 int(d.get('videoInputQueuePackets') or 0)==8 and int(d.get('audioInputQueuePackets') or 0)==8 and
 d.get('loudnessBackgroundEnabled') is False and
 d.get('startupAvArmMode')=='R788-LIBRARY-FIRST-FIRST-ITEM-OWNS-FIRST-FEEDER-NO-EARLY-VIDEO-QUEUE' and
 d.get('permanentFullscreenFitPolicy')=='R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE' and
 int(d.get('masterTimestampErrorCount') or 0)==0
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R788 status не подтвердился.'
  printf '%s\n' "$STATUS1" | python3 -m json.tool 2>/dev/null || true
  rollback; exit 5
fi
A1="$(STATUS_JSON="$STATUS1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterAudioBytesWritten") or 0))')"
V1="$(STATUS_JSON="$STATUS1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterVideoBytesWritten") or 0))')"
sleep 12
STATUS2="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
A2="$(STATUS_JSON="$STATUS2" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterAudioBytesWritten") or 0))' 2>/dev/null || echo 0)"
V2="$(STATUS_JSON="$STATUS2" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterVideoBytesWritten") or 0))' 2>/dev/null || echo 0)"
if [ "$A2" -le "$A1" ] || [ "$V2" -le "$V1" ]; then
  echo "❌ Нет A/V progress: audio $A1->$A2 video $V1->$V2"
  rollback; exit 5
fi

echo '[6/7] 90s live guard'
sleep 90
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Broken pipe|Could not write header|Tag .*incompatible|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Найдена transport/timestamp regression:'
  grep -Ei 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Broken pipe|Could not write header|Tag .*incompatible|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 60 || true
  rollback; exit 6
fi
STATUS3="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
TSERR="$(STATUS_JSON="$STATUS3" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterTimestampErrorCount") or 0))' 2>/dev/null || echo 999)"
QBLOCK="$(STATUS_JSON="$STATUS3" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterInputQueueBlockCount") or 0))' 2>/dev/null || echo 999)"
LOUD="$(STATUS_JSON="$STATUS3" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("loudnessBackgroundPending") or 0))' 2>/dev/null || echo 999)"
[ "$TSERR" -eq 0 ] || { echo "❌ timestamp errors=$TSERR"; rollback; exit 6; }
# A single startup queue warning is nonfatal, but R788 is specifically designed to eliminate it.
[ "$QBLOCK" -eq 0 ] || { echo "❌ master input queue blocked $QBLOCK time(s)"; rollback; exit 6; }
[ "$LOUD" -eq 0 ] || { echo "❌ background loudness jobs still active=$LOUD"; rollback; exit 6; }
CLOSEWAIT="$(ss -tnp 2>/dev/null | awk '$1=="CLOSE-WAIT" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
echo "RTMPS sockets: ESTAB=$ESTAB CLOSE-WAIT=$CLOSEWAIT"
if [ "$CLOSEWAIT" -gt 8 ] || [ "$ESTAB" -lt 1 ]; then echo '❌ RTMPS socket health failed'; rollback; exit 6; fi

echo '[7/7] Final R788 status'
printf '%s\n' "$STATUS3" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("TIMESHIFT:",d.get("outputTimeshiftSeconds"));print("INPUT QUEUES:",d.get("videoInputQueuePackets"),d.get("audioInputQueuePackets"));print("QUEUE BLOCKS:",d.get("masterInputQueueBlockCount"));print("TIMESTAMP ERRORS:",d.get("masterTimestampErrorCount"));print("BACKGROUND LOUDNESS:",d.get("loudnessBackgroundEnabled"),"pending=",d.get("loudnessBackgroundPending"));print("FULL FRAME:",d.get("permanentFullscreenFitPolicy"));print("ERROR:",d.get("lastError"))'
echo '✅ R788: initial library/R2 work happens BEFORE publisher; no useless video-only startup feeder'
echo '✅ R788: background loudness FFmpeg disabled; cached two-pass remains, uncached tracks use live single-pass loudnorm'
echo '✅ R788: RTMPS/FIFO timeshift 6s -> 10s for extra transient-network headroom'
echo '✅ R788: R787 permanent NO-CROP + monotonic timestamps preserved; master queues remain exact 8/8 for clip sync'
