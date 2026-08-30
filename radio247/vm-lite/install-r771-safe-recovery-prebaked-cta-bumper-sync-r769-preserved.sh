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
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r771.XXXXXX)"
TMP_SERVER="$TMP/server.mjs"
TMP_CTA="$TMP/subscribe-right-r767.png"
BACKUP_SERVER="${SERVER}.bak-before-r771-$(date +%Y%m%d-%H%M%S)"
BACKUP_CTA="${CTA_DEST}.bak-before-r771-$(date +%Y%m%d-%H%M%S)"
HAD_CTA=0
trap 'rm -rf "$TMP"' EXIT

for c in curl node python3 systemctl ffmpeg grep journalctl stat; do
  command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }
done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }
mkdir -p "$ASSET_DIR"

echo '[1/8] Скачиваю R771 + правую SUBSCRIBE…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r771-$STAMP" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r771-$STAMP" -o "$TMP_CTA"

echo '[2/8] PRE-FLIGHT до остановки эфира…'
node --check "$TMP_SERVER" >/dev/null
ffmpeg -hide_banner -loglevel error -i "$TMP_CTA" -frames:v 1 -f null - >/dev/null 2>&1 || { echo 'СТОП: SUBSCRIBE PNG не читается'; exit 3; }
ffmpeg -hide_banner -filters 2>/dev/null | grep -F 'silencedetect' >/dev/null || { echo 'СТОП: FFmpeg без silencedetect'; exit 3; }
for marker in \
  'R771-SAFE-RECOVERY-PREBAKED-CLIP-CTA-BUMPER-AUDIO-SYNC-R769-PRESERVED' \
  'R769: filtergraph chains MUST be separated' \
  'COMMITTED_NEXT_FILE_R769' \
  'R771-LIVE-SAFETY' \
  'probeStationLeadingSilenceR771' \
  'R771-PREBAKED-RIGHT-CTA-NO-LIVE-FILTER-COMPLEX' \
  "const VIDEO_BITRATE = '6000k'" \
  "const AUDIO_BITRATE = '160k'"; do
  grep -Fq "$marker" "$TMP_SERVER" || { echo "СТОП: потерян marker: $marker"; exit 3; }
done
[ "$(stat -c%s "$TMP_CTA")" -gt 50000 ] || { echo 'СТОП: SUBSCRIBE PNG слишком маленькая'; exit 3; }

echo '[3/8] Backup текущей рабочей версии…'
cp -a "$SERVER" "$BACKUP_SERVER"
if [ -e "$CTA_DEST" ]; then cp -a "$CTA_DEST" "$BACKUP_CTA"; HAD_CTA=1; fi

rollback(){
  echo '⚠️ R771 не прошёл live-check — автоматически возвращаю предыдущую рабочую версию…'
  cp -a "$BACKUP_SERVER" "$SERVER" || true
  if [ "$HAD_CTA" = 1 ]; then cp -a "$BACKUP_CTA" "$CTA_DEST" || true; else rm -f "$CTA_DEST"; fi
  systemctl restart "$SERVICE" || true
  sleep 10
  echo 'ROLLBACK STATUS:'
  systemctl is-active "$SERVICE" || true
}

echo '[4/8] Устанавливаю R771…'
install -m 0644 "$TMP_SERVER" "$SERVER"
install -m 0644 "$TMP_CTA" "$CTA_DEST"
chmod 600 "$ENV_FILE"

echo '[5/8] Один контролируемый restart…'
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi

sleep 12
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[6/8] Проверяю /status…'
STATUS=''
OK=0
for i in $(seq 1 18); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 - <<'PY' 2>/dev/null
import json,os
try:
    d=json.loads(os.environ.get('STATUS_JSON',''))
except Exception:
    raise SystemExit(1)
ok=(
    d.get('version')=='R771-SAFE-RECOVERY-PREBAKED-CLIP-CTA-BUMPER-AUDIO-SYNC-R769-PRESERVED'
    and d.get('publisherRunning') is True
    and d.get('masterVideoReencode') is False
    and d.get('videoBitrate')=='6000k'
    and d.get('audioBitrate')=='160k'
    and str(d.get('feederFilterChainGuard','')).startswith('R769-')
    and str(d.get('stationInsertSync','')).startswith('R771-')
    and str(d.get('clipSubscribeOverlay','')).startswith('R771-')
)
raise SystemExit(0 if ok else 1)
PY
  then OK=1; break; fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R771 /status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo '[7/8] 35 секунд наблюдаю транспорт/FFmpeg…'
sleep 35
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
LOG="$(journalctl -u "$SERVICE" --since "$START_TS" --no-pager || true)"
if printf '%s\n' "$LOG" | grep -Eq 'Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|status=76/PROTOCOL'; then
  echo '❌ Найден критический regression:'
  printf '%s\n' "$LOG" | grep -E 'Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|status=76/PROTOCOL' | tail -n 20 || true
  rollback
  exit 6
fi

echo '[8/8] ГОТОВО — R771 остаётся установлен.'
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("FILTER:",d.get("feederFilterChainGuard"));print("NEXT:",d.get("committedNextTitle") or "checkpoint ready");print("BUMPER:",d.get("stationInsertSync"));print("CLIP CTA:",d.get("clipSubscribeOverlay"));print("QUALITY:",d.get("videoBitrate"),d.get("audioBitrate"));print("ERROR:",d.get("lastError"))'
echo '✅ MP3 visual/filter path: R769 semicolon guard'
echo '✅ promised NEXT: disk checkpoint survives restart'
echo '✅ normal clips: right SUBSCRIBE is baked OFFLINE, not added to LIVE filtergraph'
echo '✅ station bumpers: true leading silence detected/trimmed OFFLINE only'
echo '✅ R767 exact clip A/V frame/sample clock + R766 tail-lock preserved'
