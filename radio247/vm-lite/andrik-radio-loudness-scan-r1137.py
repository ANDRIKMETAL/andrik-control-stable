#!/usr/bin/env python3
import json, math, os, re, signal, subprocess, sys, time, urllib.request
from datetime import datetime, timezone
from pathlib import Path

DIR = Path('/var/cache/andrik-radio-r622/audio')
TARGET_I = -14
TARGET_LRA = 11
TARGET_TP = -1.5
STATUS_URL = 'http://127.0.0.1:8080/status'
STABLE_BEFORE_SEC = 20
COOLDOWN_AFTER_TRACK_SEC = 45
POLL_SEC = 5
CPU_ABORT_PCT = 90.0
CPU_ABORT_CONSECUTIVE = 3
MAX_HEALTH_WAIT_SEC = 6 * 60 * 60

child = None
stop_requested = False


def utcnow():
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def log(msg):
    print(f'[{utcnow()}] {msg}', flush=True)


def on_signal(signum, frame):
    global stop_requested, child
    stop_requested = True
    log(f'STOP requested signal={signum}')
    if child and child.poll() is None:
        try:
            child.terminate()
        except Exception:
            pass


signal.signal(signal.SIGTERM, on_signal)
signal.signal(signal.SIGINT, on_signal)


def valid_cache(mp3: Path, sidecar: Path):
    try:
        st = mp3.stat()
        row = json.loads(sidecar.read_text(encoding='utf-8'))
        if int(row.get('size', -1)) != int(st.st_size):
            return False
        if abs(float(row.get('mtimeMs', -999999)) - (st.st_mtime_ns / 1_000_000)) > 2:
            return False
        for k in ('input_i', 'input_lra', 'input_tp', 'input_thresh', 'target_offset'):
            if not math.isfinite(float(row[k])):
                return False
        return True
    except Exception:
        return False


def systemctl_active():
    try:
        p = subprocess.run(
            ['/bin/systemctl', 'is-active', '--quiet', 'andrik-radio.service'],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=3
        )
        return p.returncode == 0
    except Exception:
        return False


def local_status():
    try:
        req = urllib.request.Request(STATUS_URL, headers={'User-Agent': 'ANDRIK-R1137-Loudness'})
        with urllib.request.urlopen(req, timeout=2.5) as r:
            raw = json.loads(r.read(512 * 1024).decode('utf-8', 'replace'))
        s = raw.get('status', raw) if isinstance(raw, dict) else {}
        est = int(s.get('rtmpsEstablishedConnectionsR792', s.get('rtmps', 0)) or 0)
        exp = int(s.get('rtmpsExpectedConnectionsR792', 2) or 2)
        transport = s.get('transportHealthy', None)
        if transport is None:
            transport = est >= exp
        last_error = str(s.get('lastError', '') or '').strip()
        return {
            'ok': bool(transport) and est >= exp and not last_error,
            'est': est, 'exp': exp, 'transport': bool(transport), 'lastError': last_error,
            'current': str((s.get('current') or {}).get('title', '') if isinstance(s.get('current'), dict) else s.get('current', '') or '')
        }
    except Exception as e:
        return {'ok': False, 'est': 0, 'exp': 2, 'transport': False, 'lastError': f'status-unavailable:{e}', 'current': ''}


def cpu_snapshot():
    with open('/proc/stat', 'r', encoding='utf-8') as f:
        p = f.readline().split()[1:]
    vals = [int(x) for x in p]
    total = sum(vals)
    idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    return total, idle


def cpu_busy(prev):
    cur = cpu_snapshot()
    if not prev:
        return cur, 0.0
    dt = cur[0] - prev[0]
    di = cur[1] - prev[1]
    pct = 0.0 if dt <= 0 else 100.0 * (dt - di) / dt
    return cur, max(0.0, min(100.0, pct))


def healthy_now():
    if not systemctl_active():
        return False, 'radio-inactive'
    s = local_status()
    if not s['ok']:
        return False, f"transport {s['est']}/{s['exp']} healthy={s['transport']} err={s['lastError'][:120]}"
    return True, f"transport {s['est']}/{s['exp']}"


def wait_for_stable():
    start = time.monotonic()
    stable_since = None
    last_reason = ''
    while not stop_requested:
        ok, reason = healthy_now()
        if ok:
            if stable_since is None:
                stable_since = time.monotonic()
                log(f'HEALTH OK {reason}; waiting {STABLE_BEFORE_SEC}s stable window')
            if time.monotonic() - stable_since >= STABLE_BEFORE_SEC:
                return True
        else:
            stable_since = None
            if reason != last_reason:
                log(f'PAUSE health guard: {reason}')
                last_reason = reason
        if time.monotonic() - start > MAX_HEALTH_WAIT_SEC:
            log('STOP health did not become stable within 6h')
            return False
        time.sleep(5)
    return False


def parse_loudnorm(stderr_text):
    matches = re.findall(r'\{[\s\S]*?"target_offset"[\s\S]*?\}', stderr_text)
    if not matches:
        raise RuntimeError('loudnorm JSON missing')
    return json.loads(matches[-1])


