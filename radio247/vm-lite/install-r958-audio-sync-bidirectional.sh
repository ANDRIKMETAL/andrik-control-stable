#!/usr/bin/env bash
set -Eeuo pipefail
BASE="/opt/andrik-radio"
AGENT="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
HELPER="/usr/local/sbin/andrik-audio-sync-r949"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BASE/backups/PRE-R958-BIDIRECTIONAL-AUDIO-$STAMP"
TMP="$(mktemp -d)"
RAW="https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/radio247/vm-lite"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$BACKUP"
cp -a "$AGENT" "$BACKUP/agent.mjs" 2>/dev/null || true
cp -a "$HELPER" "$BACKUP/audio-sync" 2>/dev/null || true

curl -fL --retry 3 --retry-delay 2 "$RAW/andrik-radio-web-agent-r803.mjs?v=$STAMP" -o "$TMP/agent.mjs"
curl -fL --retry 3 --retry-delay 2 "$RAW/andrik-audio-sync-r949?v=$STAMP" -o "$TMP/audio-sync"

grep -q "const AGENT_VERSION_R803='R958';" "$TMP/agent.mjs"
grep -q 'ANDRIK AUDIO SYNC R958 · BIDIRECTIONAL' "$TMP/audio-sync"
node --check "$TMP/agent.mjs"
bash -n "$TMP/audio-sync"

install -m 0644 "$TMP/agent.mjs" "$AGENT"
install -m 0755 "$TMP/audio-sync" "$HELPER"

# Keep legacy automatic processor disabled; it must not fight manual calibration.
systemctl disable --now andrik-mp4-audio-delay-r930.service 2>/dev/null || true

# IMPORTANT: agent only. Do NOT call helper here. Existing target and zero baseline remain unchanged.
systemctl restart andrik-radio-web-agent.service
sleep 4

echo "=== VERIFY ==="
grep -n "AGENT_VERSION_R803" "$AGENT" | head -1
systemctl is-active andrik-radio-web-agent.service
[ -x "$HELPER" ] && echo "✅ R958 bidirectional helper installed"
cat /var/lib/andrik-radio/audio-sync-r949.json 2>/dev/null || true

echo "======================================================"
echo "✅ R958 BIDIRECTIONAL AUDIO CONTROL INSTALLED"
echo "✅ RANGE -500..+500 ms / STEP 50"
echo "✅ CURRENT TARGET PRESERVED"
echo "✅ EXISTING R949 ZERO BASELINE PRESERVED"
echo "✅ RADIO SERVICE NOT RESTARTED"
echo "✅ SERVER.MJS NOT TOUCHED"
echo "✅ R906 FULLSCREEN NOT TOUCHED"
echo "✅ R922 WATCHDOG STATE NOT TOUCHED"
echo "======================================================"
