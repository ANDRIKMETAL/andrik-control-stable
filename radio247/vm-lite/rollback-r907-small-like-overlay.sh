#!/usr/bin/env bash
SERVER="/opt/andrik-radio/radio247/server.mjs"
BACKUP="$(ls -1t ${SERVER}.before-R907-LIKE-*.bak 2>/dev/null | head -1 || true)"
if [ -z "$BACKUP" ] || [ ! -f "$BACKUP" ]; then
  echo "❌ R907 backup not found"
  exit 20
fi
cp -a "$BACKUP" "$SERVER"
node --check "$SERVER" || { echo "❌ backup syntax check failed"; exit 30; }
systemctl restart andrik-radio.service
sleep 10
systemctl is-active andrik-radio.service
echo "✅ R907 LIKE overlay rolled back from: $BACKUP"
