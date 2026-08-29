#!/usr/bin/env bash
set -Eeuo pipefail
[ "${EUID}" -eq 0 ] || { echo 'Запусти через sudo.'; exit 1; }

BASE=/opt/andrik-radio
SERVER="$BASE/radio247/server.mjs"
SERVICE=andrik-radio.service
SITE_BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
TMP="$(mktemp /tmp/andrik-r739.XXXXXX.mjs)"
BACKUP="${SERVER}.bak-before-r739-$(date +%Y%m%d-%H%M%S)"
trap 'rm -f "$TMP"' EXIT

for c in curl node python3 systemctl ffmpeg; do command -v "$c" >/dev/null || { echo "СТОП: $c не найден"; exit 2; }; done
[ -s "$SERVER" ] || { echo "СТОП: нет $SERVER"; exit 2; }

echo '[1/8] Скачиваю R739…'
curl -fsSL --retry 5 --retry-all-errors --connect-timeout 15 --max-time 120 \
  "$SITE_BASE/radio247/server.mjs?v=55.00-r739-$(date +%s)" -o "$TMP"

echo '[2/8] Проверяю R739 и НЕИЗМЕННЫЙ MP3 транспорт…'
node --check "$TMP" >/dev/null
grep -Fq "R739-AUDIO-CLOCK-TIMELINE-COMP-R738-PRESERVED" "$TMP" || { echo 'СТОП: скачался не R739'; exit 3; }
grep -Fq "VIDEO_INPUT_QUEUE_PACKETS_R732 = 1024" "$TMP" || { echo 'СТОП: video queue изменена'; exit 3; }
grep -Fq "AUDIO_INPUT_QUEUE_PACKETS_R732 = 8" "$TMP" || { echo 'СТОП: audio queue изменена'; exit 3; }
grep -Fq "VIDEO_FADE_LEAD_SECONDS_R735 = 3.80" "$TMP" || { echo 'СТОП: новый fade lead отсутствует'; exit 3; }
grep -Fq "TITLE_VISUAL_LEAD_SECONDS_R738 = 3.20" "$TMP" || { echo 'СТОП: title preload отсутствует'; exit 3; }
grep -Fq "VIDEO_TIMELINE_COMP_DEFAULT_R739" "$TMP" || { echo 'СТОП: runtime timeline compensation отсутствует'; exit 3; }
grep -Fq 'const titleReload=dynamicTitle?`:reload=1`' "$TMP" || { echo 'СТОП: CURRENT reload=1 отсутствует'; exit 3; }
grep -Fq "CLIP_PRE_DRAIN_MS_R738 = 900" "$TMP" || { echo 'СТОП: pre-drain отсутствует'; exit 3; }
grep -Fq "CLIP_POST_DRAIN_MS_R738 = 650" "$TMP" || { echo 'СТОП: post-drain отсутствует'; exit 3; }
grep -Fq 'aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS' "$TMP" || { echo 'СТОП: clip audio PTS lock отсутствует'; exit 3; }
grep -Fq '[0:v]setpts=PTS-STARTPTS' "$TMP" || { echo 'СТОП: clip video PTS lock отсутствует'; exit 3; }
grep -Fq "station insert skipped: audio stream missing" "$TMP" || { echo 'СТОП: silent-insert guard отсутствует'; exit 3; }
grep -Fq "color=c=black@1.0" "$TMP" || { echo 'СТОП: безопасная alpha-mask R737 потеряна'; exit 3; }
grep -Fq "predictedImmediateNextR736" "$TMP" || { echo 'СТОП: actual NEXT потерян'; exit 3; }
grep -Fq "R735-WALLCLOCK-SEEK-CONTINUITY" "$TMP" || { echo 'СТОП: visual continuity потеряна'; exit 3; }
grep -Fq "clipBoundaryReconnect:false" "$TMP" || { echo 'СТОП: ONE RTMPS guard потерян'; exit 3; }

echo '[3/8] Проверяю FFmpeg A/V PTS=0 схему…'
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i 'testsrc2=s=320x180:r=25:d=1.4' \
  -f lavfi -i 'sine=frequency=880:sample_rate=44100:duration=1.4' \
  -filter_complex '[0:v]setpts=PTS-STARTPTS[v];[1:a]aresample=44100:async=1:first_pts=0,asetpts=PTS-STARTPTS[a]' \
  -map '[v]' -map '[a]' -t 1 -f null - >/dev/null 2>&1 || { echo 'СТОП: FFmpeg A/V PTS test не прошёл'; exit 3; }

