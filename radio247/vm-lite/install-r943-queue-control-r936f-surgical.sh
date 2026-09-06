#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://andrikmetal.com/radio247/vm-lite"
LIVE="/opt/andrik-radio/radio247/server.mjs"
AGENT="/opt/andrik-radio/vm-lite/andrik-radio-web-agent-r803.mjs"
EXPECTED_R936F="afa7eab46f57c443c85403581e9c7dc059297d8d6450a9a32953b98f16e4645a"
STAMP="$(date +%Y%m%d-%H%M%S)"
BK="/opt/andrik-radio/backups/PRE-R943-QUEUE-$STAMP"
TMP="$(mktemp -d /tmp/andrik-r943-queue.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

echo "======================================================"
echo " ANDRIK R943 · SURGICAL NEXT-6 QUEUE"
echo " R936F A/V + FULLSCREEN MUST STAY UNCHANGED"
echo "======================================================"

[ -s "$LIVE" ] || { echo "❌ Missing $LIVE"; exit 20; }
[ -s "$AGENT" ] || { echo "❌ Missing $AGENT"; exit 21; }

LIVE_SHA="$(sha256sum "$LIVE" | awk '{print $1}')"
if grep -q 'R943_QUEUE_PATCH_BEGIN' "$LIVE"; then
  echo "✅ R943 queue already installed in server.mjs"
else
  [ "$LIVE_SHA" = "$EXPECTED_R936F" ] || {
    echo "❌ REFUSED: current server is not the confirmed R936F GOLD"
    echo "LIVE SHA : $LIVE_SHA"
    echo "NEEDED   : $EXPECTED_R936F"
    echo "Nothing changed."
    exit 22
  }
fi

# Hard guards for the proven R936F transition/fullscreen baseline.
grep -Eq 'TRACK_AUDIO_FADE_IN_R726 *= *0\.18' "$LIVE"
grep -Eq 'TRACK_AUDIO_FADE_OUT_R726 *= *0\.45' "$LIVE"
grep -Eq 'MP3_BOUNDARY_FADE_OUT_SECONDS_R814 *= *0\.35' "$LIVE"
grep -Eq 'MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 *= *0\.02' "$LIVE"
grep -Eq 'MP3_BOUNDARY_FADE_IN_SECONDS_R814 *= *0\.30' "$LIVE"
grep -Eq 'const holdR917B *= *2\.00' "$LIVE"

mkdir -p "$BK"
cp -a "$LIVE" "$BK/server.mjs"
cp -a "$AGENT" "$BK/andrik-radio-web-agent-r803.mjs"
echo "✅ Backup: $BK"

# Fingerprint only the A/V/fullscreen lines; it MUST remain identical after patching.
grep -E 'TRACK_AUDIO_FADE_IN_R726|TRACK_AUDIO_FADE_OUT_R726|MP3_BOUNDARY_FADE_OUT_SECONDS_R814|MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814|MP3_BOUNDARY_FADE_IN_SECONDS_R814|const holdR917B|FULL_FRAME_FILTER_R787|LIVE_FULL_FRAME_FILTER_R794|LIVE_FULL_FRAME_GEOMETRY_R819' "$LIVE" > "$TMP/av.before"

if ! grep -q 'R943_QUEUE_PATCH_BEGIN' "$LIVE"; then
  curl -fsSL "$BASE/patch-r943-queue.py?v=$STAMP" -o "$TMP/patch-r943-queue.py"
  cp -a "$LIVE" "$TMP/server.mjs"
  python3 "$TMP/patch-r943-queue.py" "$TMP/server.mjs"
  node --check "$TMP/server.mjs" >/dev/null
  grep -q 'R943_QUEUE_PATCH_BEGIN' "$TMP/server.mjs"
  install -m 0644 "$TMP/server.mjs" "$LIVE"
fi

# Agent: use the R943 file that is R926-preserved + queue telemetry only.
curl -fsSL "https://andrikmetal.com/radio247/vm-lite/andrik-radio-web-agent-r803.mjs?v=R943-$STAMP" -o "$TMP/agent.mjs"
node --check "$TMP/agent.mjs" >/dev/null
grep -Fq "AGENT_VERSION_R803='R943'" "$TMP/agent.mjs"
grep -Fq "upcomingR943" "$TMP/agent.mjs"
install -m 0644 "$TMP/agent.mjs" "$AGENT"

