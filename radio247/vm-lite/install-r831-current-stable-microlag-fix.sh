#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
LIVE="/opt/andrik-radio/radio247/server.mjs"
SERVICE="andrik-radio.service"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${LIVE}.bak-before-r831-microlag-fix-${STAMP}"
TMP="$(mktemp --suffix=.mjs)"
cleanup(){ rm -f "$TMP"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
command -v curl >/dev/null
command -v node >/dev/null
command -v systemctl >/dev/null
command -v sha256sum >/dev/null
[ -f "$LIVE" ] || { echo "ERROR: $LIVE not found" >&2; exit 2; }

curl -fsSL --retry 6 --retry-delay 2   "$SITE_BASE/radio247/server.mjs?t=$(date +%s)" -o "$TMP"

node --check "$TMP"
ACTUAL="$(sha256sum "$TMP" | awk '{print $1}')"
EXPECTED="3be770a005910f28be26e8deb4e91200b43d6e0a186a84c162474496d8659a67"
[ "$ACTUAL" = "$EXPECTED" ] || {
  echo "ERROR: downloaded server.mjs hash mismatch" >&2
  echo "EXPECTED=$EXPECTED" >&2
  echo "ACTUAL=$ACTUAL" >&2
  exit 3
}

python3 - "$TMP" <<'PY2'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text(encoding='utf-8')
required=[
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 "const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8;",
 "R831 MICRO-LAG FIX: normal priority restored",
]
missing=[x for x in required if x not in s]
if missing:
 print('ERROR: micro-lag markers missing:', *missing, sep='\n - ', file=sys.stderr)
 raise SystemExit(4)
print('R831 MICRO-LAG FIX VERIFIED ✅')
PY2

cp -a "$LIVE" "$BACKUP"
rollback(){
  set +e
  echo "ROLLBACK -> $BACKUP" >&2
  cp -af "$BACKUP" "$LIVE"
  systemctl restart "$SERVICE" >/dev/null 2>&1 || true
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

cat "$TMP" > "$LIVE"
chown --reference="$BACKUP" "$LIVE" 2>/dev/null || true
chmod --reference="$BACKUP" "$LIVE" 2>/dev/null || true
node --check "$LIVE"
systemctl restart "$SERVICE"
sleep 10
systemctl is-active --quiet "$SERVICE"
trap cleanup EXIT

echo "================================================"
echo "✅ R831 CURRENT STABLE + MICRO-LAG FIX INSTALLED"
echo "VIDEO QUEUE = 24"
echo "AUDIO QUEUE = 8"
echo "VIDEO FEEDER = NORMAL PRIORITY"
echo "BACKUP=$BACKUP"
echo "SHA256=3be770a005910f28be26e8deb4e91200b43d6e0a186a84c162474496d8659a67"
echo "================================================"
