#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r710.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r710-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r710.mjs
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

command -v curl >/dev/null || { echo 'СТОП: curl не найден'; exit 2; }
command -v node >/dev/null || { echo 'СТОП: node не найден'; exit 2; }
command -v ffmpeg >/dev/null || { echo 'СТОП: ffmpeg не найден'; exit 2; }
command -v ffprobe >/dev/null || { echo 'СТОП: ffprobe не найден'; exit 2; }
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/10] Загружаю R710 engine: YouTube stability + R2 delete + R709 visual library…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r710-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r710.mjs?v=55.00-r710-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r710-$(date +%s)" -o "$TMP_DIR/auto.sh"

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"
grep -q 'R710-YOUTUBE-STABILITY-R2-DELETE-R709-PRESERVED' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R710'; exit 3; }
grep -q 'AUDIO_INPUT_QUEUE_PACKETS = 16' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R707 bounded PCM queue'; exit 3; }
grep -q 'VIDEO_INPUT_QUEUE_PACKETS = 64' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет R710 bounded video queue'; exit 3; }
grep -q "VIDEO_BITRATE = '4000k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет R710 4 Mbps stability profile'; exit 3; }
grep -q 'OUTPUT_TIMESHIFT_SECONDS = 3' "$TMP_DIR/server.mjs" || { echo 'СТОП: нет R710 RTMPS jitter cushion'; exit 3; }
grep -q 'never announce the next MP3 before its PCM actually enters the master' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R707 exact-title handoff'; exit 3; }
grep -q "morning:'stream-morning-master-r703.mp4'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не знает MORNING'; exit 3; }
grep -q "version:'R710'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не R710'; exit 3; }
grep -q "if(hour>=6 && hour<12)return 'morning'" "$TMP_DIR/server.mjs" || { echo 'СТОП: MORNING 06-12 отсутствует'; exit 3; }
grep -q 'R706-GEQ-FRAME-ANIMATED' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R706 live EQ'; exit 3; }
grep -q 'ensureNextTrackReadyR702' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян R702 MP3/clip handoff'; exit 3; }
grep -q 'force_original_aspect_ratio=decrease' "$TMP_DIR/server.mjs" || { echo 'СТОП: AUTO FIT отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then echo 'СТОП: найден crop/cover'; exit 3; fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[2/10] Резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r710-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r710-$TS" || true
[ -s "$AUTO_TARGET" ] && cp -a "$AUTO_TARGET" "$AUTO_TARGET.bak-r710-$TS" || true

echo '[3/10] Ставлю R710 engine + настоящий .mjs agent…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
mkdir -p "$DROPIN_DIR" "$VISUAL_DIR"
rm -f "$DROPIN_DIR"/r70{2,3,4,5,6,7,8,9}-engine.conf 2>/dev/null || true
cat > "$ENGINE_DROPIN" <<EOF
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOF

# IMPORTANT: /usr/local/sbin/andrik-radio-web is intentionally a SHELL WRAPPER.
# Node 18 treats an extensionless JS file as CommonJS, so importing ESM there caused:
# "Cannot use import statement outside a module".
cat > "$AGENT_TARGET" <<'WRAP'
#!/usr/bin/env bash
exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r710.mjs "$@"
WRAP
chmod 0755 "$AGENT_TARGET"

echo '[4/10] Переписываю systemd agent unit без старого extensionless Node запуска…'
cat > "/etc/systemd/system/$AGENT_SERVICE" <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R710
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/sbin/andrik-radio-web daemon
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT

echo '[5/10] Гарантирую 4 периода AUTO…'
cat >/etc/systemd/system/andrik-visual-auto-r703.service <<'UNIT'
[Unit]
Description=ANDRIK four visual cycles scheduler R703/R710
After=andrik-radio.service
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/andrik-visual-auto-r703 timer
UNIT
cat >/etc/systemd/system/andrik-visual-auto-r703.timer <<'UNIT'
[Unit]
Description=ANDRIK MORNING DAY EVENING NIGHT scheduler
[Timer]
OnBootSec=40s
OnUnitActiveSec=60s
AccuracySec=10s
Persistent=true
Unit=andrik-visual-auto-r703.service
[Install]
WantedBy=timers.target
UNIT
systemctl disable --now andrik-visual-auto-r656.timer andrik-visual-auto-r658.timer andrik-visual-auto-r659.timer >/dev/null 2>&1 || true
rm -f "$MANUAL_MARKER"

echo '[6/10] Перезапускаю именно R710 agent и проверяю, что ESM реально стартует…'
systemctl daemon-reload
systemctl enable --now "$AGENT_SERVICE" >/dev/null
systemctl restart "$AGENT_SERVICE"
systemctl enable --now andrik-visual-auto-r703.timer >/dev/null
sleep 4
systemctl is-active --quiet "$AGENT_SERVICE" || {
  echo 'СТОП: R710 agent не поднялся.'
  systemctl status "$AGENT_SERVICE" --no-pager -l || true
  journalctl -u "$AGENT_SERVICE" -n 80 --no-pager || true
  exit 4
}
AGENT_OUT="$("$AGENT_TARGET" status 2>&1 || true)"
printf '%s\n' "$AGENT_OUT"
if printf '%s' "$AGENT_OUT" | grep -q 'Cannot use import statement outside a module'; then
  echo 'СТОП: ESM ошибка всё ещё есть'; exit 4
fi

echo '[7/10] Синхронизирую все 4 назначенных visual slots с OVH…'
if "$AGENT_TARGET" visual-sync; then
  echo '✅ Все 4 slot master синхронизированы с OVH.'
else
  echo '⚠️ visual-sync не подтвердился; назначения в R2 сохранены и можно повторить из панели.'
fi

echo '[8/10] Возвращаю AUTO 4 периода…'
"$AGENT_TARGET" visual-auto || true

echo '[9/10] Чистый restart сбрасывает старый PCM backlog и применяет R710…'
systemctl restart "$SERVICE"
sleep 7
"$AUTO_TARGET" force || true

echo '[10/10] Проверяю R710 + agent + MORNING + title sync…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R710-YOUTUBE-STABILITY-R2-DELETE-R709-PRESERVED'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("audioInputQueuePackets")==16 and d.get("videoInputQueuePackets")==64 and d.get("videoBitrate")=="4000k" and d.get("outputTimeshiftSeconds")==3 and d.get("equalizerEngine")=="R706-GEQ-FRAME-ANIMATED" else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || { echo 'R710 radio не стал healthy.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 100 --no-pager || true; exit 5; }
printf '%s\n' "$STATUS" | python3 -m json.tool

echo
echo '=== MORNING LOCAL FILE ==='
MORNING="$VISUAL_DIR/stream-morning-master-r703.mp4"
if [ -s "$MORNING" ]; then
  echo "✅ $(du -h "$MORNING" | awk '{print $1}') · $MORNING"
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,display_aspect_ratio -of default=nw=1 "$MORNING" || true
else
  echo '⚠️ MORNING master пока не появился локально — нажми «Назначить + сейчас» один раз; R710 agent уже исправлен.'
fi

echo
echo '============================================'
echo '✅ R710 ГОТОВ · YOUTUBE STABILITY + SAFE R2 DELETE'
echo '✅ YouTube ingest: 4 Mbps CBR + 3 s jitter cushion + bounded 64-frame video queue'
echo '✅ Local MJPEG feeder облегчен — меньше CPU/pipe pressure на OVH'
echo '✅ MORNING понимается: 06:00–12:00'
echo '✅ R709 MORNING/DAY/EVENING/NIGHT upload → R2 library → assign → OVH путь сохранён'
echo '✅ R707 exact-title sync сохранён'
echo '✅ R706 живой эквалайзер сохранён'
echo '✅ R702 MP3 ↔ CLIP handoff сохранён'
echo '✅ AUTO FIT / NO CROP сохранён'
echo '============================================'
