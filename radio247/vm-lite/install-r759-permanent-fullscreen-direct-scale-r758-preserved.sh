#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r759.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r759-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r759-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r759-permanent-fullscreen.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R759 server…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r759-$STAMP" -o "$TMP_SERVER"

echo '[2/10] Проверяю R759 + сохранность R758/R757/R756/R754…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R759-PERMANENT-FULLSCREEN-1920X1080-DIRECT-SCALE-R758-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R759'; exit 3; }
grep -Fq "R759-DIRECT-1920x1080-FULLSCREEN-NO-PAD-NO-CROP-NO-AUTO-ASPECT-64Q" "$TMP_SERVER" || { echo 'СТОП: R759 master mode отсутствует'; exit 3; }
grep -Fq "scale=1920:1080:flags=lanczos" "$TMP_SERVER" || { echo 'СТОП: direct fullscreen scale отсутствует'; exit 3; }
if grep -Fq "force_original_aspect_ratio=decrease" "$TMP_SERVER"; then echo 'СТОП: остался AUTO-ASPECT'; exit 3; fi
if grep -Fq "pad=1920:1080" "$TMP_SERVER"; then echo 'СТОП: остался full-frame PAD'; exit 3; fi
if grep -Eq "(^|[,\"'\`])crop=" "$TMP_SERVER"; then echo 'СТОП: обнаружен crop filter'; exit 3; fi
COUNT="$(grep -o "scale=1920:1080:flags=lanczos" "$TMP_SERVER" | wc -l)"
[ "$COUNT" -ge 5 ] || { echo "СТОП: direct scale найден только $COUNT раз"; exit 3; }
grep -Fq "R758-OLD-MP3-FADE-TO-BLACK-HOLD-NEW-MP3-FADE-IN-0.30" "$TMP_SERVER" || { echo 'СТОП: R758 MP3 fade потерян'; exit 3; }
grep -Fq "R757-NORMAL-CLIPS-PREVNEXT-INTRO-2-7S-PLUS-FINAL-10S" "$TMP_SERVER" || { echo 'СТОП: R757 clip PREVIOUS/NEXT потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 64" "$TMP_SERVER" || { echo 'СТОП: R756 64Q потерян'; exit 3; }
grep -Fq "R754-GRACEFUL-SIGINT-FLUSH+AUD" "$TMP_SERVER" || { echo 'СТОП: R754 feeder stability потеряна'; exit 3; }
grep -Fq "R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT" "$TMP_SERVER" || { echo 'СТОП: R754 RTMPS recovery потеряна'; exit 3; }
grep -Fq "NEXT • ANDRIK METAL RADIO 24/7" "$TMP_SERVER" || { echo 'СТОП: station label потерян'; exit 3; }

echo '[3/10] Реальный FFmpeg тест: даже 4:3 обязан стать ровно 1920x1080…'
TEST_MP4="$(mktemp /tmp/r759-fullscreen.XXXXXX.mp4)"
ffmpeg -nostdin -hide_banner -loglevel error -y \
  -f lavfi -i 'testsrc2=size=640x480:rate=25:duration=0.4' \
  -vf 'scale=1920:1080:flags=lanczos,setsar=1,setdar=16/9,fps=25,format=yuv420p' \
  -c:v libx264 -preset ultrafast -tune zerolatency -an "$TEST_MP4"
PROBE="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,sample_aspect_ratio,display_aspect_ratio -of default=nw=1 "$TEST_MP4")"
rm -f "$TEST_MP4"
echo "$PROBE"
echo "$PROBE" | grep -Fq 'width=1920' || { echo 'СТОП: width не 1920'; exit 3; }
echo "$PROBE" | grep -Fq 'height=1080' || { echo 'СТОП: height не 1080'; exit 3; }
echo "$PROBE" | grep -Fq 'sample_aspect_ratio=1:1' || { echo 'СТОП: SAR не 1:1'; exit 3; }
echo "$PROBE" | grep -Fq 'display_aspect_ratio=16:9' || { echo 'СТОП: DAR не 16:9'; exit 3; }

echo '[4/10] Backup server + env…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R759 не прошёл запуск — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[5/10] Устанавливаю R759 — постоянный FULLSCREEN 1920x1080…'
install -m 0644 "$TMP_SERVER" "$SERVER"
# Сохраняем уже настроенные тайминги и защиту. Никаких новых crop/fit env нет.
chmod 600 "$ENV_FILE"

echo '[6/10] Systemd safety…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/10] Один чистый restart, чтобы старый видеотракт исчез полностью…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/10] Проверяю live status R759…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R759-PERMANENT-FULLSCREEN-1920X1080-DIRECT-SCALE-R758-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoFeederRunning') is True and
 d.get('masterVideoMode')=='R759-DIRECT-1920x1080-FULLSCREEN-NO-PAD-NO-CROP-NO-AUTO-ASPECT-64Q' and
 d.get('permanentFullscreenWidth')==1920 and
 d.get('permanentFullscreenHeight')==1080 and
 d.get('permanentFullscreenFitPolicy')=='DIRECT-SCALE-FILL-NO-PAD-NO-CROP' and
 d.get('mp3BoundaryFadeMode')=='R758-OLD-MP3-FADE-TO-BLACK-HOLD-NEW-MP3-FADE-IN-0.30'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R759 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/10] Проверяю, что именно установленный server не содержит старую геометрию…'
if grep -Fq 'force_original_aspect_ratio=decrease' "$SERVER" || grep -Fq 'pad=1920:1080' "$SERVER"; then
  echo '❌ На VPS осталась старая FIT/PAD геометрия.'
  rollback
  exit 6
fi
sleep 6
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi

echo '[10/10] Диагностика…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("FRAME:",d.get("permanentFullscreenWidth"),"x",d.get("permanentFullscreenHeight"));print("POLICY:",d.get("permanentFullscreenFitPolicy"));print("MASTER:",d.get("masterVideoMode"));print("FADE:",d.get("mp3BoundaryFadeMode"));print("ERROR:",d.get("lastError"))'

echo
echo '✅ R759 ГОТОВ — FULLSCREEN ЗАФИКСИРОВАН НАВСЕГДА'
echo '✅ каждый фон MP3 / клип / заставка -> ровно 1920x1080'
echo '✅ DIRECT SCALE FILL: без pad, без crop, без auto-aspect'
echo '✅ master повторно фиксирует 1920x1080 перед YouTube'
echo '✅ R758 затемнение + R757 PREVIOUS/NEXT + R756 64Q + R754 RTMPS сохранены'
echo '========================================================'
