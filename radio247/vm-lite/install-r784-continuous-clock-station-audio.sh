#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r784.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r784-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R784 live-check не прошёл — возвращаю предыдущую рабочую версию.'
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

echo '[1/8] Download R784'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r784-$STAMP" -o "$REMOTE"

echo '[2/8] Verify continuous rawvideo clock + station audio guard'
node --check "$REMOTE" >/dev/null
grep -Fq "R784-CONTINUOUS-RAWVIDEO-CLOCK-STATION-AUDIO-R783-PRESERVED" "$REMOTE" || { echo 'СТОП: remote server не R784'; exit 3; }
grep -Fq "const VIDEO_FRAME_BYTES_R784 = 1920*1080*3/2" "$REMOTE" || { echo 'СТОП: нет точного размера YUV420P кадра'; exit 3; }
grep -Fq "attachVideoFrameRelayR784" "$REMOTE" || { echo 'СТОП: нет frame-aligned relay'; exit 3; }
grep -Fq "R784-PERSISTENT-RAWVIDEO-25FPS-FRAME-CLOCK" "$REMOTE" || { echo 'СТОП: нет постоянных 25fps часов'; exit 3; }
grep -Fq "'-f','rawvideo','-pix_fmt','yuv420p','-s:v','1920x1080','-r',String(VIDEO_FPS),'-i','pipe:4'" "$REMOTE" || { echo 'СТОП: master не rawvideo'; exit 3; }
if grep -Fq "'-f','mpegts','-i','pipe:4'" "$REMOTE"; then echo 'СТОП: старый MPEG-TS master всё ещё найден'; exit 3; fi
grep -Fq "probeStationBestAudioStreamR784" "$REMOTE" || { echo 'СТОП: нет выбора реального station audio stream'; exit 3; }
grep -Fq "stationPreparedAudioByKey" "$REMOTE" || { echo 'СТОП: нет prepared station RMS verify'; exit 3; }
grep -Fq "CLIP_PREP_SUFFIX_R782 = '.r784-ready.mp4'" "$REMOTE" || { echo 'СТОП: нет принудительной свежей подготовки R784'; exit 3; }
grep -Fq "CTA_LIKE_OVERLAY_R783" "$REMOTE" || { echo 'СТОП: потеряна LIKE плашка'; exit 3; }
grep -Fq "R783-SUBSCRIBE-LIKE-ALTERNATE-EVERY-120S" "$REMOTE" || { echo 'СТОП: потеряно чередование SUBSCRIBE/LIKE'; exit 3; }
grep -Fq "TITLE_SWITCH_BEFORE_BOUNDARY_R781" "$REMOTE" || { echo 'СТОП: потерян R781 title handoff'; exit 3; }
grep -Fq "'-tag:v','7'" "$REMOTE" || { echo 'СТОП: нет FLV H264 tag=7'; exit 3; }
grep -Fq "'-tag:a','10'" "$REMOTE" || { echo 'СТОП: нет FLV AAC tag=10'; exit 3; }
grep -Fq "OUTPUT_FATAL_REGEX_R780" "$REMOTE" || { echo 'СТОП: нет R780 egress guard'; exit 3; }
if grep -Fq "setts=time_base" "$REMOTE"; then echo 'СТОП: найден запрещённый setts BSF'; exit 3; fi

# Assets used by the preserved R783 CTA layer.
CTA_REMOTE="$TMP/subscribe-right-r767.png"
LIKE_REMOTE="$TMP/like-right-r783.png"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r784-$STAMP" -o "$CTA_REMOTE"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/like-right-r783.png?v=55.00-r784-$STAMP" -o "$LIKE_REMOTE"
for f in "$CTA_REMOTE" "$LIKE_REMOTE"; do
  [ "$(stat -c%s "$f")" -gt 10000 ] || { echo "СТОП: asset слишком маленький: $f"; exit 3; }
  python3 - "$f" <<'PYPNG'
import sys
raise SystemExit(0 if open(sys.argv[1],'rb').read(8)==b'\x89PNG\r\n\x1a\n' else 1)
PYPNG
done

# Exact R784 transport preflight: two independent visual sections become one continuous
# raw frame sequence. No MPEG-TS PTS/DTS exists between feeder boundaries anymore.
FRAME_BYTES=$((1920*1080*3/2))
for n in 1 2; do
  ffmpeg -nostdin -hide_banner -loglevel error \
    -f lavfi -i "color=c=black:s=1920x1080:r=25" -t 0.6 \
    -pix_fmt yuv420p -f rawvideo "$TMP/v$n.raw"
done
cat "$TMP/v1.raw" "$TMP/v2.raw" > "$TMP/video.raw"
VB="$(stat -c%s "$TMP/video.raw")"
[ $((VB % FRAME_BYTES)) -eq 0 ] || { echo 'СТОП: rawvideo preflight не кратен целому кадру'; exit 3; }
ffmpeg -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'sine=frequency=440:sample_rate=44100' -t 1.2 -ac 2 -ar 44100 \
  -c:a pcm_s16le -f s16le "$TMP/audio.pcm"

