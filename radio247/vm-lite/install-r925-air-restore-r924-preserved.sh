#!/usr/bin/env bash
set -Eeuo pipefail
SITE_BASE="${ANDRIK_SITE_BASE:-https://andrikmetal.com}"
echo "ANDRIK compatibility installer R925 -> R1015"
curl -fsSL --retry 6 --retry-delay 2 "${SITE_BASE%/}/radio247/vm-lite/install-r1015-control-disk-recovery.sh?t=$(date +%s)" | bash
