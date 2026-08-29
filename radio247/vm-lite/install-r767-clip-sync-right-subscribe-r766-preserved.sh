#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
CTA="$ASSET_DIR/subscribe-right-r767.png"
SERVICE=andrik-radio.service
ENV_FILE=/etc/andrik-radio.env
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_SERVER="$(mktemp /tmp/andrik-r767.XXXXXX.mjs)"
TMP_CTA="$(mktemp /tmp/andrik-r767-cta.XXXXXX.png)"
BACKUP_SERVER="${SERVER}.bak-before-r767-$(date +%Y%m%d-%H%M%S)"
ENV_BACKUP="${ENV_FILE}.bak-before-r767-$(date +%Y%m%d-%H%M%S)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
DROPIN="$DROPIN_DIR/r767-stable.conf"
trap 'rm -f "$TMP_SERVER" "$TMP_CTA"' EXIT

for c in curl node python3 systemctl ffmpeg ffprobe grep journalctl ps; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "СТОП: нет $ENV_FILE"; exit 2; }

echo '[1/10] Скачиваю R767 + новую правую SUBSCRIBE…'
STAMP="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r767-$STAMP" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-right-r767.png?v=55.00-r767-$STAMP" -o "$TMP_CTA"

echo '[2/10] Проверяю R767 sync + CTA + сохранённую стабильность…'
node --check "$TMP_SERVER" >/dev/null
[ "$(stat -c %s "$TMP_CTA")" -gt 10000 ] || { echo 'СТОП: новая CTA PNG слишком маленькая/не скачалась'; exit 3; }
ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$TMP_CTA" >/dev/null 2>&1 || { echo 'СТОП: CTA PNG не читается ffmpeg'; exit 3; }
grep -Fq "R767-CLIP-FRAMECLOCK-SYNC-RIGHT-SUBSCRIBE-R766-PRESERVED" "$TMP_SERVER" || { echo 'СТОП: скачался не R767'; exit 3; }
grep -Fq "R767-SYNC-MARKER: EXACT-VIDEO-N25 + EXACT-AUDIO-NSR + NO-REDUNDANT-LIVE-LANCZOS" "$TMP_SERVER" || { echo 'СТОП: R767 sync marker отсутствует'; exit 3; }
grep -Fq 'asetpts=N/SR/TB' "$TMP_SERVER" || { echo 'СТОП: exact audio sample clock отсутствует'; exit 3; }
grep -Fq 'setpts=N/(${VIDEO_FPS}*TB)' "$TMP_SERVER" || { echo 'СТОП: exact video frame clock отсутствует'; exit 3; }
grep -Fq "subscribe-right-r767.png" "$TMP_SERVER" || { echo 'СТОП: новая CTA не подключена'; exit 3; }
grep -Fq "overlay=x=W-w-\${CTA_RIGHT_GAP_R767}:y=H-h-\${CTA_BOTTOM_GAP_R748}" "$TMP_SERVER" || { echo 'СТОП: CTA не справа'; exit 3; }
grep -Fq "clipAvTailLockMode:'R766-PER-OUTPUT-T+VIDEO-TPAD-TRIM+AUDIO-APAD-ATRIM'" "$TMP_SERVER" || { echo 'СТОП: R766 tail lock потерян'; exit 3; }
grep -Fq "const VIDEO_BITRATE = '6000k'" "$TMP_SERVER" || { echo 'СТОП: video bitrate не 6000k'; exit 3; }
grep -Fq "const AUDIO_BITRATE = '160k'" "$TMP_SERVER" || { echo 'СТОП: audio bitrate не 160k'; exit 3; }
grep -Fq "masterVideoReencode:false" "$TMP_SERVER" || { echo 'СТОП: R761 single encode потерян'; exit 3; }
grep -Fq "const BUMPER_MIN_SONGS_R724 = 3" "$TMP_SERVER" || { echo 'СТОП: bumper min не 3'; exit 3; }
grep -Fq "const BUMPER_MAX_SONGS_R724 = 4" "$TMP_SERVER" || { echo 'СТОП: bumper max не 4'; exit 3; }
grep -Fq "R764-PREPARED-ONLY-COMMIT-GATE" "$TMP_SERVER" || { echo 'СТОП: R764 clip gate потерян'; exit 3; }
grep -Fq "const VIDEO_FADE_LEAD_SECONDS_R735 = 1.40" "$TMP_SERVER" || { echo 'СТОП: fade lead потерян'; exit 3; }
grep -Fq "const VIDEO_FADE_IN_SECONDS_R736 = 0.80" "$TMP_SERVER" || { echo 'СТОП: brighten потерян'; exit 3; }

