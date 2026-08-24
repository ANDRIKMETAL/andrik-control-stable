#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
APP=/opt/andrik-radio
SRC="$APP/radio247/vm-lite/youtube-device-console-r637.mjs"
SERVICE=/etc/systemd/system/andrik-radio.service
[ -s "$SRC" ] || { echo "Нет $SRC"; exit 2; }
install -m 755 "$SRC" /usr/local/sbin/andrik-youtube
if [ -s "$SERVICE" ]; then
  sed -i 's/^TimeoutStopSec=.*/TimeoutStopSec=25/' "$SERVICE"
fi
systemctl daemon-reload
echo 'ГОТОВО ✅ YouTube Console R637: 🔴 title + Female Vocals + полное описание + graceful end.'
