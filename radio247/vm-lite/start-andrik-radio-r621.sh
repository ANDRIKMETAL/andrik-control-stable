#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/andrik-radio"
SERVICE="andrik-radio.service"
DAY_URL="https://andrikmetal.com/api/media/radio-visual-r621?slot=day&download=1"
EVENING_URL="https://andrikmetal.com/api/media/radio-visual-r621?slot=evening&download=1"
NIGHT_URL="https://andrikmetal.com/api/media/radio-visual-r621?slot=night&download=1"

if [ "${EUID}" -ne 0 ]; then
  echo "Запусти: sudo bash start-andrik-radio-r621.sh"
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Не найден $APP_DIR. Сначала установи радио."
  exit 2
fi

echo "[1/5] Проверяю публичный read-only R621 proxy для 3 master-видео..."
for url in "$DAY_URL" "$EVENING_URL" "$NIGHT_URL"; do
  echo "  $url"
  if ! curl -fsSI --max-time 20 -o /dev/null "$url"; then
    echo "СТОП: visual ещё не загружен в R2. Работающий эфир не трогаю."
    exit 3
  fi
done

echo "[2/5] Забираю R621 из GitHub main..."
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

echo "[3/5] Обновляю безопасные параметры R621 в /etc/andrik-radio.env..."
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
'DAY_VISUAL_URL':'https://andrikmetal.com/api/media/radio-visual-r621?slot=day&download=1',
'EVENING_VISUAL_URL':'https://andrikmetal.com/api/media/radio-visual-r621?slot=evening&download=1',
'NIGHT_VISUAL_URL':'https://andrikmetal.com/api/media/radio-visual-r621?slot=night&download=1',
'VIDEO_BITRATE':'8000k',
'AUDIO_BITRATE':'192k',
'RADIO_CACHE_DIR':'/var/cache/andrik-radio-r621',
'VISUAL_TIME_ZONE':'Europe/Bratislava',
'OUTPUT_TIMESHIFT_SECONDS':'6',
'TIMESTAMP_GUARD_SECONDS':'0.06'
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
mkdir -p /var/cache/andrik-radio-r621

# Ensure the current unit can write persistent visual/audio cache even if it was installed by an older build.
if grep -q '^ReadWritePaths=' /etc/systemd/system/andrik-radio.service; then
  sed -i 's#^ReadWritePaths=.*#ReadWritePaths=/tmp /var/cache/andrik-radio-r621#' /etc/systemd/system/andrik-radio.service
else
  sed -i '/^ProtectHome=true/a ReadWritePaths=/tmp /var/cache/andrik-radio-r621' /etc/systemd/system/andrik-radio.service
fi

echo "[4/5] Перезапускаю радио..."
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 12

echo "[5/5] Проверка..."
if systemctl is-active --quiet "$SERVICE"; then
  curl -fsS --max-time 8 http://127.0.0.1:8080/status || true
  echo
  echo "ГОТОВО ✅ R621 public R2 proxy · 1080p25 · AAC 192k · PTS rebuild"
else
  echo "ЭФИР НЕ ЗАПУЩЕН"
  journalctl -u "$SERVICE" -n 100 --no-pager || true
  exit 6
fi
