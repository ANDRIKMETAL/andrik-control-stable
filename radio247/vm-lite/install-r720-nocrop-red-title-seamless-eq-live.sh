#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/assets"
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web-control.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
TMP_DIR="$(mktemp -d /tmp/andrik-r720.XXXXXX)"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
ENGINE_DROPIN="$DROPIN_DIR/r720-engine.conf"
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r715.mjs
FULLFIT_TARGET=/usr/local/sbin/andrik-radio-force-fullfit
AUTO_TARGET=/usr/local/sbin/andrik-visual-auto-r703
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/12] Загружаю R720: NO CROP + RED TITLE + PERFECT EQ LOOP + LIVE GUARD…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r720-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r715.mjs?v=55.00-r720-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-visual-auto-r703.sh?v=55.00-r720-$(date +%s)" -o "$TMP_DIR/auto.sh"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/force-full-fit-r720.sh?v=55.00-r720-$(date +%s)" -o "$TMP_DIR/fullfit.sh"
for p in morning day evening night; do
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
    "$SITE_BASE/assets/equalizer-${p}-r720.mov?v=55.00-r720-$(date +%s)" -o "$TMP_DIR/equalizer-${p}.mov"
done

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/auto.sh"
bash -n "$TMP_DIR/fullfit.sh"

echo '[2/12] Проверяю 4 exact-periodic EQ…'
for p in morning day evening night; do
  F="$TMP_DIR/equalizer-${p}.mov"
  [ "$(stat -c%s "$F")" -gt 100000 ] || { echo "СТОП: $p EQ слишком мал"; exit 3; }
  CODEC="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$F")"
  ALPHA="$(ffprobe -v error -select_streams v:0 -show_entries stream=pix_fmt -of default=nw=1:nk=1 "$F")"
  FRAMES="$(ffprobe -v error -select_streams v:0 -show_entries stream=nb_frames -of default=nw=1:nk=1 "$F")"
  [ "$CODEC" = qtrle ] || { echo "СТОП: $p EQ codec=$CODEC"; exit 3; }
  [ "$ALPHA" = argb ] || { echo "СТОП: $p EQ pix_fmt=$ALPHA"; exit 3; }
  [ "$FRAMES" = 100 ] || { echo "СТОП: $p EQ frames=$FRAMES"; exit 3; }
done

echo '[3/12] Проверяю постоянный NO CROP и оформление…'
grep -q 'R720-NOCROP-RED-TITLE-SEAMLESS-EQ-LIVE-GUARD' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R720'; exit 3; }
grep -q "scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos" "$TMP_DIR/server.mjs" || { echo 'СТОП: TRUE FIT отсутствует'; exit 3; }
grep -q "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black" "$TMP_DIR/server.mjs" || { echo 'СТОП: safe PAD отсутствует'; exit 3; }
if grep -q "force_original_aspect_ratio=increase\|'crop=1920:1080'" "$TMP_DIR/server.mjs"; then echo 'СТОП: найден жёсткий CROP/COVER'; exit 3; fi
grep -q "const insetCrop=''; // R720: absolute no-crop policy" "$TMP_DIR/server.mjs" || { echo 'СТОП: клипы могут снова crop-иться'; exit 3; }
grep -q "drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill" "$TMP_DIR/server.mjs" || { echo 'СТОП: красная линия отсутствует'; exit 3; }
grep -q "borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1" "$TMP_DIR/server.mjs" || { echo 'СТОП: красная обводка/тень title отсутствует'; exit 3; }
grep -q 'R720-EXACT-PERIODIC-QTRLE-4-SLOT-DIRECT' "$TMP_DIR/server.mjs" || { echo 'СТОП: R720 EQ engine отсутствует'; exit 3; }
grep -q "overlay=x=(W-w)/2:y=H-h-64" "$TMP_DIR/server.mjs" || { echo 'СТОП: EQ не под названием'; exit 3; }

echo '[4/12] Проверяю стабильный DIRECT YouTube transport…'
grep -q "VIDEO_BITRATE = '4500k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 4500k CBR'; exit 3; }
grep -q 'OUTPUT_TIMESHIFT_SECONDS = 6' "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 6s FIFO'; exit 3; }
grep -q "'-bufsize','9000k'" "$TMP_DIR/server.mjs" || { echo 'СТОП: потерян 9000k VBV'; exit 3; }
grep -q "'-f','fifo','-fifo_format','flv','-queue_size','8192'" "$TMP_DIR/server.mjs" || { echo 'СТОП: FIFO 8192 отсутствует'; exit 3; }
grep -q "'-drop_pkts_on_overflow','0'" "$TMP_DIR/server.mjs" || { echo 'СТОП: packets могут теряться'; exit 3; }
if grep -q "'-c:v','mjpeg'\|'pipe:4'\|showfreqs=s=" "$TMP_DIR/server.mjs"; then echo 'СТОП: вернулся тяжёлый pipeline'; exit 3; fi
grep -q "if(now-lastYoutubeEnsureAtR715<60000)return null" "$TMP_DIR/agent.mjs" || { echo 'СТОП: быстрый LIVE guard отсутствует'; exit 3; }

