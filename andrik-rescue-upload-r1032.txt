#!/usr/bin/env bash
set -Eeuo pipefail
BASE="https://andrikmetal.com"
FILE="/mnt/andrik/ANDRIK-TRANSFER.tar.gz"
[ -f "$FILE" ] || { echo "ERROR: $FILE not found"; exit 1; }
printf 'ADMIN_KEY: '
IFS= read -rs ADMIN_KEY
echo
[ -n "$ADMIN_KEY" ] || { echo "ERROR: empty ADMIN_KEY"; exit 1; }
AUTH=(-H "x-admin-key: $ADMIN_KEY")
START="$(curl -fsS "${AUTH[@]}" -X POST "$BASE/api/control/vps-backup-r1030/mpu/start")"
UPLOAD_ID="$(printf '%s' "$START" | sed -n 's/.*"uploadId":"\([^"]*\)".*/\1/p')"
PART_SIZE="$(printf '%s' "$START" | sed -n 's/.*"partSize":\([0-9]*\).*/\1/p')"
[ -n "$UPLOAD_ID" ] || { echo "ERROR START: $START"; exit 1; }
PART_SIZE="${PART_SIZE:-8388608}"
SIZE="$(stat -c %s "$FILE")"
COUNT=$(( (SIZE + PART_SIZE - 1) / PART_SIZE ))
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
PARTS="$TMP/parts.json"; printf '[' > "$PARTS"
echo "Uploading $SIZE bytes in $COUNT parts..."
for ((i=1;i<=COUNT;i++)); do
  dd if="$FILE" of="$TMP/part" bs="$PART_SIZE" skip=$((i-1)) count=1 status=none
  R="$(curl -fsS "${AUTH[@]}" -X PUT --data-binary @"$TMP/part" "$BASE/api/control/vps-backup-r1030/mpu/part?uploadId=$(printf '%s' "$UPLOAD_ID" | sed 's/%/%25/g;s/+/%2B/g;s/\//%2F/g;s/=/%3D/g')&partNumber=$i")"
  ETAG="$(printf '%s' "$R" | sed -n 's/.*"etag":"\([^"]*\)".*/\1/p')"
  [ -n "$ETAG" ] || { echo "ERROR PART $i: $R"; exit 1; }
  [ "$i" -gt 1 ] && printf ',' >> "$PARTS"
  printf '{"partNumber":%d,"etag":"%s"}' "$i" "$ETAG" >> "$PARTS"
  echo "[$i/$COUNT] OK"
done
printf ']' >> "$PARTS"
QID="$(printf '%s' "$UPLOAD_ID" | sed 's/%/%25/g;s/+/%2B/g;s/\//%2F/g;s/=/%3D/g')"
DONE="$(curl -fsS "${AUTH[@]}" -H 'content-type: application/json' -X POST --data-binary @"$PARTS" "$BASE/api/control/vps-backup-r1030/mpu/complete?uploadId=$QID")"
echo "$DONE"
STATUS="$(curl -fsS "${AUTH[@]}" "$BASE/api/control/vps-backup-r1030/status")"
echo "$STATUS"
printf '%s' "$STATUS" | grep -q '"exists":true' && echo 'BACKUP IN R2: OK' || { echo 'ERROR: R2 verification failed'; exit 1; }
