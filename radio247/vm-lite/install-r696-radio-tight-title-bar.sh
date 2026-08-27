#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-radio-r696.XXXXXX.mjs)"
BACKUP="$SERVER.bak-r696-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

png_ok(){ [ -s "$1" ] && [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]; }

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
png_ok "$QR" || { echo 'СТОП: QR overlay повреждён — радио не трогаю.'; exit 2; }

echo '[1/5] Загружаю R696…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r696-$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null
grep -q 'R696-R2-RADIO-CLIPS-TIGHT-TITLE-BAR' "$TMP" || { echo 'СТОП: в источнике ещё не R696.'; exit 3; }
grep -q 'detectInsetBlackFrameCrop' "$TMP" || { echo 'СТОП: R696 safe-frame detector отсутствует.'; exit 3; }
grep -q 'cropdetect=limit=4:round=2:reset=0' "$TMP" || { echo 'СТОП: R696 black-inset detector отсутствует.'; exit 3; }
grep -q 'DejaVuSansCondensed-BoldOblique.ttf' "$TMP" || { echo 'СТОП: новый metal-title font отсутствует.'; exit 3; }
grep -q 'fontcolor=0xF3EFE8:fontsize=58' "$TMP" || { echo 'СТОП: новый крупный title style отсутствует.'; exit 3; }
grep -q 'box=1:boxcolor=black@0.36:boxborderw=18' "$TMP" || { echo 'СТОП: компактная чёрная плашка под title отсутствует.'; exit 3; }
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
  echo 'R696 не подтвердился — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  systemctl restart "$SERVICE" || true
}
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi

echo '[4/5] Жду статус R696…'
STATUS=''
for i in $(seq 1 15); do
  sleep 3
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R696-R2-RADIO-CLIPS'; then break; fi
done
if ! printf '%s' "$STATUS" | grep -q 'R696-R2-RADIO-CLIPS'; then
  echo 'R696 не подтвердился за 45 секунд.'
  systemctl status "$SERVICE" --no-pager -l | tail -n 25 || true
  rollback
  exit 5
fi

echo '[5/5] Проверка…'
printf '%s\n' "$STATUS"
png_ok "$QR" || { echo 'СТОП: QR перестал быть PNG'; rollback; exit 6; }

echo
echo 'ГОТОВО ✅ R696 активен.'
echo '✅ Клип: настоящий кадр не режется и не растягивается.'
echo '✅ Если MP4 сам содержит большой чёрный inset со всех сторон — удаляется только эта пустая рамка.'
echo '✅ После этого видимая картинка FIT 1920x1080 с сохранением пропорций.'
echo '✅ Жёлтый квадрат/emoji перед КЛИП убран.'
echo '✅ Названия клипов и песен: крупнее, бело-серебряный heavy italic + красный контур.
✅ Чёрная плашка теперь только по длине названия, без длинной полосы.
✅ Красная линия над названием убрана.'
echo '✅ JOY OF BEING, R2 clips, QR, MP3 art fix и DAY/EVENING/NIGHT сохранены.'
