#!/usr/bin/env bash

BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
SERVER="/opt/andrik-radio/radio247/server.mjs"
ASSETS="/opt/andrik-radio/assets"
LIKE="$ASSETS/like-small-r907-96.png"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${SERVER}.before-R907-LIKE-${STAMP}.bak"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "===================================================="
echo " ANDRIK R907 · SMALL TRANSPARENT LIKE OVERLAY"
echo "===================================================="

if [ ! -f "$SERVER" ]; then
  echo "❌ server.mjs not found: $SERVER"
  exit 20
fi

cp -a "$SERVER" "$BACKUP"
echo "✅ BACKUP=$BACKUP"

mkdir -p "$ASSETS"

curl -fL --retry 4 --retry-delay 2 \
  "$BASE/assets/like-small-r907-96.png?v=55.00-r907" \
  -o "$TMP/like-small-r907-96.png"

python3 - "$TMP/like-small-r907-96.png" <<'PY'
import os,struct,sys
p=sys.argv[1]
b=open(p,'rb').read(33)
assert b[:8]==b'\x89PNG\r\n\x1a\n','LIKE is not PNG'
assert b[12:16]==b'IHDR','PNG IHDR missing'
w,h,bit_depth,color_type=struct.unpack('>IIBB',b[16:26])
assert (w,h)==(96,96),f'Unexpected LIKE size: {(w,h)}'
assert color_type in (4,6),f'LIKE PNG has no alpha channel (color type {color_type})'
assert os.path.getsize(p)>2500,'LIKE PNG too small'
print('✅ LIKE asset: 96x96 transparent')
PY

install -m 644 "$TMP/like-small-r907-96.png" "$LIKE"

python3 - "$SERVER" <<'PY'
from pathlib import Path
import sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
orig=s

if 'R907_SMALL_LIKE_OVERLAY' in s:
    print('✅ R907 already present; keeping existing code')
    raise SystemExit(0)

# Use the new transparent 96px asset for LIKE only.
s=s.replace("new URL('../assets/like-right-r794-420.png', import.meta.url).pathname; // R798 pixel-identical 420px replacement",
            "new URL('../assets/like-small-r907-96.png', import.meta.url).pathname; // R907_SMALL_LIKE_OVERLAY transparent 96px")
s=s.replace("new URL('../assets/like-right-r794-420.png', import.meta.url).pathname;",
            "new URL('../assets/like-small-r907-96.png', import.meta.url).pathname; // R907_SMALL_LIKE_OVERLAY")

anchor="const CTA_RIGHT_GAP_R767 = 34; // R767: right side; old left CTA removed"
insert="""const CTA_RIGHT_GAP_R767 = 34; // R767: right side; old left CTA removed
const CTA_LIKE_SIZE_R907 = 96; // R907_SMALL_LIKE_OVERLAY
const CTA_LIKE_RIGHT_GAP_R907 = 120; // center LIKE on the right speaker
const CTA_LIKE_BOTTOM_GAP_R907 = 128; // above ticker, viewer-marked position"""
if anchor not in s:
    raise SystemExit('❌ CTA right-gap anchor not found — NOTHING CHANGED')
s=s.replace(anchor,insert,1)

old="""        let out=`;[${inputIndex}:v]scale=420:-1:flags=lanczos,fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src]`;"""
new="""        const sourceWidthR907=kind==='like'?CTA_LIKE_SIZE_R907:420;
        let out=`;[${inputIndex}:v]scale=${sourceWidthR907}:-1:flags=lanczos,fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src]`;"""
if old not in s:
    raise SystemExit('❌ prepared CTA scale anchor not found — NOTHING CHANGED')
s=s.replace(old,new,1)

old="""        graph+=`;[${baseLabel}][pctaf${i}]overlay=x=W-w-${CTA_RIGHT_GAP_R767}:y=H-h-${CTA_BOTTOM_GAP_R748}:shortest=0:eval=init:format=yuv420[${out}]`;"""
new="""        const rightGapR907=w.kind==='like'?CTA_LIKE_RIGHT_GAP_R907:CTA_RIGHT_GAP_R767;
        const bottomGapR907=w.kind==='like'?CTA_LIKE_BOTTOM_GAP_R907:CTA_BOTTOM_GAP_R748;
        graph+=`;[${baseLabel}][pctaf${i}]overlay=x=W-w-${rightGapR907}:y=H-h-${bottomGapR907}:shortest=0:eval=init:format=yuv420[${out}]`;"""
if old not in s:
    raise SystemExit('❌ prepared CTA overlay anchor not found — NOTHING CHANGED')
s=s.replace(old,new,1)

old="""    pre+=`[${inputIndex}:v]fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src];`;"""
new="""    const sourceWidthR907=kind==='like'?CTA_LIKE_SIZE_R907:420;
    pre+=`[${inputIndex}:v]scale=${sourceWidthR907}:-1:flags=lanczos,fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src];`;"""
if old not in s:
    raise SystemExit('❌ live CTA scale anchor not found — NOTHING CHANGED')
s=s.replace(old,new,1)

old="""    chain+=`[${base}][ctaf${i}]overlay=x=W-w-${CTA_RIGHT_GAP_R767}:y=H-h-${CTA_BOTTOM_GAP_R748}:shortest=0:eval=init:format=yuv420[${out}];`;"""
new="""    const rightGapR907=w.kind==='like'?CTA_LIKE_RIGHT_GAP_R907:CTA_RIGHT_GAP_R767;
    const bottomGapR907=w.kind==='like'?CTA_LIKE_BOTTOM_GAP_R907:CTA_BOTTOM_GAP_R748;
    chain+=`[${base}][ctaf${i}]overlay=x=W-w-${rightGapR907}:y=H-h-${bottomGapR907}:shortest=0:eval=init:format=yuv420[${out}];`;"""
if old not in s:
    raise SystemExit('❌ live CTA overlay anchor not found — NOTHING CHANGED')
s=s.replace(old,new,1)

s=s.replace("subscribeLikePosition:'bottom-right-above-ticker'",
            "subscribeLikePosition:'SUBSCRIBE bottom-right / LIKE R907 right-speaker 96px'")
s=s.replace("subscribeLikeSize:'420x140-approx'",
            "subscribeLikeSize:'SUBSCRIBE 420px / LIKE 96px transparent'")
s=s.replace("rightCtaMode:'R783-SUBSCRIBE-LIKE-420PX-BOTTOM-RIGHT-SMOOTH-ALTERNATING'",
            "rightCtaMode:'R907-SUBSCRIBE-420PX + LIKE-96PX-RIGHT-SPEAKER-SMOOTH-ALTERNATING'")

if s==orig:
    raise SystemExit('❌ no R907 changes applied')
p.write_text(s,encoding='utf-8')
print('✅ R907 code patched')
PY

if ! node --check "$SERVER"; then
  echo "❌ NODE CHECK FAILED — restoring backup"
  cp -a "$BACKUP" "$SERVER"
  exit 30
fi

echo "✅ Node syntax OK"
echo "✅ Subscribe cadence untouched"
echo "✅ LIKE cadence untouched: same alternating window"
echo "✅ LIKE = transparent 96x96"
echo "✅ LIKE position = right speaker"
echo "✅ ticker / fullscreen / MP3 gap / clip rotation untouched"

systemctl restart andrik-radio.service
sleep 12

echo
echo "=== HEALTH ==="
systemctl is-active andrik-radio.service
systemctl show andrik-radio.service -p MainPID -p NRestarts -p SubState

echo
echo "===================================================="
echo "✅ R907 SMALL LIKE INSTALLED"
echo "===================================================="
