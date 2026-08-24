#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
YT="$BASE/youtube-device-console-r626.mjs"
UI="$BASE/andrik-radio-console-r626.sh"
[ -s "$YT" ] || { echo "Нет $YT. Сначала обнови /opt/andrik-radio до R626."; exit 2; }
[ -s "$UI" ] || { echo "Нет $UI. Сначала обнови /opt/andrik-radio до R626."; exit 2; }
install -m 755 "$YT" /usr/local/sbin/andrik-youtube
install -m 755 "$UI" /usr/local/sbin/andrik-radio
stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO CONTROL R626

Авторизация YouTube теперь проходит ССЫЛКОЙ, без Google-кода в AWS:
  https://andrikmetal.com/youtube-device-auth-admin.html

1) вставь Client ID + Secret на странице;
2) страница сама получит Google Device code и будет сама опрашивать Google;
3) после «Устройство подключено» дождись зелёной галочки на странице;
4) AWS при пункте 1 «ЗАПУСТИТЬ СТРИМ» автоматически заберёт refresh token с сайта;
5) временный пакет на сайте удаляется после получения AWS.

Главная консоль:
  sudo andrik-radio
TXT
