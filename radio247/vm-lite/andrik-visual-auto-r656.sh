#!/usr/bin/env bash
set -Eeuo pipefail
ENV_FILE=/etc/andrik-radio.env
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
STATUS_URL=http://127.0.0.1:8080/status
STAMP=/run/andrik-visual-auto-r656.last
SERVICE=andrik-radio.service

# Explicit manual DAY/EVENING/NIGHT always wins until owner presses AUTO.
force=""
if [ -f "$ENV_FILE" ]; then
  force="$(sed -nE 's/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=[[:space:]]*(day|evening|night)[[:space:]]*$/\1/p' "$ENV_FILE" | tail -n1)"
fi
[ -n "$force" ] && exit 0

hour="$(TZ=Europe/Bratislava date +%H)"
hour=$((10#$hour))
if [ "$hour" -ge 8 ] && [ "$hour" -lt 17 ]; then
  desired=day
elif [ "$hour" -ge 17 ] && [ "$hour" -lt 22 ]; then
  desired=evening
else
  desired=night
fi

case "$desired" in
  day) visual="$VISUAL_DIR/stream-day-master-r620.mp4" ;;
  evening) visual="$VISUAL_DIR/stream-evening-master-r620.mp4" ;;
  night) visual="$VISUAL_DIR/stream-night-master-r620.mp4" ;;
esac

# Never switch into a missing/broken local master and never download from R2 here.
[ -s "$visual" ] || exit 0
size="$(stat -c%s "$visual" 2>/dev/null || echo 0)"
[ "$size" -ge 2000000 ] || exit 0

json="$(curl -fsS --max-time 4 "$STATUS_URL" 2>/dev/null || true)"
[ -n "$json" ] || exit 0
current="$(printf '%s' "$json" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const x=JSON.parse(s);process.stdout.write(String(x.visualPeriod||''))}catch{}})" 2>/dev/null || true)"
current="${current#manual-}"

[ "$current" = "$desired" ] && exit 0
systemctl is-active --quiet "$SERVICE" || exit 0

# Anti-loop: a failed switch may retry, but never hammer the live stream every minute.
now="$(date +%s)"
last=0
[ -f "$STAMP" ] && last="$(cat "$STAMP" 2>/dev/null || echo 0)"
case "$last" in (*[!0-9]*|'') last=0;; esac
if [ $((now-last)) -lt 600 ]; then exit 0; fi
printf '%s\n' "$now" > "$STAMP"

logger -t andrik-visual-auto-r656 "AUTO visual switch: ${current:-unknown} -> $desired"
systemctl restart "$SERVICE"
