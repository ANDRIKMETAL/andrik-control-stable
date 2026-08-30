#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r790.XXXXXX)"
REMOTE="$TMP/server.mjs"
CTA_REMOTE="$TMP/subscribe-right-r767.png"
LIKE_REMOTE="$TMP/like-right-r783.png"
BACKUP="$SERVER.bak-before-r790-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R790 live-check не прошёл — возвращаю предыдущий server.'
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

echo '[1/8] Download R790 server'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r790-$STAMP" -o "$REMOTE"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r790-$STAMP" -o "$CTA_REMOTE"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/like-right-r783.png?v=55.00-r790-$STAMP" -o "$LIKE_REMOTE"

echo '[2/8] Static audit: NO-CROP + no wall-clock title + continuous H264 master'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R790-IRONCLAD-AV-PTS-TITLE-CONTINUOUS-H264-R787-PRESERVED",
 "const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'",
 'LIVE_BOUNDARY_TITLE_FILE_R790',
 'R790-FFMPEG-PTS-LOCKED-NEXT-TITLE-DURING-BLACK-NO-WALLCLOCK-TIMER',
 'boundaryTitleSwitchAtR790',
 'rawH264VideoOutputArgsR790',
 "'-framerate',String(VIDEO_FPS),'-f','h264','-i','pipe:4'",
 'R790-PERSISTENT-RAW-H264-GENPTS-25FPS-NO-FEEDER-TIMESTAMPS-NO-SECOND-ENCODE',
 'R790-R752-CACHE-WARM+ONE-FFMPEG+BOTH-OUTPUTS-READY+SAME-TICK-ATOMIC-BOUNDARY',
 'Promise.all([',
 "streamReadableReadyR752(videoSource,'video',child)",
 "streamReadableReadyR752(audioSource,'audio',child)",
 'probeStationBestAudioStreamR784',
 "CLIP_PREP_SUFFIX_R782 = '.r787-ready.mp4'",
 'OUTPUT_FATAL_REGEX_R780',
]
forbidden=[
 'force_original_aspect_ratio=increase',
 'crop=',
 "'-f','rawvideo'",
 'output_ts_offset',
 'initial_discontinuity',
 'mpegTsVideoOutputArgsR787',
 'scheduleBoundaryTitleSwitchR781',
 'setts=time_base',
]
missing=[x for x in required if x not in s]
found=[x for x in forbidden if x in s]
other=[]
for i,line in enumerate(s.splitlines(),1):
    if 'scale=1920:1080' in line and 'const FULL_FRAME_FILTER_R787' not in line:
        other.append(f'line {i}: {line.strip()}')
if missing:
    print('СТОП: missing R790 markers:', ', '.join(missing)); raise SystemExit(3)
if found:
    print('СТОП: forbidden regression path:', ', '.join(found)); raise SystemExit(3)
if other:
    print('СТОП: найден обход immutable FULL_FRAME_FILTER_R787:'); print('\n'.join(other)); raise SystemExit(3)
if s.count('FULL_FRAME_FILTER_R787') < 5:
    print('СТОП: immutable full-frame filter не покрывает все video paths'); raise SystemExit(3)
print('R790 static audit OK')
PY

for f in "$CTA_REMOTE" "$LIKE_REMOTE"; do
  [ "$(stat -c%s "$f")" -gt 2500 ] || { echo "СТОП: asset слишком маленький: $f"; exit 3; }
  python3 - "$f" <<'PYPNG'
import sys
raise SystemExit(0 if open(sys.argv[1],'rb').read(8)==b'\x89PNG\r\n\x1a\n' else 1)
PYPNG
done

# Permanent geometry proof: all source edges remain visible. cropdetect is TEST-ONLY;
# production source was audited above and contains no crop= filter.
FIT="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
check_fit(){
  local src="$1" expected="$2" got
  got="$(ffmpeg -nostdin -hide_banner -loglevel info -f lavfi -i "color=white:s=${src}:r=25" -frames:v 5 \
    -vf "$FIT,cropdetect=limit=16:round=2:reset=1" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -n1 || true)"
  [ "$got" = "$expected" ] || { echo "СТОП: геометрия ${src} не CONTAIN/FIT+PAD; got=${got} expected=${expected}"; exit 3; }
  echo "FULL-FRAME ${src}: OK"
}
check_fit 640x480 'crop=1440:1080:240:0'
check_fit 1080x1920 'crop=608:1080:656:0'
check_fit 2560x1080 'crop=1920:810:0:134'
check_fit 1920x1080 'crop=1920:1080:0:0'

