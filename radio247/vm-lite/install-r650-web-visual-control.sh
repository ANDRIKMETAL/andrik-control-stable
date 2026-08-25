#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SRC="$BASE/radio247/vm-lite/andrik-radio-web-agent-r650.mjs"
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
LOCK_FILE="$VISUAL_DIR/.protect-local-visuals-r656"
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SRC" ] || { echo "СТОП: нет $SRC"; exit 2; }
node --check "$SRC" >/dev/null
node --check "$BASE/radio247/server.mjs" >/dev/null
mkdir -p "$VISUAL_DIR"
printf 'R656 local DAY EVENING NIGHT protection\n' > "$LOCK_FILE"
chmod 600 "$LOCK_FILE"
systemctl stop andrik-radio-web-control.service >/dev/null 2>&1 || true
install -m 755 "$SRC" /usr/local/sbin/andrik-radio-web
install -m 755 "$SRC" /usr/local/lib/andrik-radio-web-agent-r650.mjs
cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R656
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r650.mjs daemon
Restart=always
RestartSec=4
[Install]
WantedBy=multi-user.target
UNIT
# R656: never bootstrap/download visual masters during install.
systemctl daemon-reload
systemctl enable andrik-radio-web-control.service >/dev/null 2>&1 || true
systemctl restart andrik-radio-web-control.service
sleep 3
systemctl is-active andrik-radio-web-control.service
echo 'ГОТОВО ✅ R656 agent установлен. Локальные видео защищены; R2 bootstrap не запускался.'
