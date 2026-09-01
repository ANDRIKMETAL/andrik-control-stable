#!/usr/bin/env bash
set -Eeuo pipefail
BASE="${ANDRIK_SITE_BASE:-https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main}"
echo "This installer is superseded by R830 TRUE NO-CROP. Redirecting to R830."
exec bash -c "curl -fsSL '$BASE/radio247/vm-lite/install-r830-true-nocrop-contain-smooth-fade-r829-preserved.sh' | env ANDRIK_SITE_BASE='$BASE' bash"
