#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://andrikmetal.com"
MNT=/mnt/andrik
OUT="$MNT/ANDRIK-TRANSFER.tar.gz"
PARTDIR=/tmp/andrik-r1030-parts
mkdir -p "$MNT"; mountpoint -q "$MNT" || mount /dev/sdb1 "$MNT"
echo "ANDRIK R1030 · Rescue → private R2"
read -rsp "ADMIN_KEY: " KEY; echo
rm -f "$OUT"; rm -rf "$PARTDIR"; mkdir -p "$PARTDIR"
echo "[1/4] Creating optimized archive…"
tar -C "$MNT" -czf "$OUT" --exclude='opt/andrik-radio/backups' opt/andrik-radio root/ANDRIK-SAFE etc/systemd/system/andrik-radio.service etc/systemd/system/andrik-radio.service.d
gzip -t "$OUT"; ls -lh "$OUT"
echo "[2/4] Starting R2 multipart…"
START=$(curl -fsS -X POST -H "x-admin-key: $KEY" "$BASE/api/control/vps-backup-r1030/mpu/start")
UPLOAD=$(printf '%s' "$START"|python3 -c 'import sys,json; print(json.load(sys.stdin)["uploadId"])')
split -b 8M -d -a 4 "$OUT" "$PARTDIR/part-"
: > "$PARTDIR/parts.tsv"; N=0; TOTAL=$(find "$PARTDIR" -name 'part-*' ! -name '*.tsv'|wc -l)
for F in "$PARTDIR"/part-*; do N=$((N+1)); echo "[3/4] R2 part $N/$TOTAL"; R=$(curl -fsS -X PUT -H "x-admin-key: $KEY" --data-binary "@$F" "$BASE/api/control/vps-backup-r1030/mpu/part?uploadId=$UPLOAD&partNumber=$N"); E=$(printf '%s' "$R"|python3 -c 'import sys,json; print(json.load(sys.stdin)["etag"])'); printf '%s\t%s\n' "$N" "$E" >> "$PARTDIR/parts.tsv"; done
python3 - "$PARTDIR/parts.tsv" "$PARTDIR/complete.json" <<'PY'
import json,sys
parts=[]
for line in open(sys.argv[1]):
 n,e=line.rstrip('\n').split('\t',1); parts.append({'partNumber':int(n),'etag':e})
json.dump({'parts':parts},open(sys.argv[2],'w'))
PY
echo "[4/4] Completing and verifying…"
curl -fsS -X POST -H "x-admin-key: $KEY" -H 'content-type: application/json' --data-binary "@$PARTDIR/complete.json" "$BASE/api/control/vps-backup-r1030/mpu/complete?uploadId=$UPLOAD"; echo
curl -fsS -H "x-admin-key: $KEY" "$BASE/api/control/vps-backup-r1030/status"; echo
echo "BACKUP IN R2: OK"
