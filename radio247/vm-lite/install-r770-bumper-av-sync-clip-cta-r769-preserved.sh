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
TMP_SERVER="$(mktemp /tmp/andrik-r770.XXXXXX.mjs)"
TMP_CTA="$(mktemp /tmp/andrik-r770-cta.XXXXXX.png)"
BACKUP_SERVER="${SERVER}.bak-before-r770-$(date +%Y%m%d-%H%M%S)"
BACKUP_CTA="${CTA_DEST}.bak-before-r770-$(date +%Y%m%d-%H%M%S)"
HAD_CTA=0
trap 'rm -f "$TMP_SERVER" "$TMP_CTA"' EXIT
for c in curl node python3 systemctl ffmpeg ffprobe grep journalctl ps; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }
mkdir -p "$ASSET_DIR"
STAMP="$(date +%s)"
echo '[1/8] Скачиваю R770 server + right SUBSCRIBE…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$SITE_BASE/radio247/server.mjs?v=55.00-r770-$STAMP" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r770-$STAMP" -o "$TMP_CTA"
echo '[2/8] Проверяю R770…'
node --check "$TMP_SERVER" >/dev/null
ffmpeg -v error -i "$TMP_CTA" -frames:v 1 -f null - >/dev/null 2>&1 || { echo 'СТОП: CTA PNG не читается'; exit 3; }
for marker in \
  'R770-BUMPER-AV-SYNC-CLIP-CTA-R769-PRESERVED' \
  'R770-STATION-OLD-PCM-DRAIN-BEFORE-AV-COMMIT' \
  'silenceremove=start_periods=1' \
  'clipLiveFilterComplexR770' \
  'R769 committed NEXT' \
  'R769: filtergraph chains MUST be separated' \
  "const VIDEO_BITRATE = '6000k'" \
  "const AUDIO_BITRATE = '160k'" \
  'subscribe-right-r767.png'; do
  grep -Fq "$marker" "$TMP_SERVER" || { echo "СТОП: потерян marker: $marker"; exit 3; }
done
[ "$(stat -c%s "$TMP_CTA")" -gt 50000 ] || { echo 'СТОП: CTA PNG слишком маленькая'; exit 3; }
echo '[3/8] Backup…'
cp -a "$SERVER" "$BACKUP_SERVER"
if [ -e "$CTA_DEST" ]; then cp -a "$CTA_DEST" "$BACKUP_CTA"; HAD_CTA=1; fi
rollback(){
  echo '⚠️ Откат R770…'
  cp -a "$BACKUP_SERVER" "$SERVER" || true
  if [ "$HAD_CTA" = 1 ]; then cp -a "$BACKUP_CTA" "$CTA_DEST" || true; else rm -f "$CTA_DEST"; fi
  systemctl restart "$SERVICE" || true
  sleep 5
}
echo '[4/8] Устанавливаю…'
install -m 0644 "$TMP_SERVER" "$SERVER"
install -m 0644 "$TMP_CTA" "$CTA_DEST"
chmod 600 "$ENV_FILE"
echo '[5/8] Restart…'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 12
systemctl is-active --quiet "$SERVICE" || { rollback; exit 4; }
echo '[6/8] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 20); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:raise SystemExit(1)
ok=(d.get('version')=='R770-BUMPER-AV-SYNC-CLIP-CTA-R769-PRESERVED' and d.get('publisherRunning') is True and d.get('masterVideoReencode') is False and d.get('videoBitrate')=='6000k' and d.get('audioBitrate')=='160k' and d.get('subscribeLikePosition')=='bottom-right-above-ticker' and str(d.get('stationInsertSync','')).startswith('R770-') and str(d.get('clipSubscribeOverlay','')).startswith('R770-'))
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then echo '❌ R770 status не подтвердился'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; rollback; exit 5; fi
echo '[7/8] Короткий stall-check…'
sleep 20
systemctl is-active --quiet "$SERVICE" || { rollback; exit 6; }
if journalctl -u "$SERVICE" --since "$START_TS" --no-pager | grep -Eq 'filter_complex: Invalid argument|Error parsing filterchain|status=76|master pipe NO-PROGRESS'; then
  echo '❌ R770 увидел критический regression — откат'; rollback; exit 6
fi
echo '[8/8] ГОТОВО'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("BUMPER SYNC:",d.get("stationInsertSync"));print("CLIP CTA:",d.get("clipSubscribeOverlay"));print("QUALITY:",d.get("videoBitrate"),d.get("audioBitrate"));print("ERROR:",d.get("lastError"))'
echo '✅ R769 filterchain + committed NEXT сохранены'
echo '✅ station bumper: old PCM drain + true leading-silence trim'
echo '✅ normal clips: right SUBSCRIBE CTA'
echo '✅ R767 clip frameclock, R766 tail-lock, R768 push preserved'
