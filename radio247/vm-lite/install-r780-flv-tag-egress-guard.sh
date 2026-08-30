#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r780.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r780-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R780 live-check не прошёл — возвращаю предыдущую рабочую версию.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 12
  echo 'ROLLBACK STATUS:'
  systemctl is-active "$SERVICE" || true
  curl -sS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E '"version"|"publisherRunning"|"transportHealthy"|"lastError"' || true
}

for c in curl node python3 ffmpeg ffprobe systemctl journalctl grep stat install cp cat ss awk; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Download R780'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r780-$STAMP" -o "$REMOTE"

echo '[2/8] Verify exact VPS FIFO→FLV compatibility before restart'
node --check "$REMOTE" >/dev/null
grep -Fq "R780-FLV-TAG7-EGRESS-GUARD-R779-PRESERVED" "$REMOTE" || { echo 'СТОП: remote server не R780'; exit 3; }
grep -Fq "'-tag:v','7'" "$REMOTE" || { echo 'СТОП: нет обязательного FLV H264 tag=7'; exit 3; }
grep -Fq "'-tag:a','10'" "$REMOTE" || { echo 'СТОП: нет обязательного FLV AAC tag=10'; exit 3; }
grep -Fq "OUTPUT_FATAL_REGEX_R780" "$REMOTE" || { echo 'СТОП: нет R780 egress guard'; exit 3; }
if grep -Fq "setts=time_base" "$REMOTE"; then echo 'СТОП: найден запрещённый setts BSF'; exit 3; fi

# Build two independent TS feeder sections with reset local clocks, then feed the SAME
# master shape used in production: MPEG-TS video + raw PCM audio -> H264 copy/AAC -> FIFO/FLV.
for n in 1 2; do
  ffmpeg -nostdin -hide_banner -loglevel error \
    -f lavfi -i "color=c=black:s=640x360:r=25" -t 1.2 \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -x264-params 'repeat-headers=1:aud=1:keyint=50:min-keyint=50:scenecut=0' \
    -an -mpegts_flags +resend_headers+initial_discontinuity -muxdelay 0 -muxpreload 0 \
    -f mpegts "$TMP/seg$n.ts"
done
cat "$TMP/seg1.ts" "$TMP/seg2.ts" > "$TMP/video.ts"
ffmpeg -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'sine=frequency=440:sample_rate=44100' -t 2.4 -ac 2 -ar 44100 \
  -c:a pcm_s16le -f s16le "$TMP/audio.pcm"

ffmpeg -nostdin -hide_banner -loglevel warning \
  -fflags +genpts+discardcorrupt -f mpegts -i "$TMP/video.ts" \
  -f s16le -ar 44100 -ac 2 -i "$TMP/audio.pcm" \
  -map 0:v:0 -map 1:a:0 \
  -c:v copy -tag:v 7 \
  -c:a aac -profile:a aac_low -b:a 160k -ar 44100 -ac 2 -tag:a 10 \
  -max_muxing_queue_size 4096 -flush_packets 1 \
  -f fifo -fifo_format flv -queue_size 2048 \
  -drop_pkts_on_overflow 1 -attempt_recovery 1 -recover_any_error 1 -recovery_wait_time 1 \
  "$TMP/test.flv" 2>"$TMP/ffmpeg-preflight.log"

if grep -Eqi 'Tag .* incompatible with output codec|Could not write header|Error opening output file|Error opening output files|Timestamps are unset|Bitstream filter not found|Invalid argument' "$TMP/ffmpeg-preflight.log"; then
  echo 'СТОП: точный FIFO→FLV preflight не прошёл:'
  cat "$TMP/ffmpeg-preflight.log"
  exit 3
fi
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$TMP/test.flv" | grep -Fxq h264 || { echo 'СТОП: test FLV без H264'; exit 3; }
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$TMP/test.flv" | grep -Fxq aac || { echo 'СТОП: test FLV без AAC'; exit 3; }
DUR="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$TMP/test.flv" 2>/dev/null || echo 0)"
python3 - "$DUR" <<'PY'
import sys
try:d=float(sys.argv[1])
except:d=0
raise SystemExit(0 if d > 2.1 else 1)
PY

echo '[3/8] Backup current working server'
cp -a "$SERVER" "$BACKUP"

echo '[4/8] Install R780'
install -m 0644 "$REMOTE" "$SERVER"

echo '[5/8] Restart once'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 15
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/8] Status + real byte movement'
STATUS1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(d.get('version')=='R780-FLV-TAG7-EGRESS-GUARD-R779-PRESERVED' and d.get('publisherRunning') is True and d.get('transportHealthy') is True and d.get('masterFlvTagMode')=='R780-VTAG7-ATAG10-OLD-FFMPEG-FIFO-COMPAT')
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R780 status не подтвердился.'
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
  echo "❌ Нет byte progress: audio $A1->$A2 video $V1->$V2"
  rollback; exit 5
fi

echo '[7/8] 60s live guard — mux errors + socket leak'
sleep 60
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'Tag .* incompatible with output codec|Could not write header|Error opening output file|Error opening output files|Timestamps are unset|Bitstream filter not found|Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Найдена критическая regression:'
  grep -Ei 'Tag .* incompatible with output codec|Could not write header|Error opening output file|Error opening output files|Timestamps are unset|Bitstream filter not found|Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 40 || true
  rollback; exit 6
fi
CLOSEWAIT="$(ss -tnp 2>/dev/null | awk '$1=="CLOSE-WAIT" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
echo "RTMPS sockets: ESTAB=$ESTAB CLOSE-WAIT=$CLOSEWAIT"
if [ "$CLOSEWAIT" -gt 8 ]; then
  echo '❌ Слишком много CLOSE-WAIT — FIFO не публикует нормально.'
  rollback; exit 6
fi
if [ "$ESTAB" -lt 1 ]; then
  echo '❌ Нет установленного RTMPS/TLS socket к :443.'
  rollback; exit 6
fi

echo '[8/8] Final status'
STATUS="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
echo 'OK: R780 installed'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("FLV TAG:",d.get("masterFlvTagMode"));print("EGRESS GUARD:",d.get("outputEgressGuardMode"));print("AUDIO BYTES:",d.get("masterAudioBytesWritten"));print("VIDEO BYTES:",d.get("masterVideoBytesWritten"));print("NEXT:",d.get("committedNextTitle") or "checkpoint ready");print("ERROR:",d.get("lastError"))'
echo '✅ R780: old-FFmpeg FLV tags reset to video=7 / audio=10'
echo '✅ R780: hard mux-header failure can no longer masquerade as PUBLISHER=True'
echo '✅ R779/R778 push rescue + R776 TRIKA + R775 transitions/NEXT preserved'
