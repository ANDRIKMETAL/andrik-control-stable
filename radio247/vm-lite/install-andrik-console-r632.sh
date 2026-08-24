#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
[ -s "$BASE/install-andrik-console-r631.sh" ] || { echo "Нет R631 installer"; exit 2; }
[ -s "$BASE/youtube-device-console-r632.mjs" ] || { echo "Нет YouTube controller R632"; exit 2; }
[ -s "$BASE/andrik-radio-web-agent-r632.mjs" ] || { echo "Нет web agent R632"; exit 2; }

# Keep the complete R631 audio/1080p/TRIKA configuration.
bash "$BASE/install-andrik-console-r631.sh"

# Replace only the two pieces that caused the start failure:
# 1) stale/unbound YouTube broadcast selection; 2) blocking web heartbeat.
install -m 755 "$BASE/youtube-device-console-r632.mjs" /usr/local/sbin/andrik-youtube
install -m 755 "$BASE/andrik-radio-web-agent-r632.mjs" /usr/local/sbin/andrik-radio-web
install -m 755 "$BASE/andrik-radio-web-agent-r632.mjs" /usr/local/lib/andrik-radio-web-agent-r632.mjs

cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R632
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r632.mjs daemon
Restart=always
RestartSec=4
[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now andrik-radio-web-control.service >/dev/null 2>&1 || true
systemctl restart andrik-radio-web-control.service
sleep 3

stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO R632 установлен.
• AWS heartbeat больше не пропадает во время запуска/восстановления.
• Старый unbound broadcast больше не перехватывает запуск.
• Если binding потерян — R632 сам привязывает broadcast к текущему ANDRIK stream key.
• R631 audio сохранён: AAC-LC FAST 160k / 48 kHz stereo / async repair.
• 1080p25 · 4.0 Mbps · direct RTMPS · FIFO 0.
• TRIKA: публично ведём на официальный YouTube Music релиз.
TXT
/usr/local/sbin/andrik-radio-web status || true
