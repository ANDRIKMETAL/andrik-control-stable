#!/usr/bin/env bash
set -Eeuo pipefail

SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
CANON_UNIT="andrik-radio-web.service"
CANON_LIB="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
TMP_AGENT="$(mktemp --suffix=.mjs)"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_LIB="${CANON_LIB}.bak-before-r805-${STAMP}"

cleanup(){ rm -f "$TMP_AGENT"; }
trap cleanup EXIT

[ "${EUID}" -eq 0 ] || { echo "ERROR: run with sudo" >&2; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not found" >&2; exit 1; }
command -v curl >/dev/null || { echo "ERROR: curl not found" >&2; exit 1; }

[[ "$(systemctl show "$CANON_UNIT" -p LoadState --value 2>/dev/null || true)" == "loaded" ]] || {
  echo "ERROR: $CANON_UNIT not found" >&2; exit 1;
}
[[ -f "$CANON_LIB" ]] || { echo "ERROR: $CANON_LIB missing — install R803E first" >&2; exit 1; }

RADIO_PID_BEFORE="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_BEFORE="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"
WEB_PID_BEFORE="$(systemctl show "$CANON_UNIT" -p MainPID --value 2>/dev/null || true)"

echo "=== R805 LIVE LIBRARY COUNTERS ==="
echo "radio : $RADIO_ACTIVE_BEFORE · MainPID=$RADIO_PID_BEFORE"
echo "agent : $(systemctl is-active "$CANON_UNIT" 2>/dev/null || true) · MainPID=$WEB_PID_BEFORE"
echo "scope : web-agent telemetry + control-card counters ONLY"
echo "stream: radio / FFmpeg / RTMPS will NOT be restarted"

echo "=== DOWNLOAD R803 AGENT + R805 INVENTORY TELEMETRY ==="
curl -fsSL --retry 5 --retry-delay 2 \
  "${SITE_BASE}/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?t=$(date +%s)" \
  -o "$TMP_AGENT"

grep -q "AGENT_VERSION_R803='R803'" "$TMP_AGENT" || { echo "ERROR: canonical R803 diagnostics missing" >&2; exit 1; }
grep -q "R805-LIVE-LIBRARY-COUNTERS" "$TMP_AGENT" || { echo "ERROR: R805 inventory telemetry missing" >&2; exit 1; }
grep -q "libraryTracks:Number(d.libraryTracks" "$TMP_AGENT" || { echo "ERROR: total-song telemetry missing" >&2; exit 1; }
grep -q "libraryVideos:Number(d.libraryVideos" "$TMP_AGENT" || { echo "ERROR: video telemetry missing" >&2; exit 1; }
node --check "$TMP_AGENT"

cp -a "$CANON_LIB" "$BACKUP_LIB"
echo "Backup: $BACKUP_LIB"

rollback(){
  set +e
  echo "=== R805 ROLLBACK WEB AGENT ONLY ===" >&2
  cp -a "$BACKUP_LIB" "$CANON_LIB" 2>/dev/null || true
  systemctl restart "$CANON_UNIT" >/dev/null 2>&1 || true
  echo "Radio / FFmpeg / RTMPS were NOT touched." >&2
}
trap 'rc=$?; if [ $rc -ne 0 ]; then rollback; fi; cleanup' EXIT

install -m 0644 "$TMP_AGENT" "$CANON_LIB"
node --check "$CANON_LIB"

echo "=== RESTART WEB STATUS AGENT ONLY ==="
systemctl restart "$CANON_UNIT"
sleep 6
[[ "$(systemctl is-active "$CANON_UNIT" 2>/dev/null || true)" == "active" ]] || {
  systemctl status "$CANON_UNIT" --no-pager -l | tail -n 100 || true
  echo "ERROR: web agent did not start" >&2
  exit 1
}

LOCAL_STATUS="$(/usr/local/sbin/andrik-radio-web status 2>&1 || true)"
printf '%s\n' "$LOCAL_STATUS" | grep -q "R805-LIVE-LIBRARY-COUNTERS" || {
  printf '%s\n' "$LOCAL_STATUS" | head -n 180
  echo "ERROR: inventory telemetry is not exposed" >&2
  exit 1
}

RADIO_PID_AFTER="$(systemctl show andrik-radio.service -p MainPID --value 2>/dev/null || true)"
RADIO_ACTIVE_AFTER="$(systemctl is-active andrik-radio.service 2>/dev/null || true)"
WEB_PID_AFTER="$(systemctl show "$CANON_UNIT" -p MainPID --value 2>/dev/null || true)"

echo "=== EXACT LIVE INVENTORY ==="
printf '%s\n' "$LOCAL_STATUS" | grep -E "libraryTracks|libraryAlbumTracks|librarySingleTracks|libraryVideos|libraryBumpers|librarySpecial|inventoryTelemetry" | head -n 30 || true

echo "=== RADIO NON-INTERFERENCE PROOF ==="
echo "radio active before : $RADIO_ACTIVE_BEFORE"
echo "radio active after  : $RADIO_ACTIVE_AFTER"
echo "radio MainPID before: $RADIO_PID_BEFORE"
echo "radio MainPID after : $RADIO_PID_AFTER"
echo "web-agent PID before: $WEB_PID_BEFORE"
echo "web-agent PID after : $WEB_PID_AFTER"

[[ "$RADIO_ACTIVE_AFTER" == "active" ]] || { echo "ERROR: radio is not active (R805 never touched it)" >&2; exit 1; }
if [[ -n "$RADIO_PID_BEFORE" && "$RADIO_PID_BEFORE" != "0" && "$RADIO_PID_AFTER" != "$RADIO_PID_BEFORE" ]]; then
  echo "ERROR: radio MainPID changed unexpectedly; R805 never calls restart/stop/start on andrik-radio.service" >&2
  exit 1
fi

trap cleanup EXIT

echo "=== R805 READY ==="
echo "Card now receives exact running-radio counts:"
echo "  songs total / album tracks / singles / music videos / station inserts"
echo "R804 stream engine: PRESERVED"
echo "R803 diagnostics: PRESERVED"
echo "Radio / FFmpeg / RTMPS: NOT restarted"
