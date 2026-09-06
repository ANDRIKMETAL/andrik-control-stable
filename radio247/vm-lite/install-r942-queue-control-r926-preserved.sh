#!/usr/bin/env bash
set -euo pipefail
BASE="https://andrikmetal.com/radio247"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT="/opt/andrik-radio/vm-lite/andrik-radio-web-agent-r803.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BK="/opt/andrik-radio/backups/R942-QUEUE-$STAMP"
mkdir -p "$BK"
cp -a "$LIVE" "$BK/server.mjs"
cp -a "$AGENT" "$BK/andrik-radio-web-agent-r803.mjs"
curl -fsSL "$BASE/server.mjs?v=R942-$STAMP" -o "$LIVE.r942.tmp"
curl -fsSL "$BASE/vm-lite/andrik-radio-web-agent-r803.mjs?v=R942-$STAMP" -o "$AGENT.r942.tmp"
node --check "$LIVE.r942.tmp"
node --check "$AGENT.r942.tmp"
grep -Fq 'upcomingQueueR942' "$LIVE.r942.tmp"
grep -Fq "AGENT_VERSION_R803='R942'" "$AGENT.r942.tmp"
install -m 0644 "$LIVE.r942.tmp" "$LIVE"
install -m 0644 "$AGENT.r942.tmp" "$AGENT"
rm -f "$LIVE.r942.tmp" "$AGENT.r942.tmp"
systemctl restart andrik-radio-web-agent.service 2>/dev/null || systemctl restart andrik-radio-web-agent-r803.service 2>/dev/null || true
# The local /control/queue-move endpoint lives inside the radio process and requires one reload.
systemctl restart andrik-radio.service
sleep 8
curl -fsS http://127.0.0.1:8080/status | python3 -c 'import json,sys; d=json.load(sys.stdin); print("R942 queue:", [x.get("title") for x in d.get("upcomingR942",[])[:6]])'
echo "✅ R942 queue control installed. Backup: $BK"
