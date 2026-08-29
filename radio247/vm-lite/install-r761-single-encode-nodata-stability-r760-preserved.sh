#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r761.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r761-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r761-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r761-single-encode.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg grep journalctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/9] Скачиваю R761…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r761-$STAMP" -o "$TMP_SERVER"

echo '[2/9] Проверяю single-encode + сохранность R760/R753…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R761-SINGLE-ENCODE-NODATA-STABILITY-R760-VISUALS-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R761'; exit 3; }
grep -Fq "masterVideoReencode:false" "$TMP_SERVER" || { echo 'СТОП: master re-encode не отключён'; exit 3; }
grep -Fq "'-c:v','copy'" "$TMP_SERVER" || { echo 'СТОП: H264 copy master отсутствует'; exit 3; }
grep -Fq 'setts=time_base=1/${VIDEO_FPS}:pts=N:dts=N:duration=1' "$TMP_SERVER" || { echo 'СТОП: continuous H264 setts отсутствует'; exit 3; }
grep -Fq "R753-EXACT-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-RECOVER-0.30" "$TMP_SERVER" || { echo 'СТОП: идеальный fade R753 потерян'; exit 3; }
grep -Fq "force_original_aspect_ratio=decrease" "$TMP_SERVER" || { echo 'СТОП: R753 FIT потерян'; exit 3; }
grep -Fq "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$TMP_SERVER" || { echo 'СТОП: R753 PAD потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 64" "$TMP_SERVER" || { echo 'СТОП: 64Q потерян'; exit 3; }
grep -Fq "R754-GRACEFUL-SIGINT-FLUSH+AUD" "$TMP_SERVER" || { echo 'СТОП: graceful feeder boundary потерян'; exit 3; }
grep -Fq "R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT" "$TMP_SERVER" || { echo 'СТОП: FIFO-first recovery потерян'; exit 3; }
ffmpeg -hide_banner -bsfs 2>/dev/null | grep -Eq '(^|[[:space:]])setts($|[[:space:]])' || { echo 'СТОП: FFmpeg не имеет setts bsf'; exit 3; }

echo '[3/9] Backup…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R761 не прошёл запуск — возвращаю предыдущий server…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/9] Устанавливаю R761…'
install -m 0644 "$TMP_SERVER" "$SERVER"
chmod 600 "$ENV_FILE"

echo '[5/9] Systemd safety…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[6/9] Один чистый restart RTMPS…'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[7/9] Проверяю live status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R761-SINGLE-ENCODE-NODATA-STABILITY-R760-VISUALS-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoFeederRunning') is True and
 d.get('masterVideoReencode') is False and
 d.get('videoEncodePasses')==1 and
 d.get('masterVideoMode')=='R761-H264-COPY-SETTS-SINGLE-ENCODE-64Q' and
 d.get('permanentFullscreenFitPolicy')=='R753-FIT-DECREASE-PAD-NO-CROP' and
 d.get('mp3BoundaryFadeMode')=='R753-EXACT-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-RECOVER-0.30'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R761 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[8/9] Проверяю, что старый двойной master encoder не запущен…'
# Current persistent master must contain -c:v copy; feeder remains the only libx264 video encoder.
MASTER_LINE="$(ps -eo pid,args | grep '[f]fmpeg' | grep 'pipe:4' | head -n 1 || true)"
printf '%s\n' "$MASTER_LINE"
echo "$MASTER_LINE" | grep -Fq -- '-c:v copy' || { echo '❌ master не в copy-mode'; rollback; exit 6; }
if echo "$MASTER_LINE" | grep -Fq -- '-vf scale=1920:1080'; then echo '❌ в master остался второй video filter/re-encode'; rollback; exit 6; fi

sleep 20
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
if journalctl -u "$SERVICE" --since "$START_TS" --no-pager | grep -Eq 'status=76|master pipe NO-PROGRESS'; then
  echo '❌ сразу после установки снова возник NO-PROGRESS/status=76'; rollback; exit 6
fi

echo '[9/9] Итог…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("VIDEO:",d.get("videoFeederRunning"));print("MASTER:",d.get("masterVideoMode"));print("ENCODE PASSES:",d.get("videoEncodePasses"));print("GEOMETRY:",d.get("permanentFullscreenFitPolicy"));print("FADE:",d.get("mp3BoundaryFadeMode"));print("ERROR:",d.get("lastError"))'

echo
echo '✅ R761 ГОТОВ'
echo '✅ убран второй x264 encoder из persistent master — теперь видео кодируется ОДИН раз'
echo '✅ R760/R753 картинка FIT+PAD NO-CROP сохранена'
echo '✅ R753 идеальное затемнение сохранено без изменения таймингов'
echo '✅ R754 graceful feeder boundary + FIFO-first RTMPS сохранены'
echo '✅ 64Q сохранена; prepared cache не трогался'
