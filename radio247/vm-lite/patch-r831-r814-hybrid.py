from pathlib import Path
import re,sys
p=Path(sys.argv[1]); s=p.read_text(encoding='utf-8')

def sub1(pattern,repl,label,flags=0):
    global s
    s2,n=re.subn(pattern,repl,s,count=1,flags=flags)
    if n!=1:
        raise SystemExit(f'ERROR {label}: expected 1 match, got {n}')
    s=s2

# Identity/version
sub1(r"version:\s*'R814-[^']+'", "version: 'R831-R814-GOLDEN-HYBRID-R828-R827-R826-SMOOTH-FADE'", 'version')
sub1(r"mode:\s*'R814[^']+'", "mode: 'R831 EXACT WORKING R814 VIDEO ENGINE + R828 LIGHT CHECK + R827 COMMIT LOCK + R826 EOF SELF-HEAL + EARLY SMOOTH FADE'", 'mode')

# Keep exact R814 geometry untouched; assert it exists.
fit_l="scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
fit_f="scale=1920:1080:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1"
if f"const FULL_FRAME_FILTER_R787 = '{fit_l}';" not in s: raise SystemExit('ERROR exact R814 FULL_FRAME geometry missing')
if f"const LIVE_FULL_FRAME_FILTER_R794 = '{fit_f}';" not in s: raise SystemExit('ERROR exact R814 LIVE geometry missing')

# Smoother/earlier fades, without changing renderer.
sub1(r"const VIDEO_FADE_SECONDS_R726 = [0-9.]+;", "const VIDEO_FADE_SECONDS_R726 = 2.65;", 'video fade')
sub1(r"const VIDEO_FADE_IN_SECONDS_R736 = [0-9.]+;", "const VIDEO_FADE_IN_SECONDS_R736 = 1.20;", 'video fade in')
sub1(r"const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = [0-9.]+;", "const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10;", 'mp3 fade out')
sub1(r"const MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = [0-9.]+;", "const MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20;", 'mp3 hold')
sub1(r"const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = [0-9.]+;", "const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50;", 'mp3 fade in')
sub1(r"const CLIP_TO_TRACK_FADE_IN_SECONDS_R753 = Math\.max\(0\.25,Math\.min\(1\.5,Number\(process\.env\.CLIP_TO_TRACK_FADE_IN_SECONDS_R753 \|\| [0-9.]+\)\)\);", "const CLIP_TO_TRACK_FADE_IN_SECONDS_R753 = Math.max(0.25,Math.min(1.5,Number(process.env.CLIP_TO_TRACK_FADE_IN_SECONDS_R753 || 1.10)));", 'clip->track fade')
sub1(r"const VIDEO_INSERT_FADE_IN_SECONDS_R757 = Math\.max\(0\.25,Math\.min\(1\.5,Number\(process\.env\.VIDEO_INSERT_FADE_IN_SECONDS_R757 \|\| [0-9.]+\)\)\);", "const VIDEO_INSERT_FADE_IN_SECONDS_R757 = Math.max(0.25,Math.min(1.5,Number(process.env.VIDEO_INSERT_FADE_IN_SECONDS_R757 || 1.10)));", 'insert fade')
# Warm insert metadata earlier (no live frames)
sub1(r"const INSERT_CACHE_WARM_LEAD_SECONDS_R752 = Math\.max\(2,Math\.min\(8,Number\(process\.env\.INSERT_CACHE_WARM_LEAD_SECONDS_R752 \|\| [0-9.]+\)\)\);", "const INSERT_CACHE_WARM_LEAD_SECONDS_R752 = Math.max(2,Math.min(8,Number(process.env.INSERT_CACHE_WARM_LEAD_SECONDS_R752 || 8.0)));", 'warm lead')
# Queue headroom only; does not alter R814 visual composition.
sub1(r"const VIDEO_INPUT_QUEUE_PACKETS_R732 = \d+;", "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;", 'video queue')

# Genuine dead FLV publisher self-heal (R826)
sub1(r"const OUTPUT_FATAL_REGEX_R780 = /([^\n]+)/i;", lambda m: "const OUTPUT_FATAL_REGEX_R780 = /" + (m.group(1) if 'extract_extradata' in m.group(1) else m.group(1)+"|a non-NULL packet sent after an EOF|failed to send packet to filter extract_extradata") + "/i;", 'output fatal regex')

