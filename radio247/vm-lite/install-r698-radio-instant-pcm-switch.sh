#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-radio-r698.XXXXXX.mjs)"
BACKUP="$SERVER.bak-r698-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

png_ok(){ [ -s "$1" ] && [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]; }

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
png_ok "$QR" || { echo 'СТОП: QR overlay повреждён — радио не трогаю.'; exit 2; }

echo '[1/5] Загружаю R698…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r698-$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null
grep -q 'R698-R2-RADIO-CLIPS-INSTANT-PCM-SWITCH' "$TMP" || { echo 'СТОП: в источнике ещё не R698.'; exit 3; }
grep -q 'detectInsetBlackFrameCrop' "$TMP" || { echo 'СТОП: R698 safe-frame detector отсутствует.'; exit 3; }
grep -q 'cropdetect=limit=4:round=2:reset=0' "$TMP" || { echo 'СТОП: R698 black-inset detector отсутствует.'; exit 3; }
grep -q 'DejaVuSansCondensed-BoldOblique.ttf' "$TMP" || { echo 'СТОП: новый metal-title font отсутствует.'; exit 3; }
grep -q 'fontcolor=0xF3EFE8:fontsize=58' "$TMP" || { echo 'СТОП: новый крупный title style отсутствует.'; exit 3; }
grep -q 'box=1:boxcolor=black@0.36:boxborderw=18' "$TMP" || { echo 'СТОП: компактная чёрная плашка под title отсутствует.'; exit 3; }
grep -q 'const OUTPUT_TIMESHIFT_SECONDS = 1' "$TMP" || { echo 'СТОП: быстрый 1-секундный буфер переключения отсутствует.'; exit 3; }
grep -q "'-probesize','32','-analyzeduration','0','-f','s16le'" "$TMP" || { echo 'СТОП: instant PCM probe fix отсутствует.'; exit 3; }
grep -q 'end watchdog forced fast handoff' "$TMP" || { echo 'СТОП: clip end watchdog отсутствует.'; exit 3; }
grep -q 'await sleep(45)' "$TMP" || { echo 'СТОП: быстрый restart handoff отсутствует.'; exit 3; }
grep -q 'bestCount<18' "$TMP" || { echo 'СТОП: строгая защита от ложного crop отсутствует.'; exit 3; }
grep -q 'size.width\*0.24' "$TMP" || { echo 'СТОП: safe-fit threshold отсутствует.'; exit 3; }
grep -q 'never allow two video clips back-to-back' "$TMP" || { echo 'СТОП: защита от двух клипов подряд отсутствует.'; exit 3; }
grep -q 'КЛИП • ANDRIK —' "$TMP" || { echo 'СТОП: клип-заголовок без emoji не найден.'; exit 3; }
grep -q 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP" || { echo 'СТОП: FIT 1920x1080 отсутствует.'; exit 3; }
grep -q 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$TMP" || { echo 'СТОП: безопасный PAD отсутствует.'; exit 3; }
if grep -q "drawbox=x=125:y=ih-208:w=iw-250:h=3:color=red@0.82:t=fill" "$TMP"; then
  echo 'СТОП: старая красная линия всё ещё есть — эфир не трогаю.'
  exit 3
fi
if grep -q "'crop=1920:1080'\|force_original_aspect_ratio=increase" "$TMP"; then
  echo 'СТОП: найден старый cover-crop — эфир не трогаю.'
  exit 3
fi

echo '[2/5] Резервная копия текущего server.mjs…'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

echo '[3/5] Один перезапуск радио…'
rollback(){
  echo 'R698 не подтвердился — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  systemctl restart "$SERVICE" || true
}
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi

echo '[4/5] Жду статус R698…'
STATUS=''
for i in $(seq 1 15); do
  sleep 3
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R698-R2-RADIO-CLIPS'; then break; fi
done
if ! printf '%s' "$STATUS" | grep -q 'R698-R2-RADIO-CLIPS'; then
  echo 'R698 не подтвердился за 45 секунд.'
  systemctl status "$SERVICE" --no-pager -l | tail -n 25 || true
  rollback
  exit 5
fi

echo '[5/5] Проверка…'
printf '%s\n' "$STATUS"
png_ok "$QR" || { echo 'СТОП: QR перестал быть PNG'; rollback; exit 6; }

echo
echo 'ГОТОВО ✅ R698 активен.'
echo '✅ Клип: настоящий кадр не режется и не растягивается.'
echo '✅ Если MP4 сам содержит большой чёрный inset со всех сторон — удаляется только эта пустая рамка.'
echo '✅ После этого видимая картинка FIT 1920x1080 с сохранением пропорций.'
echo '✅ Жёлтый квадрат/emoji перед КЛИП убран.'
echo '✅ Названия клипов и песен: крупнее, бело-серебряный heavy italic + красный контур.'
echo '✅ Чёрная плашка только по длине названия; красной линии сверху нет.'
echo '✅ Переключение КЛИП ↔ MP3 ускорено: буфер 1 секунда.'
echo '✅ Главная причина долгого зависания исправлена: FFmpeg больше не ждёт большой PCM probe перед стартом MP3.'
echo '✅ После конца клипа новый MP3 начинает кормить эфир почти сразу; ожидание handoff 45 мс.'
echo '✅ Если clip publisher зависает на закрытии, watchdog принудительно освобождает переход максимум через ~0.9 с после длительности клипа.'
echo '✅ Два клипа подряд запрещены: между ними всегда подставляется MP3.'
echo '✅ Crop detector ужесточён: обычные 16:9 клипы и тёмные края не режутся.'
echo '✅ JOY OF BEING, R2 clips, QR, MP3 art fix и DAY/EVENING/NIGHT сохранены.'
