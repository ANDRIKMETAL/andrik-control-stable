#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP_DIR="$(mktemp -d /tmp/andrik-r719.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r719-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r715.mjs
FULLFIT_TARGET=/usr/local/sbin/andrik-radio-force-fullfit
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/11] Загружаю R719: FULLSCREEN + EQ ПОД НАЗВАНИЕМ + стабильный transport R715…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r719-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r715.mjs?v=55.00-r719-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r719-$(date +%s)" -o "$TMP_DIR/auto.sh"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/force-full-fit-r712.sh?v=55.00-r719-$(date +%s)" -o "$TMP_DIR/fullfit.sh"

for p in morning day evening night; do
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
    "$SITE_BASE/assets/equalizer-${p}-r719.mov?v=55.00-r719-$(date +%s)" -o "$TMP_DIR/equalizer-${p}.mov"
done

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"
bash -n "$TMP_DIR/fullfit.sh"

echo '[2/11] Проверяю 4 маленьких EQ-файла…'
for p in morning day evening night; do
  F="$TMP_DIR/equalizer-${p}.mov"
  [ "$(stat -c%s "$F")" -gt 50000 ] || { echo "СТОП: $p EQ слишком мал"; exit 3; }
  CODEC="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$F")"
  ALPHA="$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nw=1:nk=1 "$F")"
  [ "$CODEC" = "qtrle" ] || { echo "СТОП: $p EQ codec=$CODEC, нужен qtrle"; exit 3; }
  [ "$ALPHA" = "argb" ] || { echo "СТОП: $p EQ pix_fmt=$ALPHA, нужен argb"; exit 3; }
done

echo '[3/11] Проверяю, что YouTube transport НЕ откатился к R706…'
grep -q 'R719-SEAMLESS-EQ-LOOP-R718-PRESERVED' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R719'; exit 3; }
grep -q "VIDEO_BITRATE = '4500k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 4500k CBR'; exit 3; }
grep -q 'OUTPUT_TIMESHIFT_SECONDS = 6' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 6s FIFO cushion'; exit 3; }
grep -q "'-bufsize','9000k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 9000k VBV'; exit 3; }
grep -q "'-f','fifo','-fifo_format','flv','-queue_size','8192'" "$TMP_DIR/server.mjs" || { echo 'СТОП: нет FIFO 8192'; exit 3; }
grep -q "'-drop_pkts_on_overflow','0'" "$TMP_DIR/server.mjs" || { echo 'СТОП: пакеты снова могут отбрасываться'; exit 3; }
grep -q "'-thread_queue_size','8192','-re','-stream_loop','-1','-i',visualPath" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян direct visual input'; exit 3; }

# ВАЖНО: старый R706 делал отдельный 1080p MJPEG producer. Именно его не возвращаем.
if grep -q "'-c:v','mjpeg'\|'pipe:4'\|normalVideoProducerArgs\|startNormalVisualProducer\|liveEqualizerFilterComplexR706" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: найден старый тяжёлый R706 MJPEG/GEQ pipeline — не ставлю.'
  exit 3
fi
# И не используем R715/R716 showfreqs: он у владельца оказался невидимым.
if grep -q "showfreqs=s=" "$TMP_DIR/server.mjs"; then
  echo 'СТОП: showfreqs снова найден — нужен pre-rendered R706 motion.'
  exit 3
fi

