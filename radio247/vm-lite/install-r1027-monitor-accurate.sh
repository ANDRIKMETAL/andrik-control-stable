#!/usr/bin/env bash
set -Eeuo pipefail
DST="/usr/local/sbin/andrik-radio-load-r988"
STAMP="$(date +%Y%m%d-%H%M%S)"
BEFORE="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
TMP="$(mktemp /tmp/andrik-radio-load-r1027.XXXXXX)"
trap 'rm -f "$TMP"' EXIT
cat > "$TMP" <<'PY_R1027'
#!/usr/bin/env python3
import json
import os
import re
import time
from pathlib import Path

SAMPLE_SEC = 0.80


def system_snap():
    with open('/proc/stat', 'r', encoding='utf-8') as f:
        parts = f.readline().split()[1:]
    values = [int(x) for x in parts]
    idle = values[3] + (values[4] if len(values) > 4 else 0)
    return idle, sum(values)


def read_cmdline(pid):
    try:
        raw = Path(f'/proc/{pid}/cmdline').read_bytes()
        if raw:
            return raw.replace(b'\0', b' ').decode('utf-8', 'replace').strip()
    except Exception:
        pass
    try:
        return Path(f'/proc/{pid}/comm').read_text(encoding='utf-8', errors='replace').strip()
    except Exception:
        return ''


def read_proc_ticks(pid):
    try:
        raw = Path(f'/proc/{pid}/stat').read_text(encoding='utf-8', errors='replace')
        end = raw.rfind(')')
        if end < 0:
            return None
        tail = raw[end + 2:].split()  # field 3 starts at tail[0]
        utime = int(tail[11])         # field 14
        stime = int(tail[12])         # field 15
        starttime = int(tail[19])     # field 22; protects against PID reuse
        return utime + stime, starttime
    except Exception:
        return None


def classify(cmd):
    low = cmd.lower()
    if 'radio247/server.mjs' in cmd:
        return 'radioNode'
    if 'ffmpeg' not in low:
        return None
    if 'rtmps://' in low or 'youtube.com/live' in low:
        return 'publisher'
    if re.search(r'\.mp3(?:\s|$)', cmd, re.I):
        return 'mp3Decoder'
    if re.search(r'stream-morning-master-r703|live-ticker|andrik-qr|subscribe-right|like-right', cmd, re.I):
        return 'visual'
    return 'otherFfmpeg'


def process_snap():
    out = {}
    try:
        pids = [x for x in os.listdir('/proc') if x.isdigit()]
    except Exception:
        pids = []
    for pid_s in pids:
        pid = int(pid_s)
        cmd = read_cmdline(pid)
        cat = classify(cmd)
        if not cat:
            continue
        timing = read_proc_ticks(pid)
        if timing is None:
            continue
        ticks, starttime = timing
        out[pid] = (ticks, starttime, cat)
    return out


def memory_info():
    mem = {}
    with open('/proc/meminfo', 'r', encoding='utf-8') as f:
        for line in f:
            m = re.match(r'^([^:]+):\s+(\d+)', line)
            if m:
                mem[m.group(1)] = int(m.group(2))
    rt = mem.get('MemTotal', 0)
    ra = mem.get('MemAvailable', 0)
    ru = max(0, rt - ra)
    st = mem.get('SwapTotal', 0)
    sf = mem.get('SwapFree', 0)
    su = max(0, st - sf)
    return {
        'ramUsedMB': round(ru / 1024),
        'ramTotalMB': round(rt / 1024),
        'ramPct': round((ru / rt * 100.0) if rt else 0.0, 1),
        'swapUsedMB': round(su / 1024),
        'swapTotalMB': round(st / 1024),
    }


def cpu_model():
    try:
        with open('/proc/cpuinfo', 'r', encoding='utf-8') as f:
            for line in f:
                if line.lower().startswith('model name'):
                    return line.split(':', 1)[1].strip()
    except Exception:
        pass
    return 'CPU'


cores = os.cpu_count() or 1
sys_a = system_snap()
proc_a = process_snap()
t0 = time.monotonic()
time.sleep(SAMPLE_SEC)
sys_b = system_snap()
proc_b = process_snap()
elapsed_ms = max(1, round((time.monotonic() - t0) * 1000))

total_delta = max(1, sys_b[1] - sys_a[1])
idle_delta = max(0, sys_b[0] - sys_a[0])
cpu = max(0.0, min(100.0, (1.0 - idle_delta / total_delta) * 100.0))

p = {'visual': 0.0, 'publisher': 0.0, 'radioNode': 0.0, 'mp3Decoder': 0.0, 'otherFfmpeg': 0.0}
for pid, (ticks_b, start_b, cat_b) in proc_b.items():
    prev = proc_a.get(pid)
    if not prev:
        continue
    ticks_a, start_a, cat_a = prev
    if start_a != start_b or cat_a != cat_b:
        continue
    delta = max(0, ticks_b - ticks_a)
    p[cat_b] += (delta / total_delta) * 100.0

l1, l5, l15 = os.getloadavg()
if cpu >= 90:
    level, label = 'critical', 'КРИТИЧЕСКАЯ'
elif cpu >= 70:
    level, label = 'high', 'ВЫСОКАЯ'
else:
    level, label = 'normal', 'НОРМА'

payload = {
    'version': 'R1027',
    'state': {'level': level, 'label': label},
    'cpu': {
        'model': cpu_model(),
        'cores': cores,
        'totalPct': round(cpu, 1),
        'sampleMs': elapsed_ms,
        'scale': 'share-of-total-vps',
    },
    'processes': {k: round(min(100.0, max(0.0, v)), 1) for k, v in p.items()},
    'memory': memory_info(),
    'load': {'one': round(l1, 2), 'five': round(l5, 2), 'fifteen': round(l15, 2)},
}
print(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
PY_R1027
python3 -m py_compile "$TMP"
if [ -f "$DST" ]; then cp -a "$DST" "$DST.before-R1027-$STAMP"; fi
install -m 0755 "$TMP" "$DST"
echo "=== R1027 MONITOR TEST ==="
OUT="$($DST)"
printf '%s\n' "$OUT"
printf '%s\n' "$OUT" | grep -q '"version":"R1027"'
AFTER="$(systemctl show -p MainPID --value andrik-radio.service 2>/dev/null || true)"
echo "RADIO PID BEFORE: $BEFORE"
echo "RADIO PID AFTER : $AFTER"
if [ "$BEFORE" = "$AFTER" ]; then echo "✅ RADIO PID UNCHANGED"; else echo "⚠️ RADIO PID CHANGED OUTSIDE THIS INSTALLER"; fi
echo "✅ R1027 ACCURATE CPU MONITOR INSTALLED"
echo "✅ andrik-radio.service was NOT restarted or signalled"
