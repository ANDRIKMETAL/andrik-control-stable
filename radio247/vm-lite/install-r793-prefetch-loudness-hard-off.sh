#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r793.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r793-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R793 live-check не прошёл — возвращаю предыдущий server.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 10
  systemctl is-active "$SERVICE" || true
}

for c in curl node python3 ffmpeg ffprobe systemctl journalctl grep stat install cp ss awk sha256sum; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Download R793 server'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r793-$STAMP" -o "$REMOTE"

echo '[2/8] Static audit: R793 prefetch loudness hard-off + R792 no-gap/dual RTMPS'
node --check "$REMOTE" >/dev/null
python3 - "$REMOTE" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 "R793-PREFETCH-LOUDNESS-HARD-OFF-R792-PRESERVED",
 "STATION_BOUNDARY_DRAIN_MS_R792",
 "R792-STATION-ARM-BEHIND-LIVE-BLACK-NO-H264-GAP",
 "R792-STATION-BOTH-READY-DRAINING-OLD-BLACK-QUEUE",
 "R792-STATION-SAME-TICK-UNIFIED-AV-LIVE",
 "R792-INSERT-ABORT-KEEP-EXISTING-LIVE-FEEDER",
 "STREAM_BACKUP_URL",
 "rtmps://b.rtmps.youtube.com:443/live2?backup=1/",
 "'-f','tee','-use_fifo','1'",
 "countEstablishedRtmpsR792",
 "RTMPS_EGRESS_ZERO_GRACE_MS_R792",
 "asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0",
 "BACKGROUND_LOUDNESS_ENABLED_R791 = false",
 "backgroundPrefetchLoudnessPolicyR793",
 "if(BACKGROUND_LOUDNESS_ENABLED_R791) scheduleLoudnessAnalysisR750(path);",
 "const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'",
 "Promise.all([",
 "streamReadableReadyR752(videoSource,'video',child)",
 "streamReadableReadyR752(audioSource,'audio',child)",
]
forbidden=['force_original_aspect_ratio=increase','crop=',"'-f','rawvideo'",'output_ts_offset','initial_discontinuity']
missing=[x for x in required if x not in s]
found=[x for x in forbidden if x in s]
if "downloadTrackToCache(item).then(path=>scheduleLoudnessAnalysisR750(path))" in s:
    raise SystemExit('СТОП: R750 unconditional prefetch loudness path still present')
if missing:
    print('СТОП: missing R792 markers:', ', '.join(missing)); raise SystemExit(3)
if found:
    print('СТОП: forbidden regression path:', ', '.join(found)); raise SystemExit(3)
# Ordering proof for STATION: it must arm both outputs BEFORE the station-side detach.
arm=s.index("R792-STATION-ARM-BEHIND-LIVE-BLACK-NO-H264-GAP")
ready=s.index("streamReadableReadyR752(videoSource,'video',child)",arm)
station_drain=s.index("R792-STATION-BOTH-READY-DRAINING-OLD-BLACK-QUEUE",ready)
station_detach=s.rfind('detachNormalVideoAtBoundaryR752();',ready,station_drain)
pipe=s.index('videoSource.pipe(videoSink,{end:false});',station_drain)
audio_pipe=s.index('audioSource.pipe(audioSink,{end:false});',pipe)
if not (arm < ready < station_detach < station_drain < pipe < audio_pipe):
    raise SystemExit('СТОП: station arm/cut/same-tick ordering regression')
print('R793 static audit + R792 ordering audit OK')
PY

