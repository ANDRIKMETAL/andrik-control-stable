#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
CTA_DEST="$ASSET_DIR/subscribe-right-r767.png"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r767.XXXXXX.mjs)"
TMP_CTA="$(mktemp /tmp/andrik-r767-cta.XXXXXX.png)"
BACKUP_SERVER="${SERVER}.bak-before-r767-$(date +%Y%m%d-%H%M%S)"
BACKUP_CTA="${CTA_DEST}.bak-before-r767-$(date +%Y%m%d-%H%M%S)"
HAD_CTA=0
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r767-stable.conf"
trap 'rm -f "$TMP_SERVER" "$TMP_CTA"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe grep journalctl ps; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }
mkdir -p "$ASSET_DIR"

STAMP="$(date +%s)"
echo '[1/10] Скачиваю R767 server + новую правую SUBSCRIBE плашку…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r767-$STAMP" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r767-$STAMP" -o "$TMP_CTA"

echo '[2/10] Проверяю код и PNG…'
node --check "$TMP_SERVER" >/dev/null
[ "$(stat -c%s "$TMP_CTA")" -gt 50000 ] || { echo 'СТОП: новая SUBSCRIBE PNG слишком маленькая'; exit 3; }
ffmpeg -v error -i "$TMP_CTA" -frames:v 1 -f null - >/dev/null 2>&1 || { echo 'СТОП: SUBSCRIBE PNG не декодируется'; exit 3; }
grep -Fq "R767-CLIP-FRAMECLOCK-SYNC-RIGHT-SUBSCRIBE-R766-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R767'; exit 3; }
grep -Fq "subscribe-right-r767.png" "$TMP_SERVER" || { echo 'СТОП: новая CTA не подключена'; exit 3; }
grep -Fq "overlay=x=W-w-\${CTA_RIGHT_GAP_R767}" "$TMP_SERVER" || { echo 'СТОП: CTA не справа'; exit 3; }
grep -Fq "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_SERVER" || { echo 'СТОП: video queue не 8'; exit 3; }
grep -Fq "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP_SERVER" || { echo 'СТОП: audio queue не 8'; exit 3; }
grep -Fq "setpts=N/(\${VIDEO_FPS}*TB)" "$TMP_SERVER" || { echo 'СТОП: exact video frame clock отсутствует'; exit 3; }
grep -Fq "asetpts=N/SR/TB" "$TMP_SERVER" || { echo 'СТОП: exact audio sample clock отсутствует'; exit 3; }
grep -Fq "R767-BLACK-PRE-DRAIN-BEFORE-CLIP-ARM" "$TMP_SERVER" || { echo 'СТОП: pre-drain clip boundary fix отсутствует'; exit 3; }
grep -Fq "R766-PER-OUTPUT-T+VIDEO-TPAD-TRIM+AUDIO-APAD-ATRIM" "$TMP_SERVER" || { echo 'СТОП: R766 tail-lock потерян'; exit 3; }
grep -Fq "const VIDEO_BITRATE = '6000k'" "$TMP_SERVER" || { echo 'СТОП: 6000k потерян'; exit 3; }
grep -Fq "const AUDIO_BITRATE = '160k'" "$TMP_SERVER" || { echo 'СТОП: AAC160 потерян'; exit 3; }
grep -Fq "const VIDEO_FADE_LEAD_SECONDS_R735 = 1.40" "$TMP_SERVER" || { echo 'СТОП: fade lead 1.40 потерян'; exit 3; }
grep -Fq "const VIDEO_FADE_IN_SECONDS_R736 = 0.80" "$TMP_SERVER" || { echo 'СТОП: brighten 0.80 потерян'; exit 3; }
grep -Fq "masterVideoReencode:false" "$TMP_SERVER" || { echo 'СТОП: R761 single encode потерян'; exit 3; }

