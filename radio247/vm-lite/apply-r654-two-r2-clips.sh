#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/andrik-radio"
SERVER="$ROOT/radio247/server.mjs"
[ -f "$SERVER" ] || { echo "R654: server.mjs not found" >&2; exit 1; }
node --check "$SERVER"
grep -q "R654-R653-PUSH-R649-FULLSCREEN-TWO-R2-CLIPS-CONTINUOUS-AUDIO" "$SERVER" || { echo "R654: updated server.mjs is not installed" >&2; exit 1; }
sudo systemctl restart andrik-radio.service
sleep 5
curl -fsS http://127.0.0.1:8080/status || true
echo
echo "R654: two R2 clips enabled between songs."