echo '[3/10] Backup…'
cp -a "$SERVER" "$BACKUP_SERVER"
cp -a "$ENV_FILE" "$ENV_BACKUP"
rollback(){
  echo '⚠️ R767 не прошёл запуск — возвращаю предыдущий server…'
  cp -a "$BACKUP_SERVER" "$SERVER"
  cp -a "$ENV_BACKUP" "$ENV_FILE"
  systemctl daemon-reload || true
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[4/10] Устанавливаю server + новую правую CTA…'
mkdir -p "$ASSET_DIR"
install -m 0644 "$TMP_SERVER" "$SERVER"
install -m 0644 "$TMP_CTA" "$CTA"
chmod 600 "$ENV_FILE"

echo '[5/10] Prepared-клипы НЕ удаляю: R767 синхронизирует их LIVE без тяжёлого повторного scale/pad.'

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
 d.get('masterVideoReencode') is False and
 d.get('videoEncodePasses')==1 and
 d.get('videoBitrate')=='6000k' and
 d.get('audioBitrate')=='160k' and
 d.get('subscribeLikePosition')=='bottom-right-above-ticker' and
 str(d.get('subscribeLikeOverlay','')).endswith('/assets/subscribe-right-r767.png') and
 d.get('clipAvSyncFix')=='R767-VIDEO-N/25-AUDIO-N/SR-NO-LIVE-RESCALE' and
 d.get('clipAvTailLockMode')=='R766-PER-OUTPUT-T+VIDEO-TPAD-TRIM+AUDIO-APAD-ATRIM' and
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

echo '[9/10] Проверяю transport после запуска…'
sleep 25
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
if journalctl -u "$SERVICE" --since "$START_TS" --no-pager | grep -Eq 'status=76|master pipe NO-PROGRESS'; then
  echo '❌ появился NO-PROGRESS/status=76 — откат'; rollback; exit 6
fi
MASTER_LINE="$(ps -eo pid,args | grep '[f]fmpeg' | grep 'pipe:4' | head -n 1 || true)"
echo "$MASTER_LINE" | grep -Fq -- '-c:v copy' || { echo '❌ master не copy-mode'; rollback; exit 6; }
echo "$MASTER_LINE" | grep -Fq -- '-b:a 160k' || { echo '❌ AAC не 160k'; rollback; exit 6; }

echo '[10/10] Итог…'
STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status || true)"
printf '%s\n' "$STATUS" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("VERSION:",d.get("version"));print("VIDEO/AUDIO:",d.get("videoBitrate"),d.get("audioBitrate"));print("PUBLISHER:",d.get("publisherRunning"),"healthy=",d.get("transportHealthy"));print("CLIP SYNC:",d.get("clipAvSyncFix"));print("CTA:",d.get("subscribeLikePosition"),d.get("subscribeLikeOverlay"));print("ERROR:",d.get("lastError"))'

echo
echo '✅ R767 ГОТОВ — CLIP A/V FRAMECLOCK SYNC + RIGHT SUBSCRIBE'
echo '✅ клип: video=N/25, audio=N/SR — единый математический таймлайн без дрейфа'
echo '✅ убран повторный LIVE Lanczos scale/pad уже подготовленного 1080p клипа — меньше CPU и меньше риска отставания видео'
echo '✅ R766 одинаковый хвост видео/звука сохранён'
echo '✅ новая SUBSCRIBE справа над бегущей строкой; старая левая SUBSCRIBE+LIKE больше не используется'
echo '✅ 6000k + AAC160 + R761 single encode + R760/R753 FIT/PAD сохранены'
echo '✅ R765 push + R764 clip gate/bumper 3–4 + R763 fade сохранены'
