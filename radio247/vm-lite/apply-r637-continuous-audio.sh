#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo"; exit 1; fi
APP=/opt/andrik-radio
ENV=/etc/andrik-radio.env
SERVICE=/etc/systemd/system/andrik-radio.service
UPDATE=/usr/local/sbin/andrik-radio-update

echo '[1/5] Забираю R637 из GitHub main...'
git -C "$APP" fetch --depth 1 origin main
git -C "$APP" reset --hard origin/main
node --check "$APP/radio247/server.mjs"

echo '[2/5] Ставлю YouTube Console R637...'
install -m 755 "$APP/radio247/vm-lite/youtube-device-console-r637.mjs" /usr/local/sbin/andrik-youtube
/usr/local/sbin/andrik-youtube metadata || true

python3 - "$ENV" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1]); s=p.read_text() if p.exists() else ''
updates={'VIDEO_BITRATE':'4500k','AUDIO_BITRATE':'128k','AUDIO_SAMPLE_RATE':'44100','OUTPUT_TIMESHIFT_SECONDS':'6','TIMESTAMP_GUARD_SECONDS':'0'}
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
PY
chmod 600 "$ENV"

if [ -s "$SERVICE" ]; then
  sed -i 's/^TimeoutStopSec=.*/TimeoutStopSec=25/' "$SERVICE"
fi

cat > "$UPDATE" <<'SH'
#!/usr/bin/env bash
set -Eeuo pipefail
APP=/opt/andrik-radio
cd "$APP"
git fetch --depth 1 origin main
OLD="$(git rev-parse HEAD)"
NEW="$(git rev-parse origin/main)"
if [ "$OLD" != "$NEW" ]; then
  git reset --hard origin/main
  if [ -s "$APP/radio247/vm-lite/youtube-device-console-r637.mjs" ]; then
    install -m 755 "$APP/radio247/vm-lite/youtube-device-console-r637.mjs" /usr/local/sbin/andrik-youtube
/usr/local/sbin/andrik-youtube metadata || true
  fi
  systemctl restart andrik-radio.service
fi
SH
chmod 755 "$UPDATE"

echo '[3/5] Перезапускаю encoder один раз...'
systemctl daemon-reload
systemctl restart andrik-radio.service
sleep 12

echo '[4/5] Проверяю R637...'
STATUS="$(curl -fsS --max-time 8 http://127.0.0.1:8080/status)"
printf '%s\n' "$STATUS"
printf '%s' "$STATUS" | grep -q 'R637-CONTINUOUS-PCM-ONE-AAC-1080P25-NODROP'
printf '%s' "$STATUS" | grep -q '"audioSampleRate":44100'
printf '%s' "$STATUS" | grep -q '"videoBitrate":"4500k"'

echo '[5/5] ГОТОВО ✅ 1080p25 · ONE AAC-LC 44.1k/128k · continuous PCM · no packet drop'
