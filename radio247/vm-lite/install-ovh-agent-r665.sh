#!/usr/bin/env bash
set -Eeuo pipefail

URL="https://andrikmetal.com/radio247/vm-lite/andrik-radio-web-agent-r665.mjs"
TARGET="/usr/local/sbin/andrik-radio-web"
LIBTARGET="/usr/local/lib/andrik-radio-web-agent-r665.mjs"
SERVICE="andrik-radio-web-control.service"
TMP="$(mktemp /tmp/andrik-radio-agent-r665.XXXXXX.mjs)"
trap 'rm -f "$TMP"' EXIT

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
command -v node >/dev/null || { echo 'СТОП: node не найден.'; exit 2; }
command -v curl >/dev/null || { echo 'СТОП: curl не найден.'; exit 3; }

echo '[1/5] Скачиваю OVH Agent R665…'
curl -fsSL --retry 3 --connect-timeout 15 "${URL}?t=$(date +%s)" -o "$TMP"
node --check "$TMP" >/dev/null

echo '[2/5] Сохраняю резерв старого агента…'
if [ -s "$TARGET" ]; then
  cp -a "$TARGET" "${TARGET}.pre-r665.bak"
fi

echo '[3/5] Устанавливаю R665 без изменения pairing/token…'
install -m 755 "$TMP" "$TARGET"
install -m 755 "$TMP" "$LIBTARGET"

echo '[4/5] Перезапускаю web-control agent…'
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 5
systemctl is-active --quiet "$SERVICE" || {
  echo 'СТОП: web-control agent не поднялся. Возвращаю старый файл.'
  if [ -s "${TARGET}.pre-r665.bak" ]; then
    cp -a "${TARGET}.pre-r665.bak" "$TARGET"
    systemctl restart "$SERVICE" || true
  fi
  systemctl status "$SERVICE" --no-pager -l || true
  exit 4
}

echo '[5/5] Проверяю R665…'
node "$TARGET" status || true
echo
systemctl is-active "$SERVICE" || true
systemctl is-active andrik-radio.service || true
curl -fsS --max-time 5 http://127.0.0.1:8080/status || true
echo

echo 'ГОТОВО ✅ OVH RADIO AGENT R665 УСТАНОВЛЕН'
echo 'Теперь кнопки Control работают без /usr/local/sbin/andrik-youtube.'
