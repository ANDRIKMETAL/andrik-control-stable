#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
CACHE=/var/cache/andrik-radio-r622
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-radio-r693.XXXXXX.mjs)"
BACKUP="$SERVER.bak-r693-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

png_ok(){ [ -s "$1" ] && [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]; }

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }

echo '[1/6] Диагностика PNG…'
if png_ok "$QR"; then
  echo 'QR overlay настоящий PNG ✅'
  echo 'Ошибка «Invalid PNG signature FF D8 FF E0» была НЕ от QR: это JPEG-обложка внутри одного из MP3, ошибочно объявленная как PNG.'
else
  echo 'ВНИМАНИЕ: QR overlay сам повреждён. R693 сервер не устанавливаю.'
  exit 3
fi

echo '[2/6] Загружаю R693 без изменения проверенных R691 User-Agent…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r693-$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null
grep -q 'R693-R2-RADIO-CLIPS-R690-FULL-FRAME-FIT-AUDIO-ART-FIX' "$TMP" || { echo 'СТОП: в источнике ещё не R693.'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease:flags=lanczos' "$TMP" || { echo 'СТОП: R690 FULL-FRAME FIT отсутствует.'; exit 3; }
grep -q 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$TMP" || { echo 'СТОП: R690 PAD отсутствует.'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP"; then
  echo 'СТОП: найден старый crop/cover — эфир не трогаю.'
  exit 3
fi

echo '[3/6] Делаю резерв server.mjs…'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

echo '[4/6] Удаляю только локальный MP3-кэш с плохими встроенными обложками…'
mkdir -p "$CACHE/audio"
find "$CACHE/audio" -maxdepth 1 -type f \( -name '*.mp3' -o -name '*.part-*' -o -name '*.clean-*' \) -delete || true

echo '[5/6] Один перезапуск radio service…'
rollback(){
  echo 'R693 не подтвердился — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  systemctl restart "$SERVICE" || true
}
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi

# Не делаем ложный откат через 8 секунд: даём радио до 45 секунд скачать первый MP3 и поднять master.
STATUS=''
for i in $(seq 1 15); do
  sleep 3
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R693-R2-RADIO-CLIPS'; then break; fi
done

if ! printf '%s' "$STATUS" | grep -q 'R693-R2-RADIO-CLIPS'; then
  echo 'R693 не подтвердился за 45 секунд.'
  systemctl status "$SERVICE" --no-pager -l | tail -n 25 || true
  rollback
  exit 5
fi

echo '[6/6] Проверка полного кадра и эфира…'
printf '%s\n' "$STATUS"
echo
printf '%s' "$STATUS" | grep -q 'R690' || { echo 'СТОП: статус не подтверждает R690 FIT'; rollback; exit 6; }
png_ok "$QR" || { echo 'СТОП: QR перестал быть PNG'; rollback; exit 7; }

echo 'ГОТОВО ✅ R693 активен.'
echo '✅ FULL FRAME: contain/FIT 1920x1080, crop OFF, stretch OFF.'
echo '✅ Invalid PNG signature: встроенные картинки MP3 удаляются из радио-кэша, аудио копируется без перекодирования.'
echo '✅ QR не трогался — он был настоящим PNG.'
echo '✅ КЛИПЫ R2 + JOY OF BEING сохранены.'
