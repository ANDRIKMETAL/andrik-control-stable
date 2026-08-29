#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
CACHE_DIR="${RADIO_CACHE_DIR:-/var/cache/andrik-radio-r622}"
CLIP_CACHE_DIR="$CACHE_DIR/clips"
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r760.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r760-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r760-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r760-r753-nocrop.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe find; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/11] Скачиваю R760 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r760-$STAMP" -o "$TMP_SERVER"

echo '[2/11] Проверяю R760 + сохранность поздней стабильности…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R760-R753-NOCROP-GEOMETRY-FADE-R759-STABILITY-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R760'; exit 3; }
grep -Fq "R753-EXACT-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-RECOVER-0.30" "$TMP_SERVER" || { echo 'СТОП: точное затемнение R753 отсутствует'; exit 3; }
grep -Fq "force_original_aspect_ratio=decrease" "$TMP_SERVER" || { echo 'СТОП: R753 FIT отсутствует'; exit 3; }
grep -Fq "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$TMP_SERVER" || { echo 'СТОП: R753 PAD отсутствует'; exit 3; }
COUNT_FIT="$(grep -o "force_original_aspect_ratio=decrease" "$TMP_SERVER" | wc -l)"
[ "$COUNT_FIT" -ge 5 ] || { echo "СТОП: R753 FIT найден только $COUNT_FIT раз"; exit 3; }
if grep -Fq "scale=1920:1080:flags=lanczos" "$TMP_SERVER"; then echo 'СТОП: остался R759 direct-stretch 1920x1080'; exit 3; fi
if grep -Eq "(^|[,\"'\`])crop=" "$TMP_SERVER"; then echo 'СТОП: обнаружен crop filter'; exit 3; fi
grep -Fq ".r760-ready.mp4" "$TMP_SERVER" || { echo 'СТОП: новый prepared-video cache generation отсутствует'; exit 3; }
grep -Fq "R757-NORMAL-CLIPS-PREVNEXT-INTRO-2-7S-PLUS-FINAL-10S" "$TMP_SERVER" || { echo 'СТОП: R757 PREVIOUS/NEXT потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 64" "$TMP_SERVER" || { echo 'СТОП: R756 64Q потерян'; exit 3; }
grep -Fq "R754-GRACEFUL-SIGINT-FLUSH+AUD" "$TMP_SERVER" || { echo 'СТОП: R754 feeder stability потеряна'; exit 3; }
grep -Fq "R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT" "$TMP_SERVER" || { echo 'СТОП: R754 transport recovery потеряна'; exit 3; }
grep -Fq "NEXT • ANDRIK METAL RADIO 24/7" "$TMP_SERVER" || { echo 'СТОП: station label потерян'; exit 3; }

echo '[3/11] FFmpeg тест R753 NO-CROP: 16:9 и 4:3…'
TEST16="$(mktemp /tmp/r760-16x9.XXXXXX.mp4)"
TEST43="$(mktemp /tmp/r760-4x3.XXXXXX.mp4)"
VF='scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=25,format=yuv420p'
ffmpeg -nostdin -hide_banner -loglevel error -y -f lavfi -i 'testsrc2=size=1280x720:rate=25:duration=0.3' -vf "$VF" -c:v libx264 -preset ultrafast -an "$TEST16"
ffmpeg -nostdin -hide_banner -loglevel error -y -f lavfi -i 'testsrc2=size=640x480:rate=25:duration=0.3' -vf "$VF" -c:v libx264 -preset ultrafast -an "$TEST43"
for f in "$TEST16" "$TEST43"; do
  PROBE="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,sample_aspect_ratio -of default=nw=1 "$f")"
  echo "$PROBE"
  echo "$PROBE" | grep -Fq 'width=1920' || { rm -f "$TEST16" "$TEST43"; echo 'СТОП: width != 1920'; exit 3; }
  echo "$PROBE" | grep -Fq 'height=1080' || { rm -f "$TEST16" "$TEST43"; echo 'СТОП: height != 1080'; exit 3; }
  echo "$PROBE" | grep -Fq 'sample_aspect_ratio=1:1' || { rm -f "$TEST16" "$TEST43"; echo 'СТОП: SAR != 1:1'; exit 3; }
done
rm -f "$TEST16" "$TEST43"

echo '[4/11] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R760 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/11] Устанавливаю R760…'
install -m 0644 "$TMP_SERVER" "$SERVER"
chmod 600 "$ENV_FILE"

echo '[6/11] Удаляю ТОЛЬКО старые производные MP4-кэши — исходные клипы не трогаю…'
mkdir -p "$CLIP_CACHE_DIR"
find "$CLIP_CACHE_DIR" -maxdepth 1 -type f \( \
  -name '*.r742-ready.mp4' -o -name '*.r742-ready.mp4.title.txt' -o -name '*.r742-ready.mp4.ticker.txt' -o \
  -name '*.r760-ready.mp4' -o -name '*.r760-ready.mp4.title.txt' -o -name '*.r760-ready.mp4.ticker.txt' \
\) -print -delete || true

echo '[7/11] Systemd safety…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[8/11] Один чистый restart…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[9/11] Проверяю live status R760…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R760-R753-NOCROP-GEOMETRY-FADE-R759-STABILITY-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoFeederRunning') is True and
 d.get('masterVideoMode')=='R760-R753-FIT-PAD-1920x1080-NO-CROP-64Q' and
 d.get('permanentFullscreenFitPolicy')=='R753-FIT-DECREASE-PAD-NO-CROP' and
 d.get('mp3BoundaryFadeMode')=='R753-EXACT-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-RECOVER-0.30'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R760 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[10/11] Проверяю установленный server: никакого crop/direct-stretch…'
if grep -Fq 'scale=1920:1080:flags=lanczos' "$SERVER"; then echo '❌ direct-stretch остался'; rollback; exit 6; fi
if grep -Eq "(^|[,\"'\`])crop=" "$SERVER"; then echo '❌ crop остался'; rollback; exit 6; fi
grep -Fq 'force_original_aspect_ratio=decrease' "$SERVER" || { echo '❌ FIT отсутствует'; rollback; exit 6; }
grep -Fq 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$SERVER" || { echo '❌ PAD отсутствует'; rollback; exit 6; }
sleep 5
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi

echo '[11/11] Диагностика…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("GEOMETRY:",d.get("permanentFullscreenFitPolicy"));print("MASTER:",d.get("masterVideoMode"));print("FADE:",d.get("mp3BoundaryFadeMode"));print("ERROR:",d.get("lastError"))'

echo
echo '✅ R760 ГОТОВ'
echo '✅ геометрия возвращена из R753: FIT + PAD + SAR 1 — НИ ОДНОГО CROP'
echo '✅ MP3→MP3 затемнение возвращено ровно из R753: 0.65 / 0.05 / 0.30'
echo '✅ старые prepared MP4-кэши удалены и будут созданы заново'
echo '✅ R754 стабильный master + R756 64Q + R757 клипы/PREVIOUS/NEXT сохранены'
