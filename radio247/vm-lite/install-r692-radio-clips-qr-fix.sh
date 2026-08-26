#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
QR="$BASE/assets/andrik-qr-r612.png"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
GITHUB_BASE="https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main"
TMP="$(mktemp /tmp/andrik-radio-r692.XXXXXX.mjs)"
TMP_QR="$(mktemp /tmp/andrik-qr-r692.XXXXXX.png)"
BACKUP="$SERVER.bak-r692-$(date +%Y%m%d-%H%M%S)"
QR_BACKUP="$QR.bak-r692-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP" "$TMP_QR"' EXIT

png_ok(){ [ -s "$1" ] && [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]; }

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }

echo '[1/5] Проверяю QR PNG…'
if png_ok "$QR"; then
  echo 'QR уже настоящий PNG ✅'
else
  if [ -s "$QR" ]; then cp -a "$QR" "$QR_BACKUP"; fi
  SIG="$(od -An -tx1 -N8 "$QR" 2>/dev/null | tr -d ' \n' || true)"
  echo "Неверная сигнатура QR: ${SIG:-нет файла}. Загружаю настоящий PNG…"
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$GITHUB_BASE/assets/andrik-qr-r612.png?v=r692-$(date +%s)" -o "$TMP_QR"
  png_ok "$TMP_QR" || { echo 'СТОП: скачанный QR не PNG'; exit 3; }
  install -m 0644 "$TMP_QR" "$QR"
  echo 'QR исправлен ✅'
fi

echo '[2/5] Загружаю server R692…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$SITE_BASE/radio247/server.mjs?v=55.00-r692-$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null
grep -q 'R692-R2-RADIO-CLIP-LIBRARY-R690-FULL-FRAME-FIT-QR-REPAIRED' "$TMP" || { echo 'СТОП: в источнике ещё не R692.'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease:flags=lanczos' "$TMP" || { echo 'СТОП: R690 FIT не найден — эфир не трогаю.'; exit 3; }
grep -q 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$TMP" || { echo 'СТОП: R690 PAD не найден — эфир не трогаю.'; exit 3; }

echo '[3/5] Резерв и установка…'
cp -a "$SERVER" "$BACKUP"
install -m 0644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

rollback(){
  echo 'R692 не поднялся — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  systemctl restart "$SERVICE" || true
}

echo '[4/5] Перезапускаю radio service один раз…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 5; fi

echo '[5/5] Проверка сервера и QR…'
STATUS="$(curl -fsS --max-time 8 http://127.0.0.1:8080/status || true)"
if ! printf '%s' "$STATUS" | grep -q 'R692-R2-RADIO-CLIP-LIBRARY'; then echo "$STATUS"; rollback; exit 6; fi
png_ok "$QR" || { echo 'СТОП: QR снова не PNG'; rollback; exit 7; }
printf '%s\n' "$STATUS"
echo
echo 'ГОТОВО ✅ R692 активен. QR теперь настоящий PNG, клипы R2 сохранены, R690 full-frame сохранён.'
