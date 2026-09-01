#!/usr/bin/env bash
set -Eeuo pipefail
echo "R821 is now superseded by R829 GOLDEN. Redirecting to the complete preserved stability build."
BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
exec bash -c "curl -fsSL '$BASE/radio247/vm-lite/install-r829-golden-nocrop-r828-r827-r826-r821-preserved.sh' | env ANDRIK_SITE_BASE='$BASE' bash"