# Exact old 2-second station-audio bug proof, inherited from R791.
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
import struct,sys
b=Path(sys.argv[1]).read_bytes(); vals=struct.unpack('<'+'h'*(len(b)//2),b)
sr=44100; ch=2; block=int(sr*.02)*ch; first=None
for i in range(0,len(vals)-block+1,block):
    v=vals[i:i+block]
    rms=(sum(x*x for x in v)/len(v))**0.5
    if rms>100:
        first=i/(sr*ch); break
if first is None or first>0.08: raise SystemExit(f'СТОП: station audio still late: first={first}')
print(f'R792/R791 station-audio PTS proof OK: first real sound={first:.3f}s')
PY

# Permanent NO-CROP proof unchanged from R787.
FIT="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
for spec in '640x480 crop=1440:1080:240:0' '1080x1920 crop=608:1080:656:0' '2560x1080 crop=1920:810:0:134' '1920x1080 crop=1920:1080:0:0'; do
  set -- $spec; src="$1"; expected="$2"
  got="$(ffmpeg -nostdin -hide_banner -loglevel info -f lavfi -i "color=white:s=${src}:r=25" -frames:v 5 -vf "$FIT,cropdetect=limit=16:round=2:reset=1" -f null - 2>&1 | grep -o 'crop=[0-9:]*' | tail -n1 || true)"
  [ "$got" = "$expected" ] || { echo "СТОП: NO-CROP proof failed ${src}: $got"; exit 3; }
done

# Local tee/fifo proof: one encoded timeline must reach two FLV outputs byte-identically.
ffmpeg -y -nostdin -hide_banner -loglevel error \
  -f lavfi -i 'testsrc2=s=320x180:r=25:d=2' \
  -f lavfi -i 'sine=frequency=440:sample_rate=44100:duration=2' \
  -map 0:v:0 -map 1:a:0 -c:v libx264 -preset ultrafast -tune zerolatency -g 50 -bf 0 \
  -c:a aac -b:a 160k -tag:v 7 -tag:a 10 \
  -f tee -use_fifo 1 \
  -fifo_options 'queue_size=256:timeshift=0.2:drop_pkts_on_overflow=1:attempt_recovery=1:recover_any_error=1:recovery_wait_time=0.25:restart_with_keyframe=1' \
  "[f=flv:onfail=ignore]$TMP/primary.flv|[f=flv:onfail=ignore]$TMP/backup.flv"
[ -s "$TMP/primary.flv" ] && [ -s "$TMP/backup.flv" ] || { echo 'СТОП: dual tee output missing'; exit 3; }
H1="$(sha256sum "$TMP/primary.flv" | awk '{print $1}')"; H2="$(sha256sum "$TMP/backup.flv" | awk '{print $1}')"
[ "$H1" = "$H2" ] || { echo 'СТОП: primary/backup tee packet streams differ'; exit 3; }
echo 'R793/R792 local dual-ingest packet identity proof OK'

echo '[3/8] Backup current server'
cp -a "$SERVER" "$BACKUP"

echo '[4/8] Install R793 + one restart'
install -m 0644 "$REMOTE" "$SERVER"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 20
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi
INVOCATION_ID="$(systemctl show "$SERVICE" -p InvocationID --value 2>/dev/null || true)"
MAINPID="$(systemctl show "$SERVICE" -p MainPID --value 2>/dev/null || echo 0)"
NR0="$(systemctl show "$SERVICE" -p NRestarts --value 2>/dev/null || echo 0)"
echo "R793 current invocation: ${INVOCATION_ID:-unknown} pid=${MAINPID:-0}"

echo '[5/8] Status + A/V movement'
S1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$S1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(
 d.get('version')=='R793-PREFETCH-LOUDNESS-HARD-OFF-R792-PRESERVED' and
 d.get('publisherRunning') is True and d.get('transportHealthy') is True and
 d.get('backgroundLoudnessEnabled') is False and
 d.get('backgroundPrefetchLoudnessPolicyR793')=='DOWNLOAD-ONLY-WHEN-BACKGROUND-OFF' and
 d.get('stationPreparedAudioClock')=='R791-PTS-STARTPTS-BEFORE-ARESAMPLE-SAMPLECOUNT-CLOCK' and
 d.get('stationArmPolicyR792')=='KEEP-LIVE-BLACK-UNTIL-BOTH-READY-THEN-DRAIN-Q8-AND-SAME-TICK' and
 d.get('permanentFullscreenFitPolicy')=='R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE' and
 int(d.get('masterTimestampErrorCount') or 0)==0
)
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R793 status не подтвердился.'; printf '%s\n' "$S1" | python3 -m json.tool 2>/dev/null || true; rollback; exit 5
fi
A1="$(STATUS_JSON="$S1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterAudioBytesWritten") or 0))')"
V1="$(STATUS_JSON="$S1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterVideoBytesWritten") or 0))')"
sleep 12
S2="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
A2="$(STATUS_JSON="$S2" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterAudioBytesWritten") or 0))' 2>/dev/null || echo 0)"
V2="$(STATUS_JSON="$S2" python3 -c 'import os,json;d=json.loads(os.environ.get("STATUS_JSON","{}"));print(int(d.get("masterVideoBytesWritten") or 0))' 2>/dev/null || echo 0)"
[ "$A2" -gt "$A1" ] && [ "$V2" -gt "$V1" ] || { echo "❌ A/V stopped: A $A1->$A2 V $V1->$V2"; rollback; exit 5; }

