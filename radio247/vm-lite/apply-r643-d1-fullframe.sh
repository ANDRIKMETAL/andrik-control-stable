#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSETS="$BASE/radio247/assets"
R613="1da635acc87cd7a872056cef8f4f23cd53472935"
RAW="https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/$R613/radio247/assets"

echo '[1/5] Проверяю R643...'
grep -q 'R643-D1-FINAL-R607-FULLFRAME-1080P-CONTINUOUS-AUDIO' "$SERVER"
node --check "$SERVER" >/dev/null

echo '[2/5] Возвращаю точные полноэкранные R607 из рабочего R613...'
sudo install -d -m 755 "$ASSETS"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
for f in stream-day-r607.mp4 stream-evening-r607.mp4 stream-night-r607.mp4; do
  curl -fL --retry 6 --retry-delay 2 --connect-timeout 12 "$RAW/$f" -o "$TMP/$f"
  test -s "$TMP/$f"
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0:s=x "$TMP/$f"
  sudo install -m 644 "$TMP/$f" "$ASSETS/$f"
done

echo '[3/5] R607 установлены. R620 visual env игнорируются самим R643.'
echo '[4/5] Один restart радио...'
sudo systemctl restart andrik-radio.service
sleep 8

echo '[5/5] Статус:'
curl -fsS http://127.0.0.1:8080/status | python3 -m json.tool
