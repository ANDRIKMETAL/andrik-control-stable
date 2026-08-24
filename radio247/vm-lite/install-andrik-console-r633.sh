#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
[ -s "$BASE/install-andrik-console-r632.sh" ] || { echo "Нет R632 installer"; exit 2; }
[ -s "$BASE/youtube-device-console-r633.mjs" ] || { echo "Нет YouTube controller R633"; exit 2; }
[ -s "$BASE/andrik-radio-web-agent-r633.mjs" ] || { echo "Нет web agent R633"; exit 2; }

bash "$BASE/install-andrik-console-r632.sh"
install -m 755 "$BASE/youtube-device-console-r633.mjs" /usr/local/sbin/andrik-youtube
install -m 755 "$BASE/andrik-radio-web-agent-r633.mjs" /usr/local/sbin/andrik-radio-web
install -m 755 "$BASE/andrik-radio-web-agent-r633.mjs" /usr/local/lib/andrik-radio-web-agent-r633.mjs
cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R633
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r633.mjs daemon
Restart=always
RestartSec=4
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now andrik-radio-web-control.service >/dev/null 2>&1 || true
systemctl restart andrik-radio-web-control.service || true
sleep 3

stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO R633 установлен.
• Start больше не ждёт старый created/unknown broadcast.
• Каждый новый запуск без LIVE создаёт свежий broadcast и сразу bind к точному reusable stream key.
• Ожидание active идёт по конкретному streamId, а не по старой записи.
• После active Auto-start запускает LIVE; при необходимости fallback transition идёт по конкретному новому videoId.
• R632 heartbeat сохранён; R631 audio/1080p/TRIKA сохранены.
TXT
/usr/local/sbin/andrik-radio-web status || true
