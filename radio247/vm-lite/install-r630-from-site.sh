#!/usr/bin/env bash
set -euo pipefail
BASE_URL="${ANDRIK_SITE_BASE_URL:-https://andrikmetal.com/radio247}"
DEST="/opt/andrik-radio/radio247"
mkdir -p "$DEST/vm-lite"
fetch(){ curl -fsSL "$BASE_URL/$1?v=630-$(date +%s)" -o "$2"; }
echo "ANDRIK R630: сайт + карта городов / R629 stable encoder"
fetch "server.mjs" "$DEST/server.mjs"
fetch "vm-lite/andrik-radio-console-r629.sh" "$DEST/vm-lite/andrik-radio-console-r629.sh"
fetch "vm-lite/andrik-radio-web-agent-r629.mjs" "$DEST/vm-lite/andrik-radio-web-agent-r629.mjs"
fetch "vm-lite/patch-server-r629.py" "$DEST/vm-lite/patch-server-r629.py"
fetch "vm-lite/install-andrik-console-r629.sh" "$DEST/vm-lite/install-andrik-console-r629.sh"
chmod 755 "$DEST/vm-lite/andrik-radio-console-r629.sh" "$DEST/vm-lite/andrik-radio-web-agent-r629.mjs" "$DEST/vm-lite/patch-server-r629.py" "$DEST/vm-lite/install-andrik-console-r629.sh"
node --check "$DEST/server.mjs"
python3 -m py_compile "$DEST/vm-lite/patch-server-r629.py"
bash -n "$DEST/vm-lite/install-andrik-console-r629.sh"
exec bash "$DEST/vm-lite/install-andrik-console-r629.sh"
