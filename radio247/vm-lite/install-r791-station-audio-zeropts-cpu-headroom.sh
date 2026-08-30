#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r791.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r791-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R791 live-check не прошёл — возвращаю предыдущий server.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 10
  systemctl is-active "$SERVICE" || true
}

for c in curl node python3 ffmpeg ffprobe systemctl journalctl grep stat install cp ss awk; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }


echo '[1/7] Download R791 server'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r791-$STAMP" -o "$REMOTE"


echo '[2/7] Static audit + station-audio PTS proof'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R791-STATION-AUDIO-ZEROPTS-CPU-HEADROOM-R790-PRESERVED",
 "STATION_PREP_MARKER_R791",
 "asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0",
 "BACKGROUND_LOUDNESS_ENABLED_R791 = false",
 "R791-R790-ONE-FFMPEG+BOTH-READY+SAME-TICK+STATION-AUDIO-PTS0-BEFORE-RESAMPLE",
 "const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'",
 "rawH264VideoOutputArgsR790",
 "Promise.all([",
 "streamReadableReadyR752(videoSource,'video',child)",
 "streamReadableReadyR752(audioSource,'audio',child)",
]
forbidden=['force_original_aspect_ratio=increase','crop=',"'-f','rawvideo'",'output_ts_offset','initial_discontinuity']
missing=[x for x in required if x not in s]
found=[x for x in forbidden if x in s]
if missing:
    print('СТОП: missing R791 markers:', ', '.join(missing)); raise SystemExit(3)
if found:
    print('СТОП: forbidden regression path:', ', '.join(found)); raise SystemExit(3)
print('R791 static audit OK')
PY

# Synthetic proof of the exact bug: video starts at 0, AAC packets start ~2 s later.
# Old order (aresample first_pts=0 before timestamp reset) creates ~2 s of silence.
# R791 resets audio PTS BEFORE resample, so the first real sample lands at t≈0.
ffmpeg -y -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'color=c=blue:s=640x360:r=25:d=3' \
  -itsoffset 2 -f lavfi -i 'sine=frequency=880:sample_rate=44100:duration=1' \
  -map 0:v -map 1:a -c:v libx264 -preset ultrafast -c:a aac -b:a 160k -t 3 "$TMP/delayed-audio.mp4"
FIRST_AUDIO="$(ffprobe -v error -select_streams a:0 -show_packets -show_entries packet=pts_time -of csv=p=0 "$TMP/delayed-audio.mp4" | head -n1 | cut -d, -f1)"
python3 - "$FIRST_AUDIO" <<'PY'
import sys
x=float(sys.argv[1])
if x < 1.5: raise SystemExit(f'СТОП: synthetic delayed AAC did not start late enough: {x}')
print(f'Synthetic source AAC starts at {x:.3f}s')
PY
ffmpeg -y -nostdin -hide_banner -loglevel error -i "$TMP/delayed-audio.mp4" \
  -map 0:a:0 -af 'asetpts=PTS-STARTPTS,aresample=44100:async=0:first_pts=0,apad=pad_dur=3,atrim=duration=3,asetpts=N/SR/TB' \
  -c:a pcm_s16le -ar 44100 -ac 2 -f s16le "$TMP/fixed.pcm"
python3 - "$TMP/fixed.pcm" <<'PY'
from pathlib import Path
import struct,sys,math
b=Path(sys.argv[1]).read_bytes(); vals=struct.unpack('<'+'h'*(len(b)//2),b)
sr=44100; ch=2; block=int(sr*.02)*ch; first=None
for i in range(0,len(vals)-block+1,block):
    v=vals[i:i+block]
    rms=(sum(x*x for x in v)/len(v))**0.5
    if rms>100:
        first=i/(sr*ch); break
if first is None or first>0.08: raise SystemExit(f'СТОП: R791 station audio still late: first={first}')
print(f'R791 station-audio proof OK: first real sound={first:.3f}s')
PY

# Permanent NO-CROP proof unchanged from R787.
FIT="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
for spec in '640x480 crop=1440:1080:240:0' '1080x1920 crop=608:1080:656:0' '2560x1080 crop=1920:810:0:134' '1920x1080 crop=1920:1080:0:0'; do
  set -- $spec; src="$1"; expected="$2"
  got="$(ffmpeg -nostdin -hide_banner -loglevel info -f lavfi -i "color=white:s=${src}:r=25" -frames:v 5 -vf "$FIT,cropdetect=limit=16:round=2:reset=1" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -n1 || true)"
  [ "$got" = "$expected" ] || { echo "СТОП: NO-CROP proof failed ${src}: $got"; exit 3; }
done


echo '[3/7] Backup current server'
cp -a "$SERVER" "$BACKUP"


echo '[4/7] Install R791 + one restart'
install -m 0644 "$REMOTE" "$SERVER"
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 18
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi


echo '[5/7] Status + A/V movement'
S1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$S1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R791-STATION-AUDIO-ZEROPTS-CPU-HEADROOM-R790-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('backgroundLoudnessEnabled') is False and
 d.get('stationPreparedAudioClock')=='R791-PTS-STARTPTS-BEFORE-ARESAMPLE-SAMPLECOUNT-CLOCK' and
 d.get('permanentFullscreenFitPolicy')=='R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE' and
 int(d.get('masterTimestampErrorCount') or 0)==0
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R791 status не подтвердился.'; printf '%s\n' "$S1" | python3 -m json.tool 2>/dev/null || true; rollback; exit 5
fi
A1="$(STATUS_JSON="$S1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterAudioBytesWritten") or 0))')"
V1="$(STATUS_JSON="$S1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterVideoBytesWritten") or 0))')"
sleep 12
S2="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
A2="$(STATUS_JSON="$S2" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterAudioBytesWritten") or 0))' 2>/dev/null || echo 0)"
V2="$(STATUS_JSON="$S2" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterVideoBytesWritten") or 0))' 2>/dev/null || echo 0)"
[ "$A2" -gt "$A1" ] && [ "$V2" -gt "$V1" ] || { echo "❌ A/V stopped: A $A1->$A2 V $V1->$V2"; rollback; exit 5; }


echo '[6/7] 60s live guard'
sleep 60
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Could not write header|Error opening output file|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Runtime timestamp/transport regression:'
  grep -Ei 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|Could not write header|Error opening output file|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 60 || true
  rollback; exit 6
fi
if grep -Fq '[loudness-r750-background]' "$TMP/live.log"; then
  echo '❌ Background loudness process unexpectedly ran'; rollback; exit 6
fi
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
[ "$ESTAB" -ge 1 ] || { echo '❌ RTMPS not ESTABLISHED'; rollback; exit 6; }


echo '[7/7] Final status'
curl -fsS --max-time 4 http://127.0.0.1:8080/status | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("STATION CLOCK:",d.get("stationPreparedAudioClock"));print("BACKGROUND LOUDNESS:",d.get("backgroundLoudnessEnabled"));print("TIMESTAMP ERRORS:",d.get("masterTimestampErrorCount"));print("ERROR:",d.get("lastError"))'
echo '✅ R791: station audio positive PTS is stripped BEFORE resample — no 2s silent pad'
echo '✅ Station inserts still use ONE FFmpeg + BOTH outputs ready + SAME-TICK live boundary'
echo '✅ Background loudness scans disabled to free CPU for the live encoder'
echo '✅ R790 title/PTS architecture + R787 NO-CROP preserved'
