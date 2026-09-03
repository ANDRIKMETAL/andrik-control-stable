#!/usr/bin/env bash
set -Eeuo pipefail
SELF="$(cd "$(dirname "$0")/../.." && pwd)"
LIVE="/opt/andrik-radio/radio247/server.mjs"
SRC="$SELF/radio247/server.mjs"
STAMP="$(date +%Y%m%d-%H%M%S)"
BAK="/opt/andrik-radio/backups/server.mjs.before-R862-$STAMP"
AGENT_SRC="$SELF/radio247/vm-lite/andrik-radio-web-agent-r803.mjs"
AGENT_TARGET="/usr/local/lib/andrik-radio-web-agent-r803.mjs"
AGENT_BAK="$AGENT_TARGET.before-R862-$STAMP"

rollback(){
  echo "❌ R862 install failed — restoring radio backup"
  [[ -s "$BAK" ]] && cp -a "$BAK" "$LIVE" || true
  systemctl restart andrik-radio.service 2>/dev/null || true
}
trap 'rc=$?; if [[ $rc -ne 0 ]]; then rollback; fi; exit $rc' EXIT

echo '================================================'
echo ' ANDRIK R862 SAFE FULL INSTALL'
echo ' R861 REAL EOF + R860 ALIGN + R859 HANDOFF + R857 QUOTA'
echo '================================================'

[[ -s "$SRC" ]] || { echo "Missing $SRC"; exit 1; }
[[ -s "$LIVE" ]] || { echo "Missing $LIVE"; exit 1; }
mkdir -p /opt/andrik-radio/backups
cp -a "$LIVE" "$BAK"

node --check "$SRC"
grep -q "version: 'R862-R861-REAL-EOF-R860-ALIGN-R859-R857-QUOTA-SHIELD'" "$SRC"
grep -q 'const CLIP_PRE_DRAIN_MS_R738 = 700;' "$SRC"
grep -q 'const VIDEO_INPUT_QUEUE_PACKETS_R732 = 96;' "$SRC"
grep -q 'const AUDIO_INPUT_QUEUE_PACKETS_R732 = 16;' "$SRC"
grep -q "r860-av-align-hold-start" "$SRC"
grep -q "station-r861-real-eof-shortest-av" "$SRC"
grep -q "stationInsert?\['-shortest'\]:\[\]" "$SRC"
if grep -q "thread_queue_size','64" "$SRC" || grep -q 'const AUDIO_INPUT_QUEUE_PACKETS_R732 = 64;' "$SRC" || grep -q 'const VIDEO_INPUT_QUEUE_PACKETS_R732 = 64;' "$SRC"; then
  echo 'ERROR: forbidden live queue 64 found'
  exit 1
fi
if grep -q 'firstAudioChunkR858\|r858-av-atomic-promote' "$SRC"; then
  echo 'ERROR: forbidden manual R858 PCM prime found'
  exit 1
fi

cp -a "$SRC" "$LIVE"

# Keep R857 quota shield on the VPS web agent without touching radio semantics.
if [[ -s "$AGENT_SRC" ]]; then
  node --check "$AGENT_SRC"
  grep -q 'await sleep(10000);' "$AGENT_SRC"
  grep -q 'now-lastYoutubeEnsureAtR721<120000' "$AGENT_SRC"
  [[ -f "$AGENT_TARGET" ]] && cp -a "$AGENT_TARGET" "$AGENT_BAK" || true
  install -m 0755 "$AGENT_SRC" "$AGENT_TARGET"
  for old in /usr/local/lib/andrik-radio-web-agent-r721.mjs /usr/local/lib/andrik-radio-web-agent-r802.mjs; do
    [[ -f "$old" ]] && install -m 0755 "$AGENT_SRC" "$old" || true
  done
fi

systemctl restart andrik-radio.service
sleep 12
[[ "$(systemctl is-active andrik-radio.service || true)" == "active" ]]

echo '=== RADIO STATUS ==='
curl -fsS --max-time 5 http://127.0.0.1:8080/status || true
echo

echo '=== CRITICAL VALUES ==='
grep -nE 'CLIP_PRE_DRAIN_MS_R738|VIDEO_INPUT_QUEUE_PACKETS_R732|AUDIO_INPUT_QUEUE_PACKETS_R732|station-r861-real-eof|r860-av-align' "$LIVE" | head -30

echo '================================================'
echo '✅ R862 INSTALLED'
echo '✅ R860 HOLD = 700 ms'
echo '✅ VIDEO INPUT QUEUE = 96'
echo '✅ AUDIO INPUT QUEUE = 16'
echo '✅ R861 REAL STATION EOF'
echo '✅ R857 QUOTA-SAFE WEB AGENT BUNDLED'
echo "BACKUP: $BAK"
echo '================================================'
trap - EXIT
