#!/usr/bin/env bash
set -Eeuo pipefail

BASE="${ANDRIK_BASE:-/opt/andrik-radio}"
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
CTA_DEST="$ASSET_DIR/subscribe-right-r767.png"
SERVICE="${ANDRIK_SERVICE:-andrik-radio.service}"
ENV_FILE="${ANDRIK_ENV_FILE:-/etc/andrik-radio.env}"
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
STATUS_URL="${ANDRIK_STATUS_URL:-http://127.0.0.1:8080/status}"
START_WAIT="${ANDRIK_INSTALL_WAIT_SECONDS:-12}"
LIVE_WAIT="${ANDRIK_LIVE_CHECK_SECONDS:-25}"
STAMP="$(date +%s)"
TMP="$(mktemp -d /tmp/andrik-r773.XXXXXX)"
TMP_SERVER="$TMP/server.mjs"
TMP_CTA="$TMP/subscribe-right-r767.png"
BACKUP_SERVER="${SERVER}.bak-before-r773-$STAMP"
BACKUP_CTA="${CTA_DEST}.bak-before-r773-$STAMP"
HAD_CTA=0

cleanup(){ rm -rf "$TMP"; }
trap cleanup EXIT

need(){ command -v "$1" >/dev/null 2>&1 || { echo "STOP: missing $1"; exit 2; }; }
for c in curl node python3 systemctl journalctl grep stat install cp mkdir sleep date; do need "$c"; done

[ -s "$SERVER" ] || { echo "STOP: missing current server: $SERVER"; exit 2; }
[ -s "$ENV_FILE" ] || { echo "STOP: missing env: $ENV_FILE"; exit 2; }
mkdir -p "$ASSET_DIR"

echo "[1/7] Download R773"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$SITE_BASE/radio247/server.mjs?v=$STAMP" -o "$TMP_SERVER"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 "$SITE_BASE/assets/subscribe-right-r767.png?v=$STAMP" -o "$TMP_CTA"

echo "[2/7] Verify before restart"
node --check "$TMP_SERVER" >/dev/null
grep -Fq "R773-INSTALL-VERIFIED-PCM-SYNC-R772-ENGINE-PRESERVED" "$TMP_SERVER" || { echo "STOP: remote server is not R773"; exit 3; }
grep -Fq "R772-NODE-PCM-RMS-NO-FFMPEG-SILENCEDETECT" "$TMP_SERVER" || { echo "STOP: R772 PCM sync marker missing"; exit 3; }
grep -Fq "COMMITTED_NEXT_FILE_R769" "$TMP_SERVER" || { echo "STOP: committed NEXT marker missing"; exit 3; }
grep -Fq "R771-PREBAKED-RIGHT-CTA-NO-LIVE-FILTER-COMPLEX" "$TMP_SERVER" || { echo "STOP: clip CTA marker missing"; exit 3; }
[ "$(stat -c%s "$TMP_CTA")" -gt 50000 ] || { echo "STOP: CTA file too small"; exit 3; }

echo "[3/7] Backup"
cp -a "$SERVER" "$BACKUP_SERVER"
if [ -e "$CTA_DEST" ]; then cp -a "$CTA_DEST" "$BACKUP_CTA"; HAD_CTA=1; fi

rollback(){
  echo "ROLLBACK: restore previous working server"
  cp -a "$BACKUP_SERVER" "$SERVER" || true
  if [ "$HAD_CTA" = 1 ]; then cp -a "$BACKUP_CTA" "$CTA_DEST" || true; else rm -f "$CTA_DEST"; fi
  systemctl restart "$SERVICE" || true
  sleep 8
}

echo "[4/7] Install"
install -m 0644 "$TMP_SERVER" "$SERVER"
install -m 0644 "$TMP_CTA" "$CTA_DEST"
chmod 600 "$ENV_FILE"

echo "[5/7] Restart"
START_TS="$(date '+%Y-%m-%d %H:%M:%S')"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep "$START_WAIT"
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo "[6/7] Status"
STATUS=""
OK=0
for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
  STATUS="$(curl -fsS --max-time 4 "$STATUS_URL" 2>/dev/null || true)"
  if STATUS_JSON="$STATUS" python3 -c 'import json,os,sys; d=json.loads(os.environ.get("STATUS_JSON", "{}")); ok=(d.get("version")=="R773-INSTALL-VERIFIED-PCM-SYNC-R772-ENGINE-PRESERVED" and d.get("publisherRunning") is True); sys.exit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo "FAIL: R773 status not confirmed"
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

echo "[7/7] Live guard"
sleep "$LIVE_WAIT"
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
LOG="$TMP/live.log"
journalctl -u "$SERVICE" --since "$START_TS" --no-pager > "$LOG" 2>/dev/null || true
if grep -Eq 'Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|status=76/PROTOCOL' "$LOG"; then
  echo "FAIL: live regression detected"
  grep -E 'Error parsing filterchain|filter_complex: Invalid argument|master pipe NO-PROGRESS|status=76/PROTOCOL' "$LOG" | tail -n 20 || true
  rollback
  exit 6
fi

printf '%s\n' "$STATUS" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("TRANSPORT:",d.get("transportHealthy")); print("NEXT:",d.get("committedNextMode")); print("BUMPER:",d.get("stationInsertSync")); print("CLIP CTA:",d.get("clipSubscribeOverlay")); print("QUALITY:",d.get("videoBitrate"),d.get("audioBitrate")); print("ERROR:",d.get("lastError"))'
echo "OK: R773 installed"
