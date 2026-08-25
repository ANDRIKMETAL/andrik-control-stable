#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SRC="$BASE/radio247/vm-lite/andrik-radio-web-agent-r650.mjs"
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SRC" ] || { echo "СТОП: нет $SRC — сначала обнови GitHub до R650"; exit 2; }
node --check "$SRC" >/dev/null
node --check "$BASE/radio247/server.mjs" >/dev/null
systemctl stop andrik-radio-web-control.service >/dev/null 2>&1 || true
install -m 755 "$SRC" /usr/local/sbin/andrik-radio-web
install -m 755 "$SRC" /usr/local/lib/andrik-radio-web-agent-r650.mjs
cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R650
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
echo '[R650] Скачиваю 3 master-видео из R2 через paired agent token…'
/usr/local/sbin/andrik-radio-web bootstrap-visuals
systemctl daemon-reload
systemctl enable andrik-radio-web-control.service >/dev/null 2>&1 || true
systemctl restart andrik-radio-web-control.service
sleep 4
systemctl is-active andrik-radio-web-control.service
echo 'ГОТОВО ✅ R650 установлен: 3 R2-видео синхронизированы, FULL 16:9 включён, ADMIN_KEY в AWS больше не нужен.'
