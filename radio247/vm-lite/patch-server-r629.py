#!/usr/bin/env python3
from pathlib import Path
import re

p=Path('/opt/andrik-radio/radio247/server.mjs')
s=p.read_text()

# Idempotent R629 constants/state patch.
s=re.sub(r"const OUTPUT_TIMESHIFT_SECONDS = Number\(process\.env\.OUTPUT_TIMESHIFT_SECONDS \|\| \d+\);", "const OUTPUT_TIMESHIFT_SECONDS = Number(process.env.OUTPUT_TIMESHIFT_SECONDS || 0);", s)
s=re.sub(r"const TIMESTAMP_GUARD_SECONDS = Number\(process\.env\.TIMESTAMP_GUARD_SECONDS \|\| [0-9.]+\);", "const TIMESTAMP_GUARD_SECONDS = Number(process.env.TIMESTAMP_GUARD_SECONDS || 0.02);", s)
s=re.sub(r"const VIDEO_BITRATE = process\.env\.VIDEO_BITRATE \|\| '[^']+';", "const VIDEO_BITRATE = process.env.VIDEO_BITRATE || '4500k';", s)
if 'const LIVE_TICKER_FILE' not in s:
    anchor="const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));"
    insert=anchor+"\nconst LIVE_TICKER_FILE = process.env.LIVE_TICKER_FILE || `${CACHE_DIR}/live-ticker.txt`;\nconst DEFAULT_LIVE_TICKER = 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';"
    if anchor not in s: raise SystemExit('R629 patch: constants anchor not found')
    s=s.replace(anchor,insert)

s=re.sub(r"version: '[^']+',", "version: 'R629-LOWLOAD-1080P25-LIVE-TICKER-AUDIO-STABLE',", s, count=1)
s=re.sub(r"mode: '[^']+',", "mode: 'AUTO SINGLES + DEDUPE / PRIVATE R2 MASTER -> LOCAL AWS CACHE / 1080p25 LOW-LOAD / DIRECT RTMPS / LIVE TICKER / DAYPART VISUALS + QR',", s, count=1)
s=re.sub(r"overlayMode: '[^']+',", "overlayMode: 'QR TOP-LEFT / YELLOW TRACK TEXT WITH BLACK OUTLINE / LIVE TICKER / NO BARS',", s, count=1)
s=re.sub(r"audioMode: '[^']+',", "audioMode: 'LOCAL MP3 CACHE + 2-TRACK PREFETCH / PTS REBUILD / AAC-LC 48kHz stereo 192kbps / DIRECT RTMPS NO FIFO',", s, count=1)

start=s.find('function startPublisher(){')
end=s.find('function producerArgs(',start)
if start<0 or end<0: raise SystemExit('R629 patch: startPublisher block not found')
s=s[:start]+"function startPublisher(){\n  if(!STREAM_URL){\n    state.lastError='YOUTUBE_STREAM_KEY is not configured';\n    return false;\n  }\n\n  const args=[\n    '-hide_banner','-loglevel','warning',\n    '-fflags','+genpts+discardcorrupt',\n    '-analyzeduration','5000000','-probesize','5000000',\n    '-thread_queue_size','8192',\n    '-i','pipe:0',\n    '-map','0:v:0','-map','0:a:0',\n    '-c:v','copy','-c:a','copy',\n    '-tag:v','7','-tag:a','10',\n    '-tcp_nodelay','1',\n    // R629: direct RTMPS. No fifo/timeshift queue that can accumulate delay or duplicate/drop audio packets.\n    '-f','flv','-flvflags','no_duration_filesize',\n    STREAM_URL\n  ];\n\n  publisher=spawn('ffmpeg',args,{stdio:['pipe','ignore','pipe']});\n  state.publisherRunning=true;\n  state.streamStartedAt=new Date().toISOString();\n\n  publisher.stderr.on('data',d=>{\n    const line=String(d||'').trim();\n    if(line){\n      state.lastFfmpegLine=line.slice(-1000);\n      if(/error|fail|invalid|broken pipe/i.test(line))state.lastError=line.slice(-700);\n      console.error('[publisher]',line);\n    }\n  });\n\n  publisher.on('exit',(code,signal)=>{\n    state.publisherRunning=false;\n    state.lastExit={layer:'publisher',code,signal,at:new Date().toISOString()};\n    publisher=null;\n    if(!stopping)setTimeout(()=>process.exit(code||22),2500).unref();\n  });\n\n  publisher.on('error',err=>{state.lastError=String(err);});\n  return true;\n}\n\n"+s[end:]

