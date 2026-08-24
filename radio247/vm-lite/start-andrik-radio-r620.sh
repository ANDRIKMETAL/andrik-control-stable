#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/andrik-radio"
SERVICE="andrik-radio.service"
DAY_URL="https://music.andrikmetal.com/radio/stream-day-master-r620.mp4"
EVENING_URL="https://music.andrikmetal.com/radio/stream-evening-master-r620.mp4"
NIGHT_URL="https://music.andrikmetal.com/radio/stream-night-master-r620.mp4"

if [ "${EUID}" -ne 0 ]; then
  echo "Запусти: sudo bash start-andrik-radio-r620.sh"
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Не найден $APP_DIR. Сначала установи радио."
  exit 2
fi

echo "[1/5] Проверяю 3 master-видео в R2 ДО обновления..."
for url in "$DAY_URL" "$EVENING_URL" "$NIGHT_URL"; do
  echo "  $url"
  if ! curl -fsSL --range 0-0 --max-time 20 -o /dev/null "$url"; then
    echo "СТОП: visual ещё не загружен в R2. Работающий эфир не трогаю."
    exit 3
  fi
done

echo "[2/5] Забираю R620 из GitHub main..."
cd "$APP_DIR"
git fetch --depth 1 origin main
git reset --hard origin/main

if [ ! -s "$APP_DIR/radio247/server.mjs" ]; then
  echo "Нет server.mjs после обновления. Эфир не перезапускаю."
  exit 4
fi
if [ ! -s "$APP_DIR/assets/andrik-qr-r612.png" ]; then
  echo "Нет QR overlay. Эфир не перезапускаю."
  exit 4
fi

echo "[3/5] Обновляю безопасные параметры R620 в /etc/andrik-radio.env..."
ENV_FILE=/etc/andrik-radio.env
if [ ! -s "$ENV_FILE" ]; then
  echo "Нет $ENV_FILE — сначала install-andrik-radio-lite.sh"
  exit 5
fi
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
updates={
'DAY_VISUAL_URL':'https://music.andrikmetal.com/radio/stream-day-master-r620.mp4',
'EVENING_VISUAL_URL':'https://music.andrikmetal.com/radio/stream-evening-master-r620.mp4',
'NIGHT_VISUAL_URL':'https://music.andrikmetal.com/radio/stream-night-master-r620.mp4',
'VIDEO_BITRATE':'1000k',
'AUDIO_BITRATE':'128k',
'RADIO_CACHE_DIR':'/var/cache/andrik-radio-r620',
'VISUAL_TIME_ZONE':'Europe/Bratislava',
'OUTPUT_TIMESHIFT_SECONDS':'6',
'TIMESTAMP_GUARD_SECONDS':'0'
}
lines=s.splitlines()
out=[]; seen=set()
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in updates:
            out.append(f'{k}={updates[k]}'); seen.add(k); continue
        if k in {'DAY_VISUAL','EVENING_VISUAL','NIGHT_VISUAL'}:
            continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PY
chmod 600 "$ENV_FILE"
mkdir -p /var/cache/andrik-radio-r620

# Ensure the current unit can write persistent visual/audio cache even if it was installed by an older build.
if grep -q '^ReadWritePaths=' /etc/systemd/system/andrik-radio.service; then
  sed -i 's#^ReadWritePaths=.*#ReadWritePaths=/tmp /var/cache/andrik-radio-r620#' /etc/systemd/system/andrik-radio.service
else
  sed -i '/^ProtectHome=true/a ReadWritePaths=/tmp /var/cache/andrik-radio-r620' /etc/systemd/system/andrik-radio.service
fi

echo "[4/5] Перезапускаю радио..."
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 12

echo "[5/5] Проверка..."
if systemctl is-active --quiet "$SERVICE"; then
  curl -fsS --max-time 8 http://127.0.0.1:8080/status || true
  echo
  echo "ГОТОВО ✅ R2 masters · 1080p25 · AAC 192k · PTS rebuild"
else
  echo "ЭФИР НЕ ЗАПУЩЕН"
  journalctl -u "$SERVICE" -n 100 --no-pager || true
  exit 6
fi
