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
TMP_DIR="$(mktemp -d /tmp/andrik-r726.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/9] Загружаю R726: SPECIAL30 + LOUDNORM + FADE + NEXT + ANTIREPEAT…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r726-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/andrik-qr-r723.png?v=55.00-r726-$(date +%s)" -o "$TMP_DIR/andrik-qr-r723.png"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/assets/subscribe-like-r722.png?v=55.00-r726-$(date +%s)" -o "$TMP_DIR/subscribe-like-r722.png"

node --check "$TMP_DIR/server.mjs" >/dev/null
for f in "$TMP_DIR/andrik-qr-r723.png" "$TMP_DIR/subscribe-like-r722.png"; do
  [ "$(stat -c%s "$f")" -gt 5000 ] || { echo "СТОП: PNG слишком мал: $f"; exit 3; }
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$f" | grep -qx png || { echo "СТОП: не PNG: $f"; exit 3; }
done

echo '[2/9] Проверяю функции R726…'
grep -Fq "R726-RADIO-POLISH-SPECIAL30-NORMALIZE-FADE-NEXT-ANTIREPEAT" "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R726'; exit 3; }
grep -Fq "radio-special-30min.mp4" "$TMP_DIR/server.mjs" || { echo 'СТОП: special 30min slot отсутствует'; exit 3; }
grep -Fq "SPECIAL_INTERVAL_MS_R726" "$TMP_DIR/server.mjs" || { echo 'СТОП: special interval отсутствует'; exit 3; }
grep -Fq 'loudnorm=I=${TRACK_AUDIO_TARGET_I_R726}' "$TMP_DIR/server.mjs" || { echo 'СТОП: loudnorm отсутствует'; exit 3; }
grep -Fq 'afade=t=in' "$TMP_DIR/server.mjs" || { echo 'СТОП: audio fade-in отсутствует'; exit 3; }
grep -Fq 'fade=t=out' "$TMP_DIR/server.mjs" || { echo 'СТОП: video fade-out отсутствует'; exit 3; }
grep -Fq 'LIVE_PREVIOUS_FILE_R726' "$TMP_DIR/server.mjs" || { echo 'СТОП: PREVIOUS overlay отсутствует'; exit 3; }
grep -Fq 'LIVE_NEXT_FILE_R726' "$TMP_DIR/server.mjs" || { echo 'СТОП: NEXT overlay отсутствует'; exit 3; }
grep -Fq 'TRACK_HISTORY_LIMIT_R726 = 20' "$TMP_DIR/server.mjs" || { echo 'СТОП: anti-repeat 20 отсутствует'; exit 3; }

echo '[3/9] Проверяю сохранение R725…'
grep -Fq 'BUMPER_MIN_SONGS_R724 = 4' "$TMP_DIR/server.mjs" || { echo 'СТОП: bumper min != 4'; exit 3; }
grep -Fq 'BUMPER_MAX_SONGS_R724 = 6' "$TMP_DIR/server.mjs" || { echo 'СТОП: bumper max != 6'; exit 3; }
grep -Fq 'radio-bumper-([123])' "$TMP_DIR/server.mjs" || { echo 'СТОП: 3 bumper slots отсутствуют'; exit 3; }
grep -Fq "title:'Я ЕСТЬ'" "$TMP_DIR/server.mjs" || { echo 'СТОП: Я ЕСТЬ не подключён'; exit 3; }
grep -Fq 'CTA_PERIOD_SECONDS_R722 = 120' "$TMP_DIR/server.mjs" || { echo 'СТОП: CTA 2min отсутствует'; exit 3; }
grep -Fq 'overlay=x=W-w-24:y=24' "$TMP_DIR/server.mjs" || { echo 'СТОП: QR не справа'; exit 3; }

echo '[4/9] Проверяю persistent LIVE R721…'
grep -Fq "'-f','h264','-i','pipe:4'" "$TMP_DIR/server.mjs" || { echo 'СТОП: persistent H264 input пропал'; exit 3; }
grep -Fq 'setts=time_base=1/${VIDEO_FPS}:pts=N:dts=N:duration=1' "$TMP_DIR/server.mjs" || { echo 'СТОП: monotonic SETTS пропал'; exit 3; }
grep -Fq "'-c:v','copy'" "$TMP_DIR/server.mjs" || { echo 'СТОП: relay stream-copy пропал'; exit 3; }
grep -Fq 'clipBoundaryReconnect:false' "$TMP_DIR/server.mjs" || { echo 'СТОП: NO-RECONNECT guard пропал'; exit 3; }
grep -Fq 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP_DIR/server.mjs" || { echo 'СТОП: TRUE FIT отсутствует'; exit 3; }
if grep -Eq 'cropdetect|force_original_aspect_ratio=increase|crop=1920:1080' "$TMP_DIR/server.mjs"; then echo 'СТОП: найден CROP'; exit 3; fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[5/9] Резервная копия текущей версии…'
cp -a "$SERVER" "$SERVER.bak-r726-$TS"
mkdir -p "$ASSET_DIR"
[ -s "$QR_TARGET" ] && cp -a "$QR_TARGET" "$QR_TARGET.bak-r726-$TS" || true

echo '[6/9] Ставлю R726…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/andrik-qr-r723.png" "$QR_TARGET"
install -m 0644 "$TMP_DIR/subscribe-like-r722.png" "$CTA_TARGET"

echo '[7/9] Один установочный restart…'
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 160 --no-pager || true; exit 4; }

echo '[8/9] Проверяю LIVE/status R726…'
STATUS=''; OK=0
for i in $(seq 1 35); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R726-RADIO-POLISH-SPECIAL30-NORMALIZE-FADE-NEXT-ANTIREPEAT" and d.get("publisherRunning") and d.get("clipBoundaryReconnect") is False and d.get("qrPosition")=="top-right" and d.get("subscribeLikePeriodSeconds")==120 and d.get("nextBumperAfterSongs") in (4,5,6) and d.get("specialIntervalSeconds")==1800 and d.get("nextPreviewSeconds")==8 and d.get("audioNormalizationTargetLufs")==-14 and d.get("antiRepeatTrackHistory")==20); raise SystemExit(0 if ok else 1)' 2>/dev/null; then OK=1; break; fi
  sleep 2
done
[ "$OK" = 1 ] || { echo 'R726 не подтвердил статус.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 220 --no-pager || true; exit 5; }
RECENT="$(journalctl -u "$SERVICE" --since '-25 seconds' --no-pager 2>/dev/null || true)"
if printf '%s' "$RECENT" | grep -Eqi 'non-monoton|broken pipe|invalid argument'; then
  echo 'СТОП: транспортная ошибка после R726'
  printf '%s\n' "$RECENT" | tail -n 120
  exit 6
fi

echo '[9/9] Финальный статус…'
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '========================================================'
echo '✅ R726 ГОТОВ'
echo '✅ SPECIAL MP4: фиксированный R2 slot, примерно раз в 30 минут МЕЖДУ песнями'
echo '✅ TRACK LOUDNESS: target -14 LUFS / TP -1.5 dB'
echo '✅ SONG TRANSITION: audio fade + видео fade в чёрное / из чёрного'
echo '✅ T-8s: слева РАНЕЕ + справа NEXT, затем исчезают'
echo '✅ АНТИПОВТОР: последние 20 песен отодвигаются; клип не повторяется первым в новом цикле'
echo '✅ R725: 3 заставки каждые 4–6 песен + CTA 8с/2мин + Я ЕСТЬ + QR справа'
echo '✅ R721 ONE RTMPS / SETTS / NO CROP / EQ сохранён'
echo '========================================================'
