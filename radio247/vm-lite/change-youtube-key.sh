#!/usr/bin/env bash
set -Eeuo pipefail
if [ "${EUID}" -ne 0 ]; then
  echo "Запусти: sudo bash change-youtube-key.sh"
  exit 1
fi
ENV_FILE="/etc/andrik-radio.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "Сначала установи ANDRIK Radio."
  exit 1
fi
read -rsp "Новый YouTube Stream Key: " KEY
echo
KEY="${KEY//$'\r'/}"
KEY="${KEY//$'\n'/}"
if [ -z "$KEY" ]; then
  echo "Ключ пустой — ничего не изменено."
  exit 2
fi
TMP="$(mktemp)"
grep -v '^YOUTUBE_STREAM_KEY=' "$ENV_FILE" > "$TMP"
printf 'YOUTUBE_STREAM_KEY=%s\n' "$KEY" >> "$TMP"
install -m 600 "$TMP" "$ENV_FILE"
rm -f "$TMP"
unset KEY
systemctl restart andrik-radio.service
echo "Ключ заменён, радио перезапущено."
