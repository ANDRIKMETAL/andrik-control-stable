#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
YT="$BASE/youtube-device-console-r625.mjs"
UI="$BASE/andrik-radio-console-r625.sh"
[ -s "$YT" ] || { echo "Нет $YT. Сначала обнови /opt/andrik-radio до R625."; exit 2; }
[ -s "$UI" ] || { echo "Нет $UI. Сначала обнови /opt/andrik-radio до R625."; exit 2; }
install -m 755 "$YT" /usr/local/sbin/andrik-youtube
install -m 755 "$UI" /usr/local/sbin/andrik-radio
stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO CONTROL R625

Главная консоль:
  sudo andrik-radio

Авторизация YouTube теперь без длинных Client ID/Secret в AWS:
1) открой https://andrikmetal.com/youtube-device-pair-admin.html
2) вставь Client ID + Client Secret на странице
3) получи короткий одноразовый код
4) в sudo andrik-radio выбери пункт 6 и введи только этот код
5) AWS сам заберёт OAuth Client, код уничтожится и запустится Google Device OAuth

Refresh token после подтверждения Google хранится только на AWS:
  /etc/andrik-youtube-device.json (0600)
TXT