# PTS-bound title primitive: current and next title switch on FFmpeg t, not a Node timer.
printf 'ANDRIK — CURRENT\n' > "$TMP/current.txt"
printf 'ANDRIK — NEXT\n' > "$TMP/boundary.txt"
ffmpeg -y -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'color=c=black:s=640x360:r=25:d=2' \
  -vf "drawtext=textfile='$TMP/current.txt':fontcolor=white:fontsize=28:x=10:y=10:enable='lt(t\\,1.425)',drawtext=textfile='$TMP/boundary.txt':fontcolor=white:fontsize=28:x=10:y=10:enable='gte(t\\,1.425)'" \
  -t 2 -c:v libx264 -preset ultrafast "$TMP/title-pts-test.mp4"
[ "$(stat -c%s "$TMP/title-pts-test.mp4")" -gt 1000 ] || { echo 'СТОП: PTS title test failed'; exit 3; }

# Exact R790 transport primitive: independent feeder encoders are concatenated as raw
# Annex-B H264. ONE persistent H264 demuxer assigns a continuous 25fps clock. No feeder
# PTS/DTS survives into the master, so there is nothing to jump at boundaries.
for n in 1 2 3; do
  ffmpeg -y -nostdin -hide_banner -loglevel error \
    -f lavfi -i "testsrc2=s=640x360:r=25" -t 1.2 \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -x264-params 'repeat-headers=1:aud=1:keyint=50:min-keyint=50:scenecut=0:bframes=0' \
    -pix_fmt yuv420p -f h264 "$TMP/seg${n}.h264"
done
cat "$TMP/seg1.h264" "$TMP/seg2.h264" "$TMP/seg3.h264" > "$TMP/video.h264"
ffmpeg -y -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'sine=frequency=440:sample_rate=44100' -t 3.6 -ac 2 -ar 44100 \
  -c:a pcm_s16le -f s16le "$TMP/audio.pcm"
ffmpeg -y -nostdin -hide_banner -loglevel warning \
  -thread_queue_size 8 -fflags +genpts+discardcorrupt -framerate 25 -f h264 -i "$TMP/video.h264" \
  -thread_queue_size 8 -f s16le -ar 44100 -ac 2 -i "$TMP/audio.pcm" \
  -map 0:v:0 -map 1:a:0 -c:v copy -tag:v 7 \
  -c:a aac -profile:a aac_low -b:a 160k -ar 44100 -ac 2 -tag:a 10 \
  -max_muxing_queue_size 4096 -flush_packets 1 \
  -f fifo -fifo_format flv -queue_size 2048 -timeshift 0 -drop_pkts_on_overflow 1 \
  -attempt_recovery 1 -recover_any_error 1 -recovery_wait_time 1 -restart_with_keyframe 1 \
  "$TMP/test.flv" 2>"$TMP/ffmpeg-preflight.log"

if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|Bitstream filter not found|Invalid argument' "$TMP/ffmpeg-preflight.log"; then
  echo 'СТОП: R790 continuous-H264/FIFO preflight не прошёл:'
  cat "$TMP/ffmpeg-preflight.log"
  exit 3
fi
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,r_frame_rate -of csv=p=0 "$TMP/test.flv" | grep -Fq 'h264,25/1' || { echo 'СТОП: test FLV без H264 25fps'; exit 3; }
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "$TMP/test.flv" | grep -Fq 'aac,44100,2' || { echo 'СТОП: test FLV без AAC 44.1k stereo'; exit 3; }
ffprobe -v error -select_streams v:0 -show_packets -show_entries packet=pts_time -of csv=p=0 "$TMP/test.flv" > "$TMP/vpts.txt"
python3 - "$TMP/vpts.txt" <<'PYPTS'
import sys
pts=[]
for line in open(sys.argv[1],encoding='utf-8',errors='ignore'):
    try: pts.append(float(line.strip().split(',')[0]))
    except: pass