def analyze_one(mp3: Path):
    global child
    cmd = [
        '/usr/bin/ffmpeg', '-nostdin', '-hide_banner', '-nostats', '-loglevel', 'info',
        '-re', '-threads', '1', '-filter_threads', '1', '-i', str(mp3),
        '-map', '0:a:0', '-vn', '-sn', '-dn',
        '-af', f'loudnorm=I={TARGET_I}:LRA={TARGET_LRA}:TP={TARGET_TP}:print_format=json',
        '-f', 'null', '-'
    ]
    child = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, errors='replace')
    err_chunks = []
    cpu_prev = cpu_snapshot()
    high_cpu = 0
    aborted = ''

    while child.poll() is None and not stop_requested:
        time.sleep(POLL_SEC)
        try:
            # drain available stderr without blocking using communicate only after exit; keep kernel pipe safe
            pass
        except Exception:
            pass

        ok, reason = healthy_now()
        cpu_prev, busy = cpu_busy(cpu_prev)
        if busy >= CPU_ABORT_PCT:
            high_cpu += 1
        else:
            high_cpu = 0

        if not ok:
            aborted = f'health-guard:{reason}'
        elif high_cpu >= CPU_ABORT_CONSECUTIVE:
            aborted = f'cpu-guard:{busy:.1f}% x{high_cpu}'

        if aborted:
            log(f'ABORT current analysis {mp3.name}: {aborted}')
            try:
                child.terminate()
                child.wait(timeout=5)
            except Exception:
                try:
                    child.kill()
                except Exception:
                    pass
            break

    if stop_requested:
        aborted = aborted or 'service-stop'
        try:
            if child.poll() is None:
                child.terminate()
        except Exception:
            pass

    try:
        _, stderr = child.communicate(timeout=10)
    except Exception:
        try:
            child.kill()
        except Exception:
            pass
        _, stderr = child.communicate()
    finally:
        rc = child.returncode
        child = None

    if aborted:
        return None, aborted
    if rc != 0:
        raise RuntimeError(f'ffmpeg exit {rc}: {stderr[-900:]}')

    raw = parse_loudnorm(stderr)
    st = mp3.stat()
    row = {
        'size': int(st.st_size),
        'mtimeMs': st.st_mtime_ns / 1_000_000,
        'input_i': float(raw['input_i']),
        'input_lra': float(raw['input_lra']),
        'input_tp': float(raw['input_tp']),
        'input_thresh': float(raw['input_thresh']),
        'target_offset': float(raw['target_offset']),
        'analyzedAt': utcnow(),
        'profile': 'R1137-SAFE-BACKGROUND'
    }
    for k in ('input_i', 'input_lra', 'input_tp', 'input_thresh', 'target_offset'):
        if not math.isfinite(row[k]):
            raise RuntimeError(f'invalid {k}')

    sidecar = Path(str(mp3) + '.r747-loudnorm.json')
    tmp = Path(str(sidecar) + f'.tmp-r1137-{os.getpid()}')
    tmp.write_text(json.dumps(row, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    os.replace(tmp, sidecar)
    return row, ''


def main():
    if not DIR.is_dir():
        log(f'ERROR audio cache missing: {DIR}')
        return 2

    files = sorted(DIR.glob('*.mp3'))
    valid_before = sum(valid_cache(p, Path(str(p) + '.r747-loudnorm.json')) for p in files)
    todo = [p for p in files if not valid_cache(p, Path(str(p) + '.r747-loudnorm.json'))]
    log(f'R1137 START total={len(files)} valid={valid_before} missing={len(todo)} target={TARGET_I}LUFS TP={TARGET_TP}dBTP')
    log('SOURCE MP3 ARE READ-ONLY; only atomic .r747-loudnorm.json sidecars are written')

    ok_count = 0
    failed = 0
    deferred = 0

    for idx, mp3 in enumerate(todo, 1):
        if stop_requested:
            break
        if valid_cache(mp3, Path(str(mp3) + '.r747-loudnorm.json')):
            continue
        if not wait_for_stable():
            break

        log(f'[{idx}/{len(todo)}] ANALYZE {mp3.name}')
        try:
            row, abort_reason = analyze_one(mp3)
            if abort_reason:
                deferred += 1
                log(f'[{idx}/{len(todo)}] DEFERRED {mp3.name}: {abort_reason}')
                # Do not immediately retry under instability. End this batch safely;
                # next button press resumes exactly from remaining sidecars.
                break
            ok_count += 1
            log(f'[{idx}/{len(todo)}] SAVED I={row["input_i"]:.2f} LRA={row["input_lra"]:.2f} TP={row["input_tp"]:.2f} OFFSET={row["target_offset"]:+.2f}')
        except Exception as e:
            failed += 1
            log(f'[{idx}/{len(todo)}] FAILED {mp3.name}: {e}')

        if stop_requested:
            break

        # Give live x264/AAC + Node a quiet recovery window between full-track scans.
        for remain in range(COOLDOWN_AFTER_TRACK_SEC, 0, -5):
            if stop_requested:
                break
            if remain == COOLDOWN_AFTER_TRACK_SEC:
                log(f'COOLDOWN {COOLDOWN_AFTER_TRACK_SEC}s before next track')
            time.sleep(min(5, remain))

    files2 = sorted(DIR.glob('*.mp3'))
    valid_after = sum(valid_cache(p, Path(str(p) + '.r747-loudnorm.json')) for p in files2)
    missing_after = len(files2) - valid_after
    log(f'R1137 DONE total={len(files2)} valid={valid_after} missing={missing_after} new_ok={ok_count} failed={failed} deferred={deferred}')
    return 0 if failed == 0 else 3


if __name__ == '__main__':
    raise SystemExit(main())