# More diagnostic signal; no killing on queue warning.
sub1(r"if\(!/error\|fail\|invalid\|broken pipe\|non-monoton\|corrupt\|missing picture\|nal unit\|timestamp\|dts/i\.test\(String\(line\|\|''\)\)\)return;",
     "if(!/error|fail|invalid|broken pipe|non-monoton|corrupt|missing picture|nal unit|timestamp|dts|thread message queue blocking|queue blocking/i.test(String(line||'')))return;", 'diag regex')

# R828 persistent station integrity quick check.
start=s.find("function purgePreparedStationR802(sourcePath,{purgeSource=false}={}){")
end=s.find("\nfunction bumperSlotR724(item){",start)
if start<0 or end<0: raise SystemExit('ERROR station integrity block not found')
new_integrity=r'''const STATION_INTEGRITY_MARKER_R828='.r828-integrity-ok';
function stationIntegritySigR828(path){
  const st=statSync(path);
  return `${st.size}:${Math.trunc(st.mtimeMs)}`;
}
function stationIntegrityMarkerPathR828(path){return `${path}${STATION_INTEGRITY_MARKER_R828}`;}
function stationIntegrityMarkR828(path,sig=stationIntegritySigR828(path)){
  try{writeFileSync(stationIntegrityMarkerPathR828(path),`${sig}\n`,'utf8')}catch(_){ }
  stationIntegrityCacheR802.set(path,sig);
}
function stationIntegrityPersistedR828(path,sig){
  try{return cleanText(readFileSync(stationIntegrityMarkerPathR828(path),'utf8'))===sig}catch(_){return false}
}
function purgePreparedStationR802(sourcePath,{purgeSource=false}={}){
  const ready=preparedClipPathR742(sourcePath);
  for(const f of [ready,preparedClipTitleFileR742(ready),preparedClipTickerFileR742(ready),ready+STATION_PREP_MARKER_R791,ready+STATION_INTEGRITY_MARKER_R828]){
    try{if(existsSync(f))unlinkSync(f)}catch(_){ }
    stationIntegrityCacheR802.delete(f);
  }
  if(purgeSource){
    try{if(existsSync(sourcePath))unlinkSync(sourcePath)}catch(_){ }
    try{if(existsSync(sourcePath+STATION_INTEGRITY_MARKER_R828))unlinkSync(sourcePath+STATION_INTEGRITY_MARKER_R828)}catch(_){ }
    stationIntegrityCacheR802.delete(sourcePath);
  }
}
// R828-PERSISTENT-STATION-INTEGRITY: no repeated full ffmpeg decode on live path.
async function assertStationIntegrityR802(path,label='station-media'){
  const st=statSync(path);
  if(st.size<500000)throw new Error(`R828 ${label} file too small: ${st.size}`);
  const sig=`${st.size}:${Math.trunc(st.mtimeMs)}`;
  if(stationIntegrityCacheR802.get(path)===sig)return true;
  if(stationIntegrityPersistedR828(path,sig)){
    stationIntegrityCacheR802.set(path,sig);
    diagRecordR802('station-integrity-persist-hit-r828',{stage:label,media:diagMediaR802(path),bytes:st.size});
    return true;
  }
  const preparedTrusted=String(path).includes(CLIP_PREP_SUFFIX_R782)&&existsSync(path+STATION_PREP_MARKER_R791);
  if(preparedTrusted){
    stationIntegrityMarkR828(path,sig);
    diagRecordR802('station-integrity-trusted-r828',{stage:label,media:diagMediaR802(path),bytes:st.size});
    return true;
  }
  try{
    const raw=await runCapture('ffprobe',['-v','error','-show_entries','stream=codec_type:format=duration','-of','json',path],{timeoutMs:8000});
    const probe=JSON.parse(String(raw||'{}'));
    const types=new Set((probe.streams||[]).map(x=>String(x?.codec_type||'')));
    const duration=Number(probe?.format?.duration||0);
    if(!types.has('video'))throw new Error('video stream missing');
    if(!types.has('audio'))throw new Error('audio stream missing');
    if(!(duration>0.25))throw new Error(`invalid duration ${duration}`);
    stationIntegrityMarkR828(path,sig);
    diagRecordR802('station-integrity-quick-ok-r828',{stage:label,media:diagMediaR802(path),bytes:st.size,duration:Number(duration.toFixed(3))});
    return true;
  }catch(error){
    diagRecordR802('station-integrity-fail',{stage:label,media:diagMediaR802(path),bytes:st.size,error:cleanText(error?.message||error)});
    throw new Error(`R828 ${label} invalid: ${diagMediaR802(path)}: ${cleanText(error?.message||error)}`);
  }
}
'''
s=s[:start]+new_integrity+s[end:]