TS="$(date +%Y%m%d-%H%M%S)"
echo '[5/12] Резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r720-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r720-$TS" || true
mkdir -p "$ASSET_DIR" "$DROPIN_DIR" "$VISUAL_DIR"

echo '[6/12] Удаляю старый R659 guard, который мог переписывать масштаб после restart…'
systemctl disable --now andrik-visual-auto-r659.timer >/dev/null 2>&1 || true
rm -f "$DROPIN_DIR/20-fullscreen-guard-r659.conf" /usr/local/sbin/andrik-fullscreen-guard-r659

echo '[7/12] Ставлю R720 server + 4 EQ loops + safe fullfit helper…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
for p in morning day evening night; do install -m 0644 "$TMP_DIR/equalizer-${p}.mov" "$ASSET_DIR/equalizer-${p}-r720.mov"; done
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/auto.sh" "$AUTO_TARGET"
install -m 0755 "$TMP_DIR/fullfit.sh" "$FULLFIT_TARGET"
rm -f "$DROPIN_DIR"/r70{1,2,3,4,5,6,7,8,9}-engine.conf "$DROPIN_DIR"/r71{0,1,2,3,4,5,6,7,8,9}-engine.conf 2>/dev/null || true
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
Description=ANDRIK Radio Web Control Agent R715/R720 LIVE Guard
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

echo '[8/12] AUTO MORNING/DAY/EVENING/NIGHT сохраняю…'
cat >/etc/systemd/system/andrik-visual-auto-r703.service <<'UNIT'
[Unit]
Description=ANDRIK four visual cycles scheduler R703/R720
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

echo '[9/12] Перезапускаю agent + scheduler…'
systemctl daemon-reload
systemctl enable --now "$AGENT_SERVICE" >/dev/null
systemctl restart "$AGENT_SERVICE"
systemctl enable --now andrik-visual-auto-r703.timer >/dev/null
sleep 3
systemctl is-active --quiet "$AGENT_SERVICE" || { journalctl -u "$AGENT_SERVICE" -n 80 --no-pager || true; exit 4; }

echo '[10/12] Синхронизирую visual slots без замены защищённых masters…'
"$AGENT_TARGET" visual-sync || echo '⚠️ visual-sync можно повторить из панели.'
"$AGENT_TARGET" visual-auto || true

echo '[11/12] Чистый restart DIRECT encoder…'
systemctl restart "$SERVICE"
sleep 8

echo '[12/12] Проверяю R720…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R720-NOCROP-RED-TITLE-SEAMLESS-EQ-LIVE-GUARD'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("videoBitrate")=="4500k" and d.get("outputTimeshiftSeconds")==6 and d.get("equalizerEngine")=="R720-EXACT-PERIODIC-QTRLE-4-SLOT-DIRECT" else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || { echo 'R720 radio не поднялся.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 120 --no-pager || true; exit 5; }
printf '%s\n' "$STATUS" | python3 -m json.tool
[ ! -e "$DROPIN_DIR/20-fullscreen-guard-r659.conf" ] || { echo 'СТОП: R659 guard всё ещё существует'; exit 6; }

echo
echo '========================================================'
echo '✅ R720 ГОТОВ'
echo '✅ КАРТИНКА: TRUE FIT / NO CROP — весь исходный кадр виден'
echo '✅ 16:9 заполняет 1920x1080; нестандартное видео НЕ режется'
echo '✅ красная линия НАД названием возвращена'
echo '✅ белые буквы + КРАСНАЯ ОБВОДКА + чёрная тень возвращены'
echo '✅ EQ: 100 кадров / 4 сек / математически цикличный — без рывка на стыке'
echo '✅ EQ под названием; 4 варианта MORNING/DAY/EVENING/NIGHT'
echo '✅ старый R659 fullscreen guard удалён НАВСЕГДА'
echo '✅ YouTube LIVE self-heal: проверка ~60 сек, pending retry ~20 сек'
echo '✅ R715/R713 DIRECT transport + FIFO 8192 + 6s + 4500k сохранены'
echo '========================================================'
