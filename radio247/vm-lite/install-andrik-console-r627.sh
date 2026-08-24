#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
# Keep the proven R626 YouTube controller, update the human console label/installer,
# and add the outbound-only web remote agent. No inbound EC2 port is opened.
[ -s "$BASE/youtube-device-console-r626.mjs" ] || { echo "Нет youtube-device-console-r626.mjs"; exit 2; }
[ -s "$BASE/andrik-radio-console-r627.sh" ] || { echo "Нет andrik-radio-console-r627.sh"; exit 2; }
[ -s "$BASE/andrik-radio-web-agent-r627.mjs" ] || { echo "Нет andrik-radio-web-agent-r627.mjs"; exit 2; }
install -m 755 "$BASE/youtube-device-console-r626.mjs" /usr/local/sbin/andrik-youtube
install -m 755 "$BASE/andrik-radio-console-r627.sh" /usr/local/sbin/andrik-radio
install -m 755 "$BASE/andrik-radio-web-agent-r627.mjs" /usr/local/sbin/andrik-radio-web
install -m 755 "$BASE/andrik-radio-web-agent-r627.mjs" /usr/local/lib/andrik-radio-web-agent-r627.mjs
cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R627
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r627.mjs daemon
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
if [ -s /etc/andrik-radio-web-r627.json ]; then systemctl enable --now andrik-radio-web-control.service; fi
stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO WEB CONTROL R627 установлен.

Один раз привязать сайт к AWS:
1) открой https://andrikmetal.com/radio-control-admin.html
2) нажми «Создать код подключения AWS»
3) введи здесь: sudo andrik-radio-web pair КОРОТКИЙ_КОД

После этого AWS-консоль для обычного запуска/остановки больше не нужна.
TXT
