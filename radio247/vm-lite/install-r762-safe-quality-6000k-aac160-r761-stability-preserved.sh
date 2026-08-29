#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r762.XXXXXX.mjs)"
BACKUP_SERVER="${SERVER}.bak-before-r762-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r762-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r762-safe-quality.conf"
trap 'rm -f "$TMP_SERVER"' EXIT

for c in curl node python3 systemctl ffmpeg grep journalctl ps; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/9] Скачиваю R762…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r762-$STAMP" -o "$TMP_SERVER"

echo '[2/9] Проверяю: качество поднято, стабильность R761/R760/R753 сохранена…'
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R762-SAFE-QUALITY-6000K-AAC160-R761-STABILITY-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R762'; exit 3; }
grep -Fq "const VIDEO_BITRATE = '6000k'" "$TMP_SERVER" || { echo 'СТОП: video bitrate не 6000k'; exit 3; }
grep -Fq "const AUDIO_BITRATE = '160k'" "$TMP_SERVER" || { echo 'СТОП: audio bitrate не 160k'; exit 3; }
grep -Fq "'-bufsize','12000k'" "$TMP_SERVER" || { echo 'СТОП: video bufsize не 12000k'; exit 3; }
grep -Fq "masterVideoReencode:false" "$TMP_SERVER" || { echo 'СТОП: R761 single-encode потерян'; exit 3; }
grep -Fq "'-c:v','copy'" "$TMP_SERVER" || { echo 'СТОП: master H264 copy потерян'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 64" "$TMP_SERVER" || { echo 'СТОП: 64Q потерян'; exit 3; }
grep -Fq "R753-EXACT-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-RECOVER-0.30" "$TMP_SERVER" || { echo 'СТОП: идеальный fade R753 потерян'; exit 3; }
grep -Fq "force_original_aspect_ratio=decrease" "$TMP_SERVER" || { echo 'СТОП: R753 FIT потерян'; exit 3; }
grep -Fq "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$TMP_SERVER" || { echo 'СТОП: R753 PAD потерян'; exit 3; }
grep -Fq "'-preset','ultrafast','-tune','zerolatency'" "$TMP_SERVER" || { echo 'СТОП: стабильный preset изменён'; exit 3; }
grep -Fq "R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT" "$TMP_SERVER" || { echo 'СТОП: FIFO-first recovery потерян'; exit 3; }

echo '[3/9] Backup…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R762 не прошёл запуск — возвращаю R761/предыдущий server…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/9] Устанавливаю R762…'
install -m 0644 "$TMP_SERVER" "$SERVER"
chmod 600 "$ENV_FILE"

echo '[5/9] Кэши клипов НЕ трогаю — это безопасное обновление качества без фоновой массовой перекодировки.'

echo '[6/9] Systemd safety…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/9] Один чистый restart…'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/9] Проверяю live status + процессы…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R762-SAFE-QUALITY-6000K-AAC160-R761-STABILITY-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoFeederRunning') is True and
 d.get('masterVideoReencode') is False and
 d.get('videoEncodePasses')==1 and
 d.get('videoBitrate')=='6000k' and
 d.get('audioBitrate')=='160k' and
 d.get('permanentFullscreenFitPolicy')=='R753-FIT-DECREASE-PAD-NO-CROP' and
 d.get('mp3BoundaryFadeMode')=='R753-EXACT-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-RECOVER-0.30'
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R762 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

FEEDER_LINE="$(ps -eo pid,args | grep '[f]fmpeg' | grep -- '-f h264 pipe:1' | head -n 1 || true)"
MASTER_LINE="$(ps -eo pid,args | grep '[f]fmpeg' | grep 'pipe:4' | head -n 1 || true)"
echo "FEEDER: $FEEDER_LINE"
echo "MASTER: $MASTER_LINE"
echo "$FEEDER_LINE" | grep -Fq -- '-b:v 6000k' || { echo '❌ live feeder не 6000k'; rollback; exit 6; }
echo "$FEEDER_LINE" | grep -Fq -- '-preset ultrafast' || { echo '❌ stable ultrafast preset потерян'; rollback; exit 6; }
echo "$MASTER_LINE" | grep -Fq -- '-c:v copy' || { echo '❌ master снова не copy-mode'; rollback; exit 6; }
echo "$MASTER_LINE" | grep -Fq -- '-b:a 160k' || { echo '❌ live AAC не 160k'; rollback; exit 6; }

sleep 25
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
if journalctl -u "$SERVICE" --since "$START_TS" --no-pager | grep -Eq 'status=76|master pipe NO-PROGRESS'; then
  echo '❌ после повышения качества появился NO-PROGRESS/status=76 — откат'; rollback; exit 6
fi

echo '[9/9] Итог…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("VIDEO:",d.get("videoBitrate"),d.get("videoPreset"));print("AUDIO:",d.get("audioBitrate"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("ENCODE PASSES:",d.get("videoEncodePasses"));print("GEOMETRY:",d.get("permanentFullscreenFitPolicy"));print("FADE:",d.get("mp3BoundaryFadeMode"));print("ERROR:",d.get("lastError"))'

echo
echo '✅ R762 ГОТОВ'
echo '✅ видео: 4500k → 6000k CBR; bufsize 9000k → 12000k'
echo '✅ звук: AAC 128k → 160k'
echo '✅ preset ultrafast/zerolatency НЕ менялся — не добавляем CPU-риск'
echo '✅ R761 single-encode сохранён — второго x264 больше нет'
echo '✅ R760/R753 геометрия и идеальное затемнение сохранены'
echo '✅ 64Q / FIFO-first / NO-PROGRESS защита сохранены'
echo '✅ старые prepared-клипы не удалялись — без массовой перекодировки во время эфира'
