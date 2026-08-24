#!/usr/bin/env bash
set -Eeuo pipefail
QR_PATH="${QR_PATH:-/opt/andrik-radio/assets/andrik-qr-r612.png}"
BACKUP_PATH="${BACKUP_PATH:-/opt/andrik-radio/assets/andrik-qr-r612-r646-safe.png}"

png_ok(){
  [ -s "$1" ] || return 1
  [ "$(od -An -tx1 -N8 "$1" 2>/dev/null | tr -d ' \n')" = "89504e470d0a1a0a" ]
}

if png_ok "$QR_PATH"; then
  exit 0
fi

echo "R646 QR guard: invalid PNG detected, restoring safe copy..." >&2
if png_ok "$BACKUP_PATH"; then
  install -m 0644 "$BACKUP_PATH" "$QR_PATH"
elif [ -s "$QR_PATH" ] && command -v ffmpeg >/dev/null 2>&1; then
  tmp="$(mktemp --suffix=.png)"
  trap 'rm -f "$tmp"' EXIT
  ffmpeg -hide_banner -loglevel error -y -i "$QR_PATH" -frames:v 1 "$tmp"
  png_ok "$tmp" || { echo "R646 QR guard: conversion failed" >&2; exit 2; }
  install -m 0644 "$tmp" "$QR_PATH"
else
  echo "R646 QR guard: no valid recovery source" >&2
  exit 2
fi

png_ok "$QR_PATH" || { echo "R646 QR guard: PNG still invalid after repair" >&2; exit 2; }
echo "R646 QR guard: repaired OK" >&2
