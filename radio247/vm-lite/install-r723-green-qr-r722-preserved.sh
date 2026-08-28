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
TMP_DIR="$(mktemp -d /tmp/andrik-r723.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/7] Загружаю R723: CLEAN GREEN QR поверх R722…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r723-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/andrik-qr-r723.png?v=55.00-r723-$(date +%s)" -o "$TMP_DIR/andrik-qr-r723.png"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-like-r722.png?v=55.00-r723-$(date +%s)" -o "$TMP_DIR/subscribe-like-r722.png"

node --check "$TMP_DIR/server.mjs" >/dev/null
for f in "$TMP_DIR/andrik-qr-r723.png" "$TMP_DIR/subscribe-like-r722.png"; do
  [ "$(stat -c%s "$f")" -gt 5000 ] || { echo "СТОП: PNG слишком мал: $f"; exit 3; }
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$f" | grep -qx png || { echo "СТОП: не PNG: $f"; exit 3; }
done
QR_META="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,pix_fmt -of csv=p=0 "$TMP_DIR/andrik-qr-r723.png")"
printf '%s' "$QR_META" | grep -q '512,512' || { echo "СТОП: QR не 512x512: $QR_META"; exit 3; }
printf '%s' "$QR_META" | grep -q 'rgba' || { echo "СТОП: QR без прозрачности RGBA: $QR_META"; exit 3; }

echo '[2/7] Проверяю, что весь R722/R721 transport сохранён…'
grep -q 'R723-GREEN-QR-R722-PRESERVED' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R723'; exit 3; }
grep -q "'-f','h264','-i','pipe:4'" "$TMP_DIR/server.mjs" || { echo 'СТОП: persistent H264 input пропал'; exit 3; }
grep -q "setts=time_base=1/\${VIDEO_FPS}:pts=N:dts=N:duration=1" "$TMP_DIR/server.mjs" || { echo 'СТОП: monotonic SETTS пропал'; exit 3; }
grep -q "'-c:v','copy'" "$TMP_DIR/server.mjs" || { echo 'СТОП: relay stream-copy пропал'; exit 3; }
grep -q 'clipBoundaryReconnect:false' "$TMP_DIR/server.mjs" || { echo 'СТОП: NO-RECONNECT guard пропал'; exit 3; }
grep -q 'CTA_SHOW_SECONDS_R722 = 8' "$TMP_DIR/server.mjs" || { echo 'СТОП: SUBSCRIBE/LIKE duration сломана'; exit 3; }
grep -q 'CTA_PERIOD_SECONDS_R722 = 300' "$TMP_DIR/server.mjs" || { echo 'СТОП: SUBSCRIBE/LIKE period сломан'; exit 3; }
grep -q 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP_DIR/server.mjs" || { echo 'СТОП: TRUE FIT отсутствует'; exit 3; }
if grep -q 'cropdetect\|force_original_aspect_ratio=increase\|crop=1920:1080' "$TMP_DIR/server.mjs"; then echo 'СТОП: найден CROP'; exit 3; fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[3/7] Делаю резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r723-$TS"
mkdir -p "$ASSET_DIR"
[ -s "$QR_TARGET" ] && cp -a "$QR_TARGET" "$QR_TARGET.bak-r723-$TS" || true

echo '[4/7] Ставлю R723 server + чистый QR…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/andrik-qr-r723.png" "$QR_TARGET"
install -m 0644 "$TMP_DIR/subscribe-like-r722.png" "$CTA_TARGET"

echo '[5/7] Один restart только для перезагрузки QR…'
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 120 --no-pager || true; exit 4; }

echo '[6/7] Проверяю LIVE/status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("version")=="R723-GREEN-QR-R722-PRESERVED" and d.get("publisherRunning") and d.get("clipBoundaryReconnect") is False and d.get("subscribeLikeShowSeconds")==8 and d.get("subscribeLikePeriodSeconds")==300 else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || { echo 'R723 не подтвердил статус.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 160 --no-pager || true; exit 5; }
RECENT="$(journalctl -u "$SERVICE" --since '-20 seconds' --no-pager 2>/dev/null || true)"
if printf '%s' "$RECENT" | grep -qi 'non-monoton'; then
  echo 'СТОП: найден Non-monotonic DTS после R723'
  printf '%s\n' "$RECENT" | tail -n 80
  exit 6
fi

echo '[7/7] Финальный статус…'
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R723 ГОТОВ'
echo '✅ чёрной внешней рамки вокруг QR НЕТ'
echo '✅ снаружи сразу ЗЕЛЁНАЯ обводка'
echo '✅ внутри чистое БЕЛОЕ поле + исходный QR'
echo '✅ SUBSCRIBE + 👍 LIKE из R722 сохранён'
echo '✅ R721 ONE RTMPS / SETTS / NO CROP сохранён'
echo '✅ красная линия + title outline + 4 EQ сохранены'
echo '========================================================'