# R791/R822: force insert playback audio timestamps to zero before resample too.
s=s.replace("? `aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,apad=pad_dur=${d.toFixed(3)},atrim=duration=${d.toFixed(3)},asetpts=N/SR/TB`\n    : `aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,asetpts=N/SR/TB`;",
            "? `asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,apad=pad_dur=${d.toFixed(3)},atrim=duration=${d.toFixed(3)},asetpts=N/SR/TB`\n    : `asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,asetpts=N/SR/TB`;",1)
if "const audioTailLockR766=d>0\n    ? `asetpts=PTS-STARTPTS" not in s: raise SystemExit('ERROR audio playback PTS patch failed')

# R827 commit lock adapted to the R814 H264 engine.
if "let insertCommittedR827=false;" not in s:
    sub1(r"(\n  let child=null;\n  let clipExitPromise=null;)", r"\1\n  let insertCommittedR827=false;", 'r827 flag')

live_marker="    diagRecordR802(stationInsert?'station-live-connected':'clip-live-connected',{title:item.title||'VIDEO',childPid:Number(child.pid||0)});"
if live_marker not in s: raise SystemExit('ERROR live-connected marker missing')
s=s.replace(live_marker,
"""    insertCommittedR827=true;\n    diagRecordR802('r827-insert-commit-locked',{title:item.title||'VIDEO',station:stationInsert,childPid:Number(child.pid||0)});\n"""+live_marker,1)

old_eof="""    try{\n      await promiseTimeout(clipExitPromise,guardMs,`R752 clip EOF ${shortText(item.title||'VIDEO',40)}`);\n    }catch(error){\n      state.lastError=`R752 clip EOF guard: ${cleanText(error?.message||error)}`;\n      if(child&&child.exitCode===null){\n        try{child.kill('SIGTERM')}catch(_){ }\n        if(!(await waitChildExit(child,1200))&&child.exitCode===null){try{child.kill('SIGKILL')}catch(_){ }await waitChildExit(child,250);}\n      }\n      return false;\n    }\n    if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;\n    state.lastError='';\n    return !stopping;"""
new_eof="""    try{\n      await promiseTimeout(clipExitPromise,guardMs,`R752 clip EOF ${shortText(item.title||'VIDEO',40)}`);\n    }catch(error){\n      const reasonR827=cleanText(error?.message||error);\n      if(child&&child.exitCode===null){\n        try{child.kill('SIGTERM')}catch(_){ }\n        if(!(await waitChildExit(child,1200))&&child.exitCode===null){try{child.kill('SIGKILL')}catch(_){ }await waitChildExit(child,250);}\n      }\n      if(insertCommittedR827){\n        if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;\n        state.lastWarning=`R827 committed insert EOF recovery: ${shortText(item.title||'VIDEO',40)}: ${reasonR827}`;\n        diagRecordR802('r827-committed-insert-eof-no-retry',{title:item.title||'VIDEO',station:stationInsert,reason:shortText(reasonR827,180)});\n        state.lastError='';\n        return true;\n      }\n      state.lastError=`R752 clip EOF guard: ${reasonR827}`;\n      return false;\n    }\n    if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;\n    state.lastError='';\n    return true;"""
if old_eof not in s: raise SystemExit('ERROR R814 EOF block not found')
s=s.replace(old_eof,new_eof,1)

old_catch="""  }catch(error){\n    if(stationInsert)stationHandoffActiveR804=false;\n    state.lastError=`R752 VIDEO/AUDIO boundary handoff: ${cleanText(error?.message||error)}`;\n    console.error('[r752-video-clip]',error);\n    if(child&&child.exitCode===null){try{child.kill('SIGTERM')}catch(_){ }}\n    await abortInsertHandoffR749(item,next,cleanText(error?.message||error));\n    return false;\n  }finally{"""
new_catch="""  }catch(error){\n    if(stationInsert)stationHandoffActiveR804=false;\n    const reasonR827=cleanText(error?.message||error);\n    console.error('[r752-video-clip]',error);\n    if(child&&child.exitCode===null){try{child.kill('SIGTERM')}catch(_){ }}\n    if(insertCommittedR827){\n      if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;\n      state.lastWarning=`R827 committed insert post-live recovery: ${shortText(item.title||'VIDEO',40)}: ${reasonR827}`;\n      diagRecordR802('r827-committed-insert-error-no-retry',{title:item.title||'VIDEO',station:stationInsert,reason:shortText(reasonR827,180)});\n      state.lastError='';\n      return true;\n    }\n    state.lastError=`R752 VIDEO/AUDIO boundary handoff: ${reasonR827}`;\n    await abortInsertHandoffR749(item,next,reasonR827);\n    return false;\n  }finally{"""
if old_catch not in s: raise SystemExit('ERROR R814 outer catch not found')
s=s.replace(old_catch,new_catch,1)

