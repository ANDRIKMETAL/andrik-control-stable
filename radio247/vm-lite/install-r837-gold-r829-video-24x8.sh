#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
SERVICE="andrik-radio.service"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r837-gold-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
trap 'rm -f "$TMP"' EXIT
[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
curl -fsSL --retry 6 --retry-delay 2 "$SITE_BASE/radio247/server.mjs?t=$(date +%s)" -o "$TMP"
node --check "$TMP"
ACTUAL="$(sha256sum "$TMP" | awk '{print $1}')"
EXPECTED="fdba5038f3a35831ce84809572f123a6141d3a9a14915ab1246f1701b8f7f6ec"
[ "$ACTUAL" = "$EXPECTED" ] || { echo "ERROR: server.mjs hash mismatch"; echo "EXPECTED=$EXPECTED"; echo "ACTUAL=$ACTUAL"; exit 3; }
cp -a "$LIVE" "$BACKUP"
cat "$TMP" > "$LIVE"
chown --reference="$BACKUP" "$LIVE" 2>/dev/null || true
chmod --reference="$BACKUP" "$LIVE" 2>/dev/null || true
node --check "$LIVE"
systemctl restart "$SERVICE"
sleep 12
systemctl is-active --quiet "$SERVICE"
echo "✅ R837 GOLD INSTALLED"
echo "VIDEO=24 AUDIO=8 · R829 permanent fullscreen path"
echo "BACKUP=$BACKUP"
