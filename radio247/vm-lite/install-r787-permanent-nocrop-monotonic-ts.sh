#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r787.XXXXXX)"
REMOTE="$TMP/server.mjs"
CTA_REMOTE="$TMP/subscribe-right-r767.png"
LIKE_REMOTE="$TMP/like-right-r783.png"
BACKUP="$SERVER.bak-before-r787-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R787 live-check не прошёл — возвращаю предыдущий server.'
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
mkdir -p "$ASSET_DIR"

echo '[1/8] Download R787'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r787-$STAMP" -o "$REMOTE"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r787-$STAMP" -o "$CTA_REMOTE"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/like-right-r783.png?v=55.00-r787-$STAMP" -o "$LIKE_REMOTE"

echo '[2/8] Permanent NO-CROP source audit + exact transport preflight'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R787-PERMANENT-NOCROP-MONOTONIC-TS-R786-R784-PRESERVED",
 "const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'",
 'R787-PERMANENT-NOCROP-GUARD',
 'mpegTsVideoOutputArgsR787',
 "'-output_ts_offset'",
 'R787-MPEGTS-MONOTONIC-OFFSET-NO-BACKWARD-DTS-NO-SECOND-ENCODE',
 'probeStationBestAudioStreamR784',
 'stationPreparedAudioByKey',
 "CLIP_PREP_SUFFIX_R782 = '.r787-ready.mp4'",
 'CTA_LIKE_OVERLAY_R783',
 'TITLE_SWITCH_BEFORE_BOUNDARY_R781',
 'OUTPUT_FATAL_REGEX_R780',
]
missing=[x for x in required if x not in s]
forbidden=[
 'force_original_aspect_ratio=increase',
 'crop=',
 "'-f','rawvideo'",
 'setts=time_base',
]
found=[x for x in forbidden if x in s]
# All 1920x1080 source geometry must come from ONE immutable CONTAIN constant.
other=[]
for i,line in enumerate(s.splitlines(),1):
    if 'scale=1920:1080' in line and 'const FULL_FRAME_FILTER_R787' not in line:
        other.append(f'line {i}: {line.strip()}')
if missing:
    print('СТОП: missing R787 markers:', ', '.join(missing)); raise SystemExit(3)
if found:
    print('СТОП: forbidden crop/rawvideo path:', ', '.join(found)); raise SystemExit(3)
if other:
    print('СТОП: найден обход immutable FULL_FRAME_FILTER_R787:'); print('\n'.join(other)); raise SystemExit(3)
if s.count('FULL_FRAME_FILTER_R787') < 5:
    print('СТОП: immutable full-frame filter не покрывает все video paths'); raise SystemExit(3)
print('R787 static guard OK: crop/zoom/rawvideo forbidden globally')
PY

for f in "$CTA_REMOTE" "$LIKE_REMOTE"; do
  [ "$(stat -c%s "$f")" -gt 2500 ] || { echo "СТОП: asset слишком маленький: $f"; exit 3; }
  python3 - "$f" <<'PYPNG'
import sys
raise SystemExit(0 if open(sys.argv[1],'rb').read(8)==b'\x89PNG\r\n\x1a\n' else 1)
PYPNG
done

# Geometry proof: cropdetect measures the NON-BLACK source rectangle after the exact
# immutable CONTAIN filter. The source edges must survive. Expected values prove FIT+PAD,
# not FILL/crop, for 4:3, portrait, ultra-wide and native 16:9.
FIT="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
check_fit(){
  local src="$1" expected="$2" got
  got="$(ffmpeg -nostdin -hide_banner -loglevel info -f lavfi -i "color=white:s=${src}:r=25" -frames:v 5 \
    -vf "$FIT,cropdetect=limit=16:round=2:reset=1" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -n1 || true)"
  echo "NO-CROP ${src}: ${got}"
  [ "$got" = "$expected" ] || { echo "СТОП: геометрия ${src} не CONTAIN/FIT+PAD; ожидалось ${expected}"; exit 3; }
}
check_fit 640x480 'crop=1440:1080:240:0'
check_fit 1080x1920 'crop=608:1080:656:0'
check_fit 2560x1080 'crop=1920:810:0:134'
check_fit 1920x1080 'crop=1920:1080:0:0'

# R787 exact timestamp primitive: independent H264/MPEGTS feeder processes retain the
# R783 visual path but receive monotonic offsets. The persistent master must see no
# backward DTS/timestamp discontinuity while copying H264 to FIFO/FLV.
for spec in '0 black' '1.2 white'; do
  set -- $spec; off="$1"; color="$2"
  ffmpeg -nostdin -hide_banner -loglevel error \
    -f lavfi -i "color=c=${color}:s=1920x1080:r=25" -t 1.2 \
    -c:v libx264 -preset ultrafast -tune zerolatency -profile:v high -level:v 4.1 \
    -b:v 6000k -minrate 6000k -maxrate 6000k -bufsize 12000k \
    -x264-params 'nal-hrd=cbr:force-cfr=1:repeat-headers=1:aud=1:keyint=50:min-keyint=50:scenecut=0' \
    -g 50 -keyint_min 50 -sc_threshold 0 -bf 0 -refs 1 -coder 1 -r 25 -pix_fmt yuv420p \
    -output_ts_offset "$off" -mpegts_flags +resend_headers+initial_discontinuity -muxdelay 0 -muxpreload 0 \
    -f mpegts "$TMP/seg-${off}.ts"