ffmpeg -nostdin -hide_banner -loglevel warning \
  -thread_queue_size 8 -f rawvideo -pix_fmt yuv420p -s:v 1920x1080 -r 25 -i "$TMP/video.raw" \
  -thread_queue_size 8 -f s16le -ar 44100 -ac 2 -i "$TMP/audio.pcm" \
  -map 0:v:0 -map 1:a:0 \
  -c:v libx264 -preset ultrafast -tune zerolatency -profile:v high -level:v 4.1 \
  -b:v 6000k -minrate 6000k -maxrate 6000k -bufsize 12000k \
  -x264-params 'nal-hrd=cbr:force-cfr=1:repeat-headers=1:aud=1:keyint=50:min-keyint=50:scenecut=0' \
  -g 50 -keyint_min 50 -sc_threshold 0 -bf 0 -refs 1 -coder 1 -r 25 -pix_fmt yuv420p -tag:v 7 \
  -c:a aac -profile:a aac_low -b:a 160k -ar 44100 -ac 2 -tag:a 10 \
  -max_muxing_queue_size 4096 -flush_packets 1 \
  -f fifo -fifo_format flv -queue_size 2048 -drop_pkts_on_overflow 1 \
  -attempt_recovery 1 -recover_any_error 1 -recovery_wait_time 1 -restart_with_keyframe 1 \
  "$TMP/test.flv" 2>"$TMP/ffmpeg-preflight.log"

if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Could not write header|Error opening output file|Tag .* incompatible with output codec|Invalid argument' "$TMP/ffmpeg-preflight.log"; then
  echo 'СТОП: R784 rawvideo/FIFO preflight не прошёл:'
  cat "$TMP/ffmpeg-preflight.log"
  exit 3
fi
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$TMP/test.flv" | grep -Fq 'h264,1920,1080' || { echo 'СТОП: test FLV без 1080p H264'; exit 3; }
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$TMP/test.flv" | grep -Fq 'aac,44100,2' || { echo 'СТОП: test FLV без AAC 44.1k stereo'; exit 3; }

echo '[3/8] Backup current working server'
cp -a "$SERVER" "$BACKUP"

echo '[4/8] Install R784'
install -m 0644 "$REMOTE" "$SERVER"
install -m 0644 "$CTA_REMOTE" "$BASE/assets/subscribe-right-r767.png"
install -m 0644 "$LIKE_REMOTE" "$BASE/assets/like-right-r783.png"

echo '[5/8] Restart once'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 18
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/8] Status + real A/V byte movement'
STATUS1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R784-CONTINUOUS-RAWVIDEO-CLOCK-STATION-AUDIO-R783-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('masterTimestampMode')=='R784-RAWVIDEO-FRAME-NUMBER-MONOTONIC-NO-SEGMENT-DTS' and
 d.get('masterAvClockMode')=='R784-PERSISTENT-RAWVIDEO-N25+AUDIO-SAMPLE-CLOCK' and
 d.get('stationInsertSync')=='R784-ALL5-BEST-AUDIO-STREAM+OFFLINE-PCM-LEAD-TRIM+PREPARED-RMS-VERIFY' and
 d.get('ctaAlternateMode')=='R783-SUBSCRIBE-LIKE-ALTERNATE-EVERY-120S' and
 int(d.get('masterTimestampErrorCount') or 0)==0
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R784 status не подтвердился.'
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
  echo "❌ Нет A/V byte progress: audio $A1->$A2 video $V1->$V2"
  rollback; exit 5
fi

echo '[7/8] 90s live guard — zero timestamp discontinuities + socket health'
sleep 90
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Найдена regression R784:'
  grep -Ei 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 50 || true
  rollback; exit 6
fi
CLOSEWAIT="$(ss -tnp 2>/dev/null | awk '$1=="CLOSE-WAIT" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
echo "RTMPS sockets: ESTAB=$ESTAB CLOSE-WAIT=$CLOSEWAIT"
if [ "$CLOSEWAIT" -gt 8 ]; then echo '❌ Слишком много CLOSE-WAIT'; rollback; exit 6; fi
if [ "$ESTAB" -lt 1 ]; then echo '❌ Нет RTMPS/TLS ESTAB'; rollback; exit 6; fi

echo '[8/8] Final status'
STATUS="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("CLOCK:",d.get("masterTimestampMode"));print("TIMESTAMP ERRORS:",d.get("masterTimestampErrorCount"));print("AUDIO BYTES:",d.get("masterAudioBytesWritten"));print("VIDEO BYTES:",d.get("masterVideoBytesWritten"));print("STATION AUDIO:",d.get("stationPreparedAudioByKey"));print("ERROR:",d.get("lastError"))'
echo '✅ R784: MPEG-TS feeder timestamp resets removed; one persistent rawvideo 25fps clock'
echo '✅ R784: frame relay writes only complete 1920x1080 YUV420P frames'
echo '✅ R784: all 5 station inserts are rebuilt; best audible stream selected and prepared audio RMS-verified'
echo '✅ R783 SUBSCRIBE/LIKE alternation preserved'
echo '✅ R781 title handoff + R780 RTMPS/FLV guards preserved'
