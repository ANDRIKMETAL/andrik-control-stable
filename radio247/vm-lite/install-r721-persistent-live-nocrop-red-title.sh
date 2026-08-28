#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
ASSET_DIR="$BASE/radio247/assets"
DROPIN_DIR=/etc/systemd/system/andrik-radio.service.d
SERVICE=andrik-radio.service
AGENT_SERVICE=andrik-radio-web.service
AGENT_LIB=/usr/local/lib/andrik-radio-web-agent-r721.mjs
AGENT_TARGET=/usr/local/sbin/andrik-radio-web
FULLFIT_TARGET=/usr/local/sbin/andrik-radio-force-fullfit
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
TMP_DIR="$(mktemp -d /tmp/andrik-r721.XXXXXX)"
ENGINE_DROPIN="$DROPIN_DIR/r721-engine.conf"
VISUAL_DIR=/var/cache/andrik-radio-r622/visuals
MANUAL_MARKER="$VISUAL_DIR/.manual-visual-r658"
trap 'rm -rf "$TMP_DIR"' EXIT

for c in curl node ffmpeg ffprobe python3 systemctl; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/12] Загружаю R721: PERSISTENT LIVE + NO CROP + RED TITLE + SEAMLESS EQ…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r721-$(date +%s)" -o "$TMP_DIR/server.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/andrik-radio-web-agent-r721.mjs?v=55.00-r721-$(date +%s)" -o "$TMP_DIR/agent.mjs"
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/vm-lite/force-full-fit-r721.sh?v=55.00-r721-$(date +%s)" -o "$TMP_DIR/fullfit.sh"
for p in morning day evening night; do
  curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
    "$SITE_BASE/assets/equalizer-${p}-r720.mov?v=55.00-r721-$(date +%s)" -o "$TMP_DIR/equalizer-${p}.mov"
done

node --check "$TMP_DIR/server.mjs" >/dev/null
node --check "$TMP_DIR/agent.mjs" >/dev/null
bash -n "$TMP_DIR/fullfit.sh"

echo '[2/12] Проверяю SETTS и постоянный H264 relay…'
ffmpeg -hide_banner -h bsf=setts 2>&1 | grep -q 'Bit stream filter setts' || { echo 'СТОП: FFmpeg без setts bitstream filter'; exit 3; }
grep -q 'R721-PERSISTENT-LIVE-NOCROP-RED-TITLE-SEAMLESS-EQ' "$TMP_DIR/server.mjs" || { echo 'СТОП: server не R721'; exit 3; }
grep -q "'-f','h264','-i','pipe:4'" "$TMP_DIR/server.mjs" || { echo 'СТОП: persistent H264 input отсутствует'; exit 3; }
grep -q "setts=time_base=1/\${VIDEO_FPS}:pts=N:dts=N:duration=1" "$TMP_DIR/server.mjs" || { echo 'СТОП: monotonic SETTS отсутствует'; exit 3; }
grep -q "'-c:v','copy'" "$TMP_DIR/server.mjs" || { echo 'СТОП: relay stream-copy отсутствует'; exit 3; }
grep -q 'clipBoundaryReconnect:false' "$TMP_DIR/server.mjs" || { echo 'СТОП: clip reconnect guard отсутствует'; exit 3; }
python3 - "$TMP_DIR/server.mjs" <<'PY'
import sys
s=open(sys.argv[1],encoding='utf-8').read()
a=s.index('async function playVideoClipR691')
b=s.index('function decoderArgs',a)
clip=s[a:b]
assert 'STREAM_URL' not in clip, 'clip still opens RTMPS'
assert 'stopMasterForClip' not in s, 'old master-stop path remains'
assert "'-bf','0'" in s, 'B-frames must be disabled for exact packet timestamps'
PY