grep -q "R719-SEAMLESS-PERIODIC-QTRLE-4-SLOT-DIRECT" "$TMP_DIR/server.mjs" || { echo 'СТОП: R719 seamless EQ engine отсутствует'; exit 3; }
grep -q "'-thread_queue_size','64','-re','-stream_loop','-1','-i',eq.path" "$TMP_DIR/server.mjs" || { echo 'СТОП: tiny EQ input отсутствует'; exit 3; }
grep -q "overlay=x=(W-w)/2:y=H-h-64" "$TMP_DIR/server.mjs" || { echo 'СТОП: EQ не закреплён ПОД названием'; exit 3; }
grep -q "'scale=1920:1080:flags=lanczos'" "$TMP_DIR/server.mjs" || { echo 'СТОП: FULLSCREEN stretch отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=decrease\|pad=1920:1080" "$TMP_DIR/server.mjs"; then echo 'СТОП: вернулся FIT/PAD — картинка снова станет маленькой'; exit 3; fi
grep -q "state.visualInsetCrop=await detectInsetBlackFrameCrop(path)" "$TMP_DIR/server.mjs" || { echo 'СТОП: auto-crop чёрной рамки background отсутствует'; exit 3; }
grep -q "cropdetect=limit=24:round=2:reset=0" "$TMP_DIR/server.mjs" || { echo 'СТОП: black-inset detector threshold отсутствует'; exit 3; }
grep -q "'-map','\\[outv\\]','-map','2:a:0'" "$TMP_DIR/server.mjs" || { echo 'СТОП: звук перестал идти напрямую'; exit 3; }
grep -q "const insetCrop=await detectInsetBlackFrameCrop(clipPath).catch(()=> ''); // R719 SAFE BLACK-INSET ONLY" "$TMP_DIR/server.mjs" || { echo 'СТОП: safe inset crop для клипов не закреплён'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then echo 'СТОП: найден жёсткий crop/cover'; exit 3; fi
if grep -q "drawbox=x=92:y=ih-208\|drawbox=x=125:y=ih-208\|fontcolor=red@0.01" "$TMP_DIR/server.mjs"; then echo 'СТОП: вернулась красная линия/подложка'; exit 3; fi
grep -q "clean-\${process.pid}-\${Date.now()}-\${attempt}.mp3" "$TMP_DIR/server.mjs" || { echo 'СТОП: MP3 hotfix потерян'; exit 3; }
grep -q "'-f','mp3',cleanTmp" "$TMP_DIR/server.mjs" || { echo 'СТОП: MP3 format guard потерян'; exit 3; }
grep -q "version:'R715'" "$TMP_DIR/agent.mjs" || { echo 'СТОП: agent не R715'; exit 3; }
grep -q '/api/radio-agent-r715/youtube-ensure' "$TMP_DIR/agent.mjs" || { echo 'СТОП: AUTO LIVE self-heal отсутствует'; exit 3; }

TS="$(date +%Y%m%d-%H%M%S)"
echo '[4/11] Резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r719-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r719-$TS" || true
mkdir -p "$ASSET_DIR" "$DROPIN_DIR" "$VISUAL_DIR"
for p in morning day evening night; do
  [ -s "$ASSET_DIR/equalizer-${p}-r719.mov" ] && cp -a "$ASSET_DIR/equalizer-${p}-r719.mov" "$ASSET_DIR/equalizer-${p}-r719.mov.bak-$TS" || true
done

echo '[5/11] Ставлю server + 4 EQ loops…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
for p in morning day evening night; do
  install -m 0644 "$TMP_DIR/equalizer-${p}.mov" "$ASSET_DIR/equalizer-${p}-r719.mov"
done
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
install -m 0755 "$TMP_DIR/fullfit.sh" "$FULLFIT_TARGET"

rm -f "$DROPIN_DIR"/r70{1,2,3,4,5,6,7,8,9}-engine.conf "$DROPIN_DIR"/r71{0,1,2,3,4,5,6,7}-engine.conf 2>/dev/null || true
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

echo '[6/11] AUTO MORNING/DAY/EVENING/NIGHT сохраняю…'
cat >/etc/systemd/system/andrik-visual-auto-r703.service <<'UNIT'
[Unit]
Description=ANDRIK four visual cycles scheduler R703/R719
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

echo '[7/11] Agent R715 AUTO LIVE…'
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

echo '[8/11] Синхронизирую 4 visual slots…'
"$AGENT_TARGET" visual-sync || echo '⚠️ visual-sync можно повторить из панели; текущие masters сохранены.'
"$AGENT_TARGET" visual-auto || true

echo '[9/11] Чистый restart DIRECT encoder…'
systemctl restart "$SERVICE"
sleep 8

echo '[10/11] Проверяю R719 + стабильный YouTube transport…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R719-SEAMLESS-EQ-LOOP-R718-PRESERVED'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("videoBitrate")=="4500k" and d.get("outputTimeshiftSeconds")==6 and d.get("engine")=="R678-R695-DIRECT-FFMPEG" and d.get("equalizerEngine")=="R719-SEAMLESS-PERIODIC-QTRLE-4-SLOT-DIRECT" else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || {
  echo 'R719 radio не поднялся как stable DIRECT.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  journalctl -u "$SERVICE" -n 120 --no-pager || true
  exit 5
}
printf '%s\n' "$STATUS" | python3 -m json.tool

echo '[11/11] Проверяю, что старый тяжёлый MJPEG pipeline не запущен…'
PID="$(systemctl show -p MainPID --value "$SERVICE" || true)"
if [ -n "$PID" ] && [ "$PID" != "0" ]; then
  pstree -ap "$PID" 2>/dev/null | tail -30 || true
fi
sleep 6
journalctl -u "$AGENT_SERVICE" -n 20 --no-pager | tail -20 || true

echo
echo '======================================================'
echo '✅ R719 ГОТОВ'
echo '✅ ДВИЖЕНИЕ EQ взято из рабочего R706'
echo '✅ старый тяжёлый R706 MJPEG/GEQ producer НЕ возвращён'
echo '✅ R715/R713 DIRECT YouTube transport сохранён'
echo '✅ 1080p25 · 4500k CBR · 9000k VBV · GOP 50'
echo '✅ FIFO 8192 · timeshift 6 s · drop_pkts_on_overflow=0'
echo '✅ EQ — только крошечный локальный прозрачный loop; звук не трогаем'
echo '✅ УТРО gold · ДЕНЬ steel · ВЕЧЕР amber · НОЧЬ blue'
echo '✅ EQ закреплён ПОД названием, между названием и бегущей строкой'
echo '✅ MP3 hotfix 234 + R2 клипы/delete + FULLSCREEN + AUTO LIVE сохранены'
echo '✅ Встроенные чёрные рамки master-видео определяются безопасным symmetric cropdetect'
echo '✅ После рамки изображение растягивается ровно в 1920x1080'
echo '======================================================'
