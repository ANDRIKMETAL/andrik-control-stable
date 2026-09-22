#!/usr/bin/env bash
set -Eeuo pipefail

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE='/root/ANDRIK-SAFE'
SCANNER='/usr/local/lib/andrik-radio-loudness-scan-r1098.py'
HELPER='/usr/local/sbin/andrik-radio-loudness-new-r1098'
UNITFILE='/etc/systemd/system/andrik-loudness-r1098.service'
HERE="$(cd "$(dirname "$0")" && pwd)"

NEW_SCANNER="$HERE/andrik-radio-loudness-scan-r1137.py"
NEW_HELPER="$HERE/andrik-radio-loudness-new-r1137"
NEW_UNIT="$HERE/andrik-loudness-r1137.service"

echo '=========================================================='
echo ' ANDRIK R1137 · SAFE LOUDNESS COMPLETION'
echo ' NO RADIO RESTART · NO MP3 REWRITE'
echo '=========================================================='

for f in "$NEW_SCANNER" "$NEW_HELPER" "$NEW_UNIT"; do
  test -s "$f" || { echo "❌ Missing $f"; exit 10; }
done

python3 -m py_compile "$NEW_SCANNER"
bash -n "$NEW_HELPER"
grep -Fq 'CPUQuota=8%' "$NEW_UNIT"
grep -Fq 'R1137-SAFE-BACKGROUND' "$NEW_SCANNER"
grep -Fq 'COOLDOWN_AFTER_TRACK_SEC = 45' "$NEW_SCANNER"

mkdir -p "$SAFE"
RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"

echo '=== BACKUP CURRENT LOUDNESS TOOLS ==='
for f in "$SCANNER" "$HELPER" "$UNITFILE"; do
  if [ -e "$f" ]; then
    b="$SAFE/$(basename "$f").PRE-R1137-$STAMP"
    cp -a "$f" "$b"
    echo "✅ $f -> $b"
  fi
done

# Stop ONLY old background loudness job if it is currently running.
if systemctl is-active --quiet andrik-loudness-r1098.service 2>/dev/null; then
  echo 'Stopping old loudness scanner only...'
  systemctl stop andrik-loudness-r1098.service || true
fi

install -o root -g root -m 0755 "$NEW_SCANNER" "$SCANNER"
install -o root -g root -m 0755 "$NEW_HELPER" "$HELPER"
install -o root -g root -m 0644 "$NEW_UNIT" "$UNITFILE"

systemctl daemon-reload
systemctl reset-failed andrik-loudness-r1098.service >/dev/null 2>&1 || true

RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"

echo
echo '=== VERIFY ==='
python3 -m py_compile "$SCANNER"
bash -n "$HELPER"
systemctl cat andrik-loudness-r1098.service | grep -E 'Description=|CPUQuota=|Nice=|IOSchedulingClass=|TimeoutStartSec='

echo "Radio PID before: $RADIO_PID_BEFORE"
echo "Radio PID after : $RADIO_PID_AFTER"
if [ -n "$RADIO_PID_BEFORE" ] && [ "$RADIO_PID_BEFORE" = "$RADIO_PID_AFTER" ]; then
  echo '✅ radio PID unchanged'
else
  echo '⚠️ radio PID differs; installer itself did NOT restart radio'
fi

echo
echo '=========================================================='
echo ' ✅ R1137 SAFE LOUDNESS INSTALLED'
echo ' Button remains the same: ВЫРОВНЯТЬ ГРОМКОСТЬ НОВЫХ ТРЕКОВ'
echo ' Existing valid analyses are preserved and skipped.'
echo ' No scan started automatically.'
echo '=========================================================='
