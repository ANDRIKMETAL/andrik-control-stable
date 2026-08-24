#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
YT="$BASE/youtube-device-console-r624.mjs"
UI="$BASE/andrik-radio-console-r624.sh"
[ -s "$YT" ] || { echo "Нет $YT. Сначала обнови /opt/andrik-radio до R624."; exit 2; }
[ -s "$UI" ] || { echo "Нет $UI. Сначала обнови /opt/andrik-radio до R624."; exit 2; }
install -m 755 "$YT" /usr/local/sbin/andrik-youtube
install -m 755 "$UI" /usr/local/sbin/andrik-radio
stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO CONTROL R624

Главная консоль:
  sudo andrik-radio

Пункт 1: 🔴 ЗАПУСТИТЬ СТРИМ — БЕЗ YOUTUBE STUDIO
- если старый эфир завершён и активного broadcast нет, создаст новый;
- привяжет его к stream key из /etc/andrik-radio.env;
- запустит/restart encoder;
- дождётся ACTIVE сигнала;
- переведёт broadcast в LIVE через YouTube API.

Первый раз сделай пункт 6: 🔐 Авторизация YouTube.
Нужен OAuth Client типа “TVs and Limited Input devices”.
Refresh token хранится только на AWS: /etc/andrik-youtube-device.json (0600).
TXT
