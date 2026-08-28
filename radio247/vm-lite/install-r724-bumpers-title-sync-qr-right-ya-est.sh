#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
QR_TARGET="$ASSET_DIR/andrik-qr-r612.png"
CTA_TARGET="$ASSET_DIR/subscribe-like-r722.png"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
TMP_DIR="$(mktemp -d /tmp/andrik-r724.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Загружаю R724: TITLE SYNC + BUMPERS + QR RIGHT + Я ЕСТЬ…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r724-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/andrik-qr-r723.png?v=55.00-r724-$(date +%s)" -o "$TMP_DIR/andrik-qr-r723.png"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-like-r722.png?v=55.00-r724-$(date +%s)" -o "$TMP_DIR/subscribe-like-r722.png"

node --check "$TMP_DIR/server.mjs" >/dev/null
for f in "$TMP_DIR/andrik-qr-r723.png" "$TMP_DIR/subscribe-like-r722.png"; do
  [ "$(stat -c%s "$f")" -gt 5000 ] || { echo "СТОП: PNG слишком мал: $f"; exit 3; }
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$f" | grep -qx png || { echo "СТОП: не PNG: $f"; exit 3; }
done

echo '[2/8] Проверяю R724 функции…'
grep -q 'R724-BUMPERS-TITLE-SYNC-QR-RIGHT-YA-EST' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R724'; exit 3; }
grep -q 'TITLE_HANDOFF_DELAY_MS_R724' "$TMP_DIR/server.mjs" || { echo 'СТОП: title sync отсутствует'; exit 3; }
grep -q 'BUMPER_MIN_SONGS_R724 = 6' "$TMP_DIR/server.mjs" || { echo 'СТОП: bumper min != 6'; exit 3; }
grep -q 'BUMPER_MAX_SONGS_R724 = 8' "$TMP_DIR/server.mjs" || { echo 'СТОП: bumper max != 8'; exit 3; }
grep -q 'radio-bumper-([123])' "$TMP_DIR/server.mjs" || { echo 'СТОП: 3 bumper slots отсутствуют'; exit 3; }
grep -q "title:'Я ЕСТЬ'" "$TMP_DIR/server.mjs" || { echo 'СТОП: Я ЕСТЬ не подключён'; exit 3; }
grep -q "key:'clips/ya-est-official-2026.mp4'" "$TMP_DIR/server.mjs" || { echo 'СТОП: R2 key Я ЕСТЬ отсутствует'; exit 3; }
grep -q 'overlay=x=W-w-24:y=24' "$TMP_DIR/server.mjs" || { echo 'СТОП: QR не справа'; exit 3; }
if grep -q 'overlay=24:24' "$TMP_DIR/server.mjs"; then echo 'СТОП: осталась старая позиция QR слева'; exit 3; fi

echo '[3/8] Проверяю persistent LIVE R721…'
grep -q "'-f','h264','-i','pipe:4'" "$TMP_DIR/server.mjs" || { echo 'СТОП: persistent H264 input пропал'; exit 3; }
grep -q "setts=time_base=1/\${VIDEO_FPS}:pts=N:dts=N:duration=1" "$TMP_DIR/server.mjs" || { echo 'СТОП: monotonic SETTS пропал'; exit 3; }
grep -q "'-c:v','copy'" "$TMP_DIR/server.mjs" || { echo 'СТОП: relay stream-copy пропал'; exit 3; }
grep -q 'clipBoundaryReconnect:false' "$TMP_DIR/server.mjs" || { echo 'СТОП: NO-RECONNECT guard пропал'; exit 3; }
grep -q 'CTA_SHOW_SECONDS_R722 = 8' "$TMP_DIR/server.mjs" || { echo 'СТОП: SUBSCRIBE/LIKE сломан'; exit 3; }
grep -q 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP_DIR/server.mjs" || { echo 'СТОП: TRUE FIT отсутствует'; exit 3; }
if grep -q 'cropdetect\|force_original_aspect_ratio=increase\|crop=1920:1080' "$TMP_DIR/server.mjs"; then echo 'СТОП: найден CROP'; exit 3; fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[4/8] Резервная копия R723…'
cp -a "$SERVER" "$SERVER.bak-r724-$TS"
mkdir -p "$ASSET_DIR"
[ -s "$QR_TARGET" ] && cp -a "$QR_TARGET" "$QR_TARGET.bak-r724-$TS" || true

echo '[5/8] Ставлю R724…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/andrik-qr-r723.png" "$QR_TARGET"
install -m 0644 "$TMP_DIR/subscribe-like-r722.png" "$CTA_TARGET"

echo '[6/8] Один установочный restart…'
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 140 --no-pager || true; exit 4; }

echo '[7/8] Проверяю LIVE/status R724…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("version")=="R724-BUMPERS-TITLE-SYNC-QR-RIGHT-YA-EST" and d.get("publisherRunning") and d.get("clipBoundaryReconnect") is False and d.get("qrPosition")=="top-right" and d.get("titleHandoffDelayMs")==1800 and d.get("nextBumperAfterSongs") in (6,7,8) else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || { echo 'R724 не подтвердил статус.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 180 --no-pager || true; exit 5; }
RECENT="$(journalctl -u "$SERVICE" --since '-20 seconds' --no-pager 2>/dev/null || true)"
if printf '%s' "$RECENT" | grep -qi 'non-monoton'; then
  echo 'СТОП: найден Non-monotonic DTS после R724'
  printf '%s\n' "$RECENT" | tail -n 100
  exit 6
fi

echo '[8/8] Финальный статус…'
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R724 ГОТОВ'
echo '✅ название песни: задержка handoff 1.8 сек, больше не перескакивает раньше аудио'
echo '✅ ЗАСТАВКА 1 / 2 / 3: отдельные R2 slots'
echo '✅ ротация заставок: после случайных 6–8 ПЕСЕН, слоты чередуются'
echo '✅ Я ЕСТЬ: clips/ya-est-official-2026.mp4 включён в обычную ротацию'
echo '✅ QR: ПРАВЫЙ верхний угол, зелёный R723 сохранён'
echo '✅ R722 SUBSCRIBE + LIKE сохранён'
echo '✅ R721 ONE RTMPS / SETTS / NO CROP / EQ сохранён'
echo '========================================================'