if len(pts)<70: raise SystemExit('СТОП: слишком мало video packets')
for a,b in zip(pts,pts[1:]):
    d=b-a
    if d <= 0 or d > 0.081:
        raise SystemExit(f'СТОП: video PTS discontinuity {a}->{b} delta={d}')
print(f'R790 PTS proof OK: {len(pts)} packets, continuous 25fps')
PYPTS

echo '[3/8] Backup current working server'
cp -a "$SERVER" "$BACKUP"

echo '[4/8] Install R790'
install -m 0644 "$REMOTE" "$SERVER"
install -m 0644 "$CTA_REMOTE" "$ASSET_DIR/subscribe-right-r767.png"
install -m 0644 "$LIKE_REMOTE" "$ASSET_DIR/like-right-r783.png"

echo '[5/8] One restart'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 18
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/8] Status + real A/V movement'
STATUS1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R790-IRONCLAD-AV-PTS-TITLE-CONTINUOUS-H264-R787-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('permanentFullscreenFitPolicy')=='R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE' and
 d.get('masterTimestampMode')=='R790-PERSISTENT-RAW-H264-GENPTS-25FPS-NO-FEEDER-TIMESTAMPS-NO-SECOND-ENCODE' and
 d.get('currentTitleHandoff')=='R790-FFMPEG-PTS-LOCKED-NEXT-TITLE-DURING-BLACK-NO-WALLCLOCK' and
 d.get('clipAvSyncMode')=='R790-R752-CACHE-WARM+ONE-FFMPEG+BOTH-OUTPUTS-READY+SAME-TICK-ATOMIC-BOUNDARY' and
 int(d.get('masterTimestampErrorCount') or 0)==0
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R790 status не подтвердился.'
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

echo '[7/8] 75s live guard — zero runtime timestamp discontinuities + RTMPS healthy'
sleep 75
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|Bitstream filter not found|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Найдена R790 regression:'
  grep -Ei 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Tag .* incompatible with output codec|Could not write header|Error opening output file|Bitstream filter not found|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 80 || true
  rollback; exit 6
fi
STATUS3="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
ERRCOUNT="$(STATUS_JSON="$STATUS3" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterTimestampErrorCount") or 0))' 2>/dev/null || echo 999)"
[ "$ERRCOUNT" -eq 0 ] || { echo "❌ timestamp errors=$ERRCOUNT"; rollback; exit 6; }
CLOSEWAIT="$(ss -tnp 2>/dev/null | awk '$1=="CLOSE-WAIT" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
QUEUEBLOCKS="$(grep -Eic 'Thread message queue blocking' "$TMP/live.log" || true)"
echo "RTMPS sockets: ESTAB=$ESTAB CLOSE-WAIT=$CLOSEWAIT | queue notices=$QUEUEBLOCKS"
if [ "$CLOSEWAIT" -gt 8 ] || [ "$ESTAB" -lt 1 ]; then echo '❌ RTMPS socket health failed'; rollback; exit 6; fi

echo '[8/8] Final status'
STATUS="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("FULL FRAME:",d.get("fullFrameGuardMode"));print("TITLE CLOCK:",d.get("currentTitleHandoff"));print("INSERT A/V:",d.get("clipAvSyncMode"));print("TIMESTAMP MODE:",d.get("masterTimestampMode"));print("TIMESTAMP ERRORS:",d.get("masterTimestampErrorCount"));print("AUDIO BYTES:",d.get("masterAudioBytesWritten"));print("VIDEO BYTES:",d.get("masterVideoBytesWritten"));print("ERROR:",d.get("lastError"))'
echo '✅ R790: MP3 title + fade use the same FFmpeg PTS clock; no Node title timer'
echo '✅ R790: inserts remain ONE FFmpeg, BOTH outputs ready, same-tick A/V boundary'
echo '✅ R790: one persistent raw-H264 25fps master clock; feeder timestamp discontinuities removed'
echo '✅ R787 permanent FIT+PAD NO-CROP preserved unchanged'
echo '✅ R784 station-audio verification + R783 CTA + R780 RTMPS/FLV egress guard preserved'
