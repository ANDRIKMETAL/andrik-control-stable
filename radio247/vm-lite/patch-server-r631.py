#!/usr/bin/env python3
from pathlib import Path
import re

p=Path('/opt/andrik-radio/radio247/server.mjs')
s=p.read_text()

# R631 sits on top of R629: keep direct RTMPS / no FIFO / low-load 1080p,
# but make audio encoding cheaper and more tolerant of clock drift.
s=s.replace("version: 'R629-LOWLOAD-1080P25-LIVE-TICKER-AUDIO-STABLE',", "version: 'R631-1080P25-AUDIO-FAST-STABLE-RADIO-HUB',")
s=s.replace("audioMode: 'LOCAL MP3 CACHE + 2-TRACK PREFETCH / PTS REBUILD / AAC-LC 48kHz stereo 192kbps / DIRECT RTMPS NO FIFO',",
            "audioMode: 'LOCAL MASTER CACHE / AAC-LC FAST 48kHz stereo 160kbps / ASYNC CLOCK REPAIR / DIRECT RTMPS NO FIFO',")
s=s.replace("mode: 'AUTO SINGLES + DEDUPE / PRIVATE R2 MASTER -> LOCAL AWS CACHE / 1080p25 LOW-LOAD / DIRECT RTMPS / LIVE TICKER / DAYPART VISUALS + QR',",
            "mode: '1080p25 LOW-LOAD / DIRECT RTMPS / AUDIO FAST-STABLE / LIVE TICKER / DAYPART VISUALS + QR / TRIKA OFFICIAL RELEASE REFERENCE',")

# Native AAC fast coder: materially lighter than twoloop on tiny EC2 CPUs.
s=s.replace("'-aac_coder','twoloop'", "'-aac_coder','fast'")
# Stronger drift repair; first_pts keeps every track starting from a clean audio clock.
s=s.replace("'-af','aresample=48000:async=1:first_pts=0,asetpts=N/SR/TB'",
            "'-af','aresample=48000:async=1000:min_hard_comp=0.100:first_pts=0,asetpts=N/SR/TB'")
# If prior R629 text differs, still normalize the filter.
s=re.sub(r"'-af','aresample=48000:[^']*first_pts=0[^']*'",
         "'-af','aresample=48000:async=1000:min_hard_comp=0.100:first_pts=0,asetpts=N/SR/TB'", s)

# Give the muxer room during brief CPU spikes instead of disturbing audio packets.
if "'-max_muxing_queue_size','2048'" not in s:
    s=s.replace("'-flush_packets','1',", "'-max_muxing_queue_size','2048',\n    '-flush_packets','1',")

p.write_text(s)
print('R631 server audio patch ✅')
