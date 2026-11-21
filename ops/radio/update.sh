#!/usr/bin/env bash
set -Eeuo pipefail
# ANDRIK Radio updater. Installs only an explicitly approved, SHA256-pinned server.mjs.
ROOT=/opt/andrik-radio
TARGET="$ROOT/radio247/server.mjs"
STATE=/var/lib/andrik-radio-deploy
BACKUPS=/var/backups/andrik-radio-deploy
LOCK=/run/lock/andrik-radio-deploy.lock
BASE=https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/main/ops/radio
BASELINE=bdd45e10e8e5ea828b8722881c9044f5ee8da11ba0d0288b3a7c2d78a956ba6d
SERVICE=andrik-radio.service
mkdir -p "$STATE" "$BACKUPS"
exec 9>"$LOCK"
flock -n 9 || exit 0
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL --connect-timeout 8 --max-time 25 "$BASE/release.env" -o "$tmp/release.env"
# Data only: do not source remotely supplied shell.
version=$(sed -n 's/^VERSION=//p' "$tmp/release.env")
sha=$(sed -n 's/^SHA256=//p' "$tmp/release.env")
url=$(sed -n 's/^SOURCE_URL=//p' "$tmp/release.env")
[[ "$version" =~ ^[A-Za-z0-9._-]{1,60}$ ]] || { echo "Invalid version"; exit 1; }
[[ "$sha" =~ ^[a-f0-9]{64}$ ]] || { echo "Invalid SHA256"; exit 1; }
if [[ -n "$url" ]]; then
  [[ "$url" =~ ^https://raw.githubusercontent.com/ANDRIKMETAL/andrik-control-stable/[a-f0-9]{40}/radio247/server.mjs$ ]] || { echo "Source must be pinned to a commit"; exit 1; }
fi
[[ -f "$TARGET" ]] || { echo "Target absent"; exit 1; }
current=$(sha256sum "$TARGET" | awk '{print $1}')
[[ "$current" != "$sha" ]] || exit 0
# Refuse unexpected local edits and never overwrite a server not deployed by this updater.
if [[ -f "$STATE/last-sha" ]]; then
  expected=$(cat "$STATE/last-sha")
else
  expected=$BASELINE
fi
[[ "$current" == "$expected" ]] || { echo "Refusing drift: current=$current expected=$expected"; exit 1; }
# An empty source URL means 'baseline only': no deployment until a reviewed release is pinned.
[[ -n "$url" ]] || exit 0
curl -fsSL --connect-timeout 8 --max-time 90 "$url" -o "$tmp/server.mjs"
echo "$sha  $tmp/server.mjs" | sha256sum -c -
node --check "$tmp/server.mjs"
backup="$BACKUPS/$(date -u +%Y%m%dT%H%M%SZ)-$current.mjs"
cp -p "$TARGET" "$backup"
chmod --reference="$TARGET" "$tmp/server.mjs"
chown --reference="$TARGET" "$tmp/server.mjs"
install -m "$(stat -c %a "$TARGET")" -o "$(stat -c %u "$TARGET")" -g "$(stat -c %g "$TARGET")" "$tmp/server.mjs" "$TARGET.new"
mv -f "$TARGET.new" "$TARGET"
if systemctl restart "$SERVICE" && sleep 8 && systemctl is-active --quiet "$SERVICE"; then
  printf '%s\n' "$sha" > "$STATE/last-sha"
  printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$version" "$sha" >> "$STATE/history.log"
  echo "ANDRIK Radio deployed $version"
else
  echo "Health check failed; restoring backup"
  cp -p "$backup" "$TARGET"
  systemctl restart "$SERVICE" || true
  exit 1
fi