echo '[3/12] Проверяю NO CROP + оформление title…'
grep -q 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos' "$TMP_DIR/server.mjs" || { echo 'СТОП: TRUE FIT отсутствует'; exit 3; }
grep -q 'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black' "$TMP_DIR/server.mjs" || { echo 'СТОП: safe PAD отсутствует'; exit 3; }
if grep -q 'cropdetect\|force_original_aspect_ratio=increase\|crop=1920:1080' "$TMP_DIR/server.mjs"; then echo 'СТОП: найден CROP'; exit 3; fi
grep -q 'drawbox=x=0:y=ih-204:w=iw:h=88:color=black@0.38:t=fill' "$TMP_DIR/server.mjs" || { echo 'СТОП: полупрозрачная тень title отсутствует'; exit 3; }
grep -q 'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill' "$TMP_DIR/server.mjs" || { echo 'СТОП: красная линия отсутствует'; exit 3; }
grep -q 'borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1' "$TMP_DIR/server.mjs" || { echo 'СТОП: красная обводка title отсутствует'; exit 3; }

echo '[4/12] Проверяю 4 exact-periodic EQ…'
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
grep -q 'setpts=N/(\${VIDEO_FPS}\*TB)' "$TMP_DIR/server.mjs" || { echo 'СТОП: EQ continuous setpts отсутствует'; exit 3; }

echo '[5/12] Проверяю, что AUTO/visual/full-fit больше НЕ рестартят эфир…'
grep -q "localControlR721('/control/visual-auto')" "$TMP_DIR/agent.mjs" || { echo 'СТОП: visual-auto runtime API отсутствует'; exit 3; }
grep -q '/control/visual-now?slot=' "$TMP_DIR/agent.mjs" || { echo 'СТОП: visual-now runtime API отсутствует'; exit 3; }
grep -q "localControlR721('/control/full-fit')" "$TMP_DIR/agent.mjs" || { echo 'СТОП: full-fit runtime API отсутствует'; exit 3; }
python3 - "$TMP_DIR/agent.mjs" <<'PY'
import sys
s=open(sys.argv[1],encoding='utf-8').read()
a=s.index("if(action==='visual-now')")
b=s.index("return {ok:false,output:'Неизвестная команда",a)
assert "systemctl',['restart','andrik-radio.service'" not in s[a:b], 'visual controls still restart service'
PY

TS="$(date +%Y%m%d-%H%M%S)"
echo '[6/12] Делаю резервные копии…'
cp -a "$SERVER" "$SERVER.bak-r721-$TS"
[ -s "$AGENT_TARGET" ] && cp -a "$AGENT_TARGET" "$AGENT_TARGET.bak-r721-$TS" || true
mkdir -p "$ASSET_DIR" "$DROPIN_DIR" "$VISUAL_DIR"

echo '[7/12] Убираю старые fullscreen/scheduler guards…'
systemctl disable --now andrik-visual-auto-r656.timer andrik-visual-auto-r658.timer andrik-visual-auto-r659.timer andrik-visual-auto-r703.timer >/dev/null 2>&1 || true
rm -f "$DROPIN_DIR/20-fullscreen-guard-r659.conf" /usr/local/sbin/andrik-fullscreen-guard-r659
# R721 performs the four-period switch internally; no timer may restart the service behind its back.
rm -f /etc/systemd/system/andrik-visual-auto-r703.service /etc/systemd/system/andrik-visual-auto-r703.timer

echo '[8/12] Ставлю R721 engine + agent + EQ…'
install -m 0644 "$TMP_DIR/server.mjs" "$SERVER"
for p in morning day evening night; do install -m 0644 "$TMP_DIR/equalizer-${p}.mov" "$ASSET_DIR/equalizer-${p}-r720.mov"; done
install -m 0644 "$TMP_DIR/agent.mjs" "$AGENT_LIB"
install -m 0755 "$TMP_DIR/fullfit.sh" "$FULLFIT_TARGET"
rm -f "$DROPIN_DIR"/r70{1,2,3,4,5,6,7,8,9}-engine.conf "$DROPIN_DIR"/r71{0,1,2,3,4,5,6,7,8,9}-engine.conf "$DROPIN_DIR"/r720-engine.conf 2>/dev/null || true
cat > "$ENGINE_DROPIN" <<EOD
[Service]
ExecStart=
ExecStart=/usr/bin/node $SERVER
EOD
cat > "$AGENT_TARGET" <<'WRAP'
#!/usr/bin/env bash
exec /usr/bin/node /usr/local/lib/andrik-radio-web-agent-r721.mjs "$@"
WRAP
chmod 0755 "$AGENT_TARGET"
cat > "/etc/systemd/system/$AGENT_SERVICE" <<'UNIT'
[Unit]
Description=ANDRIK Radio Web Control Agent R721 LIVE Guard
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

