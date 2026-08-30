#!/usr/bin/env bash
set -Eeuo pipefail

if [ "${EUID}" -ne 0 ] && [ "${R774_TEST_MODE:-0}" != "1" ]; then
  echo "Run with sudo"
  exit 1
fi

BASE="${ANDRIK_RADIO_BASE:-/opt/andrik-radio}"
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
CTA_DEST="$ASSET_DIR/subscribe-right-r767.png"
SERVICE="${ANDRIK_RADIO_SERVICE:-andrik-radio.service}"
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp -d /tmp/andrik-r774.XXXXXX)"
STAMP="$(date +%s)"
REMOTE_SERVER="$TMP/server.mjs"
REMOTE_CTA="$TMP/subscribe.png"
BACKUP_SERVER="$SERVER.bak-before-r774-$STAMP"
BACKUP_CTA="$CTA_DEST.bak-before-r774-$STAMP"
HAD_CTA=0
trap 'rm -rf "$TMP"' EXIT

rollback() {
  echo "ROLLBACK: restore previous working server"
  if [ -f "$BACKUP_SERVER" ]; then cp -a "$BACKUP_SERVER" "$SERVER" || true; fi
  if [ "$HAD_CTA" = "1" ] && [ -f "$BACKUP_CTA" ]; then cp -a "$BACKUP_CTA" "$CTA_DEST" || true; fi
  if [ "${R774_TEST_MODE:-0}" != "1" ]; then
    systemctl restart "$SERVICE" || true
    sleep 10
  fi
}

for cmd in curl node ffmpeg python3 cp install mkdir date mktemp stat; do
  command -v "$cmd" >/dev/null 2>&1 || { echo "STOP: missing $cmd"; exit 2; }
done

[ -s "$SERVER" ] || { echo "STOP: current server missing: $SERVER"; exit 2; }
mkdir -p "$ASSET_DIR"

echo "[1/7] Download R774"
curl -fsSL --retry 5 --connect-timeout 15 --max-time 120 "$SITE_BASE/radio247/server.mjs?v=$STAMP" -o "$REMOTE_SERVER"
curl -fsSL --retry 5 --connect-timeout 15 --max-time 120 "$SITE_BASE/assets/subscribe-right-r767.png?v=$STAMP" -o "$REMOTE_CTA"

echo "[2/7] Verify before restart"
node --check "$REMOTE_SERVER" >/dev/null
grep -Fq "R774-STABLE-RECOVERY-CLIP-TO-MP3-FADE-R772-R769-PRESERVED" "$REMOTE_SERVER" || { echo "STOP: remote server is not R774"; exit 3; }
grep -Fq "finalChain+=\`;[prefadeout][startmask]overlay" "$REMOTE_SERVER" || { echo "STOP: clip-to-MP3 filter separator missing"; exit 3; }
grep -Fq "CLIP_TO_TRACK_FADE_IN_SECONDS_R753 || 0.80" "$REMOTE_SERVER" || { echo "STOP: clip-to-MP3 fade 0.80 missing"; exit 3; }
ffmpeg -hide_banner -loglevel error -i "$REMOTE_CTA" -frames:v 1 -f null - >/dev/null 2>&1 || { echo "STOP: subscribe PNG invalid"; exit 3; }

# Test the exact two-mask filter topology that previously caused Invalid argument.
FG='[0:v]format=yuv420p[base];color=c=black@1.0:s=320x180:r=25,format=yuva420p,fade=t=in:st=0.2:d=0.1:alpha=1,fade=t=out:st=0.3:d=0.1:alpha=1[blackmask];color=c=black@1.0:s=320x180:r=25,format=yuva420p,fade=t=out:st=0:d=0.1:alpha=1[startmask];[base][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[prefadeout];[prefadeout][startmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]'
ffmpeg -hide_banner -loglevel error -f lavfi -i 'testsrc=size=320x180:rate=25' -filter_complex "$FG" -map '[outv]' -frames:v 1 -f null - >/dev/null 2>&1 || { echo "STOP: local FFmpeg rejected safe fade graph"; exit 3; }

echo "[3/7] Backup"
cp -a "$SERVER" "$BACKUP_SERVER"
if [ -f "$CTA_DEST" ]; then cp -a "$CTA_DEST" "$BACKUP_CTA"; HAD_CTA=1; fi

echo "[4/7] Install"
install -m 0644 "$REMOTE_SERVER" "$SERVER"
install -m 0644 "$REMOTE_CTA" "$CTA_DEST"

if [ "${R774_TEST_MODE:-0}" = "1" ]; then
  echo "TEST_OK: R774 files installed"
  exit 0
fi

echo "[5/7] Restart"
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 15
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo "[6/7] Status"
STATUS_FILE="$TMP/status.json"
if ! curl -fsS --max-time 5 http://127.0.0.1:8080/status -o "$STATUS_FILE"; then rollback; exit 5; fi
if ! python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); ok=(d.get("version")=="R774-STABLE-RECOVERY-CLIP-TO-MP3-FADE-R772-R769-PRESERVED" and d.get("publisherRunning") is True); raise SystemExit(0 if ok else 1)' "$STATUS_FILE"; then
  cat "$STATUS_FILE" || true
  rollback
  exit 5
fi

echo "[7/7] Live guard"
sleep 35
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 6; fi
journalctl -u "$SERVICE" --since "-2 min" --no-pager > "$TMP/live.log" 2>/dev/null || true
if grep -Eq 'Error parsing filterchain|filter_complex: Invalid argument|Trailing garbage after a filter|master pipe NO-PROGRESS|status=76/PROTOCOL' "$TMP/live.log"; then
  grep -E 'Error parsing filterchain|filter_complex: Invalid argument|Trailing garbage after a filter|master pipe NO-PROGRESS|status=76/PROTOCOL' "$TMP/live.log" | tail -n 20 || true
  rollback
  exit 6
fi

python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning"),"HEALTHY:",d.get("transportHealthy")); print("CLIP->MP3 FADE:",d.get("clipToTrackFadeInSeconds"),d.get("clipToTrackFadeMode")); print("NEXT:",d.get("committedNextMode")); print("BUMPER:",d.get("stationInsertSync")); print("CLIP CTA:",d.get("clipSubscribeOverlay")); print("QUALITY:",d.get("videoBitrate"),d.get("audioBitrate"))' "$STATUS_FILE"
echo "OK: R774 installed"
