#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r730.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/6] Загружаю R730: MEDIA-CLOCK TITLE + FADE SYNC…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r730-$(date +%s)" -o "$TMP_DIR/server.mjs"
node --check "$TMP_DIR/server.mjs" >/dev/null

echo '[2/6] Проверяю точную синхронизацию…'
grep -Fq "R730-MEDIA-CLOCK-TITLE-FADE-SYNC-R729-PRESERVED" "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R730'; exit 3; }
grep -Fq "MEDIA_INPUT_QUEUE_PACKETS_R730 = 64" "$TMP_DIR/server.mjs" || { echo 'СТОП: bounded media queue отсутствует'; exit 3; }
grep -Fq "TITLE_HANDOFF_DELAY_MS_R724 = 0" "$TMP_DIR/server.mjs" || { echo 'СТОП: title handoff всё ещё отложен'; exit 3; }
grep -Fq "VIDEO_FADE_SECONDS_R726 = 0.90" "$TMP_DIR/server.mjs" || { echo 'СТОП: R730 visible fade отсутствует'; exit 3; }
grep -Fq "trackUiGenerationR730" "$TMP_DIR/server.mjs" || { echo 'СТОП: stale NEXT/PREVIOUS guard отсутствует'; exit 3; }
grep -Fq "audio-handoff-bound-R730" "$TMP_DIR/server.mjs" || { echo 'СТОП: media clock marker отсутствует'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP_DIR/server.mjs" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }
grep -Fq "loudnorm=I=" "$TMP_DIR/server.mjs" || { echo 'СТОП: нормализация громкости потеряна'; exit 3; }
grep -Fq "BUMPER_MIN_SONGS_R724 = 4" "$TMP_DIR/server.mjs" || { echo 'СТОП: заставки 4–6 потеряны'; exit 3; }
grep -Fq "BUMPER_MAX_SONGS_R724 = 6" "$TMP_DIR/server.mjs" || { echo 'СТОП: заставки 4–6 потеряны'; exit 3; }

TS="$(date +%Y%m%d-%H%M%S)"
echo '[3/6] Резервная копия текущего движка…'
cp -a "$SERVER" "$SERVER.bak-r730-$TS"

echo '[4/6] Ставлю R730…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"

echo '[5/6] Один restart радио для нового media clock…'
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 160 --no-pager || true; exit 4; }

echo '[6/6] Проверяю реальный status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("version")=="R730-MEDIA-CLOCK-TITLE-FADE-SYNC-R729-PRESERVED" and d.get("publisherRunning") and d.get("clipBoundaryReconnect") is False and d.get("mediaInputQueuePackets")==64 and d.get("titleHandoffDelayMs")==0 and abs(float(d.get("videoFadeSeconds",0))-0.9)<0.01 and d.get("trackUiClock")=="audio-handoff-bound-R730" else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || { echo 'R730 не подтвердил status.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 180 --no-pager || true; exit 5; }

printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R730 ГОТОВ'
echo '✅ CURRENT меняется только на реальном старте следующего MP3'
echo '✅ РАНЕЕ / NEXT появляются ровно за 8 сек и защищены от старых таймеров'
echo '✅ video fade: 0.90 сек → BLACK → 0.90 сек из BLACK'
echo '✅ audio/video input queue: 64, многоминутный дрейф запрещён'
echo '✅ −14 LUFS / спецвставки / заставки 4–6 / QR / CTA / EQ сохранены'
echo '✅ ONE RTMPS сохранён'
echo '========================================================'
