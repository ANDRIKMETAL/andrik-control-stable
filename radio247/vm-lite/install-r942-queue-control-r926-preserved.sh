#!/usr/bin/env bash
set -euo pipefail
echo "❌ R942 legacy installer BLOCKED: it replaced server.mjs and could overwrite R936F fullscreen/A-V settings."
echo "✅ Use the safe R943 surgical installer instead:"
echo 'curl -fsSL "https://andrikmetal.com/radio247/vm-lite/install-r943-queue-control-r936f-surgical.sh?v=$(date +%s)" | sudo bash'
exit 64
