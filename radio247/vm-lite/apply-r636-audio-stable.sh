#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти: sudo bash apply-r636-audio-stable.sh"; exit 1; fi
echo "[1/4] Забираю R636 из GitHub main..."
/usr/local/sbin/andrik-radio-update
echo "[2/4] Фиксирую стабильные параметры R613 в env..."
python3 - <<'PYE'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
updates={'VIDEO_BITRATE':'1000k','AUDIO_BITRATE':'128k','OUTPUT_TIMESHIFT_SECONDS':'6','TIMESTAMP_GUARD_SECONDS':'0'}
out=[]; seen=set()
for line in s.splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in updates:
            out.append(f'{k}={updates[k]}'); seen.add(k); continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PYE
chmod 600 /etc/andrik-radio.env
echo "[3/4] Перезапускаю encoder..."
systemctl restart andrik-radio.service
sleep 10
echo "[4/4] Статус:"
curl -fsS --max-time 8 http://127.0.0.1:8080/status || true
echo
echo "ГОТОВО ✅ R636 · R613 stable core · 480p24 · FIFO 6s · AAC 128k"
