#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/opt/andrik-radio"
SERVICE="andrik-radio.service"

if [ "${EUID}" -ne 0 ]; then
  echo "Запусти так: sudo bash start-andrik-radio-r607.sh"
  exit 1
fi

if [ ! -d "$APP_DIR/.git" ]; then
  echo "Не найден $APP_DIR. Сначала установи радио через install-andrik-radio-lite.sh"
  exit 2
fi

cd "$APP_DIR"
echo "[1/4] Забираю последнюю сборку main..."
git fetch --depth 1 origin main
git reset --hard origin/main

echo "[2/4] Проверяю три визуала..."
for f in \
  "$APP_DIR/radio247/assets/stream-day-r607.mp4" \
  "$APP_DIR/radio247/assets/stream-evening-r607.mp4" \
  "$APP_DIR/radio247/assets/stream-night-r607.mp4"; do
  if [ ! -s "$f" ]; then
    echo "Нет файла: $f"
    exit 3
  fi
done

echo "[3/4] Перезапускаю эфир..."
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 7

echo "[4/4] Статус..."
if systemctl is-active --quiet "$SERVICE"; then
  echo "ЭФИР: ACTIVE"
  curl -fsS --max-time 5 http://127.0.0.1:8080/status || true
  echo
else
  echo "ЭФИР НЕ ЗАПУЩЕН"
  journalctl -u "$SERVICE" -n 100 --no-pager || true
  exit 4
fi

echo
echo "Готово. Логи в реальном времени:"
echo "sudo journalctl -u andrik-radio -f"
