#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="/opt/andrik-radio"
SERVICE="andrik-radio.service"
ENV_FILE="/etc/andrik-radio.env"
CACHE_DIR="/var/cache/andrik-radio-r622"
VIS_DIR="$CACHE_DIR/visuals"
STAGE_DIR="/var/cache/andrik-radio-r622-stage"
BASE_URL="https://andrikmetal.com/api/control/radio-visuals-r620/file"

if [ "${EUID}" -ne 0 ]; then echo "Запусти через sudo."; exit 1; fi
if [ ! -d "$APP_DIR/.git" ] || [ ! -s "$APP_DIR/radio247/server.mjs" ]; then echo "СТОП: не найден ANDRIK Radio"; exit 2; fi
if [ ! -s "$ENV_FILE" ]; then echo "СТОП: нет $ENV_FILE"; exit 2; fi
if ! command -v ffprobe >/dev/null 2>&1; then echo "СТОП: ffprobe не найден"; exit 2; fi

ADMIN_KEY_VALUE="${ADMIN_KEY:-}"
if [ -z "$ADMIN_KEY_VALUE" ]; then
  read -rsp "ADMIN_KEY (тот же, что на сайте; не сохраняется): " ADMIN_KEY_VALUE
  echo
fi
if [ -z "$ADMIN_KEY_VALUE" ]; then echo "СТОП: ADMIN_KEY пустой. Эфир не трогаю."; exit 3; fi

mkdir -p "$VIS_DIR" "$STAGE_DIR"
chmod 700 "$CACHE_DIR" "$VIS_DIR" "$STAGE_DIR" 2>/dev/null || true

fetch_master(){
  local slot="$1"
  local name="$2"
  local tmp="$STAGE_DIR/$name.part"
  local final="$STAGE_DIR/$name"
  rm -f "$tmp" "$final"
  echo "  ↓ $slot"
  local code size probe
  code="$(curl -sS -L --retry 3 --retry-delay 1 --retry-all-errors --connect-timeout 15 --max-time 300 -H "x-admin-key: $ADMIN_KEY_VALUE" -H "user-agent: ANDRIK-Radio-AWS-R622" -o "$tmp" -w '%{http_code}' "$BASE_URL?slot=$slot" || true)"
  if [ "$code" != "200" ]; then echo "СТОП: $slot HTTP $code. Работающий эфир не трогаю."; rm -f "$tmp"; exit 4; fi
  size="$(stat -c%s "$tmp" 2>/dev/null || echo 0)"
  if [ "$size" -lt 2000000 ]; then echo "СТОП: $slot слишком маленький ($size bytes). Эфир не трогаю."; rm -f "$tmp"; exit 4; fi
  probe="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,avg_frame_rate -of csv=p=0 "$tmp" 2>/dev/null || true)"
  if [ -z "$probe" ]; then echo "СТОП: $slot не проходит ffprobe. Эфир не трогаю."; rm -f "$tmp"; exit 4; fi
  echo "    OK $((size/1024/1024)) MB · $probe"
  mv -f "$tmp" "$final"
}

echo "[1/5] Скачиваю 3 master-видео из PRIVATE R2 через ADMIN_KEY..."
fetch_master day stream-day-master-r620.mp4
fetch_master evening stream-evening-master-r620.mp4
fetch_master night stream-night-master-r620.mp4

echo "[2/5] Все 3 проверены. Переношу в постоянный AWS cache..."
install -m 600 "$STAGE_DIR/stream-day-master-r620.mp4" "$VIS_DIR/stream-day-master-r620.mp4"
install -m 600 "$STAGE_DIR/stream-evening-master-r620.mp4" "$VIS_DIR/stream-evening-master-r620.mp4"
install -m 600 "$STAGE_DIR/stream-night-master-r620.mp4" "$VIS_DIR/stream-night-master-r620.mp4"

echo "[3/5] Настраиваю R622: 1080p25 + AAC-LC 192k + локальные masters..."
python3 - <<'PYE'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text()
base='/var/cache/andrik-radio-r622/visuals'
updates={
'DAY_VISUAL':f'{base}/stream-day-master-r620.mp4',
'EVENING_VISUAL':f'{base}/stream-evening-master-r620.mp4',
'NIGHT_VISUAL':f'{base}/stream-night-master-r620.mp4',
'DAY_VISUAL_URL':f'{base}/stream-day-master-r620.mp4',
'EVENING_VISUAL_URL':f'{base}/stream-evening-master-r620.mp4',
'NIGHT_VISUAL_URL':f'{base}/stream-night-master-r620.mp4',
'VIDEO_BITRATE':'1000k','AUDIO_BITRATE':'128k','RADIO_CACHE_DIR':'/var/cache/andrik-radio-r622',
'VISUAL_TIME_ZONE':'Europe/Bratislava','OUTPUT_TIMESHIFT_SECONDS':'6','TIMESTAMP_GUARD_SECONDS':'0'}
lines=s.splitlines(); out=[]; seen=set()
for line in lines:
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in updates: out.append(f'{k}={updates[k]}'); seen.add(k); continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PYE
chmod 600 "$ENV_FILE"

if grep -q '^ReadWritePaths=' /etc/systemd/system/andrik-radio.service; then
  sed -i 's#^ReadWritePaths=.*#ReadWritePaths=/tmp /var/cache/andrik-radio-r622#' /etc/systemd/system/andrik-radio.service
else
  sed -i '/^ProtectHome=true/a ReadWritePaths=/tmp /var/cache/andrik-radio-r622' /etc/systemd/system/andrik-radio.service
fi

echo "[4/5] Перезапускаю радио только теперь, когда masters уже локально..."
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 15

echo "[5/5] Проверка..."
if systemctl is-active --quiet "$SERVICE"; then
  curl -fsS --max-time 8 http://127.0.0.1:8080/status || true
  echo
  echo "ГОТОВО ✅ R622 · PRIVATE R2 -> LOCAL AWS · 1080p25 · AAC 192k · PTS rebuild"
else
  echo "ЭФИР НЕ ЗАПУЩЕН"
  journalctl -u "$SERVICE" -n 120 --no-pager || true
  exit 6
fi
