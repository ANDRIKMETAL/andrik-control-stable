#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r715.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r715-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r715.mjs
FULLFIT_TARGET=/usr/local/sbin/andrik-radio-force-fullfit
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }
ffmpeg -hide_banner -filters 2>/dev/null | grep -q 'showfreqs' || { echo 'СТОП: FFmpeg без showfreqs'; exit 2; }

echo '[1/10] Загружаю R715: точный R713 transport + audio-reactive 4 EQ + AUTO LIVE…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r715-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r715.mjs?v=55.00-r715-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r715-$(date +%s)" -o "$TMP_DIR/auto.sh"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/force-full-fit-r712.sh?v=55.00-r715-$(date +%s)" -o "$TMP_DIR/fullfit.sh"

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"
bash -n "$TMP_DIR/fullfit.sh"

echo '[2/10] Проверяю стабильный DIRECT transport и отсутствие R714 extra-video EQ…'
grep -q 'R715-R713-STABLE-DIRECT-AUDIO-EQ-AUTO-LIVE-R2' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R715'; exit 3; }
grep -q "VIDEO_BITRATE = '4500k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 4500k CBR'; exit 3; }
grep -q 'OUTPUT_TIMESHIFT_SECONDS = 6' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 6s FIFO cushion'; exit 3; }
grep -q "'-bufsize','9000k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 9000k VBV'; exit 3; }
grep -q "'-thread_queue_size','8192','-re','-stream_loop','-1','-i',visualPath" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет прямого R678/R713 visual input'; exit 3; }
grep -q "'-f','fifo','-fifo_format','flv','-queue_size','8192'" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет стабильного FIFO'; exit 3; }
if grep -q "'-c:v','mjpeg'\|'pipe:4'\|normalVideoProducerArgs\|startNormalVisualProducer\|equalizer-.*r714.mov\|'-i',eq.path" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден MJPEG/extra-video EQ — R715 должен иметь только прямой video clock.'; exit 3
fi
grep -q "const insetCrop=''; // R715 NO CROP" "$TMP_DIR/server.mjs" || { echo 'СТОП: NO CROP не закреплён'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then echo 'СТОП: найден crop/cover'; exit 3; fi
grep -q 'R715-AUDIO-SHOWFREQS-NO-EXTRA-VIDEO-INPUT' "$TMP_DIR/server.mjs" || { echo 'СТОП: 4 audio EQ отсутствуют'; exit 3; }
grep -q 'showfreqs=s=1040x46' "$TMP_DIR/server.mjs" || { echo 'СТОП: showfreqs EQ отсутствует'; exit 3; }
grep -q '\[2:a\]asplit=2\[aout\]\[aeq\]' "$TMP_DIR/server.mjs" || { echo 'СТОП: EQ не использует существующий PCM'; exit 3; }
if grep -q "drawbox=x=92:y=ih-208\|drawbox=x=125:y=ih-208\|fontcolor=red@0.01" "$TMP_DIR/server.mjs"; then echo 'СТОП: вернулась красная линия/подложка'; exit 3; fi
grep -q "clean-\${process.pid}-\${Date.now()}-\${attempt}.mp3" "$TMP_DIR/server.mjs" || { echo 'СТОП: MP3 hotfix потерян'; exit 3; }
grep -q "'-f','mp3',cleanTmp" "$TMP_DIR/server.mjs" || { echo 'СТОП: MP3 format guard потерян'; exit 3; }
grep -q "version:'R715'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не R715'; exit 3; }
grep -q '/api/radio-agent-r715/youtube-ensure' "$TMP_DIR/agent.mjs" || { echo 'СТОП: AUTO LIVE self-heal отсутствует'; exit 3; }

TS="$(date +%Y%m%d-%H%M%S)"
echo '[3/10] Резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r715-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r715-$TS" || true
[ -s "$AUTO_TARGET" ] && cp -a "$AUTO_TARGET" "$AUTO_TARGET.bak-r715-$TS" || true

echo '[4/10] Ставлю R715 server + Agent R715…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
install -m 0755 "$TMP_DIR/fullfit.sh" "$FULLFIT_TARGET"
mkdir -p "$DROPIN_DIR" "$VISUAL_DIR"
rm -f "$DROPIN_DIR"/r70{1,2,3,4,5,6,7,8,9}-engine.conf "$DROPIN_DIR"/r71{0,1,2,3,4}-engine.conf 2>/dev/null || true
cat > "$ENGINE_DROPIN" <<EOD
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOD

cat > "$AGENT_TARGET" <<'WRAP'
#!/usr/bin/env bash
exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r715.mjs "$@"
WRAP
chmod 0755 "$AGENT_TARGET"

cat > "/etc/systemd/system/$AGENT_SERVICE" <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R715
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

echo '[5/10] Гарантирую AUTO MORNING/DAY/EVENING/NIGHT…'
cat >/etc/systemd/system/andrik-visual-auto-r703.service <<'UNIT'
[Unit]
Description=ANDRIK four visual cycles scheduler R703/R715
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

echo '[6/10] Перезапускаю Agent R715…'
systemctl daemon-reload
systemctl enable --now "$AGENT_SERVICE" >/dev/null
systemctl restart "$AGENT_SERVICE"
systemctl enable --now andrik-visual-auto-r703.timer >/dev/null
sleep 3
systemctl is-active --quiet "$AGENT_SERVICE" || {
  systemctl status "$AGENT_SERVICE" --no-pager -l || true
  journalctl -u "$AGENT_SERVICE" -n 80 --no-pager || true
  exit 4
}
"$AGENT_TARGET" status || true

echo '[7/10] Синхронизирую 4 visual slots…'
"$AGENT_TARGET" visual-sync || echo '⚠️ visual-sync можно повторить из панели; текущие masters сохранены.'
"$AGENT_TARGET" visual-auto || true

echo '[8/10] Чистый restart DIRECT encoder…'
systemctl restart "$SERVICE"
sleep 7

echo '[9/10] Проверяю R715 DIRECT status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R715-R713-STABLE-DIRECT-AUDIO-EQ-AUTO-LIVE-R2'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("videoBitrate")=="4500k" and d.get("outputTimeshiftSeconds")==6 and d.get("engine")=="R678-R695-DIRECT-FFMPEG" and d.get("equalizerEngine")=="R715-AUDIO-SHOWFREQS-NO-EXTRA-VIDEO-INPUT" else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || {
  echo 'R715 radio не поднялся как DIRECT engine.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  journalctl -u "$SERVICE" -n 120 --no-pager || true
  exit 5
}
printf '%s\n' "$STATUS" | python3 -m json.tool

echo '[10/10] AUTO LIVE self-heal…'
# Agent polls immediately after restart and then asks Control to restore an actual
# YouTube LIVE broadcast when the ingest is ACTIVE. Give it one short cycle.
sleep 8
journalctl -u "$AGENT_SERVICE" -n 20 --no-pager | tail -20 || true

echo
echo '======================================================'
echo '✅ R715 ГОТОВ · R713 STABLE DIRECT TRANSPORT'
echo '✅ 1080p25 · 4500k CBR · 9000k VBV · GOP 50'
echo '✅ FIFO 8192 · timeshift 6 s · НИКАКОГО extra video input для EQ'
echo '✅ 4 EQ из текущего аудио: УТРО gold · ДЕНЬ steel · ВЕЧЕР amber · НОЧЬ blue'
echo '✅ Красная линия и полупрозрачная подложка за названием удалены'
echo '✅ MP3 hotfix 234 + R2 клипы/delete + FULL FIT сохранены'
echo '✅ Agent R715 каждые 3 минуты восстанавливает реальный YouTube LIVE после обрыва'
echo '======================================================'