done
cat "$TMP/seg-0.ts" "$TMP/seg-1.2.ts" > "$TMP/video.ts"
ffmpeg -nostdin -hide_banner -loglevel error -f lavfi -i 'sine=frequency=440:sample_rate=44100' -t 2.4 -ac 2 -ar 44100 -c:a pcm_s16le -f s16le "$TMP/audio.pcm"
ffmpeg -nostdin -hide_banner -loglevel warning \
  -fflags +genpts+discardcorrupt -f mpegts -i "$TMP/video.ts" \
  -f s16le -ar 44100 -ac 2 -i "$TMP/audio.pcm" \
  -map 0:v:0 -map 1:a:0 -c:v copy -tag:v 7 \
  -c:a aac -profile:a aac_low -b:a 160k -ar 44100 -ac 2 -tag:a 10 \
  -max_muxing_queue_size 4096 -flush_packets 1 \
  -f fifo -fifo_format flv -queue_size 2048 -drop_pkts_on_overflow 1 \
  -attempt_recovery 1 -recover_any_error 1 -recovery_wait_time 1 -restart_with_keyframe 1 \
  "$TMP/test.flv" 2>"$TMP/ffmpeg-preflight.log"

if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|Timestamps are unset|Bitstream filter not found|Invalid argument' "$TMP/ffmpeg-preflight.log"; then
  echo 'СТОП: R787 monotonic MPEGTS/FIFO preflight не прошёл:'
  cat "$TMP/ffmpeg-preflight.log"
  exit 3
fi
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$TMP/test.flv" | grep -Fq 'h264,1920,1080' || { echo 'СТОП: test FLV без H264 1920x1080'; exit 3; }
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$TMP/test.flv" | grep -Fq 'aac,44100,2' || { echo 'СТОП: test FLV без AAC 44.1k stereo'; exit 3; }

echo '[3/8] Backup current server'
cp -a "$SERVER" "$BACKUP"

echo '[4/8] Install R787'
install -m 0644 "$REMOTE" "$SERVER"
install -m 0644 "$CTA_REMOTE" "$ASSET_DIR/subscribe-right-r767.png"
install -m 0644 "$LIKE_REMOTE" "$ASSET_DIR/like-right-r783.png"

echo '[5/8] Restart once'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 18
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/8] Status + A/V byte movement'
STATUS1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R787-PERMANENT-NOCROP-MONOTONIC-TS-R786-R784-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('fullFrameGuardMode')=='R787-R783-VIEWER-PROVEN-FIT-PAD-1920x1080-SAR1-NO-RAWVIDEO' and
 d.get('permanentFullscreenFitPolicy')=='R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE' and
 d.get('masterTimestampMode')=='R787-MPEGTS-MONOTONIC-OFFSET-NO-BACKWARD-DTS-NO-SECOND-ENCODE' and
 d.get('stationInsertSync')=='R784-ALL5-BEST-AUDIO-STREAM+OFFLINE-PCM-LEAD-TRIM+PREPARED-RMS-VERIFY' and
 int(d.get('masterTimestampErrorCount') or 0)==0
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R787 status не подтвердился.'
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

echo '[7/8] 90s live guard — crop path forbidden, timestamps zero, RTMPS healthy'
sleep 90
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|Timestamps are unset|Bitstream filter not found|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Найдена regression R787:'
  grep -Ei 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|Timestamps are unset|Bitstream filter not found|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 60 || true
  rollback; exit 6
fi
STATUS3="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
ERRCOUNT="$(STATUS_JSON="$STATUS3" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterTimestampErrorCount") or 0))' 2>/dev/null || echo 999)"
[ "$ERRCOUNT" -eq 0 ] || { echo "❌ timestamp errors=$ERRCOUNT"; rollback; exit 6; }
CLOSEWAIT="$(ss -tnp 2>/dev/null | awk '$1=="CLOSE-WAIT" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
echo "RTMPS sockets: ESTAB=$ESTAB CLOSE-WAIT=$CLOSEWAIT"
if [ "$CLOSEWAIT" -gt 8 ] || [ "$ESTAB" -lt 1 ]; then echo '❌ RTMPS socket health failed'; rollback; exit 6; fi

echo '[8/8] Final status'
STATUS="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("FULL FRAME:",d.get("fullFrameGuardMode"));print("FIT POLICY:",d.get("permanentFullscreenFitPolicy"));print("TIMESTAMP MODE:",d.get("masterTimestampMode"));print("TIMESTAMP ERRORS:",d.get("masterTimestampErrorCount"));print("TS OFFSET:",d.get("videoTimestampOffsetSecondsR787"));print("AUDIO BYTES:",d.get("masterAudioBytesWritten"));print("VIDEO BYTES:",d.get("masterVideoBytesWritten"));print("STATION AUDIO:",d.get("stationPreparedAudioByKey"));print("ERROR:",d.get("lastError"))'
echo '✅ R787: RAWVIDEO R784/R785 transport removed; restored viewer-proven R783 encoded full-frame path'
echo '✅ R787: ONE immutable CONTAIN filter for every source: FIT decrease + centered PAD + SAR1; crop/zoom/increase forbidden'
echo '✅ R787: MPEGTS feeder clocks get monotonic output_ts_offset; no backward DTS at boundaries'
echo '✅ R784 station audio best-stream + RMS verification preserved'
echo '✅ R783 SUBSCRIBE/LIKE + R781 titles + R780 RTMPS/FLV guard preserved'
