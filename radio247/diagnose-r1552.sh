#!/usr/bin/env bash
# ANDRIK R1552: read-only diagnostics. No restart, no token dumps.
set -u
echo "ANDRIK R1552 READ-ONLY DIAGNOSTICS — $(date -u +%FT%TZ)"
echo "=== SERVICES ==="
for s in andrik-radio.service andrik-watch-r1532.service; do
  systemctl show "$s" -p ActiveState -p SubState -p Result --no-pager 2>/dev/null || true
done
echo "=== LOAD / MEMORY ==="
uptime
free -h
echo "=== CLIP PREP FAILURES (last 24h) ==="
sudo journalctl -u andrik-radio.service --since '24 hours ago' --no-pager -o short-iso 2>/dev/null | grep -Ei 'clip-prepare-r742|nice exit 255|video-feed-r816|immediate exit requested|error muxing|error closing file' | tail -n 100 || true
echo "=== WATCH INCIDENTS (last 24h) ==="
sudo journalctl -u andrik-watch-r1532.service --since '24 hours ago' --no-pager -o short-iso 2>/dev/null | grep -Ei 'error|failed|incident|clip|warning' | tail -n 60 || true
echo "=== CLIP PREPARER PROCESS / FILE LOCATION ==="
pgrep -af 'clip-prepare-r742|andrik-radio' | sed -E 's/(token|secret|password|key)=([^ ]+)/\1=[REDACTED]/Ig' | head -n 25 || true
echo "=== NOTE ==="
echo "This command does not inspect private OAuth tokens or change production services."
