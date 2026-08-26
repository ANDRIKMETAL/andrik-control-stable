#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
SERVICE=andrik-radio.service
CACHE=/var/cache/andrik-radio-r622/clips
CLIP="$CACHE/joy-of-being-official-2026.mp4"
CLIP_URL='https://music.andrikmetal.com/clips/joy-of-being-official-2026.mp4'
SERVER_URL="${R684_SERVER_URL:-https://andrikmetal.pages.dev/radio247/server.mjs?v=55.00-r684}"
QR_URL="${R684_QR_URL:-https://andrikmetal.pages.dev/assets/andrik-qr-r612.png?v=55.00-r684}"
TMP=/tmp/andrik-radio-server-r684.mjs
TMP_QR=/tmp/andrik-qr-r612-r684.png
PART="$CLIP.part"
BACKUP="$SERVER.r683-backup"
QR_BACKUP="$QR.r683-backup"

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }

echo '[1/5] Загружаю и проверяю R684 server...'
curl -fsSL --retry 3 --connect-timeout 15 --max-time 120 "$SERVER_URL" -o "$TMP"
grep -q 'R684-D1-GUARD-JOY-OF-BEING' "$TMP" || { echo 'СТОП: сервер ещё не обновлён до R684. Сначала задеплой архив R684.'; exit 3; }
node --check "$TMP" >/dev/null

echo '[2/5] Исправляю QR-оверлей (убираю старую ошибку Invalid PNG signature)...'
mkdir -p "$(dirname "$QR")"
curl -fsSL --retry 3 --connect-timeout 15 --max-time 120 "$QR_URL" -o "$TMP_QR"
python3 - "$TMP_QR" <<'PY'
import sys
p=sys.argv[1]
with open(p,'rb') as f: sig=f.read(8)
if sig != b'\x89PNG\r\n\x1a\n':
    raise SystemExit('СТОП: QR с сайта не является настоящим PNG')
PY
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$TMP_QR" | grep -q '^png,' || { echo 'СТОП: QR не проходит ffprobe как PNG'; exit 3; }
if [ -s "$QR" ]; then cp -f "$QR" "$QR_BACKUP"; fi
install -m 644 "$TMP_QR" "$QR"

echo '[3/5] Кэширую JOY OF BEING из R2 ДО перезапуска...'
mkdir -p "$CACHE"
if [ ! -s "$CLIP" ] || [ "$(stat -c%s "$CLIP" 2>/dev/null || echo 0)" -lt 1000000 ]; then
  rm -f "$PART"
  curl -fL --retry 3 --retry-all-errors --connect-timeout 15 --max-time 600 "$CLIP_URL" -o "$PART"
  size="$(stat -c%s "$PART" 2>/dev/null || echo 0)"
  [ "$size" -ge 1000000 ] || { echo "СТОП: клип слишком маленький ($size bytes)"; rm -f "$PART"; exit 4; }
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 "$PART" | grep -q . || { echo 'СТОП: видео не проходит ffprobe'; rm -f "$PART"; exit 4; }
  ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of csv=p=0 "$PART" | grep -q . || { echo 'СТОП: в клипе нет аудио'; rm -f "$PART"; exit 4; }
  mv -f "$PART" "$CLIP"
fi
echo "JOY cache: $(( $(stat -c%s "$CLIP") / 1024 / 1024 )) MB ✅"

echo '[4/5] Устанавливаю код с автоматическим откатом...'
cp -f "$SERVER" "$BACKUP"
install -m 644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

rollback(){
  echo 'R684 не запустился — возвращаю R683.'
  cp -f "$BACKUP" "$SERVER" || true
  if [ -s "$QR_BACKUP" ]; then cp -f "$QR_BACKUP" "$QR" || true; fi
  systemctl restart "$SERVICE" || true
}
if ! systemctl restart "$SERVICE"; then rollback; exit 5; fi
sleep 9
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi

echo '[5/5] Проверка...'
curl -fsS --max-time 8 http://127.0.0.1:8080/status | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const x=JSON.parse(s);console.log('RADIO='+x.publisherRunning+' / AUDIO='+x.producerRunning);console.log('VERSION='+x.version);console.log('NOW='+(x.current?.title||'—'));console.log('NEXT='+(x.next?.title||'—'));console.log('VIDEOS='+x.libraryVideos)})"
echo 'ГОТОВО ✅ R684 · QR исправлен · JOY OF BEING будет играть 1 раз за полный цикл, между песнями.'