start=s.find('function producerArgs(')
end=s.find('async function playItem(',start)
if start<0 or end<0: raise SystemExit('R629 patch: producerArgs block not found')
s=s[:start]+"function producerArgs(item,duration,offset,visualPath,previous,next){\n  prepareCacheDir();\n  const key=createHash('sha1').update([previous?.url||'',item?.url||'',next?.url||'',Date.now()].join('|')).digest('hex').slice(0,12);\n  const currentFile=`${CACHE_DIR}/current-live-${key}.txt`;\n\n  // R629: only the track title remains above the ticker. No “СЕЙЧАС:” prefix.\n  writeFileSync(currentFile,trackLabel(item,'ANDRIK'),'utf8');\n  if(!existsSync(LIVE_TICKER_FILE)) writeFileSync(LIVE_TICKER_FILE,DEFAULT_LIVE_TICKER,'utf8');\n\n  const font=chooseFont();\n  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';\n  const curPath=ffFilterPath(currentFile), tickerPath=ffFilterPath(LIVE_TICKER_FILE);\n\n  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000){\n    throw new Error(`R615 QR overlay missing or too small: ${QR_OVERLAY}`);\n  }\n\n  const baseVf=[\n    // R629 low-load 1080p: original masters stay 1080p, but filters/encoder are cheaper.\n    'scale=1920:1080:flags=fast_bilinear',\n    'setsar=1',\n    'fps=25',\n    `tpad=stop_mode=clone:stop_duration=${Math.ceil(duration)+10}`,\n    'format=yuv420p',\n    // No translucent strips and no yellow plaque. Just outlined text over the video.\n    `drawtext=${fontPart}textfile='${curPath}':fontcolor=yellow:fontsize=56:x=(w-text_w)/2:y=h-158:borderw=4:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`,\n    // Stable file + reload=1 makes the running line update live without restarting FFmpeg.\n    `drawtext=${fontPart}textfile='${tickerPath}':reload=25:fontcolor=yellow:fontsize=36:x='w-mod(t*180,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=1:shadowy=1`\n  ].join(',');\n  const filterComplex=`[1:v]${baseVf}[base];[2:v]scale=180:180:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=8:24:format=yuv420[outv]`;\n\n  const inputArgs=[\n    '-hide_banner','-loglevel','warning',\n    '-thread_queue_size','4096','-re','-i',item.localAudioPath||item.url,\n    '-thread_queue_size','4096','-stream_loop','-1','-i',visualPath,\n    '-loop','1','-framerate','1','-i',QR_OVERLAY,\n    '-filter_complex',filterComplex,\n    '-map','[outv]','-map','0:a:0'\n  ];\n\n  return {tempFiles:[currentFile],args:[\n    ...inputArgs,\n    '-t',duration.toFixed(3),\n    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',\n    '-profile:v','high','-level:v','4.1',\n    '-b:v',VIDEO_BITRATE,'-minrate',VIDEO_BITRATE,'-maxrate',VIDEO_BITRATE,'-bufsize','9000k',\n    '-x264-params','nal-hrd=cbr:force-cfr=1:repeat-headers=1',\n    '-g','50','-keyint_min','50','-sc_threshold','0','-r','25','-threads','2','-pix_fmt','yuv420p',\n    '-af','aresample=48000:async=1:first_pts=0,asetpts=N/SR/TB',\n    '-c:a','aac','-profile:a','aac_low','-aac_coder','twoloop','-b:a',AUDIO_BITRATE,'-ar','48000','-ac','2',\n    '-flush_packets','1',\n    '-muxdelay','0','-muxpreload','0',\n    '-output_ts_offset',offset.toFixed(6),'-mpegts_flags','+resend_headers+initial_discontinuity','-f','mpegts','pipe:1'\n  ]};\n}\n\n"+s[end:]

p.write_text(s)
print('R629 server patch ✅')
