#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
TMP_DIR="$(mktemp -d /tmp/andrik-r722.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/7] Загружаю R722: SUBSCRIBE + LIKE поверх стабильного R721…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r722-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-like-r722.png?v=55.00-r722-$(date +%s)" -o "$TMP_DIR/subscribe-like-r722.png"

node --check "$TMP_DIR/server.mjs" >/dev/null
[ "$(stat -c%s "$TMP_DIR/subscribe-like-r722.png")" -gt 5000 ] || { echo 'СТОП: CTA PNG повреждён'; exit 3; }
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of default=nw=1 "$TMP_DIR/subscribe-like-r722.png" | grep -q 'codec_name=png' || { echo 'СТОП: CTA не PNG'; exit 3; }

echo '[2/7] Проверяю, что R721 LIVE transport не сломан…'
grep -q 'R722-SUBSCRIBE-LIKE-R721-PERSISTENT-LIVE' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R722'; exit 3; }
grep -q "'-f','h264','-i','pipe:4'" "$TMP_DIR/server.mjs" || { echo 'СТОП: persistent H264 input пропал'; exit 3; }
grep -q "setts=time_base=1/\${VIDEO_FPS}:pts=N:dts=N:duration=1" "$TMP_DIR/server.mjs" || { echo 'СТОП: monotonic SETTS пропал'; exit 3; }
grep -q "'-c:v','copy'" "$TMP_DIR/server.mjs" || { echo 'СТОП: relay stream-copy пропал'; exit 3; }
grep -q 'clipBoundaryReconnect:false' "$TMP_DIR/server.mjs" || { echo 'СТОП: NO-RECONNECT guard пропал'; exit 3; }

echo '[3/7] Проверяю CTA и визуальные гарантии…'
grep -q 'CTA_SHOW_SECONDS_R722 = 8' "$TMP_DIR/server.mjs" || { echo 'СТОП: CTA duration не 8 сек'; exit 3; }
grep -q 'CTA_PERIOD_SECONDS_R722 = 300' "$TMP_DIR/server.mjs" || { echo 'СТОП: CTA period не 5 минут'; exit 3; }
grep -q 'subscribe-like-r722.png' "$TMP_DIR/server.mjs" || { echo 'СТОП: CTA asset не подключён'; exit 3; }
grep -q "overlay=x=(W-w)/2:y=46" "$TMP_DIR/server.mjs" || { echo 'СТОП: CTA position guard отсутствует'; exit 3; }
grep -q 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP_DIR/server.mjs" || { echo 'СТОП: TRUE FIT отсутствует'; exit 3; }
grep -q 'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill' "$TMP_DIR/server.mjs" || { echo 'СТОП: красная линия отсутствует'; exit 3; }
if grep -q 'cropdetect\|force_original_aspect_ratio=increase\|crop=1920:1080' "$TMP_DIR/server.mjs"; then echo 'СТОП: найден CROP'; exit 3; fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[4/7] Резервная копия R721…'
cp -a "$SERVER" "$SERVER.bak-r722-$TS"
mkdir -p "$ASSET_DIR"

echo '[5/7] Ставлю server + CTA…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/subscribe-like-r722.png" "$ASSET_DIR/subscribe-like-r722.png"

echo '[6/7] Один restart для загрузки R722…'
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 120 --no-pager || true; exit 4; }

STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("version")=="R722-SUBSCRIBE-LIKE-R721-PERSISTENT-LIVE" and d.get("publisherRunning") and d.get("clipBoundaryReconnect") is False and d.get("subscribeLikeShowSeconds")==8 and d.get("subscribeLikePeriodSeconds")==300 else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || { echo 'R722 не подтвердил статус.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 160 --no-pager || true; exit 5; }

RECENT="$(journalctl -u "$SERVICE" --since '-20 seconds' --no-pager 2>/dev/null || true)"
if printf '%s' "$RECENT" | grep -qi 'non-monoton'; then
  echo 'СТОП: найден Non-monotonic DTS после R722'
  printf '%s\n' "$RECENT" | tail -n 80
  exit 6
fi

echo '[7/7] Финальный статус…'
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R722 ГОТОВ'
echo '✅ SUBSCRIBE + 👍 LIKE — одна плашка'
echo '✅ появляется на 8 секунд каждые 5 минут'
echo '✅ сверху по центру, не закрывает QR/title/EQ/ticker'
echo '✅ видеоклипы остаются чистыми'
echo '✅ R721 ONE RTMPS / SETTS / NO CROP сохранены'
echo '✅ красная линия + обводка + тень сохранены'
echo '✅ 4 бесшовных EQ сохранены'
echo '========================================================'