echo '[6/8] RTMPS lanes'
ESTAB="$(ss -tnp 2>/dev/null | awk '$1=="ESTAB" && $5 ~ /:443$/ && /ffmpeg/ {c++} END{print c+0}')"
echo "RTMPS ESTABLISHED: $ESTAB"
[ "$ESTAB" -ge 1 ] || { echo '❌ no RTMPS lane established'; rollback; exit 6; }
if [ "$ESTAB" -lt 2 ]; then echo '⚠️ Backup lane ещё не ESTABLISHED; primary is live, R792 watchdog will keep checking.'; fi

echo '[7/8] 75s live guard'
sleep 75
if [ -n "${INVOCATION_ID:-}" ]; then
  journalctl _SYSTEMD_INVOCATION_ID="$INVOCATION_ID" --no-pager > "$TMP/live.log" 2>/dev/null || true
else
  journalctl -u "$SERVICE" --since "90 seconds ago" --no-pager > "$TMP/live.log" 2>/dev/null || true
fi
if grep -Eqi 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|incompatible with output codec|bitstream filter not found|master pipe NO-PROGRESS|R792 RTMPS EGRESS LOST' "$TMP/live.log"; then
  echo '❌ Runtime A/V timestamp or total-egress regression:'
  grep -Ei 'DTS .*out of order|timestamp discontinuity|non[- ]monoton|incompatible with output codec|bitstream filter not found|master pipe NO-PROGRESS|R792 RTMPS EGRESS LOST' "$TMP/live.log" | tail -n 80 || true
  rollback; exit 7
fi
if grep -Fq '[loudness-r750-background]' "$TMP/live.log"; then
  echo '❌ R793 background loudness unexpectedly ran in CURRENT service invocation:'; grep -F '[loudness-r750-background]' "$TMP/live.log" | tail -n 30 || true; rollback; exit 7
fi
NR1="$(systemctl show "$SERVICE" -p NRestarts --value 2>/dev/null || echo 0)"
if [ "${NR1:-0}" -gt "${NR0:-0}" ]; then
  echo "❌ Service restarted during live guard: $NR0 -> $NR1"; rollback; exit 7
fi
S3="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$S3" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=d.get('publisherRunning') is True and d.get('transportHealthy') is True and int(d.get('masterTimestampErrorCount') or 0)==0
raise SystemExit(0 if ok else 1)
PY
then echo '❌ final runtime status unhealthy'; rollback; exit 7; fi

echo '[8/8] Final status'
printf '%s\n' "$S3" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PREFETCH LOUDNESS:",d.get("backgroundPrefetchLoudnessPolicyR793"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("RTMPS LANES:",d.get("rtmpsEstablishedConnectionsR792"),"/",d.get("rtmpsExpectedConnectionsR792"));print("DUAL INGEST:",d.get("youtubeDualIngestEnabled"));print("STATION ARM:",d.get("stationArmPolicyR792"));print("STATION CLOCK:",d.get("stationPreparedAudioClock"));print("TIMESTAMP ERRORS:",d.get("masterTimestampErrorCount"));print("TRANSIENT LANES:",d.get("transportTransientCountR792"));print("ERROR:",d.get("lastError"));print("WARNING:",d.get("lastWarning"))'
echo '✅ R793: prefetch downloads only; background loudness cannot run while disabled'
echo '✅ R792: station feeder remains live/black until station VIDEO+AUDIO are BOTH armed'
echo '✅ Failed station arm can no longer leave the master with zero H264 input'
echo '✅ R791 station audio PTS=0 fix included — no artificial 2s silent pad'
echo '✅ Same encoded A/V packets go to YouTube PRIMARY + BACKUP through independent FIFO lanes'
echo '✅ 25s zero-egress watchdog rebuilds only if BOTH RTMPS lanes disappear'
echo '✅ R790 title/PTS + R787 permanent NO-CROP preserved'
