#!/usr/bin/env python3
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener


SITE = "https://andrikmetal.com/api/agents/watch/"
RADIO = "http://127.0.0.1:8080/status"
TOKEN_FILE = Path("/etc/andrik-watch-r1532/token")
STATE_FILE = Path("/var/lib/andrik-watch-r1532/sample.json")
RECENT_MS = 180000
STALL_MS = 35000
MAX_OVERDUE_MS = 60000
PRIORITY = (
    "service-failed", "status-unreachable", "transport-stalled", "video-stalled",
    "signal-lost", "audio-silent", "clip-handoff", "ffmpeg-error",
)
FFMPEG_SCOPES = {"master-r816", "normal-rawvideo", "clip-av-r816", "station-av-r816"}
FFMPEG_FAILURE = re.compile(
    r"error|fail|invalid data|broken pipe|corrupt|missing picture|connection reset|timed out|"
    r"could not|conversion failed|no space left", re.I
)
CLIP_EVENTS = {"r1488-clip-mp3-failed", "r1139-normal-clip-soft-eof-cut"}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


HTTP = build_opener(ProxyHandler({}), NoRedirect())


def service_state():
    try:
        result = subprocess.run(
            ["systemctl", "show", "--no-pager", "--property=ActiveState,LoadState", "andrik-radio.service"],
            capture_output=True, text=True, timeout=3, check=False,
        )
        fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        if fields.get("LoadState") == "not-found":
            return "missing"
        return fields.get("ActiveState", "unknown")
    except (OSError, subprocess.TimeoutExpired):
        return "unknown"


def radio_status():
    try:
        with HTTP.open(RADIO, timeout=3) as response:
            data = json.loads(response.read(1024 * 1024 + 1))
        return data if isinstance(data, dict) and isinstance(data.get("ok"), bool) else None
    except (OSError, ValueError):
        return None


def as_dict(value):
    return value if isinstance(value, dict) else {}


def number(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 9_000_000_000_000_000:
        return None
    return int(value)


def millis(value):
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000) if dt.tzinfo else None
    except (ValueError, OverflowError, OSError):
        return None


def playback_item(data):
    item = as_dict(data)
    title = " ".join(str(item.get("title") or "").split())[:110]
    if not title or re.search(r"://|\bbearer\s|[?&](?:token|key)=", title, re.I):
        return None
    return {"title": title, "type": item.get("type") or "track"}


def prior_sample():
    try:
        return as_dict(json.loads(STATE_FILE.read_text(encoding="utf-8")))
    except (OSError, ValueError):
        return {}


def save_sample(sample):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=STATE_FILE.parent, delete=False) as file:
        staged = Path(file.name)
        try:
            json.dump(sample, file, separators=(",", ":"))
            file.close()
            os.replace(staged, STATE_FILE)
        finally:
            staged.unlink(missing_ok=True)


def recent(at, now):
    return at is not None and now - RECENT_MS <= at <= now + 1000


def audio_probe(previous, now):
    """Optional low-frequency local-only audio probe. Never probes public streams."""
    url = os.environ.get("ANDRIK_WATCH_AUDIO_URL", "").strip()
    if not url:
        return {"state": "not-configured"}, {}
    from urllib.parse import urlsplit
    parsed = urlsplit(url)
    if parsed.scheme not in ("http", "https") or parsed.hostname not in ("127.0.0.1", "localhost", "::1"):
        return {"state": "invalid-url"}, {}
    old = as_dict(previous.get("audioProbe"))
    last = number(old.get("checkedAt")) or 0
    if 0 <= now - last < 120000:
        return {"state": old.get("state", "unknown"), "checkedAt": last}, old
    try:
        # Analyze 4 s of decoded audio only. No transcoding or output file.
        result = subprocess.run(["/usr/bin/ffmpeg", "-nostdin", "-hide_banner", "-nostats", "-loglevel", "info",
            "-rw_timeout", "5000000", "-i", url, "-map", "0:a:0", "-t", "4", "-af",
            "silencedetect=noise=-48dB:d=3", "-f", "null", "-"],
            capture_output=True, text=True, timeout=12, check=False)
        logs = result.stderr[-12000:]
        if result.returncode != 0:
            state = "probe-failed"
        elif "silence_start:" in logs and "silence_end:" not in logs:
            state = "silent"
        else:
            state = "audible"
    except (OSError, subprocess.TimeoutExpired, ValueError):
        state = "probe-failed"
    consecutive = (int(old.get("consecutive", 0)) + 1) if state == "silent" else 0
    record = {"state": state, "checkedAt": now, "consecutive": min(100, consecutive)}
    return {"state": state, "checkedAt": now, "consecutive": record["consecutive"]}, record


