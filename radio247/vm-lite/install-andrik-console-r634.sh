#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
[ -s "$BASE/install-andrik-console-r633.sh" ] || { echo "Нет R633 installer"; exit 2; }
[ -s "$BASE/youtube-device-console-r634.mjs" ] || { echo "Нет YouTube controller R634"; exit 2; }
[ -s "$BASE/andrik-radio-web-agent-r634.mjs" ] || { echo "Нет web agent R634"; exit 2; }

# Preserve all R633/R631 audio, visuals, TRIKA and web-control configuration.
bash "$BASE/install-andrik-console-r633.sh"

# Kill the old stuck start worker first. It can be blocked inside `systemctl stop`.
systemctl stop andrik-radio-web-control.service >/dev/null 2>&1 || true
systemctl stop --no-block andrik-radio.service >/dev/null 2>&1 || true
sleep 2
STATE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"
if [ "$STATE" = "deactivating" ] || [ "$STATE" = "active" ] || [ "$STATE" = "activating" ]; then
  systemctl kill --kill-who=all --signal=SIGKILL andrik-radio.service >/dev/null 2>&1 || true
  sleep 1
fi
systemctl reset-failed andrik-radio.service >/dev/null 2>&1 || true

install -m 755 "$BASE/youtube-device-console-r634.mjs" /usr/local/sbin/andrik-youtube
install -m 755 "$BASE/andrik-radio-web-agent-r634.mjs" /usr/local/sbin/andrik-radio-web
install -m 755 "$BASE/andrik-radio-web-agent-r634.mjs" /usr/local/lib/andrik-radio-web-agent-r634.mjs

cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R634
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r634.mjs daemon
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
ГОТОВО ✅ ANDRIK RADIO R634 установлен.
• Исправлено зависание systemd в deactivating.
• Start больше не блокируется на `systemctl stop`.
• Если обычный stop не завершился за ~8 секунд, encoder завершается внутри своего systemd-cgroup и состояние очищается.
• После этого создаётся новый broadcast, bind к точному reusable stream key и запускается encoder.
• Heartbeat панели остаётся живым во время всей команды.
• R631 audio сохранён: AAC-LC FAST 160k / 48 kHz stereo; 1080p25 · 4 Mbps · direct RTMPS · FIFO 0.
TXT
/usr/local/sbin/andrik-radio-web status || true
