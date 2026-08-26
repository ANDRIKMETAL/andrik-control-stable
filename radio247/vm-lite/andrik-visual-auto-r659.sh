#!/usr/bin/env bash
set -Eeuo pipefail
ENV_FILE=/etc/andrik-radio.env
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
STATUS_URL=http://127.0.0.1:8080/status
STAMP=/run/andrik-visual-auto-r659.last
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
SERVICE=andrik-radio.service
GUARD=/usr/local/sbin/andrik-fullscreen-guard-r659
MODE="${1:-timer}"

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

# Always enforce the R690 full-frame FIT transform BEFORE deciding/restarting.
"$GUARD" >/dev/null
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
if [ "$MODE" != "force" ]; then
  now="$(date +%s)"; last=0
  [ -f "$STAMP" ] && last="$(cat "$STAMP" 2>/dev/null || echo 0)"
  case "$last" in (*[!0-9]*|'') last=0;; esac
  if [ $((now-last)) -lt 300 ]; then exit 0; fi
  printf '%s\n' "$now" > "$STAMP"
fi
sed -i '/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=/d' "$ENV_FILE"
printf 'FORCE_VISUAL_SLOT=%s\n' "$desired" >> "$ENV_FILE"
chmod 600 "$ENV_FILE" || true
logger -t andrik-visual-auto-r659 "AUTO guarded-fit: ${current_period:-unknown} -> auto-$desired"
systemctl restart "$SERVICE"