def classify(service, status, prior, now):
    active = service in ("active", "reloading")
    condition = {}
    event = {}
    report = {
        "version": "R1532", "sampledAt": now, "state": "unavailable",
        "current": None, "next": None, "changedAt": None,
        "frameAgeMs": None, "ffmpegErrors": None, "issue": None, "incidentAt": None, "persistent": False,
    }
    if service in ("inactive", "deactivating", "missing"):
        report["state"] = "off"
    elif service == "failed":
        condition["service-failed"] = True
        report["state"] = "degraded"
    elif service == "activating":
        report["state"] = "starting"
    elif status is None:
        if active:
            condition["status-unreachable"] = True
    else:
        report["state"] = "on-air" if status["ok"] else "degraded"
        report["current"] = playback_item(status.get("current"))
        report["next"] = playback_item(status.get("next"))
        current = as_dict(status.get("current"))
        started = millis(status.get("startedAt"))
        item_at = millis(current.get("startedAt"))
        report["changedAt"] = item_at
        warming = started is not None and 0 <= now - started < 90000
        just_switched = item_at is not None and 0 <= now - item_at < 18000
        engine = as_dict(status.get("runtimeMetricsR1160K"))
        video = as_dict(status.get("videoOutputWatchdogR1422"))
        if not video:
            video = as_dict(engine.get("videoOutputWatchdogR1422"))
        if video.get("progressSeen") and video.get("publisherPid") == engine.get("publisherPid"):
            report["frameAgeMs"] = number(video.get("encodedGapMs"))
        fallback_frame = millis(status.get("lastVideoFrameAtR816"))
        if report["frameAgeMs"] is None and fallback_frame is not None and fallback_frame <= now:
            report["frameAgeMs"] = now - fallback_frame
        watchdog = as_dict(status.get("watchdogR1293"))
        transport = as_dict(watchdog.get("r1124Legacy"))
        threshold = max(STALL_MS, number(transport.get("stallThresholdMs")) or 0)
        handoff = just_switched or bool(status.get("stationHandoffActiveR804") and
                                        report["frameAgeMs"] is not None and report["frameAgeMs"] < STALL_MS)

        if warming and not status["ok"]:
            report["state"] = "starting"
        if not warming and not handoff:
            condition["signal-lost"] = active and (
                not status["ok"] or status.get("publisherRunning") is False or status.get("transportHealthy") is False
            )
            condition["video-stalled"] = active and (
                (report["frameAgeMs"] or 0) >= STALL_MS or video.get("blackBridgeStuck") is True
            )
            condition["transport-stalled"] = active and transport.get("probeAvailable") is True and (
                number(transport.get("stallMs")) or 0
            ) >= threshold
        duration = number(current.get("duration"))
        if active and status.get("clipActive") and duration and item_at:
            condition["clip-handoff"] = now > item_at + duration * 1000 + MAX_OVERDUE_MS

        counters = status.get("ffmpegLogCountersR1160K")
        if isinstance(counters, dict):
            report["ffmpegErrors"] = sum(number(as_dict(entry).get("chunks")) or 0 for entry in counters.values())
            failures = [millis(entry.get("lastAt")) for scope, entry in counters.items()
                        if scope in FFMPEG_SCOPES and isinstance(entry, dict) and
                        FFMPEG_FAILURE.search(str(entry.get("lastLine", "")))]
            times = [at for at in failures if recent(at, now)]
            if times and not warming:
                event["ffmpeg-error"] = max(times)
        fatal_at = millis(status.get("lastTransportFatalAt"))
        if recent(fatal_at, now) and not warming:
            reason = str(status.get("lastTransportFatalReason") or "").lower()
            if any(text in reason for text in ("no-progress", "zero rtmps", "rtmps ack")):
                event["transport-stalled"] = fatal_at
        # R1544: explicit skip evidence from radio status, not heuristic ffmpeg warnings.
        candidates = []
        for field, kind in (("lastUnreadyClipR1469", "not-ready"),
                            ("lastNormalClipDeferred", "handoff-failed")):
            raw = as_dict(status.get(field))
            at = millis(raw.get("at"))
            title = " ".join(str(raw.get("title") or "").split())[:110]
            if at is not None and title and 0 <= now - at < 24 * 3600 * 1000 and                     not re.search(r"://|\bbearer\s|[?&](?:token|key)=", title, re.I):
                candidates.append({"at": at, "title": title, "kind": kind,
                                   "reason": " ".join(str(raw.get("reason") or
                                      ("Видео не было готово к переходу" if kind == "not-ready" else "Переход не удался после повторов")).split())[:150]})
        report["clipEvent"] = max(candidates, key=lambda x: x["at"]) if candidates else None
        clip_events = [
            millis(as_dict(status.get("lastClipGuardRecovery")).get("at")),
            millis(status.get("lastInsertRecoveryAt")),
            millis(as_dict(status.get("lastNormalClipSoftEofR1139")).get("at")),
        ]
        events = as_dict(status.get("diagnosticsR802")).get("events")
        if isinstance(events, list):
            clip_events.extend(millis(e.get("at")) for e in events[-80:] if isinstance(e, dict)
                               and e.get("event") in CLIP_EVENTS)
        times = [at for at in clip_events if recent(at, now)]
        if times and not warming:
            event["clip-handoff"] = max(times)

    previous = as_dict(prior.get("conditions"))
    previous_at = number(prior.get("sampledAt"))
    if previous_at is None or not 0 <= now - previous_at <= 120000:
        previous = {}
    conditions = {}
    for issue, detected in condition.items():
        if detected:
            conditions[issue] = number(previous.get(issue)) or now
    ready = {issue: since + 25000 for issue, since in conditions.items() if now - since >= 25000}
    for issue, at in event.items():
        ready.setdefault(issue, at)
    for issue in PRIORITY:
        if issue in ready:
            report["issue"] = issue
            report["incidentAt"] = ready[issue]
            report["persistent"] = issue in conditions
            if issue in conditions and report["state"] == "on-air":
                report["state"] = "degraded"
            break
    if active and status is not None and status.get("ok"):
        audio, saved_audio = audio_probe(prior, now)
    else:
        audio, saved_audio = {"state": "not-checked"}, as_dict(prior.get("audioProbe"))
    report["audioProbe"] = audio
    if audio.get("state") == "silent" and audio.get("consecutive", 0) >= 3 and not report["issue"]:
        report["issue"] = "audio-silent"
        report["incidentAt"] = number(saved_audio.get("checkedAt")) or now
        report["persistent"] = True
        report["state"] = "degraded"
    return report, {"sampledAt": now, "conditions": conditions, "audioProbe": saved_audio}


