#!/usr/bin/env bash
set -Eeuo pipefail
BASE="/opt/andrik-radio"
AGENT_DST="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
HELPER_DST="/usr/local/sbin/andrik-audio-sync-r949"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BASE/backups/PRE-R949-AUDIO-SYNC-$STAMP"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
SITE="https://andrikmetal.com/radio247/vm-lite"
echo "======================================================"
echo " ANDRIK R949 · AUDIO SYNC 0..900ms / STEP 50"
echo " NO RADIO RESTART · SERVER.MJS UNTOUCHED"
echo "======================================================"
mkdir -p "$BACKUP" "$BASE/tools"
cp -a "$AGENT_DST" "$BACKUP/andrik-radio-web-agent-r803.mjs" 2>/dev/null || true
cp -a "$HELPER_DST" "$BACKUP/andrik-audio-sync-r949" 2>/dev/null || true
systemctl is-enabled andrik-mp4-audio-delay-r930.service > "$BACKUP/r930-enabled.txt" 2>&1 || true
systemctl is-active andrik-mp4-audio-delay-r930.service > "$BACKUP/r930-active.txt" 2>&1 || true
echo "✅ Backup: $BACKUP"
curl -fsSL "$SITE/andrik-radio-web-agent-r803.mjs?v=$STAMP" -o "$TMP/agent.mjs"
curl -fsSL "$SITE/andrik-audio-sync-r949?v=$STAMP" -o "$TMP/audio-sync"
grep -q "AGENT_VERSION_R803='R949'" "$TMP/agent.mjs"
grep -q 'ANDRIK AUDIO SYNC R949' "$TMP/audio-sync"
node --check "$TMP/agent.mjs"
bash -n "$TMP/audio-sync"
install -m 0644 "$TMP/agent.mjs" "$AGENT_DST"
install -m 0755 "$TMP/audio-sync" "$HELPER_DST"
systemctl disable --now andrik-mp4-audio-delay-r930.service 2>/dev/null || true
"$HELPER_DST" 0
systemctl restart andrik-radio-web-agent.service
sleep 3
echo "AGENT: $(systemctl is-active andrik-radio-web-agent.service 2>/dev/null || true)"
grep -n "AGENT_VERSION_R803" "$AGENT_DST" | head -1
cat /var/lib/andrik-radio/audio-sync-r949.json 2>/dev/null || true
cat > "$BASE/tools/rollback-r949-audio-sync.sh" <<ROLLBACK
#!/usr/bin/env bash
set -Eeuo pipefail
if [ -x "$HELPER_DST" ]; then "$HELPER_DST" 0 || true; fi
if [ -s "$BACKUP/andrik-radio-web-agent-r803.mjs" ]; then install -m 0644 "$BACKUP/andrik-radio-web-agent-r803.mjs" "$AGENT_DST"; fi
if [ -s "$BACKUP/andrik-audio-sync-r949" ]; then install -m 0755 "$BACKUP/andrik-audio-sync-r949" "$HELPER_DST"; fi
systemctl restart andrik-radio-web-agent.service || true
if grep -q '^enabled' "$BACKUP/r930-enabled.txt" 2>/dev/null; then systemctl enable andrik-mp4-audio-delay-r930.service || true; fi
if grep -q '^active' "$BACKUP/r930-active.txt" 2>/dev/null; then systemctl start andrik-mp4-audio-delay-r930.service || true; fi
echo "✅ R949 audio calibration rolled back · radio was not restarted"
ROLLBACK
chmod 0755 "$BASE/tools/rollback-r949-audio-sync.sh"
echo "======================================================"
echo "✅ R949 AUDIO SYNC INSTALLED"
echo "✅ 0ms BASELINE CAPTURED"
echo "✅ R930 DISABLED DURING CALIBRATION"
echo "✅ RADIO SERVICE NOT RESTARTED"
echo "✅ SERVER.MJS / FULLSCREEN / R943C UNTOUCHED"
echo "======================================================"
