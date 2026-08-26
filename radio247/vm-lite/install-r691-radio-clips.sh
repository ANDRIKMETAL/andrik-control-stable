#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
TMP="$(mktemp /tmp/andrik-radio-r691.XXXXXX.mjs)"
BACKUP="$SERVER.bak-r691-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }

echo '[1/4] Загружаю R691 с сайта…'
curl -fsSL --retry 3 --retry-all-errors --connect-timeout 15 --max-time 120 "$SITE_BASE/radio247/server.mjs?v=55.00-r691" -o "$TMP"
node --check "$TMP" >/dev/null
grep -q 'R691-R2-RADIO-CLIP-LIBRARY-R690-FULL-FRAME-FIT' "$TMP" || { echo 'СТОП: на сайте ещё не R691. Сначала задеплой архив R691.'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease:flags=lanczos' "$TMP" || { echo 'СТОП: R690 FIT не найден — эфир не трогаю.'; exit 3; }
grep -q 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$TMP" || { echo 'СТОП: R690 PAD не найден — эфир не трогаю.'; exit 3; }

echo '[2/4] Делаю резерв и ставлю сервер…'
cp -a "$SERVER" "$BACKUP"
install -m 644 "$TMP" "$SERVER"
node --check "$SERVER" >/dev/null

rollback(){
  echo 'R691 не поднялся — возвращаю предыдущий server.mjs.'
  cp -f "$BACKUP" "$SERVER" || true
  systemctl restart "$SERVICE" || true
}

echo '[3/4] Один раз перезапускаю radio service…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 5; fi

STATUS="$(curl -fsS --max-time 8 http://127.0.0.1:8080/status || true)"
echo '[4/4] Проверка…'
if ! printf '%s' "$STATUS" | grep -q 'R691-R2-RADIO-CLIP-LIBRARY'; then
  echo "$STATUS"
  rollback
  exit 6
fi
printf '%s\n' "$STATUS"
echo
echo 'ГОТОВО ✅ R691 активен. Теперь новые MP4 из блока «КЛИПЫ В РАДИО» AWS подхватывает сам примерно за 2 минуты.'
echo 'Каждый клип играет 1 раз за полный перемешанный цикл, случайно между песнями. JOY OF BEING сохранён.'