echo '[9/12] Один установочный restart — после него переходы уже без reconnect…'
systemctl daemon-reload
systemctl enable --now "$AGENT_SERVICE" >/dev/null
systemctl restart "$AGENT_SERVICE"
systemctl restart "$SERVICE"
sleep 8
systemctl is-active --quiet "$SERVICE" || { journalctl -u "$SERVICE" -n 120 --no-pager || true; exit 4; }
systemctl is-active --quiet "$AGENT_SERVICE" || { journalctl -u "$AGENT_SERVICE" -n 80 --no-pager || true; exit 4; }

echo '[10/12] Синхронизирую R2 visuals и включаю AUTO БЕЗ restart…'
"$AGENT_TARGET" visual-sync || echo '⚠️ visual-sync можно повторить из панели.'
"$AGENT_TARGET" visual-auto || { echo 'СТОП: R721 visual-auto runtime switch failed'; exit 4; }
rm -f "$MANUAL_MARKER"
sleep 3

echo '[11/12] Проверяю persistent LIVE state…'
STATUS=''; OK=0
for i in $(seq 1 30); do
  sleep 2
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | grep -q 'R721-PERSISTENT-LIVE-NOCROP-RED-TITLE-SEAMLESS-EQ'; then
    if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); raise SystemExit(0 if d.get("publisherRunning") and d.get("videoFeederRunning") and d.get("clipBoundaryReconnect") is False and d.get("engine")=="R721-PERSISTENT-H264-RELAY-SETTS" and d.get("videoBitrate")=="4500k" and d.get("outputTimeshiftSeconds")==6 else 1)' 2>/dev/null; then OK=1; break; fi
  fi
done
[ "$OK" = 1 ] || { echo 'R721 radio не поднялся.'; printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true; journalctl -u "$SERVICE" -n 160 --no-pager || true; exit 5; }

START_CHECK="$(date --iso-8601=seconds)"
sleep 6
RECENT="$(journalctl -u "$SERVICE" --since '-15 seconds' --no-pager 2>/dev/null || true)"
if printf '%s' "$RECENT" | grep -qi 'non-monoton'; then
  echo 'СТОП: найден Non-monotonic DTS после установки R721'
  printf '%s\n' "$RECENT" | tail -n 80
  exit 6
fi

echo '[12/12] Финальный статус…'
printf '%s\n' "$STATUS" | python3 -m json.tool
[ ! -e "$DROPIN_DIR/20-fullscreen-guard-r659.conf" ] || { echo 'СТОП: R659 guard всё ещё существует'; exit 6; }
! systemctl is-enabled andrik-visual-auto-r703.timer >/dev/null 2>&1 || { echo 'СТОП: внешний R703 timer всё ещё включён'; exit 6; }

echo
echo '========================================================'
echo '✅ R721 ГОТОВ'
echo '✅ ONE RTMPS: MP3 → КЛИП → MP3 больше НЕ закрывает YouTube publisher'
echo '✅ H264 SETTS: PTS/DTS = точные 1/25 сек, без сброса между feeder-процессами'
echo '✅ AUTO MORNING/DAY/EVENING/NIGHT: внутренняя смена feeder, БЕЗ systemctl restart'
echo '✅ FULL FIT: 1920x1080, весь исходный кадр виден, CROP отсутствует'
echo '✅ красная линия НАД названием'
echo '✅ белый title + КРАСНАЯ обводка + ЧЁРНАЯ внешняя тень'
echo '✅ полупрозрачная чёрная подложка за названием'
echo '✅ EQ: 100 кадров / 4 сек + continuous setpts, 4 периода'
echo '✅ R659/R703 restart guards выключены'
echo '✅ YouTube LIVE self-heal ~60 сек сохранён'
echo '========================================================'
