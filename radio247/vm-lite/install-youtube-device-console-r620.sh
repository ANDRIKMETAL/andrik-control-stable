#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
SRC="/opt/andrik-radio/radio247/vm-lite/youtube-device-console-r620.mjs"
[ -s "$SRC" ] || { echo "Нет $SRC. Сначала обнови /opt/andrik-radio до R620."; exit 2; }
install -m 755 "$SRC" /usr/local/sbin/andrik-youtube
cat <<'EOF'
Готово ✅ Команды:
  sudo andrik-youtube auth
  sudo andrik-youtube status
  sudo andrik-youtube autostart
  sudo andrik-youtube start
  sudo andrik-youtube recover

Для auth нужен отдельный OAuth Client типа "TVs and Limited Input devices".
Client ID/Secret и refresh token сохраняются ТОЛЬКО на AWS: /etc/andrik-youtube-device-r620.json (0600).
EOF