echo '[3/10] Backup…'
cp -a "$SERVER" "$BACKUP_SERVER"
if [ -e "$CTA_DEST" ]; then cp -a "$CTA_DEST" "$BACKUP_CTA"; HAD_CTA=1; fi
rollback(){
  echo '⚠️ R767 не прошёл проверку — возвращаю предыдущую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER" || true
  if [ "$HAD_CTA" = 1 ]; then cp -a "$BACKUP_CTA" "$CTA_DEST" || true; else rm -f "$CTA_DEST"; fi
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/10] Устанавливаю server + CTA…'
install -m 0644 "$TMP_SERVER" "$SERVER"
install -m 0644 "$TMP_CTA" "$CTA_DEST"
chmod 600 "$ENV_FILE"

echo '[5/10] Старую левую subscribe-like-r722.png не удаляю с диска для rollback, но R767 её больше НЕ использует.'

echo '[6/10] Systemd safety…'
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN" <<'EOF2'
[Service]
Restart=on-failure
RestartSec=5s
EOF2
systemctl daemon-reload

echo '[7/10] Один чистый restart…'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/10] Проверяю live status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(
 d.get('version')=='R767-CLIP-FRAMECLOCK-SYNC-RIGHT-SUBSCRIBE-R766-PRESERVED' and
 d.get('publisherRunning') is True and
 d.get('videoFeederRunning') is True and
 d.get('masterVideoReencode') is False and
 d.get('videoEncodePasses')==1 and
 d.get('videoBitrate')=='6000k' and
 d.get('audioBitrate')=='160k' and
 d.get('videoInputQueuePackets')==8 and
 d.get('audioInputQueuePackets')==8 and
 d.get('subscribeLikePosition')=='bottom-right-above-ticker' and
 str(d.get('subscribeLikeOverlay','')).endswith('/subscribe-right-r767.png') and
 'VIDEO-N/25' in str(d.get('clipAvSyncFix','')) and
 d.get('normalClipAdmissionMode')=='R764-PREPARED-ONLY-COMMIT-GATE' and
 d.get('bumperMinSongs')==3 and d.get('bumperMaxSongs')==4 and
 d.get('videoFadeLeadSeconds')==1.4 and d.get('videoFadeInSeconds')==0.8
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R767 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[9/10] Проверяю процессы и отсутствие мгновенного NO-PROGRESS…'
MASTER_LINE="$(ps -eo pid,args | grep '[f]fmpeg' | grep 'pipe:4' | head -n 1 || true)"
echo "MASTER: $MASTER_LINE"
echo "$MASTER_LINE" | grep -Fq -- '-thread_queue_size 8' || { echo '❌ master не использует low-latency queue'; rollback; exit 6; }
echo "$MASTER_LINE" | grep -Fq -- '-c:v copy' || { echo '❌ master снова не copy-mode'; rollback; exit 6; }
sleep 25
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
if journalctl -u "$SERVICE" --since "$START_TS" --no-pager | grep -Eq 'status=76|master pipe NO-PROGRESS'; then
  echo '❌ появился NO-PROGRESS/status=76 — откат'; rollback; exit 6
fi

echo '[10/10] Итог…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("A/V QUEUES:",d.get("videoInputQueuePackets"),d.get("audioInputQueuePackets"));print("SYNC:",d.get("clipAvSyncFix"));print("CTA:",d.get("subscribeLikePosition"),d.get("subscribeLikeOverlay"));print("QUALITY:",d.get("videoBitrate"),d.get("audioBitrate"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("ERROR:",d.get("lastError"))'

echo
echo '✅ R767 ГОТОВ — CLIP A/V FRAMECLOCK SYNC + RIGHT SUBSCRIBE'
echo '✅ clip video: exact frame clock N/25; audio: exact sample clock N/SR'
echo '✅ old MP3 video feeder detaches on black BEFORE clip child arms'
echo '✅ master input queues matched 8/8: stale video window capped ~0.32s'
echo '✅ redundant LIVE 1080p Lanczos rescale removed for prepared clips'
echo '✅ R766 equal-duration/tail-lock preserved'
echo '✅ old left SUBSCRIBE+LIKE removed from render path'
echo '✅ new transparent SUBSCRIBE bell/hand appears RIGHT above ticker'
echo '✅ R763 6000k + AAC160 + fade lead 1.40 + brighten 0.80 preserved'
