#!/usr/bin/env bash
set -Eeuo pipefail
ENV=/etc/andrik-radio.env
SERVICE=andrik-radio.service
STAMP="$(date +%Y%m%d-%H%M%S)"
sudo cp -a "$ENV" "${ENV}.R914-DUAL-BEFORE-ROLLBACK-${STAMP}.bak"
sudo python3 - "$ENV" <<'PY'
from pathlib import Path
import re,sys
p=Path(sys.argv[1]); lines=[]
for line in p.read_text(encoding='utf-8').splitlines():
    if re.match(r'^\s*(?:export\s+)?YOUTUBE_DUAL_INGEST_R792=',line): continue
    if re.match(r'^\s*(?:export\s+)?STREAM_BACKUP_URL_OVERRIDE=',line): continue
    lines.append(line)
lines.append('YOUTUBE_DUAL_INGEST_R792=0')
p.write_text('\n'.join(lines)+'\n',encoding='utf-8')
PY
sudo systemctl restart "$SERVICE"
sleep 8
curl -fsS --max-time 5 http://127.0.0.1:8080/status | python3 -c 'import sys,json;d=json.load(sys.stdin);print("RTMPS %s/%s · publisher=%s · producer=%s"%(d.get("rtmpsEstablishedConnectionsR792"),d.get("rtmpsExpectedConnectionsR792"),d.get("publisherRunning"),d.get("producerRunning")))'
