#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
[ -s "$BASE/youtube-device-console-r626.mjs" ] || { echo "Нет youtube-device-console-r626.mjs"; exit 2; }
[ -s "$BASE/andrik-radio-console-r629.sh" ] || { echo "Нет andrik-radio-console-r629.sh"; exit 2; }
[ -s "$BASE/andrik-radio-web-agent-r629.mjs" ] || { echo "Нет andrik-radio-web-agent-r629.mjs"; exit 2; }
[ -s "/opt/andrik-radio/radio247/server.mjs" ] || { echo "Нет radio247/server.mjs"; exit 2; }

[ -s "$BASE/patch-server-r629.py" ] || { echo "Нет patch-server-r629.py"; exit 2; }
python3 "$BASE/patch-server-r629.py"
node --check /opt/andrik-radio/radio247/server.mjs >/dev/null

install -m 755 "$BASE/youtube-device-console-r626.mjs" /usr/local/sbin/andrik-youtube
install -m 755 "$BASE/andrik-radio-console-r629.sh" /usr/local/sbin/andrik-radio
install -m 755 "$BASE/andrik-radio-web-agent-r629.mjs" /usr/local/sbin/andrik-radio-web
install -m 755 "$BASE/andrik-radio-web-agent-r629.mjs" /usr/local/lib/andrik-radio-web-agent-r629.mjs

# R629: preserve 1080p25 but cut encoder/network pressure and stop FIFO packet loss/repeat artifacts.
ENV_FILE="/etc/andrik-radio.env"
python3 - <<'PYE'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text() if p.exists() else ''
updates={
    'VIDEO_BITRATE':'4500k',
    'AUDIO_BITRATE':'192k',
    'OUTPUT_TIMESHIFT_SECONDS':'0',
    'TIMESTAMP_GUARD_SECONDS':'0.02',
    'LIVE_TICKER_FILE':'/var/cache/andrik-radio-r622/live-ticker.txt',
}
out=[]
seen=set()
for line in s.splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in updates:
            out.append(f'{k}={updates[k]}')
            seen.add(k)
            continue
    out.append(line)
for k,v in updates.items():
    if k not in seen:
        out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PYE
chmod 600 "$ENV_FILE" 2>/dev/null || true
mkdir -p /var/cache/andrik-radio-r622
if [ ! -f /var/cache/andrik-radio-r622/live-ticker.txt ]; then
  printf '%s' 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ' >/var/cache/andrik-radio-r622/live-ticker.txt
fi

cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R629
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r629.mjs daemon
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
# Existing R627 web-control token is reused. No new one-time pairing.
if [ -s /etc/andrik-radio-web-r627.json ]; then
  systemctl enable --now andrik-radio-web-control.service >/dev/null 2>&1 || true
  systemctl restart andrik-radio-web-control.service
fi

# Do not auto-start a YouTube LIVE here. If radio is currently running, restart only the encoder
# so the new low-load/audio pipeline becomes active; otherwise leave it stopped for the web Start button.
if systemctl is-active --quiet andrik-radio.service; then
  systemctl restart andrik-radio.service
  sleep 10
fi

stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO R629 установлен.

• WEB-панель остаётся привязанной — повторная одноразовая привязка не нужна.
• 1080p25 сохранено, encoder low-load: ultrafast / 4.5 Mbps.
• AAC-LC 48 kHz stereo 192 kbps; publisher идёт напрямую в RTMPS — FIFO/timeshift убраны полностью.
• Живая строка меняется с сайта без рестарта эфира.
• «Сейчас играет» из бегущей строки убрано.
• Чёрные полосы и жёлтая плашка убраны; остаётся жёлтый текст с чёрной обводкой.
• QR сдвинут левее.

Панель: https://andrikmetal.com/radio-control-admin.html
TXT
