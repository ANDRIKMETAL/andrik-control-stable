#!/usr/bin/env bash
set -Eeuo pipefail
SERVER=/opt/andrik-radio/radio247/server.mjs
[ -s "$SERVER" ] || { echo "R659 guard: нет $SERVER" >&2; exit 2; }
python3 - "$SERVER" <<'PY'
from pathlib import Path
import re, sys
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8')
# Enforce the one transform that was confirmed on the live VM.
s=re.sub(r"'scale=1920:1080:force_original_aspect_ratio=increase:flags=lanczos',", "'scale=1920:1080:flags=lanczos',", s)
s=re.sub(r"^[ \t]*'crop=1920:1080',[ \t]*\n", "", s, flags=re.M)
# Also normalize any accidental direct 1080 scale variant back to the confirmed form.
s=re.sub(r"'scale=1920:1080:flags=[^']+',", "'scale=1920:1080:flags=lanczos',", s)
if "'scale=1920:1080:flags=lanczos'," not in s:
    raise SystemExit('R659 guard: direct 1920x1080 scale not found')
if 'force_original_aspect_ratio=increase' in s or "'crop=1920:1080'" in s:
    raise SystemExit('R659 guard: crop/cover still present')
p.write_text(s,encoding='utf-8')
PY
node --check "$SERVER" >/dev/null
echo 'R659 FULLSCREEN GUARD OK'
