#!/usr/bin/env bash
set -Eeuo pipefail
BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
CACHE=/var/cache/andrik-radio-r622
VIS="$CACHE/visuals"
STAGE="$CACHE/r649-stage"
ENV=/etc/andrik-radio.env
PUBLIC_BASE='https://andrikmetal.com/api/media/radio-visual-r621'
SERVICE=andrik-radio.service

[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
command -v curl >/dev/null || { echo 'СТОП: curl не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }

echo '[1/5] Проверяю R649 и создаю staging...'
grep -q 'R649-R2-MASTERS-FULLBLEED-1080P-CONTINUOUS-AUDIO' "$SERVER"
node --check "$SERVER" >/dev/null
install -d -m 700 "$VIS" "$STAGE"

fetch_one(){
  local slot="$1" name="$2" tmp="$STAGE/$name.part" final="$STAGE/$name"
  rm -f "$tmp" "$final"
  echo "  ↓ R2 $slot"
  curl -fL --retry 6 --retry-delay 2 --retry-all-errors --connect-timeout 15 --max-time 300 \
    "$PUBLIC_BASE?slot=$slot&download=1" -o "$tmp"
  local size probe
  size="$(stat -c%s "$tmp" 2>/dev/null || echo 0)"
  [ "$size" -ge 2000000 ] || { echo "СТОП: $slot слишком маленький ($size bytes)"; exit 3; }
  probe="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,sample_aspect_ratio,display_aspect_ratio,avg_frame_rate -of default=nw=1 "$tmp" 2>/dev/null || true)"
  [ -n "$probe" ] || { echo "СТОП: $slot не проходит ffprobe"; exit 3; }
  printf '%s\n' "$probe" | sed 's/^/    /'
  mv -f "$tmp" "$final"
}

fetch_one day stream-day-master-r620.mp4
fetch_one evening stream-evening-master-r620.mp4
fetch_one night stream-night-master-r620.mp4

echo '[2/5] Три R2 master проверены. Ставлю в AWS cache...'
install -m 600 "$STAGE/stream-day-master-r620.mp4" "$VIS/stream-day-master-r620.mp4"
install -m 600 "$STAGE/stream-evening-master-r620.mp4" "$VIS/stream-evening-master-r620.mp4"
install -m 600 "$STAGE/stream-night-master-r620.mp4" "$VIS/stream-night-master-r620.mp4"

echo '[3/5] Переключаю только visual paths. Звук/битрейт/AAC не трогаю...'
python3 - <<'PY'
from pathlib import Path
p=Path('/etc/andrik-radio.env')
s=p.read_text() if p.exists() else ''
base='/var/cache/andrik-radio-r622/visuals'
updates={
'DAY_VISUAL':f'{base}/stream-day-master-r620.mp4',
'EVENING_VISUAL':f'{base}/stream-evening-master-r620.mp4',
'NIGHT_VISUAL':f'{base}/stream-night-master-r620.mp4',
'DAY_VISUAL_URL':f'{base}/stream-day-master-r620.mp4',
'EVENING_VISUAL_URL':f'{base}/stream-evening-master-r620.mp4',
'NIGHT_VISUAL_URL':f'{base}/stream-night-master-r620.mp4',
}
out=[]; seen=set()
for line in s.splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k=line.split('=',1)[0].strip()
        if k in updates:
            out.append(f'{k}={updates[k]}'); seen.add(k); continue
    out.append(line)
for k,v in updates.items():
    if k not in seen: out.append(f'{k}={v}')
p.write_text('\n'.join(out).rstrip()+'\n')
PY
chmod 600 "$ENV"

# Keep the permanent R646 QR guard if this machine has not installed it yet.
if [ -x "$BASE/radio247/vm-lite/andrik-ensure-qr-png-r646.sh" ]; then
  install -m 0755 "$BASE/radio247/vm-lite/andrik-ensure-qr-png-r646.sh" /usr/local/sbin/andrik-ensure-qr-png-r646
  install -d -m 755 /etc/systemd/system/andrik-radio.service.d
  cat >/etc/systemd/system/andrik-radio.service.d/r646-qr-guard.conf <<'EOF'
[Service]
ExecStartPre=/usr/local/sbin/andrik-ensure-qr-png-r646
EOF
  /usr/local/sbin/andrik-ensure-qr-png-r646 || true
fi

echo '[4/5] Один restart радио...'
systemctl daemon-reload
systemctl restart "$SERVICE"
sleep 10

echo '[5/5] Проверяю FULL SCREEN R2...'
status="$(curl -fsS --max-time 10 http://127.0.0.1:8080/status)"
printf '%s\n' "$status" | python3 -m json.tool
printf '%s' "$status" | grep -q 'R649-R2-MASTERS-FULLBLEED-1080P-CONTINUOUS-AUDIO'
printf '%s' "$status" | grep -q 'stream-.*-master-r620.mp4'
echo 'ГОТОВО ✅ R2 masters -> COVER+CROP -> 1920x1080 FULL SCREEN. NO PAD. AUDIO UNCHANGED.'
