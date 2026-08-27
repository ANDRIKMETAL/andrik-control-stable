#!/usr/bin/env bash
set -Eeuo pipefail
ENV_FILE=/etc/andrik-radio.env
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
STATUS_URL=http://127.0.0.1:8080/status
STAMP=/run/andrik-visual-auto-r703.last
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
SERVICE=andrik-radio.service
MODE="${1:-timer}"

# Manual selection pauses automatic switching until AUTO is pressed.
if [ -f "$MANUAL_MARKER" ] && [ "$MODE" != "force" ]; then exit 0; fi

hour="$(TZ=Europe/Bratislava date +%H)"; hour=$((10#$hour))
if [ "$hour" -ge 6 ] && [ "$hour" -lt 12 ]; then desired=morning
elif [ "$hour" -ge 12 ] && [ "$hour" -lt 18 ]; then desired=day
elif [ "$hour" -ge 18 ]; then desired=evening
else desired=night
fi

visual_for(){
  case "$1" in
    morning) printf '%s\n' "$VISUAL_DIR/stream-morning-master-r703.mp4" ;;
    day) printf '%s\n' "$VISUAL_DIR/stream-day-master-r620.mp4" ;;
    evening) printf '%s\n' "$VISUAL_DIR/stream-evening-master-r620.mp4" ;;
    night) printf '%s\n' "$VISUAL_DIR/stream-night-master-r620.mp4" ;;
  esac
}
valid_visual(){ [ -s "$1" ] && [ "$(stat -c%s "$1" 2>/dev/null || echo 0)" -ge 2000000 ]; }

# Safe rollout: before MORNING is uploaded, 06:00-12:00 uses the proven DAY visual.
effective="$desired"
visual="$(visual_for "$effective")"
if ! valid_visual "$visual"; then
  if [ "$desired" = morning ]; then
    effective=day
    visual="$(visual_for day)"
  fi
fi
# If another slot is ever missing, retain a known-good available master instead of breaking radio.
if ! valid_visual "$visual"; then
  for candidate in day evening night morning; do
    candidate_visual="$(visual_for "$candidate")"
    if valid_visual "$candidate_visual"; then effective="$candidate"; visual="$candidate_visual"; break; fi
  done
fi
valid_visual "$visual" || exit 0

mkdir -p "$VISUAL_DIR"; touch "$ENV_FILE"
sed -i '/^[[:space:]]*VISUAL_AUTO_SCHEDULE_R658[[:space:]]*=/d' "$ENV_FILE"
printf 'VISUAL_AUTO_SCHEDULE_R658=1\n' >> "$ENV_FILE"
current_force="$(sed -nE 's/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=[[:space:]]*(morning|day|evening|night)[[:space:]]*$/\1/p' "$ENV_FILE" | tail -n1)"
json="$(curl -fsS --max-time 4 "$STATUS_URL" 2>/dev/null || true)"
current_period="$(printf '%s' "$json" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{try{const x=JSON.parse(s);process.stdout.write(String(x.visualPeriod||''))}catch{}})" 2>/dev/null || true)"

need_restart=0
[ "$current_force" = "$effective" ] || need_restart=1
case "$current_period" in auto-$effective|manual-$effective|$effective) ;; *) need_restart=1 ;; esac
[ "$MODE" = force ] && need_restart=1
[ "$need_restart" -eq 0 ] && exit 0

if [ "$MODE" != force ]; then
  now="$(date +%s)"; last=0
  [ -f "$STAMP" ] && last="$(cat "$STAMP" 2>/dev/null || echo 0)"
  case "$last" in (*[!0-9]*|'') last=0;; esac
  if [ $((now-last)) -lt 120 ]; then exit 0; fi
  printf '%s\n' "$now" > "$STAMP"
fi

sed -i '/^[[:space:]]*FORCE_VISUAL_SLOT[[:space:]]*=/d' "$ENV_FILE"
printf 'FORCE_VISUAL_SLOT=%s\n' "$effective" >> "$ENV_FILE"
chmod 600 "$ENV_FILE" || true
if [ "$desired" = morning ] && [ "$effective" = day ]; then
  logger -t andrik-visual-auto-r703 'MORNING 06-12 not assigned yet -> temporary DAY fallback'
else
  logger -t andrik-visual-auto-r703 "AUTO 4-SLOT: ${current_period:-unknown} -> auto-$effective"
fi
systemctl restart "$SERVICE"
