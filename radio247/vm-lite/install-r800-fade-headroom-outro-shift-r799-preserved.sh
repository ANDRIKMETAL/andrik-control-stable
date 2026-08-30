#!/usr/bin/env bash
set -Eeuo pipefail
FILE=/opt/andrik-radio/radio247/server.mjs
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP="${FILE}.bak-before-r800-${STAMP}"
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

[[ -f "$FILE" ]] || { echo "ERROR: $FILE not found"; exit 1; }
cp -a "$FILE" "$BACKUP"

# Fingerprint the YouTube publisher/transport region before the visual-only patch.
python3 - "$FILE" > /tmp/r800-transport-before.sha <<'PY'
from pathlib import Path
import hashlib,re,sys
s=Path(sys.argv[1]).read_text()
# Hash the persistent publisher + transport area; the patch below must not touch it.
parts=[]
for pat in [r'function h264EncoderArgsR721\(\).*?\n}', r'function startPublisher.*?\n}', r'rtmps://a\.rtmps\.youtube\.com.*?backup=1[^\n]*']:
 m=re.search(pat,s,re.S)
 if m: parts.append(m.group(0))
print(hashlib.sha256(('\n---\n'.join(parts)).encode()).hexdigest())
PY

python3 - "$FILE" "$TMP" <<'PY'
from pathlib import Path
import sys,re
src=Path(sys.argv[1]); dst=Path(sys.argv[2]); s=src.read_text()
# Require R799/R787 fade engine to be present. We do NOT alter it.
need=[
  'R799 FADE-ONLY RESTORE',
  'fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1',
  "finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]'"
]
for x in need:
    if x not in s:
        raise SystemExit('ERROR: expected R799 fade signature missing; nothing changed')
old="""  const outroStart=Math.max(0,d-NEXT_PREVIEW_SECONDS_R726);\n  const outroEnd=Math.max(outroStart+0.25,d-NEXT_PREVIEW_HIDE_BEFORE_END_R726);"""
new="""  // R800 FADE-HEADROOM: PREVIOUS/NEXT ends before the fade CPU window.\n  const outroStart=Math.max(0,d-12.0);\n  const outroEnd=Math.max(outroStart+0.25,d-4.0);"""
if old in s:
    s=s.replace(old,new,1)
elif 'const outroStart=Math.max(0,d-12.0);' in s and 'const outroEnd=Math.max(outroStart+0.25,d-4.0);' in s:
    pass
else:
    raise SystemExit('ERROR: preview timing block not found; nothing changed')
s=s.replace("version: 'R799-FADE-ONLY-R787-RESTORE-R798-PRESERVED'","version: 'R800-FADE-HEADROOM-OUTRO-SHIFT-R799-PRESERVED'")
dst.write_text(s)
PY

node --check "$TMP"

python3 - "$TMP" > /tmp/r800-transport-after.sha <<'PY'
from pathlib import Path
import hashlib,re,sys
s=Path(sys.argv[1]).read_text(); parts=[]
for pat in [r'function h264EncoderArgsR721\(\).*?\n}', r'function startPublisher.*?\n}', r'rtmps://a\.rtmps\.youtube\.com.*?backup=1[^\n]*']:
 m=re.search(pat,s,re.S)
 if m: parts.append(m.group(0))
print(hashlib.sha256(('\n---\n'.join(parts)).encode()).hexdigest())
PY

if ! cmp -s /tmp/r800-transport-before.sha /tmp/r800-transport-after.sha; then
  echo 'ERROR: YouTube transport fingerprint changed; aborting.'
  exit 1
fi

cat "$TMP" > "$FILE"
chown --reference="$BACKUP" "$FILE"
chmod --reference="$BACKUP" "$FILE"

echo '=== R800 PATCH ==='
echo 'Fade engine: UNCHANGED R799/R787'
echo 'Outro PREVIOUS/NEXT: T-12s .. T-4s (no overlap with fade)'
echo 'YouTube transport: byte-fingerprint preserved'
echo "Backup: $BACKUP"

systemctl restart andrik-radio.service
sleep 8
if ! systemctl is-active --quiet andrik-radio.service; then
  echo 'ERROR: radio failed after patch; restoring backup'
  cp -a "$BACKUP" "$FILE"
  systemctl restart andrik-radio.service
  exit 1
fi

echo '=== SERVICE ==='
systemctl is-active andrik-radio.service
echo '=== FFMPEG CPU ==='
ps -eo pid,ppid,%cpu,%mem,stat,etime,cmd --sort=-%cpu | grep '[f]fmpeg' | head -n 6 || true
echo 'R800 installed successfully.'