retry_marker="""        }else{\n          // R814 CLIP LOCK:"""
if retry_marker not in s: raise SystemExit('ERROR retry marker missing')
s=s.replace(retry_marker,"""        }else{\n          // R827-SHUTDOWN-NO-CLIP-RETRY\n          if(stopping){normalClipRetryR814.delete(primaryIdentity(item));break;}\n          // R814 CLIP LOCK:""",1)

# State markers for diagnostics. Insert after fullFrameGuardMode.
needle="  fullFrameGuardMode: 'R790-R787-VIEWER-PROVEN-FIT-PAD-1920x1080-SAR1-NO-CROP',"
if needle not in s: raise SystemExit('ERROR state marker anchor missing')
s=s.replace(needle,needle+"\n    r814GoldenHybridR831:true,\n    clipCommitLockR827:true,\n    stationIntegrityLightR828:true,\n    outputEofSelfHealR826:true,\n    falseFrameStallKillDisabledR831:true,",1)


# Accurate public diagnostics for R831 timings/flags.
s=s.replace("videoFadeStrategy:'R814-MP3-ONLY-1.10S-HOLD-0.20S-LIGHT-1.15S / OTHER-BOUNDARIES-PRESERVED'","videoFadeStrategy:'R831-MP3-ONLY-3.10S-HOLD-0.20S-LIGHT-1.50S / OTHER-BOUNDARIES-2.65S'")
s=s.replace("fadeEngineR795:'R814-ABSOLUTE-TIMELINE-ALPHA-MASK-110-BLACK-HOLD-115-RECOVER'","fadeEngineR795:'R831-R814-ABSOLUTE-TIMELINE-ALPHA-MASK-310-BLACK-HOLD-150-RECOVER'")
s=s.replace("fadeRuntimePolicyR796:'R814-R809-ABSOLUTE-ALPHA-MASK-110-020-115'","fadeRuntimePolicyR796:'R831-R809-ABSOLUTE-ALPHA-MASK-310-020-150'")
status_anchor="    videoInputQueuePackets:VIDEO_INPUT_QUEUE_PACKETS_R732,"
if status_anchor in s and "r814GoldenHybridR831:state.r814GoldenHybridR831" not in s:
    s=s.replace(status_anchor,"    r814GoldenHybridR831:Boolean(state.r814GoldenHybridR831),\n    clipCommitLockR827:Boolean(state.clipCommitLockR827),\n    stationIntegrityLightR828:Boolean(state.stationIntegrityLightR828),\n    outputEofSelfHealR826:Boolean(state.outputEofSelfHealR826),\n    falseFrameStallKillDisabledR831:Boolean(state.falseFrameStallKillDisabledR831),\n"+status_anchor,1)

# Ensure forbidden later rawvideo architecture did not sneak in.
for forbidden in ['R816-PERSISTENT-RAWVIDEO-SINGLE-X264','R820-DETERMINISTIC-MASTER-PTS-LOCK','STATION_LEGACY_DRAIN_DISABLED_R821','r823-live-frame-stall','process.exit(77)']:
    if forbidden in s: raise SystemExit('ERROR incompatible token: '+forbidden)

# Required markers
required=[
 "version: 'R831-R814-GOLDEN-HYBRID-R828-R827-R826-SMOOTH-FADE'",
 "const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 3.10;",
 "const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.50;",
 "const VIDEO_INPUT_QUEUE_PACKETS_R732 = 24;",
 'a non-NULL packet sent after an EOF',
 'failed to send packet to filter extract_extradata',
 'R828-PERSISTENT-STATION-INTEGRITY',
 'r827-insert-commit-locked',
 'r827-committed-insert-eof-no-retry',
 'r827-committed-insert-error-no-retry',
 'R827-SHUTDOWN-NO-CLIP-RETRY',
 'r814GoldenHybridR831:true',
]
miss=[x for x in required if x not in s]
if miss: raise SystemExit('ERROR missing: '+repr(miss))

p.write_text(s,encoding='utf-8')
print('R831 PATCH OK')
