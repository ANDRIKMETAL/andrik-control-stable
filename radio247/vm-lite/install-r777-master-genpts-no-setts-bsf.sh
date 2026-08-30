#!/usr/bin/env bash
set -Eeuo pipefail

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
CTA_DEST="$ASSET_DIR/subscribe-right-r767.png"
SERVICE=andrik-radio.service
ROOT_URL="https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main"
TMP="$(mktemp -d /tmp/andrik-r777.XXXXXX)"
STAMP="$(date +%s)"
REMOTE_SERVER="$TMP/server.mjs"
REMOTE_CTA="$TMP/subscribe-right-r767.png"
TEST_H264="$TMP/preflight.h264"
TEST_FLV="$TMP/preflight.flv"
TEST_LOG="$TMP/preflight.log"
BACKUP_SERVER="$SERVER.bak-before-r777-$(date +%Y%m%d-%H%M%S)"
BACKUP_CTA="$CTA_DEST.bak-before-r777-$(date +%Y%m%d-%H%M%S)"
HAD_CTA=0
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo 'ROLLBACK: возвращаю предыдущий рабочий server'
  cp -a "$BACKUP_SERVER" "$SERVER" || true
  if [ "$HAD_CTA" = 1 ]; then cp -a "$BACKUP_CTA" "$CTA_DEST" || true; fi
  systemctl restart "$SERVICE" || true
  sleep 12
  systemctl is-active "$SERVICE" || true
}

for c in curl node python3 ffmpeg ffprobe systemctl journalctl install cp stat; do
  command -v "$c" >/dev/null 2>&1 || { echo "СТОП: нет $c"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
mkdir -p "$ASSET_DIR"

echo '[1/7] Download R777'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$ROOT_URL/radio247/server.mjs?v=$STAMP" -o "$REMOTE_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$ROOT_URL/assets/subscribe-right-r767.png?v=$STAMP" -o "$REMOTE_CTA"

echo '[2/7] Verify before restart'
node --check "$REMOTE_SERVER" >/dev/null
python3 - "$REMOTE_SERVER" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text()
required=[
 'R777-MASTER-GENPTS-NO-SETTS-BSF-R775-R776-PRESERVED',
 'R777-H264-COPY-GENPTS-NO-BSF-SINGLE-ENCODE-8Q',
 'R769-SEMICOLON-ENDMASK-TO-STARTMASK',
 'COMMITTED_NEXT_FILE_R769',
 "const VIDEO_BITRATE = '6000k'",
 "const AUDIO_BITRATE = '160k'",
]
missing=[x for x in required if x not in s]
forbidden=['setts=time_base=',"'-bsf:v'",'use_wallclock_as_timestamps']
found=[x for x in forbidden if x in s]
if missing:
    print('СТОП: missing marker:', ', '.join(missing)); raise SystemExit(3)
if found:
    print('СТОП: forbidden transport option:', ', '.join(found)); raise SystemExit(3)
print('R777 markers OK; unsupported setts BSF absent')
PY
ffmpeg -hide_banner -loglevel error -i "$REMOTE_CTA" -frames:v 1 -f null - >/dev/null 2>&1 || { echo 'СТОП: SUBSCRIBE PNG не читается'; exit 3; }

# Exact transport primitive test: raw H264 -> GENPTS -> stream copy -> FLV. No setts BSF.
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i 'color=c=black:s=320x180:r=25' -t 0.6 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -x264-params 'repeat-headers=1:aud=1:keyint=15:min-keyint=15:scenecut=0:bframes=0' \
  -pix_fmt yuv420p -f h264 "$TEST_H264"

ffmpeg -y -hide_banner -loglevel warning \
  -fflags +genpts+discardcorrupt -framerate 25 -f h264 -i "$TEST_H264" \
  -f lavfi -i 'anullsrc=r=44100:cl=stereo' -t 0.6 \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 128k -ar 44100 -ac 2 \
  -f flv "$TEST_FLV" 2>"$TEST_LOG"

[ "$(stat -c%s "$TEST_FLV")" -gt 1000 ] || { echo 'СТОП: master preflight FLV пустой'; cat "$TEST_LOG"; exit 3; }
if grep -Eiq 'Bitstream filter not found|Error opening output|Non-monotonic DTS|Invalid argument' "$TEST_LOG"; then
  echo 'СТОП: master preflight FFmpeg error'; cat "$TEST_LOG"; exit 3
fi

echo '[3/7] Backup'
cp -a "$SERVER" "$BACKUP_SERVER"
if [ -e "$CTA_DEST" ]; then cp -a "$CTA_DEST" "$BACKUP_CTA"; HAD_CTA=1; fi

echo '[4/7] Install'
install -m 0644 "$REMOTE_SERVER" "$SERVER"
install -m 0644 "$REMOTE_CTA" "$CTA_DEST"

echo '[5/7] Restart'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 15
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/7] Status + byte progress'
STATUS1="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import json,os
try:d=json.loads(os.environ['STATUS_JSON'])
except Exception: raise SystemExit(1)
ok=(d.get('version')=='R777-MASTER-GENPTS-NO-SETTS-BSF-R775-R776-PRESERVED'
    and d.get('publisherRunning') is True
    and d.get('transportHealthy') is True
    and d.get('masterBitstreamFilter','').startswith('none-R777'))
raise SystemExit(0 if ok else 1)
PY
then
  echo 'СТОП: R777 status не подтвердился'; printf '%s\n' "$STATUS1"; rollback; exit 5
fi

AUDIO1="$(STATUS_JSON="$STATUS1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterAudioBytesWritten") or 0))')"
VIDEO1="$(STATUS_JSON="$STATUS1" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterVideoBytesWritten") or 0))')"
sleep 12
STATUS2="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
AUDIO2="$(STATUS_JSON="$STATUS2" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterAudioBytesWritten") or 0))' 2>/dev/null || echo 0)"
VIDEO2="$(STATUS_JSON="$STATUS2" python3 -c 'import os,json;d=json.loads(os.environ["STATUS_JSON"]);print(int(d.get("masterVideoBytesWritten") or 0))' 2>/dev/null || echo 0)"
if [ "$AUDIO2" -le "$AUDIO1" ] || [ "$VIDEO2" -le "$VIDEO1" ]; then
  echo "СТОП: master pipes не прогрессируют: audio $AUDIO1->$AUDIO2 video $VIDEO1->$VIDEO2"
  rollback; exit 5
fi

echo '[7/7] 45s live guard'
sleep 45
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
LOG="$TMP/live.log"
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$LOG" 2>/dev/null || true
if grep -Eiq 'Bitstream filter not found|Error parsing bitstream filter|Error opening output file|Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$LOG"; then
  echo 'СТОП: критическая ошибка после R777:'
  grep -Ei 'Bitstream filter not found|Error parsing bitstream filter|Error opening output file|Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$LOG" | tail -n 30 || true
  rollback; exit 6
fi

FINAL="$(curl -fsS --max-time 5 http://127.0.0.1:8080/status 2>/dev/null || true)"
printf '%s\n' "$FINAL" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("OK: R777 installed");print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("MASTER:",d.get("masterVideoMode"));print("BSF:",d.get("masterBitstreamFilter"));print("AUDIO BYTES:",d.get("masterAudioBytesWritten"));print("VIDEO BYTES:",d.get("masterVideoBytesWritten"));print("NEXT CHECKPOINT:",d.get("committedNextTitle") or "ready");print("ERROR:",d.get("lastError"))'
