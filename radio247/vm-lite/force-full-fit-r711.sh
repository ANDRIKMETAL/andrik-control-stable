#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
SERVER=/opt/andrik-radio/radio247/server.mjs
SERVICE=andrik-radio.service
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$SERVER.bak-r711-fullfit-$TS"
cp -a "$SERVER" "$BACKUP"
python3 - <<'PYFULLFIT'
from pathlib import Path
p=Path('/opt/andrik-radio/radio247/server.mjs')
s=p.read_text()
old=s
s=s.replace("const insetCrop=await detectInsetBlackFrameCrop(clipPath).catch(()=> '');","const insetCrop=''; // NO CROP — FULL FRAME FIT")
s=s.replace('force_original_aspect_ratio=increase','force_original_aspect_ratio=decrease')
s=s.replace(',crop=1920:1080:(iw-1920)/2:(ih-1080)/2','')
s=s.replace(',crop=1920:1080','')
p.write_text(s)
print('FULLFIT_CHANGED=1' if s != old else 'FULLFIT_CHANGED=0 (уже NO CROP / FIT)')
PYFULLFIT
if ! node --check "$SERVER" >/dev/null 2>&1; then
  cp -a "$BACKUP" "$SERVER"
  echo 'СТОП: проверка server.mjs не прошла — автоматически вернул резервную копию.'
  exit 3
fi
systemctl restart "$SERVICE"
sleep 3
systemctl is-active "$SERVICE"
curl -fsS http://127.0.0.1:8080/status
