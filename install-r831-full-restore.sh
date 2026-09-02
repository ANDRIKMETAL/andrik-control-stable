#!/usr/bin/env bash
set -Eeuo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
LIVE=/opt/andrik-radio/radio247
STAMP=$(date +%Y%m%d-%H%M%S)
BK=/opt/andrik-radio/backups/BEFORE-R831-FULL-RESTORE-$STAMP

echo '=== ANDRIK R831 FULL RADIO247 RESTORE ==='
[ -f "$SRC/radio247/server.mjs" ] || { echo 'ERROR: radio247/server.mjs missing'; exit 1; }
mkdir -p "$BK"
cp -a "$LIVE" "$BK/radio247" 2>/dev/null || true
systemctl disable --now andrik-gold-watchdog.timer 2>/dev/null || true
systemctl disable --now andrik-flicker-guard.timer 2>/dev/null || true
systemctl stop andrik-radio.service || true
sleep 3
systemctl kill --kill-who=all --signal=SIGKILL andrik-radio.service 2>/dev/null || true
rm -rf "$LIVE"
cp -a "$SRC/radio247" "$LIVE"
node --check "$LIVE/server.mjs"
systemctl reset-failed andrik-radio.service || true
systemctl start andrik-radio.service
sleep 12
echo "Backup: $BK"
echo "Radio: $(systemctl is-active andrik-radio.service || true)"
echo 'OK: COMPLETE R831 radio247 restored; env/RTMPS/content untouched.'
