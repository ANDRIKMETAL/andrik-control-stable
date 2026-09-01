#!/usr/bin/env bash
set -Eeuo pipefail
echo "R819 is retired in the R829 build because its old FIT+PAD geometry can undo the permanent fullscreen policy. Redirecting to R829."
BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
exec bash -c "curl -fsSL '$BASE/radio247/vm-lite/install-r829-golden-nocrop-r828-r827-r826-r821-preserved.sh' | env ANDRIK_SITE_BASE='$BASE' bash"
