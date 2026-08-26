#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ENV_FILE=/etc/andrik-radio.env
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
STATUS_URL=http://127.0.0.1:8080/status
STAMP=/run/andrik-visual-auto-r658.last
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
SERVICE=andrik-radio.service
MODE="${1:-timer}"

# Explicit manual selection from the web panel pauses the schedule until AUTO is pressed.
if [ -f "$MANUAL_MARKER" ] && [ "$MODE" != "force" ]; then exit 0; fi

hour="$(TZ=Europe/Bratislava date +%H)"; hour=$((10#$hour))
if [ "$hour" -ge 8 ] && [ "$hour" -lt 17 ]; then desired=day
elif [ "$hour" -ge 17 ] && [ "$hour" -lt 22 ]; then desired=evening
else desired=night
fi

case "$desired" in
  day) visual="$VISUAL_DIR/stream-day-master-r620.mp4" ;;
  evening) visual="$VISUAL_DIR/stream-evening-master-r620.mp4" ;;
  night) visual="$VISUAL_DIR/stream-night-master-r620.mp4" ;;
esac
[ -s "$visual" ] || exit 0
size="$(stat -c%s "$visual" 2>/dev/null || echo 0)"; [ "$size" -ge 2000000 ] || exit 0

# R690: enforce full-frame FIT on every scheduled switch.
# Source aspect ratio is preserved; no crop and no stretch. Non-16:9 material is padded.
python3 - "$SERVER" <<'PY'
from pathlib import Path
import re, sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
# Remove legacy crop/cover/direct-stretch variants around the 1080 transform.
s=re.sub(r"^[ \t]*'crop=1920:1080',[ \t]*\n", "", s, flags=re.M)
s=re.sub(r"'scale=1920:1080(?::force_original_aspect_ratio=(?:increase|decrease))?:flags=[^']+',(?:\n[ \t]*'pad=1920:1080:[^']+',)?",
         "'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',\n    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',", s)
if "'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos'," not in s:
    raise SystemExit('R690 FIT scale not found')
if "'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black'," not in s:
    raise SystemExit('R690 FIT pad not found')
if 'force_original_aspect_ratio=increase' in s or "'crop=1920:1080'" in s:
    raise SystemExit('R690: legacy crop/cover still present')
p.write_text(s,encoding='utf-8')
PY
node --check "$SERVER" >/dev/null
grep -q "force_original_aspect_ratio=decrease:flags=lanczos" "$SERVER" || exit 0
grep -q "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$SERVER" || exit 0
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$SERVER"; then exit 0; fi

mkdir -p "$VISUAL_DIR"; touch "$ENV_FILE"
sed -i '/^[[:space:]]*VISUAL_AUTO_SCHEDULE_R658[[:space:]]*=/d' "$ENV_FILE"
printf 'VISUAL_AUTO_SCHEDULE_R658=1\n' >> "$ENV_FILE"
current_force="$(sed -nE 's/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=[[:space:]]*(day|evening|night)[[:space:]]*$/\1/p' "$ENV_FILE" | tail -n1)"
json="$(curl -fsS --max-time 4 "$STATUS_URL" 2>/dev/null || true)"
current_period="$(printf '%s' "$json" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const x=JSON.parse(s);process.stdout.write(String(x.visualPeriod||''))}catch{}})" 2>/dev/null || true)"

need_restart=0
[ "$current_force" = "$desired" ] || need_restart=1
[ "$current_period" = "auto-$desired" ] || need_restart=1
[ "$MODE" = "force" ] && need_restart=1
[ "$need_restart" -eq 0 ] && exit 0

# Anti-loop only for timer retries; force mode is an explicit owner/apply action.
if [ "$MODE" != "force" ]; then
  now="$(date +%s)"; last=0
  [ -f "$STAMP" ] && last="$(cat "$STAMP" 2>/dev/null || echo 0)"
  case "$last" in (*[!0-9]*|'') last=0;; esac
  if [ $((now-last)) -lt 300 ]; then exit 0; fi
  printf '%s\n' "$now" > "$STAMP"
fi

# Same proven FORCE_VISUAL_SLOT logic as the user's working DAY command, but the slot
# is selected automatically from Bratislava time.
sed -i '/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=/d' "$ENV_FILE"
printf 'FORCE_VISUAL_SLOT=%s\n' "$desired" >> "$ENV_FILE"
chmod 600 "$ENV_FILE" || true
logger -t andrik-visual-auto-r658 "AUTO full-frame-fit: ${current_period:-unknown} -> auto-$desired"
systemctl restart "$SERVICE"
