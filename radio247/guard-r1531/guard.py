#!/usr/bin/env python3
import argparse
import json
import os
import re
import stat
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


BASE = "https://andrikmetal.com"
TOKEN_FILE = Path("/etc/andrik-guard-r1531/token")
RADIO_CACHE = "/var/cache/andrik-radio-r622"
RADIO_UNIT = "andrik-radio.service"
UNITS = (
    RADIO_UNIT,
    "andrik-radio-web-control.service",
    "andrik-radio-web-agent.service",
    "andrik-radio-schedule-r1517.service",
    "ssh.service",
    "ssh.socket",
)
TEMP_NAME = re.compile(r"\.(?:tmp|part|partial)(?:[-.]|$)", re.I)
TEMP_AGE = 24 * 60 * 60


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


HTTP = build_opener(ProxyHandler({}), NoRedirect())


def capacity(total, available):
    if total <= 0 or not 0 <= available <= total:
        return None
    return {
        "totalBytes": total,
        "availableBytes": available,
        "usedPct": round(100 * (total - available) / total, 1),
    }


def disk_usage(path):
    try:
        fs = os.statvfs(path)
        # Count space available to an ordinary user, including filesystem reservations.
        return capacity(fs.f_blocks * fs.f_frsize, fs.f_bavail * fs.f_frsize)
    except OSError:
        return None


def memory_usage():
    try:
        fields = dict(line.split(":", 1) for line in Path("/proc/meminfo").read_text().splitlines())
        return capacity(int(fields["MemTotal"].split()[0]) * 1024, int(fields["MemAvailable"].split()[0]) * 1024)
    except (OSError, KeyError, ValueError):
        return None


def cpu_times():
    with open("/proc/stat", encoding="ascii") as proc:
        times = [int(field) for field in proc.readline().split()[1:9]]
    return sum(times), times[3] + times[4]


def cpu_usage():
    try:
        total, idle = cpu_times()
        time.sleep(0.8)
        later_total, later_idle = cpu_times()
        elapsed = later_total - total
        if elapsed <= 0:
            return None
        idle_fraction = (later_idle - idle) / elapsed
        return round(100 * (1 - min(1, max(0, idle_fraction))), 1)
    except (OSError, ValueError, IndexError):
        return None


