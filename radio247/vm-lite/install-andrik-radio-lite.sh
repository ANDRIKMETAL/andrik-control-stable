#!/usr/bin/env bash
set -Eeuo pipefail

REPO_URL="https://github.com/ANDRIKMETAL/andrik-control-stable.git"
APP_DIR="/opt/andrik-radio"
ENV_FILE="/etc/andrik-radio.env"
SERVICE_FILE="/etc/systemd/system/andrik-radio.service"
UPDATE_SCRIPT="/usr/local/sbin/andrik-radio-update"
TIMER_FILE="/etc/systemd/system/andrik-radio-update.timer"
UPDATE_SERVICE_FILE="/etc/systemd/system/andrik-radio-update.service"

if [ "${EUID}" -ne 0 ]; then
  echo "Запусти: sudo bash install-andrik-radio-lite.sh"
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Нужна Ubuntu/Debian VM."
  exit 1
fi

echo "[1/7] FFmpeg + Node.js + Git..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends ffmpeg nodejs git ca-certificates curl fonts-dejavu-core

echo "[2/7] ANDRIK Control main..."
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch --depth 1 origin main
  git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  git clone --depth 1 --branch main "$REPO_URL" "$APP_DIR"
fi

SERVER="$APP_DIR/radio247/server.mjs"
DAY_VISUAL="$APP_DIR/radio247/assets/stream-day-r607.mp4"
EVENING_VISUAL="$APP_DIR/radio247/assets/stream-evening-r607.mp4"
NIGHT_VISUAL="$APP_DIR/radio247/assets/stream-night-r607.mp4"

if [ ! -s "$SERVER" ]; then
  echo "Ошибка: нет $SERVER"
  exit 1
fi

for VISUAL in "$DAY_VISUAL" "$EVENING_VISUAL" "$NIGHT_VISUAL"; do
  if [ ! -s "$VISUAL" ]; then
    echo "Ошибка: нет $VISUAL"
    exit 1
  fi
done

echo "[3/7] YouTube Stream Key"
echo "Ключ хранится только на VM в $ENV_FILE"
if [ -z "${YOUTUBE_STREAM_KEY:-}" ]; then
  read -rsp "Вставь YouTube Stream Key и нажми Enter: " YOUTUBE_STREAM_KEY
  echo
fi

YOUTUBE_STREAM_KEY="${YOUTUBE_STREAM_KEY//$'\r'/}"
YOUTUBE_STREAM_KEY="${YOUTUBE_STREAM_KEY//$'\n'/}"

if [ -z "$YOUTUBE_STREAM_KEY" ]; then
  echo "Stream Key пустой."
  exit 2
fi

umask 077
cat > "$ENV_FILE" <<EOF
YOUTUBE_STREAM_KEY=$YOUTUBE_STREAM_KEY
PLAYLIST_URL=https://andrikmetal.com/api/music/downloads
YOUTUBE_LIVE_URL=https://www.youtube.com/live/lZkV9kPpBUQ
DAY_VISUAL=$DAY_VISUAL
EVENING_VISUAL=$EVENING_VISUAL
NIGHT_VISUAL=$NIGHT_VISUAL
VISUAL_TIME_ZONE=Europe/Bratislava
PORT=8080
NODE_ENV=production
RADIO_CACHE_DIR=/tmp/andrik-radio-r607
EOF
chmod 600 "$ENV_FILE"
unset YOUTUBE_STREAM_KEY

echo "[4/7] systemd 24/7..."
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=ANDRIK Metal Radio 24/7 - R607 DAYPART MP3 ONLY
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/radio247
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $SERVER
Restart=always
RestartSec=8
StartLimitIntervalSec=0
KillSignal=SIGTERM
TimeoutStopSec=15
LimitNOFILE=65535
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF

echo "[5/7] Автообновление раз в сутки..."
cat > "$UPDATE_SCRIPT" <<'SH2'
#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR="/opt/andrik-radio"
cd "$APP_DIR"
git fetch --depth 1 origin main
OLD="$(git rev-parse HEAD)"
NEW="$(git rev-parse origin/main)"
if [ "$OLD" != "$NEW" ]; then
  git reset --hard origin/main
  systemctl restart andrik-radio.service
fi
SH2
chmod 755 "$UPDATE_SCRIPT"

cat > "$UPDATE_SERVICE_FILE" <<EOF
[Unit]
Description=Update ANDRIK Radio from GitHub main
After=network-online.target

[Service]
Type=oneshot
ExecStart=$UPDATE_SCRIPT
EOF

cat > "$TIMER_FILE" <<'EOF'
[Unit]
Description=Daily ANDRIK Radio update timer

[Timer]
OnCalendar=*-*-* 04:20:00
Persistent=true
RandomizedDelaySec=600

[Install]
WantedBy=timers.target
EOF

echo "[6/7] Запуск..."
systemctl daemon-reload
systemctl enable --now andrik-radio.service
systemctl enable --now andrik-radio-update.timer
sleep 8

echo "[7/7] Проверка..."
if systemctl is-active --quiet andrik-radio.service; then
  echo "SERVICE: ACTIVE"
else
  echo "SERVICE: НЕ ЗАПУЩЕН"
  journalctl -u andrik-radio.service -n 80 --no-pager || true
  exit 3
fi

curl -fsS --max-time 5 http://127.0.0.1:8080/status || true
echo
echo "============================================================"
echo "ANDRIK RADIO R607-DAYPART-MP3-ONLY установлено."
echo "Видео: 08:00 день / 17:00 вечер / 22:00 ночь · H.264 loop."
echo "Аудио: только MP3 активных альбомов; OCEAN и Illusion of Life выключены; клипы выключены."
echo "Оверлей: текущий трек в жёлтой плашке + бегущая строка; отдельный NEXT убран."
echo "Логи:    sudo journalctl -u andrik-radio -f"
echo "Статус:  sudo systemctl status andrik-radio --no-pager"
echo "Рестарт: sudo systemctl restart andrik-radio"
echo "============================================================"