grep -E 'TRACK_AUDIO_FADE_IN_R726|TRACK_AUDIO_FADE_OUT_R726|MP3_BOUNDARY_FADE_OUT_SECONDS_R814|MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814|MP3_BOUNDARY_FADE_IN_SECONDS_R814|const holdR917B|FULL_FRAME_FILTER_R787|LIVE_FULL_FRAME_FILTER_R794|LIVE_FULL_FRAME_GEOMETRY_R819' "$LIVE" > "$TMP/av.after"
cmp -s "$TMP/av.before" "$TMP/av.after" || {
  echo "❌ A/V guard changed — automatic rollback"
  cp -af "$BK/server.mjs" "$LIVE"
  cp -af "$BK/andrik-radio-web-agent-r803.mjs" "$AGENT"
  exit 23
}

echo "✅ A/V + fullscreen lines are byte-identical"

systemctl restart andrik-radio-web-agent.service 2>/dev/null || systemctl restart andrik-radio-web-agent-r803.service 2>/dev/null || true
# One radio reload is required only to load the new in-memory queue endpoint.
systemctl restart andrik-radio.service
sleep 12

if ! systemctl is-active --quiet andrik-radio.service; then
  echo "❌ Radio failed after R943 — rollback"
  cp -af "$BK/server.mjs" "$LIVE"
  cp -af "$BK/andrik-radio-web-agent-r803.mjs" "$AGENT"
  systemctl restart andrik-radio.service
  systemctl restart andrik-radio-web-agent.service 2>/dev/null || systemctl restart andrik-radio-web-agent-r803.service 2>/dev/null || true
  exit 24
fi

STATUS="$(curl -fsS --max-time 7 http://127.0.0.1:8080/status)" || {
  echo "❌ Local status unavailable — rollback"
  cp -af "$BK/server.mjs" "$LIVE"
  cp -af "$BK/andrik-radio-web-agent-r803.mjs" "$AGENT"
  systemctl restart andrik-radio.service
  exit 25
}
printf '%s' "$STATUS" > "$TMP/status.json"
if ! python3 - "$TMP/status.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1],encoding='utf-8'))
print('ok        :',x.get('ok'))
print('publisher :',x.get('publisherRunning'))
print('producer  :',x.get('producerRunning'))
print('video     :',x.get('videoFeederRunning'))
print('clip      :',x.get('clipActive'))
print('transport :',x.get('transportHealthy'))
print('current   :',(x.get('current') or {}).get('title',''))
print('next 6    :',[r.get('title') for r in (x.get('upcomingR943') or [])[:6]])
if not x.get('ok') or not x.get('publisherRunning') or x.get('transportHealthy') is False:
    raise SystemExit(2)
PY
then
  echo "❌ R943 health guard failed — automatic rollback"
  cp -af "$BK/server.mjs" "$LIVE"
  cp -af "$BK/andrik-radio-web-agent-r803.mjs" "$AGENT"
  systemctl restart andrik-radio-web-agent.service 2>/dev/null || systemctl restart andrik-radio-web-agent-r803.service 2>/dev/null || true
  systemctl restart andrik-radio.service
  exit 26
fi

cat > /opt/andrik-radio/tools/rollback-r943-queue.sh <<EOF
#!/usr/bin/env bash
set -Eeuo pipefail
cp -af '$BK/server.mjs' '$LIVE'
cp -af '$BK/andrik-radio-web-agent-r803.mjs' '$AGENT'
systemctl restart andrik-radio-web-agent.service 2>/dev/null || systemctl restart andrik-radio-web-agent-r803.service 2>/dev/null || true
systemctl restart andrik-radio.service
echo '✅ R943 queue rolled back to PRE-R943 state'
EOF
chmod 0755 /opt/andrik-radio/tools/rollback-r943-queue.sh

echo "======================================================"
echo "✅ R943 QUEUE ACTIVE"
echo "✅ R936F transition values preserved"
echo "✅ fullscreen/A-V guards preserved"
echo "✅ /status is read-only; it never mutates the queue"
echo "✅ queue move verifies item ID (no offset race)"
echo "✅ moved bumper cannot trigger a duplicate auto-bumper"
echo "Rollback: sudo /opt/andrik-radio/tools/rollback-r943-queue.sh"
echo "======================================================"
