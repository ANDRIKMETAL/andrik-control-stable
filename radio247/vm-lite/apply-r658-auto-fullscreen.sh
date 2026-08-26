#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
AGENT_SRC="$BASE/radio247/vm-lite/andrik-radio-web-agent-r650.mjs"
AUTO_SRC="$BASE/radio247/vm-lite/andrik-visual-auto-r658.sh"
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
ENV_FILE=/etc/andrik-radio.env

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
[ -s "$AGENT_SRC" ] || { echo "СТОП: нет $AGENT_SRC"; exit 3; }
[ -s "$AUTO_SRC" ] || { echo "СТОП: нет $AUTO_SRC"; exit 4; }
node --check "$SERVER" >/dev/null; node --check "$AGENT_SRC" >/dev/null; bash -n "$AUTO_SRC"

# R690 full-frame FIT transform. Preserve aspect ratio, never crop or stretch.
python3 - "$SERVER" <<'PY'
from pathlib import Path
import re, sys
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')
s=re.sub(r"^[ \t]*'crop=1920:1080',[ \t]*\n", "", s, flags=re.M)
s=re.sub(r"'scale=1920:1080(?::force_original_aspect_ratio=(?:increase|decrease))?:flags=[^']+',(?:\n[ \t]*'pad=1920:1080:[^']+',)?",
         "'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',\n    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',", s)
p.write_text(s,encoding='utf-8')
PY
node --check "$SERVER" >/dev/null
grep -q "force_original_aspect_ratio=decrease:flags=lanczos" "$SERVER" || { echo 'СТОП: FIT scale отсутствует'; exit 5; }
grep -q "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$SERVER" || { echo 'СТОП: FIT pad отсутствует'; exit 6; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$SERVER"; then echo 'СТОП: найден crop/cover'; exit 7; fi

mkdir -p "$VISUAL_DIR"; touch "$ENV_FILE"
sed -i '/^[[:space:]]*VISUAL_AUTO_SCHEDULE_R658[[:space:]]*=/d' "$ENV_FILE"
printf 'VISUAL_AUTO_SCHEDULE_R658=1\n' >> "$ENV_FILE"
printf 'R658 protected local DAY EVENING NIGHT\n' > "$VISUAL_DIR/.protect-local-visuals-r656"
printf 'R658 protected local DAY EVENING NIGHT\n' > "$VISUAL_DIR/.protect-local-visuals-r655"
rm -f "$VISUAL_DIR/.manual-visual-r658"
chmod 600 "$VISUAL_DIR/.protect-local-visuals-r656" "$VISUAL_DIR/.protect-local-visuals-r655" "$ENV_FILE" || true

install -m 755 "$AGENT_SRC" /usr/local/sbin/andrik-radio-web
install -m 755 "$AGENT_SRC" /usr/local/lib/andrik-radio-web-agent-r650.mjs
install -m 755 "$AUTO_SRC" /usr/local/sbin/andrik-visual-auto-r658

# Remove the previous watchdog so only one scheduler can ever touch the slot.
systemctl disable --now andrik-visual-auto-r656.timer >/dev/null 2>&1 || true
rm -f /etc/systemd/system/andrik-visual-auto-r656.timer /etc/systemd/system/andrik-visual-auto-r656.service
cat >/etc/systemd/system/andrik-visual-auto-r658.service <<'UNIT'
[Unit]
Description=ANDRIK exact fullscreen automatic visual switch R658
After=andrik-radio.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/andrik-visual-auto-r658 timer
UNIT
cat >/etc/systemd/system/andrik-visual-auto-r658.timer <<'UNIT'
[Unit]
Description=ANDRIK exact fullscreen DAY EVENING NIGHT watchdog R658
[Timer]
OnBootSec=40s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=andrik-visual-auto-r658.service
[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now andrik-visual-auto-r658.timer >/dev/null
systemctl restart andrik-radio-web-control.service

# Apply the same proven FORCE + full-frame FIT recipe immediately for the CURRENT period.
/usr/local/sbin/andrik-visual-auto-r658 force
sleep 8

echo 'R658 AUTO FULL-FRAME FIT ✅'
echo 'DAY 08:00–17:00 · EVENING 17:00–22:00 · NIGHT 22:00–08:00 · Europe/Bratislava'
echo 'Every time switch re-applies FIT 1920x1080 and the proper FORCE slot before restart.'
curl -fsS http://127.0.0.1:8080/status || true
echo
systemctl is-active andrik-visual-auto-r658.timer || true
