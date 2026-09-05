#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
SERVER="/opt/andrik-radio/radio247/server.mjs"
BACKUPS="/opt/andrik-radio/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
EXPECTED="9492dd0e5021daa57a6b2d1f0325379323520a45b64a6737786c70cdbd3d81a9"
HELPER_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-air-restore-r925?t=$(date +%s)"
AGENT_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)"
TMP="$(mktemp /tmp/andrik-air-r925.XXXXXX)"
TMP_AGENT="$(mktemp /tmp/andrik-agent-r925.XXXXXX.mjs)"
NEW_TARGET="/usr/local/sbin/andrik-radio-air-restore-r925"
LEGACY_TARGET="/usr/local/sbin/andrik-radio-fullscreen-gold-restore-r867"
GOLD="$BACKUPS/GOLD-R925-AIR-RESTORE-$STAMP"
trap 'rm -f "$TMP" "$TMP_AGENT"' EXIT

echo "======================================================"
echo " ANDRIK R925 · ARM ВОССТАНОВИТЬ ЭФИР"
echo " SNAPSHOT VERIFIED GOLD · NO RADIO RESTART"
echo "======================================================"

[ -s "$SERVER" ] || { echo "❌ server.mjs missing"; exit 20; }
mkdir -p "$BACKUPS"

SOURCE="$SERVER"
SHA="$(sha256sum "$SOURCE" | awk '{print $1}')"
if [ "$SHA" != "$EXPECTED" ]; then
  SOURCE="$(find "$BACKUPS" -maxdepth 2 -type f -path '*/GOLD-PRE-R937C-FULLSCREEN-RESTORED-*/server.mjs' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1 | cut -d' ' -f2-)"
  [ -n "$SOURCE" ] && [ -s "$SOURCE" ] || { echo "❌ verified PRE-R937C GOLD not found"; exit 21; }
  SHA="$(sha256sum "$SOURCE" | awk '{print $1}')"
fi

[ "$SHA" = "$EXPECTED" ] || { echo "❌ source SHA is not verified GOLD"; echo "FOUND=$SHA"; exit 22; }

echo "✅ VERIFIED GOLD SOURCE=$SOURCE"
mkdir -p "$GOLD"
cp -a "$SOURCE" "$GOLD/server.mjs"
sha256sum "$GOLD/server.mjs" > "$GOLD/server.sha256"
cat >"$GOLD/README.txt" <<EOF
ANDRIK R925 AIR RESTORE GOLD
Created: $STAMP
Verified SHA: $EXPECTED
Source: $SOURCE
Purpose: one-click restore of the working radio server from Control.
EOF

curl -fsSL --retry 6 --retry-delay 2 "$HELPER_URL" -o "$TMP"
curl -fsSL --retry 6 --retry-delay 2 "$AGENT_URL" -o "$TMP_AGENT"
bash -n "$TMP"
node --check "$TMP_AGENT"
grep -Fq 'ANDRIK R925 · ВОССТАНОВИТЬ ЭФИР' "$TMP"
grep -Fq "AGENT_VERSION_R803='R925'" "$TMP_AGENT"
! grep -Fq "action==='fullscreen-restore'" "$TMP_AGENT"

[ -f "$NEW_TARGET" ] && cp -a "$NEW_TARGET" "$NEW_TARGET.before-R925-$STAMP"
[ -f "$LEGACY_TARGET" ] && cp -a "$LEGACY_TARGET" "$LEGACY_TARGET.before-R925-$STAMP"
install -m 0755 "$TMP" "$NEW_TARGET"
# Existing R870 agent already calls this legacy path for action=gold-restore.
# Point that established action to the new safe R925 air-restore helper.
install -m 0755 "$TMP" "$LEGACY_TARGET"

# Update only the web-control agent, never the radio encoder.
AGENT_TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
[ -f "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.before-R925-$STAMP"
install -m 0755 "$TMP_AGENT" "$AGENT_TARGET"
for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
  if [ -f "$old" ]; then
    cp -a "$old" "$old.before-R925-$STAMP"
    install -m 0755 "$TMP_AGENT" "$old"
  fi
done

unit_exists(){ systemctl list-unit-files --type=service --no-legend 2>/dev/null | awk '{print $1}' | grep -Fxq "$1"; }
unit_active(){ systemctl is-active --quiet "$1" 2>/dev/null; }
CANON=''
if unit_exists andrik-radio-web.service && unit_active andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service && unit_active andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
elif unit_exists andrik-radio-web.service; then CANON=andrik-radio-web.service
elif unit_exists andrik-radio-web-agent.service; then CANON=andrik-radio-web-agent.service
fi
if [ -n "$CANON" ]; then
  systemctl daemon-reload
  systemctl restart "$CANON"
  sleep 3
  echo "✅ WEB AGENT=$CANON · $(systemctl is-active "$CANON" || true)"
else
  echo "⚠️ web-agent service not found; helper is installed, agent source saved"
fi

echo
echo "✅ GOLD SNAPSHOT=$GOLD"
echo "✅ AIR RESTORE HELPER=$NEW_TARGET"
echo "✅ EXISTING CONTROL ACTION REWIRED SAFELY"
echo "✅ RADIO SERVICE NOT RESTARTED"
echo "✅ WEB AGENT UPDATED TO R925 (radio encoder untouched)"
echo "✅ SWAP UNTOUCHED"
echo "✅ FULLSCREEN WATCHDOG UNTOUCHED"
echo "======================================================"
