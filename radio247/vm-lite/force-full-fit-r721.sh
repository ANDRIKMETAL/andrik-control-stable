#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
SERVER=/opt/andrik-radio/radio247/server.mjs
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
grep -q 'R721-PERSISTENT-LIVE-NOCROP-RED-TITLE-SEAMLESS-EQ' "$SERVER" || {
  echo 'СТОП: на OVH не установлен R721. Сначала установи R721.'
  exit 3
}
# No rewrite and NO service restart. R721 reloads only the local H264 feeder while the
# same RTMPS publisher remains connected to YouTube.
RESP="$(curl -fsS --max-time 12 -X POST http://127.0.0.1:8080/control/full-fit)"
printf '%s\n' "$RESP" | python3 -m json.tool 2>/dev/null || printf '%s\n' "$RESP"
printf '\n✅ R721 TRUE FULL FRAME FIT / NO CROP перезагружен БЕЗ разрыва LIVE.\n'
