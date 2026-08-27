#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r714.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r714-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r714.mjs
FULLFIT_TARGET=/usr/local/sbin/andrik-radio-force-fullfit
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/10] Загружаю R714: стабильный R713 DIRECT engine + 4 лёгких EQ + CLEAN TITLE…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r714-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r714.mjs?v=55.00-r714-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r714-$(date +%s)" -o "$TMP_DIR/auto.sh"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/force-full-fit-r712.sh?v=55.00-r714-$(date +%s)" -o "$TMP_DIR/fullfit.sh"
for p in morning day evening night; do
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
    "$SITE_BASE/assets/equalizer-${p}-r714.mov?v=55.00-r714-$(date +%s)" -o "$TMP_DIR/equalizer-${p}-r714.mov"
done

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"
bash -n "$TMP_DIR/fullfit.sh"
for p in morning day evening night; do
  [ -s "$TMP_DIR/equalizer-${p}-r714.mov" ] || { echo "СТОП: нет EQ $p"; exit 3; }
  ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,pix_fmt -of default=nw=1 "$TMP_DIR/equalizer-${p}-r714.mov" | grep -q 'codec_name=qtrle' || { echo "СТОП: EQ $p повреждён"; exit 3; }
done

echo '[2/10] Проверяю, что это НЕ R701/R702 MJPEG engine…'
grep -q 'R714-R713-STABLE-DIRECT-4-EQ-CLEAN-TITLE-R2' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R714'; exit 3; }
grep -q "VIDEO_BITRATE = '4500k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 4500k CBR'; exit 3; }
grep -q 'OUTPUT_TIMESHIFT_SECONDS = 6' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 6s FIFO cushion'; exit 3; }
grep -q "'-bufsize','9000k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 9000k VBV'; exit 3; }
grep -q "'-thread_queue_size','8192','-re','-stream_loop','-1','-i',visualPath" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет прямого R678 visual input'; exit 3; }
grep -q "'-f','fifo','-fifo_format','flv','-queue_size','8192'" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет старого стабильного FIFO'; exit 3; }
if grep -q "'-c:v','mjpeg'\|'pipe:4'\|normalVideoProducerArgs\|startNormalVisualProducer" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден новый MJPEG feeder — R714 должен быть прямым.'; exit 3
fi
grep -q "const insetCrop=''; // R714 NO CROP" "$TMP_DIR/server.mjs" || { echo 'СТОП: NO CROP не закреплён'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then echo 'СТОП: найден crop/cover'; exit 3; fi
grep -q "if(hour>=6 && hour<12)return 'morning'" "$TMP_DIR/server.mjs" || { echo 'СТОП: MORNING 06-12 отсутствует'; exit 3; }
grep -q 'ensureNextTrackReadyR712' "$TMP_DIR/server.mjs" || { echo 'СТОП: защита clip→MP3 отсутствует'; exit 3; }
grep -q "version:'R714'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не R714'; exit 3; }
grep -q "clean-\${process.pid}-\${Date.now()}-\${attempt}.mp3" "$TMP_DIR/server.mjs" || { echo 'СТОП: MP3 hotfix suffix отсутствует'; exit 3; }
grep -q "'-f','mp3',cleanTmp" "$TMP_DIR/server.mjs" || { echo 'СТОП: MP3 output format guard отсутствует'; exit 3; }
grep -q "R714-DIRECT-LIGHT-LOOP-4-PERIOD" "$TMP_DIR/server.mjs" || { echo 'СТОП: 4-period lightweight EQ отсутствует'; exit 3; }
grep -q "\[3:v\]format=argb\[eq\]" "$TMP_DIR/server.mjs" || { echo 'СТОП: lightweight EQ overlay отсутствует'; exit 3; }
if grep -q "drawbox=x=92:y=ih-208\|drawbox=x=125:y=ih-208\|fontcolor=red@0.01\|geq=" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найдена старая красная линия / подложка / тяжёлый GEQ'; exit 3
fi

TS="$(date +%Y%m%d-%H%M%S)"
echo '[3/10] Резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r714-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r714-$TS" || true
[ -s "$AUTO_TARGET" ] && cp -a "$AUTO_TARGET" "$AUTO_TARGET.bak-r714-$TS" || true

echo '[4/10] Ставлю прямой engine + R714 agent + FULL FIT helper…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
install -m 0755 "$TMP_DIR/fullfit.sh" "$FULLFIT_TARGET"
mkdir -p "$DROPIN_DIR" "$VISUAL_DIR" "$BASE/assets"
for p in morning day evening night; do install -m 0644 "$TMP_DIR/equalizer-${p}-r714.mov" "$BASE/assets/equalizer-${p}-r714.mov"; done
rm -f "$DROPIN_DIR"/r70{1,2,3,4,5,6,7,8,9}-engine.conf "$DROPIN_DIR"/r71{0,1,2,3}-engine.conf 2>/dev/null || true
cat > "$ENGINE_DROPIN" <<EOD
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOD

cat > "$AGENT_TARGET" <<'WRAP'
#!/usr/bin/env bash
exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r714.mjs "$@"
WRAP
chmod 0755 "$AGENT_TARGET"

cat > "/etc/systemd/system/$AGENT_SERVICE" <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R714
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
Description=ANDRIK four visual cycles scheduler R703/R714
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

echo '[6/10] Перезапускаю R714 agent…'
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
"$AGENT_TARGET" visual-sync || echo '⚠️ visual-sync можно повторить из панели; текущие локальные masters не удалены.'
"$AGENT_TARGET" visual-auto || true

echo '[8/10] Чистый restart: убираю старые MJPEG процессы и очереди…'
systemctl restart "$SERVICE"
sleep 7

# Kill only orphan ffmpeg processes whose parent no longer exists under the service is risky;
# systemd restart should already have cleaned the cgroup. We intentionally do not pkill globally.

echo '[9/10] Проверяю R714 DIRECT status…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R714-R713-STABLE-DIRECT-4-EQ-CLEAN-TITLE-R2'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("videoBitrate")=="4500k" and d.get("outputTimeshiftSeconds")==6 and d.get("engine")=="R678-R695-DIRECT-FFMPEG" and d.get("equalizerEngine")=="R714-DIRECT-LIGHT-LOOP-4-PERIOD" else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || {
  echo 'R714 radio не поднялся как DIRECT engine.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  journalctl -u "$SERVICE" -n 120 --no-pager || true
  exit 5
}
printf '%s\n' "$STATUS" | python3 -m json.tool

echo '[10/10] Проверяю, что в запущенном server нет MJPEG feeder…'
if grep -q "'-c:v','mjpeg'\|'pipe:4'\|normalVideoProducerArgs\|startNormalVisualProducer" "$SERVER"; then
  echo 'СТОП: после установки обнаружен MJPEG feeder'; exit 6
fi

echo
echo '======================================================'
echo '✅ R714 ГОТОВ · R678/R695 DIRECT YOUTUBE ENGINE'
echo '✅ Один видео-кодировщик вместо master + MJPEG feeder'
echo '✅ 1080p25 · 4500k CBR · 9000k VBV · GOP 50'
echo '✅ FIFO 8192 · timeshift 6 s · RTMPS recovery как в R678/R695'
echo '✅ MP3 + R2 клипы сохранены; перед клипом следующий MP3 уже локально'
echo '✅ 4 visual slots + R2 library/delete сохранены'
echo '✅ FULL FRAME FIT / NO CROP сохранён и есть аварийная кнопка'
echo '✅ 4 лёгких анимированных EQ: УТРО gold · ДЕНЬ steel · ВЕЧЕР amber · НОЧЬ blue'
echo '✅ Красная линия, полупрозрачная подложка и красный halo у названия удалены'
echo '✅ Сеть/битрейт/FIFO R713 НЕ ТРОНУТЫ'
echo '======================================================'
