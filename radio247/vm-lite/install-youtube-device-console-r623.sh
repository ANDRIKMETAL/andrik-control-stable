#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
SRC="/opt/andrik-radio/radio247/vm-lite/youtube-device-console-r623.mjs"
[ -s "$SRC" ] || { echo "Нет $SRC. Сначала обнови /opt/andrik-radio до R623."; exit 2; }
install -m 755 "$SRC" /usr/local/sbin/andrik-youtube
cat <<'TXT'
Готово ✅ ANDRIK YouTube Console R623

Первичная авторизация:
  sudo andrik-youtube auth

После авторизации:
  sudo andrik-youtube status
  sudo andrik-youtube auto-safe
  sudo andrik-youtube start
  sudo andrik-youtube recover

ВАЖНО: для auth нужен отдельный OAuth Client типа
“TVs and Limited Input devices”. Обычный Web client не подходит.
Refresh token хранится только на AWS в /etc/andrik-youtube-device.json (0600).
TXT