echo '[4/8] Проверяю безопасную alpha-mask…'
ffmpeg -hide_banner -loglevel error \
  -f lavfi -i 'color=c=white:s=320x180:r=25:d=3' \
  -filter_complex "color=c=black@1.0:s=320x180:r=25,format=yuva420p,fade=t=in:st=0.500:d=0.65:alpha=1,fade=t=out:st=1.200:d=0.30:alpha=1[blackmask];[0:v][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420[outv]" \
  -map '[outv]' -t 2.5 -f null - >/dev/null 2>&1 || { echo 'СТОП: FFmpeg alpha-mask test не прошёл'; exit 3; }

echo '[5/8] Backup текущего двигателя…'
cp -a "$SERVER" "$BACKUP"

rollback(){
  echo '⚠️ R739 не прошёл запуск — возвращаю предыдущий server.mjs…'
  cp -a "$BACKUP" "$SERVER"
  systemctl restart "$SERVICE" || true
  sleep 5
}

echo '[6/8] Устанавливаю R739. MP3 звук / 1024-8 / publisher НЕ меняются…'
install -m 0644 "$TMP" "$SERVER"

echo '[7/8] Один restart радио…'
if ! systemctl restart "$SERVICE"; then rollback; exit 4; fi
sleep 8
if ! systemctl is-active --quiet "$SERVICE"; then rollback; exit 4; fi

echo '[8/8] Проверяю status…'
STATUS=''; OK=0
for i in $(seq 1 25); do
  STATUS="$(curl -fsS --max-time 3 http://127.0.0.1:8080/status 2>/dev/null || true)"
  if printf '%s' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); ok=(d.get("version")=="R739-AUDIO-CLOCK-TIMELINE-COMP-R738-PRESERVED" and d.get("publisherRunning") and d.get("videoInputQueuePackets")==1024 and d.get("audioInputQueuePackets")==8 and d.get("videoFadeStrategy")=="SAFE_BLACK_ALPHA_MASK_EARLY_R738" and d.get("videoOverlayMask")=="BLACK_ALPHA_ONLY_R738" and abs(float(d.get("videoFadeLeadSeconds") or 0)-3.8)<0.01 and abs(float(d.get("titleVisualLeadSeconds") or 0)-3.2)<0.01 and d.get("clipAvSyncMode")=="PTS0+ARESAMPLE_ASYNC_FIRSTPTS0_R738" and d.get("clipPreDrainMs")==900 and d.get("clipPostDrainMs")==650 and d.get("stationInsertAudioRequired") is True and d.get("nextPreviewSource")=="ACTUAL_IMMEDIATE_ITEM_R738" and abs(float(d.get("videoTimelineCompensationSeconds") or 0)-8.0)<0.01 and d.get("videoTimelineCompensationMode")=="R739-RUNTIME-ADJUSTABLE"); raise SystemExit(0 if ok else 1)' 2>/dev/null; then
    OK=1
    break
  fi
  sleep 2
done
if [ "$OK" != 1 ]; then
  echo '❌ R739 status не подтвердился.'
  printf '%s\n' "$STATUS" | python3 -m json.tool 2>/dev/null || true
  rollback
  exit 5
fi

printf '%s\n' "$STATUS" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("VERSION:",d.get("version")); print("PUBLISHER:",d.get("publisherRunning")); print("PRODUCER:",d.get("producerRunning")); print("VIDEO QUEUE:",d.get("videoInputQueuePackets")); print("AUDIO QUEUE:",d.get("audioInputQueuePackets")); print("FADE LEAD:",d.get("videoFadeLeadSeconds")); print("TITLE LEAD:",d.get("titleVisualLeadSeconds")); print("TIMELINE COMP:",d.get("videoTimelineCompensationSeconds")); print("CLIP A/V:",d.get("clipAvSyncMode")); print("PRE-DRAIN:",d.get("clipPreDrainMs")); print("POST-DRAIN:",d.get("clipPostDrainMs")); print("INSERT AUDIO REQUIRED:",d.get("stationInsertAudioRequired")); print("NEXT:",d.get("nextPreviewSource"))'

echo
echo '========================================================'
echo '✅ R739 ГОТОВ'
echo '✅ MP3 транспорт сохранён: VIDEO 1024 / AUDIO 8'
echo '✅ SAFE fade/title/NEXT компенсируют stale-video tail: default 8.0s'
echo '✅ Offset можно менять БЕЗ рестарта: POST /control/timeline-offset?seconds=N'
echo '✅ CURRENT preload: 3.20s, reload каждый кадр'
echo '✅ КЛИПЫ: VIDEO PTS=0 + AUDIO PTS=0 + async first_pts=0'
echo '✅ Перед клипом/вставкой 900ms дренаж старого PCM при живом фоне'
echo '✅ После клипа 650ms дренаж хвоста перед следующим MP3'
echo '✅ Вставка без собственного audio stream НЕ выйдет в эфир молча'
echo '✅ NEXT = реальный MP3 / КЛИП / SPECIAL / BUMPER'
echo '✅ SAFE alpha-mask R737 + ONE RTMPS сохранены'
echo '========================================================'
