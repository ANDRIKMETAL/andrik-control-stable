#!/usr/bin/env bash
set -Eeuo pipefail
SERVER=/opt/andrik-radio/radio247/server.mjs
[ -s "$SERVER" ] || { echo "R659 guard: нет $SERVER" >&2; exit 2; }
python3 - "$SERVER" <<'PY'
from pathlib import Path
import re, sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
# R690: preserve the entire source image inside 1920x1080.
s=re.sub(r"^[ \t]*'crop=1920:1080',[ \t]*\n", "", s, flags=re.M)
s=re.sub(r"'scale=1920:1080(?::force_original_aspect_ratio=(?:increase|decrease))?:flags=[^']+',(?:\n[ \t]*'pad=1920:1080:[^']+',)?",
         "'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos',\n    'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',", s)
if "'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos'," not in s:
    raise SystemExit('R690 guard: FIT scale not found')
if "'pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black'," not in s:
    raise SystemExit('R690 guard: FIT pad not found')
if 'force_original_aspect_ratio=increase' in s or "'crop=1920:1080'" in s:
    raise SystemExit('R690 guard: crop/cover still present')
p.write_text(s,encoding='utf-8')
PY
node --check "$SERVER" >/dev/null
echo 'R690 FULL-FRAME FIT GUARD OK'
