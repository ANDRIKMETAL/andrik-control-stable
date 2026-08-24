#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
BASE="/opt/andrik-radio/radio247/vm-lite"
[ -s "$BASE/install-andrik-console-r629.sh" ] || { echo "Нет R629 installer"; exit 2; }
[ -s "$BASE/patch-server-r631.py" ] || { echo "Нет patch-server-r631.py"; exit 2; }
[ -s "$BASE/andrik-radio-web-agent-r631.mjs" ] || { echo "Нет web agent R631"; exit 2; }

# First lay down the proven R629 direct-RTMPS engine.
bash "$BASE/install-andrik-console-r629.sh"
# Then apply the cheaper/stabler audio path.
python3 "$BASE/patch-server-r631.py"
node --check /opt/andrik-radio/radio247/server.mjs >/dev/null

install -m 755 "$BASE/andrik-radio-web-agent-r631.mjs" /usr/local/sbin/andrik-radio-web
install -m 755 "$BASE/andrik-radio-web-agent-r631.mjs" /usr/local/lib/andrik-radio-web-agent-r631.mjs

python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text() if p.exists() else ''
updates={
 'VIDEO_BITRATE':'1000k',
 'AUDIO_BITRATE':'128k',
 'OUTPUT_TIMESHIFT_SECONDS':'6',
 'TIMESTAMP_GUARD_SECONDS':'0',
 'LIVE_TICKER_FILE':'/var/cache/andrik-radio-r622/live-ticker.txt',
 'TRIKA_OFFICIAL_PLAYLIST_URL':'https://music.youtube.com/playlist?list=OLAK5uy_kwBXo5kmbLBvDgSO7Cnd-9BJBezQkV2bo',
}
out=[];seen=set()
for line in s.splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in updates:
            out.append(f'{k}={updates[k]}');seen.add(k);continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PY
chmod 600 /etc/andrik-radio.env 2>/dev/null || true

cat >/etc/systemd/system/andrik-radio-web-control.service <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R631
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=root
ExecStart=/usr/bin/node /usr/local/lib/andrik-radio-web-agent-r631.mjs daemon
Restart=always
RestartSec=5
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now andrik-radio-web-control.service >/dev/null 2>&1 || true
systemctl restart andrik-radio-web-control.service || true

# Do not create/start a new YouTube LIVE from installer. If encoder is already running,
# restart it once so R631 audio becomes active. Otherwise leave it stopped for the web button.
if systemctl is-active --quiet andrik-radio.service; then
  systemctl restart andrik-radio.service
  sleep 8
fi

stty sane 2>/dev/null || true
cat <<'TXT'
ГОТОВО ✅ ANDRIK RADIO R631 установлен.
• 1080p25 · 4.0 Mbps low-load.
• AAC-LC FAST · 48 kHz stereo · 160 kbps.
• async clock repair усилен; FIFO/timeshift = 0.
• Web-agent принудительно включён и сам восстанавливает прежний token, если он есть.
• TRIKA: официальный релиз YouTube Music закреплён как каноническая ссылка.
• Публичный встроенный плеер/ZIP TRIKA на сайте отключён; официальный YouTube Music остаётся.
TXT
/usr/local/sbin/andrik-radio-web status || true