def service_states():
    states = dict.fromkeys(UNITS, "unknown")
    try:
        result = subprocess.run(
            ["systemctl", "show", "--no-pager", "-p", "Id", "-p", "Names",
             "-p", "LoadState", "-p", "ActiveState", *UNITS],
            capture_output=True, text=True, timeout=5, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return states
    for block in result.stdout.strip().split("\n\n"):
        fields = dict(line.split("=", 1) for line in block.splitlines() if "=" in line)
        names = {fields.get("Id"), *fields.get("Names", "").split()}
        state = "missing" if fields.get("LoadState") == "not-found" else fields.get("ActiveState", "unknown")
        for name in names.intersection(UNITS):
            states[name] = state
    return states


def ffmpeg_processes():
    running = zombies = radio = 0
    partial = False
    try:
        processes = list(Path("/proc").iterdir())
    except OSError:
        return None
    for process in processes:
        if not process.name.isdecimal():
            continue
        try:
            # /proc/PID/stat supplies the executable name and state without arguments.
            name, _, rest = (process / "stat").read_text(errors="replace").rpartition(") ")
            if name.split("(", 1)[-1] != "ffmpeg" or not rest:
                continue
            if rest[0] in ("Z", "X"):
                zombies += 1
                continue
            running += 1
            if any(f"/{RADIO_UNIT}" in line for line in (process / "cgroup").read_text().splitlines()):
                radio += 1
        except (FileNotFoundError, ProcessLookupError):
            continue
        except OSError:
            partial = True
    return {"running": running, "zombies": zombies, "radio": None if partial else radio, "partial": partial}


def temporary_files(now):
    # Limit work even when the cache is large or a directory is inaccessible.
    deadline = time.monotonic() + 2
    remaining = 5000
    count = size = 0
    partial = False
    directories = [(RADIO_CACHE, 2), ("/tmp", 0), ("/var/tmp", 0)]
    while directories:
        directory, depth = directories.pop()
        try:
            if not stat.S_ISDIR(os.lstat(directory).st_mode):
                partial = True
                continue
            with os.scandir(directory) as entries:
                for entry in entries:
                    if remaining == 0 or time.monotonic() >= deadline:
                        return {"files": count, "bytes": size, "partial": True}
                    remaining -= 1
                    try:
                        if depth and entry.is_dir(follow_symlinks=False):
                            directories.append((entry.path, depth - 1))
                            continue
                        if directory.startswith(RADIO_CACHE):
                            candidate = TEMP_NAME.search(entry.name)
                        else:
                            candidate = entry.name.lower().startswith("andrik-")
                        if not candidate:
                            continue
                        info = entry.stat(follow_symlinks=False)
                        if stat.S_ISREG(info.st_mode) and now - info.st_mtime >= TEMP_AGE:
                            count += 1
                            size += info.st_size
                    except FileNotFoundError:
                        continue
                    except OSError:
                        partial = True
        except FileNotFoundError:
            continue
        except OSError:
            partial = True
    return {"files": count, "bytes": size, "partial": partial}


def radio_signal(state):
    if state not in ("active", "reloading"):
        return "unchecked"
    try:
        with HTTP.open("http://127.0.0.1:8080/status", timeout=2) as response:
            body = json.loads(response.read(1024 * 1024 + 1))
    except (OSError, ValueError):
        return "unavailable"
    if isinstance(body, dict) and isinstance(body.get("ok"), bool):
        return "ok" if body["ok"] else "not-ready"
    return "unknown"


def collect():
    cpu = cpu_usage()
    services = service_states()
    radio_disk = None
    try:
        if os.stat(RADIO_CACHE).st_dev != os.stat("/").st_dev:
            radio_disk = disk_usage(RADIO_CACHE)
    except OSError:
        pass
    signal = radio_signal(services[RADIO_UNIT])
    ffmpeg = ffmpeg_processes()
    temporary = temporary_files(time.time())
    return {
        "version": "R1531",
        "sampledAt": time.time_ns() // 1_000_000,
        "disk": disk_usage("/"),
        "radioDisk": radio_disk,
        "ram": memory_usage(),
        "cpuPercent": cpu,
        "services": services,
        "radioSignal": signal,
        "ffmpeg": ffmpeg,
        "temporary": temporary,
    }


def send(path, credential, report=None):
    payload = json.dumps(report, separators=(",", ":")).encode() if report is not None else b""
    request = Request(
        BASE + "/api/agents/guard/" + path, data=payload,
        headers={"Authorization": "Bearer " + credential, "Content-Type": "application/json",
                 "User-Agent": "ANDRIK-GUARD/R1531"},
        method="POST",
    )
    try:
        with HTTP.open(request, timeout=10) as response:
            data = json.loads(response.read(16384))
    except HTTPError as error:
        hints = {
            400: "Проверь код подключения или системное время VPS.",
            401: "Выполни повторное подключение GUARD.",
            403: "Код истёк или уже использован. Получи новый в контрольке.",
            404: "Сначала опубликуй сайт R1531 и дождись завершения Deploy.",
        }
        hint = hints.get(error.code, "Проверь доступность контрольки.")
        raise RuntimeError(f"Сайт ответил HTTP {error.code}. {hint}") from None
    except (URLError, OSError, ValueError):
        raise RuntimeError("Не удалось получить ответ от контрольки. Проверь сеть VPS и сертификат HTTPS.") from None
    if not isinstance(data, dict) or data.get("ok") is not True:
        raise RuntimeError("Контролька вернула неожиданный ответ.")
    return data


def main():
    parser = argparse.ArgumentParser(description="ANDRIK GUARD R1531")
    parser.add_argument("action", choices=("check", "enroll", "publish"))
    args = parser.parse_args()
    if args.action == "check":
        print(json.dumps(collect(), indent=2))
    elif args.action == "enroll":
        code = sys.stdin.readline(100).strip().lower()
        if not re.fullmatch(r"[a-f0-9]{32}", code):
            raise RuntimeError("Нужен 32-символьный код из раздела GUARD.")
        token = send("enroll", code).get("token", "")
        if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
            raise RuntimeError("Контролька не вернула ключ GUARD.")
        print(token)
    else:
        token = TOKEN_FILE.read_text(encoding="ascii").strip()
        if not re.fullmatch(r"[a-f0-9]{64}", token):
            raise RuntimeError("Ключ GUARD повреждён. Выполни повторное подключение.")
        send("report", token, collect())
        print("GUARD R1531: отчёт принят контролькой.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError, KeyError) as error:
        print(f"GUARD: {error}", file=sys.stderr)
        sys.exit(1)
