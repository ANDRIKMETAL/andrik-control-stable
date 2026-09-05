#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STAMP="$(date +%Y%m%d-%H%M%S)"
HELPER_URL="${SITE_BASE%/}/radio247/vm-lite/andrik-radio-screen-restore-r926?t=$(date +%s)"
HELPER_TARGET="/usr/local/sbin/andrik-radio-screen-restore-r926"
POINTER="/etc/andrik-radio-screen-gold-path"
SERVER="/opt/andrik-radio/radio247/server.mjs"
BACKUPS="/opt/andrik-radio/backups"
TMP_HELPER="$(mktemp /tmp/andrik-screen-r937.XXXXXX.sh)"
trap 'rm -f "$TMP_HELPER"' EXIT

echo '======================================================='
echo ' ANDRIK R937 · ARM SCREEN BUTTON TO R936F GOLD'
echo ' radio is NOT restarted by installer'
echo '======================================================='

[ -s "$SERVER" ] || { echo '❌ live server missing'; exit 20; }

# Verify the currently confirmed FULL server really contains R936F.
grep -Eq 'holdR917B[[:space:]]*=[[:space:]]*0\.05' "$SERVER" || { echo '❌ live server is not R935 (hold)'; exit 21; }
grep -Eq 'const[[:space:]]+TRACK_AUDIO_FADE_IN_R726[[:space:]]*=[[:space:]]*0\.18' "$SERVER" || { echo '❌ live server is not R936F (fade-in)'; exit 22; }
grep -Eq 'const[[:space:]]+TRACK_AUDIO_FADE_OUT_R726[[:space:]]*=[[:space:]]*0\.45' "$SERVER" || { echo '❌ live server is not R936F (fade-out)'; exit 23; }
grep -Eq 'const[[:space:]]+MP3_BOUNDARY_FADE_OUT_SECONDS_R814[[:space:]]*=[[:space:]]*0\.35' "$SERVER" || { echo '❌ live server is not R936F (video out)'; exit 24; }
grep -Eq 'const[[:space:]]+MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814[[:space:]]*=[[:space:]]*0\.02' "$SERVER" || { echo '❌ live server is not R936F (black hold)'; exit 25; }
grep -Eq 'const[[:space:]]+MP3_BOUNDARY_FADE_IN_SECONDS_R814[[:space:]]*=[[:space:]]*0\.30' "$SERVER" || { echo '❌ live server is not R936F (video in)'; exit 26; }
node --check "$SERVER" >/dev/null

# Make a dedicated immutable GOLD for the screen button from the state the user confirmed FULL.
GOLD_DIR="$BACKUPS/GOLD-R936F-FULLSCREEN-BUTTON-$STAMP"
mkdir -p "$GOLD_DIR"
cp -a "$SERVER" "$GOLD_DIR/server.mjs"
sha256sum "$GOLD_DIR/server.mjs" > "$GOLD_DIR/server.mjs.sha256"
printf '%s\n' "$GOLD_DIR/server.mjs" > "$POINTER"
chmod 0644 "$POINTER"

echo "🏆 PINNED GOLD=$GOLD_DIR/server.mjs"
echo "SHA=$(awk '{print $1}' "$GOLD_DIR/server.mjs.sha256")"

curl -fsSL --retry 6 --retry-delay 2 "$HELPER_URL" -o "$TMP_HELPER"
bash -n "$TMP_HELPER"
grep -Fq 'ANDRIK R937 · ВОССТАНОВИТЬ ЭКРАН' "$TMP_HELPER"
grep -Fq 'PINNED R936F FULLSCREEN GOLD' "$TMP_HELPER"

[ -f "$HELPER_TARGET" ] && cp -a "$HELPER_TARGET" "$HELPER_TARGET.before-R937-$STAMP"
install -m 0755 "$TMP_HELPER" "$HELPER_TARGET"

echo '✅ SCREEN BUTTON NOW RESTORES PINNED R936F FULLSCREEN GOLD'
echo '✅ R935/R936F WILL NOT BE LOST'
echo '✅ R930 UNTOUCHED'
echo '✅ RADIO NOT RESTARTED'
echo '======================================================='