def collect(previous, now):
    service = service_state()
    status = radio_status() if service in ("active", "reloading", "unknown") else None
    return classify(service, status, previous, now)


def send(action, credential, data=None):
    req = Request(SITE + action, data=json.dumps(data, separators=(",", ":")).encode() if data is not None else b"",
                  method="POST", headers={"Authorization": "Bearer " + credential,
                  "Content-Type": "application/json", "User-Agent": "ANDRIK-WATCH/R1532"})
    try:
        with HTTP.open(req, timeout=10) as response:
            result = json.loads(response.read(16384))
    except HTTPError as error:
        hints = {
            400: "Проверь код или системное время VPS.",
            401: "Получи новый код WATCH в контрольке и повтори подключение.",
            403: "Код истёк или уже использован.",
            404: "Опубликуй R1532 и дождись завершения Deploy.",
        }
        raise RuntimeError(f"HTTP {error.code}. {hints.get(error.code, 'Проверь доступность контрольки.')}") from None
    except (OSError, ValueError):
        raise RuntimeError("Не удалось получить ответ от контрольки по HTTPS.") from None
    if not isinstance(result, dict) or result.get("ok") is not True:
        raise RuntimeError("Контролька вернула неожиданный ответ.")
    return result


def main():
    parser = argparse.ArgumentParser(description="ANDRIK WATCH R1532")
    parser.add_argument("action", choices=("check", "enroll", "publish"))
    action = parser.parse_args().action
    if action == "enroll":
        code = sys.stdin.readline(100).strip().lower()
        if not re.fullmatch(r"[a-f0-9]{32}", code):
            raise RuntimeError("Нужен одноразовый код WATCH из «AI Агенты».")
        token = send("enroll", code).get("token", "")
        if not isinstance(token, str) or not re.fullmatch(r"[a-f0-9]{64}", token):
            raise RuntimeError("Контролька не вернула ключ WATCH.")
        print(token)
        return
    previous = prior_sample() if action == "publish" else {}
    report, sample = collect(previous, time.time_ns() // 1000000)
    if action == "check":
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return
    token = TOKEN_FILE.read_text(encoding="ascii").strip()
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        raise RuntimeError("Повтори подключение WATCH.")
    save_sample(sample)
    send("report", token, report)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, OSError) as error:
        print(f"WATCH: {error}", file=sys.stderr)
        sys.exit(1)
