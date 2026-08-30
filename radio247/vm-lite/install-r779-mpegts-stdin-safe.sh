#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r779.XXXXXX)"
REMOTE="$TMP/server.mjs"
BACKUP="$SERVER.bak-before-r779-$(date +%Y%m%d-%H%M%S)"
trap 'rm -rf "$TMP"' EXIT

rollback(){
  echo '⚠️ R779 live-check не прошёл — возвращаю предыдущую рабочую версию.'
  if [ -s "$BACKUP" ]; then cp -a "$BACKUP" "$SERVER"; fi
  systemctl restart "$SERVICE" || true
  sleep 12
  echo 'ROLLBACK STATUS:'
  systemctl is-active "$SERVICE" || true
  curl -sS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null | python3 -m json.tool 2>/dev/null | grep -E '"version"|"publisherRunning"|"transportHealthy"|"lastError"' || true
}

for c in curl node python3 ffmpeg ffprobe systemctl journalctl grep stat install cp cat; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/7] Download R779'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r779-$STAMP" -o "$REMOTE"

echo '[2/7] Verify MPEG-TS timestamp bridge before restart'
node --check "$REMOTE" >/dev/null
grep -Fq "R779-MPEGTS-TIMESTAMP-BRIDGE-INSTALLER-STDIN-FIX-R778-PRESERVED" "$REMOTE" || { echo 'СТОП: remote server не R779'; exit 3; }
grep -Fq "R778-MPEGTS-PTS-DTS-BRIDGE-NO-SETTS-NO-SECOND-ENCODE" "$REMOTE" || { echo 'СТОП: нет timestamp marker'; exit 3; }
grep -Fq "'-f','mpegts','-i','pipe:4'" "$REMOTE" || { echo 'СТОП: master не использует MPEG-TS input'; exit 3; }
if grep -Fq "setts=time_base" "$REMOTE"; then echo 'СТОП: найден запрещённый setts BSF'; exit 3; fi

# IMPORTANT R779: -nostdin prevents FFmpeg from consuming installer text when a user
# accidentally launches a script through a pipe. The official command below also
# downloads this installer to a real file before running it.
for n in 1 2; do
  ffmpeg -nostdin -hide_banner -loglevel error \
    -f lavfi -i "color=c=black:s=320x180:r=25" -t 1.2 \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -x264-params 'repeat-headers=1:aud=1:keyint=50:min-keyint=50:scenecut=0' \
    -an -mpegts_flags +resend_headers+initial_discontinuity -muxdelay 0 -muxpreload 0 \
    -f mpegts "$TMP/seg$n.ts"
done
cat "$TMP/seg1.ts" "$TMP/seg2.ts" | \
  ffmpeg -nostdin -hide_banner -loglevel warning -fflags +genpts+discardcorrupt -f mpegts -i pipe:0 \
    -map 0:v:0 -c:v copy -an -f flv "$TMP/test.flv" 2>"$TMP/ffmpeg-preflight.log"
if grep -Eqi 'Timestamps are unset|Bitstream filter not found|Error opening output|Invalid argument' "$TMP/ffmpeg-preflight.log"; then
  echo 'СТОП: FFmpeg timestamp preflight не прошёл:'
  cat "$TMP/ffmpeg-preflight.log"
  exit 3
fi
DUR="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$TMP/test.flv" 2>/dev/null || echo 0)"
python3 - "$DUR" <<'PY'
import sys
try: d=float(sys.argv[1])
except: d=0
raise SystemExit(0 if d > 2.1 else 1)
PY

echo '[3/7] Backup'
cp -a "$SERVER" "$BACKUP"

echo '[4/7] Install'
install -m 0644 "$REMOTE" "$SERVER"

echo '[5/7] Restart'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 14
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/7] Status + real byte progress'
STATUS1="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
if ! STATUS_JSON="$STATUS1" python3 - <<'PY'
import os,json
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except:raise SystemExit(1)
ok=(d.get('version')=='R779-MPEGTS-TIMESTAMP-BRIDGE-INSTALLER-STDIN-FIX-R778-PRESERVED' and d.get('publisherRunning') is True and d.get('transportHealthy') is True and str(d.get('masterTimestampMode','')).startswith('R778-MPEGTS-PTS-DTS-BRIDGE'))
raise SystemExit(0 if ok else 1)
PY
then
  echo '❌ R779 status не подтвердился.'
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
  echo "❌ Нет реального byte progress: audio $A1->$A2 video $V1->$V2"
  rollback; exit 5
fi

echo '[7/7] 45s live guard'
sleep 45
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eqi 'Timestamps are unset|Bitstream filter not found|Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log"; then
  echo '❌ Найдена критическая regression:'
  grep -Ei 'Timestamps are unset|Bitstream filter not found|Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|Main process exited.*status=[1-9]' "$TMP/live.log" | tail -n 30 || true
  rollback; exit 6
fi

STATUS="$(curl -fsS --max-time 4 http://127.0.0.1:8080/status 2>/dev/null || true)"
echo 'OK: R779 installed'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"));print("TRANSPORT:",d.get("transportHealthy"));print("TIMESTAMPS:",d.get("masterTimestampMode"));print("AUDIO BYTES:",d.get("masterAudioBytesWritten"));print("VIDEO BYTES:",d.get("masterVideoBytesWritten"));print("NEXT:",d.get("committedNextTitle") or "checkpoint ready");print("ERROR:",d.get("lastError"))'
echo '✅ R779 installer stdin-safe: downloaded file + FFmpeg -nostdin'
echo '✅ R778 radio/push logic preserved'
