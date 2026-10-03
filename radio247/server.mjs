// R1293: MP3 PCM RESERVOIR 8S + TRUE UNDERRUN DIAGNOSTICS + WATCHDOG TELEMETRY.
// Normal MP3 decoding remains realtime (-re) and zero-delay in the steady state, but the producer may buffer up to 8 seconds when the persistent master audio pipe backpressures. Decoder source pauses caused by a full reservoir are no longer mislabeled as audible gaps. Explicit R1124/R792/R751 watchdog fields are exported for the control panel.
// R1292: CLIP FULL-END / NO EARLY FADE. Normal music clips no longer darken 3.6s before EOF when the next item is MP3; the real final frame remains visible through the actual clip boundary and the existing black bridge starts only AFTER clip completion. Paced-video tail wait is sized from the real queued frame count with a generous 60s ceiling so a temporarily slow 2-vCPU relay cannot discard the final queued frames. R1291 smooth-25, R1287 safe hot restart, MP3 visuals, audio, RTMPS, bitrate/GOP and station inserts are preserved.
// R1291: CLIP SMOOTH-25 + SAFE-HOLD FORMAT MATCH. Normal music clips keep the R1290 absolute 25fps wall-clock but bounded recovery is tightened from 32ms to 38ms and the extra 1ms two-stage timer wake is removed, reducing micro-judder while still correcting small timer drift. Safe-restart media/RTMPS logic in server remains unchanged.
// R1290: MUSIC-CLIP EXACT-25FPS WALL-CLOCK PACER + FULL TAIL. Normal music clips no longer use the R1123 PCM deficit full-stop / 38↔24ms oscillating cadence. They keep the calibrated ~2s A/V lead but release real frames on an absolute 40ms timeline with bounded 32ms catch-up, preventing cumulative JS timer drift, queue backpressure, spinner/rush cycles and premature EOF tail cuts. Station inserts, MP3, RTMPS, codecs, bitrate/GOP and R1287 safe restart remain unchanged.
// R1288: MP3 CURRENT-TITLE PAD NARROWER. Keeps R1287 safe live restart and all R1286 MP3 dark underlays; ONLY the upper MP3 current-track pad is reduced from x=210/w=1500/h=96 to centered x=340/w=1240/h=88. Bottom ticker pad, clips, station inserts, audio, timing, bitrate, GOP and RTMPS are unchanged.
// R1287: SAFE LIVE SERVER RESTART. Adds a temporary YouTube BACKUP-ingest hold marker so the normal backup lane can be relinquished to an external HOLD service during server replacement. While HOLD is active the radio keeps PRIMARY live, skips its own backup relay, reports expected RTMPS=1, and restores backup automatically after the marker disappears. No media timing/codec/audio changes.
// R1286: MP3 DARK SEMI-TRANSPARENT UNDERLAYS ONLY. Normal MP3 current-title gets a dark translucent top pad; MP3 ticker pad opacity is strengthened. Clips/station inserts, audio path, timing, buffers, bitrate, GOP and RTMPS transport are unchanged. Album/ticker cache signatures are bumped so the new underlays rebuild automatically after restart.
// R1285: lifecycle-only maintenance of uploaded R1284. One RTMPS stdin error listener per stream; waitChildExit removes timed-out listeners and recognizes signal termination. Media pacing, FFmpeg arguments, buffers, bitrate and handoff code unchanged.
// R1284: RESTORE PROVEN CLIP RELAY. Surgical rollback of ONLY attachAudioMasterPacedVideoRelayR1123 to the byte-identical R1278/R1280 implementation that previously played music clips cleanly. Removes R1281 phase-anchor/320ms escape changes and R1282 exact25/first-frame-drain changes from clip playback. Preserves R1281 dual reliable RTMPS 2/2, stale-prearm max-age/new-MP3 cleanup, R1280 station/cover safeguards, and all master audio/video settings.
// R1282: MUSIC-CLIP EXACT-25FPS + CLEAN FIRST-FRAME DRAIN. Fix R1281 regression where the permanent clip phase bias plus a small submitted-lead deficit repeatedly held each music-video frame for up to 320ms, producing viewer play/spinner/play stutter. Normal music clips now preserve their own unified prepared A/V cadence at exact 25fps (40ms/frame), with no PCM deficit holds and no 24/38ms catch-up. Before the first clip frame, inherit no MP3 rawvideo backlog: if the persistent video pipe is still draining one old 3,110,400-byte frame, wait for its drain event before writing the first clip frame. Station timing, R1281 dual RTMPS, stale-prearm guard, R1279 covers and all audio parameters remain unchanged.
// R1281: DUAL-RTMPS + STALE-PREARM/HANDOFF FIX. Restore primary+backup YouTube RTMPS without localhost UDP: master MPEG-TS is fanned out to TWO independent bounded Node reservoirs/pipe relays so one lane cannot backpressure or corrupt the other. Fix MP3->clip freeze proven by diagnostics: a clip prearm intended for T-4s was claimed 378s later after surviving an intervening MP3. Every new MP3 now clears any inherited video prearm; takeInsertPrearm rejects anything older than 15s. Normal music clips also use a local PCM-phase anchor at promotion so accumulated MP3 counter drift cannot hold video for seconds and starve RTMPS. R1280 station sync shield, R1279 cover hot-reload and R1278 no-UDP transport principle remain preserved.
// R1280: STATION A/V SYNC SHIELD. Preserve the exact R1278/R1276 station timing; R1279 live album-bed rebuilds are now forbidden from competing with clip/station startup or playback. A live album ffmpeg builder is SIGSTOP'ed before video insert handoff and SIGCONT'ed only after the insert is fully detached. Pending rebuilds wait until clipActive/stationHandoffActive are false. Background cover polling also skips all insert windows. R1278 reliable encoded pipe/reservoir and audio/video timing values are untouched.
// R1279: LIVE ALBUM COVER HOT-RELOAD. Fix R1277/R1278 cache-only bug that prevented all 5 official album covers from changing while publisher was LIVE. Changed covers are detected with cache-busted HEAD polling, rebuilt one-at-a-time at nice19/readrate0.35/thread1, atomically swapped only after a complete valid 16s prepared bed exists, and picked up on the next MP3 boundary. R1278 reliable encoded pipe/reservoir and all audio timing remain untouched.
// R1278: RELIABLE ENCODED TRANSPORT. Keep R1277 prepared album beds/CPU shield, but remove localhost UDP from the encoded H264/AAC path. The persistent master now writes MPEG-TS to stdout -> a bounded 32 MiB Node PassThrough reservoir -> the copy-only RTMPS relay stdin. This prevents silent local UDP datagram loss from corrupting both AAC and H264 (rare audio stutter + colored lower-frame lines/blur). Relay restart can reconnect to the SAME encoded reservoir without touching MP3/video feeders. No realtime audio resampling/loudnorm changes: queue96, 44.1k, 2s MP3 PCM reservoir, 6000k/GOP50, x264 1-thread and single RTMPS stay unchanged.
// R1276: AUDIO CLEAN + STATION A/V SYNC. Keep R1275 warmed real-video albums and clip-style CTA. Remove realtime loudnorm from normal-MP3 playback (static measured gain only, unity fallback), keep exact 44.1k sample clock, and fix station/bumper startup: 1050ms PCM prime + 950ms real-video prebuffer ~= the calibrated 2000ms master lead instead of the old 2000+950=2950ms. Adds lightweight PCM-gap diagnostics. queue96, 6000k/GOP50, x264 1-thread, reservoir and RTMPS 1/1 unchanged.
// R1275: CLIP CTA ON MP3. Keep R1274 warmed real-video album source, but make normal MP3 use the SAME SUBSCRIBE/LIKE CTA assets, cadence and fades as prepared video clips: first SUBSCRIBE at 20s, then alternate LIKE/SUBSCRIBE every 120s, 8s each, 0.35s fade. Custom 60s album-like overlay is disabled to avoid duplicates. Audio path, queue96, 6000k/GOP50, reservoir, x264 1-thread and RTMPS 1/1 stay unchanged.
// R1274: WARMED REAL-VIDEO ALBUMS. The five official album JPGs are NEVER used as a live timed source anymore. Each image is prebuilt once into a visually static lossless 1920x1080/25fps H.264 loop, warmed before the publisher starts, then fed with the exact same -re -stream_loop -1 real-video path used by the stable master MP4. R1273 audio reservoir/CPU headroom, queue96, 6000k/GOP50, ticker and RTMPS 1/1 stay unchanged. LIKE is made visible immediately and every 60s.
// R1273: AUDIO CPU HEADROOM. Keep R1272 reservoir + R1271/R1270 stable visuals, but stop x264 from occupying both VPS cores. Persistent publisher video is forced to ONE encoder thread, and the normal MP3 visual feeder uses one codec thread. Goal: leave one core/scheduler headroom for AAC + Node + PCM plumbing. queue96, 6000k/GOP50, ticker, LIKE 60s and RTMPS 1/1 unchanged.
// R1272: MP3 PCM RESERVOIR. Keep the proven R1271/R1270 visual/master profile exactly as-is, but insert a 2-second Node PassThrough reservoir ONLY between normal-MP3 decoder stdout and the persistent master audio pipe. This absorbs short publisher/backpressure stalls without touching FFmpeg audio queue96, AAC, timestamps, RTMPS or video.
// R1271: restore MP3 ticker on top of the R1270/R1212 lightweight master profile. LIKE interval changed to 60 seconds. Audio path, queue96, RTMPS 1/1, 6000k/GOP50 master profile remain unchanged.
// R1270: restore the PROVEN R1212 persistent master H.264 profile to remove encoder/output pressure from the audio path. MP3 ticker remains OFF (R1269). Audio decoder/master logic remains unchanged and queue96 stays 96. RTMPS stays 1/1. This intentionally rolls back R1265's heavy 8M/GOP25/deblock/fast-pskip=0 video encoder experiment.
// R1269: MP3 TICKER OFF. Disable the changing/bottom ticker completely on ALL normal MP3 playback to isolate the user-observed stutter + color degradation trigger. Album LIKE every 120s stays. Current-track title stays. R1265 8M/GOP25/no-slices video stays. Audio path, queue96 and RTMPS 1/1 are untouched.
const MP3_TICKER_DISABLED_R1269 = false; // R1271: ticker restored on MP3
// R1268: DIRECT TICKER-STUTTER FIX. Based on visually stable R1265, NOT R1267. The 4 ticker pages are pre-rendered once into a tiny 1580x84 / 25fps / 16s true-alpha QTRLE video with 250ms text crossfades. LIVE MP3 no longer evaluates cropY or switches sprite rows every 4s. Ticker video is fed with -re -stream_loop -1. Audio path, queue96, RTMPS 1/1 and R1265 8M/GOP25/no-slices publisher stay unchanged. Red outline around current track title removed.
// R1265: STATIC-MP3 COLOR-DRIFT FIX. Keep R1264 true-alpha ticker and no sliced threads, but refresh H.264 prediction twice as often (GOP25), raise video CBR to 8 Mbps, enable deblock, and disable fast-pskip so detailed static album art is corrected instead of carrying chroma/quantization error through long P-frame runs. Audio queue stays 96; RTMPS 1/1 and audio path unchanged.
// R1264: TRUE-ALPHA ticker pad + YUVA overlays + no x264 sliced-threads. Fixes opaque-black ticker sprite and targets the horizontal mid-frame chroma/slice tear seen only on album MP3. Queue96, RTMPS 1/1 and audio path unchanged.
// R1262: MP3 ticker hot-path fix kept from R1261, but restore the semi-transparent underlay and bring back the album LIKE icon every 120s. Live MP3 path still uses one pre-rendered 4-page sprite (crop+overlay only), so per-frame drawtext churn stays removed. RTMPS 1/1 and queue96 unchanged.
// R1261: MP3 TICKER HOT-PATH FIX — pre-render four ticker pages once into one transparent sprite; live MP3 path uses only crop+overlay, NO per-frame drawtext and NO 0.28s blink. Opaque codec-safe strip isolates ticker macroblocks from album art. Audio path and queue96 restored/preserved; RTMPS 1/1 unchanged.
// R1259: rollback R1258 album-LIKE hot-path overlay completely; restore R1255 MP3 visual/audio cadence. Audio queue stays 96, RTMPS 1/1, R1251 ticker preserved.
// R1255: restore old-server smooth 25fps MP3 visual cadence for static album art without touching audio. Static JPG is decoded once, then looped/paced by FFmpeg realtime filter at 25fps; audio queue stays 96; R1251 ticker and R1250 single RTMPS preserved.
// R1254: rollback R1253 mux/interleave experiment completely; restore proven A/V handoff timing so station-insert audio cannot run ahead during the black transition. Keep R1251 ticker, audio queue 96, and single RTMPS 1/1.
// R1251: keep R1250 single RTMPS and proven global encoder; paged ticker uses a fixed semi-transparent pad plus a short text-clear gap to prevent old glyph residue.
// R1250: force SINGLE YouTube RTMPS ingest. Backup lane disabled permanently; all media/audio/video behavior otherwise unchanged.
// R1246: R1242 global encoder/picture is preserved exactly; five album slots use a codec-safe PAGED static ticker instead of continuously moving glyphs. No global x264 changes. Audio queue remains 96.
// R1242: FULL GLOBAL ENCODER ROLLBACK — restore the proven pre-experiment x264 publisher: GOP50, CAVLC/cabac=0, no AQ, no ROI. Keep static album art and local white ticker layout; audio queue stays 96.
// R1241: restore GOP50 inter prediction for the static album picture so 6000k is spent efficiently on image detail; keep CABAC/AQ and strengthen bottom ticker ROI. Audio queue stays 96.
// R1240: restore static album art (no global motion) so image quality stays clean; keep the non-smearing publisher/ticker path from R1239.
// R1239: persistent publisher is ALL-INTRA (GOP=1) to eliminate temporal prediction trails. Bottom ticker ROI remains active; album motion from R1237 remains; audio queue stays 96.
// R1238: keep R1237 subtle full-frame motion, but give the bottom ticker band a true x264 ROI at the persistent publisher. AQ is enabled only so libx264 honors ROI. 6000k/GOP50/B0 and audio queue 96 remain unchanged.
// R1226: prepared-clip ticker stays primary; live fallback is restored until the prepared album video is ready; one low-priority build at a time; audio queue stays 96.
// R1221B: pre-rendered ticker raster + audio queue restored to 96; ticker optimization retained.
// R1220: five album slots — CURRENT title at top; faster ticker; semi-transparent codec-safe ticker band.
// R1216: ALBUM TICKER GHOST/BLUE-SEAM FIX + LOWER CURRENT TITLE.
// R1218: five official album slots use codec-safe opaque neutral ticker band + integer white-text motion.
// R1217: five official album slots render ticker on a fresh transparent 1920x72 layer.
// R1217: removes direct full-frame moving drawtext that could leave chroma trails / blue smear in H.264.
// R1217: ticker motion uses exact 100 px/s = 4 px/frame at 25fps; no shadow; extras unchanged.
// R1216: CURRENT title is 24px lower on the five album slots only.
// R1215: STATIC STABILITY FIX + EXACT 1920x1080 + LOWER FULL-WIDTH ALBUM TICKER.
// R1215: static album input = 5fps decode -> 25fps render; 5 official albums use 1920px ticker at y=992; Extras unchanged.
// R1213: FULL-WIDTH TICKER ON 5 ALBUMS + STATIC PREROLL/STARTUP FIX.
// R1211: STATIC ALBUM BACKGROUNDS — 5 albums + extras; title-only CURRENT; legacy master-video fallback.
// R1160P: bounded orphan-FFmpeg GC + hard prearm cleanup; protects long-run RAM/tasks without touching LIVE owners.
// R1160N: station inserts use exact 25fps cadence with no PCM-phase full-stop; prevents short bumper freeze/catch-up.
// R1160M: atomic local library fallback; R1160L media cadence preserved.
// R1160L: MP3 real-frame cadence, monotonic frame/sample counters, incident telemetry.
// R1026B-CLIP-MP3-SINGLE-FADE
// R1025-FULLFRAME-BUMPER3-AV-SINGLE-PIPE
// R1012-HARD-FULLFRAME-1920X1080
// R1011B-PERMANENT-ZERO-VISUAL-SEEK
// R1010-R906-FULLSCREEN-SINGLE-SLOT-LOCK
import http from 'node:http';
import { spawn, execFile, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  appendFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import { Readable, PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const PORT = Number(process.env.PORT || 8080);
// R854-LOCAL-FALLBACK-LIBRARY

const R854_R837_RAWVIDEO_R850_TITLE_FADE = 'R854-R837-RAWVIDEO-R850-TITLE-MP3-FADE';
const R854_SAFE_ROTATION_LAYOUT = 'R854-SAFE-ROTATION-2CLIPS-STATION-SYNC-LAYOUT-V1';
const R816_PERSISTENT_RAWVIDEO_SINGLE_X264 = 'R816-PERSISTENT-RAWVIDEO-SINGLE-X264';
const R819_R784_GEOMETRY_RAWVIDEO_QUEUE24 = 'R819-R784-VIEWER-PROVEN-GEOMETRY-RAWVIDEO-QUEUE24';
const R820_MASTER_PTS_LOCK = 'R821-STATION-NO-DRAIN-MAKE-BEFORE-BREAK / R820-DETERMINISTIC-MASTER-PTS-LOCK';
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://andrikmetal.com/api/music/downloads';
const STREAM_KEY = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const STREAM_URL_OVERRIDE = String(process.env.STREAM_URL_OVERRIDE || '').trim();
const STREAM_URL = STREAM_URL_OVERRIDE || (STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '');
// R792: YouTube officially exposes a separate RTMPS backup ingest. When the normal
// YouTube stream key path is used, send the SAME muxed A/V packet timeline to primary
// and backup in parallel. A failure of one network lane must not interrupt the other.
// Custom STREAM_URL_OVERRIDE stays single-lane unless an explicit backup override is set.
const STREAM_BACKUP_URL_OVERRIDE = String(process.env.STREAM_BACKUP_URL_OVERRIDE || '').trim();
const STREAM_BACKUP_URL = STREAM_BACKUP_URL_OVERRIDE || (!STREAM_URL_OVERRIDE && STREAM_KEY ? `rtmps://b.rtmps.youtube.com:443/live2?backup=1/${STREAM_KEY}` : '');
const DUAL_INGEST_ENABLED_R792 = true; // R1281: restore PRIMARY+BACKUP, each on an independent reliable pipe/reservoir
const SAFE_RESTART_HOLD_MARKER_R1287 = '/run/andrik-radio-youtube-backup-hold';
function safeRestartBackupHoldActiveR1287(){
  try{return existsSync(SAFE_RESTART_HOLD_MARKER_R1287);}catch(_){return false;}
}
function expectedRtmpsConnectionsR1287(){
  return DUAL_INGEST_ENABLED_R792 && STREAM_BACKUP_URL && !safeRestartBackupHoldActiveR1287() ? 2 : 1;
}
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const CACHE_DIR = process.env.RADIO_CACHE_DIR || '/var/cache/andrik-radio-r622';
const AUDIO_CACHE_DIR = `${CACHE_DIR}/audio`;
const VISUAL_CACHE_DIR = `${CACHE_DIR}/visuals`;
const DIAG_DIR_R802 = `${CACHE_DIR}/diagnostics`;
const DIAG_LOG_R802 = `${DIAG_DIR_R802}/r802-events.ndjson`;
const DIAG_LATEST_R802 = `${DIAG_DIR_R802}/r802-latest.json`;
const DIAG_MAX_BYTES_R802 = 1536*1024;
const DIAG_RING_LIMIT_R802 = 80;
const MAX_CACHED_TRACKS = 1000; // R854 LOCAL FALLBACK: preserve working cache
const VISUAL_TIME_ZONE = process.env.VISUAL_TIME_ZONE || 'Europe/Bratislava';
const FORCE_VISUAL_SLOT = 'morning'; // R1010 permanent single visual slot
const VISUAL_AUTO_SCHEDULE_R658 = false; // R1010 HARD LOCK: no morning/day/evening/night switching
// R651: DAY / EVENING / NIGHT are owner-selected R2 videos cached locally on AWS.
// IMPORTANT: preserve the exact working R649 hotfix behavior: direct 1920x1080 scale,
// no crop and no pad. This intentionally fills the whole 16:9 frame every time.
const R806_VISUAL_SANITIZER_VERSION = 'R806-VISUAL-SANITIZED-REMUX-FADE-GUARANTEE';
const MORNING_VISUAL = `${VISUAL_CACHE_DIR}/stream-morning-master-r703.mp4`;
const DAY_VISUAL = `${VISUAL_CACHE_DIR}/stream-day-master-r620.mp4`;
const EVENING_VISUAL = `${VISUAL_CACHE_DIR}/stream-evening-master-r620.mp4`;
const NIGHT_VISUAL = `${VISUAL_CACHE_DIR}/stream-night-master-r620.mp4`;
const MORNING_VISUAL_URL = MORNING_VISUAL;
const DAY_VISUAL_URL = DAY_VISUAL;
const EVENING_VISUAL_URL = EVENING_VISUAL;
const NIGHT_VISUAL_URL = NIGHT_VISUAL;
const RADIO_BACKGROUND_BASE_URL_R1211 = String(process.env.RADIO_BACKGROUND_BASE_URL_R1211 || 'https://andrikmetal.com/api/media/radio-background-r1211').trim();
const RADIO_BACKGROUND_REFRESH_MS_R1211 = Math.max(10000,Number(process.env.RADIO_BACKGROUND_REFRESH_MS_R1211||30000)); // R1279: cover changes visible without restart; HEAD only unless ETag changes
const RADIO_BACKGROUND_SLOTS_R1211 = Object.freeze(['illusion','ocean','trika','beyond','silent','extras']);
const radioBackgroundCheckR1211 = new Map();
const R1130B_VISUAL_PATH_FIX = 'R1130B-AGENT-RADIO-SAME-VISUAL-SLOT-FILES';
const EMERGENCY_VISUAL = process.env.EMERGENCY_VISUAL || new URL('../assets/live-eye-r223.mp4', import.meta.url).pathname;
const QR_OVERLAY = process.env.QR_OVERLAY || new URL('../assets/andrik-qr-r794-160.png', import.meta.url).pathname; // R798 exact pre-scaled replacement
const CTA_OVERLAY_R767 = process.env.CTA_OVERLAY_R767 || new URL('../assets/subscribe-right-r794-420.png', import.meta.url).pathname; // R798 pixel-identical 420px replacement
const CTA_LIKE_OVERLAY_R783 = process.env.CTA_LIKE_OVERLAY_R783 || new URL('../assets/like-right-r794-420.png', import.meta.url).pathname; // R798 pixel-identical 420px replacement
const QR_OVERLAY_LIVE_R794 = new URL('../assets/andrik-qr-r794-160.png', import.meta.url).pathname; // live MP3 only, pre-scaled offline
const CTA_OVERLAY_LIVE_R794 = new URL('../assets/subscribe-right-r794-420.png', import.meta.url).pathname;
const CTA_LIKE_OVERLAY_LIVE_R794 = new URL('../assets/like-right-r794-420.png', import.meta.url).pathname;
const CTA_SHOW_SECONDS_R722 = 8;
const CTA_PERIOD_SECONDS_R722 = 120; // kept cadence; R748 schedules full local windows only (no partial flashes)
const CTA_FIRST_SHOW_SECONDS_R748 = 20; // first compact CTA after feeder settles
const CTA_FADE_SECONDS_R748 = 0.35; // smooth alpha in/out instead of blink
const CTA_BOTTOM_GAP_R748 = 72; // R767: compact CTA directly above ticker
const CTA_RIGHT_GAP_R767 = 34; // R767: right side; old left CTA removed
const CLIP_PREP_SUFFIX_R782 = '.r787-ready.mp4'; // R787: permanent full-frame prepared cache
const STATION_PREP_MARKER_R791 = '.station-r917b-avsync-zero-pts'; // R791: force one-time rebuild of station inserts with audio PTS reset BEFORE resample
const MUSIC_CLIP_PREP_MARKER_R1135 = '.music-r1135-avsync-zero-pts'; // R1135: normal clips also reset decoded audio PTS before resample; one-time cache rebuild
const STATION_LEGACY_DRAIN_DISABLED_R821 = true; // R821: station handoff never waits for old H264/AU/sink drain; persistent rawvideo master stays fed
const STATION_LEADING_SILENCE_THRESHOLD_DB_R782 = -55; // PCM RMS threshold, no optional FFmpeg silencedetect dependency
const STATION_LEADING_SILENCE_MIN_R782 = 0.20; // only compensate sustained leading near-silence >=200ms
const STATION_LEADING_SILENCE_MAX_TRIM_R782 = 2.0; // safety clamp; never advance station audio more than 2s
const STATION_PCM_PROBE_SECONDS_R782 = 2.75;
const STATION_PCM_BLOCK_MS_R782 = 20;
const STATION_PCM_ACTIVE_BLOCKS_R782 = 3; // require 60ms consecutive real audio
const STATION_AUDIO_PROBE_SECONDS_R784 = 8.0;
const STATION_AUDIO_MIN_RMS_R784 = 5.0; // reject truly silent/wrong audio stream
const STATION_AUDIO_MIN_PEAK_R784 = 64;
const TITLE_HANDOFF_DELAY_MS_R724 = 0; // R730: title changes only on the real media handoff
const BUMPER_MIN_SONGS_R724 = 2; // R854 SAFE ROTATION
const BUMPER_MAX_SONGS_R724 = 4; // R854 SAFE ROTATION
const SPECIAL_INTERVAL_MS_R726 = Math.max(10*60*1000, Number(process.env.SPECIAL_INTERVAL_MS_R726 || 30*60*1000));
const SPECIAL_HOURLY_INTERVAL_MS_R727 = Math.max(30*60*1000, Number(process.env.SPECIAL_HOURLY_INTERVAL_MS_R727 || 60*60*1000));
const NEXT_PREVIEW_SECONDS_R726 = 10; // R748: PREVIOUS/NEXT for final 10 seconds
const START_PREVIEW_DELAY_SECONDS_R748 = 2.0; // after the new track is fully bright
const START_PREVIEW_SHOW_SECONDS_R748 = 5.0; // short intro reminder, then hide
const NEXT_PREVIEW_HIDE_BEFORE_END_R726 = 0.30; // R731: keep PREVIOUS/NEXT visible almost to the handoff
const TRACK_HISTORY_LIMIT_R726 = 20;
const TRACK_AUDIO_TARGET_I_R726 = -14;
const TRACK_AUDIO_TRUE_PEAK_R726 = -1.5;
const TRACK_AUDIO_LRA_R726 = 11;
const TRACK_AUDIO_FADE_IN_R726 = 0.18;
const TRACK_AUDIO_FADE_OUT_R726 = 0.45; // R743: clearly audible but short old-track fade-out
const VIDEO_FADE_SECONDS_R726 = 0.65; // R736: short cinematic fade-out on the OLD track
const VIDEO_FADE_IN_SECONDS_R736 = 1.10; // R763: viewer-visible recovery for non-MP3 boundaries
const VIDEO_BLACK_HOLD_SECONDS_R736 = 0.05; // non-MP3 boundary hold preserved
const MP3_BOUNDARY_FADE_OUT_SECONDS_R814 = 1.60; // R1135B MP3→MP3: shorter darken; R1085/feeder clocks untouched
const MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814 = 0.20; // R1156: compact MP3→MP3 real-black pause; audio/master unchanged
const MP3_BOUNDARY_FADE_IN_SECONDS_R814 = 1.60; // R1156: shorter smooth MP3→MP3 reveal; frame ownership unchanged
const VIDEO_FADE_LEAD_SECONDS_R735 = 0.00; // R763: start the proven R753 boundary darkening exactly 1.0s earlier than R762
const TITLE_SWITCH_BEFORE_BOUNDARY_R781 = Math.max(0.50,Math.min(2.50,Number(process.env.TITLE_SWITCH_BEFORE_BOUNDARY_R781 || (VIDEO_FADE_LEAD_SECONDS_R735 + VIDEO_BLACK_HOLD_SECONDS_R736/2)))); // R781: switch CURRENT to the next MP3 while the screen is black, before recovery
const TITLE_VISUAL_LEAD_SECONDS_R738 = 3.20; // compensate persistent video path latency; CURRENT is preloaded early but appears at the real handoff
const CLIP_PRE_DRAIN_MS_R738 = 700; // let the bounded MP3 PCM queue drain while the normal visual keeps running
const CLIP_POST_DRAIN_MS_R738 = 650; // let the clip PCM/video tail drain before the next MP3 feeder starts
const VIDEO_TIMELINE_COMP_DEFAULT_R739 = 0.0; // R743: disable R739 global compensation; it hid/late-shifted proven R732 boundary UI
const CLIP_PREP_NICE_R742 = 19; // R1129 CPU HEADROOM: lowest-priority background clip preparation on 2-vCPU LIVE
const CLIP_PREP_TIMEOUT_MS_R742 = 45*60*1000;
const CLIP_PREP_MIN_BYTES_R742 = 500000; // prepared 1080p H264+AAC cache sanity check
const VIDEO_PIPELINE_LEAD_SECONDS_R745 = Math.max(2,Math.min(15,Number(process.env.VIDEO_PIPELINE_LEAD_SECONDS_R745 || process.env.VIDEO_PIPELINE_LEAD_SECONDS_R744 || 10.0))); // R745: 10s default after real viewer-side test; keeps backward env compatibility
const VIDEO_BOUNDARY_FADE_SECONDS_R744 = 0.80;
const CLIP_END_GUARD_MARGIN_MS_R745 = Math.max(8000,Number(process.env.CLIP_END_GUARD_MARGIN_MS_R745 || 15000)); // watchdog margin after measured clip duration
const TRANSPORT_FATAL_RESTART_DELAY_MS_R746 = Math.max(1500,Math.min(15000,Number(process.env.TRANSPORT_FATAL_RESTART_DELAY_MS_R746 || 3500))); // R746: restart whole service when FFmpeg/FIFO keeps a dead RTMPS/TLS session alive
const TRANSPORT_FATAL_REGEX_R746 = /the specified session has been invalidated|error in the pull function|io error:\s*end of file|server returned 4\d\d|connection reset by peer|broken pipe|connection timed out|connection refused|network is unreachable|tls[^\n]*(?:error|fail)|error writing (?:trailer|header|packet)|av_interleaved_write_frame/i;
const OUTPUT_FATAL_REGEX_R780 = /tag\s+.*incompatible with output codec|could not write header|error opening output file|error opening output files|bitstream filter not found|invalid data found when processing input|a non-NULL packet sent after an EOF|failed to send packet to filter extract_extradata/i; // R780: FIFO child can stay alive while FLV header is permanently rejected
const LOUDNESS_ANALYSIS_TIMEOUT_MS_R747 = Math.max(8000,Math.min(120000,Number(process.env.LOUDNESS_ANALYSIS_TIMEOUT_MS_R747 || 45000)));
// R750: loudness analysis is background-only and serialized. It can never delay a live MP3 handoff.
const LOUDNESS_BACKGROUND_NICE_R750 = Math.max(10,Math.min(19,Number(process.env.LOUDNESS_BACKGROUND_NICE_R750 || 15)));
const BACKGROUND_LOUDNESS_ENABLED_R791 = false; // R791: never spend live-stream CPU on background loudness scans; cached analysis still used, live fallback remains
// R750: keep the 6 s FIFO timeshift, but never allow minutes of queued packets to back-pressure
// the live A/V pipes. A bounded FIFO with overflow drop keeps YouTube receiving fresh media.
const OUTPUT_FIFO_QUEUE_PACKETS_R750 = Math.max(768,Math.min(4096,Number(process.env.OUTPUT_FIFO_QUEUE_PACKETS_R750 || 2048)));
const MASTER_BACKPRESSURE_STUCK_MS_R750 = Math.max(10000,Math.min(120000,Number(process.env.MASTER_BACKPRESSURE_STUCK_MS_R750 || 30000))); // R751: only no-progress stalls, not normal needDrain
const MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750 = Math.max(500,Math.min(5000,Number(process.env.MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750 || 1000)));
const RTMPS_EGRESS_WATCH_INTERVAL_MS_R792 = Math.max(3000,Math.min(15000,Number(process.env.RTMPS_EGRESS_WATCH_INTERVAL_MS_R792 || 5000)));
const RTMPS_EGRESS_ZERO_GRACE_MS_R792 = Math.max(15000,Math.min(60000,Number(process.env.RTMPS_EGRESS_ZERO_GRACE_MS_R792 || 25000)));

// R1124-SILENT-RTMPS-PROGRESS-WATCHDOG
// R792 sees ESTABLISHED sockets only. R1124 additionally proves that TCP ACKed
// bytes are still moving. If all publisher RTMPS lanes remain ESTABLISHED but
// ACK progress stops, recycle ONLY the persistent publisher through R884.
const RTMPS_PROGRESS_WATCH_INTERVAL_MS_R1124 = Math.max(3000,Math.min(10000,Number(process.env.RTMPS_PROGRESS_WATCH_INTERVAL_MS_R1124 || 5000)));
const RTMPS_PROGRESS_STALL_MS_R1124 = Math.max(15000,Math.min(60000,Number(process.env.RTMPS_PROGRESS_STALL_MS_R1124 || 20000)));

// R1125-TRANSPORT-ISOLATION
// The persistent H264/AAC encoder no longer talks to YouTube directly.
// It emits one encoded MPEG-TS timeline to two localhost UDP lanes.
// Two tiny copy-only FFmpeg relays own primary/backup RTMPS independently.
// A dead network/TLS socket therefore cannot back-pressure or poison the encoder.
const R1125_PRIMARY_UDP_PORT = Math.max(20000,Math.min(60000,Number(process.env.R1125_PRIMARY_UDP_PORT || 32125)));
const R1125_BACKUP_UDP_PORT = Math.max(20000,Math.min(60000,Number(process.env.R1125_BACKUP_UDP_PORT || 32126)));
const R1125_RELAY_RESTART_MS = Math.max(250,Math.min(5000,Number(process.env.R1125_RELAY_RESTART_MS || 900)));
const R1125_RELAY_WATCH_INTERVAL_MS = Math.max(3000,Math.min(10000,Number(process.env.R1125_RELAY_WATCH_INTERVAL_MS || 5000)));
const R1125_RELAY_ACK_STALL_MS = Math.max(15000,Math.min(60000,Number(process.env.R1125_RELAY_ACK_STALL_MS || 20000)));
const R1125_RELAY_NO_SOCKET_MS = Math.max(20000,Math.min(90000,Number(process.env.R1125_RELAY_NO_SOCKET_MS || 30000)));
const R1278_ENCODED_RESERVOIR_BYTES = Math.max(8*1024*1024,Math.min(64*1024*1024,Number(process.env.R1278_ENCODED_RESERVOIR_BYTES || 32*1024*1024))); // reliable ~40s cushion at ~6.2 Mbps; no packet dropping
const R1281_ENCODED_LANE_MAX_BUFFER_BYTES = Math.max(8*1024*1024,Math.min(R1278_ENCODED_RESERVOIR_BYTES,Number(process.env.R1281_ENCODED_LANE_MAX_BUFFER_BYTES || 24*1024*1024)));
const INSERT_PREARM_MAX_AGE_MS_R1281 = Math.max(8000,Math.min(30000,Number(process.env.INSERT_PREARM_MAX_AGE_MS_R1281 || 15000)));
const CLIP_PHASE_HOLD_MAX_MS_R1281 = Math.max(120,Math.min(1000,Number(process.env.CLIP_PHASE_HOLD_MAX_MS_R1281 || 320)));
const CPU_HEADROOM_PROFILE_R1129 = 'R1129-QUIET-RELAYS+NO-R1124-DUP-PROBE+THROTTLED-PREP';
const CPU_ENCODER_PROFILE_R1131 = 'R1131-X264-ULTRAFAST-CAVLC-NO-CABAC';
const LOUDNESS_CACHE_SUFFIX_R747 = '.r747-loudnorm.json';
// R749: harden mandatory MP4 inserts without touching the proven ONE-RTMPS transport.
// A prepared video may legitimately finish its decode/filter preparation shortly
// before its audio boundary. Keep a short, identity-bound arm record instead of
// mistaking that clean EOF for a dead insert. R816 keeps the persistent master fed by
// complete raw YUV420P frames; no encoded H.264 feeder is switched at a media boundary.
const INSERT_PREROLL_ARM_GRACE_MS_R749 = Math.max(2500,Math.min(15000,Number(process.env.INSERT_PREROLL_ARM_GRACE_MS_R749 || 6000)));
const VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749 = Math.max(500,Math.min(5000,Number(process.env.VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749 || 1000)));
const VIDEO_SOURCE_STUCK_MS_R749 = Math.max(1200,Math.min(10000,Number(process.env.VIDEO_SOURCE_STUCK_MS_R749 || 2500)));
const INSERT_AUDIO_START_TIMEOUT_MS_R749 = Math.max(1000,Math.min(12000,Number(process.env.INSERT_AUDIO_START_TIMEOUT_MS_R749 || 4000))); // R751: slow AAC/MP4 startup must skip safely, never crash
const INSERT_CACHE_WARM_LEAD_SECONDS_R752 = Math.max(2,Math.min(8,Number(process.env.INSERT_CACHE_WARM_LEAD_SECONDS_R752 || 8.0))); // metadata/cache warm only; ZERO media frames before boundary
const CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753 = Math.max(2500,Math.min(10000,Number(process.env.CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753 || 5000))); // allow one clean clip→MP3 feeder handoff without watchdog racing it
const CLIP_TO_TRACK_FADE_IN_SECONDS_R753 = 0.95; // R1156: compact black→picture reveal; transport/clock untouched
const CLIP_TO_TRACK_BLACK_HOLD_SECONDS_R917B = Math.max(0.20,Math.min(2.00,Number(process.env.CLIP_TO_TRACK_BLACK_HOLD_SECONDS_R917B || 0.30))); // R1156: compact video→MP3 real-black hold
const MUSIC_CLIP_AUDIO_PRIME_MS_R1135 = 1050; // 1050 ms PCM prime + 950 ms real-video prebuffer ~= R1085 2000 ms target lead
const MUSIC_CLIP_R1123_MIN_FRAME_MS_R1135 = 38; // R1141: smooth nominal music-clip pacing; adaptive debt catch-up drops to 24ms only when truly behind
const MUSIC_CLIP_R1123_DEBT_CATCHUP_MS_R1141 = 24;
const MUSIC_CLIP_R1123_DEBT_THRESHOLD_MS_R1141 = 250;
const R1135_CLIP_MP3_CINEMATIC = 'R1135-CLIP-ZEROPTS+PHASE-START+HIDE-STATION-PREVNEXT+CLIP-MP3-FADE+MP3-MASK-ONLY';
const R1135B_MP3_SHORT_DARK_LONG_REVEAL = 'R1156-MP3-1.60-0.20-1.60-R1085-UNTOUCHED';
const R1136_VIDEO_TO_VIDEO_BLACK_SMOOTH = 'R1136-VIDEO-TO-VIDEO-BLACK-BRIDGE+NEXT-VIDEO-PREARM+MUSIC-CLIP-1.50S-REVEAL';
const MUSIC_CLIP_FADE_IN_SECONDS_R1136 = 1.50; // video insert -> normal music clip: black -> slow reveal, station IDs keep R757 timing
const R1140B_CLIP_PACER_RUNTIME_FIX = 'R1140B-AUDIOQ128+R1123-24MS+TDZ-SAFE+R1135-R1136-R1139-PRESERVED';
const R1141_CLIP_IO_BACKPRESSURE_FIX = 'R1141-AUDIOQ512+ADAPTIVE38-24+VIDEO-NODROP-PAUSE-RESUME+EOF15S';
const STATION_TAIL_FRAME_MS_R1142 = 40; // exact 25fps drain after station decoder EOF; never phase-catch-up the visible ending
const STATION_TAIL_WAIT_MS_R1142 = 8000; // allow complete short station tail to drain at exact 25fps before detach
const R1142_STATION_TO_CLIP_TAIL_LOCK = 'R1142-STATION-TAIL-40MS+STALE-NEXT-PREARM-REARM+R1136-REVEAL-PRESERVED';
const STATION_START_LOCK_FRAMES_R1143 = 25; // first ~1.0s of a station insert can never phase-catch-up faster than 25fps
const STATION_MID_MIN_FRAME_MS_R1143 = 38; // after the clean first second, allow only gentle station phase recovery
const R1143_STATION_START_FRAME_LOCK = 'R1143-STATION-FIRST25-40MS+MID38MS+R1142-TAIL40MS';
const R1145_STATION_MP3_ATOMIC_BLACK = 'R1145-STATION-TAIL->PREARMED-FULL-BLACK->FULLFRAME-MP3-REVEAL';
const R1147_STATION_BLACK_MASTER_LOCK = 'R1147-STATION-TAIL->R1085-EXACT-BLACK-LOCK->FIRST-MP3-FRAME';
const R1146_HARD_STALL_SELF_HEAL = 'R1146-R751-TRUE-NOPROGRESS->R884-PUBLISHER-RECYCLE+MEDIA-PRESERVED';
const R1148_MP3_CINEMATIC_MASTER_LOCK = 'R1148-MP3-FADEOUT+BLACK+FADEIN-R1085-EXACT-FRAME-LOCK';
const R1148B_PUBLIC_STATUS_HEALTH_FIX = 'R1148B-PUBLIC-STATUS-MARKER+ROBUST-INSTALL-HEALTH';
const R1148C_MASTER_FRAME_RELEASE_FIX = 'R1148C-MP3-RELEASE-BY-PERSISTENT-MASTER-FRAME-TARGET';
const R1148D_INCOMING_FEEDER_RELEASE_FIX = 'R1148D-MP3-RELEASE-FROM-INCOMING-FEEDER-METADATA+FIRST-FULL-FRAME-FALLBACK';
const R1148E_LOCK_OWNED_RELEASE_FIX = 'R1148E-MP3-LOCK-OWNED-PERSISTENT-MASTER-RELEASE-NO-METADATA-DEPENDENCY';
const R1150_MP3_EDGE_FRAME_SHIELD = 'R1150-MP3-FIRST7+LAST10-EXACT-FRAMES+FIRST-FULLFRAME-WARM+R1148E-BOUNDARY-PRESERVED';
const R1151_MP3_TO_VIDEO_PHASE_PRESERVE = 'R1151-MP3-TO-VIDEO-TAIL-R1085-PHASE-PRESERVE';
const R1154_ACTUAL_NEXT_OWNER = 'R1154-ACTUAL-NEXT-OWNER->R1085-TAIL+R1069-PREARM+NO-FALSE-MP3-WAIT';
const R1154_PREARM_BEFORE_END_MS = 4000; // mirror proven R1069 T-4s video prearm when next owner changes during the song
const R1155_QUEUE_CONTROL = 'R1155-ATOMIC-NEXT+MEDIA-PICK-TRACK-CLIP-STATION';
const R1156_NEXT_MP3_PCM_PREARM = 'R1156-VIDEO->NEXT-MP3-PCM-PREARM+FIRST-CHUNK-PARK+BOUNDARY-CLAIM';
const NEXT_MP3_PCM_PREARM_TIMEOUT_MS_R1156 = 9000;
const MP3_EDGE_START_EXACT_SECONDS_R1150 = 7.0; // preserve every real frame while intro PREVIOUS/NEXT is visible
const MP3_EDGE_TAIL_EXACT_SECONDS_R1150 = 10.0; // preserve every real frame while outro PREVIOUS/NEXT is visible
const MP3_CINEMATIC_LOCK_TIMEOUT_MS_R1148 = 15000; // watchdog only: frame-locked release normally happens after the next MP3 is fully bright
const MP3_CINEMATIC_FADE_RELEASE_PAD_SECONDS_R1148 = 0.12; // 3 frames beyond the 2.40s alpha fade so the short-lived mask has fully left the graph
const STATION_BLACK_PREARM_TIMEOUT_MS_R1145 = 1800; // black candidate is built while the station tail is still draining
const BLACK_TO_MP3_FULLFRAME_TIMEOUT_MS_R1145 = 5000; // keep black LIVE until one complete incoming MP3 YUV frame is ready
const INSERT_AUDIO_PRIME_MS_R917B = 450; // R998 tuned clip/station audio prime // R997 tuned clip/station audio prime // R996 clip/station audio prime // R995B common clip/station A/V sync // R926: outgoing MP3 audio-tail boundary lock // R917B audio first by one 25fps frame
const VIDEO_INSERT_FADE_IN_SECONDS_R757 = Math.max(0.25,Math.min(1.5,Number(process.env.VIDEO_INSERT_FADE_IN_SECONDS_R757 || 1.10))); // guaranteed black→video on MP3→clip/insert boundary
const MP3_BOUNDARY_FADE_IN_SECONDS_R758 = Math.max(0.20,Math.min(1.5,Number(process.env.MP3_BOUNDARY_FADE_IN_SECONDS_R758 || 0.80))); // R763 metadata/env compatibility: longer visible MP3 boundary recovery
// R721 keeps the proven 100-frame / 4-second exact-periodic QTRLE loops from R720.
// The EQ is composited inside the current local rawvideo feeder. R816 keeps the
// YouTube RTMPS publisher + its single H.264 encoder open permanently across switches.
const EQUALIZER_FILES_R721 = Object.freeze({
  morning: new URL('../assets/equalizer-off-r890.mov', import.meta.url).pathname,
  day: new URL('../assets/equalizer-off-r890.mov', import.meta.url).pathname,
  evening: new URL('../assets/equalizer-off-r890.mov', import.meta.url).pathname,
  night: new URL('../assets/equalizer-off-r890.mov', import.meta.url).pathname
});
const OUTPUT_TIMESHIFT_SECONDS = 1.5; // R887 short network cushion, no long replay buffer // R637: network recovery cushion; packets are NEVER dropped
const VIDEO_BITRATE = '6000k'; // R1270: exact R1212 master bitrate
const AUDIO_BITRATE = '160k'; // R762: modest stereo AAC quality lift; sample rate/queues unchanged
const AUDIO_SAMPLE_RATE = 44100;
const MP3_PCM_RESERVOIR_SECONDS_R1293 = Math.max(4,Math.min(12,Number(process.env.MP3_PCM_RESERVOIR_SECONDS_R1293 || 8)));
const MP3_PCM_RESERVOIR_BYTES_R1293 = Math.round(AUDIO_SAMPLE_RATE*4*MP3_PCM_RESERVOIR_SECONDS_R1293); // YouTube Live recommendation for stereo
const AUDIO_GAP_BRIDGE_INTERVAL_MS_R824 = 20; // R824: fill only inter-item audio gaps; prevents persistent master starvation
const AUDIO_GAP_BRIDGE_SAMPLES_R824 = Math.max(1,Math.round(AUDIO_SAMPLE_RATE*AUDIO_GAP_BRIDGE_INTERVAL_MS_R824/1000));
const AUDIO_GAP_BRIDGE_CHUNK_R824 = Buffer.alloc(AUDIO_GAP_BRIDGE_SAMPLES_R824*2*2); // s16le stereo silence, 20 ms
const MP3_TO_VIDEO_TAIL_GUARD_MS_R972 = Math.max(0,Math.min(4000,Number(process.env.ANDRIK_MP3_VIDEO_TAIL_GUARD_MS||200))); // R1066: shorter MP3->video transition; A/V prime 1700ms preserved // R972 MP3 audio-tail guard before video insert
const VIDEO_FPS = 25;
const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1'; // R1012 HARD FULL FRAME
const LIVE_FULL_FRAME_FILTER_R794 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=fast_bilinear,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1'; // R1110 CPU-LIGHT: MP3 live feeder only; clips/station stay Lanczos
const LIVE_FULL_FRAME_GEOMETRY_R819 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1'; // R1012 HARD FULL FRAME
const VIDEO_INPUT_QUEUE_PACKETS_R732 = 96; // R974B transition spike cushion // R887 absorb short rawvideo scheduling spikes // R858: bounded RAWVIDEO transition cushion
const AUDIO_INPUT_QUEUE_PACKETS_R732 = 96; // R1221B: restored to the proven 96-packet audio input queue.
const VIDEO_GOP = 50; // R1270: exact R1212 2-second GOP at 25fps
const PUBLISHER_GOP_R1239 = 1; // all-I publisher: every output frame is an IDR/I frame
const LIVE_MP3_CPU_LIGHT_R1110 = true; // R1110: lighter MP3 visual path only; no A/V timing, queue or publisher changes
const R1132_VISUAL_CPU_LOW = 'R1132-NATIVE-1080P25-DIRECT-NO-UNUSED-PNG';
// R1160K: probe asynchronously BEFORE spawning a new normal feeder. Existing
// audio/video handlers keep running while ffprobe inspects changed local media.
const visualProbeCacheR1132 = new Map();
const visualProbePendingR1160K = new Map();
const emptyVisualProfileR1160K=()=>({geometryExact:false,fpsExact:false,pix420:false});
function visualSignatureR1160K(path){
  const st=statSync(path);
  return `${st.size}:${Math.trunc(st.mtimeMs)}`;
}
function visualFastProfileR1132(path){
  try{
    const cached=visualProbeCacheR1132.get(path);
    if(cached&&cached.sig===visualSignatureR1160K(path))return cached.profile;
  }catch(_){ }
  // Conservative geometry/fps filters remain correct on an unprobed file.
  return emptyVisualProfileR1160K();
}
async function primeVisualProfileR1160K(path){
  let sig;
  try{sig=visualSignatureR1160K(path)}catch(_){return emptyVisualProfileR1160K()}
  const cached=visualProbeCacheR1132.get(path);
  if(cached&&cached.sig===sig&&(!cached.retryAt||Date.now()<cached.retryAt))return cached.profile;
  const pending=visualProbePendingR1160K.get(path);
  if(pending){
    await pending;
    return primeVisualProfileR1160K(path);
  }
  const job=new Promise(resolve=>{
    execFile('ffprobe',[
      '-v','error','-select_streams','v:0',
      '-show_entries','stream=width,height,pix_fmt,r_frame_rate,avg_frame_rate',
      '-of','json',path
    ],{encoding:'utf8',timeout:12000,killSignal:'SIGKILL',maxBuffer:256*1024},(error,stdout)=>{
      const profile=emptyVisualProfileR1160K();
      let valid=false;
      if(!error){
        try{
          const j=JSON.parse(String(stdout||'{}'));
          const v=Array.isArray(j.streams)?j.streams[0]:null;
          const rate=x=>{
            const [a,b]=String(x||'0/1').split('/').map(Number);
            return Number.isFinite(a)&&Number.isFinite(b)&&b?a/b:0;
          };
          profile.geometryExact=Number(v?.width)===1920&&Number(v?.height)===1080;
          profile.fpsExact=Math.abs(rate(v?.r_frame_rate)-VIDEO_FPS)<0.02&&Math.abs(rate(v?.avg_frame_rate)-VIDEO_FPS)<0.02;
          profile.pix420=String(v?.pix_fmt||'')==='yuv420p';
          valid=Boolean(v);
        }catch(_){ }
      }
      // Only retain the bounded set of recent visual profiles, including failures.
      visualProbeCacheR1132.delete(path);
      visualProbeCacheR1132.set(path,{sig,profile,retryAt:valid?0:Date.now()+60000});
      while(visualProbeCacheR1132.size>16)visualProbeCacheR1132.delete(visualProbeCacheR1132.keys().next().value);
      resolve(profile);
    });
  });
  visualProbePendingR1160K.set(path,job);
  try{return await job}
  finally{if(visualProbePendingR1160K.get(path)===job)visualProbePendingR1160K.delete(path)}
}

const VIDEO_FRAME_BYTES_R816 = 1920*1080*3/2; // R816 exact YUV420P frame; incomplete feeder tails are never forwarded
const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));
const LIVE_TICKER_FILE = process.env.LIVE_TICKER_FILE || `${CACHE_DIR}/live-ticker.txt`;
const TICKER_PAGE_FILES_R1246 = [0,1,2,3].map(i=>`${CACHE_DIR}/live-ticker-page-r1246-${i+1}.txt`);
const TICKER_PAGE_SECONDS_R1246 = 4;
const TICKER_SPRITE_R1261 = `${CACHE_DIR}/live-ticker-video-r1268.mov`;
const TICKER_SPRITE_META_R1261 = `${CACHE_DIR}/live-ticker-video-r1268.meta.json`;
const TICKER_SPRITE_W_R1261 = 1580;
const TICKER_SPRITE_PAGE_H_R1261 = 84;
const ALBUM_LIKE_OVERLAY_R1262 = `${CACHE_DIR}/album-like-r1262.png`;
const ALBUM_LIKE_PERIOD_SECONDS_R1262 = 60; // R1271: show LIKE once per minute
const ALBUM_LIKE_SHOW_SECONDS_R1262 = 10;
const ALBUM_LIKE_WIDTH_R1262 = 240;
const ALBUM_LIKE_BASE64_R1262 = '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';
const TICKER_RASTER_FILE_R1221 = `${CACHE_DIR}/live-ticker-r1221.png`;
const TICKER_RASTER_TEXT_FILE_R1221 = `${CACHE_DIR}/live-ticker-r1221.txt`;
const TICKER_RASTER_WIDTH_R1221 = 8192;
const TICKER_RASTER_HEIGHT_R1221 = 64;
const TICKER_RASTER_SCROLL_CYCLE_R1221 = TICKER_RASTER_WIDTH_R1221 + 1920;
const TICKER_MOTION_FILE_R1222 = `${CACHE_DIR}/live-ticker-r1223.mov`;
const TICKER_MOTION_META_FILE_R1222 = `${CACHE_DIR}/live-ticker-r1223.meta.txt`;
const TICKER_MOTION_SPEED_R1222 = 110; // R1224: exactly match prepared clip ticker speed
const TICKER_MOTION_HEIGHT_R1222 = 64;
const TICKER_MOTION_DURATION_R1222 = (TICKER_RASTER_WIDTH_R1221 + 1920) / TICKER_MOTION_SPEED_R1222;
const TICKER_UNDERLAY_FILE_R1236 = `${CACHE_DIR}/ticker-underlay-r1236.mp4`;
const TICKER_UNDERLAY_VERSION_R1236 = 'R1236-MOVING-DARK-UNDERLAY-25FPS';
const TICKER_UNDERLAY_HEIGHT_R1236 = 76;
const TICKER_UNDERLAY_Y_R1236 = 1004;
const TICKER_UNDERLAY_ALPHA_R1236 = 0.58;
const ALBUM_TICKER_VIDEO_PREFIX_R1224 = `${VISUAL_CACHE_DIR}/album-ticker-r1226-`;
const ALBUM_TICKER_VIDEO_VERSION_R1224 = 'R1231-BOTTOM-BAND-MOVING-WHITE-BT709-TV';
const ALBUM_BASE_VIDEO_PREFIX_R1227 = `${VISUAL_CACHE_DIR}/album-background-video-r1227-`;
const ALBUM_BASE_VIDEO_VERSION_R1227 = 'R1286-PREPARED-ALBUM-BED-16S-AVC420-CLOSEDGOP-DARKPAD';
const ALBUM_BED_SECONDS_R1277 = 16; // exactly one 4-page ticker cycle; loop always restarts on a clean IDR
const ALBUM_BED_GOP_R1277 = 50; // 2s closed GOP at 25fps; 16s is an exact multiple
const ALBUM_BED_LIVE_REBUILD_READRATE_R1279 = Math.max(0.20,Math.min(0.50,Number(process.env.ALBUM_BED_LIVE_REBUILD_READRATE_R1279||0.35)));
const ALBUM_BACKGROUND_WATCH_MS_R1279 = Math.max(15000,Number(process.env.ALBUM_BACKGROUND_WATCH_MS_R1279||45000));
const albumBedRebuildPendingR1279 = new Map();
let albumBedRebuildChainR1279 = Promise.resolve();
let albumBackgroundWatcherBusyR1279 = false;
let albumBedBuilderChildR1280 = null;
let albumBedBuilderPausedR1280 = false;
let albumBedBuilderPauseReasonR1280 = '';

function pauseAlbumBedBuilderR1280(reason='video-insert'){
  const child=albumBedBuilderChildR1280;
  if(!child||child.exitCode!==null||albumBedBuilderPausedR1280)return false;
  try{
    process.kill(child.pid,'SIGSTOP');
    albumBedBuilderPausedR1280=true;
    albumBedBuilderPauseReasonR1280=String(reason||'video-insert');
    state.albumBedBuilderShieldR1280={
      paused:true,
      reason:albumBedBuilderPauseReasonR1280,
      pid:Number(child.pid||0),
      at:new Date().toISOString()
    };
    diagRecordR802('r1280-album-builder-paused-for-insert',{
      reason:albumBedBuilderPauseReasonR1280,
      pid:Number(child.pid||0)
    });
    return true;
  }catch(_){ return false; }
}

function resumeAlbumBedBuilderR1280(reason='video-insert-ended'){
  const child=albumBedBuilderChildR1280;
  if(!child||child.exitCode!==null){
    albumBedBuilderPausedR1280=false;
    albumBedBuilderPauseReasonR1280='';
    return false;
  }
  if(!albumBedBuilderPausedR1280)return false;
  try{
    process.kill(child.pid,'SIGCONT');
    state.albumBedBuilderShieldR1280={
      paused:false,
      reason:String(reason||'video-insert-ended'),
      pid:Number(child.pid||0),
      at:new Date().toISOString()
    };
    diagRecordR802('r1280-album-builder-resumed-after-insert',{
      reason:String(reason||'video-insert-ended'),
      pid:Number(child.pid||0)
    });
  }catch(_){ }
  albumBedBuilderPausedR1280=false;
  albumBedBuilderPauseReasonR1280='';
  return true;
}

async function waitAlbumBedSafeWindowR1280(){
  while(!stopping && (clipActive || stationHandoffActiveR804)){
    state.albumBedBuilderWaitingR1280={
      at:new Date().toISOString(),
      clipActive:Boolean(clipActive),
      stationHandoffActive:Boolean(stationHandoffActiveR804)
    };
    await sleep(500);
  }
  return !stopping;
}
const LIVE_CURRENT_FILE = process.env.LIVE_CURRENT_FILE || `${CACHE_DIR}/current-live.txt`;
const LIVE_PREVIOUS_FILE_R726 = process.env.LIVE_PREVIOUS_FILE_R726 || `${CACHE_DIR}/previous-live-r726.txt`;
const LIVE_NEXT_FILE_R726 = process.env.LIVE_NEXT_FILE_R726 || `${CACHE_DIR}/next-live-r726.txt`;
const LIVE_BOUNDARY_TITLE_FILE_R790 = process.env.LIVE_BOUNDARY_TITLE_FILE_R790 || `${CACHE_DIR}/boundary-title-r790.txt`;
const COMMITTED_NEXT_FILE_R769 = process.env.COMMITTED_NEXT_FILE_R769 || `${CACHE_DIR}/committed-next-r769.json`;
const CLIP_CACHE_DIR = `${CACHE_DIR}/clips`;
const RADIO_CLIPS_URL_R691 = process.env.RADIO_CLIPS_URL_R691 || 'https://andrikmetal.com/api/music/radio-clips-r691';
const LOCAL_LIBRARY_MANIFEST_R854 = `${CACHE_DIR}/local-library-r854.json`;
const LOCAL_CLIPS_MANIFEST_R854 = `${CACHE_DIR}/local-clips-r854.json`;

const RADIO_SPECIAL_KEY_R726 = 'radio/clips/radio-special-30min.mp4';
const RADIO_SPECIAL_HOURLY_KEY_R727 = 'radio/clips/radio-special-60min.mp4';
const JOY_OF_BEING_CLIP_URL = process.env.JOY_OF_BEING_CLIP_URL || 'https://music.andrikmetal.com/clips/joy-of-being-official-2026.mp4';
const JOY_OF_BEING_CLIP_ENABLED = String(process.env.JOY_OF_BEING_CLIP_ENABLED || '1').trim() !== '0';
const JOY_OF_BEING_CLIP_PATH = `${CLIP_CACHE_DIR}/joy-of-being-official-2026.mp4`;
const YA_EST_CLIP_URL_R724 = process.env.YA_EST_CLIP_URL_R724 || 'https://music.andrikmetal.com/clips/ya-est-official-2026.mp4';
const JOY_OF_BEING_CLIP = Object.freeze({
  type:'clip', sourceType:'r2-video', title:'JOY OF BEING', album:'OFFICIAL MUSIC VIDEO',
  key:'clips/joy-of-being-official-2026.mp4', url:JOY_OF_BEING_CLIP_URL, identity:'clip:joy-of-being', builtIn:true
});
const YA_EST_CLIP_R724 = Object.freeze({
  type:'clip', sourceType:'r2-video', title:'Я ЕСТЬ', album:'OFFICIAL MUSIC VIDEO',
  key:'clips/ya-est-official-2026.mp4', url:YA_EST_CLIP_URL_R724, identity:'clip:ya-est', builtIn:true
});
const DEFAULT_LIVE_TICKER = 'ANDRIK METAL RADIO 24/7   •   ANDRIKMETAL.COM   •   НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK   •   ПОДПИСЫВАЙТЕСЬ • СТАВЬТЕ ЛАЙКИ • КОММЕНТИРУЙТЕ   •   ';
const DISABLED_ALBUM_PREFIXES = Object.freeze([]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R1293-MP3-PCM-RESERVOIR8+TRUE-UNDERRUN+WATCHDOG-TELEMETRY',
  cpuHeadroomProfileR794:'R796-LIVE-FAST-SCALE-COMPACT-EQ-FINITE-FADE-PRESCALED-STATIC',
  cpuHeadroomProfileR1129:CPU_HEADROOM_PROFILE_R1129,
  liveClipPrepThrottleR1277:'READRATE-0.35+NICE19+THREAD1',
  stationAvSyncShieldR1280:'PAUSE-LIVE-ALBUM-BUILDER-DURING-VIDEO-INSERTS',
  visualPathFixR1130B:R1130B_VISUAL_PATH_FIX,
  cpuEncoderProfileR1131:CPU_ENCODER_PROFILE_R1131,
  visualCpuLowProfileR1132:R1132_VISUAL_CPU_LOW,
  clipMp3CinematicProfileR1135:R1135_CLIP_MP3_CINEMATIC,
  mp3CinematicTimingR1135B:R1135B_MP3_SHORT_DARK_LONG_REVEAL,
  videoToVideoBlackProfileR1136:R1136_VIDEO_TO_VIDEO_BLACK_SMOOTH,
  clipPacerRuntimeFixR1140B:R1140B_CLIP_PACER_RUNTIME_FIX,
  clipIoBackpressureFixR1141:R1141_CLIP_IO_BACKPRESSURE_FIX,
  stationToClipTailLockR1142:R1142_STATION_TO_CLIP_TAIL_LOCK,
  stationStartFrameLockR1143:R1143_STATION_START_FRAME_LOCK,
  stationMp3AtomicBlackR1145:R1145_STATION_MP3_ATOMIC_BLACK,
  stationBlackMasterLockR1147:R1147_STATION_BLACK_MASTER_LOCK,
  hardStallSelfHealR1146:R1146_HARD_STALL_SELF_HEAL,
  mp3CinematicMasterLockR1148:R1148_MP3_CINEMATIC_MASTER_LOCK,
  installHealthFixR1148B:R1148B_PUBLIC_STATUS_HEALTH_FIX,
  mp3MasterFrameReleaseFixR1148C:R1148C_MASTER_FRAME_RELEASE_FIX,
  mp3IncomingFeederReleaseFixR1148D:R1148D_INCOMING_FEEDER_RELEASE_FIX,
  mp3LockOwnedReleaseFixR1148E:R1148E_LOCK_OWNED_RELEASE_FIX,
  mp3EdgeFrameShieldR1150:R1150_MP3_EDGE_FRAME_SHIELD,
  mp3ToVideoPhasePreserveR1151:R1151_MP3_TO_VIDEO_PHASE_PRESERVE,
  actualNextOwnerFixR1154:R1154_ACTUAL_NEXT_OWNER,
  queueControlR1155:R1155_QUEUE_CONTROL,
  nextMp3PcmPrearmR1156:R1156_NEXT_MP3_PCM_PREARM,
  lastManualQueuePickR1155:null,
  mode: 'R821 STATION NO-DRAIN MAKE-BEFORE-BREAK / R820 MASTER PTS + R819 GEOMETRY + R814 FADE PRESERVED',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'R757 PREV/NEXT ON MP3 + NORMAL CLIPS @ INTRO 2-7s + FINAL 10s / R756 PRESERVED',
  audioMode: `R1281 SAME MASTER A/V TO PRIMARY+BACKUP INDEPENDENT RELIABLE RTMPS / AUDIO QUEUE ${AUDIO_INPUT_QUEUE_PACKETS_R732}`,
  mp3ToVideoFadeMode: 'R757-END-BLACK-HOLD-THEN-VIDEO-FADE-IN',
  clipPreviewMode: 'R757-NORMAL-CLIPS-PREVNEXT-INTRO-2-7S-PLUS-FINAL-10S',
  mp3BoundaryFadeMode: 'R854-R837-RAWVIDEO-FADE-3.10-HOLD-0.20-RECOVER-1.50',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  visualInsetCrop: '',
  libraryTracks: 0,
  libraryAlbumTracks: 0,
  librarySingleTracks: 0,
  libraryCoverTracks: 0,
  duplicateSinglesSkipped: 0,
  libraryVideos: JOY_OF_BEING_CLIP_ENABLED ? 2 : 1,
  libraryBumpers: 0,
  librarySpecial: 0,
  librarySpecial30: 0,
  librarySpecial60: 0,
  specialIntervalSeconds: Math.round(SPECIAL_INTERVAL_MS_R726/1000),
  specialHourlyIntervalSeconds: Math.round(SPECIAL_HOURLY_INTERVAL_MS_R727/1000),
  lastSpecialPlayedAt: null,
  lastSpecialHourlyPlayedAt: null,
  songsSinceBumper: 0,
  nextBumperAfterSongs: 0,
  bumperCadenceMode: 'R1085-RANDOM-EVERY-2-3-4-SONGS',
  normalClipAdmissionMode: 'R764-PREPARED-ONLY-COMMIT-GATE',
  normalClipDeferredCount: 0,
  lastNormalClipDeferred: null,
  lastBumperSlot: 0,
  cycle: 0,
  queueLength: 0,
  queuePosition: 0,
  previous: null,
  current: null,
  next: null,
  lastLibraryRefresh: null,
  lastExit: null,
  lastError: '',
  lastWarning: '',
  lastFfmpegLine: '',
  equalizerPeriod: null,
  equalizerStyle: null,
  equalizerEngine: 'R796-COMPACT-QTRLE-1180-25FPS-4-SLOT',
  visualLoopOffsetSeconds: 0,
  visualContinuityMode: 'R1011B-MASTER-ZERO-SEEK-PER-TRACK',
  clipAvSyncMode: 'R738-PTS0-ASYNC-FIRSTPTS0',
  clipPreDrainMs: CLIP_PRE_DRAIN_MS_R738,
  clipPostDrainMs: CLIP_POST_DRAIN_MS_R738,
  videoTimelineCompensationSeconds: VIDEO_TIMELINE_COMP_DEFAULT_R739,
  videoTimelineCompensationMode: 'R743-DISABLED-FOR-MP3-BOUNDARY',
  clipPlaybackMode: 'R816-PREPARED-RAWVIDEO-FULL-FRAME-RELAY',
  clipPreparationMode: 'R742-SERIAL-NICE19-ONE-THREAD',
  preparedClipReady: 0,
  preparedClipPending: 0,
  preparedClipLast: '',
  videoPipelineLeadSeconds: 0,
  videoHandoffMode: 'R816-RAWVIDEO-FRAME-ALIGNED',
  clipAvSyncMode: 'R821-STATION-ARM-BEFORE-CUT+BOTH-READY+NO-DRAIN+SAME-TICK / R791-AUDIO-PTS0',
  feederFilterChainMode: 'R769-EXPLICIT-CHAIN-SEPARATOR-BETWEEN-ENDMASK-AND-STARTMASK',
  committedNextMode: 'R769-DISK-CHECKPOINT-NORMAL-TRACK-NEXT',
  committedNextTitle: '',
  committedNextRecovered: false,
  committedNextCommittedAt: null,
  suppressedVideoInsert: '',
  transportHealthy: false,
  transportSelfHealPending: false,
  transportSelfHealCount: 0,
  transportTransientCountR792: 0,
  lastTransportTransientAtR792: null,
  lastTransportTransientReasonR792: '',
  lastTransportFatalAt: null,
  lastTransportFatalReason: '',
  outputEgressGuardMode: 'R780-FLV-TAG7-A10+HARD-MUX-FATAL-RESTART',
  fullFrameGuardMode: 'R790-R787-VIEWER-PROVEN-FIT-PAD-1920x1080-SAR1-NO-CROP',
  stationAudioGuardMode: 'R784-BEST-AUDIO-STREAM+PREPARED-RMS-VERIFY',
  stationHandoffModeR821: 'R821-MAKE-BEFORE-BREAK-NO-DRAIN',
  stationLegacyDrainDisabledR821: STATION_LEGACY_DRAIN_DISABLED_R821,
  stationNoDrainPromotionsR821: 0,
  lastStationNoDrainPromotionR821: null,
  masterTimestampErrorCount: 0,
  masterVideoClockMode: 'R820-FRAMECOUNT-PTS-LOCK-25FPS-SINGLE-X264',
  videoRelayFramesWritten: 0,
  videoRelayPartialBytesDropped: 0,
  lastVideoFrameAtR816: null,
  videoRelayMode: 'R816-FULL-FRAME-ONLY-YUV420P',
  lastMasterTimestampErrorAt: null,
  videoTimestampOffsetSecondsR787: 0,
  lastOutputFatalAt: null,
  lastOutputFatalReason: '',
  titleBoundarySwitchMode: 'R816-R790-PTS-LOCKED + RAWVIDEO MAKE-BEFORE-BREAK',
  titleBoundarySwitchTarget: '',
  titleBoundarySwitchScheduledAt: null,
  titleBoundarySwitchFiredAt: null,
  titleBoundarySwitchCount: 0,
  publisherBackpressureSince: null,
  publisherBackpressureRecoveries: 0,
  lastPublisherBackpressureAt: null
};

let publisher = null;

// R1125 independent RTMPS egress workers. `publisher` remains the one and only
// H264/AAC encoder/master; these children only demux local TS and remux to FLV.
let transportPrimaryR1125 = null;
let transportBackupR1125 = null;
// R1281: two independent reliable encoded branches. Legacy R1278 aliases below
// continue to point at PRIMARY so existing status/cleanup code stays compatible.
let encodedTransportReservoirR1278 = null;
let encodedTransportPublisherSourceR1278 = null;
let encodedTransportRelaySinkR1278 = null;
const encodedTransportReservoirsR1281 = {primary:null,backup:null};
const encodedTransportRelaySinksR1281 = {primary:null,backup:null};
let encodedTransportPublisherDataHandlerR1281 = null;
let encodedTransportPublisherErrorHandlerR1281 = null;
const encodedTransportLaneStatsR1281 = {
  primary:{recycles:0,maxBuffered:0,lastBuffered:0},
  backup:{recycles:0,maxBuffered:0,lastBuffered:0}
};
let transportRelayWatchdogTimerR1125 = null;
let orphanFfmpegGcTimerR1160P = null;
const ORPHAN_FFMPEG_MIN_AGE_MS_R1160P = Math.max(10*60*1000, Number(process.env.ORPHAN_FFMPEG_MIN_AGE_MS_R1160P || 20*60*1000));
const ORPHAN_FFMPEG_GC_INTERVAL_MS_R1160P = Math.max(30*1000, Number(process.env.ORPHAN_FFMPEG_GC_INTERVAL_MS_R1160P || 120*1000));
const ORPHAN_RELAY_MIN_AGE_MS_R1160P = Math.max(60*1000, Number(process.env.ORPHAN_RELAY_MIN_AGE_MS_R1160P || 3*60*1000));
const transportRelayRestartTimersR1125 = {primary:null,backup:null};
const transportRelayHealthR1125 = {
  primary:{pid:0,lastAck:-1,lastProgressAt:0,noSocketSince:0,everSocket:false,recycles:0},
  backup:{pid:0,lastAck:-1,lastProgressAt:0,noSocketSince:0,everSocket:false,recycles:0}
};
let producer = null;
let audioGapBridgeTimerR824 = null;
let audioGapBridgeSinkR824 = null;
let audioGapBridgeDrainHandlerR824 = null;
let audioGapBridgeWaitingDrainR824 = false;
let library = [];
let clipLibrary = JOY_OF_BEING_CLIP_ENABLED ? [JOY_OF_BEING_CLIP,YA_EST_CLIP_R724] : [YA_EST_CLIP_R724];
let bumperLibrary = [];
let specialInsertR726 = null;
let specialHourlyInsertR727 = null;
let queue = [];
let queueIndex = 0;
let running = false;
let stopping = false;
let lastPlayed = null;
let clipPublisher = null;
let videoFeeder = null;
let videoFeederPath = '';
let videoFeederPeriod = '';
let clipActive = false;
let stationHandoffActiveR804 = false;
const normalClipRetryR814=new Map(); // R814: selected normal clips get transient retries before any defer
const NORMAL_CLIP_RETRY_MAX_R814=2;
const NORMAL_CLIP_RETRY_DELAY_MS_R814=900;
const NORMAL_CLIP_EOF_MARGIN_MS_R1139=30000; // R1290: emergency-only margin; exact-25fps relay should finish on time, but transient sink stalls must never cut the real clip tail
const R1139_CLIP_STALL_GUARD='R1139-AUDIOQ160+POSTCOMMIT-SOFT-EOF-5S+NO-WHOLE-CLIP-REPLAY';
let visualSwitching = false;
let scheduleTimerR721 = null;
let albumBackgroundWatcherTimerR1279 = null;
let runtimeForceVisualSlot = FORCE_VISUAL_SLOT;
let runtimeVisualAutoSchedule = VISUAL_AUTO_SCHEDULE_R658;
// R1130: one-shot visual switch is armed by control and consumed only when
// the next normal MP3 track starts. Current FFmpeg feeder keeps the old inode.
let pendingVisualNextTrackR1130 = null;
let liveTitleTimerR724 = null;
let liveTitleGenerationR724 = 0;
let songsSinceBumperR724 = 0;
let bumperAfterSongsR724 = BUMPER_MIN_SONGS_R724 + Math.floor(Math.random()*(BUMPER_MAX_SONGS_R724-BUMPER_MIN_SONGS_R724+1));
let lastBumperSlotR724 = 0;
let lastSpecialPlayedAtR726 = Date.now();
let lastSpecialHourlyPlayedAtR727 = Date.now();
let nextPreviewShowTimerR726 = null;
let nextPreviewHideTimerR726 = null;
const recentTrackIdsR726 = [];
let lastClipIdentityR726 = '';
let previousTrackForPreviewR726 = null;
let trackUiGenerationR730 = 0;
const clipPrefetchJobs = new Map();
const prefetchJobs = new Map();
const visualContinuityR735 = new Map();
let videoTimelineCompR739 = VIDEO_TIMELINE_COMP_DEFAULT_R739;
let videoPipelineLeadR744 = VIDEO_PIPELINE_LEAD_SECONDS_R745;
const preparedClipJobsR742 = new Map();
let preparedClipSerialR742 = Promise.resolve();
let preparedClipPendingR742 = 0;
let clipVideoPrerollR744 = null;
let clipVideoPrerollIdentityR744 = '';
let videoFeederTrackIdentityR744 = '';
let videoFeederPrerolledR744 = false;
let suppressedVideoIdentityR744 = '';
let videoHandoffGenerationR744 = 0;
let transportFatalTimerR746 = null;
let outputFatalTimerR780 = null;
let clipVideoPrerollArmedR749 = null;
const clipBoundaryMetaR752 = new Map();
let clipToTrackBoundaryPendingR753 = null;
let nextMp3AudioPrearmR1156 = null;
let videoSourceWatchdogTimerR749 = null;
let videoSourceMissingSinceR749 = 0;
let videoSourceRecoveryBusyR749 = false;
let insertRecoveryCountR749 = 0;
let insertAudioStartFailuresR749 = 0;
// R750 background loudness queue: exactly one analysis FFmpeg at a time.
const loudnessPendingR750 = new Set();
let loudnessSerialR750 = Promise.resolve();
let masterBackpressureWatchdogTimerR750 = null;
let masterBackpressureSinceR750 = 0;
let masterBackpressureAudioBytesR751 = 0;
let masterBackpressureVideoBytesR751 = 0;
let masterBackpressureLastProgressAtR751 = 0;
let masterHardRecoveryBusyR1146 = false;
let rtmpsEgressWatchdogTimerR792 = null;
let rtmpsEgressWatchBusyR792 = false;
let rtmpsEgressZeroSinceR792 = 0;
let rtmpsEgressEverObservedR792 = false;

// R1124 silent-egress state. These counters reset whenever the publisher PID changes.
let rtmpsProgressWatchdogTimerR1124 = null;
let rtmpsProgressWatchBusyR1124 = false;
let rtmpsProgressPublisherPidR1124 = 0;
let rtmpsProgressLastAckedR1124 = -1;
let rtmpsProgressLastAtR1124 = 0;
let rtmpsProgressRecoveryBusyR1124 = false;

const sleep = ms => new Promise(r => setTimeout(r, ms));
function promiseTimeout(promise,ms,label='operation'){
  let timer=null;
  return Promise.race([
    promise,
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timeout ${ms}ms`)),ms);})
  ]).finally(()=>{if(timer)clearTimeout(timer);});
}
const cleanText = value => String(value || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
const shortText = (value, max = 52) => {
  const s = cleanText(value);
  return s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1)).trim()}…`;
};


// R1160P LONG-RUN CHILD HYGIENE
// Every intentionally long-lived ffmpeg child has a JS owner reference. A process
// that survives a boundary/recovery but loses that reference is an orphan and can
// accumulate RAM/tasks for hours. GC only targets DIRECT ffmpeg children of this
// Node PID that are unowned and older than a wide safety window.
function ownedFfmpegPidsR1160P(){
  const out=new Set();
  const add=child=>{const pid=Number(child?.pid||0);if(pid>1&&child?.exitCode===null)out.add(pid);};
  add(publisher);
  add(transportPrimaryR1125);
  add(transportBackupR1125);
  add(producer);
  add(clipPublisher);
  add(videoFeeder);
  add(clipVideoPrerollR744);
  add(nextMp3AudioPrearmR1156?.child);
  add(insertPrearmR1069?.child);
  add(stationBlackPrearmR1145?.child);
  return out;
}

function procDirectFfmpegSnapshotR1160P(){
  const rows=[];
  let uptimeSec=0;
  try{uptimeSec=Number(String(readFileSync('/proc/uptime','utf8')).trim().split(/\s+/)[0])||0;}catch(_){return rows;}
  let names=[];
  try{names=readdirSync('/proc');}catch(_){return rows;}
  for(const name of names){
    if(!/^\d+$/.test(name))continue;
    const pid=Number(name);
    try{
      if(String(readFileSync(`/proc/${pid}/comm`,'utf8')).trim()!=='ffmpeg')continue;
      const statLine=String(readFileSync(`/proc/${pid}/stat`,'utf8'));
      const close=statLine.lastIndexOf(')');
      if(close<0)continue;
      const rest=statLine.slice(close+2).trim().split(/\s+/);
      const procState=String(rest[0]||'');
      const ppid=Number(rest[1]||0);
      const startTicks=Number(rest[19]||0);
      if(ppid!==process.pid||!Number.isFinite(startTicks)||startTicks<=0)continue;
      // Ubuntu/Linux USER_HZ is 100; this is only a conservative age gate.
      const ageMs=Math.max(0,(uptimeSec-(startTicks/100))*1000);
      let cmd='';
      try{cmd=String(readFileSync(`/proc/${pid}/cmdline`)).replace(/\0/g,' ').trim();}catch(_){}
      const role=/udp:\/\/127\.0\.0\.1:32125/.test(cmd)
        ? 'orphan-primary-relay'
        : (/udp:\/\/127\.0\.0\.1:32126/.test(cmd)?'orphan-backup-relay':'orphan-ffmpeg');
      rows.push({pid,ppid,state:procState,ageMs,role});
    }catch(_){}
  }
  return rows;
}

async function terminateChildR1160P(child,reason='cleanup',graceMs=700){
  if(!child||child.exitCode!==null)return true;
  try{child.__r1160PIntentionalStop=true;}catch(_){}
  try{child.kill('SIGCONT');}catch(_){}
  try{child.kill('SIGTERM');}catch(_){}
  if(await waitChildExit(child,graceMs))return true;
  if(child.exitCode===null){
    try{child.kill('SIGKILL');}catch(_){}
    await waitChildExit(child,250);
  }
  try{diagRecordR802('r1160p-child-hard-cleanup',{pid:Number(child.pid||0),reason:shortText(reason,120),exited:child.exitCode!==null});}catch(_){}
  return child.exitCode!==null;
}

async function orphanFfmpegGcTickR1160P(){
  if(stopping)return;
  const now=Date.now();

  // Tracked prearms should live seconds/minutes, not tens of minutes. If a
  // superseded boundary leaves one tracked, clear it through its normal owner.
  if(nextMp3AudioPrearmR1156 && now-Number(nextMp3AudioPrearmR1156.startedAt||now)>20*60*1000){
    await clearNextMp3AudioPrearmR1156('r1160p-stale-prearm').catch(()=>{});
  }
  if(insertPrearmR1069 && now-Number(insertPrearmR1069.startedAt||now)>30*1000){
    await clearInsertPrearmR1069('r1160p-stale-prearm').catch(()=>{});
  }
  if(stationBlackPrearmR1145 && now-Number(stationBlackPrearmR1145.startedAt||now)>20*60*1000){
    await clearStationBlackPrearmR1145('r1160p-stale-prearm').catch(()=>{});
  }

  const stale=procDirectFfmpegSnapshotR1160P().filter(row=>{
    if(ownedFfmpegPidsR1160P().has(row.pid))return false;
    const minAge=/relay/.test(String(row.role||''))
      ? ORPHAN_RELAY_MIN_AGE_MS_R1160P
      : ORPHAN_FFMPEG_MIN_AGE_MS_R1160P;
    return row.ageMs>=minAge;
  });

  state.orphanFfmpegGcLastScanR1160P=new Date().toISOString();
  state.orphanFfmpegGcLastFoundR1160P=stale.length;
  if(!stale.length)return;

  const killed=[];
  for(const row of stale){
    if(ownedFfmpegPidsR1160P().has(row.pid))continue;
    try{process.kill(row.pid,'SIGCONT');}catch(_){}
    try{process.kill(row.pid,'SIGTERM');}catch(_){continue;}
    killed.push({pid:row.pid,ageSec:Math.round(row.ageMs/1000),state:row.state,role:row.role});
    const pid=row.pid;
    const hard=setTimeout(()=>{
      try{
        if(ownedFfmpegPidsR1160P().has(pid))return;
        if(procDirectFfmpegSnapshotR1160P().some(x=>x.pid===pid))process.kill(pid,'SIGKILL');
      }catch(_){}
    },1200);
    hard.unref?.();
  }
  if(killed.length){
    state.orphanFfmpegGcKillsR1160P=Number(state.orphanFfmpegGcKillsR1160P||0)+killed.length;
    state.lastOrphanFfmpegGcR1160P=killed.map(x=>({pid:x.pid,ageSec:x.ageSec,state:x.state}));
    diagRecordR802('r1160p-orphan-ffmpeg-gc',{count:killed.length,total:Number(state.orphanFfmpegGcKillsR1160P||0),pids:killed.map(x=>x.pid).join(','),roles:killed.map(x=>x.role).join(',')});
  }
}

function setLiveTitleR724(text,{delayMs=0}={}){
  liveTitleGenerationR724++;
  const generation=liveTitleGenerationR724;
  if(liveTitleTimerR724){clearTimeout(liveTitleTimerR724);liveTitleTimerR724=null;}
  const commit=()=>{
    if(generation!==liveTitleGenerationR724||stopping)return;
    try{writeFileSync(LIVE_CURRENT_FILE,text,'utf8')}catch(error){state.lastError=`R724 title write: ${cleanText(error?.message||error)}`;}
  };
  if(delayMs>0)liveTitleTimerR724=setTimeout(()=>{liveTitleTimerR724=null;commit();},delayMs);
  else commit();
}
// R790: R781 wall-clock title timers removed. MP3 title handoff is FFmpeg-PTS-bound in titleOverlayFiltersR721().

// R802: durable, sanitized black-box diagnostics. These records intentionally omit
// stream keys, RTMPS URLs and full local paths so the latest incident can be exposed
// through the web agent without leaking secrets.
let diagnosticRingR802=[];
const ffmpegLogCountersR1160K=new Map();
const stationIntegrityCacheR802=new Map();
function diagTextR802(value,max=360){
  let text=cleanText(value??'');
  if(STREAM_KEY)text=text.split(STREAM_KEY).join('[stream-key-redacted]');
  text=text.replace(/rtmps:\/\/[^\s"']+/gi,'rtmps://[redacted]');
  text=text.replace(/\/var\/cache\/andrik-radio-r622\/[^\s"']+/g,m=>`<cache>/${m.split('/').pop()}`);
  text=text.replace(/\/opt\/andrik-radio\/[^\s"']+/g,m=>`<app>/${m.split('/').pop()}`);
  return text.slice(0,max);
}
function diagMediaR802(value){return diagTextR802(String(value||'').split('/').pop()||'',120)}
function diagLoadR802(){try{return cleanText(readFileSync('/proc/loadavg','utf8')).split(/\s+/).slice(0,3).join(' ')}catch(_){return ''}}
function diagRecordR802(event,data={}){
  try{
    const safe={};
    for(const [k,v] of Object.entries(data||{})){
      if(v===null||v===undefined||typeof v==='boolean'||typeof v==='number')safe[k]=v;
      else safe[k]=diagTextR802(v,420);
    }
    const rec={
      at:new Date().toISOString(),event:diagTextR802(event,80),
      current:shortText(state.current?.title||'',64),next:shortText(state.next?.title||'',64),
      clipActive:Boolean(clipActive),publisherPid:Number(publisher?.pid||0),videoPid:Number(videoFeeder?.pid||0),
      clipPid:Number(clipPublisher?.pid||0),rtmps:Number(state.rtmpsEstablishedConnectionsR792||0),
      load:diagLoadR802(),
      audioInputQueuePackets:AUDIO_INPUT_QUEUE_PACKETS_R732,
      videoInputQueuePackets:VIDEO_INPUT_QUEUE_PACKETS_R732,
      audioPipeQueuedBytes:Number(publisher?.stdio?.[3]?.writableLength||0),
      videoPipeQueuedBytes:Number(publisher?.stdio?.[4]?.writableLength||0),
      audioNeedsDrain:Boolean(publisher?.stdio?.[3]?.writableNeedDrain),
      videoNeedsDrain:Boolean(publisher?.stdio?.[4]?.writableNeedDrain),
      audioSubmittedSeconds:Number(state.audioMasterAudioSecondsR1085||0),
      videoSubmittedSeconds:Number(state.audioMasterVideoSecondsR1085||0),
      phaseLeadMs:Number(state.audioMasterLeadMsR1085||0),
      drops:Number(state.audioMasterVideoDropsR1085||0),
      duplicates:Number(state.audioMasterVideoDuplicatesR1085||0),
      ...safe
    };
    diagnosticRingR802.push(rec);
    if(diagnosticRingR802.length>DIAG_RING_LIMIT_R802)diagnosticRingR802=diagnosticRingR802.slice(-DIAG_RING_LIMIT_R802);
    mkdirSync(DIAG_DIR_R802,{recursive:true});
    try{
      if(existsSync(DIAG_LOG_R802)&&statSync(DIAG_LOG_R802).size>DIAG_MAX_BYTES_R802){
        try{if(existsSync(DIAG_LOG_R802+'.previous'))unlinkSync(DIAG_LOG_R802+'.previous')}catch(_){ }
        renameSync(DIAG_LOG_R802,DIAG_LOG_R802+'.previous');
      }
    }catch(_){ }
    appendFileSync(DIAG_LOG_R802,JSON.stringify(rec)+'\n','utf8');
    writeFileSync(DIAG_LATEST_R802,JSON.stringify({version:'R802',latest:rec,events:diagnosticRingR802.slice(-30)},null,2),'utf8');
    state.lastDiagnosticAtR802=rec.at;
    return rec;
  }catch(_){return null}
}
function loadDiagR802(){
  try{
    if(!existsSync(DIAG_LOG_R802))return;
    const lines=readFileSync(DIAG_LOG_R802,'utf8').trim().split(/\n+/).slice(-DIAG_RING_LIMIT_R802);
    diagnosticRingR802=lines.map(x=>{try{return JSON.parse(x)}catch(_){return null}}).filter(Boolean);
  }catch(_){ }
}
loadDiagR802();
function diagFfmpegR802(scope,line){
  if(!/error|fail|invalid|broken pipe|non-monoton|corrupt|missing picture|nal unit|timestamp|dts|thread message queue blocking|queue blocking/i.test(String(line||'')))return true;
  // R1160K: a reconnect can emit dozens of H.264 parse messages per second.
  // Count every matching stderr CHUNK, but persist at most one per scope/second.
  // Preserve the newest sample and totals in /status so the recovery cause is not
  // pushed out of the short diagnostic ring by a single codec-error burst.
  const key=String(scope||'unknown').slice(0,80);
  let counter=ffmpegLogCountersR1160K.get(key);
  if(!counter){
    counter={chunks:0,suppressedChunks:0,pendingChunks:0,lastRecordedMs:null,lastAt:null,lastLine:''};
    ffmpegLogCountersR1160K.set(key,counter);
    while(ffmpegLogCountersR1160K.size>16)ffmpegLogCountersR1160K.delete(ffmpegLogCountersR1160K.keys().next().value);
  }
  const now=Date.now();
  counter.chunks++;
  counter.lastAt=new Date(now).toISOString();
  counter.lastLine=diagTextR802(line,420);
  if(counter.lastRecordedMs!==null&&now-counter.lastRecordedMs<1000){
    counter.suppressedChunks++;
    counter.pendingChunks++;
    return false;
  }
  const suppressedSincePrevious=counter.pendingChunks;
  counter.pendingChunks=0;
  counter.lastRecordedMs=now;
  diagRecordR802('ffmpeg-error',{scope:key,line:counter.lastLine,chunks:counter.chunks,suppressedSincePrevious});
  return true;
}

function stationInsertR802(item){return item?.sourceType==='radio-bumper'||String(item?.sourceType||'').startsWith('radio-special')}
function purgePreparedStationR802(sourcePath,{purgeSource=false}={}){
  const ready=preparedClipPathR742(sourcePath);
  for(const f of [ready,preparedClipTitleFileR742(ready),preparedClipTickerFileR742(ready),ready+STATION_PREP_MARKER_R791]){
    try{if(existsSync(f))unlinkSync(f)}catch(_){ }
    stationIntegrityCacheR802.delete(f);
  }
  if(purgeSource){try{if(existsSync(sourcePath))unlinkSync(sourcePath)}catch(_){ }stationIntegrityCacheR802.delete(sourcePath)}
}
async function assertStationIntegrityR802(path,label='station-media'){
  const st=statSync(path);

  if(st.size<500000){
    throw new Error(
      `R825B ${label} file too small: `+
      `${diagMediaR802(path)}: ${st.size}`
    );
  }

  const sig=`${st.size}:${Math.trunc(st.mtimeMs)}`;

  if(stationIntegrityCacheR802.get(path)===sig){
    // R1129 CPU HEADROOM: a cache HIT is normal hot-path telemetry, not an incident.
    // Do not append + rewrite the durable diagnostic files on every repeated hit.
    state.stationIntegrityCacheHitsR1129=Number(state.stationIntegrityCacheHitsR1129||0)+1;
    return true;
  }

  try{
    const {spawn}=await import('node:child_process');

    const probe=await new Promise(
      (resolve,reject)=>{

        const child=spawn(
          'ffprobe',
          [
            '-v','error',

            '-show_entries',
            'format=duration,size:'+
            'stream=index,codec_type,codec_name,'+
            'width,height,sample_rate,channels',

            '-of','json',

            path
          ],
          {
            stdio:[
              'ignore',
              'pipe',
              'pipe'
            ]
          }
        );

        let stdout='';
        let stderr='';
        let done=false;

        const finish=(fn,value)=>{
          if(done)return;
          done=true;
          clearTimeout(timer);
          fn(value);
        };

        child.stdout.on(
          'data',
          chunk=>{
            if(stdout.length<262144){
              stdout+=chunk.toString();
            }
          }
        );

        child.stderr.on(
          'data',
          chunk=>{
            if(stderr.length<65536){
              stderr+=chunk.toString();
            }
          }
        );

        child.on(
          'error',
          error=>{
            finish(
              reject,
              error
            );
          }
        );

        child.on(
          'close',
          code=>{
            if(code===0){
              finish(
                resolve,
                stdout
              );
            }else{
              finish(
                reject,
                new Error(
                  `ffprobe exit ${code}: `+
                  `${cleanText(stderr||'unknown error')}`
                )
              );
            }
          }
        );

        const timer=setTimeout(
          ()=>{
            try{
              child.kill('SIGKILL');
            }catch(_){}

            finish(
              reject,
              new Error(
                'ffprobe metadata timeout 4000ms'
              )
            );
          },
          4000
        );
      }
    );

    const info=JSON.parse(
      String(probe||'{}')
    );

    const streams=Array.isArray(info.streams)
      ? info.streams
      : [];

    const video=streams.find(
      x=>x?.codec_type==='video'
    );

    const audio=streams.find(
      x=>x?.codec_type==='audio'
    );

    const duration=Number(
      info?.format?.duration||0
    );

    if(!video){
      throw new Error(
        'video stream missing'
      );
    }

    if(!audio){
      throw new Error(
        'audio stream missing'
      );
    }

    if(
      Number(video.width)<=0 ||
      Number(video.height)<=0
    ){
      throw new Error(
        'invalid video dimensions'
      );
    }

    if(duration<=0.20){
      throw new Error(
        `invalid duration ${duration}`
      );
    }

    stationIntegrityCacheR802.set(
      path,
      sig
    );

    diagRecordR802(
      'r825b-station-integrity-light-ok',
      {
        stage:label,
        media:diagMediaR802(path),
        bytes:st.size,
        duration:
          Number(duration.toFixed(3)),
        video:
          `${video.codec_name||'?'} `+
          `${video.width}x${video.height}`,
        audio:
          `${audio.codec_name||'?'} `+
          `${audio.sample_rate||'?'}Hz `+
          `${audio.channels||'?'}ch`
      }
    );

    return true;

  }catch(error){

    diagRecordR802(
      'r825b-station-integrity-light-fail',
      {
        stage:label,
        media:diagMediaR802(path),
        bytes:st.size,
        error:cleanText(
          error?.message||error
        )
      }
    );

    throw new Error(
      `R825B ${label} invalid: `+
      `${diagMediaR802(path)}: `+
      `${cleanText(error?.message||error)}`
    );
  }
}

// R1013-BUMPER3-AUDIO-DELAY
function stationAudioDelayMsR1013_BASE_R1047(item){
  // R1025: bumper 3 PCM contains silence exactly equal to the
  // existing R917B audio-first prime. Audible audio therefore
  // begins at the actual video promotion boundary.
  return bumperSlotR724(item)===3
    ? Math.max(0,Number(INSERT_AUDIO_PRIME_MS_R917B)||0)
    : 0;
}

function stationAudioDelayMsR1013(item){
  // R1060: remove global +150 ms clip/station audio delay.
  // Preserve bumper-3 specific base compensation only.
  const base=Number(stationAudioDelayMsR1013_BASE_R1047(item))||0;
  return Math.max(0,base);
}
// R1047: +200 ms audio delay for station clips/bumpers only


function bumperSlotR724(item){
  const m=/^radio\/clips\/radio-bumper-([123])\.mp4$/i.exec(String(item?.key||''));
  return m?Number(m[1]):0;
}
function isSpecialInsertR726(item){
  return Boolean(item?.special30min) || String(item?.key||'').toLowerCase()===RADIO_SPECIAL_KEY_R726;
}
function isSpecialHourlyInsertR727(item){
  return Boolean(item?.special60min) || String(item?.key||'').toLowerCase()===RADIO_SPECIAL_HOURLY_KEY_R727;
}
function isAnySpecialInsertR727(item){return isSpecialInsertR726(item)||isSpecialHourlyInsertR727(item);}
function rememberTrackR726(item){
  const id=primaryIdentity(item);
  if(!id)return;
  const i=recentTrackIdsR726.indexOf(id);
  if(i>=0)recentTrackIdsR726.splice(i,1);
  recentTrackIdsR726.push(id);
  while(recentTrackIdsR726.length>TRACK_HISTORY_LIMIT_R726)recentTrackIdsR726.shift();
}
function antiRepeatTrackOrderR726(tracks){
  const recent=new Set(recentTrackIdsR726);
  const fresh=shuffle(tracks.filter(x=>!recent.has(primaryIdentity(x))));
  const old=tracks.filter(x=>recent.has(primaryIdentity(x))).sort((a,b)=>recentTrackIdsR726.indexOf(primaryIdentity(a))-recentTrackIdsR726.indexOf(primaryIdentity(b)));
  return [...fresh,...old];
}
function antiRepeatClipOrderR726(clips){
  const out=shuffle(clips);
  if(out.length>1 && primaryIdentity(out[0])===lastClipIdentityR726){
    const swapIndex=out.findIndex((x,i)=>i>0&&primaryIdentity(x)!==lastClipIdentityR726);
    if(swapIndex>0)[out[0],out[swapIndex]]=[out[swapIndex],out[0]];
  }
  return out;
}
function writeOverlayFileR726(path,text=''){
  try{writeFileSync(path,String(text||''),'utf8')}catch(error){state.lastError=`R726 overlay file: ${cleanText(error?.message||error)}`;}
}
function readCommittedNextR769(){
  try{
    if(!existsSync(COMMITTED_NEXT_FILE_R769))return null;
    const value=JSON.parse(readFileSync(COMMITTED_NEXT_FILE_R769,'utf8'));
    if(!value || value.type!=='track' || !cleanText(value.identity||'') || !/^https:\/\//i.test(String(value.url||'')))return null;
    return value;
  }catch(error){
    state.lastWarning=`R769 committed NEXT read: ${cleanText(error?.message||error)}`;
    return null;
  }
}
function writeCommittedNextR769(item){
  if(item?.type!=='track')return false;
  const payload={
    version:1,
    type:'track',
    identity:primaryIdentity(item),
    title:cleanText(item.title||'ANDRIK'),
    album:cleanText(item.album||''),
    track:cleanText(item.track||''),
    key:String(item.key||''),
    url:String(item.url||''),
    sourceType:String(item.sourceType||'track'),
    committedAt:new Date().toISOString()
  };
  if(!payload.identity || !/^https:\/\//i.test(payload.url))return false;
  try{
    const tmp=`${COMMITTED_NEXT_FILE_R769}.tmp`;
    writeFileSync(tmp,JSON.stringify(payload),'utf8');
    renameSync(tmp,COMMITTED_NEXT_FILE_R769);
    state.committedNextTitle=payload.title;
    state.committedNextCommittedAt=payload.committedAt;
    return true;
  }catch(error){
    state.lastWarning=`R769 committed NEXT write: ${cleanText(error?.message||error)}`;
    return false;
  }
}
function clearCommittedNextR769(item=null){
  try{
    const current=readCommittedNextR769();
    if(item && current){
      const id=primaryIdentity(item);
      if(id!==current.identity && !identityCandidates(item).includes(current.identity))return false;
    }
    if(existsSync(COMMITTED_NEXT_FILE_R769))unlinkSync(COMMITTED_NEXT_FILE_R769);
    state.committedNextTitle='';
    state.committedNextCommittedAt=null;
    return true;
  }catch(error){
    state.lastWarning=`R769 committed NEXT clear: ${cleanText(error?.message||error)}`;
    return false;
  }
}
function restoreCommittedNextR769(items){
  const list=[...items];
  const committed=readCommittedNextR769();
  if(!committed)return list;
  const idx=list.findIndex(item=>item?.type==='track' && (primaryIdentity(item)===committed.identity || identityCandidates(item).includes(committed.identity)));
  if(idx<0){
    state.lastWarning=`R769 committed NEXT no longer in library: ${shortText(committed.title||'TRACK',42)}`;
    clearCommittedNextR769();
    return list;
  }
  const [promised]=list.splice(idx,1);
  list.unshift(promised);
  state.committedNextTitle=promised.title||committed.title||'';
  state.committedNextCommittedAt=committed.committedAt||null;
  state.committedNextRecovered=true;
  console.error('[r769-committed-next]',`recovered promised NEXT first: ${shortText(promised.title||'TRACK',52)}`);
  return list;
}

function cleanPreviewTitleR988(value){
  let t=cleanText(value||'TRACK');

  // Remove artist/clip prefixes if they are already stored inside title metadata.
  t=t.replace(/^\s*(?:КЛИП\s*•\s*)?ANDRIK\s*[—–-]\s*/i,'');
  t=t.replace(/^\s*ANDRIK\s+/i,'');

  // PREVIOUS/NEXT must show only the song/clip name, no album suffix.
  t=t.replace(/\s*\([^()]+\)\s*$/,'').trim();

  return shortText(t||'TRACK',38);
}

function previousTrackFallbackR733(previous){
  if(previousTrackForPreviewR726?.type==='track')return previousTrackForPreviewR726;
  if(previous?.type==='track')return previous;
  // After a service restart the in-memory previous-track pointer is empty, but
  // current-live.txt still contains the title that was on air before the restart.
  // Reuse only a normal ANDRIK track title, never a clip/station label.
  try{
    const raw=cleanText(readFileSync(LIVE_CURRENT_FILE,'utf8'));
    const m=/^ANDRIK\s+[—-]\s+(.+)$/i.exec(raw);
    if(m&&m[1])return {type:'track',title:cleanText(m[1]),album:'',url:'',identity:`r733-file:${cleanText(m[1]).toLowerCase()}`};
  }catch(_){ }
  return null;
}
function clearNextPreviewR726({invalidate=false}={}){
  if(invalidate)trackUiGenerationR730++;
  if(nextPreviewShowTimerR726){clearTimeout(nextPreviewShowTimerR726);nextPreviewShowTimerR726=null;}
  if(nextPreviewHideTimerR726){clearTimeout(nextPreviewHideTimerR726);nextPreviewHideTimerR726=null;}
  writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,'');
  writeOverlayFileR726(LIVE_NEXT_FILE_R726,'');
}
function scheduleNextPreviewR726(previousTrack,nextTrack,duration,currentIdentity,generation){
  clearNextPreviewR726();
  if(!Number.isFinite(duration)||duration<=NEXT_PREVIEW_SECONDS_R726+1)return;
  const showMs=Math.max(0,(duration-NEXT_PREVIEW_SECONDS_R726)*1000);
  const hideMs=Math.max(showMs+300,(duration-NEXT_PREVIEW_HIDE_BEFORE_END_R726)*1000);
  const stillCurrent=()=>generation===trackUiGenerationR730 && state.current?.type==='track' && primaryIdentity(state.current)===currentIdentity;
  nextPreviewShowTimerR726=setTimeout(()=>{
    nextPreviewShowTimerR726=null;
    if(!stillCurrent())return;
    if(previousTrack?.type==='track')writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,`ПРЕДЫДУЩАЯ — ${previewDisplayTitleR989(previousTrack.title)}`);
    if(nextTrack?.type==='track')writeOverlayFileR726(LIVE_NEXT_FILE_R726,`СЛЕДУЮЩАЯ — ${previewDisplayTitleR989(nextTrack.title)}`);
  },showMs);
  nextPreviewShowTimerR726.unref?.();
  nextPreviewHideTimerR726=setTimeout(()=>{
    nextPreviewHideTimerR726=null;
    if(!stillCurrent())return;
    writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,'');
    writeOverlayFileR726(LIVE_NEXT_FILE_R726,'');
  },hideMs);
  nextPreviewHideTimerR726.unref?.();
}
function remainingTrackSecondsR726(){
  if(state.current?.type!=='track'||!state.current?.startedAt||!Number(state.current?.duration))return 0;
  return Math.max(0,Number(state.current.duration)-(Date.now()-Date.parse(state.current.startedAt))/1000);
}
function randomBumperGapR724(){return BUMPER_MIN_SONGS_R724+Math.floor(Math.random()*(BUMPER_MAX_SONGS_R724-BUMPER_MIN_SONGS_R724+1));}
function nextBumperR724(){
  const available=[...bumperLibrary].sort((a,b)=>bumperSlotR724(a)-bumperSlotR724(b));
  if(!available.length)return null;
  let idx=available.findIndex(x=>bumperSlotR724(x)>lastBumperSlotR724);
  if(idx<0)idx=0;
  const item=available[idx];
  lastBumperSlotR724=bumperSlotR724(item)||lastBumperSlotR724;
  state.lastBumperSlot=lastBumperSlotR724;
  return item;
}
function moveUpcomingClipAfterTrackR724(){
  if(queue[queueIndex]?.type!=='clip')return;
  const trackPos=queue.findIndex((x,i)=>i>queueIndex&&x?.type==='track');
  if(trackPos>queueIndex)[queue[queueIndex],queue[trackPos]]=[queue[trackPos],queue[queueIndex]];
}

function shuffle(items){
  const list=[...items];
  for(let i=list.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [list[i],list[j]]=[list[j],list[i]];
  }
  return list;
}

function uniqueByUrl(items){
  const seen=new Set();
  return items.filter(item=>{
    if(!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

// R1160B: the Covers catalog is a real, separate R2 music section.
// These three owner-confirmed songs are covers even if an old manifest still exposes
// a legacy singles/ key during migration.
const R1160B_EXPLICIT_COVERS = Object.freeze([
  'Горячий асфальт',
  'А я скажу нет',
  'Ах эти розы'
]);

function coverTitleCoreR1160B(value){
  return cleanText(value||'')
    .replace(/\.(?:mp3|wav)$/iu,'')
    .replace(/^andrik\s*[-–—:|]\s*/iu,'')
    .replace(/\s*[\[(]\s*(?:ai\s*)?cover\b[^\])]*[\])]\s*$/iu,'')
    .replace(/\s*[\[(]\s*кавер\b[^\])]*[\])]\s*$/iu,'')
    .replace(/\s+/g,' ')
    .trim()
    .toLocaleLowerCase('ru-RU');
}

const R1160B_EXPLICIT_COVER_SET = new Set(
  R1160B_EXPLICIT_COVERS.map(coverTitleCoreR1160B)
);

function isCoverTrackR1160B(item){
  const key=String(item?.key||'');
  const sourceType=String(item?.sourceType||'').toLowerCase();
  const rawTitle=cleanText(item?.title||item?.name||'');
  return (
    sourceType==='cover' ||
    /^(?:covers?|cover-tracks?)\//i.test(key) ||
    /(?:^|[\s([{-])(?:ai\s*)?cover(?:[\s)\]}-]|$)|(?:^|[\s([{-])кавер(?:[\s)\]}-]|$)/iu.test(rawTitle) ||
    R1160B_EXPLICIT_COVER_SET.has(coverTitleCoreR1160B(rawTitle))
  );
}

function albumName(item){
  const title=cleanText(item?.title||item?.name||'').trim();
  const key=String(item?.key||'');

  // Dedicated R2 catalogs are authoritative even if old object metadata contains
  // a stale album label.
  if(/^(?:covers?|cover-tracks?)\//i.test(key))return 'Каверы ANDRIK';
  if(/^singles\//i.test(key))return 'Синглы ANDRIK';

  // ANDRIK: permanent album assignment for this track
  if(/^Ты уже достоин$/iu.test(title))return 'BEYOND';

  const album=cleanText(item.album||'');
  if(album)return album;

  const m=/^albums\/([^/]+)\//i.exec(key);
  return m ? m[1].replace(/[_-]+/g,' ') : 'ANDRIK';
}

function identityText(value){
  return cleanText(value).replace(/(?:\.(?:mp3|wav|mp4))+$/ig,'')
    .replace(/\s*[\[(]\s*(?:beyond|trika|трика|ocean|illusion of life|синглы andrik|singles andrik)\s*[\])]\s*$/iu,'')
    .replace(/^andrik\s*[-–—:|]\s*/iu,'')
    .normalize('NFKD')
    .replace(/\p{M}+/gu,'')
    .toLocaleLowerCase('ru-RU')
    .replace(/[^\p{L}\p{N}]+/gu,' ')
    .replace(/\s+/g,' ')
    .trim();
}

function keyBaseName(item){
  return String(item?.key||'')
    .split('/')
    .pop()
    .replace(/(?:\.(?:mp3|mp4))+$/ig,'')
    .replace(/[_-]+/g,' ');
}

function identityCandidates(item){
  if(item?.type==='clip'){
    const key=cleanText(item?.key||item?.url||item?.title||'clip');
    return [`clip:${key}`];
  }
  const out=[];
  const title=identityText(item?.title||item?.name||'');
  const base=identityText(keyBaseName(item));
  if(title && !/^track \d+$/i.test(title))out.push(`title:${title}`);
  if(base && !/^track \d+$/i.test(base))out.push(`file:${base}`);
  return [...new Set(out)];
}

function primaryIdentity(item){
  return identityCandidates(item)[0] || `url:${String(item?.url||'')}`;
}

function prepareTrack(item,sourceType){
  const track={
    type:'track',
    sourceType,
    title:cleanText(item.title||item.name||'ANDRIK'),
    album:albumName(item),
    track:cleanText(item.track||''),
    key:String(item.key||''),

    uploaded:String(
      item.uploaded||
      item.uploadedAt||
      item.updatedAt||
      item.modifiedAt||
      item.lastModified||
      item.etag||
      ''
    ),

    url:String(item.url||'')
  };
  track.identity=primaryIdentity(track);
  return track;
}

function prepareClip(item){
  const clip={
    type:'clip',
    sourceType:'r2-video',
    title:cleanText(item?.title||item?.name||'ANDRIK VIDEO'),
    album:cleanText(item?.album||'OFFICIAL VIDEO'),
    key:String(item?.key||''),
    url:String(item?.url||''),
    builtIn:Boolean(item?.builtIn),
    bumperSlot:Number(item?.bumperSlot)||0,
    special30min:Boolean(item?.special30min),
    special60min:Boolean(item?.special60min)
  };
  clip.identity=primaryIdentity(clip);
  return clip;
}

function mergeAlbumsAndSingles(albums,singles,covers=[]){
  // R1160B: official albums + true Singles + dedicated R2 Covers all participate
  // in radio rotation. If a legacy singles object has the same cover title as a
  // dedicated covers/ object, the dedicated cover wins so it is never duplicated.
  const keptCovers=Array.isArray(covers)?covers.slice():[];
  const coverTitles=new Set(keptCovers.map(x=>coverTitleCoreR1160B(x?.title||'')));
  const keptSingles=(Array.isArray(singles)?singles:[])
    .filter(x=>!coverTitles.has(coverTitleCoreR1160B(x?.title||'')));
  return {
    tracks:[...albums,...keptSingles,...keptCovers],
    singles:keptSingles,
    covers:keptCovers,
    skipped:Math.max(0,(Array.isArray(singles)?singles.length:0)-keptSingles.length)
  };
}

function librarySignature(items){
  return items
    .map(
      item=>
        `${item.url}|${item.identity}|${item.uploaded||''}`
    )
    .sort()
    .join('\n');
}

async function loadRadioClipsR691(){
  const builtIn=[];

  if(JOY_OF_BEING_CLIP_ENABLED)
    builtIn.push(prepareClip(JOY_OF_BEING_CLIP));

  builtIn.push(prepareClip(YA_EST_CLIP_R724));

  try{
    const url=
      `${RADIO_CLIPS_URL_R691}`+
      `${RADIO_CLIPS_URL_R691.includes('?')?'&':'?'}`+
      `ts=${Date.now()}`;

    const response=await fetch(url,{
      headers:{
        'user-agent':'ANDRIK-Radio-R918-All-Clips'
      },
      signal:AbortSignal.timeout(20000)
    });

    if(!response.ok)
      throw new Error(`R2 radio clips HTTP ${response.status}`);

    const data=await response.json();

    const dynamic=
      (Array.isArray(data?.clips)?data.clips:[])
      .filter(item=>
        /^https:\/\//i.test(String(item?.url||'')) &&
        /\.mp4(?:$|\?)/i.test(String(item?.url||''))
      )
      .map(item=>prepareClip({
        ...item,
        bumperSlot:
          Number(item?.bumperSlot)||
          bumperSlotR724(item),

        special30min:
          Boolean(item?.special30min)||
          isSpecialInsertR726(item),

        special60min:
          Boolean(item?.special60min)||
          isSpecialHourlyInsertR727(item)
      }));

    // ------------------------------
    // Station inserts stay separate
    // ------------------------------

    const bumpersBySlot=new Map();

    specialInsertR726=null;
    specialHourlyInsertR727=null;

    for(const item of dynamic){

      const slot=
        bumperSlotR724(item)||
        Number(item.bumperSlot)||
        0;

      if(slot>=1 && slot<=3 && !bumpersBySlot.has(slot)){

        bumpersBySlot.set(slot,{
          ...item,
          bumperSlot:slot,
          sourceType:'radio-bumper'
        });

      }else if(
        isSpecialInsertR726(item) &&
        !specialInsertR726
      ){

        specialInsertR726={
          ...item,
          special30min:true,
          sourceType:'radio-special-30',
          title:'СПЕЦВСТАВКА • 30 МИН'
        };

      }else if(
        isSpecialHourlyInsertR727(item) &&
        !specialHourlyInsertR727
      ){

        specialHourlyInsertR727={
          ...item,
          special60min:true,
          sourceType:'radio-special-60',
          title:'СПЕЦВСТАВКА • 60 МИН'
        };
      }
    }

    bumperLibrary=
      [...bumpersBySlot.values()]
      .sort((a,b)=>a.bumperSlot-b.bumperSlot);

    // -------------------------------------
    // EVERYTHING ELSE = NORMAL MUSIC CLIP
    // -------------------------------------

    const normalDynamic=dynamic.filter(item=>
      !bumperSlotR724(item) &&
      !Number(item.bumperSlot) &&
      !isAnySpecialInsertR727(item)
    );

    // Exact URL dedupe only.
    // Built-ins + all other normal large MP4s.
    const byUrl=new Map();

    for(const clip of [...builtIn,...normalDynamic]){
      if(clip.url && !byUrl.has(clip.url))
        byUrl.set(clip.url,clip);
    }

    clipLibrary=[...byUrl.values()];

    state.lastWarning='';

  }catch(error){

    console.error(
      '[radio-clips-r918]',
      cleanText(error?.message||error)
    );

    // Network failure must NOT erase already-known dynamic clips.
    const existingDynamic=
      clipLibrary.filter(item=>
        !item.builtIn &&
        !bumperSlotR724(item) &&
        !isAnySpecialInsertR727(item)
      );

    const byUrl=new Map();

    for(const clip of [...builtIn,...existingDynamic]){
      if(clip.url && !byUrl.has(clip.url))
        byUrl.set(clip.url,clip);
    }

    clipLibrary=[...byUrl.values()];

    state.lastWarning=
      `R918 clip library fallback: ${cleanText(error?.message||error)}`;
  }

  state.libraryVideos=clipLibrary.length;
  state.libraryBumpers=bumperLibrary.length;

  state.librarySpecial=
    (specialInsertR726?1:0)+
    (specialHourlyInsertR727?1:0);

  state.librarySpecial30=
    specialInsertR726?1:0;

  state.librarySpecial60=
    specialHourlyInsertR727?1:0;

  // Station material has priority in prepared cache.
  bumperLibrary.forEach(prefetchPreparedClipR742);

  if(specialInsertR726)
    prefetchPreparedClipR742(specialInsertR726);

  if(specialHourlyInsertR727)
    prefetchPreparedClipR742(specialHourlyInsertR727);

  // Then all normal large music clips.
  clipLibrary.forEach(prefetchPreparedClipR742);

  return clipLibrary;
}

async function loadLibrary(){
  const previousSignature=librarySignature([...library,...clipLibrary,...bumperLibrary,...(specialInsertR726?[specialInsertR726]:[]),...(specialHourlyInsertR727?[specialHourlyInsertR727]:[])]);
  const url=`${PLAYLIST_URL}${PLAYLIST_URL.includes('?')?'&':'?'}ts=${Date.now()}`;
  let data;
  // R1160M-ATOMIC-LIBRARY-CACHE: every good remote catalog becomes the next safe fallback.
  // A temporary R2/Worker 5xx must never stop the producer when the last good library exists.
  try{
    const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R691'}});
    if(!response.ok)throw new Error(`R2 library HTTP ${response.status}`);
    data=await response.json();
    if(!Array.isArray(data?.tracks)||!data.tracks.length)throw new Error('R2 library returned empty tracks');
    try{
      mkdirSync(CACHE_DIR,{recursive:true});
      const tmp=`${LOCAL_LIBRARY_MANIFEST_R854}.tmp-${process.pid}`;
      writeFileSync(tmp,JSON.stringify(data));
      renameSync(tmp,LOCAL_LIBRARY_MANIFEST_R854);
    }catch(cacheWriteError){
      console.error('[R1160M-LIBRARY-CACHE-WRITE]',cleanText(cacheWriteError?.message||cacheWriteError));
    }
  }catch(remoteError){
    console.error('[R854-LOCAL-FALLBACK-LIBRARY]',cleanText(remoteError?.message||remoteError));
    let localError=null;
    if(existsSync(LOCAL_LIBRARY_MANIFEST_R854)){
      try{
        const fallback=JSON.parse(readFileSync(LOCAL_LIBRARY_MANIFEST_R854,'utf8'));
        if(!Array.isArray(fallback?.tracks)||!fallback.tracks.length)throw new Error('local library cache is empty');
        data=fallback;
        console.warn('[R1160M-LOCAL-LIBRARY-HIT]',`${fallback.tracks.length} tracks`);
      }catch(error){
        localError=error;
      }
    }
    if(!data&&Array.isArray(library)&&library.length){
      data={tracks:library};
      console.warn('[R1160M-MEMORY-LIBRARY-HIT]',`${library.length} tracks`);
    }
    if(!data){
      if(localError)console.error('[R1160M-LOCAL-LIBRARY-BAD]',cleanText(localError?.message||localError));
      throw remoteError;
    }
  }
  const source=Array.isArray(data.tracks)?data.tracks:[];
  const validMp3=item=>{
    const url=String(item?.url||'');
    return /^(?:https:\/\/|local-cache:\/\/)/i.test(url) && /\.mp3(?:$|\?)/i.test(url);
  };

  const albums=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    const keyLower=key.toLowerCase();
    const disabled=DISABLED_ALBUM_PREFIXES.some(prefix=>keyLower.startsWith(prefix));
    return /^albums\//i.test(key) && !disabled && validMp3(item);
  }).map(item=>prepareTrack(item,'album')));

  const dedicatedCovers=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    return /^(?:covers?|cover-tracks?)\/[^/]+\.mp3$/i.test(key) && validMp3(item);
  }).map(item=>prepareTrack(item,'cover')));

  // Legacy compatibility: while R2/object listings settle, any known cover that is
  // still exposed under singles/ is reclassified as a cover. A dedicated covers/
  // copy wins by title when both exist.
  const legacyCoverSingles=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    return /^singles\/[^/]+\.mp3$/i.test(key) && validMp3(item) && isCoverTrackR1160B(item);
  }).map(item=>prepareTrack(item,'cover')));

  const coversByTitle=new Map();
  for(const item of [...dedicatedCovers,...legacyCoverSingles]){
    const id=coverTitleCoreR1160B(item?.title||item?.key||'');
    if(id && !coversByTitle.has(id))coversByTitle.set(id,item);
  }
  // R1160E: covers stay in R2/site but are temporarily excluded from radio rotation.
  const covers=[];

  const singles=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    return /^singles\/[^/]+\.mp3$/i.test(key) && validMp3(item) && !isCoverTrackR1160B(item);
  }).map(item=>prepareTrack(item,'single')));

  const merged=mergeAlbumsAndSingles(albums,singles,covers);
  if(!merged.tracks.length)throw new Error('R2 active MP3 library is empty');

  library=merged.tracks;
  await loadRadioClipsR691();
  state.libraryTracks=library.length;
  state.libraryAlbumTracks=albums.length;
  state.librarySingleTracks=merged.singles.length;
  state.libraryCoverTracks=merged.covers.length;
  state.duplicateSinglesSkipped=merged.skipped;
  state.libraryVideos=clipLibrary.length;
  state.libraryBumpers=bumperLibrary.length;
  state.lastLibraryRefresh=new Date().toISOString();
  state.librarySpecial=(specialInsertR726?1:0)+(specialHourlyInsertR727?1:0);
  state.librarySpecial30=specialInsertR726?1:0;
  state.librarySpecial60=specialHourlyInsertR727?1:0;
  const changed=previousSignature!==librarySignature([...library,...clipLibrary,...bumperLibrary,...(specialInsertR726?[specialInsertR726]:[]),...(specialHourlyInsertR727?[specialHourlyInsertR727]:[])]);
  return {library,clipLibrary,bumperLibrary,specialInsertR726,specialHourlyInsertR727,changed};
}

function addIdentityCandidates(target,item){
  for(const id of identityCandidates(item))target.add(id);
  if(!identityCandidates(item).length)target.add(primaryIdentity(item));
}

function identityAlreadySeen(target,item){
  const ids=identityCandidates(item);
  return ids.length ? ids.some(id=>target.has(id)) : target.has(primaryIdentity(item));
}

function mixTracksAndClipsR691(tracks,clips){
  const shuffledTracks=antiRepeatTrackOrderR726(tracks);
  const shuffledClips=antiRepeatClipOrderR726(clips);
  if(!shuffledTracks.length)return shuffledClips;
  if(!shuffledClips.length||shuffledTracks.length<2)return [...shuffledTracks,...shuffledClips];
  const gapCount=shuffledTracks.length-1;
  const gaps=shuffle(Array.from({length:gapCount},(_,i)=>i));
  const buckets=Array.from({length:gapCount},()=>[]);
  shuffledClips.forEach((clip,i)=>buckets[gaps[i%gapCount]].push(clip));
  const out=[];
  shuffledTracks.forEach((track,i)=>{
    out.push(track);
    if(i<gapCount&&buckets[i].length)out.push(...buckets[i]);
  });
  return out;
}

function normalClipQueueReadyR764(item){
  if(!item || item.type!=='clip')return true;
  if(item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special'))return true;
  const ready=preparedClipReadyNowR742(item);
  if(!ready){prefetchPreparedClipR742(item);return false;}
  return true;
}
function futureQueueHasIdentityR764(item){
  const id=primaryIdentity(item);
  if(!id)return false;
  return queue.some(x=>primaryIdentity(x)===id);
}
function insertPreparedClipLaterR764(item,{tracksAhead=2}={}){
  if(stopping||!queue.length||!item||item.type!=='clip'||!normalClipQueueReadyR764(item)||futureQueueHasIdentityR764(item))return false;
  if(queue.slice(Math.max(0,queueIndex)).filter(x=>x?.type==='track').length<2)return false;
  let seenTracks=0;
  let insertAt=queue.length;
  for(let i=Math.max(0,queueIndex);i<queue.length;i++){
    if(queue[i]?.type==='track')seenTracks++;
    if(seenTracks>=Math.max(2,Number(tracksAhead)||2)){
      insertAt=i+1;
      break;
    }
  }
  queue.splice(insertAt,0,item);
  state.queueLength=queue.length;
  return true;
}

function reconcileQueueWithLibrary(){
  if(!queue.length)return;
  const played=queue.slice(0,queueIndex);
  const playedIds=new Set();
  played.forEach(item=>addIdentityCandidates(playedIds,item));
  const candidates=[];
  const seen=new Set();
  for(const item of [...library,...clipLibrary]){
    if(item?.type==='clip'&&!normalClipQueueReadyR764(item))continue;
    if(identityAlreadySeen(playedIds,item)||identityAlreadySeen(seen,item))continue;
    candidates.push(item);
    addIdentityCandidates(seen,item);
  }
  const fresh=mixTracksAndClipsR691(candidates.filter(x=>x.type!=='clip'),candidates.filter(x=>x.type==='clip'));
  queue=[...played,...fresh];
  state.queueLength=queue.length;
}

function buildQueue(){
  // R764: only fully prepared local clips enter the mixed playback queue.
  const readyClips=clipLibrary.filter(normalClipQueueReadyR764);
  let out=mixTracksAndClipsR691(library,readyClips);
  // R769: if the service restarted after NEXT was already promised on-air, that exact
  // normal track is forced to position 1. It is cleared only after its PCM really starts.
  out=restoreCommittedNextR769(out);
  state.cycle++;
  state.queueLength=out.length;
  return out;
}

function runCapture(command,args,{timeoutMs=20000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    let out='',err='';
    const timer=setTimeout(()=>{
      child.kill('SIGKILL');
      reject(new Error(`${command} timeout`));
    },timeoutMs);

    child.stdout.on('data',d=>out+=String(d));
    child.stderr.on('data',d=>err+=String(d));
    child.once('error',e=>{
      clearTimeout(timer);
      reject(e);
    });
    child.once('exit',code=>{
      clearTimeout(timer);
      code===0 ? resolve(out) : reject(new Error(`${command} exit ${code}: ${err.slice(-900)}`));
    });
  });
}

async function probeDuration(url){
  const raw=await runCapture(
    'ffprobe',
    ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',url],
    {timeoutMs:25000}
  );
  const duration=Math.max(1,Number(String(raw).trim()||0));
  if(!Number.isFinite(duration))throw new Error('Invalid media duration');
  return duration;
}

function chooseFont(){
  const candidates=[
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf',
    '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf'
  ];
  return candidates.find(existsSync)||'';
}

function chooseTitleFont(){
  // R695: use a condensed heavy italic face already present on standard Ubuntu/OVH
  // installs. It stays readable in Cyrillic/Latin and visually matches the sharper
  // ANDRIK metal artwork better than the old plain yellow system font.
  const candidates=[
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-BoldOblique.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
  ];
  return candidates.find(existsSync)||chooseFont();
}

function ensureTickerRasterR1221(){
  try{
    mkdirSync(CACHE_DIR,{recursive:true});
    let ticker=DEFAULT_LIVE_TICKER;
    try{ticker=cleanText(readFileSync(LIVE_TICKER_FILE,'utf8'))||DEFAULT_LIVE_TICKER}catch(_){ }
    // Repeat the message inside one wide transparent bitmap so the moving layer
    // contains fully rasterized glyphs. LIVE FFmpeg only moves pixels; it no longer
    // re-rasterizes text on every 25fps frame.
    const repeated=`${ticker}   ${ticker}   ${ticker}`;
    let regenerate=true;
    try{
      const oldText=readFileSync(TICKER_RASTER_TEXT_FILE_R1221,'utf8');
      if(oldText===repeated && existsSync(TICKER_RASTER_FILE_R1221) && statSync(TICKER_RASTER_FILE_R1221).size>4000)regenerate=false;
    }catch(_){ }
    if(!regenerate)return true;
    writeFileSync(TICKER_RASTER_TEXT_FILE_R1221,repeated,'utf8');
    const font=chooseFont();
    if(!font)return false;
    const draw=`drawtext=fontfile='${ffFilterPath(font)}':textfile='${ffFilterPath(TICKER_RASTER_TEXT_FILE_R1221)}':fontcolor=white:fontsize=38:x=20:y=11:borderw=0`;
    const r=spawnSync('ffmpeg',[
      '-hide_banner','-loglevel','error','-y',
      '-f','lavfi','-i',`color=c=black@0.0:s=${TICKER_RASTER_WIDTH_R1221}x${TICKER_RASTER_HEIGHT_R1221}:r=1:d=1,format=rgba`,
      '-vf',draw,'-frames:v','1',TICKER_RASTER_FILE_R1221
    ],{stdio:'ignore',timeout:15000});
    return r.status===0 && existsSync(TICKER_RASTER_FILE_R1221) && statSync(TICKER_RASTER_FILE_R1221).size>4000;
  }catch(_){return false;}
}


// R1222 ROOT FIX: clips/video look clean because their moving ticker is rendered OFFLINE
// into a real 25fps video before live playback. The static-album branch was the only
// branch moving a still/raster inside the live filtergraph. Pre-render that movement too.
// Live playback now decodes a tiny 1920x64 alpha MOV and overlays it at fixed x=0.
function ensureTickerMotionR1222(){
  try{
    if(!ensureTickerRasterR1221())return false;
    mkdirSync(CACHE_DIR,{recursive:true});
    let ticker=DEFAULT_LIVE_TICKER;
    try{ticker=cleanText(readFileSync(LIVE_TICKER_FILE,'utf8'))||DEFAULT_LIVE_TICKER}catch(_){ }
    const signature=`R1223|${ticker}|${TICKER_MOTION_SPEED_R1222}|${TICKER_RASTER_WIDTH_R1221}x${TICKER_MOTION_HEIGHT_R1222}|text-only`;
    try{
      if(readFileSync(TICKER_MOTION_META_FILE_R1222,'utf8')===signature &&
         existsSync(TICKER_MOTION_FILE_R1222) && statSync(TICKER_MOTION_FILE_R1222).size>500000)return true;
    }catch(_){ }
    const tmp=TICKER_MOTION_FILE_R1222+`.part-${process.pid}-${Date.now()}.mov`;
    const dur=TICKER_MOTION_DURATION_R1222.toFixed(3);
    const graph=
      `[0:v]format=rgba[raster];`+
      `[1:v][raster]overlay=x='1920-t*${TICKER_MOTION_SPEED_R1222}':y=0:shortest=1:format=auto[out]`;
    const r=spawnSync('ffmpeg',[
      '-hide_banner','-loglevel','error','-y',
      '-loop','1','-framerate','1','-i',TICKER_RASTER_FILE_R1221,
      '-f','lavfi','-i',`color=c=black@0.0:s=1920x${TICKER_MOTION_HEIGHT_R1222}:r=${VIDEO_FPS}:d=${dur},format=rgba`,
      '-filter_complex',graph,
      '-map','[out]','-t',dur,'-r',String(VIDEO_FPS),
      '-c:v','qtrle','-pix_fmt','argb',tmp
    ],{stdio:'ignore',timeout:30000});
    if(r.status!==0 || !existsSync(tmp) || statSync(tmp).size<500000){
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
      return false;
    }
    renameSync(tmp,TICKER_MOTION_FILE_R1222);
    writeFileSync(TICKER_MOTION_META_FILE_R1222,signature,'utf8');
    return true;
  }catch(_){return false;}
}


// R1236: pre-render a tiny REAL moving video strip. This is intentionally not
// transparency-only text and not random per-frame noise. It contains coherent horizontal
// luminance motion, so x264/YouTube must refresh the ticker macroblocks like normal video.
function ensureTickerUnderlayR1236(){
  try{
    mkdirSync(CACHE_DIR,{recursive:true});
    const meta=`${TICKER_UNDERLAY_FILE_R1236}.meta`;
    const signature=`${TICKER_UNDERLAY_VERSION_R1236}|1920x${TICKER_UNDERLAY_HEIGHT_R1236}|${VIDEO_FPS}`;
    try{
      if(readFileSync(meta,'utf8')===signature && existsSync(TICKER_UNDERLAY_FILE_R1236) && statSync(TICKER_UNDERLAY_FILE_R1236).size>20000)return true;
    }catch(_){ }
    const tmp=`${TICKER_UNDERLAY_FILE_R1236}.part-${process.pid}-${Date.now()}.mp4`;
    // 4-second seamless-looking dark luma wave. Values stay deliberately near black.
    // The coherent wave moves continuously; unlike temporal noise it compresses as ordinary video.
    const lavfi=`nullsrc=s=1920x${TICKER_UNDERLAY_HEIGHT_R1236}:r=${VIDEO_FPS}:d=4,geq=lum='18+6*sin(2*PI*(X/420+T*0.55))+3*sin(2*PI*(X/170-T*0.35))':cb=128:cr=128,format=yuv420p`;
    const r=spawnSync('ffmpeg',[
      '-hide_banner','-loglevel','error','-y','-f','lavfi','-i',lavfi,
      '-t','4','-an','-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
      '-pix_fmt','yuv420p','-r',String(VIDEO_FPS),'-g',String(VIDEO_FPS*2),'-keyint_min',String(VIDEO_FPS*2),'-sc_threshold','0','-bf','0',
      '-b:v','500k','-maxrate','500k','-bufsize','1000k',tmp
    ],{stdio:'ignore',timeout:15000});
    if(r.status!==0 || !existsSync(tmp) || statSync(tmp).size<20000){
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
      return false;
    }
    renameSync(tmp,TICKER_UNDERLAY_FILE_R1236);
    writeFileSync(meta,signature,'utf8');
    return true;
  }catch(_){return false;}
}

function fiveAlbumSlotR1224(path){
  const m=String(path||'').match(/album-background-r1211-(illusion|ocean|trika|beyond|silent)\.jpg$/i);
  return m?String(m[1]||'').toLowerCase():'';
}

// R1224 ROOT FIX: use the same principle as prepared clips/video. Background,
// translucent ticker band and moving ticker are baked OFFLINE into one normal
// 1920x1080/25fps H.264 stream. LIVE playback only decodes complete frames.
const albumTickerBuildJobsR1224=new Map();

function albumTickerSpecR1224(visualPath){
  try{
    const slot=fiveAlbumSlotR1224(visualPath);
    if(!slot || !existsSync(visualPath) || statSync(visualPath).size<4096)return null;
    mkdirSync(VISUAL_CACHE_DIR,{recursive:true});
    const out=`${ALBUM_TICKER_VIDEO_PREFIX_R1224}${slot}.mp4`;
    const meta=`${out}.meta.json`;
    const bg=statSync(visualPath);
    let tickerText=DEFAULT_LIVE_TICKER;
    try{tickerText=cleanText(readFileSync(LIVE_TICKER_FILE,'utf8'))||DEFAULT_LIVE_TICKER}catch(_){ }
    try{if(!existsSync(LIVE_TICKER_FILE))writeFileSync(LIVE_TICKER_FILE,tickerText,'utf8')}catch(_){ }
    const signature=JSON.stringify({
      version:ALBUM_TICKER_VIDEO_VERSION_R1224,
      slot,
      bgSize:Number(bg.size||0),
      bgMtime:Number(bg.mtimeMs||0),
      ticker:tickerText,
      speed:TICKER_MOTION_SPEED_R1222,
      fps:VIDEO_FPS,
      duration:Number(TICKER_MOTION_DURATION_R1222.toFixed(3))
    });
    const valid=(()=>{try{return readFileSync(meta,'utf8')===signature && existsSync(out) && statSync(out).size>1000000}catch(_){return false}})();
    return {slot,out,meta,signature,valid};
  }catch(_){return null;}
}

function startAlbumTickerBuildR1224(visualPath,spec){
  try{
    // R1226: never let multiple 1080p preparation jobs compete with the live publisher.
    // One job at a time is enough; tracks without a ready cache keep the visible fallback ticker.
    if(!spec || spec.valid || albumTickerBuildJobsR1224.has(spec.slot) || albumTickerBuildJobsR1224.size>=1)return;
    const tmp=spec.out+`.part-${process.pid}-${Date.now()}.mp4`;
    const dur=TICKER_MOTION_DURATION_R1222.toFixed(3);
    const font=chooseFont();
    if(!font)return;
    const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
    const fontPath=ffFilterPath(font);
    // R1225: EXACT prepared-clip principle. No raster PNG and no alpha overlay.
    // The moving text is drawn directly into the final 1920x1080 frames OFFLINE,
    // just like preparedClipFilterComplexR742. The translucent band is baked too.
    const graph=
      `[0:v]scale=1920:1080:in_range=pc:out_range=tv:force_original_aspect_ratio=decrease:flags=lanczos,`+
      `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${VIDEO_FPS},setpts=N/(${VIDEO_FPS}*TB),format=yuv420p,`+
      `setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709,`+
      `drawbox=x=0:y=ih-72:w=iw:h=72:color=black@0.48:t=fill,`+
      `drawtext=fontfile='${fontPath}':textfile='${tickerPath}':reload=0:fontcolor=white:fontsize=30:`+
      `x='w-mod(t*${TICKER_MOTION_SPEED_R1222}\,text_w+w)':y=h-57:borderw=1:bordercolor=black@0.85,`+
      `format=yuv420p,setparams=range=limited:color_primaries=bt709:color_trc=bt709:colorspace=bt709[outv]`;
    const args=[
      'ffmpeg','-hide_banner','-loglevel','error','-y','-filter_complex_threads','1',
      '-loop','1','-framerate',String(VIDEO_FPS),'-i',visualPath,
      '-filter_complex',graph,'-map','[outv]','-t',dur,
      ...h264EncoderArgsR721(),
      '-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
      '-threads','1','-an','-movflags','+faststart',tmp
    ];
    const child=spawn('nice',['-n','19',...args],{stdio:'ignore'});
    albumTickerBuildJobsR1224.set(spec.slot,child);
    child.on('exit',code=>{
      try{
        if(code===0 && existsSync(tmp) && statSync(tmp).size>1000000){
          renameSync(tmp,spec.out);
          writeFileSync(spec.meta,spec.signature,'utf8');
          state.lastWarning=`R1224 prepared album video ready: ${spec.slot}`;
        }else{
          try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
        }
      }catch(_){try{if(existsSync(tmp))unlinkSync(tmp)}catch(__){ }}
      finally{albumTickerBuildJobsR1224.delete(spec.slot)}
    });
    child.on('error',()=>{albumTickerBuildJobsR1224.delete(spec.slot);try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }});
  }catch(_){ }
}

function ensureAlbumTickerVideoR1224(visualPath){
  const spec=albumTickerSpecR1224(visualPath);
  if(!spec)return '';
  if(spec.valid)return spec.out;
  // Never block live playback while building the prepared visual. The first encounter
  // starts a low-priority background render; subsequent tracks use the completed cache.
  startAlbumTickerBuildR1224(visualPath,spec);
  return '';
}

// Quietly pre-warm the remaining album loops one-by-one. Only one low-priority x264
// cache job is allowed at a time, so the live publisher keeps priority on a 2-vCPU VPS.
let albumTickerPrewarmIndexR1224=0;
function prewarmAlbumTickerVideosR1224(){
  try{
    if(albumTickerBuildJobsR1224.size){setTimeout(prewarmAlbumTickerVideosR1224,15000).unref?.();return;}
    const slots=['illusion','ocean','trika','beyond','silent'];
    while(albumTickerPrewarmIndexR1224<slots.length){
      const slot=slots[albumTickerPrewarmIndexR1224++];
      const path=radioBackgroundLocalPathR1211(slot);
      const spec=albumTickerSpecR1224(path);
      if(spec && !spec.valid){startAlbumTickerBuildR1224(path,spec);setTimeout(prewarmAlbumTickerVideosR1224,15000).unref?.();return;}
    }
  }catch(_){ }
}
// R1227: heavy 92-second baked ticker prewarm disabled; album loops are tiny 2-second background-only videos.


function ffFilterPath(path){
  return String(path).replace(/\\/g,'/').replace(/:/g,'\\:').replace(/'/g,"\\'");
}

function prepareCacheDir(){
  mkdirSync(CACHE_DIR,{recursive:true});
  mkdirSync(AUDIO_CACHE_DIR,{recursive:true});
  mkdirSync(VISUAL_CACHE_DIR,{recursive:true});
  mkdirSync(CLIP_CACHE_DIR,{recursive:true});
  if(!existsSync(LIVE_PREVIOUS_FILE_R726))writeFileSync(LIVE_PREVIOUS_FILE_R726,'','utf8');
  if(!existsSync(LIVE_NEXT_FILE_R726))writeFileSync(LIVE_NEXT_FILE_R726,'','utf8');
  if(!existsSync(LIVE_BOUNDARY_TITLE_FILE_R790))writeFileSync(LIVE_BOUNDARY_TITLE_FILE_R790,'','utf8');
}

function audioCachePath(item){
  const url=String(item?.url||'');

  if(/^local-cache:\/\//i.test(url)){
    const name=decodeURIComponent(
      url.replace(/^local-cache:\/\//i,'')
    ).split('/').pop();

    return `${AUDIO_CACHE_DIR}/${name}`;
  }

  // R978C-VERSION-AWARE-CACHE
  const fingerprint=[
    'R978C',
    url,
    String(item?.key||''),
    String(item?.uploaded||''),
    String(item?.title||'')
  ].join('|');

  const id=createHash('sha1')
    .update(fingerprint)
    .digest('hex')
    .slice(0,24);

  return `${AUDIO_CACHE_DIR}/${id}.mp3`;
}

function cachedAudioPathR712(item){
  if(!item?.url)return '';
  const path=audioCachePath(item);
  try{return existsSync(path)&&statSync(path).size>256000?path:''}catch(_){return ''}
}

async function ensureNextTrackReadyR712(item){
  if(item?.type!=='track')return '';
  const ready=cachedAudioPathR712(item);
  if(ready)return ready;
  return promiseTimeout(downloadTrackToCache(item),5000,'next MP3 preload');
}


// R1156 NEXT-MP3 PCM PREARM
// Dynamic loudnorm can legitimately take several seconds before the first PCM bytes.
// Starting that decoder only after a video insert has already gone black creates a long
// silent black gap. Prearm the *next* MP3 decoder while the video is still playing,
// park it immediately after its first real PCM chunk, and claim the same decoder at
// the real boundary. Nothing is written to the persistent audio master before claim.
async function clearNextMp3AudioPrearmR1156(reason='clear'){
  const arm=nextMp3AudioPrearmR1156;
  nextMp3AudioPrearmR1156=null;
  if(!arm)return false;
  try{if(arm.timeout)clearTimeout(arm.timeout)}catch(_){ }
  const child=arm.child;
  if(child){
    child.__r1156IntentionalStop=true;
    try{child.stdout?.pause()}catch(_){ }
    await terminateChildR1160P(child,`r1156-prearm-${reason}`,700);
  }
  diagRecordR802('r1156-next-mp3-pcm-prearm-clear',{
    title:shortText(arm.title||'',52),
    childPid:Number(child?.pid||0),
    ready:Boolean(arm.ready),
    reason:shortText(reason,120)
  });
  return true;
}

async function buildNextMp3AudioPrearmR1156(item){
  if(stopping||item?.type!=='track')return false;
  const identity=primaryIdentity(item);
  if(!identity)return false;

  const existing=nextMp3AudioPrearmR1156;
  if(existing && existing.identity===identity && existing.ready && existing.child?.exitCode===null){
    return true;
  }
  if(existing)await clearNextMp3AudioPrearmR1156('replace');

  const localAudioPath=await ensureNextTrackReadyR712(item);
  if(stopping)return false;
  const duration=await probeDuration(localAudioPath);
  const loudness=readLoudnessAnalysisR747(localAudioPath);
  const child=spawn('ffmpeg',decoderArgs(localAudioPath,duration,loudness,0),{stdio:['ignore','pipe','pipe']});
  const arm={
    identity,title:item.title||'TRACK',localAudioPath,duration,loudness,child,
    firstChunk:null,ready:false,startedAt:Date.now(),readyAt:0,timeout:null
  };
  nextMp3AudioPrearmR1156=arm;
  child.__r1156AudioPrearm=true;

  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(!line)return;
    if(/error|fail|invalid|corrupt/i.test(line)){
      state.lastWarning=`R1156 MP3 prearm: ${line.slice(-500)}`;
      diagFfmpegR802('r1156-next-mp3-prearm',line);
    }
  });
  child.on('error',error=>{
    if(nextMp3AudioPrearmR1156===arm){
      state.lastWarning=`R1156 MP3 prearm error: ${cleanText(error?.message||error)}`;
      nextMp3AudioPrearmR1156=null;
    }
  });
  child.on('exit',(code,signal)=>{
    if(nextMp3AudioPrearmR1156===arm && !child.__r1156Claimed){
      nextMp3AudioPrearmR1156=null;
      if(!child.__r1156IntentionalStop){
        state.lastWarning=`R1156 MP3 prearm exited ${code??signal}`;
        diagRecordR802('r1156-next-mp3-pcm-prearm-exit',{
          title:shortText(arm.title||'',52),childPid:Number(child.pid||0),code:Number(code||0),signal:String(signal||'')
        });
      }
    }
  });

  return await new Promise(resolve=>{
    let settled=false;
    const finish=value=>{if(settled)return;settled=true;try{if(arm.timeout)clearTimeout(arm.timeout)}catch(_){ }resolve(value);};
    arm.timeout=setTimeout(()=>{
      if(nextMp3AudioPrearmR1156===arm)nextMp3AudioPrearmR1156=null;
      child.__r1156IntentionalStop=true;
      terminateChildR1160P(child,'r1156-prearm-timeout',700).catch(()=>{});
      state.lastWarning=`R1156 MP3 PCM prearm timeout: ${shortText(arm.title,52)}`;
      diagRecordR802('r1156-next-mp3-pcm-prearm-timeout',{
        title:shortText(arm.title||'',52),childPid:Number(child.pid||0),waitMs:Date.now()-arm.startedAt
      });
      finish(false);
    },NEXT_MP3_PCM_PREARM_TIMEOUT_MS_R1156);
    arm.timeout.unref?.();

    child.stdout.once('data',chunk=>{
      if(nextMp3AudioPrearmR1156!==arm || child.exitCode!==null){finish(false);return;}
      try{child.stdout.pause()}catch(_){ }
      arm.firstChunk=Buffer.from(chunk);
      arm.ready=true;
      arm.readyAt=Date.now();
      diagRecordR802('r1156-next-mp3-pcm-prearm-ready',{
        title:shortText(arm.title||'',52),childPid:Number(child.pid||0),
        bytes:Number(arm.firstChunk.length||0),readyMs:arm.readyAt-arm.startedAt,
        loudnessMode:arm.loudness?'measured-linear':'single-pass-fallback'
      });
      finish(true);
    });
  });
}

function claimNextMp3AudioPrearmR1156(item,localAudioPath=''){
  const arm=nextMp3AudioPrearmR1156;
  if(!arm)return null;
  const identity=primaryIdentity(item);
  const pathOk=!localAudioPath || arm.localAudioPath===localAudioPath;
  if(arm.identity!==identity || !pathOk || !arm.ready || !arm.firstChunk || arm.child?.exitCode!==null){
    clearNextMp3AudioPrearmR1156('claim-mismatch').catch(()=>{});
    return null;
  }
  nextMp3AudioPrearmR1156=null;
  try{if(arm.timeout)clearTimeout(arm.timeout)}catch(_){ }
  arm.child.__r1156Claimed=true;
  diagRecordR802('r1156-next-mp3-pcm-prearm-claimed',{
    title:shortText(arm.title||'',52),childPid:Number(arm.child?.pid||0),
    parkedMs:Math.max(0,Date.now()-Number(arm.readyAt||Date.now()))
  });
  return arm;
}

function pruneAudioCache(keepPaths=[]){
  prepareCacheDir();
  const keep=new Set(keepPaths.filter(Boolean));
  let files=[];
  try{
    files=readdirSync(AUDIO_CACHE_DIR)
      .filter(name=>name.endsWith('.mp3'))
      .map(name=>{
        const path=`${AUDIO_CACHE_DIR}/${name}`;
        try{return {path,mtime:statSync(path).mtimeMs,size:statSync(path).size};}catch(_){return null;}
      })
      .filter(Boolean)
      .sort((a,b)=>b.mtime-a.mtime);
  }catch(_){return;}
  let kept=0;
  for(const file of files){
    if(keep.has(file.path)){kept++;continue;}
    if(kept<MAX_CACHED_TRACKS){kept++;continue;}
    try{unlinkSync(file.path);}catch(_){ }
  }
}

async function downloadTrackToCache(item){
  prepareCacheDir();
  const dest=audioCachePath(item);
  try{
    if(existsSync(dest) && statSync(dest).size>256000){
      return dest;
    }
  }catch(_){ }

  if(prefetchJobs.has(dest))return prefetchJobs.get(dest);

  const job=(async()=>{
    let lastError=null;
    for(let attempt=1;attempt<=3;attempt++){
      const tmp=`${dest}.part-${process.pid}-${Date.now()}-${attempt}`;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),45000);
      try{
        const response=await fetch(item.url,{
          headers:{'user-agent':'ANDRIK-Radio-24-7-R612-AntiBuffer'},
          signal:controller.signal
        });
        if(!response.ok)throw new Error(`MP3 cache HTTP ${response.status}`);
        if(!response.body)throw new Error('MP3 cache empty response body');
        await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
        if(!existsSync(tmp) || statSync(tmp).size<256000)throw new Error('MP3 cache file too small');

        // R693: some source MP3 files contain an attached cover whose ID3 metadata says PNG
        // while the actual bytes are JPEG (FF D8 FF E0). FFmpeg then prints misleading
        // "Invalid PNG signature" even though the QR overlay is a valid PNG. Strip every
        // attached-picture/video stream once while caching; audio is copied bit-for-bit.
        const cleanTmp=`${dest}.clean-${process.pid}-${Date.now()}-${attempt}.mp3`; // R713: valid output suffix, prevents ffmpeg exit 234/EINVAL
        try{
          await runCapture('ffmpeg',[
            '-hide_banner','-loglevel','error','-y','-i',tmp,
            '-map','0:a:0','-vn','-sn','-dn','-c:a','copy','-map_metadata','0','-f','mp3',cleanTmp
          ],{timeoutMs:30000});
          if(!existsSync(cleanTmp) || statSync(cleanTmp).size<256000)throw new Error('MP3 audio-only cache file too small');
          unlinkSync(tmp);
          renameSync(cleanTmp,dest);
        }catch(error){
          try{if(existsSync(cleanTmp))unlinkSync(cleanTmp)}catch(_){ }
          throw error;
        }
        pruneAudioCache([dest]);
        return dest;
      }catch(error){
        lastError=error;
        try{unlinkSync(tmp);}catch(_){ }
        if(attempt<3)await sleep(900*attempt);
      }finally{
        clearTimeout(timer);
      }
    }
    throw lastError||new Error('MP3 cache download failed');
  })();

  prefetchJobs.set(dest,job);
  try{return await job;}finally{prefetchJobs.delete(dest);}
}

function scheduleLoudnessAnalysisR750(localAudioPath){
  if(!localAudioPath || readLoudnessAnalysisR747(localAudioPath) || loudnessPendingR750.has(localAudioPath))return;
  loudnessPendingR750.add(localAudioPath);
  loudnessSerialR750=loudnessSerialR750.then(async()=>{
    if(stopping||readLoudnessAnalysisR747(localAudioPath))return;
    try{
      await analyzeLoudnessR747(localAudioPath);
      if(state.lastWarning&&/loudness/i.test(state.lastWarning))state.lastWarning='';
    }catch(error){
      state.lastWarning=`R750 background loudness: ${cleanText(error?.message||error)}`;
      console.error('[loudness-r750-background]',cleanText(error?.message||error));
    }
  }).catch(error=>{
    state.lastWarning=`R750 loudness queue: ${cleanText(error?.message||error)}`;
  }).finally(()=>{loudnessPendingR750.delete(localAudioPath);});
}

function prefetchTrack(item){
  if(!item?.url)return;
  // R793: prefetch is download-only while background loudness is disabled.
  // R791 disabled the live-track analysis path, but R750's prefetch path still
  // called scheduleLoudnessAnalysisR750() unconditionally. That is why R792's
  // live guard legitimately saw [loudness-r750-background] and rolled back.
  downloadTrackToCache(item).then(path=>{
    if(BACKGROUND_LOUDNESS_ENABLED_R791) scheduleLoudnessAnalysisR750(path);
  }).catch(error=>{
    console.error('[prefetch]',cleanText(error?.message||error));
  });
}

function clipCachePathR691(item){
  const localUrl=String(item?.url||'');
  if(/^local-clip:\/\//i.test(localUrl)){
    const name=decodeURIComponent(localUrl.replace(/^local-clip:\/\//i,'')).split('/').pop();
    return `${CLIP_CACHE_DIR}/${name}`;
  }
  if(localUrl===JOY_OF_BEING_CLIP_URL)return JOY_OF_BEING_CLIP_PATH;
  const base=String(item?.key||item?.title||'clip').split('/').pop().replace(/\.mp4$/i,'')
    .normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,56)||'clip';
  const hash=createHash('sha1').update(String(item?.url||item?.key||item?.title||base)).digest('hex').slice(0,10);
  return `${CLIP_CACHE_DIR}/${base}-${hash}.mp4`;
}

async function downloadRadioClipR691(item){
  if(!item?.url)throw new Error('radio clip URL missing');
  prepareCacheDir();
  const dest=clipCachePathR691(item);
  const stationInsert=stationInsertR802(item);
  try{
    if(existsSync(dest)&&statSync(dest).size>500000){
      if(stationInsert){
        try{await assertStationIntegrityR802(dest,'cached-source');return dest}
        catch(error){
          diagRecordR802('station-cache-purge',{stage:'cached-source',media:diagMediaR802(dest),error:cleanText(error?.message||error)});
          purgePreparedStationR802(dest,{purgeSource:true});
        }
      }else return dest;
    }
  }catch(error){if(stationInsert)diagRecordR802('station-cache-check-error',{media:diagMediaR802(dest),error:cleanText(error?.message||error)})}
  if(clipPrefetchJobs.has(dest))return clipPrefetchJobs.get(dest);
  const job=(async()=>{
    const tmp=`${dest}.part-${process.pid}-${Date.now()}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),240000);
    try{
      if(stationInsert)diagRecordR802('station-download-start',{media:diagMediaR802(dest)});
      const response=await fetch(item.url,{headers:{'user-agent':'ANDRIK-Radio-R802-Clip'},signal:controller.signal});
      if(!response.ok)throw new Error(`clip HTTP ${response.status}`);
      if(!response.body)throw new Error('clip empty response');
      await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
      if(!existsSync(tmp)||statSync(tmp).size<500000)throw new Error('clip file too small');
      if(stationInsert)await assertStationIntegrityR802(tmp,'fresh-download');
      renameSync(tmp,dest);
      if(stationInsert)diagRecordR802('station-download-committed',{media:diagMediaR802(dest),bytes:statSync(dest).size});
      return dest;
    }finally{
      clearTimeout(timer);
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
    }
  })();
  clipPrefetchJobs.set(dest,job);
  try{return await job}finally{clipPrefetchJobs.delete(dest)}
}

function prefetchClip(item){
  if(!item?.url)return;
  downloadRadioClipR691(item).catch(error=>console.error('[clip-prefetch]',cleanText(error?.message||error)));
}


function preparedClipPathR742(sourcePath){
  return String(sourcePath).replace(/\.mp4$/i,'')+CLIP_PREP_SUFFIX_R782;
}
function preparedClipExpectedTitleR745(item){
  const stationInsert=item?.sourceType==='radio-bumper'||String(item?.sourceType||'').startsWith('radio-special');
  return stationInsert?'ANDRIK METAL RADIO':`КЛИП • ANDRIK — ${shortText(item?.title||'VIDEO',34)}`;
}
function preparedClipValidR742(sourcePath,readyPath=preparedClipPathR742(sourcePath),item=null){
  try{
    if(!existsSync(sourcePath)||!existsSync(readyPath))return false;
    const src=statSync(sourcePath), out=statSync(readyPath);
    if(!(out.size>CLIP_PREP_MIN_BYTES_R742 && out.mtimeMs>=src.mtimeMs))return false;
    // R745: a prepared MP4 has the title burned into the pixels. If API metadata was
    // corrected later, do not reuse the old numeric-title cache — rebuild it once.
    if(item){
      const titleFile=preparedClipTitleFileR742(readyPath);
      if(!existsSync(titleFile))return false;
      const cachedTitle=cleanText(readFileSync(titleFile,'utf8'));
      if(cachedTitle!==preparedClipExpectedTitleR745(item))return false;
      const stationInsert=item?.sourceType==='radio-bumper'||String(item?.sourceType||'').startsWith('radio-special');
      // R791: old R787 prepared station MP4s may have inherited a positive AAC start PTS.
      // Rebuild each station insert exactly once with the new zero-PTS-before-resample path.
      if(stationInsert && !existsSync(readyPath+STATION_PREP_MARKER_R791))return false;
      // R1135: apply the same zero-PTS-before-resample discipline to NORMAL music clips.
      // Old prepared clips are rebuilt once; source MP4s are preserved.
      if(!stationInsert && !existsSync(readyPath+MUSIC_CLIP_PREP_MARKER_R1135))return false;
    }
    return true;
  }catch(_){return false}
}
async function probePreparedGeometryR787(path){
  const raw=await runCapture('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,sample_aspect_ratio,display_aspect_ratio','-of','json',path],{timeoutMs:15000});
  const st=JSON.parse(raw||'{}')?.streams?.[0]||{};
  const width=Number(st.width||0), height=Number(st.height||0), sar=String(st.sample_aspect_ratio||''), dar=String(st.display_aspect_ratio||'');
  if(width!==1920||height!==1080)throw new Error(`R787 prepared geometry invalid: ${width}x${height}`);
  if(sar && sar!=='1:1')throw new Error(`R787 prepared SAR invalid: ${sar}`);
  return {width,height,sar:sar||'1:1',dar:dar||'16:9'};
}
function preparedClipTitleFileR742(readyPath){return readyPath+'.title.txt';}
function preparedClipTickerFileR742(readyPath){return readyPath+'.ticker.txt';}
function preparedClipFilterComplexR742(titleFile,tickerFile,{stationInsert=false,duration=0,ctaSubscribeInputIndex=-1,ctaLikeInputIndex=-1}={}){
  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const titlePath=ffFilterPath(titleFile);
  const tickerPath=ffFilterPath(tickerFile);
  const base=[
    'setpts=PTS-STARTPTS',
    FULL_FRAME_FILTER_R787,`fps=${VIDEO_FPS}`,`setpts=N/(${VIDEO_FPS}*TB)`,'format=yuv420p'
  ];
  // R782/R766: hold the final frame to the measured A/V boundary. This is OFFLINE
  // preparation only, so the live R780 transport/filtergraph remains untouched.
  const preparedDurationR766=Math.max(0,Number(duration)||0);
  if(preparedDurationR766>0){
    base.push(
      `tpad=stop_mode=clone:stop_duration=${preparedDurationR766.toFixed(3)}`,
      `trim=duration=${preparedDurationR766.toFixed(3)}`,
      'setpts=PTS-STARTPTS'
    );
  }
  if(!stationInsert){
    base.push(
      // R929B_CLIP_OVERLAY_CLEAN
      `drawtext=${titleFontPart}textfile='${titlePath}':fontcolor=0xFFFFFF:fontsize=44:x=(w-text_w)/2:y=h-116:borderw=3:bordercolor=0xE00026@1`,
      `drawtext=${fontPart}textfile='${tickerPath}':fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
    );
  }
  let graph=`[0:v]${base.join(',')}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-32:y=28:shortest=1:format=yuv420,format=yuv420p[qrbase]`;
  // R783: normal music clips alternate the viewer-approved right SUBSCRIBE and
  // the supplied LIKE graphic every 120s. Both are baked OFFLINE into prepared MP4s,
  // so the live R780/R782 transport/filtergraph remains untouched.
  if(!stationInsert && Number.isInteger(ctaSubscribeInputIndex) && ctaSubscribeInputIndex>=0 && Number.isInteger(ctaLikeInputIndex) && ctaLikeInputIndex>=0){
    const d=Math.max(0,Number(duration)||0);
    const windows=[];
    for(let st=CTA_FIRST_SHOW_SECONDS_R748, n=0; st+CTA_SHOW_SECONDS_R722<=d-2.0; st+=CTA_PERIOD_SECONDS_R722, n++){
      windows.push({st,kind:(n%2===0?'subscribe':'like')}); if(windows.length>=8)break;
    }
    if(windows.length){
      const addSource=(inputIndex,kind,prefix)=>{
        const subset=windows.map((w,i)=>({...w,i})).filter(w=>w.kind===kind);
        if(!subset.length)return '';
        const labels=subset.map(w=>`[pcta${w.i}]`).join('');
        let out=`;[${inputIndex}:v]scale=420:-1:flags=lanczos,fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src]`;
        if(subset.length===1)out+=`;[${prefix}src]null${labels}`;
        else out+=`;[${prefix}src]split=${subset.length}${labels}`;
        return out;
      };
      graph+=addSource(ctaSubscribeInputIndex,'subscribe','pctasub');
      graph+=addSource(ctaLikeInputIndex,'like','pctalike');
      let baseLabel='qrbase';
      windows.forEach((w,i)=>{
        const st=w.st;
        const fadeOutAt=st+CTA_SHOW_SECONDS_R722-CTA_FADE_SECONDS_R748;
        graph+=`;[pcta${i}]fade=t=in:st=${st.toFixed(3)}:d=${CTA_FADE_SECONDS_R748.toFixed(2)}:alpha=1,fade=t=out:st=${fadeOutAt.toFixed(3)}:d=${CTA_FADE_SECONDS_R748.toFixed(2)}:alpha=1[pctaf${i}]`;
        const out=`pctaout${i}`;
        graph+=`;[${baseLabel}][pctaf${i}]overlay=x=W-w-${CTA_RIGHT_GAP_R767}:y=H-h-${CTA_BOTTOM_GAP_R748}:shortest=0:eval=init:format=yuv420[${out}]`;
        baseLabel=out;
      });
      graph+=`;[${baseLabel}]format=yuv420p[outv]`;
      return graph;
    }
  }
  graph+=';[qrbase]format=yuv420p[outv]';
  return graph;
}

function runCaptureBufferR782(command,args,{timeoutMs=12000,maxBytes=2*1024*1024}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    const chunks=[]; let total=0,err='',done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value)};
    const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch(_){ }finish(new Error(`${command} PCM probe timeout`));},timeoutMs);
    child.stdout.on('data',d=>{
      if(done)return;
      total+=d.length;
      if(total>maxBytes){try{child.kill('SIGKILL')}catch(_){ }finish(new Error(`${command} PCM probe overflow`));return;}
      chunks.push(Buffer.from(d));
    });
    child.stderr.on('data',d=>err+=String(d));
    child.once('error',e=>finish(e));
    child.once('exit',code=>code===0?finish(null,Buffer.concat(chunks)):finish(new Error(`${command} PCM probe exit ${code}: ${err.slice(-600)}`)));
  });
}

function pcmStatsR784(pcm){
  if(!pcm||pcm.length<4)return {rms:0,peak:0,samples:0};
  let sumSq=0,peak=0,count=0;
  const usable=pcm.length-(pcm.length%2);
  for(let i=0;i<usable;i+=2){
    const v=pcm.readInt16LE(i); const a=Math.abs(v);
    if(a>peak)peak=a; sumSq+=v*v; count++;
  }
  return {rms:count?Math.sqrt(sumSq/count):0,peak,samples:count};
}

async function probeStationBestAudioStreamR784(sourcePath,{maxStreams=4}={}){
  let best={relativeIndex:-1,rms:0,peak:0,samples:0};
  for(let i=0;i<Math.max(1,Number(maxStreams)||1);i++){
    try{
      const pcm=await runCaptureBufferR782('nice',[
        '-n',String(CLIP_PREP_NICE_R742),'ffmpeg','-nostdin','-hide_banner','-nostats','-loglevel','error','-threads','1','-i',sourcePath,
        '-map',`0:a:${i}`,'-vn','-sn','-dn','-t',String(STATION_AUDIO_PROBE_SECONDS_R784),
        '-ac','2','-ar',String(AUDIO_SAMPLE_RATE),'-c:a','pcm_s16le','-f','s16le','pipe:1'
      ],{timeoutMs:20000,maxBytes:2*1024*1024});
      const stats=pcmStatsR784(pcm);
      if(stats.rms>best.rms || (stats.rms===best.rms && stats.peak>best.peak))best={relativeIndex:i,...stats};
    }catch(_){ }
  }
  if(best.relativeIndex<0 || best.rms<STATION_AUDIO_MIN_RMS_R784 || best.peak<STATION_AUDIO_MIN_PEAK_R784){
    throw new Error(`R784 station audio silent/wrong stream: rms=${best.rms.toFixed(2)} peak=${best.peak}`);
  }
  return best;
}

async function probeStationLeadingSilenceR782(sourcePath,audioRelativeIndexR784=0){
  try{
    // R782: all 3 bumpers + both SPECIAL inserts pass the same PCM sample scan.
    // Decode only the first 2.75s in background; no silencedetect/silenceremove and
    // no live-path sleep/drain. Detect first sustained real-audio attack in Node.
    const pcm=await runCaptureBufferR782('nice',[
      '-n',String(CLIP_PREP_NICE_R742),'ffmpeg','-nostdin','-hide_banner','-nostats','-loglevel','error','-threads','1','-i',sourcePath,
      '-map',`0:a:${Math.max(0,Number(audioRelativeIndexR784)||0)}`,'-vn','-sn','-dn','-t',String(STATION_PCM_PROBE_SECONDS_R782),
      '-ac','2','-ar',String(AUDIO_SAMPLE_RATE),'-c:a','pcm_s16le','-f','s16le','pipe:1'
    ],{timeoutMs:15000,maxBytes:1024*1024});
    if(!pcm||pcm.length<4096)return 0;
    const channels=2;
    const framesPerBlock=Math.max(1,Math.round(AUDIO_SAMPLE_RATE*STATION_PCM_BLOCK_MS_R782/1000));
    const samplesPerBlock=framesPerBlock*channels;
    const bytesPerBlock=samplesPerBlock*2;
    const rmsThreshold=32767*Math.pow(10,STATION_LEADING_SILENCE_THRESHOLD_DB_R782/20);
    let consecutive=0,candidateBlock=-1,activeStart=-1;
    const blocks=Math.floor(pcm.length/bytesPerBlock);
    for(let b=0;b<blocks;b++){
      const off=b*bytesPerBlock;
      let sumSq=0,count=0;
      for(let i=0;i<bytesPerBlock;i+=2){
        const v=pcm.readInt16LE(off+i);
        sumSq+=v*v; count++;
      }
      const rms=count?Math.sqrt(sumSq/count):0;
      if(rms>=rmsThreshold){
        if(consecutive===0)candidateBlock=b;
        consecutive++;
        if(consecutive>=STATION_PCM_ACTIVE_BLOCKS_R782){activeStart=candidateBlock*STATION_PCM_BLOCK_MS_R782/1000;break;}
      }else{consecutive=0;candidateBlock=-1;}
    }
    if(!(activeStart>=STATION_LEADING_SILENCE_MIN_R782))return 0;
    // Preserve 20ms before attack, clamp to 2s so we can never eat the actual ident.
    return Math.max(0,Math.min(STATION_LEADING_SILENCE_MAX_TRIM_R782,activeStart-(STATION_PCM_BLOCK_MS_R782/1000)));
  }catch(error){
    state.lastWarning=`R782 station PCM probe: ${cleanText(error?.message||error)}`;
    return 0;
  }
}

async function buildPreparedClipR742(item,sourcePath){
  const readyPath=preparedClipPathR742(sourcePath);
  if(preparedClipValidR742(sourcePath,readyPath,item))return readyPath;
  const stationInsert=item?.sourceType==='radio-bumper'||String(item?.sourceType||'').startsWith('radio-special');
  let stationAudioProbeR784=null;
  let hasAudio=false;
  if(stationInsert){
    stationAudioProbeR784=await probeStationBestAudioStreamR784(sourcePath);
    hasAudio=true;
  }else{
    hasAudio=await probeHasAudioR721(sourcePath);
  }
  if(stationInsert&&!hasAudio)throw new Error(`R787 station insert audio missing: ${shortText(item?.title||'INSERT',40)}`);
  const duration=await probeDuration(sourcePath);
  const stationAudioRelativeIndexR784=stationInsert?Math.max(0,Number(stationAudioProbeR784?.relativeIndex)||0):0;
  const stationLeadTrimR782=stationInsert?await probeStationLeadingSilenceR782(sourcePath,stationAudioRelativeIndexR784):0;
  if(stationInsert){
    const key=String(item?.key||item?.title||'station');
    state.stationLeadingSilenceTrimSeconds=Number(stationLeadTrimR782.toFixed(3));
    state.stationLeadingSilenceTrimByKey={...(state.stationLeadingSilenceTrimByKey||{}),[key]:Number(stationLeadTrimR782.toFixed(3))};
    state.stationSourceAudioByKey={...(state.stationSourceAudioByKey||{}),[key]:{stream:stationAudioRelativeIndexR784,rms:Number((stationAudioProbeR784?.rms||0).toFixed(2)),peak:Number(stationAudioProbeR784?.peak||0)}};
  }
  const titleFile=preparedClipTitleFileR742(readyPath);
  const tickerFile=preparedClipTickerFileR742(readyPath);
  try{writeFileSync(titleFile,preparedClipExpectedTitleR745(item),'utf8')}catch(_){ }
  let ticker=DEFAULT_LIVE_TICKER;
  try{ticker=cleanText(readFileSync(LIVE_TICKER_FILE,'utf8'))||DEFAULT_LIVE_TICKER}catch(_){ }
  try{writeFileSync(tickerFile,ticker,'utf8')}catch(_){ }
  const tmp=readyPath+`.part-${process.pid}-${Date.now()}.mp4`;
  // R1277 CPU SHIELD: prepared clips are OFFLINE cache work. During LIVE, normal
  // music clips are intentionally read at only 0.35x and remain nice(19)/one-thread.
  // They can become ready later and R764 will insert them later; live PCM must win.
  // Station inserts remain fast because they are only a few seconds long.
  const livePrepThrottleR1129=Boolean(!stationInsert && publisher && publisher.exitCode===null);
  const args=[
    '-hide_banner','-loglevel','warning','-y','-filter_complex_threads','1','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    ...(livePrepThrottleR1129?['-readrate','0.35']:[]),'-threads','1','-i',sourcePath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY
  ];
  // R783: both CTA stills are inputs only to OFFLINE preparation for NORMAL clips.
  // Station inserts remain clean; their R782 A/V sync path is unchanged.
  let ctaSubscribeInputIndex=-1, ctaLikeInputIndex=-1;
  if(!stationInsert){
    ctaSubscribeInputIndex=2; args.push('-loop','1','-framerate','1','-i',CTA_OVERLAY_R767);
    ctaLikeInputIndex=3; args.push('-loop','1','-framerate','1','-i',CTA_LIKE_OVERLAY_R783);
  }
  let silentAudioInputIndex=-1;
  if(!hasAudio){silentAudioInputIndex=ctaLikeInputIndex>=0?4:2;args.push('-f','lavfi','-i',`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`);}
  const stationAudioPrepR782=stationInsert
    // R791 ROOT FIX: some 3 s bumpers carry AAC whose first packet starts ~2 s after video.
    // If aresample(first_pts=0) sees that positive source PTS first, it inserts matching
    // silence and the picture visibly starts before the ident sound. Reset timestamps
    // BEFORE aresample, then build the final clock only from decoded sample count.
    ? `${stationLeadTrimR782>0.01?`atrim=start=${stationLeadTrimR782.toFixed(3)},`:''}asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,apad=pad_dur=${Math.max(0.5,duration).toFixed(3)},atrim=duration=${Math.max(0.5,duration).toFixed(3)},asetpts=N/SR/TB`
    // R1135 NORMAL CLIP ROOT FIX: reset decoded AAC PTS before resample too.
    // This prevents inherited container start offsets from becoming artificial leading silence.
    : `asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,asetpts=N/SR/TB`;
  args.push(
    '-filter_complex',preparedClipFilterComplexR742(titleFile,tickerFile,{stationInsert,duration,ctaSubscribeInputIndex,ctaLikeInputIndex}),
    '-map','[outv]',...h264EncoderArgsR721(),'-threads','1',
    '-map',stationInsert?`0:a:${stationAudioRelativeIndexR784}`:(hasAudio?'0:a:0':`${silentAudioInputIndex}:a:0`),'-af',stationAudioPrepR782,
    '-c:a','aac','-profile:a','aac_low','-b:a',AUDIO_BITRATE,'-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-t',String(Math.max(0.5,duration)),'-movflags','+faststart','-max_muxing_queue_size','4096',tmp
  );
  try{
    await runCapture('nice',['-n',String(CLIP_PREP_NICE_R742),'ffmpeg','-nostdin',...args],{timeoutMs:CLIP_PREP_TIMEOUT_MS_R742});
    if(!existsSync(tmp)||statSync(tmp).size<CLIP_PREP_MIN_BYTES_R742)throw new Error('R742 prepared clip too small');
    if(stationInsert)await assertStationIntegrityR802(tmp,'prepared-build');
    const preparedGeometryR787=await probePreparedGeometryR787(tmp);
    const geometryKeyR787=String(item?.key||item?.title||sourcePath.split('/').pop()||'clip');
    state.preparedGeometryByKey={...(state.preparedGeometryByKey||{}),[geometryKeyR787]:{...preparedGeometryR787,verifiedAt:new Date().toISOString()}};
    if(stationInsert){
      const verified=await probeStationBestAudioStreamR784(tmp,{maxStreams:1});
      const key=String(item?.key||item?.title||'station');
      state.stationPreparedAudioByKey={...(state.stationPreparedAudioByKey||{}),[key]:{rms:Number(verified.rms.toFixed(2)),peak:Number(verified.peak),verifiedAt:new Date().toISOString()}};
    }
    renameSync(tmp,readyPath);
    if(stationInsert)diagRecordR802('station-prepared-committed',{media:diagMediaR802(readyPath),duration:Number(duration||0)});
    if(stationInsert){
      try{writeFileSync(readyPath+STATION_PREP_MARKER_R791,`R791 station audio PTS reset before resample\n${new Date().toISOString()}\n`,'utf8')}catch(_){ }
    }else{
      try{writeFileSync(readyPath+MUSIC_CLIP_PREP_MARKER_R1135,`R1135 normal clip audio PTS reset before resample\n${new Date().toISOString()}\n`,'utf8')}catch(_){ }
    }
    state.preparedClipLast=shortText(item?.title||sourcePath.split('/').pop(),52);
    return readyPath;
  }finally{try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }}
}
async function ensurePreparedClipR742(item){
  const sourcePath=await downloadRadioClipR691(item);
  const readyPath=preparedClipPathR742(sourcePath);
  if(preparedClipValidR742(sourcePath,readyPath,item)){
    if(stationInsertR802(item)){
      try{await assertStationIntegrityR802(readyPath,'prepared-cache');return readyPath}
      catch(error){
        diagRecordR802('station-prepared-rebuild',{media:diagMediaR802(readyPath),error:cleanText(error?.message||error)});
        purgePreparedStationR802(sourcePath,{purgeSource:false});
      }
    }else return readyPath;
  }
  if(preparedClipJobsR742.has(readyPath))return preparedClipJobsR742.get(readyPath);
  preparedClipPendingR742++;
  state.preparedClipPending=preparedClipPendingR742;
  const job=preparedClipSerialR742=preparedClipSerialR742.catch(()=>{}).then(()=>buildPreparedClipR742(item,sourcePath));
  preparedClipJobsR742.set(readyPath,job);
  try{return await job}
  finally{
    preparedClipJobsR742.delete(readyPath);
    preparedClipPendingR742=Math.max(0,preparedClipPendingR742-1);
    state.preparedClipPending=preparedClipPendingR742;
    try{
      state.preparedClipReady=readdirSync(CLIP_CACHE_DIR).filter(n=>n.endsWith(CLIP_PREP_SUFFIX_R782)).length;
    }catch(_){ }
  }
}
function prefetchPreparedClipR742(item){
  if(!item?.url)return;
  ensurePreparedClipR742(item).then(()=>{
    // R764: if a normal clip becomes ready after the current cycle was built, insert it
    // only after at least two future songs. Never change the already-running track's NEXT.
    if(item?.type==='clip' && item.sourceType!=='radio-bumper' && !String(item.sourceType||'').startsWith('radio-special')){
      insertPreparedClipLaterR764(item,{tracksAhead:2});
    }
  }).catch(error=>console.error('[clip-prepare-r742]',cleanText(error?.message||error)));
}
function preparedClipReadyNowR742(item){
  try{
    const sourcePath=clipCachePathR691(item);
    const readyPath=preparedClipPathR742(sourcePath);
    return preparedClipValidR742(sourcePath,readyPath,item)?readyPath:'';
  }catch(_){return ''}
}
// R767-SYNC-MARKER: EXACT-VIDEO-N25 + EXACT-AUDIO-NSR + NO-REDUNDANT-LIVE-LANCZOS
function clipLiveVideoFilterR757({duration=0,showPreview=false,fadeOutToBlack=false,fadeInSeconds=VIDEO_INSERT_FADE_IN_SECONDS_R757}={}){
  const font=chooseFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const prevPath=ffFilterPath(LIVE_PREVIOUS_FILE_R726);
  const nextPath=ffFilterPath(LIVE_NEXT_FILE_R726);
  const d=Math.max(0,Number(duration)||0);
  const clipFadeInSecondsR1136=Math.max(0.25,Math.min(2.50,Number(fadeInSeconds)||VIDEO_INSERT_FADE_IN_SECONDS_R757));
  const introStart=START_PREVIEW_DELAY_SECONDS_R748;
  const introEnd=introStart+START_PREVIEW_SHOW_SECONDS_R748;
  // R801: isolate the MP3 boundary. PREVIOUS/NEXT finish four seconds before EOF,
  // leaving the fade + title switch + next-feeder handoff a clean CPU window.
  const outroStart=Math.max(0,d-12.0);
  const outroEnd=Math.max(outroStart+0.25,d-4.0);
  let previewExpr='0';
  if(showPreview&&d>NEXT_PREVIEW_SECONDS_R726+0.5){
    const hasSeparatedIntro=d>(introEnd+NEXT_PREVIEW_SECONDS_R726+0.75);
    previewExpr=hasSeparatedIntro
      ? `between(t\,${introStart.toFixed(3)}\,${introEnd.toFixed(3)})+between(t\,${outroStart.toFixed(3)}\,${outroEnd.toFixed(3)})`
      : `between(t\,${outroStart.toFixed(3)}\,${outroEnd.toFixed(3)})`;
  }
  // R767: readyPath is already the R760/R753 approved 1920x1080/25fps prepared file.
  // Do NOT Lanczos-scale/pad it a second time during LIVE playback. That redundant
  // 1080p filter + live x264 could make video processing fall behind while PCM audio
  // stayed real-time. Keep one exact frame clock instead: frame N == N/25 seconds.
  const vf=[
    `fps=${VIDEO_FPS}`,
    `setpts=N/(${VIDEO_FPS}*TB)`,
    'format=yuv420p',
    // R757: clip starts from real black after the MP3 has faded fully out.
    `fade=t=in:st=0:d=${clipFadeInSecondsR1136.toFixed(2)}`
  ];
  // R766 live safety: even already-cached R760 prepared files may contain a video
  // stream that reaches EOF before the audio stream. Pad the LAST FRAME and then trim
  // both clocks to the same measured duration. This protects old caches immediately.
  if(d>0){
    vf.push(
      `tpad=stop_mode=clone:stop_duration=${d.toFixed(3)}`,
      `trim=duration=${d.toFixed(3)}`,
      `setpts=N/(${VIDEO_FPS}*TB)`
    );
  }
  // R1026B-CLIP-END-FADE
  // Normal music clip -> MP3:
  // smoothly darken, finish on real black, no bright frame between.
  if(fadeOutToBlack && d>3.80){
    const fadeOutSecondsR1026B=3.00; // R1135 cinematic normal-clip fade to black
    const blackTailSecondsR1026B=0.60; // R1135 finish clip on real black before bridge

    const fadeOutAtR1026B=Math.max(
      0,
      d-fadeOutSecondsR1026B-blackTailSecondsR1026B
    );

    vf.push(
      `fade=t=out:st=${fadeOutAtR1026B.toFixed(3)}:d=${fadeOutSecondsR1026B.toFixed(2)}`
    );
  }

  if(showPreview&&previewExpr!=='0'){
    const enable=`:enable='${previewExpr}'`;
    vf.push(
      `drawtext=${fontPart}textfile='${prevPath}':reload=${VIDEO_FPS}:fontcolor=white@1:fontsize=36:x=58:y=h-320:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${enable}`,
      `drawtext=${fontPart}textfile='${nextPath}':reload=${VIDEO_FPS}:fontcolor=white@1:fontsize=36:x=w-text_w-58:y=h-320:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${enable}`
    );
  }
  return vf.join(',');
}

function rawVideoOutputArgsR816(){
  // R816 ROOT TRANSPORT FIX: every local visual process emits complete YUV420P frames.
  // Feeder switches therefore happen BEFORE compression. The persistent master owns the
  // only H.264 encoder, GOP state, SPS/PPS/IDR cadence and the one 25fps output timeline.
  return ['-c:v','rawvideo','-pix_fmt','yuv420p','-f','rawvideo','pipe:1'];
}

function clipPreparedFeederArgsR742(readyPath,{hasAudio=true,duration=0,showPreview=false,fadeOutToBlack=false,fadeInSeconds=VIDEO_INSERT_FADE_IN_SECONDS_R757,stationAudioDelayMsR871=0}={}){
  const d=Math.max(0,Number(duration)||0);
  const dText=d>0?String(Math.max(0.5,d)):'';
  const audioTailLockR766=d>0
    ? `asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,apad=pad_dur=${d.toFixed(3)},atrim=duration=${d.toFixed(3)},asetpts=N/SR/TB`
    : `asetpts=PTS-STARTPTS,aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,asetpts=N/SR/TB`;
  const args=[
    '-hide_banner','-loglevel','warning','-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',readyPath,
    '-map','0:v:0','-an','-sn','-dn',
    '-vf',clipLiveVideoFilterR757({duration:d,showPreview,fadeOutToBlack,fadeInSeconds})
  ];
  if(dText)args.push('-t',dText);
  args.push(...rawVideoOutputArgsR816(),
    '-map',hasAudio?'0:a:0':'0:a:0','-vn','-sn','-dn',
    '-af',stationAudioDelayMsR871>0?`adelay=${Math.round(stationAudioDelayMsR871)}:all=1,${audioTailLockR766}`:audioTailLockR766,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
  );
  if(dText)args.push('-t',dText);
  args.push('-f','s16le','pipe:3');
  return args;
}

function videoLeadForDurationR744(duration){
  const d=Math.max(0,Number(duration)||0);
  return Math.max(0.75,Math.min(videoPipelineLeadR744,Math.max(0.75,d-0.75)));
}
function clipPreparedVideoOnlyArgsR744(readyPath,{duration=0}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',readyPath,
    '-map','0:v:0','-an','-sn','-dn',
    '-vf',`${LIVE_FULL_FRAME_GEOMETRY_R819},fps=${VIDEO_FPS},format=yuv420p`
  ];
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push(...rawVideoOutputArgsR816());
  return args;
}

function clipPreparedAudioOnlyArgsR744(readyPath,{duration=0}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',readyPath,
    '-map','0:a:0','-vn','-sn','-dn',
    '-af',`loudnorm=I=${TRACK_AUDIO_TARGET_I_R726}:LRA=${TRACK_AUDIO_LRA_R726}:TP=${TRACK_AUDIO_TRUE_PEAK_R726},aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
  ];
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','s16le','pipe:1');
  return args;
}
function clipPrerollUsableR749(itemId){
  const alive=Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null&&clipVideoPrerollIdentityR744===itemId);
  if(alive)return true;
  const arm=clipVideoPrerollArmedR749;
  if(!arm||arm.identity!==itemId||arm.invalid)return false;
  const maxAge=Math.max(
    INSERT_PREROLL_ARM_GRACE_MS_R749,
    Math.round((Math.max(1,Number(arm.duration)||1)+Math.max(0,Number(arm.lead)||0)+6)*1000)
  );
  return Date.now()-Number(arm.startedAt||0)<=maxAge && (arm.completedOk||arm.startedOk);
}

async function stopPreparedVideoPrerollR744(){
  const child=clipVideoPrerollR744;
  if(!child){clipVideoPrerollIdentityR744='';clipVideoPrerollArmedR749=null;return;}
  child.__r749IntentionalStop=true;
  try{detachVideoFrameRelayR816(child)}catch(_){ }
  if(child.exitCode===null){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,500))&&child.exitCode===null){try{child.kill('SIGKILL')}catch(_){ }await waitChildExit(child,150);}
  }
  if(clipVideoPrerollR744===child)clipVideoPrerollR744=null;
  clipVideoPrerollIdentityR744='';
  clipVideoPrerollArmedR749=null;
}

async function startPreparedVideoPrerollR744(item,readyPath,duration){
  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!videoSink||videoSink.destroyed||videoSink.writableEnded)throw new Error('R816 persistent rawvideo pipe unavailable');
  visualSwitching=true;
  try{
    await stopNormalVideoFeederR721();
    await stopPreparedVideoPrerollR744();
    clipActive=true;
    const itemId=primaryIdentity(item);
    const lead=videoLeadForDurationR744(duration);
    const child=spawn('ffmpeg',clipPreparedVideoOnlyArgsR744(readyPath,{duration}),{stdio:['ignore','pipe','pipe']});
    child.__r749IntentionalStop=false;
    clipVideoPrerollR744=child;
    clipVideoPrerollIdentityR744=itemId;
    clipVideoPrerollArmedR749={identity:itemId,startedAt:Date.now(),duration:Number(duration)||0,lead,startedOk:true,completedOk:false,completedAt:0,invalid:false,exitCode:null};
    attachVideoFrameRelayR816(child,videoSink,'prepared-preroll');
    child.stdout.on('error',()=>{});
    child.stderr.on('data',d=>{const line=String(d||'').trim();if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);console.error('[r816-video-preroll]',line);}});
    child.on('exit',(code,signal)=>{
      try{detachVideoFrameRelayR816(child)}catch(_){ }
      const isCurrent=clipVideoPrerollR744===child;
      if(isCurrent)clipVideoPrerollR744=null;
      const arm=clipVideoPrerollArmedR749;
      if(child.__r749IntentionalStop)return;
      if(code===0){if(arm&&arm.identity===itemId){arm.completedOk=true;arm.completedAt=Date.now();arm.exitCode=0;}state.videoHandoffMode='R816-PREROLL-CLEAN-EOF-ARMED';return;}
      if(arm&&arm.identity===itemId){arm.invalid=true;arm.exitCode=code??signal??'exit';}
      if(clipVideoPrerollIdentityR744===itemId)clipVideoPrerollIdentityR744='';
      clipActive=false;
      state.lastError=`R816 video preroll failed: ${shortText(item?.title||'VIDEO',40)} exit ${code??signal??'unknown'}`;
      ensureVideoSourceAfterClipR745(state.next).catch(error=>{state.lastError+=` | recovery: ${cleanText(error?.message||error)}`;});
    });
    child.__r749StartedAt=clipVideoPrerollArmedR749.startedAt;
    state.videoHandoffMode='R816-ARMED-RAWVIDEO-INSERT';
    return true;
  }finally{visualSwitching=false;}
}

async function startNormalVideoPrerollR744(item,duration){
  // R1213: preroll must already use the incoming track's static album background.
  // R1211 accidentally used the legacy scheduled/master MP4 here, which caused
  // visible motion for a moment before an MP3 started.
  const visual=await ensureTrackVisualR1211(item);
  const slotR1213=radioBackgroundSlotForItemR1211(item);
  const period=isStaticBackgroundR1211(visual)?`album-${slotR1213||'extras'}`:activeVisualPeriodR721();
  const identity=primaryIdentity(item);
  visualSwitching=true;
  try{
    await stopPreparedVideoPrerollR744();
    clipActive=false;
    await stopNormalVideoFeederR721();
    writeOverlayFileR726(LIVE_CURRENT_FILE,currentOverlayTextR738(item));
    const visualOffsetSeconds=0; // R1011B normal MP3 master always begins at 00:00
    const lead=videoLeadForDurationR744(duration);
    // R747: this feeder starts `lead` seconds before audio only to bridge a video insert.
    // Extend its internal duration by the same lead, so T-8s and fade absolute times
    // still equal the real audible track T-8s/boundary. PREV/NEXT reload because their
    // values are written at the actual audio start, after this preroll has already begun.
    const ok=startNormalVideoFeederR721(visual,{fadeIn:false,trackDuration:Number(duration)+lead,visualOffsetSeconds,previewReload:true});
    videoFeederPath=visual;
    videoFeederPeriod=period;
    videoFeederTrackIdentityR744=identity;
    videoFeederPrerolledR744=true;
    state.videoHandoffMode='R744-PREROLLED-NORMAL';
    return ok;
  }finally{visualSwitching=false;}
}
function fallbackAfterVideoR744(actualNext,next,following){
  if(!actualNext)return null;
  if(actualNext.type==='clip' && primaryIdentity(actualNext)===primaryIdentity(next))return following||null;
  return next||following||null;
}
async function prerollItemR744(item,{duration=0}={}){
  if(!item)return false;
  if(item.type==='track'){
    const local=await ensureNextTrackReadyR712(item);
    const d=Number(duration)>0?Number(duration):await probeDuration(local||item.url);
    return startNormalVideoPrerollR744(item,d);
  }
  const ready=preparedClipReadyNowR742(item);
  if(!ready)throw new Error(`R744 prepared video not ready: ${shortText(item.title||'VIDEO',40)}`);
  const d=Number(duration)>0?Number(duration):await probeDuration(ready);
  return startPreparedVideoPrerollR744(item,ready,d);
}

// R1069 PREARM BEGIN
// Unified station/clip FFmpeg is started before the MP3 boundary.
// Its first A+V bytes stay unread in the OS pipes. Once both streams
// are readable the child is SIGSTOP'ed, so no future media reaches LIVE.
let insertPrearmR1069=null;
let insertPrearmGenerationR1069=0;

async function clearInsertPrearmR1069(reason='clear'){
  const arm=insertPrearmR1069;
  insertPrearmR1069=null;
  if(!arm)return;
  const child=arm.child;
  if(child && child.exitCode===null){
    try{child.kill('SIGCONT')}catch(_){}
    try{child.kill('SIGTERM')}catch(_){}
    if(!(await waitChildExit(child,500)) && child.exitCode===null){
      try{child.kill('SIGKILL')}catch(_){}
      await waitChildExit(child,150);
    }
  }
  diagRecordR802('r1069-prearm-clear',{
    title:arm.item?.title||'VIDEO',
    reason
  });
}

async function buildInsertPrearmR1069(item,nextAfterInsertR1135=null){
  if(!item || !isVideoHandoffR738(item))return false;

  const itemId=primaryIdentity(item);

  if(
    insertPrearmR1069 &&
    insertPrearmR1069.identity===itemId &&
    insertPrearmR1069.child &&
    insertPrearmR1069.child.exitCode===null &&
    insertPrearmR1069.ready
  ){
    return true;
  }

  await clearInsertPrearmR1069('replace');

  let readyPath=preparedClipReadyNowR742(item);
  if(!readyPath){
    await ensurePreparedClipR742(item);
    readyPath=preparedClipReadyNowR742(item);
  }
  if(!readyPath)throw new Error('R1069 prepared clip unavailable');

  const warmed=clipBoundaryMetaR752.get(itemId);
  const duration=(warmed&&warmed.readyPath===readyPath)
    ? Number(warmed.duration||0)
    : await probeDuration(readyPath).catch(()=>0);

  const hasAudio=(warmed&&warmed.readyPath===readyPath)
    ? Boolean(warmed.hasAudio)
    : await probeHasAudioR721(readyPath);

  if(!hasAudio)throw new Error('R1069 candidate has no audio');

  const stationInsert=
    item.sourceType==='radio-bumper' ||
    String(item.sourceType||'').startsWith('radio-special');

  const child=spawn(
    'ffmpeg',
    clipPreparedFeederArgsR742(
      readyPath,
      {
        hasAudio:true,
        duration,
        showPreview:!stationInsert,
        fadeOutToBlack:Boolean(!stationInsert && nextAfterInsertR1135?.type==='track'),
        fadeInSeconds:stationInsert?VIDEO_INSERT_FADE_IN_SECONDS_R757:MUSIC_CLIP_FADE_IN_SECONDS_R1136,
        stationAudioDelayMsR871:stationAudioDelayMsR1013(item)
      }
    ),
    {stdio:['ignore','pipe','pipe','pipe','pipe']}
  );

  child.__r752UnifiedAV=true;
  child.__r752Live=false;
  child.__r1069Prearmed=true;

  const arm={
    identity:itemId,
    item,
    readyPath,
    duration,
    hasAudio,
    stationInsert,
    child,
    videoSource:child.stdout,
    audioSource:child.stdio[3],
    progressSource:child.stdio[4],
    ready:false,
    stopped:false,
    startedAt:Date.now()
  };

  insertPrearmR1069=arm;

  child.stdout.on('error',()=>{});
  child.stdio[3].on('error',()=>{});
  child.stdio[4]?.on('error',()=>{});

  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      diagFfmpegR802(
        stationInsert?'station-prearm-r1069':'clip-prearm-r1069',
        line
      );
    }
  });

  child.once('exit',(code,signal)=>{
    if(insertPrearmR1069===arm && !arm.claimed){
      insertPrearmR1069=null;
      diagRecordR802('r1069-prearm-exit',{
        title:item.title||'VIDEO',
        code,
        signal
      });
    }
  });

  await promiseTimeout(
    Promise.all([
      streamReadableReadyR752(arm.videoSource,'r1069-video',child),
      streamReadableReadyR752(arm.audioSource,'r1069-audio',child)
    ]),
    INSERT_AUDIO_START_TIMEOUT_MS_R749,
    `R1069 prearm A/V ready ${shortText(item.title||'VIDEO',40)}`
  );

  if(child.exitCode!==null)throw new Error('R1069 candidate exited before stop');

  arm.ready=true;

  // Freeze immediately. streamReadableReadyR752 does not consume bytes,
  // therefore the beginning of both streams remains intact.
  try{
    child.kill('SIGSTOP');
    arm.stopped=true;
  }catch(error){
    await clearInsertPrearmR1069('sigstop-failed');
    throw error;
  }

  diagRecordR802('r1069-prearm-ready',{
    title:item.title||'VIDEO',
    childPid:Number(child.pid||0),
    duration:Number(duration||0),
    station:stationInsert
  });

  return true;
}

function takeInsertPrearmR1069(item){
  const arm=insertPrearmR1069;
  if(
    !arm ||
    !arm.ready ||
    arm.identity!==primaryIdentity(item) ||
    !arm.child ||
    arm.child.exitCode!==null
  )return null;

  const ageMsR1281=Date.now()-Number(arm.startedAt||Date.now());
  if(ageMsR1281>INSERT_PREARM_MAX_AGE_MS_R1281){
    insertPrearmR1069=null;
    state.lastRejectedStaleInsertPrearmR1281={
      at:new Date().toISOString(),
      title:shortText(item?.title||'VIDEO',52),
      childPid:Number(arm.child?.pid||0),
      ageMs:Math.max(0,ageMsR1281),
      maxAgeMs:INSERT_PREARM_MAX_AGE_MS_R1281
    };
    diagRecordR802('r1281-stale-insert-prearm-rejected',state.lastRejectedStaleInsertPrearmR1281);
    try{arm.child.kill('SIGCONT')}catch(_){}
    try{arm.child.kill('SIGTERM')}catch(_){}
    setTimeout(()=>{try{if(arm.child.exitCode===null)arm.child.kill('SIGKILL')}catch(_){}},800).unref?.();
    return null;
  }

  insertPrearmR1069=null;
  arm.claimed=true;

  if(arm.stopped){
    try{arm.child.kill('SIGCONT')}catch(_){}
    arm.stopped=false;
  }

  diagRecordR802('r1069-prearm-claimed',{
    title:item.title||'VIDEO',
    childPid:Number(arm.child.pid||0),
    ageMs:Date.now()-Number(arm.startedAt||Date.now())
  });

  return arm;
}
// R1069 PREARM END

function scheduleTrackVideoHandoffR744(currentItem,actualNext,next,following,duration){
  // R752: ZERO next-video frames are allowed into LIVE before the real audio boundary.
  // We only warm the local prepared-file metadata near the end of the song. This keeps
  // the normal visual alive long enough for the R751 late fade to actually be visible.
  const generation=++videoHandoffGenerationR744;
  if(!actualNext || actualNext.type==='track')return 0;
  prefetchPreparedClipR742(actualNext);
  const d=Math.max(0,Number(duration)||0);
  const delayMs=Math.max(0,Math.round((d-INSERT_CACHE_WARM_LEAD_SECONDS_R752)*1000));
  setTimeout(()=>{
    if(stopping||generation!==videoHandoffGenerationR744)return;
    if(primaryIdentity(state.current)!==primaryIdentity(currentItem))return;
    warmClipBoundaryMetaR752(actualNext).catch(error=>{
      state.lastWarning=`R752 clip cache warm: ${cleanText(error?.message||error)}`;
    });
  },delayMs).unref?.();

  // R1069: start the unified candidate at T-4s, wait until both
  // A+V outputs are readable, then SIGSTOP it behind the live MP3.
  const prearmDelayMsR1069=Math.max(
    0,
    Math.round((d-4.0)*1000)
  );

  setTimeout(()=>{
    if(stopping||generation!==videoHandoffGenerationR744)return;
    if(primaryIdentity(state.current)!==primaryIdentity(currentItem))return;

    buildInsertPrearmR1069(actualNext,fallbackAfterVideoR744(actualNext,next,following)).catch(error=>{
      state.lastWarning=
        `R1069 prearm fallback: ${cleanText(error?.message||error)}`;
      clearInsertPrearmR1069('prearm-error').catch(()=>{});
    });
  },prearmDelayMsR1069).unref?.();

  state.videoHandoffMode='R1069-CACHE-WARM+AV-PREARM-SCHEDULED';
  return 0;
}

function localHourInTimeZone(timeZone=VISUAL_TIME_ZONE){
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone,
    hour:'2-digit',
    hourCycle:'h23'
  }).formatToParts(new Date());
  const hour=Number(parts.find(part=>part.type==='hour')?.value||0);
  return Number.isFinite(hour)?hour:0;
}

function visualPeriodForHour(hour){
  if(hour>=6 && hour<12)return 'morning';
  if(hour>=12 && hour<18)return 'day';
  if(hour>=18)return 'evening';
  return 'night';
}

async function downloadVisualToCache(url,dest,label){
  prepareCacheDir();
  try{
    if(existsSync(dest) && statSync(dest).size>2*1024*1024)return dest;
  }catch(_){}
  let lastError=null;
  for(let attempt=1;attempt<=3;attempt++){
    const tmp=`${dest}.part-${process.pid}-${Date.now()}-${attempt}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),120000);
    try{
      const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R621-VisualCache'},signal:controller.signal});
      if(!response.ok)throw new Error(`${label} visual HTTP ${response.status}`);
      if(!response.body)throw new Error(`${label} visual empty response`);
      await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
      if(!existsSync(tmp) || statSync(tmp).size<2*1024*1024)throw new Error(`${label} visual file too small`);
      renameSync(tmp,dest);
      return dest;
    }catch(error){
      lastError=error;
      try{unlinkSync(tmp)}catch(_){}
      if(attempt<3)await sleep(1200*attempt);
    }finally{clearTimeout(timer)}
  }
  throw lastError||new Error(`${label} visual download failed`);
}

const visualIntegrityCacheR806=new Map();
function visualCleanPathR806(source){
  return String(source).replace(/\.mp4$/i,'')+'.r806-clean.mp4';
}
function visualCleanMetaPathR806(source){return visualCleanPathR806(source)+'.meta.json'}
async function strictVisualPacketCheckR806(path){
  const st=statSync(path);
  const sig=`${st.size}:${Math.trunc(st.mtimeMs)}`;
  if(visualIntegrityCacheR806.get(path)===sig)return true;
  // Packet/NAL framing check only: stream-copy to null is dramatically cheaper than
  // decoding 1080p while LIVE, but still catches the exact MOV/NULL Invalid NAL / Packet corrupt
  // failure seen by the normal visual feeder.
  await runCapture('nice',['-n','19','ffmpeg','-nostdin','-hide_banner','-nostats','-loglevel','error','-xerror','-err_detect','explode','-i',path,'-map','0:v:0','-an','-sn','-dn','-c:v','copy','-bsf:v','h264_mp4toannexb','-f','h264','-y','/dev/null'],{timeoutMs:90000});
  visualIntegrityCacheR806.set(path,sig);
  return true;
}
async function remuxVisualCopyR806(source,tmp,limitSeconds=0){
  const args=['-n','19','ffmpeg','-nostdin','-hide_banner','-nostats','-loglevel','error','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-i',source];
  if(Number(limitSeconds)>0)args.push('-t',Number(limitSeconds).toFixed(3));
  args.push('-map','0:v:0','-an','-sn','-dn','-c:v','copy','-movflags','+faststart','-f','mp4','-y',tmp);
  await runCapture('nice',args,{timeoutMs:120000});
}
async function sanitizeVisualR806(source,period='visual'){
  const src=statSync(source);
  const clean=visualCleanPathR806(source);
  const meta=visualCleanMetaPathR806(source);
  try{
    if(existsSync(clean)&&statSync(clean).size>2*1024*1024){
      const cst=statSync(clean);
      let matchesSource=cst.mtimeMs>=src.mtimeMs;
      if(existsSync(meta)){
        const m=JSON.parse(readFileSync(meta,'utf8'));
        matchesSource=Number(m.sourceSize)===Number(src.size)&&Math.abs(Number(m.sourceMtimeMs)-Number(src.mtimeMs))<2;
      }
      if(matchesSource){
        // Clean files are created beside the live source, strict-validated before atomic rename.
        // Trust that immutable result on startup so radio boot never scans a 200+ MB MP4 before publishing.
        return clean;
      }
    }
  }catch(_){ }

  // If the source itself is already clean, keep it byte-for-byte and avoid extra disk.
  try{
    await strictVisualPacketCheckR806(source);
    return source;
  }catch(error){
    diagRecordR802('visual-r806-integrity-fail',{period,media:diagMediaR802(source),bytes:src.size,error:cleanText(error?.message||error)});
  }

  // First try a full REMUX only (c:v copy): no re-encode and therefore zero generational
  // quality loss. Some malformed AVCC NAL-length packets are not marked discardable by
  // the MOV demuxer; if one survives, keep the longest clean PREFIX instead of re-encoding.
  // The visual is a loop, so a 90/80/...% clean prefix is visually equivalent and permanently
  // removes the corrupt tail/region from every future loop.
  const tmp=`${clean}.part-${process.pid}-${Date.now()}.mp4`;
  let repairMode='full-stream-copy';
  let keptSeconds=0;
  let lastError=null;
  try{
    try{
      await remuxVisualCopyR806(source,tmp,0);
      if(!existsSync(tmp)||statSync(tmp).size<2*1024*1024)throw new Error('full sanitized visual too small');
      await strictVisualPacketCheckR806(tmp);
    }catch(error){
      lastError=error;
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
      const duration=await probeDuration(source).catch(()=>0);
      let ok=false;
      for(const ratio of [0.90,0.80,0.70,0.60,0.50,0.40]){
        if(!(duration>20))break;
        const keep=Math.max(15,duration*ratio);
        try{
          await remuxVisualCopyR806(source,tmp,keep);
          if(!existsSync(tmp)||statSync(tmp).size<2*1024*1024)throw new Error(`trim ${keep.toFixed(1)}s too small`);
          await strictVisualPacketCheckR806(tmp);
          repairMode=`clean-prefix-${Math.round(ratio*100)}pct`;
          keptSeconds=keep;
          ok=true;
          break;
        }catch(e){
          lastError=e;
          try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
        }
      }
      if(!ok)throw lastError||new Error('no clean stream-copy prefix found');
    }

    renameSync(tmp,clean);
    writeFileSync(meta,JSON.stringify({version:R806_VISUAL_SANITIZER_VERSION,source,sourceSize:src.size,sourceMtimeMs:src.mtimeMs,repairMode,keptSeconds,cleanedAt:new Date().toISOString()},null,2),'utf8');
    const cst=statSync(clean); visualIntegrityCacheR806.set(clean,`${cst.size}:${Math.trunc(cst.mtimeMs)}`);
    diagRecordR802('visual-r806-sanitized',{period,source:diagMediaR802(source),clean:diagMediaR802(clean),sourceBytes:src.size,cleanBytes:cst.size,repairMode,keptSeconds:Number(keptSeconds.toFixed(3))});
    return clean;
  }catch(error){
    try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
    diagRecordR802('visual-r806-sanitize-fail',{period,media:diagMediaR802(source),error:cleanText(error?.message||error)});
    throw new Error(`R806 ${period} visual sanitize failed: ${cleanText(error?.message||error)}`);
  }
}

function radioBackgroundSlotForItemR1211(item){
  if(!item||String(item.type||'track')!=='track')return '';
  const key=String(item.key||'').toLowerCase();
  const album=cleanText(item.album||'').toLowerCase();
  const title=cleanTitleCoreR989(item.title||'','').toLowerCase();
  if(/^monument to the great void$/iu.test(title.trim()))return 'silent';
  if(/^albums\/silent\//i.test(key)||/^(?:silent|silent\s*\(\s*тишина\s*\)|тишина)$/iu.test(album))return 'silent';
  if(/^albums\/beyond\//i.test(key)||/^beyond$/iu.test(album))return 'beyond';
  if(/^albums\/trika\//i.test(key)||/^трика$/iu.test(album)||/^trika$/iu.test(album))return 'trika';
  if(/^albums\/ocean\//i.test(key)||/^ocean$/iu.test(album))return 'ocean';
  if(/^albums\/illusion-of-life\//i.test(key)||/^illusion of life$/iu.test(album))return 'illusion';
  if(/^albums\/extended\//i.test(key)||/^(?:extended(?:\s+version)?|ex\.?\s*version)$/iu.test(album))return 'extras';
  if(/^(?:covers?|cover-tracks?|singles)\//i.test(key))return 'extras';
  if(['single','cover'].includes(String(item.sourceType||'').toLowerCase()))return 'extras';
  return 'extras';
}
function radioBackgroundLocalPathR1211(slot){return `${VISUAL_CACHE_DIR}/album-background-r1211-${slot}.jpg`}
function radioBackgroundMetaPathR1211(slot){return `${VISUAL_CACHE_DIR}/album-background-r1211-${slot}.meta.json`}
function isStaticBackgroundR1211(path){return /album-background-r1211-[a-z-]+\.jpg$/i.test(String(path||''))}
function isFiveAlbumBackgroundR1213(path){
  // R1213: only the five official album slots get a full-width ticker.
  // Extras (Singles/Covers/Extended) deliberately keeps the proven 1160px strip.
  return /(?:album-background-r1211-(?:illusion|ocean|trika|beyond|silent)\.jpg|album-background-video-r1227-(?:illusion|ocean|trika|beyond|silent)\.mp4)$/i.test(String(path||''));
}
function isPreparedAlbumBedR1277(path){
  return /album-background-video-r1227-(?:illusion|ocean|trika|beyond|silent)\.mp4$/i.test(String(path||''));
}

const RADIO_BACKGROUND_NORMALIZE_VERSION_R1214=1;
const STATIC_BACKGROUND_INPUT_FPS_R1214=25; // R1255: static source timeline is paced at the real 25fps master cadence

function normalizeRadioBackgroundFileR1214(path,slot){
  return new Promise((resolve,reject)=>{
    const tmp=`${path}.normalize-r1214-${process.pid}-${Date.now()}.jpg`;
    execFile('ffmpeg',[
      '-y','-hide_banner','-loglevel','error',
      '-i',path,
      '-vf','scale=1920:1080:flags=lanczos,setsar=1,format=yuv420p',
      '-frames:v','1','-c:v','mjpeg','-q:v','3',
      tmp
    ],{encoding:'utf8',timeout:30000,killSignal:'SIGKILL',maxBuffer:512*1024},(error,_stdout,stderr)=>{
      if(error){
        try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){}
        reject(new Error(`R1214 ${slot} normalize failed: ${cleanText(stderr||error?.message||error)}`));
        return;
      }
      try{
        if(!existsSync(tmp)||statSync(tmp).size<4096)throw new Error('normalized image too small');
        renameSync(tmp,path);
        visualProbeCacheR1132.delete(path);
        resolve(path);
      }catch(e){
        try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){}
        reject(e);
      }
    });
  });
}


function albumBaseVideoPathR1227(slot){return `${ALBUM_BASE_VIDEO_PREFIX_R1227}${slot}.mp4`}
function albumBaseVideoMetaPathR1227(slot){return `${ALBUM_BASE_VIDEO_PREFIX_R1227}${slot}.meta.json`}

function albumBedSignatureR1279(imagePath,slot,tickerPath){
  const st=statSync(imagePath);
  const tickerSt=statSync(tickerPath);
  return JSON.stringify({
    version:ALBUM_BASE_VIDEO_VERSION_R1227,
    hotReload:'R1279',
    slot,
    imageSize:Number(st.size||0),
    imageMtime:Number(st.mtimeMs||0),
    tickerSize:Number(tickerSt.size||0),
    tickerMtime:Number(tickerSt.mtimeMs||0),
    fps:VIDEO_FPS,
    duration:ALBUM_BED_SECONDS_R1277,
    gop:ALBUM_BED_GOP_R1277,
    pixFmt:'yuv420p',
    profile:'avc-yuv420p',
    closedGop:true,
    tickerBaked:true
  });
}

async function buildAlbumBaseVideoR1279(imagePath,slot,out,metaPath,signature,tickerPath,{live=false}={}){
  if(live){
    const safe=await waitAlbumBedSafeWindowR1280();
    if(!safe)throw new Error('R1280 stopping before live album build');
  }
  const tmp=`${out}.part-${process.pid}-${Date.now()}.mp4`;
  state.albumBedBuildingR1277=slot;
  state.albumBedBuildingR1279={slot,live,at:new Date().toISOString()};
  const started=Date.now();
  try{
    await new Promise((resolve,reject)=>{
      const graph=`[0:v]scale=1920:1080:in_range=pc:out_range=tv:flags=lanczos,setsar=1,fps=${VIDEO_FPS},format=yuv420p[base];`+
        `[1:v]format=argb,setpts=PTS-STARTPTS[ticker];`+
        `[base][ticker]overlay=x=170:y=996:shortest=1:eof_action=pass:eval=init:format=yuv420,format=yuv420p[outv]`;
      const readrate=live?['-readrate',String(ALBUM_BED_LIVE_REBUILD_READRATE_R1279)]:[];
      const args=[
        '-n',live?'19':'15','ffmpeg','-hide_banner','-loglevel','error','-y',
        '-filter_complex_threads','1',
        ...readrate,'-loop','1','-framerate',String(VIDEO_FPS),'-i',imagePath,
        ...readrate,'-stream_loop','-1','-i',tickerPath,
        '-filter_complex',graph,
        '-map','[outv]','-t',ALBUM_BED_SECONDS_R1277.toFixed(3),'-an','-sn','-dn',
        '-c:v','libx264','-preset','ultrafast','-profile:v','high','-level:v','4.1','-qp','8',
        '-x264-params',`open-gop=0:sliced-threads=0:scenecut=0:keyint=${ALBUM_BED_GOP_R1277}:min-keyint=${ALBUM_BED_GOP_R1277}:repeat-headers=1:aud=1`,
        '-g',String(ALBUM_BED_GOP_R1277),'-keyint_min',String(ALBUM_BED_GOP_R1277),'-sc_threshold','0','-bf','0','-refs','1',
        '-r',String(VIDEO_FPS),'-fps_mode','cfr','-pix_fmt','yuv420p',
        '-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',
        '-threads','1','-movflags','+faststart',tmp
      ];
      const child=spawn('nice',args,{stdio:['ignore','ignore','pipe']});
      if(live){
        albumBedBuilderChildR1280=child;
        albumBedBuilderPausedR1280=false;
        albumBedBuilderPauseReasonR1280='';
        state.albumBedBuilderShieldR1280={
          paused:false,
          reason:'live-cover-build',
          pid:Number(child.pid||0),
          at:new Date().toISOString()
        };
      }
      let err='';
      child.stderr.on('data',d=>{if(err.length<5000)err+=String(d)});
      child.once('error',reject);
      child.once('exit',code=>{
        if(albumBedBuilderChildR1280===child){
          albumBedBuilderChildR1280=null;
          albumBedBuilderPausedR1280=false;
          albumBedBuilderPauseReasonR1280='';
        }
        code===0?resolve():reject(new Error(`R1279 album bed build exit ${code}: ${err.slice(-1200)}`));
      });
    });
    if(!existsSync(tmp)||statSync(tmp).size<32000){
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
      throw new Error(`R1279 album bed too small: ${slot}`);
    }

    // Atomic swap: current feeder keeps its already-open old inode; next MP3 boundary
    // opens this same path again and gets the new complete cover. No half-written live file.
    renameSync(tmp,out);
    writeFileSync(metaPath,signature,'utf8');
    visualProbeCacheR1132.delete(out);
    await primeVisualProfileR1160K(out);
    state.albumBedLastBuiltR1277={slot,at:new Date().toISOString(),ms:Date.now()-started,bytes:statSync(out).size};
    state.albumBedLastBuiltR1279={slot,live,at:new Date().toISOString(),ms:Date.now()-started,bytes:statSync(out).size};
    state.albumBedHotReloadReadyR1279={
      slot,
      at:new Date().toISOString(),
      apply:'NEXT-MP3-BOUNDARY',
      liveBuild:Boolean(live)
    };
    return out;
  }finally{
    state.albumBedBuildingR1277='';
    state.albumBedBuildingR1279=null;
    if(albumBedBuilderChildR1280 && albumBedBuilderChildR1280.exitCode!==null){
      albumBedBuilderChildR1280=null;
      albumBedBuilderPausedR1280=false;
      albumBedBuilderPauseReasonR1280='';
    }
    try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }
  }
}

function scheduleAlbumBedRebuildR1279(imagePath,slot,out,metaPath,signature,tickerPath){
  if(albumBedRebuildPendingR1279.get(slot)===signature)return;
  albumBedRebuildPendingR1279.set(slot,signature);
  state.albumBedDeferredRebuildR1277={slot,at:new Date().toISOString(),reason:'R1279-live-safe-background-rebuild'};
  state.albumBedHotReloadPendingR1279={
    slot,
    at:new Date().toISOString(),
    readrate:ALBUM_BED_LIVE_REBUILD_READRATE_R1279,
    nice:19,
    threads:1
  };

  albumBedRebuildChainR1279=albumBedRebuildChainR1279.then(async()=>{
    // If the user uploaded this slot again while it was waiting, an older queued job
    // must not overwrite the newer requested cover.
    if(albumBedRebuildPendingR1279.get(slot)!==signature)return;
    try{
      await buildAlbumBaseVideoR1279(imagePath,slot,out,metaPath,signature,tickerPath,{live:true});
      diagRecordR802('r1279-album-cover-hot-reload-ready',{
        slot,
        readrate:ALBUM_BED_LIVE_REBUILD_READRATE_R1279,
        bytes:existsSync(out)?statSync(out).size:0
      });
    }catch(error){
      state.lastWarning=`R1279 cover rebuild ${slot}: ${cleanText(error?.message||error)}`;
      diagRecordR802('r1279-album-cover-hot-reload-failed',{slot,error:cleanText(error?.message||error)});
    }finally{
      if(albumBedRebuildPendingR1279.get(slot)===signature)albumBedRebuildPendingR1279.delete(slot);
    }
  }).catch(error=>{
    state.lastWarning=`R1279 cover rebuild queue: ${cleanText(error?.message||error)}`;
  });
}

async function ensureAlbumBaseVideoR1227(imagePath,slot){
  if(!['illusion','ocean','trika','beyond','silent'].includes(String(slot||'')))return imagePath;
  const out=albumBaseVideoPathR1227(slot),metaPath=albumBaseVideoMetaPathR1227(slot);
  const livePublisher=Boolean(publisher&&publisher.exitCode===null&&state.publisherRunning);

  // Before LIVE we may generate the ticker sprite if needed. During LIVE never generate
  // it here; use the already-prepared ticker so cover replacement cannot trigger a heavy
  // extra QTRLE job beside the stream.
  const tickerPath=livePublisher
    ? (existsSync(TICKER_SPRITE_R1261)&&statSync(TICKER_SPRITE_R1261).size>100000?TICKER_SPRITE_R1261:'')
    : ensureTickerSpriteR1261();

  if(!tickerPath || !existsSync(tickerPath) || statSync(tickerPath).size<100000){
    state.lastWarning=`R1279 ${slot} ticker bed unavailable; keeping previous prepared cover`;
    try{
      if(existsSync(out)&&statSync(out).size>32000)return out;
    }catch(_){ }
    return imagePath;
  }

  const signature=albumBedSignatureR1279(imagePath,slot,tickerPath);
  let cacheMatches=false;
  try{
    cacheMatches=Boolean(
      existsSync(out) &&
      statSync(out).size>32000 &&
      readFileSync(metaPath,'utf8')===signature
    );
  }catch(_){ }

  if(cacheMatches){
    await primeVisualProfileR1160K(out);
    return out;
  }

  if(livePublisher){
    // R1277 used to return the old cache forever here. R1279 instead rebuilds safely
    // in the background while the old complete bed continues feeding LIVE.
    scheduleAlbumBedRebuildR1279(imagePath,slot,out,metaPath,signature,tickerPath);
    try{
      if(existsSync(out)&&statSync(out).size>32000){
        await primeVisualProfileR1160K(out);
        return out;
      }
    }catch(_){ }
    return imagePath;
  }

  return await buildAlbumBaseVideoR1279(imagePath,slot,out,metaPath,signature,tickerPath,{live:false});
}

async function ensureRadioBackgroundReadyR1214(path,metaPath,slot,meta={},etag='',forceNormalize=false){
  const needsNormalize=forceNormalize || Number(meta?.normalizedVersionR1214||0)!==RADIO_BACKGROUND_NORMALIZE_VERSION_R1214 || Number(meta?.width||0)!==1920 || Number(meta?.height||0)!==1080;
  if(needsNormalize)await normalizeRadioBackgroundFileR1214(path,slot);
  await primeVisualProfileR1160K(path);
  const nextMeta={
    ...meta,slot,etag:String(etag||meta?.etag||''),
    normalizedVersionR1214:RADIO_BACKGROUND_NORMALIZE_VERSION_R1214,
    width:1920,height:1080,
    normalizedAt:needsNormalize?new Date().toISOString():(meta?.normalizedAt||new Date().toISOString())
  };
  writeFileSync(metaPath,JSON.stringify(nextMeta,null,2),'utf8');
  state.albumBackgroundSlotR1211=slot;
  state.albumBackgroundPathR1211=path;
  // R1240: restore pure static album art for all album slots.
  // R1239 proved the ticker can stay clean; the remaining visible blockiness came from
  // spending bitrate on whole-frame motion. Keep the prepared static JPEG and let only
  // the overlays/ticker move.
  state.albumBackgroundModeR1211='STATIC-IMAGE-R1240-1920X1080';
  return path;
}

async function refreshRadioBackgroundR1211(slot,{force=false}={}){
  if(!RADIO_BACKGROUND_SLOTS_R1211.includes(slot))throw new Error(`R1211 invalid background slot: ${slot}`);
  prepareCacheDir();
  const path=radioBackgroundLocalPathR1211(slot),metaPath=radioBackgroundMetaPathR1211(slot);
  let oldMeta={};try{oldMeta=JSON.parse(readFileSync(metaPath,'utf8'))||{}}catch(_){}
  const now=Date.now(),last=Number(radioBackgroundCheckR1211.get(slot)||0);
  if(!force && now-last<RADIO_BACKGROUND_REFRESH_MS_R1211 && existsSync(path) && statSync(path).size>4096){
    return await ensureRadioBackgroundReadyR1214(path,metaPath,slot,oldMeta,oldMeta.etag,false);
  }
  radioBackgroundCheckR1211.set(slot,now);
  const url=`${RADIO_BACKGROUND_BASE_URL_R1211}${RADIO_BACKGROUND_BASE_URL_R1211.includes('?')?'&':'?'}slot=${encodeURIComponent(slot)}&_r1279=${now}`;
  try{
    const head=await fetch(url,{method:'HEAD',headers:{'user-agent':'ANDRIK-Radio-R1279-Background','cache-control':'no-cache, no-store','pragma':'no-cache'},signal:AbortSignal.timeout(12000)});
    if(head.status===404){
      if(existsSync(path)&&statSync(path).size>4096)return await ensureRadioBackgroundReadyR1214(path,metaPath,slot,oldMeta,oldMeta.etag,false);
      throw new Error(`R1211 ${slot} background not uploaded`);
    }
    if(!head.ok)throw new Error(`R1211 ${slot} background HEAD HTTP ${head.status}`);
    const etag=String(head.headers.get('etag')||'');
    if(etag && oldMeta.etag===etag && existsSync(path)&&statSync(path).size>4096){
      return await ensureRadioBackgroundReadyR1214(path,metaPath,slot,oldMeta,etag,false);
    }
    const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R1279-Background','cache-control':'no-cache, no-store','pragma':'no-cache'},signal:AbortSignal.timeout(30000)});
    if(!response.ok||!response.body)throw new Error(`R1211 ${slot} background GET HTTP ${response.status}`);
    const tmp=`${path}.part-${process.pid}-${Date.now()}`;
    await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
    if(!existsSync(tmp)||statSync(tmp).size<4096){try{unlinkSync(tmp)}catch(_){};throw new Error(`R1211 ${slot} background too small`)}
    renameSync(tmp,path);
    oldMeta={slot,etag:etag||String(response.headers.get('etag')||''),updatedAt:new Date().toISOString()};
    return await ensureRadioBackgroundReadyR1214(path,metaPath,slot,oldMeta,oldMeta.etag,true);
  }catch(error){
    if(existsSync(path)&&statSync(path).size>4096){
      try{
        const ready=await ensureRadioBackgroundReadyR1214(path,metaPath,slot,oldMeta,oldMeta.etag,false);
        state.lastWarning=`R1214 stale ${slot} background fallback: ${cleanText(error?.message||error)}`;
        return ready;
      }catch(normalizeError){
        state.lastWarning=`R1214 stale ${slot} background normalize fallback failed: ${cleanText(normalizeError?.message||normalizeError)}`;
      }
    }
    throw error;
  }
}
async function ensureTrackVisualR1211(item){
  const slot=radioBackgroundSlotForItemR1211(item)||'extras';
  if(slot){
    try{
      const imagePath=await refreshRadioBackgroundR1211(slot);
      if(['illusion','ocean','trika','beyond','silent'].includes(String(slot))){
        const videoPath=await ensureAlbumBaseVideoR1227(imagePath,slot);
        state.albumBackgroundSlotR1211=slot;
        state.albumBackgroundPathR1211=videoPath;
        state.albumBackgroundModeR1211=isPreparedAlbumBedR1277(videoPath)?'R1277-PREPARED-ALBUM-BED-16S':'R1277-IMAGE-FALLBACK';
        return videoPath;
      }
      return imagePath;
    }catch(error){
      state.lastWarning=`R1274 ${slot} background fallback to master: ${cleanText(error?.message||error)}`;
    }
  }
  state.albumBackgroundSlotR1211=slot||'';
  state.albumBackgroundModeR1211='MASTER-FALLBACK';
  return await ensureScheduledVisual();
}
function prefetchAlbumBackgroundsR1211(){
  let chain=Promise.resolve();
  for(const slot of RADIO_BACKGROUND_SLOTS_R1211){
    chain=chain.then(async()=>{
      const imagePath=await refreshRadioBackgroundR1211(slot);
      if(['illusion','ocean','trika','beyond','silent'].includes(String(slot))){
        await ensureAlbumBaseVideoR1227(imagePath,slot);
      }
    }).catch(()=>{});
  }
  return chain;
}

async function pollAlbumBackgroundChangesR1279(){
  if(albumBackgroundWatcherBusyR1279||stopping)return;
  if(clipActive || stationHandoffActiveR804){
    state.albumBackgroundWatcherSkippedR1280={
      at:new Date().toISOString(),
      reason:stationHandoffActiveR804?'station-handoff':'video-insert'
    };
    return;
  }
  albumBackgroundWatcherBusyR1279=true;
  try{
    await prefetchAlbumBackgroundsR1211();
    state.albumBackgroundWatcherLastAtR1279=new Date().toISOString();
  }catch(error){
    state.lastWarning=`R1279 background watcher: ${cleanText(error?.message||error)}`;
  }finally{
    albumBackgroundWatcherBusyR1279=false;
  }
}

async function prewarmExistingAlbumVideosR1274(){
  for(const slot of ['illusion','ocean','trika','beyond','silent']){
    try{
      const imagePath=radioBackgroundLocalPathR1211(slot);
      if(existsSync(imagePath)&&statSync(imagePath).size>4096){
        await ensureAlbumBaseVideoR1227(imagePath,slot);
      }
    }catch(error){
      state.lastWarning=`R1274 prewarm ${slot}: ${cleanText(error?.message||error)}`;
    }
  }
}

function visualSpecForPeriod(period){
  if(period==='morning')return {period,path:MORNING_VISUAL,url:MORNING_VISUAL_URL};
  if(period==='day')return {period,path:DAY_VISUAL,url:DAY_VISUAL_URL};
  if(period==='evening')return {period,path:EVENING_VISUAL,url:EVENING_VISUAL_URL};
  return {period:'night',path:NIGHT_VISUAL,url:NIGHT_VISUAL_URL};
}

async function ensureVisualSpec(spec){
  try{
    if(existsSync(spec.path) && statSync(spec.path).size>2*1024*1024)return await sanitizeVisualR806(spec.path,spec.period);
  }catch(error){
    state.lastWarning=`R806 ${spec.period} visual source rejected: ${cleanText(error?.message||error)}`;
  }
  if(/^https:\/\//i.test(spec.url||'')){
    const downloaded=await downloadVisualToCache(spec.url,spec.path,spec.period);
    return await sanitizeVisualR806(downloaded,spec.period);
  }
  if(existsSync(spec.url||'') && statSync(spec.url).size>500000)return await sanitizeVisualR806(spec.url,spec.period);
  throw new Error(`R806 ${spec.period} visual unavailable/unsafe: ${spec.url||spec.path}`);
}

function prefetchAllVisuals(){
  // R806: prefetch only ensures the four source files exist. Integrity/sanitizing is performed
  // by the installer ahead of the single radio restart, or lazily only when a slot becomes active.
  // Never launch four full-file integrity scans in parallel on the 2-vCPU LIVE VPS.
  for(const period of ['morning','day','evening','night']){
    const spec=visualSpecForPeriod(period);
    try{if(existsSync(spec.path)&&statSync(spec.path).size>2*1024*1024)continue}catch(_){ }
    if(/^https:\/\//i.test(spec.url||''))downloadVisualToCache(spec.url,spec.path,spec.period).catch(error=>console.error('[visual-prefetch]',cleanText(error?.message||error)));
  }
}

async function ensureScheduledVisual(){
  prepareCacheDir();
  const scheduled=visualPeriodForHour(localHourInTimeZone());
  const period=runtimeForceVisualSlot || scheduled;
  const spec=visualSpecForPeriod(period);
  try{
    const path=await ensureVisualSpec(spec);
    await primeVisualProfileR1160K(path);
    state.visualPeriod=runtimeVisualAutoSchedule?`auto-${period}`:(runtimeForceVisualSlot?`manual-${period}`:period);
    state.visualPath=path;
    state.visualInsetCrop='';
    return path;
  }catch(error){
    if(period==='morning'){
      try{
        const fallback=await ensureVisualSpec(visualSpecForPeriod('day'));
        await primeVisualProfileR1160K(fallback);
        state.lastError=`R721 morning not assigned yet — temporary DAY fallback: ${cleanText(error?.message||error)}`;
        state.visualPeriod=runtimeVisualAutoSchedule?'auto-morning-fallback-day':'morning-fallback-day';
        state.visualPath=fallback;
        state.visualInsetCrop='';
        return fallback;
      }catch(_){ }
    }
    if(existsSync(EMERGENCY_VISUAL) && statSync(EMERGENCY_VISUAL).size>300000){
      state.lastError=`R721 ${period} local visual fallback: ${cleanText(error?.message||error)}`;
      state.visualPeriod=`${period}-emergency`;
      state.visualPath=EMERGENCY_VISUAL;
      state.visualInsetCrop='';
      await primeVisualProfileR1160K(EMERGENCY_VISUAL);
      return EMERGENCY_VISUAL;
    }
    throw error;
  }
}

function activeVisualPeriodR721(){
  return runtimeForceVisualSlot || visualPeriodForHour(localHourInTimeZone());
}

function equalizerSpecR721(){
  const period=activeVisualPeriodR721();
  const specs={
    morning:{name:'morning-soft-gold-compact-r796',path:EQUALIZER_FILES_R721.morning},
    day:{name:'day-steel-compact-r796',path:EQUALIZER_FILES_R721.day},
    evening:{name:'evening-amber-compact-r796',path:EQUALIZER_FILES_R721.evening},
    night:{name:'night-blue-compact-r796',path:EQUALIZER_FILES_R721.night}
  };
  const spec=specs[period]||specs.day;
  state.equalizerPeriod=period;
  state.equalizerStyle=spec.name;
  return {period,...spec};
}


function currentDisplayTitleR987(item,fallback='TRACK'){
  if(!item)return fallback;
  const title=shortText(item.title||fallback,48);
  const album=shortText(item.album||'',24);
  return /^(?:Синглы|Singles)(?:\s+ANDRIK)?$/iu.test(album)
    ? `${title} (Singles)`
    : album
      ? `${title} (Альбом «${album}»)`
      : `${title} (Singles)`;
}


function cleanTitleCoreR989(value,fallback='TRACK'){
  let t=cleanText(value||fallback);

  // Remove ANDRIK if it is already stored inside metadata.
  t=t.replace(/^\s*(?:КЛИП\s*•\s*)?ANDRIK\s*[—–-]\s*/i,'');
  t=t.replace(/^\s*ANDRIK\s+/i,'');

  return t.trim() || fallback;
}


// R1160 RADIO TITLE LABELS — DISPLAY ONLY.
// Does not touch queue order, audio, R1085, FFmpeg timing, transitions or media ownership.
// New album tracks: "Title (Silent)"
// Covers: "Title (кавер)"
function radioDisplayTitleR1160(item,fallback='TRACK',maxTitle=48){
  if(!item)return fallback;

  const rawTitle=cleanTitleCoreR989(item.title,fallback);
  const album=cleanText(item.album||'').trim();
  const key=String(item.key||'');
  const sourceType=String(item.sourceType||'').toLowerCase();

  const isCover=isCoverTrackR1160B({...item,title:rawTitle});

  // R1160O: album ownership wins over a stale legacy singles/ location.
  // Monument to the Great Void is track 5 of Silent. During R2 migration an old
  // singles/ object may still be returned, so sourceType/key must not override
  // the canonical album identity. pickerAlbum/albumSlug are accepted when present.
  const silentOwnerHintR1160O=cleanText(item.pickerAlbum||item.albumSlug||'').trim();
  const isSilent=
    /^silent$/iu.test(silentOwnerHintR1160O) ||
    /^(?:silent|silent\s*\(\s*тишина\s*\)|тишина)$/iu.test(album) ||
    /^albums\/silent\//i.test(key) ||
    /^monument to the great void$/iu.test(rawTitle.trim());

  const isSingle=!isSilent && (
    sourceType==='single' ||
    /^singles\//i.test(key) ||
    /^(?:сингл|синглы|single|singles)(?:\s+andrik)?$/iu.test(album)
  );

  // CURRENT should show one clean owner label, not the old title annotation.
  let title=rawTitle
    .replace(/\s*[\[(]\s*(?:ai\s*)?cover\b[^\])]*[\])]\s*$/iu,'')
    .replace(/\s*[\[(]\s*кавер\b[^\])]*[\])]\s*$/iu,'')
    .trim();

  title=shortText(title||fallback,maxTitle);

  if(isCover)return `${title} (Cover)`;
  if(isSingle)return `${title} (Single)`;

  // R1160I: Extended tracks already carry "(Ex. Version)" in the title.
  // Do NOT append a second owner suffix such as («Extended Version»).
  const isExtendedOwnerR1160I=
    /^(?:extended(?:\s+version)?|ex\.?\s*version|расширенн(?:ая|ые)\s+верси(?:я|и))$/iu.test(album) ||
    /^(?:extended|ex(?:tended)?)[\/_-]/i.test(key);

  if(isExtendedOwnerR1160I)return title;

  // R1160C: CURRENT album tracks show only the album name in guillemets.
  // No word "Альбом". Singles/Covers keep their plain owner labels.
  const albumShort=shortText(isSilent?'Silent':album,24);
  return albumShort
    ? `${title} («${albumShort}»)`
    : `${title} (Single)`;
}

function trackTitleOnlyR1211(item,fallback='TRACK'){
  let title=cleanTitleCoreR989(item?.title||fallback,fallback);
  // Strip only owner/album decorations. Keep semantic suffixes such as (Ex. Version).
  title=title
    .replace(/\s*\(\s*Альбом\s*[«“"]?[^)»”"]+[»”"]?\s*\)\s*$/iu,'')
    .replace(/\s*\([«“"]?\s*(?:Silent|Silent\s*\(\s*Тишина\s*\)|BEYOND|ТРИКА|TRIKA|OCEAN|Illusion of Life)\s*[»”"]?\)\s*$/iu,'')
    .replace(/\s*\(\s*(?:Single|Singles|Cover|Кавер)\s*\)\s*$/iu,'')
    .replace(/\s*\(«[^»]+»\)\s*$/u,'')
    .trim();
  return shortText(title||fallback,48);
}

function currentDisplayTitleR989(item,fallback='TRACK'){
  if(!item)return fallback;

  // Preserve the old suppression for internal/video album labels.
  let normalizedItem=item;
  const album=cleanText(item.album||'').trim();
  if(/^(ANDRIK RADIO|RADIO|OFFICIAL MUSIC VIDEO|OFFICIAL VIDEO|VIDEO)$/i.test(album)){
    normalizedItem={...item,album:''};
  }

  if(String(normalizedItem.type||'track')==='track')return trackTitleOnlyR1211(normalizedItem,fallback);
  return radioDisplayTitleR1160(normalizedItem,fallback,48);
}

function previewDisplayTitleR989(value){
  let t=cleanTitleCoreR989(value,'TRACK');

  // Previous/next = title only, but preserve semantic suffixes such as (Ex. Version).
  t=t
    .replace(/\s*\(\s*Альбом\s*[«“"]?[^)»”"]+[»”"]?\s*\)\s*$/iu,'')
    .replace(/\s*\([«“"]?\s*(?:Silent|Silent\s*\(\s*Тишина\s*\)|BEYOND|ТРИКА|TRIKA|OCEAN|Illusion of Life)\s*[»”"]?\)\s*$/iu,'')
    .replace(/\s*\(\s*(?:Single|Singles|Cover|Кавер)\s*\)\s*$/iu,'')
    .replace(/\s*\(«[^»]+»\)\s*$/u,'')
    .trim();

  return shortText(t||'TRACK',38);
}

function trackLabel(item,fallback='—'){
  if(!item)return fallback;
  return radioDisplayTitleR1160(item,fallback,48);
}

// R816/R787 NOCROP: source geometry is immutable FIT+PAD. Live feeders output full YUV420P frames; only the persistent master encodes H.264.
function titleOverlayFiltersR721({dynamicTitle=false,showPreview=false,previewDuration=0,previewReload=false,boundaryTitleSwitchAt=0,liveCpuFastR794=false,fastProfileR1132=null,omitTickerR1233=false}={}){
  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const curPath=ffFilterPath(LIVE_CURRENT_FILE);
  const boundaryPath=ffFilterPath(LIVE_BOUNDARY_TITLE_FILE_R790);
  const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
  const prevPath=ffFilterPath(LIVE_PREVIOUS_FILE_R726);
  const nextPath=ffFilterPath(LIVE_NEXT_FILE_R726);
  const titleReload=`:reload=25`; // R854/R850: every active rawvideo feeder follows shared CURRENT title
  const previewReloadPart=previewReload?`:reload=${VIDEO_FPS}`:'';
  const d=Math.max(0,Number(previewDuration)||0);
  const sw=Math.max(0,Number(boundaryTitleSwitchAt)||0);
  // R790: CURRENT -> NEXT title is selected by THIS feeder's FFmpeg PTS, not Date.now().
  // The exact same t clock also drives the black alpha mask below, so the title cannot
  // run seconds ahead of the fade even if the VPS, FIFO or YouTube transport is delayed.
  const currentTitleEnable=sw>0?`:enable='lt(t\\,${sw.toFixed(3)})'`:'';
  const boundaryTitleEnable=sw>0?`:enable='gte(t\\,${sw.toFixed(3)})'`:'';
  const outroStart=Math.max(0,d-NEXT_PREVIEW_SECONDS_R726);
  const outroEnd=Math.max(outroStart+0.25,d-NEXT_PREVIEW_HIDE_BEFORE_END_R726);
  const introStart=START_PREVIEW_DELAY_SECONDS_R748;
  const introEnd=introStart+START_PREVIEW_SHOW_SECONDS_R748;
  let previewExpr='0';
  if(showPreview&&d>NEXT_PREVIEW_SECONDS_R726+0.5){
    const hasSeparatedIntro=d>(introEnd+NEXT_PREVIEW_SECONDS_R726+0.75);
    previewExpr=hasSeparatedIntro
      ? `between(t\,${introStart.toFixed(3)}\,${introEnd.toFixed(3)})+between(t\,${outroStart.toFixed(3)}\,${outroEnd.toFixed(3)})`
      : `between(t\,${outroStart.toFixed(3)}\,${outroEnd.toFixed(3)})`;
  }
  const previewEnable=`:enable='${previewExpr}'`;
  const titlePair=(path,enable)=>[
    `drawtext=${titleFontPart}textfile='${path}'${titleReload}:fontcolor=white@0.01:fontsize=58:x=(w-text_w)/2:y=h-240:borderw=8:bordercolor=black@0.92${enable}`,
    `drawtext=${titleFontPart}textfile='${path}'${titleReload}:fontcolor=0xF8F4EE:fontsize=58:x=(w-text_w)/2:y=h-240:borderw=2:bordercolor=black@0.92:shadowcolor=black@0.85:shadowx=3:shadowy=3${enable}`
  ];
  const fastR1132=fastProfileR1132||{};
  const filters=[];
  filters.push(fastR1132.geometryExact
    ? 'setsar=1'
    : (liveCpuFastR794?LIVE_FULL_FRAME_FILTER_R794:FULL_FRAME_FILTER_R787));
  if(!fastR1132.fpsExact)filters.push(`fps=${VIDEO_FPS}`);
  if(!fastR1132.pix420)filters.push('format=yuv420p');
  filters.push(...titlePair(curPath,currentTitleEnable));
  if(sw>0)filters.push(...titlePair(boundaryPath,boundaryTitleEnable));
  filters.push(
    `drawtext=${fontPart}textfile='${prevPath}'${previewReloadPart}:fontcolor=white@1:fontsize=36:x=58:y=h-320:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${previewEnable}`,
    `drawtext=${fontPart}textfile='${nextPath}'${previewReloadPart}:fontcolor=white@1:fontsize=36:x=w-text_w-58:y=h-320:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${previewEnable}`
  );
  // R1233: the five album slots must never inherit the legacy yellow 105px/s ticker.
  // It is added exactly once later in normalVideoFilterComplexR721().
  if(!omitTickerR1233){
    filters.push(`drawtext=${fontPart}textfile='${tickerPath}':reload=${VIDEO_FPS*2}:fontcolor=yellow:fontsize=42:x='w-mod(t*105,text_w+w)':y=h-104:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`);
  }
  return filters.join(',');
}


function compactCtaChainR783(trackDuration,{subscribeInputIndex=2,likeInputIndex=3}={}){
  // R1275: use the exact same CTA cadence/assets on normal MP3 as on prepared clips.
  // The sources are static 420px PNGs decoded at 1fps; only the 8s CTA windows are overlaid.
  const d=Math.max(0,Number(trackDuration)||0);
  const windows=[];
  // R783: first CTA stays at 20s. Every 120s after that alternate SUBSCRIBE -> LIKE.
  // Only complete 8s windows are scheduled, preserving the no-blink behavior from R748.
  for(let st=CTA_FIRST_SHOW_SECONDS_R748, n=0; st+CTA_SHOW_SECONDS_R722<=d-6.0; st+=CTA_PERIOD_SECONDS_R722, n++){
    windows.push({st,kind:(n%2===0?'subscribe':'like')});
    if(windows.length>=8)break;
  }
  if(!windows.length)return {pre:'',chain:'',final:'qrbase',windows:[]};
  let pre='';
  const addSource=(inputIndex,kind,prefix)=>{
    const subset=windows.map((w,i)=>({...w,i})).filter(w=>w.kind===kind);
    if(!subset.length)return;
    const labels=subset.map(w=>`[cta${w.i}]`).join('');
    pre+=`[${inputIndex}:v]fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src];`;
    if(subset.length===1)pre+=`[${prefix}src]null${labels};`;
    else pre+=`[${prefix}src]split=${subset.length}${labels};`;
  };
  addSource(subscribeInputIndex,'subscribe','ctasub');
  addSource(likeInputIndex,'like','ctalike');
  let chain='';
  let base='qrbase';
  windows.forEach((w,i)=>{
    const st=w.st;
    const fadeOutAt=st+CTA_SHOW_SECONDS_R722-CTA_FADE_SECONDS_R748;
    chain+=`[cta${i}]fade=t=in:st=${st.toFixed(3)}:d=${CTA_FADE_SECONDS_R748.toFixed(2)}:alpha=1,fade=t=out:st=${fadeOutAt.toFixed(3)}:d=${CTA_FADE_SECONDS_R748.toFixed(2)}:alpha=1[ctaf${i}];`;
    const out=`ctaout${i}`;
    chain+=`[${base}][ctaf${i}]overlay=x=W-w-${CTA_RIGHT_GAP_R767}:y=H-h-${CTA_BOTTOM_GAP_R748}:shortest=0:eval=init:format=yuv420[${out}];`;
    base=out;
  });
  return {pre,chain,final:base,windows};
}

function ensureAlbumLikeOverlayR1262(){
  try{
    mkdirSync(CACHE_DIR,{recursive:true});
    if(!existsSync(ALBUM_LIKE_OVERLAY_R1262)||statSync(ALBUM_LIKE_OVERLAY_R1262).size<2048){
      writeFileSync(ALBUM_LIKE_OVERLAY_R1262,Buffer.from(ALBUM_LIKE_BASE64_R1262,'base64'));
    }
    return ALBUM_LIKE_OVERLAY_R1262;
  }catch(error){
    state.lastWarning=`R1262 LIKE overlay unavailable: ${cleanText(error?.message||error)}`;
    return '';
  }
}

// R796 CPU-HEADROOM: keep R795 viewer-proven fade timing, but generate black alpha
function prepareTickerPagesR1246(){
  try{
    mkdirSync(CACHE_DIR,{recursive:true});
    let ticker=DEFAULT_LIVE_TICKER;
    try{ticker=cleanText(readFileSync(LIVE_TICKER_FILE,'utf8'))||DEFAULT_LIVE_TICKER}catch(_){ }
    const chunks=String(ticker).split('•').map(v=>cleanText(v)).filter(Boolean);
    const pages=[];
    let current='';
    for(const chunk of chunks){
      const candidate=current?`${current}  •  ${chunk}`:chunk;
      if(current && candidate.length>58){pages.push(current); current=chunk;}
      else current=candidate;
    }
    if(current)pages.push(current);
    if(!pages.length)pages.push('ANDRIK METAL RADIO 24/7  •  ANDRIKMETAL.COM');
    // Keep at most four readable pages. If the source produced more, fold the tail
    // into page four rather than silently losing it.
    if(pages.length>4){
      pages[3]=pages.slice(3).join('  •  ');
      pages.length=4;
    }
    while(pages.length<4)pages.push(pages[pages.length%Math.max(1,pages.length)]||pages[0]);
    for(let i=0;i<4;i++)writeFileSync(TICKER_PAGE_FILES_R1246[i],pages[i]||pages[0],'utf8');
    return 4;
  }catch(error){
    try{
      const fallback=['ANDRIK METAL RADIO 24/7','ANDRIKMETAL.COM','НОВЫЕ СИНГЛЫ И АЛЬБОМЫ ANDRIK','ПОДПИСЫВАЙТЕСЬ  •  СТАВЬТЕ ЛАЙКИ  •  КОММЕНТИРУЙТЕ'];
      for(let i=0;i<4;i++)writeFileSync(TICKER_PAGE_FILES_R1246[i],fallback[i],'utf8');
      return 4;
    }catch(_){return 0;}
  }
}


function ensureTickerSpriteR1261(){
  try{
    prepareTickerPagesR1246();
    mkdirSync(CACHE_DIR,{recursive:true});
    const font=chooseFont();
    if(!font)return '';
    const pages=TICKER_PAGE_FILES_R1246.map(p=>{try{return readFileSync(p,'utf8')}catch(_){return ''}});
    const signature=JSON.stringify({
      version:'R1286-QTRLE-ALPHA-25FPS-16S-XFADE250MS-DARKPAD58',
      pages,font,size:40,w:TICKER_SPRITE_W_R1261,h:TICKER_SPRITE_PAGE_H_R1261,
      pageSeconds:TICKER_PAGE_SECONDS_R1246
    });
    try{
      if(existsSync(TICKER_SPRITE_R1261) && statSync(TICKER_SPRITE_R1261).size>100000 &&
         existsSync(TICKER_SPRITE_META_R1261) && readFileSync(TICKER_SPRITE_META_R1261,'utf8')===signature){
        return TICKER_SPRITE_R1261;
      }
    }catch(_){}

    const tmp=`${TICKER_SPRITE_R1261}.part-${process.pid}-${Date.now()}.mov`;
    const fontPath=ffFilterPath(font);
    const fadeR1268=0.25;
    const draws=TICKER_PAGE_FILES_R1246.map((file,i)=>{
      const a=i*TICKER_PAGE_SECONDS_R1246;
      const b=(i+1)*TICKER_PAGE_SECONDS_R1246;
      const a1=(a+fadeR1268).toFixed(3);
      const b1=(b-fadeR1268).toFixed(3);
      const alpha=`if(lt(t\\,${a.toFixed(3)})\\,0\\,if(lt(t\\,${a1})\\,(t-${a.toFixed(3)})/${fadeR1268}\\,if(lt(t\\,${b1})\\,1\\,if(lt(t\\,${b.toFixed(3)})\\,(${b.toFixed(3)}-t)/${fadeR1268}\\,0))))`;
      return `drawtext=fontfile='${fontPath}':textfile='${ffFilterPath(file)}':reload=0:fontcolor=white:fontsize=40:x=(w-text_w)/2:y=20:borderw=1:bordercolor=black@0.9:alpha='${alpha}'`;
    }).join(',');

    // Constant true-alpha dark pad; only the pre-rendered text opacity changes.
    // No live crop/page selector remains in the MP3 filter graph.
    const graph=`format=rgba,colorchannelmixer=aa=0,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.58:t=fill:replace=1,${draws}`;
    const duration=(TICKER_PAGE_SECONDS_R1246*4).toFixed(3);
    const r=spawnSync('ffmpeg',[
      '-y','-hide_banner','-loglevel','error',
      '-f','lavfi','-i',`color=c=black@0.0:s=${TICKER_SPRITE_W_R1261}x${TICKER_SPRITE_PAGE_H_R1261}:r=${VIDEO_FPS}:d=${duration}`,
      '-vf',graph,
      '-c:v','qtrle','-pix_fmt','argb',
      '-r',String(VIDEO_FPS),
      tmp
    ],{encoding:'utf8',timeout:12000,maxBuffer:1024*1024});

    if(r.status!==0 || !existsSync(tmp) || statSync(tmp).size<100000){
      try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){}
      state.lastWarning=`R1268 ticker video build failed: ${cleanText(r.stderr||`ffmpeg exit ${r.status}`)}`;
      return '';
    }
    renameSync(tmp,TICKER_SPRITE_R1261);
    writeFileSync(TICKER_SPRITE_META_R1261,signature,'utf8');
    return TICKER_SPRITE_R1261;
  }catch(error){
    state.lastWarning=`R1268 ticker video unavailable: ${cleanText(error?.message||error)}`;
    return '';
  }
}

// masks ONLY for the ~1.5-2.2 second transition window. This preserves the visible
// 0.65s darken + 0.05s black + 0.80s recovery while avoiding a 1080p alpha source
// and full-frame overlay for the entire MP3. Compact 1180px QTRLE EQ + larger ticker.
// R795 FADE-RESTORE: keep the R794 CPU headroom wins (fast live FIT scaler,
// pre-scaled QR/CTA, 2 encoder threads), but restore the viewer-proven R793
// alpha-mask fade engine exactly. The R794 drawbox-step experiment is removed
// because the visible transition could disappear in the live yuv420 pipeline.
// R981C-STATIC-BAKED: QR + BAR + RED LINE
function normalVideoFilterComplexR721({fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,previewReload=false,boundaryTitleSwitchAt=0,mp3Boundary=false,fastProfileR1132=null,fullWidthTickerR1213=false,tickerRasterInputIndexR1221=-1,tickerBakedFullFrameR1224=false,tickerUnderlayInputIndexR1236=-1,staticFrameLoopR1255=false,tickerSpriteInputIndexR1261=-1,albumLikeInputIndexR1262=-1,preparedAlbumBedR1277=false,ctaSubscribeInputIndexR1277=2,ctaLikeInputIndexR1277=3}={}){
  const vf=titleOverlayFiltersR721({dynamicTitle:false,showPreview:true,previewDuration:trackDuration,previewReload,boundaryTitleSwitchAt,liveCpuFastR794:true,fastProfileR1132,omitTickerR1233:MP3_TICKER_DISABLED_R1269?true:fullWidthTickerR1213});
  const cta=compactCtaChainR783(trackDuration,{subscribeInputIndex:ctaSubscribeInputIndexR1277,likeInputIndex:ctaLikeInputIndexR1277});
  let maskChain='';
  let finalChain='[ctabase]format=yuv420p[outv]';
  let startupMaskChain='';

  // R796: short-lived startup alpha mask only. After it reaches transparent, the
  // source ends and overlay=eof_action=pass removes it from the hot path.
  if(fadeIn){
    const fd=Math.max(0.05,Number(fadeInSeconds)||CLIP_TO_TRACK_FADE_IN_SECONDS_R753);
    const holdR917B=0.00; // R984B-STATION-HANDOFF: R975B FIRST PCM owns start timing

    const md=holdR917B+fd+0.08;
    startupMaskChain=`color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS}:d=${md.toFixed(3)},format=yuva420p,fade=t=out:st=${holdR917B.toFixed(3)}:d=${fd.toFixed(2)}:alpha=1,setpts=PTS-STARTPTS[startmask];`;
  }

  if(Number(trackDuration)>VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736+VIDEO_FADE_IN_SECONDS_R736+VIDEO_FADE_LEAD_SECONDS_R735+1){
    // R799 FADE-ONLY RESTORE: this is the exact viewer-proven R787/R793 absolute
    // alpha-mask clock. Do NOT shift a short-lived mask with setpts: that optimization
    // made the transition disappear on the live path. Keep the base picture untouched
    // and animate only BLACK mask alpha at absolute feeder PTS. R816 keeps R809/R814's
    // split visual: old RAW feeder fades TO BLACK; new RAW feeder starts FROM BLACK.
    const splitMp3BoundaryR809=Boolean(mp3Boundary && endFadeToBlack); // R978A
    const fadeLeadR809=splitMp3BoundaryR809?0.00:VIDEO_FADE_LEAD_SECONDS_R735;
    const fadeOutR814=splitMp3BoundaryR809?MP3_BOUNDARY_FADE_OUT_SECONDS_R814:VIDEO_FADE_SECONDS_R726;
    const blackHoldR814=splitMp3BoundaryR809?MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814:VIDEO_BLACK_HOLD_SECONDS_R736;
    const recoverInR814=splitMp3BoundaryR809?MP3_BOUNDARY_FADE_IN_SECONDS_R814:VIDEO_FADE_IN_SECONDS_R736;
    const outAt=Math.max(0,Number(trackDuration)-fadeOutR814-blackHoldR814-fadeLeadR809);
    const recoverAt=outAt+fadeOutR814+blackHoldR814;
    maskChain=endFadeToBlack
      ? `color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${fadeOutR814.toFixed(2)}:alpha=1[blackmask];`
      : `color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${fadeOutR814.toFixed(2)}:alpha=1,fade=t=out:st=${recoverAt.toFixed(3)}:d=${recoverInR814.toFixed(2)}:alpha=1[blackmask];`;
    finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]';
  }

  const ctaBaseLabel=cta.final;
  if(ctaBaseLabel!=='qrbase') finalChain=finalChain.replaceAll('[ctabase]',`[${ctaBaseLabel}]`);
  else finalChain=finalChain.replaceAll('[ctabase]','[qrbase]');
  if(fadeIn){
    finalChain=finalChain.replace('[outv]','[prefadeout]');
    finalChain+=`;[prefadeout][startmask]overlay=x=0:y=0:shortest=0:eof_action=pass:eval=init:format=yuv420[outv]`;
  }

  // R796: EQ is pre-scaled OFFLINE to 1180px wide (same 25fps/100-frame seamless loop).
  // No live EQ scaling. Static overlay coordinates use eval=init and redundant format
  // conversions between overlays are removed.
  // R981D-LIVE-LIGHT
  // R981E-TICKER-SINGLE-PASS
  let vfBaseR902=String(vf)
    .replace(/,drawtext=[^,]*fontcolor=white@0\.01[^,]*/, '');

  // R1286: MP3-only current-title underlay. clipFilterComplexR721() never passes here,
  // so music clips/station video remain byte-for-byte visually unchanged.
  const mp3TitlePadY_R1286=fullWidthTickerR1213?'18':'h-282';
  vfBaseR902=vfBaseR902.replace(
    /,drawtext=/,
    `,drawbox=x=340:y=${mp3TitlePadY_R1286}:w=1240:h=88:color=black@0.58:t=fill,drawtext=`
  );

  // R1255: a static JPEG must not arrive as 5fps packets that are expanded to 25fps
  // in bursts. Decode the image once, clone that one frame forever, assign exact 25fps
  // PTS, and throttle inside the filtergraph to realtime. This recreates the smooth
  // cadence of the old 25fps master-video feeder without repeatedly decoding JPEG.
  const sourceR1255=staticFrameLoopR1255
    ? `[0:v]loop=loop=-1:size=1:start=0,setpts=N/(${VIDEO_FPS}*TB),realtime`
    : `[0:v]setpts=PTS-STARTPTS`;

  // R1261: the four ticker phrases are rendered ONCE into a tiny transparent sprite.
  // The live MP3 filter no longer runs four drawtext engines every frame. It only crops
  // the current 1580x84 row and overlays it over the constant dark pad. This removes the
  // periodic drawtext/filter CPU spike that correlated with picture color shifts + audio stutter.
  if(fullWidthTickerR1213){
    vfBaseR902=vfBaseR902.replace(/:y=h-240(?=:)/g,':y=44');

    // R1277: the album bed already contains the full 16s ticker cycle. LIVE keeps
    // only track-dependent title/PREV/NEXT, compact CTA windows and short black masks.
    // This removes the always-running QTRLE alpha decoder/overlay from the MP3 hot path.
    if(preparedAlbumBedR1277){
      return `${sourceR1255},${vfBaseR902},format=yuv420p[base];`+
        `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
    }

    // R1269: user-observed fault isolation.
    // No ticker, no ticker pad, no page/video switching on MP3.
    // Keep only the album LIKE overlay every 120s.
    if(MP3_TICKER_DISABLED_R1269){
      const likeEnableR1269=`between(mod(t\,${ALBUM_LIKE_PERIOD_SECONDS_R1262})\,0\,${ALBUM_LIKE_SHOW_SECONDS_R1262})`;
      if(albumLikeInputIndexR1262>=0){
        return `${sourceR1255},${vfBaseR902},format=yuv420p[base1269];`+
          `[${albumLikeInputIndexR1262}:v]scale=${ALBUM_LIKE_WIDTH_R1262}:-1:flags=lanczos,format=rgba,negate=components=r+g+b,format=yuva420p,setpts=PTS-STARTPTS[like1269];`+
          `[base1269][like1269]overlay=x=W-w-34:y=H-h-110:shortest=0:eof_action=pass:eval=frame:format=yuv420:enable='${likeEnableR1269}'[base];`+
          `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
      }
      return `${sourceR1255},${vfBaseR902},format=yuv420p[base];`+
        `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
    }

    const tickerY_R1251=996;
    const tickerH_R1251=84;
    const tickerX_R1251=170;
    const tickerW_R1251=1580;
    const clearGapR1251=0.28; // fallback drawtext only; R1268 video path has NO live page switch
    const cycleR1251=TICKER_PAGE_SECONDS_R1246*4;
    const likeEnableR1262=`between(mod(t\,${ALBUM_LIKE_PERIOD_SECONDS_R1262})\,0\,${ALBUM_LIKE_SHOW_SECONDS_R1262})`;
    if(tickerSpriteInputIndexR1261>=0){
      if(albumLikeInputIndexR1262>=0){
        return `${sourceR1255},${vfBaseR902},format=yuv420p[base1268];`+
          `[${tickerSpriteInputIndexR1261}:v]format=argb,setpts=PTS-STARTPTS[tickervideo1268];`+
          `[base1268][tickervideo1268]overlay=x=${tickerX_R1251}:y=${tickerY_R1251}:shortest=0:eof_action=pass:eval=init:format=yuv420[tickerout1268];`+
          `[${albumLikeInputIndexR1262}:v]scale=${ALBUM_LIKE_WIDTH_R1262}:-1:flags=lanczos,format=rgba,negate=components=r+g+b,format=yuva420p,setpts=PTS-STARTPTS[like1262];`+
          `[tickerout1268][like1262]overlay=x=W-w-34:y=H-h-110:shortest=0:eof_action=pass:eval=frame:format=yuv420:enable='${likeEnableR1262}'[base];`+
          `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
      }
      return `${sourceR1255},${vfBaseR902},format=yuv420p[base1268];`+
        `[${tickerSpriteInputIndexR1261}:v]format=argb,setpts=PTS-STARTPTS[tickervideo1268];`+
        `[base1268][tickervideo1268]overlay=x=${tickerX_R1251}:y=${tickerY_R1251}:shortest=0:eof_action=pass:eval=init:format=yuv420[base];`+
        `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
    }
    // Safe fallback if sprite generation ever fails: preserve R1251 behavior rather than lose ticker.
    const tickerFontR1251=chooseFont();
    const tickerFontPartR1251=tickerFontR1251?`fontfile='${ffFilterPath(tickerFontR1251)}':`:'';
    const pageDrawsR1251=TICKER_PAGE_FILES_R1246.map((file,i)=>{
      const a=i*TICKER_PAGE_SECONDS_R1246;
      const b=(i+1)*TICKER_PAGE_SECONDS_R1246-clearGapR1251;
      return `drawtext=${tickerFontPartR1251}textfile='${ffFilterPath(file)}':reload=0:fontcolor=white:fontsize=40:x=(w-text_w)/2:y=${tickerY_R1251+20}:borderw=1:bordercolor=black@0.9:enable='between(mod(t\\,${cycleR1251})\\,${a}\\,${b})'`;
    }).join(',');
    if(albumLikeInputIndexR1262>=0){
      return `${sourceR1255},${vfBaseR902},drawbox=x=${tickerX_R1251}:y=${tickerY_R1251}:w=${tickerW_R1251}:h=${tickerH_R1251}:color=black@0.58:t=fill,${pageDrawsR1251},format=yuv420p[base1251];`+
        `[${albumLikeInputIndexR1262}:v]scale=${ALBUM_LIKE_WIDTH_R1262}:-1:flags=lanczos,format=rgba,negate=components=r+g+b,format=yuva420p,setpts=PTS-STARTPTS[like1262];`+
        `[base1251][like1262]overlay=x=W-w-34:y=H-h-110:shortest=0:eof_action=pass:eval=frame:format=yuv420:enable='${likeEnableR1262}'[base];`+
        `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
    }
    return `${sourceR1255},${vfBaseR902},drawbox=x=${tickerX_R1251}:y=${tickerY_R1251}:w=${tickerW_R1251}:h=${tickerH_R1251}:color=black@0.58:t=fill,${pageDrawsR1251},format=yuv420p[base];`+
      `[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
  }

  const tickerMatchR902=vfBaseR902.match(/,drawtext=fontfile='[^']+':textfile='[^']*live-ticker\.txt'[\s\S]*$/);
  let tickerChainR902='[base0]null[base]';

  if(tickerMatchR902){
    vfBaseR902=vfBaseR902.slice(0,tickerMatchR902.index);

    let tickerFilterR902=tickerMatchR902[0].slice(1)
      .replace(/:y=h-104(?=:)/,':y=8')
      .replace(/:y=h-62(?=:)/,':y=8')
      .replace(/:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2/,'');

    const tickerCropWidthR1213=1160;
    const tickerCropXR1213=410;
    const tickerYR1214=968;
    tickerChainR902=
      `[base0]split=2[basekeep][tickerbg];`+
      `[tickerbg]crop=${tickerCropWidthR1213}:64:${tickerCropXR1213}:${tickerYR1214},${tickerFilterR902}[tickerstrip];`+
      `[basekeep][tickerstrip]overlay=x=${tickerCropXR1213}:y=${tickerYR1214}:shortest=0:eof_action=pass:eval=init:format=yuv420[base]`;
  }

  return `${sourceR1255},${vfBaseR902}[base0];${tickerChainR902};[base]null[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
}

function clipFilterComplexR721(){
  const vf=titleOverlayFiltersR721({dynamicTitle:true,showPreview:false});
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=36:y=36:shortest=1:format=yuv420,format=yuv420p[outv]`;
}

function bumperFilterComplexR724(){
  const vf=[
    LIVE_FULL_FRAME_GEOMETRY_R819,`fps=${VIDEO_FPS}`
  ].join(',');
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=36:y=36:shortest=1:format=yuv420,format=yuv420p[outv]`;
}

// R1148 MP3 CINEMATIC MASTER LOCK
// Arm/release from raw frame counts, not Date.now(), so the protected interval is
// tied to the exact feeder PTS that generates the alpha fade. This changes only
// R1085's DROP/DUP policy during the short cinematic window; audio, playlist,
// decoder, x264, MPEG-TS and RTMPS transport are untouched.
function armMp3CinematicMasterLockR1148(child,relay){
  const master=publisher?.__r1085AudioMaster;
  if(!master)return false;
  const publisherPid=Number(publisher?.pid||0);
  if(!publisherPid)return false;
  if(child.__r1148Mp3LockPublisherPid===publisherPid && master.transitionPassThroughR1148)return true;

  const leadMs=Math.round((Number(master.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-Number(master.videoFrames||0)/VIDEO_FPS)*1000);
  master.transitionPassThroughR1148=true;
  master.transitionPassThroughUntilR1148=Date.now()+MP3_CINEMATIC_LOCK_TIMEOUT_MS_R1148;
  master.transitionPassFramesR1148=0;
  master.transitionPassArmLeadMsR1148=leadMs;
  master.transitionReleaseVideoFrameR1148=0;
  master.transitionReleaseChildPidR1148=0;
  child.__r1148Mp3LockPublisherPid=publisherPid;
  child.__r1148Mp3FadeOutLockArmed=true;

  state.mp3CinematicMasterLockActiveR1148=true;
  state.mp3CinematicMasterLockArmedAtR1148=new Date().toISOString();
  state.mp3CinematicMasterLockStartLeadMsR1148=leadMs;
  diagRecordR802('r1148-mp3-cinematic-master-lock-armed',{
    childPid:Number(child?.pid||0),
    frame:Number(relay?.frames||0),
    fadeStartFrame:Number(child?.__r1148Mp3FadeOutStartFrame||0),
    leadMs
  });
  return true;
}

function releaseMp3CinematicMasterLockR1148(child,relay,reason='fade-in-complete'){
  const master=publisher?.__r1085AudioMaster;
  if(!master?.transitionPassThroughR1148)return false;

  const frames=Number(master.transitionPassFramesR1148||0);
  const startLeadMs=Number(master.transitionPassArmLeadMsR1148||0);
  const releaseChildPid=Number(master.transitionReleaseChildPidR1148||child?.pid||0);
  const releaseTargetFrame=Number(master.transitionReleaseVideoFrameR1148||0);
  const leadMs=Math.round((Number(master.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-Number(master.videoFrames||0)/VIDEO_FPS)*1000);

  master.transitionPassThroughR1148=false;
  master.transitionPassThroughUntilR1148=0;
  master.transitionPassArmLeadMsR1148=0;
  master.transitionReleaseVideoFrameR1148=0;
  master.transitionReleaseChildPidR1148=0;

  state.mp3CinematicMasterLockActiveR1148=false;
  state.lastMp3CinematicMasterLockR1148={
    at:new Date().toISOString(),
    reason,
    frames,
    startLeadMs,
    endLeadMs:leadMs,
    childPid:releaseChildPid,
    releaseTargetFrame
  };
  diagRecordR802('r1148-mp3-cinematic-master-lock-released',{
    childPid:releaseChildPid,
    frame:Number(relay?.frames||0),
    releaseTargetFrame,
    frames,
    startLeadMs,
    leadMs,
    reason
  });
  return true;
}

// R1148D: arm the release target from the ACTUAL incoming feeder metadata.
// R1148C depended on the caller's opts object. In production that hook could be
// skipped even though the candidate was a real 2.40 s MP3 reveal, leaving the
// lock alive until the 15 s watchdog. The child metadata is created by the same
// FFmpeg spawn that owns the fade, so it is the authoritative release length.
function armMp3CinematicReleaseTargetR1148D(child,reason='incoming-feeder-live'){
  const master=publisher?.__r1085AudioMaster;
  if(!master?.transitionPassThroughR1148)return false;

  // R1148E: once R1148 is active, the OUTGOING feeder has already proved this
  // boundary is MP3->MP3. Do not depend on incoming child metadata to release
  // the persistent-master lock: that metadata can be absent even though the
  // real 2.40 s startup mask is live. Use metadata when present, otherwise the
  // canonical cinematic reveal length. This makes watchdog timeout a true
  // emergency fallback instead of the normal release path.
  const metadataFrames=Math.max(0,Number(child?.__r1148Mp3FadeInReleaseFrame)||0);
  const canonicalFrames=Math.max(
    1,
    Math.ceil(
      (MP3_BOUNDARY_FADE_IN_SECONDS_R814+
       MP3_CINEMATIC_FADE_RELEASE_PAD_SECONDS_R1148)*VIDEO_FPS
    )
  );
  const releaseFrames=metadataFrames>0?metadataFrames:canonicalFrames;

  const childPid=Number(child?.pid||0);
  const currentVideoFrame=Number(master.videoFrames||0);
  const existingTarget=Number(master.transitionReleaseVideoFrameR1148||0);
  const existingPid=Number(master.transitionReleaseChildPidR1148||0);

  // Idempotent: candidate-promoted and first-full-frame may both call this.
  if(existingTarget>currentVideoFrame && existingPid===childPid)return true;

  master.transitionReleaseVideoFrameR1148=currentVideoFrame+releaseFrames;
  master.transitionReleaseChildPidR1148=childPid;
  state.mp3MasterFrameReleaseTargetR1148C=Number(master.transitionReleaseVideoFrameR1148||0);
  state.mp3MasterFrameReleaseTargetR1148D=Number(master.transitionReleaseVideoFrameR1148||0);
  state.mp3MasterFrameReleaseTargetR1148E=Number(master.transitionReleaseVideoFrameR1148||0);

  diagRecordR802('r1148e-mp3-master-frame-release-target-armed',{
    candidatePid:childPid,
    releaseFrames,
    metadataFrames,
    canonicalFrames,
    targetVideoFrame:Number(master.transitionReleaseVideoFrameR1148||0),
    currentVideoFrame,
    reason
  });
  return true;
}

function detachVideoFrameRelayR816(child){
  const relay=child?.__r816VideoRelay;
  if(!relay)return {frames:0,dropped:0};
  relay.active=false;
  if(relay.stallWatchdogR1066){clearInterval(relay.stallWatchdogR1066);relay.stallWatchdogR1066=null;}
  try{if(relay.paceTimer)clearTimeout(relay.paceTimer)}catch(_){ }
  try{if(relay.tailTimer)clearTimeout(relay.tailTimer)}catch(_){ }
  if(relay.tailResolve){const done=relay.tailResolve;relay.tailResolve=null;try{done(false)}catch(_){ }}
  try{relay.onDetachR1123?.()}catch(_){ }
  try{relay.source.off('data',relay.onData)}catch(_){ }
  try{relay.source.off('error',relay.onError)}catch(_){ }
  try{if(relay.onEnd)relay.source.off('end',relay.onEnd)}catch(_){ }
  try{if(relay.onDrain)relay.sink.off('drain',relay.onDrain)}catch(_){ }
  try{relay.source.pause()}catch(_){ }
  let dropped=Number(relay.frameBytes||0);
  for(const part of relay.deferred||[])dropped+=Number(part?.length||0);
  if(dropped>0)state.videoRelayPartialBytesDropped=Number(state.videoRelayPartialBytesDropped||0)+dropped;
  if(Array.isArray(relay.queue))relay.queue.length=0;
  child.__r816VideoRelay=null;
  return {frames:Number(relay.frames||0),dropped};
}

function attachVideoFrameRelayR816(child,videoSink,label='video'){
  const source=child?.stdout;
  if(!source||!videoSink||videoSink.destroyed||videoSink.writableEnded)throw new Error(`R816 ${label} rawvideo relay unavailable`);
  detachVideoFrameRelayR816(child);
  const relay={source,sink:videoSink,label,active:true,frameParts:[],frameBytes:0,deferred:[],frames:0,waitingDrain:false,onDrain:null,onData:null,onError:null};
  const deferRemainder=(chunk,offset)=>{if(offset<chunk.length)relay.deferred.push(chunk.subarray(offset));};
  const consume=(chunk)=>{
    if(!relay.active||!chunk?.length)return;
    if(relay.waitingDrain){relay.deferred.push(chunk);return;}
    let offset=0;
    while(offset<chunk.length&&relay.active){
      const need=VIDEO_FRAME_BYTES_R816-relay.frameBytes;
      const take=Math.min(need,chunk.length-offset);
      relay.frameParts.push(chunk.subarray(offset,offset+take));
      relay.frameBytes+=take;
      offset+=take;
      if(relay.frameBytes===VIDEO_FRAME_BYTES_R816){
        const frame=relay.frameParts.length===1?relay.frameParts[0]:Buffer.concat(relay.frameParts,VIDEO_FRAME_BYTES_R816);
        relay.frameParts=[];
        relay.frameBytes=0;

        // R1160E: an old/racing normal feeder is never allowed to write even one
        // complete frame after a newer normal feeder has been promoted. This is a
        // frame-level last line of defence against the long-run MP3 flicker.
        if(label==='normal-visual' &&
           Number(child?.__r1160ENormalVideoOwnerGeneration||0)!==Number(normalVideoOwnerGenerationR1160E||0)){
          if(!relay.__r1160EStaleOwnerSuppressed){
            relay.__r1160EStaleOwnerSuppressed=true;
            child.__r816IntentionalStop=true;
            state.normalVideoStaleOwnersSuppressedR1160E=Number(state.normalVideoStaleOwnersSuppressedR1160E||0)+1;
            diagRecordR802('r1160e-stale-normal-video-owner-suppressed',{
              stalePid:Number(child?.pid||0),
              staleGeneration:Number(child?.__r1160ENormalVideoOwnerGeneration||0),
              ownerPid:Number(videoFeeder?.pid||0),
              ownerGeneration:Number(normalVideoOwnerGenerationR1160E||0),
              current:shortText(state.current?.title||'',52)
            });
            const staleKill=setTimeout(()=>{
              try{detachVideoFrameRelayR816(child)}catch(_){}
              try{if(child.exitCode===null)child.kill('SIGTERM')}catch(_){}
            },0);
            staleKill.unref?.();
          }
          return;
        }

        // R1150 frame-window metadata is needed BEFORE R1148 decides whether
        // this really is still MP3->MP3.
        const masterR1150=publisher?.__r1085AudioMaster;
        const totalFramesR1150=Math.max(0,Number(child?.__r1150TrackDurationFrames)||0);
        const startFramesR1150=Math.max(1,Number(child?.__r1150EdgeStartFrames)||0);
        const tailFramesR1150=Math.max(1,Number(child?.__r1150EdgeTailFrames)||0);
        const inStartR1150=Boolean(totalFramesR1150>0 && relay.frames<startFramesR1150);
        const inTailR1150=Boolean(totalFramesR1150>0 && relay.frames>=Math.max(0,totalFramesR1150-tailFramesR1150));

        // A feeder created as MP3->MP3 carries an extra R978B 0.20s guard + 0.60s
        // black hold beyond the audible MP3. Remove that synthetic tail when
        // estimating the REAL audio boundary for scheduler re-checks.
        const syntheticMp3TailFramesR1154=child?.__r1150Mp3Boundary===true
          ? Math.max(
              0,
              Math.round(
                (
                  MP3_TO_VIDEO_TAIL_GUARD_MS_R972/1000+
                  MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814
                )*VIDEO_FPS
              )
            )
          : 0;
        const audibleEndFrameR1154=Math.max(
          0,
          totalFramesR1150-syntheticMp3TailFramesR1154
        );
        const remainingMsR1154=Math.max(
          0,
          Math.round((audibleEndFrameR1154-relay.frames)*1000/VIDEO_FPS)
        );

        // R1154: if the frozen start-of-song boundary said MP3->MP3, re-read the
        // ACTUAL owner during the final 10 seconds. This includes a queue-immediate
        // R943 bumper/clip and the real timed/automatic station scheduler.
        if(
          label==='normal-visual' &&
          inTailR1150 &&
          child?.__r1150Mp3Boundary===true &&
          child?.__r1154RuntimeVideoHandoff!==true
        ){
          const ownerR1154=actualNextVideoOwnerR1154(remainingMsR1154);
          if(ownerR1154?.item){
            child.__r1154RuntimeVideoHandoff=true;
            child.__r1154SuppressR1148=true;
            child.__r1154ActualNextKind=ownerR1154.kind||'video';
            child.__r1154ActualNextSource=ownerR1154.source||'runtime';
            child.__r1154ActualNextItem=ownerR1154.item;
            child.__r1154ActualNextAfterItem=ownerR1154.afterItem||null;

            const leadMsR1154=masterR1150
              ? Math.round(
                  (
                    Number(masterR1150.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-
                    Number(masterR1150.videoFrames||0)/VIDEO_FPS
                  )*1000
                )
              : 0;

            diagRecordR802('r1154-actual-next-owner-video-r1085-restored',{
              childPid:Number(child?.pid||0),
              frame:Number(relay.frames||0),
              totalFrames:totalFramesR1150,
              audibleEndFrame:audibleEndFrameR1154,
              remainingMs:remainingMsR1154,
              kind:ownerR1154.kind||'video',
              source:ownerR1154.source||'runtime',
              title:shortText(ownerR1154.item?.title||'VIDEO',52),
              leadMs:leadMsR1154,
              drops:Number(masterR1150?.dropped||0),
              duplicates:Number(masterR1150?.duplicated||0)
            });

            // Recreate the proven static MP3->video behavior as closely as possible:
            // cache/warm now and have the unified A/V candidate stopped and ready
            // at about T-4s, so station-preplay can claim it immediately.
            scheduleActualNextPrearmR1154(
              child,
              ownerR1154,
              remainingMsR1154
            );

            // A video owner has no incoming MP3 to release R1148E. If a false
            // MP3 lock was already armed, cancel it now; otherwise suppress arming.
            if(masterR1150?.transitionPassThroughR1148){
              releaseMp3CinematicMasterLockR1148(
                child,
                relay,
                'r1154-actual-next-owner-video'
              );
            }
          }
        }

        // R1148 is MP3->MP3 only. R1154 suppresses it as soon as the real next
        // owner becomes a station/clip.
        const fadeStartFrameR1148=Number(child?.__r1148Mp3FadeOutStartFrame);
        if(!child?.__r1154SuppressR1148 &&
           Number.isFinite(fadeStartFrameR1148) &&
           fadeStartFrameR1148>=0 &&
           relay.frames>=fadeStartFrameR1148){
          const activePublisherPidR1148=Number(publisher?.pid||0);
          if(!child.__r1148Mp3FadeOutLockArmed ||
             Number(child.__r1148Mp3LockPublisherPid||0)!==activePublisherPidR1148){
            armMp3CinematicMasterLockR1148(child,relay);
          }
        }

        // R1148D fallback: the first complete frame from the promoted incoming
        // MP3 feeder is the last possible safe place to arm the persistent-master
        // release target. It remains untouched for genuine MP3->MP3 transitions.
        if(relay.frames===0){
          armMp3CinematicReleaseTargetR1148D(child,'incoming-first-full-frame');
        }

        // R1151/R1154:
        // - first 7s remain exact for every normal MP3;
        // - final 10s remain exact only for a GENUINE MP3->MP3 owner;
        // - when R1154 detects a real video owner, normal R1085 DROP/DUP is restored.
        const tailShieldAllowedR1151=Boolean(
          child?.__r1150Mp3Boundary===true &&
          child?.__r1154RuntimeVideoHandoff!==true
        );
        const exactTailR1151=Boolean(inTailR1150 && tailShieldAllowedR1151);
        const exactEdgeR1150=Boolean(label==='normal-visual' && (inStartR1150||exactTailR1151));

        if(label==='normal-visual' && inTailR1150 && !tailShieldAllowedR1151 && !relay.__r1151VideoHandoffTailDiag){
          relay.__r1151VideoHandoffTailDiag=true;
          diagRecordR802('r1151-mp3-to-video-tail-r1085-phase-preserved',{
            childPid:Number(child?.pid||0),
            frame:Number(relay.frames||0),
            totalFrames:totalFramesR1150,
            exactTailDisabled:true
          });
        }

        if(exactEdgeR1150 && !relay.__r1150EdgeDiagStart && inStartR1150){
          relay.__r1150EdgeDiagStart=true;
          diagRecordR802('r1150-mp3-edge-exact-start',{
            childPid:Number(child?.pid||0),
            frame:Number(relay.frames||0),
            exactSeconds:MP3_EDGE_START_EXACT_SECONDS_R1150
          });
        }
        if(exactEdgeR1150 && !relay.__r1150EdgeDiagTail && inTailR1150){
          relay.__r1150EdgeDiagTail=true;
          diagRecordR802('r1150-mp3-edge-exact-tail',{
            childPid:Number(child?.pid||0),
            frame:Number(relay.frames||0),
            totalFrames:totalFramesR1150,
            exactSeconds:MP3_EDGE_TAIL_EXACT_SECONDS_R1150
          });
        }

        let ok=false;
        if(masterR1150 && exactEdgeR1150)masterR1150.normalMp3EdgePassThroughR1150=true;
        // R1160L: the MP3 background already runs at native 25fps via -re.
        // Always forward each REAL background frame once and honour pipe drain.
        // DROP on a submitted-PCM deficit can starve FFmpeg while PCM is blocked;
        // DUP stretches the background's motion. Neither belongs on this path.
        if(masterR1150)masterR1150.normalVisualPassThroughR1160L=label==='normal-visual';
        if(label==='normal-visual'&&!relay.__r1160LExactLogged){
          relay.__r1160LExactLogged=true;
          diagRecordR802('r1160l-normal-video-exact-cadence',{childPid:Number(child.pid||0),mode:'ALL-REAL-FRAMES-NO-DROP-DUP',fps:VIDEO_FPS});
        }
        try{
          ok=videoSink.write(frame);
        }finally{
          if(masterR1150){masterR1150.normalMp3EdgePassThroughR1150=false;masterR1150.normalVisualPassThroughR1160L=false;}
        }
        relay.frames++;
        state.videoRelayFramesWritten=Number(state.videoRelayFramesWritten||0)+1;
        state.lastVideoFrameAtR816=new Date().toISOString();

        const fadeReleaseFrameR1148=Number(child?.__r1148Mp3FadeInReleaseFrame);
        if(Number.isFinite(fadeReleaseFrameR1148) &&
           fadeReleaseFrameR1148>0 &&
           !child.__r1148Mp3FadeInReleased &&
           relay.frames>=fadeReleaseFrameR1148){
          child.__r1148Mp3FadeInReleased=true;
          releaseMp3CinematicMasterLockR1148(child,relay,'fade-in-complete');
        }

        if(!ok){
          relay.waitingDrain=true;
          deferRemainder(chunk,offset);
          try{source.pause()}catch(_){ }
          relay.onDrain=()=>{
            if(!relay.active)return;
            relay.waitingDrain=false;
            const queued=relay.deferred.splice(0);
            for(let i=0;i<queued.length&&relay.active;i++){
              consume(queued[i]);
              if(relay.waitingDrain){
                if(i+1<queued.length)relay.deferred.unshift(...queued.slice(i+1));
                return;
              }
            }
            try{source.resume()}catch(_){ }
          };
          videoSink.once('drain',relay.onDrain);
          return;
        }
      }
    }
  };
  // R1066-CLIP-STALL-WATCHDOG
  // Protect only temporary clip/station feeder.
  // Persistent publisher/master is NEVER restarted here.
  relay.lastRawVideoAtR1066=Date.now();
  relay.stallTriggeredR1066=false;

  const originalConsumeR1066=consume;

  relay.onData=chunk=>{
    relay.lastRawVideoAtR1066=Date.now();
    return originalConsumeR1066(chunk);
  };

  relay.stallWatchdogR1066=setInterval(()=>{
    try{
      if(!relay.active||stopping){
        clearInterval(relay.stallWatchdogR1066);
        relay.stallWatchdogR1066=null;
        return;
      }

      if(!child||child.exitCode!==null||child.signalCode!==null){
        clearInterval(relay.stallWatchdogR1066);
        relay.stallWatchdogR1066=null;
        return;
      }

      // Only real insert feeders. Never normal MP3 visual feeder.
      const insertFeederR1066=
        label==='music-clip' ||
        label==='station-insert';

      if(!insertFeederR1066)return;

      const silentMsR1066=
        Date.now()-Number(relay.lastRawVideoAtR1066||Date.now());

      // 8 seconds without ANY rawvideo from an active insert
      // is a genuine feeder stall, not normal backpressure.
      if(
        silentMsR1066 >= 8000 &&
        !relay.stallTriggeredR1066
      ){
        relay.stallTriggeredR1066=true;

        state.lastWarning=
          `R1066 ${label} feeder stalled ${silentMsR1066}ms; child-only recovery`;

        try{
          diagRecordR802('r1066-clip-feeder-stall',{
            label,
            childPid:Number(child.pid||0),
            silentMs:silentMsR1066,
            current:state.current?.title||''
          });
        }catch(_){}

        // Kill ONLY the dead insert decoder/feeder.
        // Existing child exit/close path performs bridge + next item.
        try{child.kill('SIGTERM')}catch(_){}

        const hardKillR1066=setTimeout(()=>{
          try{
            if(child.exitCode===null&&child.signalCode===null){
              child.kill('SIGKILL');
            }
          }catch(_){}
        },2000);

        hardKillR1066.unref?.();

        clearInterval(relay.stallWatchdogR1066);
        relay.stallWatchdogR1066=null;
      }
    }catch(error){
      state.lastWarning=
        `R1066 watchdog: ${String(error?.message||error)}`;
    }
  },1000);

  relay.stallWatchdogR1066.unref?.();
  relay.onError=err=>{if(relay.active&&!stopping)state.lastError=`R816 ${label} rawvideo relay: ${String(err)}`;};
  source.on('data',relay.onData);
  source.on('error',relay.onError);
  child.__r816VideoRelay=relay;
  state.videoRelayMode='R816-FULL-FRAME-ONLY-YUV420P';
  try{source.resume()}catch(_){ }
  return relay;
}

function stopMasterAudioGapBridgeR824(reason=''){
  if(audioGapBridgeTimerR824){clearInterval(audioGapBridgeTimerR824);audioGapBridgeTimerR824=null;}
  if(audioGapBridgeSinkR824&&audioGapBridgeDrainHandlerR824){
    try{audioGapBridgeSinkR824.off('drain',audioGapBridgeDrainHandlerR824)}catch(_){ }
  }
  audioGapBridgeDrainHandlerR824=null;
  audioGapBridgeWaitingDrainR824=false;
  audioGapBridgeSinkR824=null;
  if(state.audioGapBridgeActive){
    state.audioGapBridgeActive=false;
    state.lastAudioGapBridgeStopAt=new Date().toISOString();
    state.lastAudioGapBridgeStopReason=reason||'';
  }
}


async function drainAudioGapBridgeR917B(sink){
  if(!sink)return;

  // R993: before promoting a clip/station picture, let the persistent
  // publisher audio input really empty. The old 140 ms check could leave
  // queued PCM in front of the incoming video's audio.
  const started=Date.now();
  const maxWaitMs=1500;

  while(
    Date.now()-started < maxWaitMs &&
    Number(sink.writableLength||0) > 0
  ){
    await new Promise(resolve=>setTimeout(resolve,10));
  }

  state.lastAudioDrainR993={
    at:new Date().toISOString(),
    waitedMs:Date.now()-started,
    remainingBytes:Number(sink.writableLength||0)
  };
}

function startMasterAudioGapBridgeR824(reason='inter-item-gap'){
  if(stopping||audioGapBridgeTimerR824)return false;
  const thisPublisher=publisher;
  const sink=thisPublisher?.stdio?.[3];
  if(!thisPublisher||thisPublisher.exitCode!==null||!sink||sink.destroyed||sink.writableEnded)return false;
  audioGapBridgeSinkR824=sink;
  state.audioGapBridgeActive=true;
  state.audioGapBridgeStarts=Number(state.audioGapBridgeStarts||0)+1;
  state.lastAudioGapBridgeStartAt=new Date().toISOString();
  state.lastAudioGapBridgeReason=reason;
  diagRecordR802('r824-audio-gap-bridge-start',{reason,starts:Number(state.audioGapBridgeStarts||0)});
  const tick=()=>{
    if(stopping||publisher!==thisPublisher||thisPublisher.exitCode!==null||sink.destroyed||sink.writableEnded){
      stopMasterAudioGapBridgeR824('publisher-unavailable');
      return;
    }
    if(audioGapBridgeWaitingDrainR824)return;
    try{
      const ok=sink.write(AUDIO_GAP_BRIDGE_CHUNK_R824);
      state.audioGapBridgeBytes=Number(state.audioGapBridgeBytes||0)+AUDIO_GAP_BRIDGE_CHUNK_R824.length;
      if(!ok){
        audioGapBridgeWaitingDrainR824=true;
        audioGapBridgeDrainHandlerR824=()=>{
          audioGapBridgeWaitingDrainR824=false;
          audioGapBridgeDrainHandlerR824=null;
        };
        sink.once('drain',audioGapBridgeDrainHandlerR824);
      }
    }catch(error){
      state.lastWarning=`R824 audio gap bridge: ${cleanText(error?.message||error)}`;
      stopMasterAudioGapBridgeR824('write-error');
    }
  };
  tick();
  audioGapBridgeTimerR824=setInterval(tick,AUDIO_GAP_BRIDGE_INTERVAL_MS_R824);
  audioGapBridgeTimerR824.unref?.();
  return true;
}


// ============================================================
// R1160H MASTER-AUDIO SINGLE OWNER
//
// Every real PCM source (MP3 / clip / station / R884 recovery) reaches the
// persistent master through this one connector. Calling Readable.pipe() twice
// to the same destination duplicates every PCM chunk, which is heard as two
// simultaneous songs/transition audio. Long-run R884 publisher recovery was
// the remaining path that could race a normal media pipe and create exactly
// that condition.
//
// This helper makes the audio source -> master sink relationship exclusive.
// Silence bridge is stopped before real PCM becomes owner.
// ============================================================
let masterAudioOwnerSourceR1160H=null;
let masterAudioOwnerSinkR1160H=null;
let masterAudioOwnerGenerationR1160H=0;

function disconnectMasterAudioOwnerR1160H(reason=''){
  const source=masterAudioOwnerSourceR1160H;
  const sink=masterAudioOwnerSinkR1160H;
  if(source&&sink){
    try{source.unpipe(sink)}catch(_){}
  }
  masterAudioOwnerSourceR1160H=null;
  masterAudioOwnerSinkR1160H=null;
  if(reason){
    state.lastMasterAudioOwnerDisconnectR1160H={
      at:new Date().toISOString(),
      reason:cleanText(reason).slice(-240)
    };
  }
}

function connectMasterAudioOwnerR1160H(source,sink,label='media'){
  if(!source||!sink||sink.destroyed||sink.writableEnded)return false;

  stopMasterAudioGapBridgeR824(`r1160h-real-audio-owner:${label}`);

  // Remove the previous owner's pipe first.
  if(masterAudioOwnerSourceR1160H&&masterAudioOwnerSinkR1160H){
    try{masterAudioOwnerSourceR1160H.unpipe(masterAudioOwnerSinkR1160H)}catch(_){}
  }

  // Critical: make this exact source/sink pair single-owner even if another
  // recovery/media path already piped it milliseconds earlier.
  try{source.unpipe(sink)}catch(_){}
  try{
    source.pipe(sink,{end:false});
  }catch(error){
    state.lastError=`R1160H audio owner pipe failed: ${cleanText(error?.message||error)}`;
    return false;
  }

  masterAudioOwnerGenerationR1160H++;
  masterAudioOwnerSourceR1160H=source;
  masterAudioOwnerSinkR1160H=sink;

  state.masterAudioOwnerGenerationR1160H=masterAudioOwnerGenerationR1160H;
  state.masterAudioOwnerLabelR1160H=String(label||'media');
  state.masterAudioOwnerPublisherPidR1160H=Number(publisher?.pid||0);

  try{
    diagRecordR802('r1160h-master-audio-owner-connected',{
      label:String(label||'media'),
      generation:masterAudioOwnerGenerationR1160H,
      publisherPid:Number(publisher?.pid||0),
      current:shortText(state.current?.title||'',52)
    });
  }catch(_){}

  return true;
}

function h264EncoderArgsR721(){
  // R1270: exact proven R1212 publisher profile.
  // B-frames are deliberately disabled. DTS=PTS stays valid across feeder switches.
  return [
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
    '-profile:v','high','-level:v','4.1',
    '-b:v',VIDEO_BITRATE,'-minrate',VIDEO_BITRATE,'-maxrate',VIDEO_BITRATE,'-bufsize','12000k',
    '-x264-params',`nal-hrd=cbr:force-cfr=1:repeat-headers=1:aud=1:keyint=${VIDEO_GOP}:min-keyint=${VIDEO_GOP}:scenecut=0:cabac=0:open-gop=0:sliced-threads=0`,
    '-g',String(VIDEO_GOP),'-keyint_min',String(VIDEO_GOP),'-sc_threshold','0','-bf','0','-refs','1','-coder','0',
    '-r',String(VIDEO_FPS),'-pix_fmt','yuv420p'
  ];
}


// ============================================================
// R1125-TRANSPORT-ISOLATION
//
// ENCODER/MASTER:
//   raw YUV + PCM -> one persistent x264/AAC publisher -> localhost MPEG-TS
//
// NETWORK:
//   UDP 32125 -> independent PRIMARY copy-only relay -> RTMPS A
//   UDP 32126 -> independent BACKUP  copy-only relay -> RTMPS B
//
// There is deliberately NO network FIFO/tee inside the encoder anymore.
// The local UDP tee cannot wait for YouTube/TLS. Each RTMPS relay may die,
// reconnect or be SIGKILLed without touching R1085/R1123, playlist, decoder,
// video feeder or the other ingest lane.
// ============================================================

function encodedTransportLaneEnabledR1281(lane){
  if(lane==='primary')return Boolean(STREAM_URL);
  // R1287: during a safe server replacement an external HOLD process owns
  // YouTube's backup ingest. Never compete with it from the radio process.
  if(safeRestartBackupHoldActiveR1287())return false;
  return Boolean(DUAL_INGEST_ENABLED_R792&&STREAM_BACKUP_URL);
}

function createEncodedTransportLaneReservoirR1281(lane){
  const old=encodedTransportReservoirsR1281[lane];
  const oldSink=encodedTransportRelaySinksR1281[lane];
  if(old&&oldSink){
    try{old.unpipe(oldSink)}catch(_){}
  }
  if(old){try{old.destroy()}catch(_){}}

  const reservoir=new PassThrough({
    writableHighWaterMark:R1278_ENCODED_RESERVOIR_BYTES,
    readableHighWaterMark:R1278_ENCODED_RESERVOIR_BYTES
  });
  reservoir.on('error',error=>{
    if(!stopping)state.lastWarning=`R1281 ${lane} encoded reservoir: ${cleanText(error?.message||error)}`;
  });
  encodedTransportReservoirsR1281[lane]=reservoir;
  encodedTransportRelaySinksR1281[lane]=null;

  if(lane==='primary'){
    encodedTransportReservoirR1278=reservoir;
    encodedTransportRelaySinkR1278=null;
  }
  return reservoir;
}

function resetEncodedTransportReservoirR1278(){
  const source=encodedTransportPublisherSourceR1278;
  if(source&&encodedTransportPublisherDataHandlerR1281){
    try{source.off('data',encodedTransportPublisherDataHandlerR1281)}catch(_){}
  }
  if(source&&encodedTransportPublisherErrorHandlerR1281){
    try{source.off('error',encodedTransportPublisherErrorHandlerR1281)}catch(_){}
  }
  encodedTransportPublisherSourceR1278=null;
  encodedTransportPublisherDataHandlerR1281=null;
  encodedTransportPublisherErrorHandlerR1281=null;

  for(const lane of ['primary','backup']){
    const old=encodedTransportReservoirsR1281[lane];
    const sink=encodedTransportRelaySinksR1281[lane];
    if(old&&sink){try{old.unpipe(sink)}catch(_){}}
    if(old){try{old.destroy()}catch(_){}}
    encodedTransportReservoirsR1281[lane]=null;
    encodedTransportRelaySinksR1281[lane]=null;
  }

  createEncodedTransportLaneReservoirR1281('primary');
  if(encodedTransportLaneEnabledR1281('backup')){
    createEncodedTransportLaneReservoirR1281('backup');
  }

  encodedTransportReservoirR1278=encodedTransportReservoirsR1281.primary;
  encodedTransportRelaySinkR1278=encodedTransportRelaySinksR1281.primary;
  state.encodedTransportModeR1278='MASTER-TS-PIPE->DUAL-INDEPENDENT-RESERVOIRS->RTMPS-A+B';
  state.encodedTransportReservoirBytesR1278=R1278_ENCODED_RESERVOIR_BYTES;
  state.encodedTransportModeR1281='DUAL-RELIABLE-BRANCHES-NO-UDP-NO-CROSS-LANE-BACKPRESSURE';
  return encodedTransportReservoirR1278;
}

function bindEncodedTransportRelayR1278(child,lane='primary'){
  if(!child?.stdin||child.stdin.destroyed)return false;
  let reservoir=encodedTransportReservoirsR1281[lane];
  if(!reservoir||reservoir.destroyed){
    reservoir=createEncodedTransportLaneReservoirR1281(lane);
  }

  const oldSink=encodedTransportRelaySinksR1281[lane];
  if(oldSink&&oldSink!==child.stdin){
    try{reservoir.unpipe(oldSink)}catch(_){}
  }
  try{reservoir.unpipe(child.stdin)}catch(_){}

  // R1285: a surviving relay can be rebound after master recovery.
  // Keep exactly one owned error listener on its stdin across all rebinds.
  if(!child.stdin.__r1285EncodedErrorHandler){
    child.stdin.__r1285EncodedErrorHandler=error=>{
      if(!stopping&&!/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(error?.code||error?.message||error))){
        state.lastWarning=`R1281 ${lane} relay stdin: ${cleanText(error?.message||error)}`;
      }
    };
    child.stdin.on('error',child.stdin.__r1285EncodedErrorHandler);
  }

  reservoir.pipe(child.stdin,{end:false});
  encodedTransportRelaySinksR1281[lane]=child.stdin;
  child.__r1278EncodedReservoir=reservoir;
  child.__r1281EncodedLane=lane;

  if(lane==='primary'){
    encodedTransportReservoirR1278=reservoir;
    encodedTransportRelaySinkR1278=child.stdin;
  }

  state[`encodedTransportRelayPidR1281_${lane}`]=Number(child.pid||0);
  return true;
}

function resetFailedEncodedLaneR1281(lane,reason='relay-reset'){
  if(!encodedTransportLaneEnabledR1281(lane))return null;
  const stats=encodedTransportLaneStatsR1281[lane];
  stats.recycles=Number(stats.recycles||0)+1;
  const reservoir=createEncodedTransportLaneReservoirR1281(lane);
  state.lastEncodedLaneResetR1281={
    at:new Date().toISOString(),
    lane,
    reason:shortText(reason,180),
    count:Number(stats.recycles||0)
  };
  diagRecordR802('r1281-encoded-lane-reset',state.lastEncodedLaneResetR1281);
  return reservoir;
}

function bindEncodedTransportPublisherR1278(thisPublisher){
  const source=thisPublisher?.stdout;
  if(!source||source.destroyed)return false;

  if(encodedTransportPublisherSourceR1278&&encodedTransportPublisherDataHandlerR1281){
    try{encodedTransportPublisherSourceR1278.off('data',encodedTransportPublisherDataHandlerR1281)}catch(_){}
  }
  if(encodedTransportPublisherSourceR1278&&encodedTransportPublisherErrorHandlerR1281){
    try{encodedTransportPublisherSourceR1278.off('error',encodedTransportPublisherErrorHandlerR1281)}catch(_){}
  }

  encodedTransportPublisherDataHandlerR1281=chunk=>{
    if(!chunk?.length||stopping)return;

    for(const lane of ['primary','backup']){
      if(!encodedTransportLaneEnabledR1281(lane))continue;
      let reservoir=encodedTransportReservoirsR1281[lane];
      if(!reservoir||reservoir.destroyed){
        reservoir=createEncodedTransportLaneReservoirR1281(lane);
        const relay=transportRelayChildR1125(lane);
        if(relay&&relay.exitCode===null)bindEncodedTransportRelayR1278(relay,lane);
      }

      const bufferedBefore=Number(reservoir.readableLength||0)+Number(reservoir.writableLength||0);
      const stats=encodedTransportLaneStatsR1281[lane];
      stats.lastBuffered=bufferedBefore;
      stats.maxBuffered=Math.max(Number(stats.maxBuffered||0),bufferedBefore);

      // A sick lane may never stall the master or the other YouTube ingest.
      // Recycle ONLY that lane before its bounded memory cushion is exhausted.
      if(bufferedBefore>=R1281_ENCODED_LANE_MAX_BUFFER_BYTES){
        const relay=transportRelayChildR1125(lane);
        diagRecordR802('r1281-encoded-lane-congestion',{
          lane,
          bufferedBytes:bufferedBefore,
          relayPid:Number(relay?.pid||0)
        });
        resetFailedEncodedLaneR1281(lane,`buffer ${bufferedBefore}`);
        if(relay&&relay.exitCode===null){
          relay.__r1125WatchdogRecycle=true;
          try{relay.kill('SIGTERM')}catch(_){}
        }else{
          scheduleTransportRelayRestartR1125(lane,'r1281-buffer-reset');
        }
        continue;
      }

      try{
        reservoir.write(chunk);
      }catch(error){
        state.lastWarning=`R1281 ${lane} encoded write: ${cleanText(error?.message||error)}`;
        const relay=transportRelayChildR1125(lane);
        resetFailedEncodedLaneR1281(lane,'write-error');
        if(relay&&relay.exitCode===null){
          relay.__r1125WatchdogRecycle=true;
          try{relay.kill('SIGTERM')}catch(_){}
        }else{
          scheduleTransportRelayRestartR1125(lane,'r1281-write-error');
        }
      }
    }
  };

  encodedTransportPublisherErrorHandlerR1281=error=>{
    if(!stopping&&!/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(error?.code||error?.message||error))){
      state.lastWarning=`R1281 master TS stdout: ${cleanText(error?.message||error)}`;
    }
  };

  source.on('data',encodedTransportPublisherDataHandlerR1281);
  source.on('error',encodedTransportPublisherErrorHandlerR1281);
  encodedTransportPublisherSourceR1278=source;
  state.encodedTransportPublisherPidR1278=Number(thisPublisher?.pid||0);
  state.encodedTransportFanoutR1281='ONE-MASTER->PRIMARY-RESERVOIR+BACKUP-RESERVOIR';
  try{source.resume()}catch(_){}
  return true;
}

function transportRelayChildR1125(lane){
  return lane==='backup'?transportBackupR1125:transportPrimaryR1125;
}

function setTransportRelayChildR1125(lane,child){
  if(lane==='backup')transportBackupR1125=child;
  else transportPrimaryR1125=child;
}

function transportRelaySpecR1125(lane){
  if(lane==='backup'){
    return {
      lane:'backup',
      url:STREAM_BACKUP_URL,
      port:R1125_BACKUP_UDP_PORT,
      enabled:Boolean(DUAL_INGEST_ENABLED_R792&&STREAM_BACKUP_URL&&!safeRestartBackupHoldActiveR1287())
    };
  }
  return {
    lane:'primary',
    url:STREAM_URL,
    port:R1125_PRIMARY_UDP_PORT,
    enabled:Boolean(STREAM_URL)
  };
}

function resetTransportRelayHealthR1125(lane,pid=0){
  const h=transportRelayHealthR1125[lane];
  h.pid=Number(pid||0);
  h.lastAck=-1;
  h.lastProgressAt=Date.now();
  h.noSocketSince=0;
  h.everSocket=false;
}

function transportRelayArgsR1125(url,port){
  return [
    // R1278: reliable local transport. The master TS arrives through stdin from a
    // bounded Node reservoir, so no UDP datagram can disappear and damage AAC/H264.
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','512',
    '-fflags','+genpts',
    '-probesize','1000000',
    '-analyzeduration','1000000',
    '-f','mpegts','-i','pipe:0',
    '-map','0:v:0','-map','0:a:0',
    '-c','copy',
    '-tag:v','7','-tag:a','10',
    '-max_muxing_queue_size','2048',
    '-flush_packets','1',
    '-f','flv','-flvflags','no_duration_filesize',
    url
  ];
}

function scheduleTransportRelayRestartR1125(lane,reason='exit'){
  if(stopping)return;
  const spec=transportRelaySpecR1125(lane);
  if(!spec.enabled)return;
  if(transportRelayRestartTimersR1125[lane])return;

  transportRelayRestartTimersR1125[lane]=setTimeout(()=>{
    transportRelayRestartTimersR1125[lane]=null;
    if(stopping)return;
    try{
      spawnTransportRelayR1125(lane);
      diagRecordR802('r1125-relay-restarted',{
        lane,
        reason:cleanText(reason).slice(-300),
        pid:Number(transportRelayChildR1125(lane)?.pid||0)
      });
    }catch(error){
      state.lastWarning=`R1125 ${lane} relay restart failed: ${cleanText(error?.message||error)}`;
      scheduleTransportRelayRestartR1125(lane,'spawn-retry');
    }
  },R1125_RELAY_RESTART_MS);
  transportRelayRestartTimersR1125[lane].unref?.();
}

function spawnTransportRelayR1125(lane){
  const spec=transportRelaySpecR1125(lane);
  if(!spec.enabled)return null;

  const existing=transportRelayChildR1125(lane);
  if(existing&&existing.exitCode===null)return existing;

  const child=spawn(
    'ffmpeg',
    transportRelayArgsR1125(spec.url,spec.port),
    {stdio:['pipe','ignore','pipe']}
  );

  child.__r1125Lane=lane;
  child.__r1125IntentionalStop=false;
  child.__r1125WatchdogRecycle=false;
  setTransportRelayChildR1125(lane,child);
  resetTransportRelayHealthR1125(lane,child.pid);
  bindEncodedTransportRelayR1278(child,lane);

  state[`rtmps${lane==='backup'?'Backup':'Primary'}RelayPidR1125`]=Number(child.pid||0);
  state.transportArchitectureR1125='R1281-DUAL-INDEPENDENT-TS-PIPE-RESERVOIRS->RTMPS-A+B';

  try{
    diagRecordR802('r1125-relay-spawn',{
      lane,
      pid:Number(child.pid||0),
      transport:'pipe-reservoir-r1278',
      reservoirBytes:R1278_ENCODED_RESERVOIR_BYTES
    });
  }catch(_){}

  child.stderr?.on('data',d=>{
    const line=String(d||'').trim();
    if(!line)return;
    state.lastFfmpegLine=line.slice(-1000);
    if(/error|fail|broken pipe|connection|tls|invalid|eof/i.test(line)){
      state.lastWarning=`R1125 ${lane} relay: ${line.slice(-500)}`;
    }
    if(diagFfmpegR802(`r1125-${lane}-rtmps`,line)!==false)console.error(`[r1125-${lane}-rtmps]`,line);
  });

  child.on('exit',(code,signal)=>{
    const laneReservoirR1281=encodedTransportReservoirsR1281[lane];
    if(laneReservoirR1281&&child.stdin){
      try{laneReservoirR1281.unpipe(child.stdin)}catch(_){}
      if(encodedTransportRelaySinksR1281[lane]===child.stdin)encodedTransportRelaySinksR1281[lane]=null;
      if(lane==='primary'&&encodedTransportRelaySinkR1278===child.stdin)encodedTransportRelaySinkR1278=null;
    }
    const current=transportRelayChildR1125(lane)===child;
    if(current){
      setTransportRelayChildR1125(lane,null);
      state[`rtmps${lane==='backup'?'Backup':'Primary'}RelayPidR1125`]=0;
    }

    try{
      diagRecordR802('r1125-relay-exit',{
        lane,
        pid:Number(child.pid||0),
        code,
        signal,
        intentional:Boolean(child.__r1125IntentionalStop),
        watchdog:Boolean(child.__r1125WatchdogRecycle)
      });
    }catch(_){}

    if(current&&!stopping&&!child.__r1125IntentionalStop){
      resetFailedEncodedLaneR1281(lane,child.__r1125WatchdogRecycle?'watchdog-exit':'unexpected-exit');
      scheduleTransportRelayRestartR1125(
        lane,
        child.__r1125WatchdogRecycle?'watchdog':'unexpected-exit'
      );
    }
  });

  child.on('error',error=>{
    if(transportRelayChildR1125(lane)===child){
      state.lastWarning=`R1125 ${lane} relay process error: ${cleanText(error?.message||error)}`;
    }
  });

  return child;
}

function ensureTransportRelaysR1125(){
  const primary=spawnTransportRelayR1125('primary');
  if(primary&&primary.exitCode===null)bindEncodedTransportRelayR1278(primary,'primary');
  if(!primary||primary.exitCode!==null){
    throw new Error('R1125 primary RTMPS relay unavailable');
  }

  if(encodedTransportLaneEnabledR1281('backup')){
    const backup=spawnTransportRelayR1125('backup');
    if(backup&&backup.exitCode===null)bindEncodedTransportRelayR1278(backup,'backup');
    if(!backup||backup.exitCode!==null){
      throw new Error('R1125 backup RTMPS relay unavailable');
    }
  }else if(safeRestartBackupHoldActiveR1287()){
    state.lastWarning='R1287 safe restart HOLD owns YouTube backup ingest; radio backup relay intentionally paused';
  }

  return true;
}

function killTransportRelayForRecoveryR1125(lane,reason){
  const child=transportRelayChildR1125(lane);
  if(!child||child.exitCode!==null)return false;

  const h=transportRelayHealthR1125[lane];
  h.recycles=Number(h.recycles||0)+1;
  child.__r1125WatchdogRecycle=true;

  try{
    diagRecordR802('r1125-relay-recycle',{
      lane,
      pid:Number(child.pid||0),
      reason:cleanText(reason).slice(-350),
      count:Number(h.recycles||0)
    });
  }catch(_){}

  try{child.kill('SIGTERM')}catch(_){}
  const hard=setTimeout(()=>{
    try{
      if(child.exitCode===null)child.kill('SIGKILL');
    }catch(_){}
  },1500);
  hard.unref?.();
  return true;
}

function readRelayTcpProgressR1125(child){
  return new Promise(resolve=>{
    const pid=Number(child?.pid||0);
    if(!pid)return resolve(null);

    let out='';
    let done=false;
    const probe=spawn('ss',['-tinp'],{stdio:['ignore','pipe','ignore']});
    const finish=value=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer=setTimeout(()=>{
      try{probe.kill('SIGKILL')}catch(_){}
      finish(null);
    },2200);

    probe.stdout?.on('data',d=>{
      out+=String(d||'');
      if(out.length>600000)out=out.slice(-600000);
    });
    probe.once('error',()=>finish(null));
    probe.once('exit',()=>{
      try{
        const lines=out.split(/\n/);
        let sockets=0;
        let acked=0;
        let haveAck=false;
        for(let i=0;i<lines.length;i++){
          const line=String(lines[i]||'').trim();
          if(!/^ESTAB\s/.test(line))continue;
          if(!/:443\b/.test(line))continue;
          if(!new RegExp(`pid=${pid}\\b`).test(line))continue;
          sockets++;
          let info='';
          for(let j=i+1;j<lines.length;j++){
            const next=String(lines[j]||'');
            if(/^(?:ESTAB|LISTEN|SYN-SENT|SYN-RECV|FIN-WAIT-1|FIN-WAIT-2|TIME-WAIT|CLOSE|CLOSE-WAIT|LAST-ACK|CLOSING)\s/.test(next.trim()))break;
            info+=' '+next.trim();
          }
          const m=/\bbytes_acked:(\d+)/.exec(info);
          if(m){
            haveAck=true;
            acked+=Number(m[1])||0;
          }
        }
        finish({pid,sockets,haveAck,acked});
      }catch(_){finish(null);}
    });
  });
}

async function transportRelayWatchdogTickR1125(){
  if(stopping)return;

  for(const lane of ['primary','backup']){
    const spec=transportRelaySpecR1125(lane);
    if(!spec.enabled){
      // R1287: marker can appear while LIVE. Relinquish ONLY backup ingest so an
      // external hold service can connect before the radio process is restarted.
      if(lane==='backup' && safeRestartBackupHoldActiveR1287()){
        const heldChild=transportRelayChildR1125('backup');
        if(heldChild&&heldChild.exitCode===null){
          heldChild.__r1125IntentionalStop=true;
          try{heldChild.kill('SIGTERM')}catch(_){}
          const hard=setTimeout(()=>{try{if(heldChild.exitCode===null)heldChild.kill('SIGKILL')}catch(_){}},1200);
          hard.unref?.();
        }
        state.r1287BackupHoldActive=true;
      }
      continue;
    }

    if(lane==='backup')state.r1287BackupHoldActive=false;
    let child=transportRelayChildR1125(lane);
    if(!child||child.exitCode!==null){
      scheduleTransportRelayRestartR1125(lane,'watchdog-missing');
      continue;
    }

    const h=transportRelayHealthR1125[lane];
    if(h.pid!==Number(child.pid||0))resetTransportRelayHealthR1125(lane,child.pid);

    const snap=await readRelayTcpProgressR1125(child);
    const now=Date.now();

    if(!snap){
      // Probe failure is never a reason to kill a healthy relay.
      continue;
    }

    if(snap.sockets<1){
      if(!h.noSocketSince)h.noSocketSince=now;
      state[`rtmps${lane==='backup'?'Backup':'Primary'}SocketR1125`]=false;

      // Once the relay has had enough time to receive local TS, no :443 socket for
      // 30s means the worker/fifo/TLS state is not recovering. Recycle this lane only.
      if(
        publisher&&publisher.exitCode===null&&
        now-h.noSocketSince>=R1125_RELAY_NO_SOCKET_MS
      ){
        if(killTransportRelayForRecoveryR1125(lane,`no RTMPS socket ${now-h.noSocketSince}ms`))return;
      }
      continue;
    }

    h.noSocketSince=0;
    h.everSocket=true;
    state[`rtmps${lane==='backup'?'Backup':'Primary'}SocketR1125`]=true;

    if(!snap.haveAck)continue;

    if(h.lastAck<0||snap.acked<h.lastAck){
      h.lastAck=snap.acked;
      h.lastProgressAt=now;
      continue;
    }

    if(snap.acked>h.lastAck){
      h.lastAck=snap.acked;
      h.lastProgressAt=now;
      state[`rtmps${lane==='backup'?'Backup':'Primary'}LastProgressR1125`]=new Date(now).toISOString();
      state[`rtmps${lane==='backup'?'Backup':'Primary'}AckedR1125`]=Number(snap.acked||0);
      continue;
    }

    const stalledMs=now-Number(h.lastProgressAt||now);
    if(stalledMs>=R1125_RELAY_ACK_STALL_MS){
      if(killTransportRelayForRecoveryR1125(lane,`TCP ACK no-progress ${stalledMs}ms`))return;
    }
  }
}

async function stopTransportRelaysR1125(){
  for(const lane of ['primary','backup']){
    const t=transportRelayRestartTimersR1125[lane];
    if(t){clearTimeout(t);transportRelayRestartTimersR1125[lane]=null;}

    const child=transportRelayChildR1125(lane);
    if(!child)continue;
    child.__r1125IntentionalStop=true;
    try{if(child.exitCode===null)child.kill('SIGTERM')}catch(_){}
    await waitChildExit(child,1800);
    try{if(child.exitCode===null)child.kill('SIGKILL')}catch(_){}
    if(transportRelayChildR1125(lane)===child)setTransportRelayChildR1125(lane,null);
  }
}

// R884-PUBLISHER-ONLY-TRANSPORT-RECOVERY
// A dead RTMPS/FLV publisher must NOT kill the whole radio.
// Keep Node, playlist, current decoder and video feeder alive.
// Rebuild only the persistent H264/AAC publisher and reconnect
// the already-running rawvideo/PCM sources.
let publisherRecoveryBusyR884=false;
let publisherRecoveryCountR884=0;

// R1084-BOUNDARY-MASTER
// Transport recovery must never recycle the persistent publisher while an
// insert candidate is being armed. Doing that breaks the atomic R816 handoff:
// the candidate can be retried while the old boundary is still unwinding.
// Defer the publisher recycle, abort only the not-yet-live candidate once,
// then perform R884 after the handoff has fully unwound.
let publisherRecoveryDeferredR1084=null;

async function flushDeferredPublisherRecoveryR1084(){
  const pending=publisherRecoveryDeferredR1084;
  if(!pending||stopping||stationHandoffActiveR804)return false;
  publisherRecoveryDeferredR1084=null;
  try{
    diagRecordR802('r1084-boundary-recovery-flush',{
      reason:cleanText(pending.reason||'transport').slice(-500)
    });
  }catch(_){}
  return await recyclePublisherR884(
    pending.reason||'transport',
    pending.oldPublisher||publisher,
    Boolean(pending.alreadyExited)
  );
}

function activeTransportSourcesR884(){
  const clipLive=Boolean(
    clipPublisher &&
    clipPublisher.exitCode===null &&
    clipPublisher.__r752UnifiedAV===true &&
    clipPublisher.__r752Live===true
  );

  const videoChild=clipLive
    ? clipPublisher
    : (
        videoFeeder &&
        videoFeeder.exitCode===null
          ? videoFeeder
          : null
      );

  const audioSource=clipLive
    ? clipPublisher?.stdio?.[3]
    : (
        producer &&
        producer!==clipPublisher &&
        producer.exitCode===null
          ? producer.stdout
          : null
      );

  return {clipLive,videoChild,audioSource};
}

async function recyclePublisherR884(
  reason='transport',
  oldPublisher=publisher,
  alreadyExited=false
){
  if(stopping || publisherRecoveryBusyR884)return false;

  // R1084 BOUNDARY MASTER: never recycle the master in the middle of the
  // make-before-break insert arm. Queue exactly one recovery and make the
  // not-yet-live candidate fail once; R814 may retry it only after R884 has
  // rebuilt the publisher below in the handoff finally block.
  if(stationHandoffActiveR804){
    publisherRecoveryDeferredR1084={
      reason:cleanText(reason||'transport'),
      oldPublisher,
      alreadyExited:Boolean(alreadyExited),
      queuedAt:Date.now()
    };
    state.transportHealthy=false;
    state.transportSelfHealPending=true;
    state.lastWarning='R1084 transport recovery deferred until insert boundary unwinds';
    try{
      diagRecordR802('r1084-boundary-recovery-deferred',{
        reason:cleanText(reason||'transport').slice(-500),
        candidatePid:Number(clipPublisher?.pid||0),
        candidateLive:Boolean(clipPublisher?.__r752Live)
      });
    }catch(_){}
    const candidate=clipPublisher;
    if(candidate&&candidate.exitCode===null&&candidate.__r752Live!==true){
      candidate.__r1084BoundaryAbort=true;
      try{candidate.kill('SIGTERM')}catch(_){}
      const hard=setTimeout(()=>{
        try{
          if(candidate.exitCode===null&&candidate.signalCode===null)candidate.kill('SIGKILL');
        }catch(_){}
      },1200);
      hard.unref?.();
    }
    return false;
  }

  publisherRecoveryBusyR884=true;

  const old=oldPublisher;
  const sources=activeTransportSourcesR884();
  const videoChild=sources.videoChild;
  const audioSource=sources.audioSource;
  const clipLive=sources.clipLive;
  const oldAudioSink=old?.stdio?.[3];
  let audioFrozenR1160H=false;

  try{
    state.transportHealthy=false;
    state.transportSelfHealPending=true;

    state.lastWarning=
      `R884 publisher-only recovery starting: ${
        cleanText(reason).slice(-420)
      }`;

    console.error(
      '[r884-publisher-recovery]',
      'transport failed — preserving radio and recycling publisher only:',
      cleanText(reason).slice(-650)
    );

    // Freeze/detach current sources from the dead publisher.
    // The sources themselves remain alive.
    if(videoChild){
      try{detachVideoFrameRelayR816(videoChild)}catch(_){}
    }

    // R1160H: freeze PCM before touching the publisher. Remove EVERY pipe from
    // this readable, not only the captured old sink. This closes the long-run
    // race where a recovery and a normal transition could both own PCM.
    stopMasterAudioGapBridgeR824('r1160h-r884-freeze');
    disconnectMasterAudioOwnerR1160H('r1160h-r884-freeze');

    if(audioSource && !audioSource.destroyed && !audioSource.readableEnded){
      try{audioSource.pause();audioFrozenR1160H=true}catch(_){}
      try{audioSource.unpipe()}catch(_){}
      state.r884AudioFrozenR1160H=true;
      try{
        diagRecordR802('r1160h-r884-audio-frozen',{
          oldPublisherPid:Number(old?.pid||0),
          current:shortText(state.current?.title||'',52),
          clipLive:Boolean(clipLive)
        });
      }catch(_){}
    }else if(audioSource && oldAudioSink){
      try{audioSource.unpipe(oldAudioSink)}catch(_){}
    }

    // Planned publisher termination: exit handler MUST NOT
    // request a whole-service systemd restart.
    if(
      old &&
      !alreadyExited &&
      old.exitCode===null
    ){
      old.__r884TransportRecycle=true;

      try{old.kill('SIGTERM')}catch(_){}

      if(
        !(await waitChildExit(old,1400)) &&
        old.exitCode===null
      ){
        try{old.kill('SIGKILL')}catch(_){}
        await waitChildExit(old,500);
      }
    }

    if(
      publisher===old ||
      !publisher ||
      publisher.exitCode!==null
    ){
      publisher=null;
      state.publisherRunning=false;
    }

    await sleep(250);

    // Start ONLY the persistent master/publisher.
    if(
      !startPublisher() ||
      !publisher ||
      publisher.exitCode!==null
    ){
      throw new Error('startPublisher failed');
    }

    const newVideoSink=publisher?.stdio?.[4];
    const newAudioSink=publisher?.stdio?.[3];

    if(
      !newVideoSink ||
      newVideoSink.destroyed ||
      newVideoSink.writableEnded
    ){
      throw new Error('new publisher video pipe unavailable');
    }

    if(
      !newAudioSink ||
      newAudioSink.destroyed ||
      newAudioSink.writableEnded
    ){
      throw new Error('new publisher audio pipe unavailable');
    }

    // Reconnect the SAME live video source.
    if(
      videoChild &&
      videoChild.exitCode===null
    ){
      attachVideoFrameRelayR816(
        videoChild,
        newVideoSink,
        clipLive
          ? 'r884-clip-resume'
          : 'normal-visual' // R1160L: restore single-owner and full-track cadence guards
      );
    }else{
      // Only if no usable video source survived.
      await ensureNormalVideoFeederR721({
        force:true,
        fadeIn:false
      });
    }

    // R1160H: re-resolve audio AFTER the new publisher exists. A media boundary
    // may have happened while R884 was rebuilding, so reconnecting the captured
    // pre-recovery source can create two simultaneous PCM owners.
    const freshSourcesR1160H=activeTransportSourcesR884();
    const resumeAudioSourceR1160H=
      freshSourcesR1160H.audioSource &&
      !freshSourcesR1160H.audioSource.destroyed &&
      !freshSourcesR1160H.audioSource.readableEnded
        ? freshSourcesR1160H.audioSource
        : (
            audioSource &&
            !audioSource.destroyed &&
            !audioSource.readableEnded
              ? audioSource
              : null
          );

    if(resumeAudioSourceR1160H){
      // Ensure there is no hidden second destination left by an older closure.
      try{resumeAudioSourceR1160H.unpipe()}catch(_){}

      if(!connectMasterAudioOwnerR1160H(
        resumeAudioSourceR1160H,
        newAudioSink,
        'r884-recovery'
      )){
        throw new Error('R1160H failed to connect recovered PCM owner');
      }

      try{resumeAudioSourceR1160H.resume()}catch(_){}
      audioFrozenR1160H=false;
      state.r884AudioFrozenR1160H=false;

      try{
        diagRecordR802('r1160h-r884-audio-resumed-single-owner',{
          newPublisherPid:Number(publisher?.pid||0),
          sourceChanged:Boolean(resumeAudioSourceR1160H!==audioSource),
          current:shortText(state.current?.title||'',52)
        });
      }catch(_){}
    }else{
      // Never leave the new publisher without an audio clock.
      startMasterAudioGapBridgeR824(
        'r884-no-active-audio-source'
      );
    }

    publisherRecoveryCountR884++;

    state.transportHealthy=true;
    state.transportSelfHealPending=false;
    state.transportSelfHealCount=
      Number(state.transportSelfHealCount||0)+1;

    state.lastError='';
    state.lastWarning=
      `R884 publisher-only recovery OK #${
        publisherRecoveryCountR884
      }; radio/track preserved`;

    try{
      diagRecordR802(
        'r884-publisher-only-recovered',
        {
          reason:cleanText(reason).slice(-500),
          count:publisherRecoveryCountR884,
          clipLive:Boolean(clipLive)
        }
      );
    }catch(_){}

    console.error(
      '[r884-publisher-recovery]',
      'publisher recovered — Node/radio/track preserved'
    );

    return true;

  }catch(error){

    if(audioFrozenR1160H && audioSource){
      try{audioSource.resume()}catch(_){}
      audioFrozenR1160H=false;
      state.r884AudioFrozenR1160H=false;
    }

    state.lastError=
      `R884 publisher-only recovery failed: ${
        cleanText(error?.message||error)
      }`;

    console.error(
      '[r884-publisher-recovery]',
      'LOCAL RECOVERY FAILED — last-resort service rebuild:',
      state.lastError
    );

    // Only the final fallback is the old full rebuild.
    const t=setTimeout(()=>{
      if(!stopping)process.exit(78);
    },900);

    t.unref?.();

    return false;

  }finally{
    publisherRecoveryBusyR884=false;
  }
}


function scheduleOutputFatalRestartR780(rawLine,thisPublisher){
  if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return false;
  const line=cleanText(rawLine);
  if(!line || !OUTPUT_FATAL_REGEX_R780.test(line))return false;
  // R792: in dual-ingest mode a network/TLS/header failure from ONE tee slave is
  // recoverable and must never kill the common A/V master. True codec/mux
  // incompatibilities are still handled by this hard guard.
  if(DUAL_INGEST_ENABLED_R792 && TRANSPORT_FATAL_REGEX_R746.test(line) && !/incompatible with output codec|bitstream filter not found|invalid data found when processing input/i.test(line))return false;
  state.transportHealthy=false;
  state.transportSelfHealPending=true;
  state.lastOutputFatalAt=new Date().toISOString();
  state.lastOutputFatalReason=line.slice(-900);
  state.lastError=`R780 OUTPUT EGRESS FATAL: ${line.slice(-650)}`;
  console.error('[r780-output-egress-guard] FLV/RTMPS mux cannot publish; forcing clean service rebuild:',line);
  if(outputFatalTimerR780)return true;
  outputFatalTimerR780=setTimeout(()=>{
    outputFatalTimerR780=null;
    if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return;
    // R884: do NOT kill Node/radio for an RTMPS/FLV egress failure.
    // Recycle only the persistent publisher and reconnect live sources.
    recyclePublisherR884(
      line,
      thisPublisher,
      false
    ).catch(error=>{
      state.lastError=
        `R884 recovery dispatch failed: ${
          cleanText(error?.message||error)
        }`;
    });
  },900);
  outputFatalTimerR780.unref?.();
  return true;
}

function scheduleTransportSelfHealR746(rawLine,thisPublisher){
  if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return false;
  const line=cleanText(rawLine);
  if(!line || !TRANSPORT_FATAL_REGEX_R746.test(line))return false;
  if(DUAL_INGEST_ENABLED_R792){
    // One RTMPS lane can reconnect independently through tee+fifo while the other
    // keeps YouTube fed. Do not falsely mark the whole transport dead because a
    // single slave reported Broken pipe/TLS. If all slaves die, the master exits and
    // the existing publisher exit handler rebuilds the service.
    state.transportTransientCountR792=Number(state.transportTransientCountR792||0)+1;
    state.lastTransportTransientAtR792=new Date().toISOString();
    state.lastTransportTransientReasonR792=line.slice(-900);
    state.lastWarning=`R792 one RTMPS lane transient; redundant lane remains armed: ${line.slice(-420)}`;
    console.error('[r792-dual-ingest-lane] transient isolated to tee/fifo lane:',line);
    return true;
  }
  state.transportHealthy=false;
  state.transportSelfHealPending=true;
  state.transportSelfHealCount=Number(state.transportSelfHealCount||0)+1;
  state.lastTransportFatalAt=new Date().toISOString();
  state.lastTransportFatalReason=line.slice(-900);
  state.lastError=`R754 RTMPS/TLS transient: ${line.slice(-650)}`;
  // R754: FFmpeg's fifo muxer already has attempt_recovery/recover_any_error enabled.
  // R746 used to kill the whole service ~3.5 s after the first Broken pipe, which threw
  // away the fifo muxer's own reconnect attempt and restarted the MP3/visual unnecessarily.
  // From R754 the fifo gets first right of recovery. If the master truly cannot recover,
  // it exits on its own and the existing publisher 'exit' handler lets systemd rebuild it.
  if(transportFatalTimerR746)clearTimeout(transportFatalTimerR746);
  console.error('[r754-transport-fifo-first] transient RTMPS/TLS error; keeping master alive for fifo recovery:',line);
  transportFatalTimerR746=setTimeout(()=>{
    transportFatalTimerR746=null;
    if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return;
    state.transportHealthy=true;
    state.transportSelfHealPending=false;
    state.lastWarning='R754: RTMPS/TLS error window passed; persistent fifo/master stayed alive';
    console.error('[r754-transport-fifo-first] persistent master survived recovery window; no track restart');
  },12000);
  transportFatalTimerR746.unref?.();
  return true;
}

function masterBackpressureWatchdogTickR750(){
  if(stopping||!publisher||publisher.exitCode!==null){
    masterBackpressureSinceR750=0;
    masterBackpressureLastProgressAtR751=0;
    masterBackpressureAudioBytesR751=0;
    masterBackpressureVideoBytesR751=0;
    state.publisherBackpressureSince=null;
    return;
  }
  const audioSink=publisher?.stdio?.[3];
  const videoSink=publisher?.stdio?.[4];
  const blocked=Boolean(
    audioSink?.writableNeedDrain || videoSink?.writableNeedDrain ||
    Number(audioSink?.writableLength||0)>Math.max(32768,Number(audioSink?.writableHighWaterMark||0)) ||
    Number(videoSink?.writableLength||0)>Math.max(32768,Number(videoSink?.writableHighWaterMark||0))
  );
  const now=Date.now();
  const audioBytes=Number(audioSink?.bytesWritten||0);
  const videoBytes=Number(videoSink?.bytesWritten||0);
  const progressed=audioBytes>masterBackpressureAudioBytesR751 || videoBytes>masterBackpressureVideoBytesR751;
  masterBackpressureAudioBytesR751=audioBytes;
  masterBackpressureVideoBytesR751=videoBytes;

  // R751: writableNeedDrain is NORMAL on a paced FFmpeg pipe. Never restart merely
  // because Node reports backpressure. Restart only when the blocked pipe makes ZERO
  // byte progress for the full guard window.
  if(!blocked){
    masterBackpressureSinceR750=0;
    masterBackpressureLastProgressAtR751=now;
    state.publisherBackpressureSince=null;
    return;
  }
  if(progressed){
    masterBackpressureSinceR750=now;
    masterBackpressureLastProgressAtR751=now;
    state.publisherBackpressureSince=new Date(now).toISOString();
    return;
  }
  if(!masterBackpressureSinceR750){
    masterBackpressureSinceR750=now;
    masterBackpressureLastProgressAtR751=now;
    state.publisherBackpressureSince=new Date(now).toISOString();
    return;
  }
  const noProgressMs=now-Math.max(masterBackpressureLastProgressAtR751||masterBackpressureSinceR750,masterBackpressureSinceR750);
  if(noProgressMs<MASTER_BACKPRESSURE_STUCK_MS_R750)return;
  state.transportHealthy=false;
  state.transportSelfHealPending=true;
  state.publisherBackpressureRecoveries=Number(state.publisherBackpressureRecoveries||0)+1;
  state.lastPublisherBackpressureAt=new Date().toISOString();
  state.lastTransportFatalAt=state.lastPublisherBackpressureAt;
  state.lastTransportFatalReason=`R751 master pipe NO-PROGRESS ${noProgressMs}ms`;
  state.lastError=`R751 STREAM STALL: ${state.lastTransportFatalReason}`;
  console.error('[r751-stream-health]',state.lastError,'— R1146 requests R884 publisher-only recovery');

  // R1146: R751 already proved a REAL master-pipe stall: the pipe is blocked
  // AND neither raw PCM nor rawvideo has advanced for the full 30-second guard.
  // R826C used to suppress this forever. That preserved the playlist but could
  // leave a dead persistent publisher running indefinitely (RTMPS 0/2, frozen
  // viewer, later media appearing to overlap). Escalate ONLY this proven hard
  // stall to the existing R884 publisher-only recovery. R884 preserves Node,
  // queue and the currently-live decoder/clip and reconnects those SAME sources
  // to a fresh persistent H264/AAC master. Whole-service exit remains R884's
  // last-resort fallback only if local publisher recovery itself fails.
  diagRecordR802(
    'r1146-master-hard-stall-detected',
    {
      reason:state.lastTransportFatalReason||state.lastError||'master-no-progress',
      publisherPid:Number(publisher?.pid||0),
      audioBytes:masterBackpressureAudioBytesR751,
      videoBytes:masterBackpressureVideoBytesR751,
      audioWritableLength:Number(publisher?.stdio?.[3]?.writableLength||0),
      videoWritableLength:Number(publisher?.stdio?.[4]?.writableLength||0),
      clipActive:Boolean(clipActive),
      current:state.current?.title||'',
      next:state.next?.title||''
    }
  );

  // Arm a fresh 30-second evidence window immediately. This prevents the 1 Hz
  // watchdog from dispatching duplicate recoveries while R884 is rebuilding.
  masterBackpressureSinceR750=now;
  masterBackpressureLastProgressAtR751=now;

  if(masterHardRecoveryBusyR1146 || publisherRecoveryBusyR884){
    state.lastWarning='R1146 hard stall confirmed; publisher recovery already in progress';
    return;
  }

  masterHardRecoveryBusyR1146=true;
  const oldPublisherR1146=publisher;
  const reasonR1146=state.lastTransportFatalReason;
  state.lastWarning='R1146 hard master stall confirmed; recycling publisher only';

  diagRecordR802('r1146-publisher-recycle-request',{
    publisherPid:Number(oldPublisherR1146?.pid||0),
    reason:reasonR1146,
    clipActive:Boolean(clipActive),
    stationHandoffActive:Boolean(stationHandoffActiveR804)
  });

  Promise.resolve().then(async()=>{
    try{
      const ok=await recyclePublisherR884(
        reasonR1146,
        oldPublisherR1146,
        false
      );

      if(ok){
        state.lastError='';
        state.transportHealthy=true;
        state.transportSelfHealPending=false;
        diagRecordR802('r1146-publisher-recycle-ok',{
          oldPublisherPid:Number(oldPublisherR1146?.pid||0),
          newPublisherPid:Number(publisher?.pid||0),
          clipActive:Boolean(clipActive),
          current:state.current?.title||''
        });
      }else if(publisherRecoveryDeferredR1084){
        diagRecordR802('r1146-publisher-recycle-deferred',{
          reason:reasonR1146,
          current:state.current?.title||''
        });
      }else{
        // A concurrent R884 may have won the race. Do NOT kill the service here;
        // the next R751 evidence window will retry only if the fresh publisher
        // is still truly blocked for another full guard period.
        state.lastWarning='R1146 recycle not started; waiting for fresh stall evidence';
        diagRecordR802('r1146-publisher-recycle-not-started',{
          publisherPid:Number(publisher?.pid||0),
          recoveryBusy:Boolean(publisherRecoveryBusyR884)
        });
      }
    }catch(error){
      state.lastError=`R1146 recovery dispatch failed: ${cleanText(error?.message||error)}`;
      diagRecordR802('r1146-publisher-recycle-error',{
        error:cleanText(error?.message||error)
      });
    }finally{
      masterHardRecoveryBusyR1146=false;
    }
  });

  return;
}

function countEstablishedRtmpsR792(){
  return new Promise(resolve=>{
    let out='';let done=false;
    const child=spawn('ss',['-tnp'],{stdio:['ignore','pipe','ignore']});
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(Number(value)||0);};
    const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch(_){ }finish(0);},2500);
    child.stdout?.on('data',d=>{out+=String(d||'');if(out.length>300000)out=out.slice(-300000);});
    child.once('error',()=>finish(0));
    child.once('exit',()=>{
      const count=out.split(/\n/).filter(line=>/^ESTAB\s/.test(line)&&/:443\b/.test(line)&&/ffmpeg/.test(line)).length;
      finish(count);
    });
  });
}

async function rtmpsEgressWatchdogTickR792(){
  if(stopping||rtmpsEgressWatchBusyR792||!publisher||publisher.exitCode!==null||!/^rtmps:/i.test(STREAM_URL))return;
  rtmpsEgressWatchBusyR792=true;
  try{
    const count=await countEstablishedRtmpsR792();
    state.rtmpsEstablishedConnectionsR792=count;
    state.rtmpsExpectedConnectionsR792=expectedRtmpsConnectionsR1287();
    if(count>0){
      // R830D RTMPS RECOVERY HEALTH
      state.transportHealthy=true;
      state.transportSelfHealPending=false;
      rtmpsEgressEverObservedR792=true;
      state.rtmpsEgressEverObservedR792=true;
      rtmpsEgressZeroSinceR792=0;
      state.rtmpsZeroSinceR792=null;
      return;
    }
    // Never create a restart loop on hosts where unprivileged ss cannot expose the
    // child process name. The hard zero-egress restart becomes active only after this
    // exact publisher has successfully observed at least one real ffmpeg RTMPS socket.
    if(!rtmpsEgressEverObservedR792){
      state.rtmpsEgressEverObservedR792=false;
      state.lastWarning='R792 RTMPS egress probe has not observed a socket yet; hard watchdog not armed';
      return;
    }
    const now=Date.now();
    if(!rtmpsEgressZeroSinceR792){
      rtmpsEgressZeroSinceR792=now;
      state.rtmpsZeroSinceR792=new Date(now).toISOString();
      state.lastWarning='R792 RTMPS egress watchdog: 0 established lanes; recovery grace started';
      return;
    }
    const age=now-rtmpsEgressZeroSinceR792;
    if(age<RTMPS_EGRESS_ZERO_GRACE_MS_R792)return;
    state.transportHealthy=false;
    state.lastTransportFatalAt=new Date().toISOString();
    state.lastTransportFatalReason=`R792 zero RTMPS ESTAB for ${age}ms`;
    state.lastError=`R792 RTMPS EGRESS LOST: ${state.lastTransportFatalReason}`;
    console.error('[r792-egress-watchdog]',state.lastError,'— rebuilding persistent master/service');
    diagRecordR802(
      'r830d-r792-whole-service-kill-suppressed',
      {
        age,
        rtmps:count
      }
    );

    console.error(
      '[r830d-r792-protect]',
      state.lastError,
      '— whole radio restart BLOCKED; FIFO recovery continues'
    );

    // Do NOT reset Node, MP3 queue, video feeder or titles.
    // FFmpeg tee/fifo recovery remains active.
    state.transportSelfHealPending=true;

    state.lastWarning=
      `R830D RTMPS ${count}/${state.rtmpsExpectedConnectionsR792||2}; `+
      `FIFO recovery continues without radio restart`;

    // Start another observation window instead of killing the service.
    rtmpsEgressZeroSinceR792=Date.now();

    state.rtmpsZeroSinceR792=
      new Date(
        rtmpsEgressZeroSinceR792
      ).toISOString();

    return;
  }finally{rtmpsEgressWatchBusyR792=false;}
}


// ============================================================
// R1124-SILENT-RTMPS-PROGRESS-WATCHDOG
//
// Freeze signature observed 2026-09-21:
// - Node alive, playlist alive
// - MP3 decoder alive
// - visual feeder alive
// - publisher FFmpeg alive and encoding
// - RTMPS still reports ESTAB 2/2
// - viewer receives no fresh media and loops the last segment
//
// A visual-feeder restart cannot repair that state because the feeder is already
// producing frames. R1124 watches real TCP ACK progress of the publisher's :443
// sockets. Twenty seconds with no aggregate ACK progress triggers the existing
// R884 publisher-only recovery. Node/queue/current decoder/video feeder stay alive.
// ============================================================

function readPublisherTcpAckProgressR1124(){
  return new Promise(resolve=>{
    const pubPid=Number(publisher?.pid||0);
    if(!pubPid)return resolve(null);

    let out='';
    let done=false;
    const child=spawn('ss',['-tinp'],{stdio:['ignore','pipe','ignore']});

    const finish=value=>{
      if(done)return;
      done=true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer=setTimeout(()=>{
      try{child.kill('SIGKILL')}catch(_){}
      finish(null);
    },2500);

    child.stdout?.on('data',d=>{
      out+=String(d||'');
      if(out.length>800000)out=out.slice(-800000);
    });

    child.once('error',()=>finish(null));

    child.once('exit',()=>{
      try{
        const lines=out.split(/\n/);
        let lanes=0;
        let ackedTotal=0;
        let sentTotal=0;
        let haveAck=false;

        for(let i=0;i<lines.length;i++){
          const line=String(lines[i]||'').trim();
          if(!/^ESTAB\s/.test(line))continue;
          if(!/:443\b/.test(line))continue;
          if(!new RegExp(`pid=${pubPid}\\b`).test(line))continue;

          lanes++;
          let info='';
          for(let j=i+1;j<lines.length;j++){
            const next=String(lines[j]||'');
            if(/^(?:ESTAB|LISTEN|SYN-SENT|SYN-RECV|FIN-WAIT-1|FIN-WAIT-2|TIME-WAIT|CLOSE|CLOSE-WAIT|LAST-ACK|CLOSING)\s/.test(next.trim()))break;
            info+=' '+next.trim();
          }

          const ack=/\bbytes_acked:(\d+)/.exec(info);
          const sent=/\bbytes_sent:(\d+)/.exec(info);
          if(ack){
            haveAck=true;
            ackedTotal+=Number(ack[1])||0;
          }
          if(sent)sentTotal+=Number(sent[1])||0;
        }

        finish({
          publisherPid:pubPid,
          lanes,
          haveAck,
          ackedTotal,
          sentTotal
        });
      }catch(_){
        finish(null);
      }
    });
  });
}

async function rtmpsProgressWatchdogTickR1124(){
  if(
    stopping ||
    rtmpsProgressWatchBusyR1124 ||
    !publisher ||
    publisher.exitCode!==null ||
    !/^rtmps:/i.test(STREAM_URL)
  )return;

  rtmpsProgressWatchBusyR1124=true;

  try{
    const snap=await readPublisherTcpAckProgressR1124();
    if(!snap||!snap.haveAck||snap.lanes<1){
      state.rtmpsProgressProbeAvailableR1124=false;
      return;
    }

    state.rtmpsProgressProbeAvailableR1124=true;
    state.rtmpsProgressLanesR1124=Number(snap.lanes||0);
    state.rtmpsProgressAckedBytesR1124=Number(snap.ackedTotal||0);

    const now=Date.now();
    const pubPid=Number(snap.publisherPid||0);
    const acked=Number(snap.ackedTotal||0);

    // New publisher / new TCP counters => establish a fresh baseline.
    if(
      rtmpsProgressPublisherPidR1124!==pubPid ||
      rtmpsProgressLastAckedR1124<0 ||
      acked<rtmpsProgressLastAckedR1124
    ){
      rtmpsProgressPublisherPidR1124=pubPid;
      rtmpsProgressLastAckedR1124=acked;
      rtmpsProgressLastAtR1124=now;
      state.rtmpsProgressLastAtR1124=new Date(now).toISOString();
      return;
    }

    if(acked>rtmpsProgressLastAckedR1124){
      rtmpsProgressLastAckedR1124=acked;
      rtmpsProgressLastAtR1124=now;
      state.rtmpsProgressLastAtR1124=new Date(now).toISOString();
      state.rtmpsProgressStallMsR1124=0;
      return;
    }

    if(!rtmpsProgressLastAtR1124){
      rtmpsProgressLastAtR1124=now;
      return;
    }

    const stalledMs=now-rtmpsProgressLastAtR1124;
    state.rtmpsProgressStallMsR1124=stalledMs;

    if(stalledMs<RTMPS_PROGRESS_STALL_MS_R1124)return;

    // Never tear down an active R1123 insert or a visual handoff. Retry on the
    // next 5-second tick as soon as the boundary is quiet.
    if(clipActive||stationHandoffActiveR804||visualSwitching){
      state.lastWarning=`R1124 silent RTMPS stall ${stalledMs}ms; publisher recycle deferred until media boundary is quiet`;
      return;
    }

    if(rtmpsProgressRecoveryBusyR1124||publisherRecoveryBusyR884)return;

    state.transportHealthy=false;
    state.transportSelfHealPending=true;
    state.lastTransportFatalAt=new Date().toISOString();
    state.lastTransportFatalReason=`R1124 RTMPS ACK NO-PROGRESS ${stalledMs}ms`;
    state.lastError=`R1124 SILENT STREAM STALL: ${state.lastTransportFatalReason}`;

    diagRecordR802('r1124-silent-rtmps-stall',{
      publisherPid:pubPid,
      lanes:Number(snap.lanes||0),
      stalledMs,
      ackedBytes:acked,
      current:state.current?.title||'',
      next:state.next?.title||''
    });

    rtmpsProgressRecoveryBusyR1124=true;

    try{
      const old=publisher;
      const reason=state.lastTransportFatalReason;

      diagRecordR802('r1124-publisher-only-recycle-start',{
        publisherPid:Number(old?.pid||0),
        stalledMs,
        reason
      });

      const ok=await recyclePublisherR884(reason,old,false);

      diagRecordR802(
        ok?'r1124-publisher-only-recycle-ok':'r1124-publisher-only-recycle-failed',
        {
          oldPublisherPid:pubPid,
          newPublisherPid:Number(publisher?.pid||0),
          current:state.current?.title||''
        }
      );

      // Always reset the probe after a recycle attempt. The next publisher/socket
      // gets a new baseline and cannot immediately retrigger on old counters.
      rtmpsProgressPublisherPidR1124=Number(publisher?.pid||0);
      rtmpsProgressLastAckedR1124=-1;
      rtmpsProgressLastAtR1124=Date.now();
      state.rtmpsProgressStallMsR1124=0;

    }finally{
      rtmpsProgressRecoveryBusyR1124=false;
    }

  }finally{
    rtmpsProgressWatchBusyR1124=false;
  }
}


function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }
  if(publisher&&publisher.exitCode===null)return true;
  prepareCacheDir();
  if(!existsSync(LIVE_TICKER_FILE))writeFileSync(LIVE_TICKER_FILE,DEFAULT_LIVE_TICKER,'utf8');
  ensureTickerRasterR1221();
  ensureTickerMotionR1222();
  if(!existsSync(LIVE_CURRENT_FILE))writeFileSync(LIVE_CURRENT_FILE,'ANDRIK','utf8');

  state.videoTimestampOffsetSecondsR787=0;

  // R1278: allocate a fresh reliable encoded reservoir for this publisher, then
  // start/attach the RTMPS relay. No localhost UDP exists in the live A/V path.
  resetEncodedTransportReservoirR1278();
  ensureTransportRelaysR1125();

  const outputArgsR792=['-f','mpegts','-mpegts_flags','+resend_headers','pipe:1'];

  // R816: the publisher is the ONLY live H.264 encoder. Its rawvideo demuxer owns a
  // single 25fps frame counter for the entire service lifetime. MP3/clip/station feeder
  // changes cannot reset H.264 DPB/GOP/SPS/PPS state because they occur before encoding.
  const args=[
    '-hide_banner','-loglevel','warning',
    // R820 ROOT STALL FIX: raw pipes are timestamp-less byte streams. Give BOTH inputs an
    // explicit generated clock, then rebuild PTS from frame/sample counters before encoding.
    // This prevents tee/fifo from ever receiving AV_NOPTS packets (the repeated R816 failure).
    '-thread_queue_size',String(VIDEO_INPUT_QUEUE_PACKETS_R732),'-fflags','+genpts+discardcorrupt','-f','rawvideo','-pix_fmt','yuv420p','-s:v','1920x1080','-framerate',String(VIDEO_FPS),'-i','pipe:4',
    '-thread_queue_size',String(AUDIO_INPUT_QUEUE_PACKETS_R732),'-fflags','+genpts+discardcorrupt','-f','s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-i','pipe:3',
    '-filter_complex',`[0:v]settb=expr=1/90000,setpts=N/(${VIDEO_FPS}*TB)[r820v];[1:a]asettb=expr=1/${AUDIO_SAMPLE_RATE},asetpts=N/SR/TB[r820a]`,
    '-map','[r820v]','-map','[r820a]',
    // R819 geometry/fade stays upstream untouched. R820 changes timestamps only.
    ...h264EncoderArgsR721(),'-fps_mode:v','cfr','-enc_time_base:v',`1:${VIDEO_FPS}`,'-threads:v','1','-tag:v','7',
    '-c:a','aac','-profile:a','aac_low','-b:a',AUDIO_BITRATE,'-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-tag:a','10',
    '-max_muxing_queue_size','4096','-flush_packets','1',
    ...outputArgsR792
  ];

  const thisPublisher=spawn('ffmpeg',args,{stdio:['ignore','pipe','pipe','pipe','pipe']});
  publisher=thisPublisher;
  if(!bindEncodedTransportPublisherR1278(thisPublisher)){
    try{thisPublisher.kill('SIGKILL')}catch(_){}
    publisher=null;
    state.publisherRunning=false;
    state.lastError='R1278 encoded master pipe unavailable';
    return false;
  }
  state.publisherRunning=true;
  state.transportHealthy=true;
  state.transportSelfHealPending=false;
  rtmpsEgressZeroSinceR792=0;
  rtmpsEgressEverObservedR792=false;
  state.rtmpsEgressEverObservedR792=false;
  state.youtubeDualIngestEnabled=DUAL_INGEST_ENABLED_R792;
  state.youtubeBackupIngestArmed=Boolean(DUAL_INGEST_ENABLED_R792&&STREAM_BACKUP_URL);
  state.transportArchitectureR1125='R1281-DUAL-INDEPENDENT-TS-PIPE-RESERVOIRS->RTMPS-A+B';
  state.masterVideoClockMode=`R1278-R1212-6M-GOP50-X264-1THREAD-NOSLICES-CLOSEDGOP-R820-PTS-${VIDEO_FPS}FPS-QUEUE${VIDEO_INPUT_QUEUE_PACKETS_R732}`;
  state.audioCpuHeadroomR1273='R1277-PREPARED-ALBUM-BED+X264-1THREAD+MP3-FEEDER-1THREAD';
  state.albumPreparedVisualModeR1277='16S-AVC420-CLOSEDGOP-TICKER-BAKED+NO-LIVE-CACHE-REBUILD';
  state.localTransportShieldR1277='SUPERSEDED-BY-R1278-RELIABLE-PIPE';
  state.localTransportR1278=`R1281-DUAL-PIPE+2x${Math.round(R1278_ENCODED_RESERVOIR_BYTES/1024/1024)}M-RESERVOIR+MPEGTS-RESEND-HEADERS`;
  state.musicClipRelayR1284='RESTORED-BYTE-IDENTICAL-R1278-R1280-R1123-RELAY';
  if(!state.streamStartedAt)state.streamStartedAt=new Date().toISOString();
  const audioSink=thisPublisher.stdio[3];
  const videoSink=thisPublisher.stdio[4];

  // R1085-AUDIO-MASTER-2.0
  // The persistent PCM byte count is the master media clock. Video is corrected
  // ONLY at the final rawvideo -> persistent publisher boundary, below every
  // R816/R821 handoff. No feeder is paused by sync policy, no audio samples are
  // stretched/resampled, and AV2000 remains the calibrated pipeline lead.
  //
  // 44.1 kHz stereo s16le = 176400 bytes/s. 25 fps = 40 ms/frame.
  // Desired raw-input relationship for the proven 96/96 queues: audio is about
  // 2.0 s ahead of video. A small dead-band prevents correction chatter.
  const r1085={
    audioBytes:0,
    videoFrames:0,
    actualVideoFramesR1160K:0, // diagnostic only: never rebased by R1160G
    targetAudioLeadSec:2.000,
    deadbandSec:0.080,
    armed:false,
    lastFrame:null,
    dropped:0,
    duplicated:0,
    externalPacedVideoR1123:false,
    externalPacedFramesR1123:0,
    normalMp3EdgePassThroughR1150:false,
    normalVisualPassThroughR1160L:false,
    normalVisualFramesR1160L:0,
    transitionPassThroughR1147:false,
    transitionPassThroughUntilR1147:0,
    transitionPassFramesR1147:0,
    transitionPassThroughR1148:false,
    transitionPassThroughUntilR1148:0,
    transitionPassFramesR1148:0,
    transitionPassArmLeadMsR1148:0,
    transitionReleaseVideoFrameR1148:0,
    transitionReleaseChildPidR1148:0,
    originalAudioWrite:audioSink.write.bind(audioSink),
    originalVideoWrite:videoSink.write.bind(videoSink)
  };
  thisPublisher.__r1085AudioMaster=r1085;
  state.audioMasterMode='R1272-MP3-2S-PCM-RESERVOIR+R1160L-REAL-COUNTERS+R1123-CLIP-PCM-PACER';
  state.audioMasterTargetLeadMsR1085=2000;
  state.audioMasterDeadbandMsR1085=80;
  state.audioInputQueuePacketsR1160J=AUDIO_INPUT_QUEUE_PACKETS_R732;

  audioSink.write=function r1085AudioMasterWrite(chunk,...args){
    const bytes=Buffer.isBuffer(chunk)||ArrayBuffer.isView(chunk)
      ? Number(chunk.byteLength||chunk.length||0)
      : Buffer.byteLength(String(chunk||''));
    const ok=r1085.originalAudioWrite(chunk,...args);
    if(bytes>0){
      r1085.audioBytes+=bytes;
      if(r1085.audioBytes >= AUDIO_SAMPLE_RATE*4*r1085.targetAudioLeadSec){
        r1085.armed=true;
      }
      state.audioMasterAudioSecondsR1085=Number((r1085.audioBytes/(AUDIO_SAMPLE_RATE*4)).toFixed(3));
    }
    return ok;
  };

  videoSink.write=function r1085VideoFollowerWrite(chunk,...args){
    const isFrame=Boolean(chunk && Number(chunk.length||chunk.byteLength||0)===VIDEO_FRAME_BYTES_R816);
    if(!isFrame || !r1085.armed){
      const ok=r1085.originalVideoWrite(chunk,...args);
      if(isFrame){
        r1085.videoFrames++; r1085.actualVideoFramesR1160K++;
        r1085.lastFrame=chunk; // R1160K: retain immutable full frame; no extra 3.11 MB copy
      }
      return ok;
    }

    const audioSec=r1085.audioBytes/(AUDIO_SAMPLE_RATE*4);
    const videoSec=r1085.videoFrames/VIDEO_FPS;
    const lead=audioSec-videoSec;
    state.audioMasterLeadMsR1085=Math.round(lead*1000);

    // R1123: during a paced insert, the R1085 PCM clock is still the master,
    // but only ONE controller is allowed to correct phase. R1123 schedules
    // source frames from these exact counters, so suppress R1085's synthetic
    // DROP/DUP for those insert frames only. Normal MP3 video keeps the proven
    // R1085 DROP/DUP behavior unchanged.
    // R1147: station tail -> BLACK -> first MP3 frame is an ownership-critical
    // boundary. R1145 made the rawvideo handoff atomic, but R1085 sits BELOW that
    // handoff and could still DROP the first black frame or DUP the previous station
    // frame according to phase. During this short boundary lock, pass every complete
    // frame exactly once. The normal R1085 DROP/DUP controller resumes only after the
    // first complete MP3 reveal frame has replaced BLACK.
    if(r1085.transitionPassThroughR1147 &&
       Date.now()>Number(r1085.transitionPassThroughUntilR1147||0)){
      r1085.transitionPassThroughR1147=false;
      r1085.transitionPassThroughUntilR1147=0;
      state.stationBlackMasterLockActiveR1147=false;
      diagRecordR802('r1147-station-black-master-lock-timeout',{
        leadMs:Math.round((r1085.audioBytes/(AUDIO_SAMPLE_RATE*4)-r1085.videoFrames/VIDEO_FPS)*1000)
      });
    }

    // R1148: MP3->MP3 cinematic frames must not be altered below the feeder.
    // The OLD feeder arms this lock on the exact first fade-out frame; the NEW
    // feeder releases it only after its 2.40s fade-in mask is fully transparent.
    // Therefore R1085 cannot DROP fade frames, DUP a stale picture, or eat the
    // intentional BLACK hold. Audio remains the master and is never modified.
    if(r1085.transitionPassThroughR1148 &&
       Date.now()>Number(r1085.transitionPassThroughUntilR1148||0)){
      const timeoutFramesR1148=Number(r1085.transitionPassFramesR1148||0);
      const timeoutTargetR1148=Number(r1085.transitionReleaseVideoFrameR1148||0);
      const timeoutChildPidR1148=Number(r1085.transitionReleaseChildPidR1148||0);
      r1085.transitionPassThroughR1148=false;
      r1085.transitionPassThroughUntilR1148=0;
      r1085.transitionPassArmLeadMsR1148=0;
      r1085.transitionReleaseVideoFrameR1148=0;
      r1085.transitionReleaseChildPidR1148=0;
      state.mp3CinematicMasterLockActiveR1148=false;
      diagRecordR802('r1148-mp3-cinematic-master-lock-timeout',{
        frames:timeoutFramesR1148,
        targetVideoFrame:timeoutTargetR1148,
        candidatePid:timeoutChildPidR1148,
        leadMs:Math.round((r1085.audioBytes/(AUDIO_SAMPLE_RATE*4)-r1085.videoFrames/VIDEO_FPS)*1000)
      });
    }

    if(r1085.normalVisualPassThroughR1160L || r1085.externalPacedVideoR1123 || r1085.normalMp3EdgePassThroughR1150 || r1085.transitionPassThroughR1147 || r1085.transitionPassThroughR1148){
      const curOk=r1085.originalVideoWrite(chunk,...args);
      r1085.videoFrames++; r1085.actualVideoFramesR1160K++;
      r1085.lastFrame=chunk; // R1160K: retain immutable full frame; no extra 3.11 MB copy
      if(r1085.normalVisualPassThroughR1160L){r1085.normalVisualFramesR1160L++;state.normalVisualFramesR1160L=r1085.normalVisualFramesR1160L;}
      if(r1085.externalPacedVideoR1123){
        r1085.externalPacedFramesR1123++;
        state.audioMasterExternalPacedFramesR1123=r1085.externalPacedFramesR1123;
      }
      if(r1085.transitionPassThroughR1147){
        r1085.transitionPassFramesR1147++;
        state.stationBlackMasterLockFramesR1147=r1085.transitionPassFramesR1147;
      }
      if(r1085.transitionPassThroughR1148){
        r1085.transitionPassFramesR1148++;
        state.mp3CinematicMasterLockFramesR1148=r1085.transitionPassFramesR1148;
      }
      state.audioMasterVideoSecondsR1085=Number((r1085.videoFrames/VIDEO_FPS).toFixed(3));
      state.audioMasterLeadMsR1085=Math.round((r1085.audioBytes/(AUDIO_SAMPLE_RATE*4)-r1085.videoFrames/VIDEO_FPS)*1000);

      // R1148C: release is owned by the persistent R1085 master frame counter,
      // not by a feeder-local relay counter. The target is armed atomically when
      // the incoming MP3 feeder is promoted, so feeder replacement cannot lose
      // the release condition. Audio remains untouched.
      if(r1085.transitionPassThroughR1148 &&
         Number(r1085.transitionReleaseVideoFrameR1148||0)>0 &&
         r1085.videoFrames>=Number(r1085.transitionReleaseVideoFrameR1148||0)){
        releaseMp3CinematicMasterLockR1148(null,{frames:Number(r1085.transitionPassFramesR1148||0)},'master-frame-target-r1148c');
      }
      return curOk;
    }

    // Video is ahead of the calibrated audio-master relationship: consume the
    // source frame but do not advance the persistent video clock this turn.
    // Returning true is deliberate: the feeder/handoff is NEVER stalled here.
    if(lead < r1085.targetAudioLeadSec-r1085.deadbandSec){
      r1085.dropped++;
      state.audioMasterVideoDropsR1085=r1085.dropped;
      return true;
    }

    let ok=true;
    // Video is behind audio. Advance by at most one extra frame per source frame.
    // Only duplicate when the real publisher pipe has room; otherwise normal
    // Node backpressure wins and no synthetic queue is created.
    if(lead > r1085.targetAudioLeadSec+r1085.deadbandSec &&
       r1085.lastFrame && !videoSink.writableNeedDrain &&
       Number(videoSink.writableLength||0) < Number(videoSink.writableHighWaterMark||0)){
      const dupOk=r1085.originalVideoWrite(r1085.lastFrame);
      r1085.videoFrames++; r1085.actualVideoFramesR1160K++;
      r1085.duplicated++;
      state.audioMasterVideoDuplicatesR1085=r1085.duplicated;
      ok=dupOk;
    }

    const curOk=r1085.originalVideoWrite(chunk,...args);
    r1085.videoFrames++; r1085.actualVideoFramesR1160K++;
    r1085.lastFrame=chunk; // R1160K: retain immutable full frame; no extra 3.11 MB copy
    state.audioMasterVideoSecondsR1085=Number((r1085.videoFrames/VIDEO_FPS).toFixed(3));
    state.audioMasterLeadMsR1085=Math.round((r1085.audioBytes/(AUDIO_SAMPLE_RATE*4)-r1085.videoFrames/VIDEO_FPS)*1000);
    return Boolean(ok&&curOk);
  };

  for(const [label,sink] of [['audio',audioSink],['video',videoSink]]){
    sink.on('error',err=>{
      if(!stopping&&!/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(err?.code||err?.message||err)))state.lastError=`${label}-pipe: ${String(err)}`;
    });
  }
  thisPublisher.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/DTS .*out of order|timestamp discontinuity|non[- ]monoton|unset in a packet/i.test(line)){
        state.masterTimestampErrorCount=Number(state.masterTimestampErrorCount||0)+1;
        state.lastMasterTimestampErrorAt=new Date().toISOString();
      }
      const dualLaneTransportTransientR792=DUAL_INGEST_ENABLED_R792&&TRANSPORT_FATAL_REGEX_R746.test(line);
      if(!dualLaneTransportTransientR792&&/error|fail|invalid|broken pipe|non-monoton|unset in a packet|incompatible with output codec|DTS .*out of order|timestamp discontinuity/i.test(line))state.lastError=line.slice(-700);
      const hardOutputFatal=scheduleOutputFatalRestartR780(line,thisPublisher);
      if(!hardOutputFatal)scheduleTransportSelfHealR746(line,thisPublisher);
      if(diagFfmpegR802('master-r816',line)!==false)console.error('[master-r816]',line);
    }
  });
  thisPublisher.on('exit',(code,signal)=>{
    if(encodedTransportPublisherSourceR1278===thisPublisher.stdout){
      if(encodedTransportPublisherDataHandlerR1281){
        try{thisPublisher.stdout.off('data',encodedTransportPublisherDataHandlerR1281)}catch(_){}
      }
      if(encodedTransportPublisherErrorHandlerR1281){
        try{thisPublisher.stdout.off('error',encodedTransportPublisherErrorHandlerR1281)}catch(_){}
      }
      encodedTransportPublisherSourceR1278=null;
      encodedTransportPublisherDataHandlerR1281=null;
      encodedTransportPublisherErrorHandlerR1281=null;
    }
    const isCurrent=publisher===thisPublisher;
    if(isCurrent){
      publisher=null;state.publisherRunning=false;state.transportHealthy=false;state.transportSelfHealPending=false;
      if(transportFatalTimerR746){clearTimeout(transportFatalTimerR746);transportFatalTimerR746=null;}
      if(outputFatalTimerR780){clearTimeout(outputFatalTimerR780);outputFatalTimerR780=null;}
    }
    if(isCurrent&&!stopping){
      state.lastExit={
        layer:'persistent-master-r816',
        code,
        signal,
        at:new Date().toISOString()
      };

      if(thisPublisher.__r884TransportRecycle){
        // Planned R884 publisher recycle.
        // The recovery coroutine will create the replacement.
        state.lastWarning=
          'R884 planned publisher exit; whole radio kept alive';
      }else{
        // Unexpected publisher exit: try one local replacement first.
        // Full service rebuild exists only inside R884 as final fallback.
        const t=setTimeout(()=>{
          recyclePublisherR884(
            `unexpected publisher exit code=${
              code??'null'
            } signal=${signal??''}`,
            thisPublisher,
            true
          ).catch(error=>{
            state.lastError=
              `R884 unexpected-exit recovery dispatch failed: ${
                cleanText(error?.message||error)
              }`;
          });
        },150);

        t.unref?.();
      }
    }
  });
  thisPublisher.on('error',err=>{if(publisher===thisPublisher)state.lastError=String(err);});
  return true;
}

// R1011B: one master cycle starts from frame zero for every normal feeder.
async function visualLoopOffsetR735(visual){
  state.visualLoopOffsetSeconds=0;
  return 0;
}

function normalVideoFeederArgsR721(visualPath,eqPath,{fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,visualOffsetSeconds=0,previewReload=false,boundaryTitleSwitchAt=0,mp3Boundary=false}={}){
  const visualSeek=Number(visualOffsetSeconds)>0.05?['-ss',Number(visualOffsetSeconds).toFixed(3)]:[];
  const fullWidthTickerR1213=isFiveAlbumBackgroundR1213(visualPath);
  const preparedAlbumBedR1277=isPreparedAlbumBedR1277(visualPath);
  if(fullWidthTickerR1213 && !preparedAlbumBedR1277 && !MP3_TICKER_DISABLED_R1269)prepareTickerPagesR1246();

  // R1277 overrides the historical R1232 live-ticker rule for the five albums:
  // their 16s ticker cycle is now baked once into the prepared AVC/yuv420p bed.
  // Fallback/static/extras paths retain the legacy final-stage ticker behavior.
  const tickerBakedFullFrameR1224=false;
  const effectiveVisualPathR1224=visualPath;
  const staticBackgroundR1214=isStaticBackgroundR1211(effectiveVisualPathR1224);
  const probedProfileR1214=visualFastProfileR1132(effectiveVisualPathR1224);
  // R1255: normalized album JPGs are already exactly 1920x1080. Their one decoded
  // frame is looped at exact 25fps by the realtime filter below, so do not add an
  // fps conversion or geometry scaler that can reintroduce bursty frame delivery.
  const fastProfileR1132=staticBackgroundR1214
    ? {...probedProfileR1214,geometryExact:true,fpsExact:true}
    : probedProfileR1214;

  // R1277 prepared album bed already owns the ticker. The old QR input was not
  // composited by the MP3 graph at all, so do not decode it needlessly. Keep only
  // the two 420px CTA sources whose cadence is track-relative (20s, then 120s).
  const decorativeInputsR1132=preparedAlbumBedR1277
    ? [
        '-loop','1','-framerate','1','-i',CTA_OVERLAY_LIVE_R794,
        '-loop','1','-framerate','1','-i',CTA_LIKE_OVERLAY_LIVE_R794
      ]
    : [
        '-loop','1','-framerate','1','-i',QR_OVERLAY_LIVE_R794,
        '-loop','1','-framerate','1','-i',CTA_OVERLAY_LIVE_R794,
        '-loop','1','-framerate','1','-i',CTA_LIKE_OVERLAY_LIVE_R794
      ];
  const ctaSubscribeInputIndexR1277=preparedAlbumBedR1277?1:2;
  const ctaLikeInputIndexR1277=preparedAlbumBedR1277?2:3;

  const tickerSpritePathR1261=(fullWidthTickerR1213 && !preparedAlbumBedR1277 && !MP3_TICKER_DISABLED_R1269)?ensureTickerSpriteR1261():'';
  const tickerSpriteInputIndexR1261=tickerSpritePathR1261 ? (1+(preparedAlbumBedR1277?2:3)) : -1;
  const tickerSpriteInputR1261=tickerSpritePathR1261
    ? ['-thread_queue_size','64','-re','-stream_loop','-1','-i',tickerSpritePathR1261]
    : [];
  const albumLikePathR1262=''; // R1275: custom 60s LIKE disabled; use clip-style CTA instead
  const albumLikeInputIndexR1262=albumLikePathR1262 ? (1+(decorativeInputsR1132.length?3:0)+(tickerSpritePathR1261?1:0)) : -1;
  const albumLikeInputR1262=albumLikePathR1262
    ? ['-loop','1','-framerate','1','-i',albumLikePathR1262]
    : [];

  // R1237: no separate ticker underlay. The album source itself is a subtle full-frame 25fps motion loop.
  const tickerUnderlayReadyR1236=false;
  const tickerUnderlayInputIndexR1236=-1;
  const tickerUnderlayInputR1236=[];
  const tickerRasterReadyR1221=false;
  const tickerRasterInputIndexR1221=-1;
  const tickerRasterInputR1221=[];

  state.visualCpuLowR1132={
    mode:R1132_VISUAL_CPU_LOW,
    geometryExact:Boolean(fastProfileR1132.geometryExact),
    fpsExact:Boolean(fastProfileR1132.fpsExact),
    pix420:Boolean(fastProfileR1132.pix420),
    decorativeInputs:preparedAlbumBedR1277?2:3,
    clipCtaOnMp3R1275:'SUBSCRIBE@20S-THEN-ALTERNATE-EVERY-120S-8S-FADE035',
    path:effectiveVisualPathR1224,
    preparedAlbumBedR1277,
    albumSourceModeR1274:preparedAlbumBedR1277?'R1277-PREPARED-BED-RE-STREAMLOOP':(fullWidthTickerR1213&&!staticBackgroundR1214?'WARMED-REALVIDEO-RE-STREAMLOOP':'OTHER'),
    tickerBakedFullFrameR1224:preparedAlbumBedR1277?true:tickerBakedFullFrameR1224,
    tickerModeR1246:preparedAlbumBedR1277?'R1277-OFFLINE-BAKED-IN-BED':(MP3_TICKER_DISABLED_R1269?'R1270-R1212-MASTER+R1269-TICKER-OFF':(fullWidthTickerR1213?'R1268-PRERENDERED-QTRLE-ALPHA-XFADE':'LEGACY')),
    tickerSpriteR1261:preparedAlbumBedR1277?'OFFLINE-BAKED':(MP3_TICKER_DISABLED_R1269?'DISABLED':(tickerSpriteInputIndexR1261>=0?'R1268-QTRLE-25FPS-SMOOTH':'FALLBACK-DRAWTEXT')),
    albumLikeR1262:'OFF-R1275-CLIP-CTA-OWNS-LIKE'
  };

  const visualInputR1211=preparedAlbumBedR1277
    // R1277 local prepared bed is deterministic and verified at build time. If its
    // decoder ever reports corruption, fail the feeder instead of concealing it with
    // ignore_err and painting damaged chroma/reference blocks into the live master.
    ? ['-thread_queue_size','32','-fflags','+genpts+discardcorrupt','-err_detect','explode','-re','-stream_loop','-1',...visualSeek,'-i',effectiveVisualPathR1224]
    : (tickerBakedFullFrameR1224
      ? ['-thread_queue_size','64','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-stream_loop','-1','-i',effectiveVisualPathR1224]
      : (staticBackgroundR1214
        ? ['-thread_queue_size','8','-framerate',String(STATIC_BACKGROUND_INPUT_FPS_R1214),'-i',effectiveVisualPathR1224]
        : ['-thread_queue_size','64','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-stream_loop','-1',...visualSeek,'-i',effectiveVisualPathR1224]));

  return [
    '-hide_banner','-loglevel','warning','-threads','1','-filter_complex_threads','1',
    ...visualInputR1211,
    ...decorativeInputsR1132,
    ...tickerSpriteInputR1261,
    ...albumLikeInputR1262,
    ...tickerUnderlayInputR1236,
    ...tickerRasterInputR1221,
    '-filter_complex',normalVideoFilterComplexR721({fadeIn,fadeInSeconds,endFadeToBlack,trackDuration,previewReload,boundaryTitleSwitchAt,mp3Boundary,fastProfileR1132,fullWidthTickerR1213,tickerRasterInputIndexR1221,tickerBakedFullFrameR1224,tickerUnderlayInputIndexR1236,staticFrameLoopR1255:staticBackgroundR1214,tickerSpriteInputIndexR1261,albumLikeInputIndexR1262,preparedAlbumBedR1277,ctaSubscribeInputIndexR1277,ctaLikeInputIndexR1277}),
    '-map','[outv]','-an','-sn','-dn',
    ...rawVideoOutputArgsR816()
  ];
}

function spawnRawNormalVideoChildR816(visualPath,{fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,visualOffsetSeconds=0,previewReload=false,boundaryTitleSwitchAt=0,mp3Boundary=false}={}){
  const eq=equalizerSpecR721();
  if(!existsSync(visualPath)||statSync(visualPath).size<(isStaticBackgroundR1211(visualPath)?4096:300000))throw new Error(`visual missing: ${visualPath}`);
  if(!isPreparedAlbumBedR1277(visualPath) && (!existsSync(QR_OVERLAY_LIVE_R794)||statSync(QR_OVERLAY_LIVE_R794).size<20000))throw new Error(`QR overlay missing: ${QR_OVERLAY_LIVE_R794}`);
  if(!existsSync(CTA_OVERLAY_LIVE_R794)||statSync(CTA_OVERLAY_LIVE_R794).size<2500)throw new Error(`R767 CTA overlay missing: ${CTA_OVERLAY_LIVE_R794}`);
  if(!existsSync(CTA_LIKE_OVERLAY_LIVE_R794)||statSync(CTA_LIKE_OVERLAY_LIVE_R794).size<2500)throw new Error(`R783 LIKE CTA overlay missing: ${CTA_LIKE_OVERLAY_LIVE_R794}`);
  // R972B: unused equalizer-off decoder removed from normal feeder
  const child=spawn('ffmpeg',normalVideoFeederArgsR721(visualPath,eq.path,{fadeIn,fadeInSeconds,endFadeToBlack,trackDuration,visualOffsetSeconds,previewReload,boundaryTitleSwitchAt,mp3Boundary}),{stdio:['ignore','pipe','pipe']}); // R831 MICRO-LAG FIX: normal priority restored
  child.__r816EqPeriod=eq.period;
  child.__r816VisualPath=visualPath;
  child.__r816IntentionalStop=false;
  // R1150: feeder-local frame windows. R1085 remains the long-term audio master,
  // but it is forbidden to DROP/DUP the first 7s and final 10s of a normal MP3.
  // This preserves smooth real motion where PREVIOUS/NEXT is visible without
  // changing the proven R1148E fade/black/fade boundary ownership.
  child.__r1150TrackDurationFrames=Math.max(0,Math.round(Number(trackDuration||0)*VIDEO_FPS));
  child.__r1150EdgeStartFrames=Math.max(1,Math.round(MP3_EDGE_START_EXACT_SECONDS_R1150*VIDEO_FPS));
  child.__r1150EdgeTailFrames=Math.max(1,Math.round(MP3_EDGE_TAIL_EXACT_SECONDS_R1150*VIDEO_FPS));
  child.__r1150Mp3Boundary=Boolean(mp3Boundary); // R1151: tail shield only for MP3->MP3
  child.__r1154RuntimeVideoHandoff=false;
  child.__r1154SuppressR1148=false;
  child.__r1154ActualNextKind='';
  child.__r1154ActualNextSource='';
  child.__r1154ActualNextItem=null;
  child.__r1154ActualNextAfterItem=null;
  child.__r1154PrearmScheduled=false;
  child.__r1154PrearmTimer=null;

  // R1148: mark exact feeder-frame boundaries for MP3->MP3 cinematic lock.
  // For an outgoing MP3, normalVideoFilterComplexR721 begins black-mask fade at:
  //   trackDuration - fadeOut - blackHold
  // (trackDuration already includes R972 tail guard + the deliberate black hold).
  // Arm one frame early so the first visible fade frame itself can never be dropped.
  if(Boolean(mp3Boundary&&endFadeToBlack)){
    const fadeStartSecR1148=Math.max(
      0,
      Number(trackDuration||0)-
      MP3_BOUNDARY_FADE_OUT_SECONDS_R814-
      MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814
    );
    child.__r1148Mp3FadeOutStartFrame=Math.max(0,Math.floor(fadeStartSecR1148*VIDEO_FPS)-1);
    child.__r1148Mp3FadeOutLockArmed=false;
    child.__r1148Mp3LockPublisherPid=0;
  }

  // A 2.40s startup mask identifies the incoming side of an MP3->MP3 split.
  // Keep the lock through the whole reveal plus three frames of mask tail.
  if(Boolean(fadeIn) &&
     Math.abs(Number(fadeInSeconds||0)-MP3_BOUNDARY_FADE_IN_SECONDS_R814)<0.001){
    child.__r1148Mp3FadeInReleaseFrame=Math.max(
      1,
      Math.ceil(
        (MP3_BOUNDARY_FADE_IN_SECONDS_R814+
         MP3_CINEMATIC_FADE_RELEASE_PAD_SECONDS_R1148)*VIDEO_FPS
      )
    );
    child.__r1148Mp3FadeInReleased=false;
  }

  child.stdout.on('error',()=>{});
  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe|non-monoton|corrupt|missing picture|nal unit/i.test(line))state.lastError=line.slice(-700);
      diagFfmpegR802('normal-rawvideo',line);
      console.error('[video-feed-r816]',line);
    }
  });
  return child;
}

function promoteRawNormalVideoR816(child,videoSink){
  if(!child||child.exitCode!==null||child.signalCode!==null)throw new Error('R816 rawvideo candidate unavailable at promotion');

  // R1160E: exactly one normal visual child owns the persistent rawvideo pipe.
  normalVideoOwnerGenerationR1160E++;
  child.__r1160ENormalVideoOwnerGeneration=normalVideoOwnerGenerationR1160E;
  state.normalVideoOwnerGenerationR1160E=normalVideoOwnerGenerationR1160E;

  videoFeeder=child;
  videoFeederPath=child.__r816VisualPath||'';
  videoFeederPeriod=child.__r816EqPeriod||'';
  attachVideoFrameRelayR816(child,videoSink,'normal-visual');
  child.on('exit',(code,signal)=>{
    const isCurrent=videoFeeder===child;
    try{detachVideoFrameRelayR816(child)}catch(_){ }
    if(isCurrent)videoFeeder=null;
    if(isCurrent&&!stopping&&!clipActive&&!visualSwitching&&!child.__r816IntentionalStop){
      state.lastError=`R816 visual feeder exit ${code??signal}; restarting rawvideo source without RTMPS reconnect`;
      setTimeout(()=>ensureNormalVideoFeederR721({force:true}).catch(err=>{state.lastError=`R816 visual feeder restart: ${cleanText(err?.message||err)}`;}),120).unref();
    }
  });
  child.on('error',err=>{if(videoFeeder===child)state.lastError=`R816 visual feeder: ${String(err)}`;});
  return true;
}

async function atomicReplaceNormalVideoFeederR816(visualPath,opts={}){
  const old=videoFeeder;
  const videoSink=publisher?.stdio?.[4];
  if(!old||old.exitCode!==null)return startNormalVideoFeederR721(visualPath,opts);
  if(!publisher||publisher.exitCode!==null||!videoSink||videoSink.destroyed||videoSink.writableEnded)throw new Error('R816 persistent rawvideo pipe unavailable');
  const candidate=spawnRawNormalVideoChildR816(visualPath,opts);
  const started=Date.now();
  const oldBlackBridgeR1145=/BLACK-BRIDGE/i.test(String(old.__r816VisualPath||''));
  const fullFrameRevealR1145=Boolean(oldBlackBridgeR1145 && opts?.fadeIn);
  const incomingMp3R1150=Boolean(
    !fullFrameRevealR1145 &&
    opts?.fadeIn &&
    Math.abs(Number(opts?.fadeInSeconds||0)-MP3_BOUNDARY_FADE_IN_SECONDS_R814)<0.001
  );
  let firstFrameR1145=null;
  let firstFrameR1150=null;
  try{
    if(fullFrameRevealR1145){
      firstFrameR1145=await collectFirstFullRawFrameR828(candidate,BLACK_TO_MP3_FULLFRAME_TIMEOUT_MS_R1145);
      if(!Buffer.isBuffer(firstFrameR1145)||firstFrameR1145.length!==VIDEO_FRAME_BYTES_R816){
        throw new Error(`R1145 incoming MP3 first frame invalid ${firstFrameR1145?.length||0}/${VIDEO_FRAME_BYTES_R816}`);
      }
      diagRecordR802('r1145-black-to-mp3-fullframe-ready',{oldPid:Number(old.pid||0),candidatePid:Number(candidate.pid||0),bytes:Number(firstFrameR1145.length||0),readyMs:Date.now()-started});
    }else if(incomingMp3R1150){
      // R1150: warm one COMPLETE 1080p YUV frame OFF-LIVE. Unlike R1149, this
      // does NOT promote, pace, or replace the old feeder early. The old MP3 keeps
      // full ownership of its ending and R1148 fade-to-black.
      firstFrameR1150=await collectFirstFullRawFrameR828(candidate,5000);
      if(!Buffer.isBuffer(firstFrameR1150)||firstFrameR1150.length!==VIDEO_FRAME_BYTES_R816){
        throw new Error(`R1150 incoming MP3 first frame invalid ${firstFrameR1150?.length||0}/${VIDEO_FRAME_BYTES_R816}`);
      }
      diagRecordR802('r1150-normal-mp3-first-fullframe-warm-ready',{
        oldPid:Number(old.pid||0),candidatePid:Number(candidate.pid||0),
        bytes:Number(firstFrameR1150.length||0),readyMs:Date.now()-started
      });
      diagRecordR802('r816-rawvideo-candidate-ready',{oldPid:Number(old.pid||0),candidatePid:Number(candidate.pid||0),readyMs:Date.now()-started});
    }else{
      await promiseTimeout(streamReadableReadyR752(candidate.stdout,'rawvideo',candidate),5000,'R816 rawvideo candidate ready');
      diagRecordR802('r816-rawvideo-candidate-ready',{oldPid:Number(old.pid||0),candidatePid:Number(candidate.pid||0),readyMs:Date.now()-started});
    }
  }catch(error){
    candidate.__r816IntentionalStop=true;
    if(candidate.exitCode===null){try{candidate.kill('SIGTERM')}catch(_){ }}
    state.lastWarning=`R816 candidate stayed OFF-LIVE; old rawvideo feeder preserved: ${cleanText(error?.message||error)}`;
    diagRecordR802('r816-rawvideo-candidate-rejected',{oldPid:Number(old.pid||0),candidatePid:Number(candidate.pid||0),error:cleanText(error?.message||error)});
    return false;
  }

  // R1150 WARM-BUT-DON'T-COMMIT:
  // A ready NEXT candidate is NOT permission to replace the current MP3. The old
  // feeder keeps ownership until its own local frame clock has completed the
  // 1.60s fade-out AND the full black hold. This is the key safeguard that R1149
  // lacked: candidate readiness can never cut off the audible/visible tail early.
  if(incomingMp3R1150){
    const oldRelayR1150=old?.__r816VideoRelay;
    const fadeStartR1150=Number(old?.__r1148Mp3FadeOutStartFrame);
    const hasBoundaryClockR1150=Boolean(
      oldRelayR1150 &&
      Number.isFinite(fadeStartR1150) &&
      fadeStartR1150>=0
    );

    if(hasBoundaryClockR1150){
      const commitTargetR1150=Math.max(
        0,
        fadeStartR1150+
        Math.ceil((MP3_BOUNDARY_FADE_OUT_SECONDS_R814+MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814)*VIDEO_FPS)
      );
      const gateStartedR1150=Date.now();
      const gateTimeoutMsR1150=7000;

      diagRecordR802('r1150-mp3-boundary-commit-gate-armed',{
        oldPid:Number(old?.pid||0),
        candidatePid:Number(candidate?.pid||0),
        currentFrame:Number(oldRelayR1150?.frames||0),
        targetFrame:commitTargetR1150,
        fadeStartFrame:fadeStartR1150,
        blackHoldMs:Math.round(MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814*1000)
      });

      while(!stopping &&
            old.exitCode===null &&
            Number(oldRelayR1150?.frames||0)<commitTargetR1150 &&
            Date.now()-gateStartedR1150<gateTimeoutMsR1150){
        await sleep(20);
      }

      const reachedR1150=Number(oldRelayR1150?.frames||0)>=commitTargetR1150;
      if(reachedR1150){
        diagRecordR802('r1150-mp3-boundary-old-black-ready',{
          oldPid:Number(old?.pid||0),
          candidatePid:Number(candidate?.pid||0),
          frame:Number(oldRelayR1150?.frames||0),
          targetFrame:commitTargetR1150,
          waitMs:Date.now()-gateStartedR1150
        });
      }else{
        // Emergency-only fallback. Never leave the publisher without video, but
        // record the exact failure loudly so it cannot look like a clean boundary.
        state.lastWarning=`R1150 MP3 boundary gate timeout old=${Number(old?.pid||0)} frame=${Number(oldRelayR1150?.frames||0)}/${commitTargetR1150}`;
        diagRecordR802('r1150-mp3-boundary-commit-gate-timeout',{
          oldPid:Number(old?.pid||0),
          candidatePid:Number(candidate?.pid||0),
          frame:Number(oldRelayR1150?.frames||0),
          targetFrame:commitTargetR1150,
          waitMs:Date.now()-gateStartedR1150
        });
      }
    }else{
      state.lastWarning='R1150 MP3 boundary gate metadata unavailable; preserving R1148E atomic fallback';
      diagRecordR802('r1150-mp3-boundary-gate-metadata-missing',{
        oldPid:Number(old?.pid||0),candidatePid:Number(candidate?.pid||0)
      });
    }
  }

  old.__r816IntentionalStop=true;
  const cut=detachVideoFrameRelayR816(old); // only a partial YUV frame can be dropped
  if(videoFeeder===old)videoFeeder=null;

  // R1150: the MP3 candidate was warmed OFF-LIVE but never promoted early.
  // Commit its first COMPLETE (black-under-start-mask) frame only now, after the
  // old feeder has relinquished ownership at the proven boundary.
  if(incomingMp3R1150 && firstFrameR1150){
    const masterR1150=publisher?.__r1085AudioMaster;
    if(masterR1150)masterR1150.normalMp3EdgePassThroughR1150=true;
    let acceptedR1150=false;
    try{
      acceptedR1150=videoSink.write(firstFrameR1150);
    }finally{
      if(masterR1150)masterR1150.normalMp3EdgePassThroughR1150=false;
    }
    state.videoRelayFramesWritten=Number(state.videoRelayFramesWritten||0)+1;
    state.lastVideoFrameAtR816=new Date().toISOString();
    if(!acceptedR1150){
      await new Promise(resolve=>{
        let done=false;
        const finish=()=>{if(done)return;done=true;clearTimeout(timer);try{videoSink.off('drain',finish)}catch(_){};resolve();};
        const timer=setTimeout(finish,1000);timer.unref?.();
        videoSink.once('drain',finish);
      });
    }
  }

  // R1145: when the old owner is a BLACK bridge, the first incoming MP3 frame
  // is already complete and (because fadeIn starts at t=0) black. Commit that
  // whole frame before attaching the rest; a partial raw frame can never flash.
  if(fullFrameRevealR1145 && firstFrameR1145){
    const acceptedR1145=videoSink.write(firstFrameR1145);
    state.videoRelayFramesWritten=Number(state.videoRelayFramesWritten||0)+1;
    state.lastVideoFrameAtR816=new Date().toISOString();
    if(!acceptedR1145){
      await new Promise(resolve=>{
        let done=false;
        const finish=()=>{if(done)return;done=true;clearTimeout(timer);try{videoSink.off('drain',finish)}catch(_){};resolve();};
        const timer=setTimeout(finish,1000);timer.unref?.();
        videoSink.once('drain',finish);
      });
    }
  }
  promoteRawNormalVideoR816(candidate,videoSink);

  // R1148D: arm from the actual candidate's fade metadata, not caller opts.
  // The first-full-frame hook in attachVideoFrameRelayR816 repeats this idempotently
  // as a fallback, so a successful MP3 promotion cannot be left watchdog-only.
  armMp3CinematicReleaseTargetR1148D(candidate,'candidate-promoted');

  // R1147: the first complete MP3 frame has now been committed while the exact
  // pass-through lock was active. lastFrame is therefore BLACK/the first reveal
  // frame, never a stale station frame. Resume normal R1085 correction from here.
  if(fullFrameRevealR1145){
    const masterUnlockR1147=publisher?.__r1085AudioMaster;
    if(masterUnlockR1147?.transitionPassThroughR1147){
      const framesR1147=Number(masterUnlockR1147.transitionPassFramesR1147||0);
      masterUnlockR1147.transitionPassThroughR1147=false;
      masterUnlockR1147.transitionPassThroughUntilR1147=0;
      state.stationBlackMasterLockActiveR1147=false;
      state.lastStationBlackMasterLockR1147={
        at:new Date().toISOString(),
        frames:framesR1147,
        next:shortText(state.current?.title||'',52)
      };
      diagRecordR802('r1147-station-black-master-lock-released',{
        frames:framesR1147,
        candidatePid:Number(candidate.pid||0),
        leadMs:Math.round((Number(masterUnlockR1147.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-Number(masterUnlockR1147.videoFrames||0)/VIDEO_FPS)*1000)
      });
    }

    // R1160L: videoFrames counts real submitted frames for the publisher lifetime.
    // Reassigning it without changing media made R1085/R1123 compare unrelated
    // timelines. Keep actual sample/frame counts; observe the boundary only.
    const masterR1160L=publisher?.__r1085AudioMaster;
    if(masterR1160L){
      const leadMs=Math.round((masterR1160L.audioBytes/(AUDIO_SAMPLE_RATE*4)-masterR1160L.videoFrames/VIDEO_FPS)*1000);
      state.lastPostVideoPhaseR1160L={at:new Date().toISOString(),candidatePid:Number(candidate.pid||0),videoFrames:masterR1160L.videoFrames,audioBytes:masterR1160L.audioBytes,leadMs};
      diagRecordR802('r1160l-post-video-phase-observed',state.lastPostVideoPhaseR1160L);
    }
  }

  if(old.exitCode===null){
    try{old.kill('SIGTERM')}catch(_){ }
    setTimeout(()=>{if(old.exitCode===null){try{old.kill('SIGKILL')}catch(_){ }}},900).unref?.();
  }
  state.videoHandoffMode=fullFrameRevealR1145
    ? 'R1145-BLACK-TO-MP3-FULLFRAME-REVEAL'
    : 'R816-RAWVIDEO-MAKE-BEFORE-BREAK-FRAME-ALIGNED';
  diagRecordR802(fullFrameRevealR1145?'r1145-black-to-mp3-fullframe-promoted':'r816-rawvideo-promoted',{oldPid:Number(old.pid||0),candidatePid:Number(candidate.pid||0),droppedPartialBytes:Number(cut?.dropped||0),firstFrameBytes:Number(firstFrameR1145?.length||0),totalMs:Date.now()-started});
  return true;
}

async function stopNormalVideoFeederR721(){
  const active=videoFeeder;
  if(!active)return;
  active.__r816IntentionalStop=true;
  if(active.exitCode===null){
    try{active.kill('SIGINT')}catch(_){ }
    await waitChildExit(active,900);
  }
  const cut=detachVideoFrameRelayR816(active);
  if(active.exitCode===null){
    try{active.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(active,900))&&active.exitCode===null){
      try{active.kill('SIGKILL')}catch(_){ }
      await waitChildExit(active,250);
    }
  }
  if(videoFeeder===active)videoFeeder=null;
  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;
  if(Number(cut?.dropped||0)>0)diagRecordR802('r816-old-rawvideo-partial-dropped',{pid:Number(active.pid||0),bytes:Number(cut.dropped||0)});
}

function startNormalVideoFeederR721(visualPath,{fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,visualOffsetSeconds=0,previewReload=false,boundaryTitleSwitchAt=0,mp3Boundary=false}={}){
  if(stopping||clipActive)return false;
  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!videoSink||videoSink.destroyed||videoSink.writableEnded)throw new Error('R816 persistent rawvideo pipe unavailable');
  const child=spawnRawNormalVideoChildR816(visualPath,{fadeIn,fadeInSeconds,endFadeToBlack,trackDuration,visualOffsetSeconds,previewReload,boundaryTitleSwitchAt,mp3Boundary});
  promoteRawNormalVideoR816(child,videoSink);
  state.videoHandoffMode='R816-RAWVIDEO-FIRST-FEEDER-LIVE';
  return true;
}


function collectFirstFullRawFrameR828(child,timeoutMs=6000){
  return new Promise((resolve,reject)=>{
    const stream=child?.stdout;

    if(!stream){
      reject(
        new Error(
          'R828 startup candidate stdout missing'
        )
      );
      return;
    }

    let done=false;
    let total=0;
    const chunks=[];

    const cleanup=()=>{
      clearTimeout(timer);
      stream.off('readable',onReadable);
      stream.off('error',onError);
      child?.off('exit',onExit);
    };

    const finish=(error,value)=>{
      if(done)return;
      done=true;
      cleanup();

      if(error)reject(error);
      else resolve(value);
    };

    const pump=()=>{
      try{
        while(
          !done &&
          total<VIDEO_FRAME_BYTES_R816
        ){
          const available=
            Number(stream.readableLength||0);

          if(available<=0)break;

          const need=
            VIDEO_FRAME_BYTES_R816-total;

          const take=
            Math.min(need,available);

          const chunk=stream.read(take);

          if(!chunk)break;

          chunks.push(chunk);
          total+=chunk.length;
        }

        if(
          !done &&
          total===VIDEO_FRAME_BYTES_R816
        ){
          try{stream.pause()}catch(_){}

          finish(
            null,
            chunks.length===1
              ? chunks[0]
              : Buffer.concat(
                  chunks,
                  VIDEO_FRAME_BYTES_R816
                )
          );
        }

      }catch(error){
        finish(error);
      }
    };

    const onReadable=()=>pump();

    const onError=error=>{
      finish(error);
    };

    const onExit=(code,signal)=>{
      finish(
        new Error(
          `R828 startup feeder exited before full frame: `+
          `${code??signal??'exit'}`
        )
      );
    };

    const timer=setTimeout(
      ()=>{
        finish(
          new Error(
            `R828 startup full-frame timeout; `+
            `bytes=${total}/${VIDEO_FRAME_BYTES_R816}`
          )
        );
      },
      timeoutMs
    );

    stream.on('readable',onReadable);
    stream.once('error',onError);
    child?.once('exit',onExit);

    pump();
  });
}

async function startFirstNormalVideoFeederR828(
  visualPath,
  opts={}
){
  if(stopping||clipActive)return false;

  const videoSink=publisher?.stdio?.[4];

  if(
    !publisher ||
    publisher.exitCode!==null ||
    !videoSink ||
    videoSink.destroyed ||
    videoSink.writableEnded
  ){
    throw new Error(
      'R828 persistent rawvideo pipe unavailable'
    );
  }

  // Candidate starts OFF-LIVE.
  const child=
    spawnRawNormalVideoChildR816(
      visualPath,
      opts
    );

  const startedAt=Date.now();

  let firstFrame=null;

  try{
    firstFrame=
      await collectFirstFullRawFrameR828(
        child,
        6000
      );

  }catch(error){

    child.__r816IntentionalStop=true;

    if(child.exitCode===null){
      try{child.kill('SIGTERM')}catch(_){}
    }

    diagRecordR802(
      'r828-startup-full-frame-rejected',
      {
        candidatePid:Number(child.pid||0),
        error:cleanText(
          error?.message||error
        )
      }
    );

    throw error;
  }

  if(stopping||clipActive){

    child.__r816IntentionalStop=true;

    if(child.exitCode===null){
      try{child.kill('SIGTERM')}catch(_){}
    }

    return false;
  }

  // The FIRST bytes master receives are exactly one
  // complete 1920x1080 YUV420P frame.
  const accepted=videoSink.write(firstFrame);

  state.videoRelayFramesWritten=
    Number(state.videoRelayFramesWritten||0)+1;

  state.lastVideoFrameAtR816=
    new Date().toISOString();

  // Writable.write(false) means queued/backpressure,
  // NOT failed write. Wait briefly for master to consume
  // the complete first frame before attaching the rest.
  if(!accepted){

    await new Promise(resolve=>{

      let finished=false;

      const done=()=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        try{videoSink.off('drain',done)}catch(_){}
        resolve();
      };

      const timer=setTimeout(
        done,
        4000
      );

      videoSink.once('drain',done);
    });
  }

  // Now attach the normal frame-aligned R816 relay.
  promoteRawNormalVideoR816(
    child,
    videoSink
  );

  state.videoHandoffMode=
    'R828-FIRST-FEEDER-FULL-FRAME-PRIMED';

  diagRecordR802(
    'r828-startup-full-frame-primed',
    {
      candidatePid:Number(child.pid||0),
      bytes:Number(firstFrame.length||0),
      expectedBytes:
        Number(VIDEO_FRAME_BYTES_R816),
      readyMs:Date.now()-startedAt
    }
  );

  state.lastWarning='';

  return true;
}


// R1160E NORMAL-VIDEO SINGLE-OWNER
// After many hours two concurrent normal-MP3 feeder starts could overlap. Both relays
// then wrote complete YUV frames into the same persistent publisher pipe, which appears
// to the viewer as rapid MP3-picture flicker. Coalesce concurrent starts and give every
// promoted normal feeder one immutable ownership generation.
let normalVideoEnsurePromiseR1160E=null;
let normalVideoOwnerGenerationR1160E=0;

async function ensureNormalVideoFeederR721({force=false,fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=null,previewReload=false,boundaryTitleSwitchAt=null,mp3Boundary=false,visualItem=null}={}){
  if(stopping||clipActive)return true;

  // R1160E: if a station/clip tail, first-PCM gate and watchdog all ask for the
  // normal MP3 feeder at nearly the same moment, only ONE replacement is allowed.
  if(normalVideoEnsurePromiseR1160E){
    state.normalVideoEnsureCoalescedR1160E=Number(state.normalVideoEnsureCoalescedR1160E||0)+1;
    diagRecordR802('r1160e-normal-video-ensure-coalesced',{
      current:shortText(state.current?.title||'',52),
      next:shortText(state.next?.title||'',52)
    });
    return await normalVideoEnsurePromiseR1160E;
  }

  const job=(async()=>{
    const visual=await ensureTrackVisualR1211(visualItem||state.current);
    const slotR1211=radioBackgroundSlotForItemR1211(visualItem||state.current);
    const period=isStaticBackgroundR1211(visual)?`album-${slotR1211||'extras'}`:activeVisualPeriodR721();

    if(!force&&videoFeeder&&videoFeeder.exitCode===null&&videoFeederPath===visual&&videoFeederPeriod===period){
      return true;
    }

    visualSwitching=true;
    try{
      if(stopping||clipActive)return true;
      const plannedDuration=trackDuration===null?remainingTrackSecondsR726():Math.max(0,Number(trackDuration)||0);
      const visualOffsetSeconds=await visualLoopOffsetR735(visual);
      const plannedBoundaryTitleSwitchAt=boundaryTitleSwitchAt===null
        ? ((state.next?.type==='track'&&plannedDuration>TITLE_SWITCH_BEFORE_BOUNDARY_R781+0.25)?Math.max(0,plannedDuration-TITLE_SWITCH_BEFORE_BOUNDARY_R781):0)
        : Math.max(0,Number(boundaryTitleSwitchAt)||0);
      const opts={fadeIn,fadeInSeconds,endFadeToBlack,trackDuration:plannedDuration,visualOffsetSeconds,previewReload,boundaryTitleSwitchAt:plannedBoundaryTitleSwitchAt,mp3Boundary};

      // R837 GOLD / R829 path stays unchanged. R1160E changes ownership only.
      if(videoFeeder&&videoFeeder.exitCode===null)return await atomicReplaceNormalVideoFeederR816(visual,opts);
      return await startNormalVideoFeederR721(visual,opts);
    }finally{
      visualSwitching=false;
    }
  })();

  normalVideoEnsurePromiseR1160E=job;
  try{
    return await job;
  }finally{
    if(normalVideoEnsurePromiseR1160E===job)normalVideoEnsurePromiseR1160E=null;
  }
}

async function scheduleVisualTickR721(){
  if(stopping || clipActive || !runtimeVisualAutoSchedule || runtimeForceVisualSlot)return;
  const wanted=visualPeriodForHour(localHourInTimeZone());
  if(videoFeederPeriod!==wanted){
    try{await ensureNormalVideoFeederR721({force:true});state.lastError='';}
    catch(error){state.lastError=`R721 AUTO visual switch: ${cleanText(error?.message||error)}`;}
  }
}

async function applyVisualModeR721({slot='',auto=false,forceReload=false}={}){
  if(auto){
    runtimeForceVisualSlot='';
    runtimeVisualAutoSchedule=true;
  }else if(slot){
    const clean=String(slot).trim().toLowerCase();
    if(!['morning','day','evening','night'].includes(clean))throw new Error('invalid visual slot');
    runtimeForceVisualSlot=clean;
    runtimeVisualAutoSchedule=false;
  }
  if(!clipActive)await ensureNormalVideoFeederR721({force:true});
  return {ok:true,slot:runtimeForceVisualSlot||null,auto:runtimeVisualAutoSchedule,visualPeriod:state.visualPeriod,visualPath:state.visualPath};
}


// R1130: arm a new local visual for the NEXT normal MP3 track. This endpoint
// intentionally does not touch the current visual feeder and does not restart RTMPS.
function armVisualNextTrackR1130(slot=''){
  const clean=String(slot||'').trim().toLowerCase();
  if(!['morning','day','evening','night'].includes(clean))throw new Error('invalid visual slot');
  pendingVisualNextTrackR1130={
    slot:clean,
    armedAt:new Date().toISOString(),
    currentTitle:shortText(state.current?.title||'',80),
    nextTitle:shortText(state.next?.title||'',80)
  };
  state.visualNextTrackPendingR1130={...pendingVisualNextTrackR1130};
  state.visualNextTrackLastActionR1130='ARMED';
  return {
    ok:true,
    armed:true,
    mode:'R1130-NEXT-MP3-BOUNDARY',
    pending:{...pendingVisualNextTrackR1130},
    current:state.current?.title||null,
    next:state.next?.title||null,
    publisherRestarted:false,
    currentFeederRestarted:false
  };
}

function consumeVisualNextTrackR1130(item){
  const pending=pendingVisualNextTrackR1130;
  if(!pending)return null;
  pendingVisualNextTrackR1130=null;
  runtimeForceVisualSlot=pending.slot;
  runtimeVisualAutoSchedule=false;
  const applied={
    slot:pending.slot,
    armedAt:pending.armedAt,
    appliedAt:new Date().toISOString(),
    track:shortText(item?.title||'TRACK',100)
  };
  state.visualNextTrackPendingR1130=null;
  state.visualNextTrackLastAppliedR1130=applied;
  state.visualNextTrackLastActionR1130='APPLIED';
  diagRecordR802('r1130-visual-next-track-applied',applied);
  return applied;
}

async function probeHasAudioR721(path){
  // R738: two-stage probe. Some short R2 station IDs have odd metadata and the old
  // single ffprobe query could return no index even though FFmpeg can decode audio.
  try{
    const raw=await runCapture('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=codec_type,channels,sample_rate','-of','csv=p=0',path],{timeoutMs:15000});
    if(/audio|\d/i.test(String(raw)))return true;
  }catch(_){ }
  try{
    await runCapture('ffmpeg',['-hide_banner','-loglevel','error','-i',path,'-map','0:a:0','-t','0.10','-f','null','-'],{timeoutMs:15000});
    return true;
  }catch(_){return false}
}

function clipFeederArgsR721(clipPath,{hasAudio=true,duration=0,isStationInsert=false}={}){
  const args=[
    '-hide_banner','-loglevel','warning','-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',clipPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY
  ];
  if(!hasAudio)args.push('-f','lavfi','-i',`anullsrc=r=${AUDIO_SAMPLE_RATE}:cl=stereo`);
  args.push('-filter_complex',isStationInsert?bumperFilterComplexR724():clipFilterComplexR721(),'-map','[outv]','-an','-sn','-dn');
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push(...rawVideoOutputArgsR816(),'-map',hasAudio?'0:a:0':'2:a:0','-vn','-sn','-dn','-af',`aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2');
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','s16le','pipe:3');
  return args;
}

async function stopClipFeederR721(child,videoSink,audioSink){
  if(!child)return;
  try{detachVideoFrameRelayR816(child)}catch(_){ }
  try{if(child.stdio?.[3]&&audioSink)child.stdio[3].unpipe(audioSink)}catch(_){ }
  if(child.exitCode===null){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,350))&&child.exitCode===null){try{child.kill('SIGKILL')}catch(_){ }await waitChildExit(child,150);}
  }
}


// R1145 STATION -> MP3 ATOMIC BLACK OWNERSHIP
// Build the black rawvideo source while the final station frames are still draining.
// The first COMPLETE 1920x1080 YUV420P black frame is kept in memory and the child is
// SIGSTOP'ed OFF-LIVE. At the exact station-tail completion we write that complete black
// frame first, attach the remaining black stream, and only then let the MP3 path continue.
// This removes the 100-200ms no-owner window where a stale/next visual frame could leak.
let stationBlackPrearmR1145=null;

async function clearStationBlackPrearmR1145(reason='clear'){
  const arm=stationBlackPrearmR1145;
  stationBlackPrearmR1145=null;
  if(!arm)return;
  const child=arm.child;
  if(child && child.exitCode===null){
    try{if(arm.stopped)child.kill('SIGCONT')}catch(_){}
    try{child.kill('SIGTERM')}catch(_){}
    if(!(await waitChildExit(child,400)) && child.exitCode===null){
      try{child.kill('SIGKILL')}catch(_){}
      await waitChildExit(child,150);
    }
  }
  diagRecordR802('r1145-station-black-prearm-clear',{reason,next:shortText(arm.next?.title||'',52)});
}

async function buildStationBlackPrearmR1145(next){
  if(stopping || !next || next.type!=='track')return false;
  const identity=primaryIdentity(next);
  if(stationBlackPrearmR1145 && stationBlackPrearmR1145.identity===identity && stationBlackPrearmR1145.ready && stationBlackPrearmR1145.child?.exitCode===null){
    return true;
  }
  await clearStationBlackPrearmR1145('replace');

  const child=spawn('ffmpeg',[
    '-hide_banner','-loglevel','error','-re',
    '-f','lavfi','-i','color=c=black:s=1920x1080:r=25',
    '-an','-sn','-dn','-threads','1',...rawVideoOutputArgsR816()
  ],{stdio:['ignore','pipe','pipe']});

  child.__r816VisualPath='R1145-BLACK-BRIDGE';
  child.__r816EqPeriod='r1145-black';
  child.__r816IntentionalStop=false;
  child.stdout.on('error',()=>{});
  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe/i.test(line))state.lastWarning=`R1145 black prearm: ${line.slice(-500)}`;
    }
  });

  const arm={identity,next,child,firstFrame:null,ready:false,stopped:false,startedAt:Date.now()};
  stationBlackPrearmR1145=arm;
  child.once('exit',(code,signal)=>{
    if(stationBlackPrearmR1145===arm && !arm.claimed){
      stationBlackPrearmR1145=null;
      diagRecordR802('r1145-station-black-prearm-exit',{code,signal,next:shortText(next?.title||'',52)});
    }
  });

  try{
    arm.firstFrame=await collectFirstFullRawFrameR828(child,STATION_BLACK_PREARM_TIMEOUT_MS_R1145);
    if(!Buffer.isBuffer(arm.firstFrame)||arm.firstFrame.length!==VIDEO_FRAME_BYTES_R816){
      throw new Error(`R1145 black prearm full frame invalid ${arm.firstFrame?.length||0}/${VIDEO_FRAME_BYTES_R816}`);
    }
    if(child.exitCode!==null)throw new Error('R1145 black prearm exited before stop');
    try{child.kill('SIGSTOP');arm.stopped=true}catch(error){throw error}
    arm.ready=true;
    diagRecordR802('r1145-station-black-prearm-ready',{
      next:shortText(next?.title||'',52),
      childPid:Number(child.pid||0),
      bytes:Number(arm.firstFrame.length||0),
      readyMs:Date.now()-arm.startedAt
    });
    return true;
  }catch(error){
    if(stationBlackPrearmR1145===arm)stationBlackPrearmR1145=null;
    child.__r816IntentionalStop=true;
    try{if(arm.stopped&&child.exitCode===null)child.kill('SIGCONT')}catch(_){}
    if(child.exitCode===null){try{child.kill('SIGTERM')}catch(_){}}
    state.lastWarning=`R1145 black prearm fallback: ${cleanText(error?.message||error)}`;
    diagRecordR802('r1145-station-black-prearm-failed',{next:shortText(next?.title||'',52),error:cleanText(error?.message||error)});
    return false;
  }
}

async function claimStationBlackPrearmR1145(next){
  const arm=stationBlackPrearmR1145;
  if(!arm)return false;
  if(!arm.ready || arm.identity!==primaryIdentity(next) || !arm.child || arm.child.exitCode!==null || !Buffer.isBuffer(arm.firstFrame)){
    await clearStationBlackPrearmR1145('claim-invalid');
    return false;
  }

  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!videoSink||videoSink.destroyed||videoSink.writableEnded){
    await clearStationBlackPrearmR1145('publisher-unavailable');
    return false;
  }

  // R1147: lock the FINAL master boundary before committing BLACK. This is below
  // R1123/R1145 ownership, so R1085 cannot drop the black frame or synthesize a
  // stale station frame between the station tail and the black bridge.
  const masterLockR1147=publisher?.__r1085AudioMaster;
  if(masterLockR1147){
    masterLockR1147.transitionPassThroughR1147=true;
    masterLockR1147.transitionPassThroughUntilR1147=Date.now()+12000;
    masterLockR1147.transitionPassFramesR1147=0;
    state.stationBlackMasterLockActiveR1147=true;
    state.stationBlackMasterLockArmedAtR1147=new Date().toISOString();
    diagRecordR802('r1147-station-black-master-lock-armed',{
      next:shortText(next?.title||'',52),
      leadMs:Math.round((Number(masterLockR1147.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-Number(masterLockR1147.videoFrames||0)/VIDEO_FPS)*1000)
    });
  }

  stationBlackPrearmR1145=null;
  arm.claimed=true;
  const child=arm.child;

  // There must be exactly one visual owner at this point. If anything survived,
  // remove it before the complete black frame is committed.
  if(videoFeeder && videoFeeder.exitCode===null){
    const old=videoFeeder;
    old.__r816IntentionalStop=true;
    detachVideoFrameRelayR816(old);
    if(videoFeeder===old)videoFeeder=null;
    if(old.exitCode===null){try{old.kill('SIGTERM')}catch(_){}}
  }

  const accepted=videoSink.write(arm.firstFrame);
  state.videoRelayFramesWritten=Number(state.videoRelayFramesWritten||0)+1;
  state.lastVideoFrameAtR816=new Date().toISOString();
  if(!accepted){
    await new Promise(resolve=>{
      let done=false;
      const finish=()=>{if(done)return;done=true;clearTimeout(timer);try{videoSink.off('drain',finish)}catch(_){};resolve();};
      const timer=setTimeout(finish,1000);timer.unref?.();
      videoSink.once('drain',finish);
    });
  }

  promoteRawNormalVideoR816(child,videoSink);
  if(arm.stopped){try{child.kill('SIGCONT')}catch(_){};arm.stopped=false;}

  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;
  clipToTrackBoundaryPendingR753={
    identity:primaryIdentity(next),
    startedAt:Date.now(),
    reason:'R1145-STATION-TO-MP3-ATOMIC-BLACK'
  };
  state.videoHandoffMode='R1145-STATION-TO-MP3-ATOMIC-BLACK-LIVE';
  state.lastStationMp3AtomicBlackR1145={at:new Date().toISOString(),next:shortText(next?.title||'',52),childPid:Number(child.pid||0)};
  diagRecordR802('r1145-station-to-mp3-black-atomic',{
    next:shortText(next?.title||'',52),childPid:Number(child.pid||0),bytes:Number(arm.firstFrame.length||0)
  });
  return true;
}

// R885-STATION-TO-MP3-BLACK-BRIDGE
// After a station bumper ends, never start a full heavy visual feeder
// merely as a temporary recovery source and then replace it again.
// Keep master fed by a cheap 1920x1080 black rawvideo bridge while
// the NEXT MP3 builds exactly one real full-screen visual candidate.
async function startStationToTrackBlackBridgeR885(next){
  // R1136: this bridge is now also the handoff surface for VIDEO -> VIDEO.
  // Never reveal the normal MP3 visualization between a bumper/special/clip and
  // the following real video insert. The master sees continuous raw black frames.
  if(stopping || !next || !(next.type==='track'||isVideoHandoffR738(next)))return false;

  const videoSink=publisher?.stdio?.[4];

  if(
    !publisher ||
    publisher.exitCode!==null ||
    !videoSink ||
    videoSink.destroyed ||
    videoSink.writableEnded
  ){
    throw new Error(
      'R885 persistent rawvideo pipe unavailable'
    );
  }

  // Normally insert playback has already removed the old normal feeder.
  // If a BLACK bridge already exists, keep it. If a bright MP3 visual somehow
  // survived, replace it here so it can never flash between two real videos.
  if(videoFeeder && videoFeeder.exitCode===null){
    if(/BLACK-BRIDGE/i.test(String(videoFeeder.__r816VisualPath||'')))return true;
    detachNormalVideoAtBoundaryR752();
  }

  const child=spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel','error',
      '-re',
      '-f','lavfi',
      '-i','color=c=black:s=1920x1080:r=25',
      '-an','-sn','-dn',
      '-threads','1',
      ...rawVideoOutputArgsR816()
    ],
    {
      stdio:['ignore','pipe','pipe']
    }
  );

  child.__r816VisualPath='R885-BLACK-BRIDGE';
  child.__r816EqPeriod='r885-black';
  child.__r816IntentionalStop=false;

  child.stdout.on('error',()=>{});

  child.stderr.on('data',d=>{
    const line=String(d||'').trim();

    if(line){
      state.lastFfmpegLine=line.slice(-1000);

      if(/error|fail|invalid|broken pipe/i.test(line)){
        state.lastWarning=
          `R885 black bridge: ${line.slice(-500)}`;
      }
    }
  });

  try{
    await promiseTimeout(
      streamReadableReadyR752(
        child.stdout,
        'r885-black-bridge',
        child
      ),
      1500,
      'R885 black bridge ready'
    );
  }catch(error){

    child.__r816IntentionalStop=true;

    if(child.exitCode===null){
      try{child.kill('SIGTERM')}catch(_){}
    }

    throw error;
  }

  promoteRawNormalVideoR816(
    child,
    videoSink
  );

  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;

  if(next.type==='track'){
    clipToTrackBoundaryPendingR753={
      identity:primaryIdentity(next),
      startedAt:Date.now(),
      reason:'R885-STATION-TO-MP3-BLACK-BRIDGE'
    };
  }

  const videoToVideoR1136=Boolean(isVideoHandoffR738(next));
  state.videoHandoffMode=videoToVideoR1136
    ? 'R1136-VIDEO-TO-VIDEO-BLACK-BRIDGE-LIVE'
    : 'R885-STATION-TO-MP3-BLACK-BRIDGE-LIVE';

  try{
    diagRecordR802(
      videoToVideoR1136?'r1136-video-to-video-black-bridge':'r885-station-to-mp3-black-bridge',
      {
        next:shortText(next?.title||'',52),
        nextType:String(next?.type||next?.sourceType||''),
        bridgePid:Number(child.pid||0)
      }
    );
  }catch(_){}

  return true;
}

async function ensureVideoSourceAfterClipR745(next=null){
  if(stopping)return true;
  // R1026B-CLIP-TO-MP3-BLACK-HOLD
  // Do not reveal the normal visual between clip EOF and the next MP3.
  if(next&&next.type==='track'){

    clipToTrackBoundaryPendingR753={
      identity:primaryIdentity(next),
      startedAt:Date.now(),
      reason:'R1026B-CLIP-TO-MP3-SINGLE-FADE'
    };

    const blackAliveR1026B=Boolean(
      videoFeeder &&
      videoFeeder.exitCode===null &&
      /BLACK-BRIDGE/i.test(
        String(videoFeeder.__r816VisualPath||'')
      )
    );

    if(!blackAliveR1026B){

      if(typeof startStationToTrackBlackBridgeR885!=='function'){
        throw new Error(
          'R1026B black bridge helper missing'
        );
      }

      await startStationToTrackBlackBridgeR885(next);
    }

    state.videoHandoffMode=
      'R1026B-CLIP-TO-MP3-BLACK-HOLD';

    return true;
  }

  // R1136 VIDEO -> VIDEO BLACK HOLD.
  // The old behavior fell through to ensureNormalVideoFeederR721(), which is exactly
  // the one-second-plus MP3 visualization flash visible in the viewer recording.
  // Keep black rawvideo live until the next bumper/special/music clip is A+V ready;
  // playVideoClipR691() will then cut this bridge at the exact promotion boundary.
  if(next&&isVideoHandoffR738(next)){
    const blackAliveR1136=Boolean(
      videoFeeder && videoFeeder.exitCode===null &&
      /BLACK-BRIDGE/i.test(String(videoFeeder.__r816VisualPath||''))
    );
    if(!blackAliveR1136){
      const bridgedR1136=await startStationToTrackBlackBridgeR885(next);
      if(!bridgedR1136){
        throw new Error('R1136 video-to-video black bridge did not start');
      }
    }
    state.videoHandoffMode='R1136-VIDEO-TO-VIDEO-BLACK-HOLD';
    diagRecordR802('r1136-video-to-video-black-hold',{next:shortText(next?.title||'',52)});
    return true;
  }

  const preparedAlive=Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null);
  const normalAlive=Boolean(videoFeeder&&videoFeeder.exitCode===null);
  if(preparedAlive||normalAlive)return true;
  // A failed/late preroll used to leave the persistent master with no H264 input.
  // The master process stayed alive but YouTube eventually reported NODATA. Force a
  // normal visual immediately so the ONE RTMPS publisher never starves at clip EOF.
  clipActive=false;
  await stopPreparedVideoPrerollR744().catch(()=>{});
  // R917B-CLIP-END-BLACK
    await ensureNormalVideoFeederR721({
      force:true,
      fadeIn:Boolean(next?.type==='track'),
      fadeInSeconds:CLIP_TO_TRACK_FADE_IN_SECONDS_R753
    });
  state.videoHandoffMode='R745-CLIP-END-FORCED-NORMAL-RECOVERY';
  state.lastClipGuardRecovery={at:new Date().toISOString(),next:shortText(next?.title||'',52)};
  return true;
}

async function abortInsertHandoffR749(item,next,reason){
  const text=cleanText(reason||'insert handoff aborted');
  state.lastError=`R749 insert safe fallback: ${shortText(item?.title||'VIDEO',40)}: ${text}`;
  console.error('[r749-insert-fallback]',state.lastError);
  clipActive=false;
  await stopPreparedVideoPrerollR744().catch(()=>{});
  try{
    const normalAlive=Boolean(videoFeeder&&videoFeeder.exitCode===null);
    if(normalAlive){
      // R792: failed station arm must not restart an already-live BLACK feeder. Keeping
      // it connected prevents the exact spinner/NODATA gap that used to happen when a
      // three-second insert failed before its audio became ready.
      state.videoHandoffMode='R792-INSERT-ABORT-KEEP-EXISTING-LIVE-FEEDER';
    }else{
      await ensureNormalVideoFeederR721({force:true,fadeIn:false});
      state.videoHandoffMode='R749-INSERT-ABORT-FORCED-NORMAL';
    }
  }catch(error){
    state.lastError+=` | normal visual: ${cleanText(error?.message||error)}`;
  }
  insertRecoveryCountR749++;
  state.lastInsertRecoveryAt=new Date().toISOString();
  state.lastInsertRecoveryReason=text;
  return false;
}

async function videoSourceWatchdogTickR749(){
  if(stopping||videoSourceRecoveryBusyR749||stationHandoffActiveR804)return;
  if(!publisher||publisher.exitCode!==null)return;
  // R753: after clip EOF the next MP3 owns the ONLY normal-feeder start. Do not race
  // that boundary with the old generic recovery feeder; it caused a second stop/start
  // a few milliseconds later and could stall the persistent H264 pipe.
  if(clipToTrackBoundaryPendingR753){
    const age=Date.now()-Number(clipToTrackBoundaryPendingR753.startedAt||0);
    if(age<CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753)return;
    state.lastWarning=`R753 clip→track handoff exceeded ${age}ms; watchdog recovery allowed`;
    clipToTrackBoundaryPendingR753=null;
  }
  const normalAlive=Boolean(videoFeeder&&videoFeeder.exitCode===null);
  const preparedAlive=Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null);
  const unifiedClipAlive=Boolean(clipPublisher&&clipPublisher.exitCode===null&&clipPublisher.__r752UnifiedAV===true&&clipPublisher.__r752Live===true);
  if(normalAlive||preparedAlive||unifiedClipAlive){videoSourceMissingSinceR749=0;return;}
  const now=Date.now();
  if(!videoSourceMissingSinceR749){videoSourceMissingSinceR749=now;return;}
  if(now-videoSourceMissingSinceR749<VIDEO_SOURCE_STUCK_MS_R749)return;
  videoSourceRecoveryBusyR749=true;
  try{
    insertRecoveryCountR749++;
    state.lastInsertRecoveryAt=new Date().toISOString();
    state.lastInsertRecoveryReason=`no live rawvideo feeder for ${now-videoSourceMissingSinceR749}ms`;
    state.lastError=`R749 VIDEO SOURCE WATCHDOG: ${state.lastInsertRecoveryReason}`;
    console.error('[r749-video-source-watchdog]',state.lastError);
    clipActive=false;
    await stopPreparedVideoPrerollR744().catch(()=>{});
    await ensureNormalVideoFeederR721({force:true,fadeIn:false});
    state.videoHandoffMode='R749-WATCHDOG-FORCED-NORMAL';
    videoSourceMissingSinceR749=0;
  }catch(error){
    state.lastError=`R749 VIDEO SOURCE WATCHDOG recovery failed: ${cleanText(error?.message||error)}`;
  }finally{videoSourceRecoveryBusyR749=false;}
}

async function warmClipBoundaryMetaR752(item){
  if(stopping||!item||item.type==='track')return null;
  const identity=primaryIdentity(item);
  const readyPath=preparedClipReadyNowR742(item);
  if(!readyPath)return null;
  const existing=clipBoundaryMetaR752.get(identity);
  if(existing&&existing.readyPath===readyPath)return existing;
  const [duration,hasAudio]=await Promise.all([
    probeDuration(readyPath).catch(()=>0),
    probeHasAudioR721(readyPath).catch(()=>false)
  ]);
  const meta={identity,readyPath,duration:Number(duration)||0,hasAudio:Boolean(hasAudio),warmedAt:Date.now()};
  clipBoundaryMetaR752.set(identity,meta);
  if(clipBoundaryMetaR752.size>16){
    const oldest=[...clipBoundaryMetaR752.entries()].sort((a,b)=>(a[1]?.warmedAt||0)-(b[1]?.warmedAt||0))[0];
    if(oldest)clipBoundaryMetaR752.delete(oldest[0]);
  }
  state.videoHandoffMode='R752-CACHE-META-WARM-READY-NOT-LIVE';
  return meta;
}

function streamReadableReadyR752(stream,label,child){
  return new Promise((resolve,reject)=>{
    if(!stream)return reject(new Error(`R752 ${label} stream missing`));
    if(Number(stream.readableLength||0)>0)return resolve(true);
    let done=false;
    const cleanup=()=>{
      stream.off('readable',onReadable);
      stream.off('error',onError);
      child?.off('exit',onExit);
    };
    const finish=(error)=>{if(done)return;done=true;cleanup();error?reject(error):resolve(true);};
    const onReadable=()=>finish();
    const onError=(error)=>finish(error);
    const onExit=(code,signal)=>finish(new Error(`R752 clip exited before ${label} ready: ${code??signal??'exit'}`));
    stream.once('readable',onReadable);
    stream.once('error',onError);
    child?.once('exit',onExit);
  });
}


// ============================================================
// R1120 REAL FIRST-VIDEO DELAY
//
// The old sleep-only method could leave child.stdout unread.
// This version actively consumes COMPLETE raw-video frames while
// PCM audio continues toward the persistent master.
//
// Nothing is sent to the publisher during the prebuffer window.
// The old MP3 visual therefore remains visible.
//
// After the real delay expires, buffered frames are fed into the
// existing R1085 videoSink, then the normal R816 live relay takes
// over.
//
// AUDIO IS NEVER BUFFERED / CUT / STRETCHED / DELAYED HERE.
// ============================================================

async function prebufferRealVideoStartR1120(child,delayMs){
  const source=child?.stdout;

  if(
    !source ||
    source.destroyed ||
    source.readableEnded
  ){
    throw new Error('R1120 video source unavailable');
  }

  const wantedMs=Math.max(0,Number(delayMs)||0);
  const frames=[];
  let frameParts=[];
  let frameBytes=0;
  let expired=false;
  let settled=false;
  let delayTimer=null;
  let watchdog=null;

  const startedAt=Date.now();

  return await new Promise((resolve,reject)=>{

    const cleanup=()=>{
      if(delayTimer)clearTimeout(delayTimer);
      if(watchdog)clearTimeout(watchdog);

      try{source.off('data',onData)}catch(_){ }
      try{source.off('error',onError)}catch(_){ }
      try{child.off('exit',onExit)}catch(_){ }
    };

    const finish=(remainder=null)=>{
      if(settled)return;
      settled=true;

      try{source.pause()}catch(_){ }
      cleanup();

      // Put any bytes AFTER the last complete buffered frame
      // back into stdout so R816 receives a perfectly aligned
      // rawvideo stream when it attaches.
      if(remainder && remainder.length){
        try{source.unshift(remainder)}catch(error){
          return reject(
            new Error(
              `R1120 rawvideo unshift failed: ${String(error?.message||error)}`
            )
          );
        }
      }

      child.__r1120BufferedVideoFrames=frames;
      child.__r1120BufferedVideoStartedAt=startedAt;
      child.__r1120BufferedVideoFinishedAt=Date.now();

      const actualMs=Date.now()-startedAt;

      state.realVideoStartDelayR1120={
        requestedMs:wantedMs,
        actualMs,
        frames:frames.length,
        bytes:frames.length*VIDEO_FRAME_BYTES_R816,
        childPid:Number(child.pid||0)
      };

      diagRecordR802(
        'r1120-real-video-prebuffer-ready',
        {
          childPid:Number(child.pid||0),
          requestedMs:wantedMs,
          actualMs,
          frames:frames.length
        }
      );

      resolve({
        frames:frames.length,
        actualMs
      });
    };

    const onError=(error)=>{
      if(settled)return;
      settled=true;
      cleanup();
      reject(error);
    };

    const onExit=(code,signal)=>{
      if(settled)return;
      settled=true;
      cleanup();
      reject(
        new Error(
          `R1120 child exited during video prebuffer: ${code??signal??'exit'}`
        )
      );
    };

    const onData=(chunk)=>{
      if(settled || !chunk?.length)return;

      let offset=0;

      while(offset<chunk.length && !settled){

        const need=VIDEO_FRAME_BYTES_R816-frameBytes;
        const take=Math.min(need,chunk.length-offset);

        frameParts.push(chunk.subarray(offset,offset+take));
        frameBytes+=take;
        offset+=take;

        if(frameBytes===VIDEO_FRAME_BYTES_R816){

          const frame=
            frameParts.length===1
              ? frameParts[0]
              : Buffer.concat(
                  frameParts,
                  VIDEO_FRAME_BYTES_R816
                );

          frames.push(frame);

          frameParts=[];
          frameBytes=0;

          // End ONLY on a full-frame boundary.
          // Any remaining bytes from this chunk go back to stdout.
          if(expired || Date.now()-startedAt>=wantedMs){
            const remainder=
              offset<chunk.length
                ? chunk.subarray(offset)
                : null;

            finish(remainder);
            return;
          }
        }
      }
    };

    source.on('data',onData);
    source.once('error',onError);
    child.once('exit',onExit);

    // data listener puts the stream into flowing mode,
    // but resume explicitly for clarity.
    try{source.resume()}catch(_){ }

    delayTimer=setTimeout(()=>{
      expired=true;

      // If we happen to be exactly between frames,
      // we can finish immediately.
      if(frameBytes===0 && frames.length>0){
        finish(null);
      }
    },wantedMs);

    delayTimer.unref?.();

    // Safety only. Never wait forever for a broken producer.
    watchdog=setTimeout(()=>{
      if(settled)return;

      settled=true;
      cleanup();

      reject(
        new Error(
          `R1120 video prebuffer timeout after ${wantedMs+2000}ms`
        )
      );
    },wantedMs+2000);

    watchdog.unref?.();
  });
}


async function flushRealVideoStartR1120(child,videoSink){

  const frames=
    Array.isArray(child?.__r1120BufferedVideoFrames)
      ? child.__r1120BufferedVideoFrames
      : [];

  child.__r1120BufferedVideoFrames=[];

  if(!frames.length)return 0;

  let written=0;

  for(const frame of frames){

    if(
      !videoSink ||
      videoSink.destroyed ||
      videoSink.writableEnded
    ){
      throw new Error(
        'R1120 publisher video sink unavailable during flush'
      );
    }

    const ok=videoSink.write(frame);
    written++;

    if(!ok){
      await new Promise((resolve,reject)=>{
        let done=false;

        const cleanup=()=>{
          try{videoSink.off('drain',onDrain)}catch(_){ }
          try{videoSink.off('error',onError)}catch(_){ }
        };

        const onDrain=()=>{
          if(done)return;
          done=true;
          cleanup();
          resolve();
        };

        const onError=(error)=>{
          if(done)return;
          done=true;
          cleanup();
          reject(error);
        };

        videoSink.once('drain',onDrain);
        videoSink.once('error',onError);
      });
    }
  }

  state.realVideoStartFlushR1120={
    at:new Date().toISOString(),
    frames:written,
    childPid:Number(child?.pid||0)
  };

  diagRecordR802(
    'r1120-real-video-buffer-flushed',
    {
      childPid:Number(child?.pid||0),
      frames:written
    }
  );

  return written;
}


// ============================================================
// R1123-R1085-PCM-PHASE-PACER
//
// Keep the proven R1120 ~950ms content prebuffer and the exact first-frame
// promotion point, but remove the independent 40ms JS timeline.
//
// R1085 PCM byte-count remains the one master clock. During an insert only,
// R1085's synthetic DROP/DUP layer is suspended and this relay releases ONE
// real buffered source frame when the R1085 audio-video lead reaches the
// calibrated 2.000s target. No audio samples are changed or rebased.
//
// If the Node event loop wakes late, catch-up is intentionally rate-limited
// (minimum 24ms between real video frames) instead of duplicating/freezing a
// picture or burst-flushing many frames at once.
// ============================================================

function attachAudioMasterPacedVideoRelayR1123(child,videoSink,label='video'){
  const source=child?.stdout;
  const master=publisher?.__r1085AudioMaster;

  if(!source||source.destroyed||source.readableEnded){
    throw new Error('R1123 rawvideo source unavailable');
  }
  if(!videoSink||videoSink.destroyed||videoSink.writableEnded){
    throw new Error('R1123 publisher video sink unavailable');
  }
  if(!master||!Number.isFinite(Number(master.audioBytes))||!Number.isFinite(Number(master.videoFrames))){
    throw new Error('R1123 R1085 audio master unavailable');
  }

  try{if(child.__r816VideoRelay)detachVideoFrameRelayR816(child)}catch(_){ }

  const initialFrames=Array.isArray(child.__r1120BufferedVideoFrames)
    ? child.__r1120BufferedVideoFrames.splice(0)
    : [];

  if(initialFrames.length<1){
    throw new Error('R1123 no R1120 buffered video frames to adopt');
  }

  const targetLeadSec=Number(master.targetAudioLeadSec||2.000);
  const smoothMusicClipR1135=String(label||'')==='music-clip';
  const stationInsertRelayR1142=String(label||'')==='station-insert';
  const minCatchupMs=smoothMusicClipR1135?MUSIC_CLIP_R1123_MIN_FRAME_MS_R1135:24;
  const minCatchupNs=BigInt(minCatchupMs)*1000000n;

  const relay={
    r1123:true,
    mode:smoothMusicClipR1135?'R1292-MUSIC-ABS25-FULL-END-NO-EARLY-FADE':'R1123-R1085-PCM-PHASE-PACER-R1141-NODROP',
    source,sink:videoSink,label,active:true,
    master,targetLeadSec,minCatchupMs,minCatchupNs,
    queue:initialFrames,
    maxQueueFrames:Math.max(initialFrames.length+VIDEO_FPS*2,VIDEO_FPS*3),
    frameParts:[],frameBytes:0,deferred:[],frames:0,
    waitingDrain:false,onDrain:null,onData:null,onError:null,onEnd:null,
    paceTimer:null,sourceEnded:false,tailResolve:null,tailTimer:null,
    underflows:0,overflowDrops:0,firstFrame:true,lastWriteNs:0n,
    // R1290: normal music clips use an absolute 25fps wall-clock deadline.
    // This compensates setTimeout/event-loop overshoot instead of accumulating it.
    musicNextDueNsR1290:0n,musicNominalFrameNsR1290:40000000n,musicMinCatchupNsR1290:38000000n,
    musicLateMaxMsR1290:0,musicCadenceFramesR1290:0,
    sourcePausedForQueueR1141:false,queuePausesR1141:0,queueResumesR1141:0,
    stationStartFramesR1143:0,stationStartLockDoneR1143:false,
    maxLeadMs:0,minLeadMs:999999
  };

  child.__r816VideoRelay=relay;

  master.externalPacedVideoR1123=true;
  state.audioMasterExternalPacedR1123=true;
  state.audioMasterExternalPacedLabelR1123=label;

  relay.onDetachR1123=()=>{
    if(master.externalPacedVideoR1123){
      master.externalPacedVideoR1123=false;
    }
    state.audioMasterExternalPacedR1123=false;
    state.audioMasterExternalPacedLabelR1123='';
  };

  const masterLeadSec=()=>
    Number(master.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-
    Number(master.videoFrames||0)/VIDEO_FPS;

  const finishTail=()=>{
    if(!relay.tailResolve)return;
    if(!relay.sourceEnded)return;
    if(relay.queue.length>0||relay.frameBytes>0||relay.waitingDrain)return;

    const done=relay.tailResolve;
    relay.tailResolve=null;
    if(relay.tailTimer){clearTimeout(relay.tailTimer);relay.tailTimer=null;}

    diagRecordR802('r1123-pcm-paced-video-tail-drained',{
      childPid:Number(child.pid||0),
      sentFrames:Number(relay.frames||0),
      underflows:Number(relay.underflows||0),
      overflowDrops:Number(relay.overflowDrops||0),
      minLeadMs:Number(relay.minLeadMs===999999?0:relay.minLeadMs),
      maxLeadMs:Number(relay.maxLeadMs||0)
    });
    if(stationInsertRelayR1142){
      state.r1142StationTailExact={
        ...(state.r1142StationTailExact||{}),
        active:false,
        queuedFrames:0,
        drainedAt:new Date().toISOString()
      };
      diagRecordR802('r1142-station-tail-exact-drained',{
        childPid:Number(child.pid||0),
        sentFrames:Number(relay.frames||0)
      });
    }

    done(true);
  };
  relay.__finishTailR1123=finishTail;

  relay.onData=(chunk)=>{
    if(!relay.active||!chunk?.length)return;

    let offset=0;
    while(offset<chunk.length&&relay.active){
      const need=VIDEO_FRAME_BYTES_R816-relay.frameBytes;
      const take=Math.min(need,chunk.length-offset);

      relay.frameParts.push(chunk.subarray(offset,offset+take));
      relay.frameBytes+=take;
      offset+=take;

      if(relay.frameBytes===VIDEO_FRAME_BYTES_R816){
        const frame=relay.frameParts.length===1
          ? relay.frameParts[0]
          : Buffer.concat(relay.frameParts,VIDEO_FRAME_BYTES_R816);

        relay.frameParts=[];
        relay.frameBytes=0;
        relay.queue.push(frame);

        // R1141: never discard real clip frames. If the paced relay falls behind,
        // pause the rawvideo source at the frame boundary and resume after one second
        // of queue headroom is available. This preserves content order and prevents
        // the visible jump-to-middle failure seen with overflow frame dropping.
        if(relay.queue.length>=relay.maxQueueFrames){
          const remainder=offset<chunk.length?chunk.subarray(offset):null;
          try{source.pause()}catch(_){ }
          relay.sourcePausedForQueueR1141=true;
          relay.queuePausesR1141++;
          state.r1123VideoQueuePausesR1141=Number(state.r1123VideoQueuePausesR1141||0)+1;
          if(remainder&&remainder.length){
            try{source.unshift(remainder)}catch(error){
              state.lastWarning=`R1141 rawvideo remainder preserve: ${cleanText(error?.message||error)}`;
            }
          }
          return;
        }
      }
    }
  };

  relay.onError=(error)=>{
    relay.sourceEnded=true;
    state.lastWarning=`R1123 rawvideo source: ${cleanText(error?.message||error)}`;
    finishTail();
  };

  relay.onEnd=()=>{
    relay.sourceEnded=true;
    if(stationInsertRelayR1142){
      state.r1142StationTailExact={
        active:true,
        queuedFrames:Number(relay.queue.length||0),
        frameMs:STATION_TAIL_FRAME_MS_R1142,
        childPid:Number(child.pid||0),
        armedAt:new Date().toISOString()
      };
      diagRecordR802('r1142-station-tail-exact-armed',{
        childPid:Number(child.pid||0),
        queuedFrames:Number(relay.queue.length||0),
        frameMs:STATION_TAIL_FRAME_MS_R1142
      });
    }
    if(relay.frameBytes>0){
      state.videoRelayPartialBytesDropped=
        Number(state.videoRelayPartialBytesDropped||0)+Number(relay.frameBytes||0);
      relay.frameParts=[];
      relay.frameBytes=0;
    }
    finishTail();
  };

  const clearTimer=()=>{
    if(relay.paceTimer){clearTimeout(relay.paceTimer);relay.paceTimer=null;}
  };

  const scheduleIn=(ms)=>{
    if(!relay.active||relay.waitingDrain)return;
    clearTimer();
    const waitMs=Math.max(1,Math.min(60,Math.ceil(Number(ms)||1)));
    relay.paceTimer=setTimeout(tick,waitMs);
    relay.paceTimer.unref?.();
  };

  const onDrain=()=>{
    if(!relay.active)return;
    relay.waitingDrain=false;
    relay.onDrain=null;
    finishTail();
    scheduleIn(1);
  };

  function tick(){
    if(!relay.active||relay.waitingDrain)return;

    if(!relay.queue.length){
      if(relay.sourceEnded){
        finishTail();
        return;
      }
      relay.underflows++;
      state.r1123VideoUnderflows=Number(state.r1123VideoUnderflows||0)+1;
      scheduleIn(5);
      return;
    }

    const now=process.hrtime.bigint();
    const leadSec=masterLeadSec();
    const leadMs=Math.round(leadSec*1000);
    relay.maxLeadMs=Math.max(Number(relay.maxLeadMs||leadMs),leadMs);
    relay.minLeadMs=Math.min(Number(relay.minLeadMs||leadMs),leadMs);

    // Preserve the exact R1121B first-picture promotion point that already
    // tested correctly at the viewer. From frame 2 onward PCM phase rules.
    if(!relay.firstFrame){
      // R1142 STATION TAIL LOCK:
      // Once the short station FFmpeg reaches EOF, the remaining REAL buffered
      // frames are the viewer-visible ending. Do not let PCM phase catch-up run
      // those frames at 24ms and visually rush/skip the end. Drain them at the
      // exact 25fps cadence (40ms/frame). The audio-gap bridge may keep the master
      // alive, but it is no longer allowed to accelerate the station picture tail.
      const exactStationTailR1142=Boolean(stationInsertRelayR1142 && relay.sourceEnded);

      // R1160N STATION EXACT-CADENCE HOTFIX:
      // For short station bumpers/specials, submitted PCM can advance in bursts
      // when the master pipe drains. Treating that transient submitted-byte
      // deficit as viewer timing used to schedule one large deficitMs sleep,
      // visibly freezing an early/middle station frame and then letting the
      // ending arrive abruptly. Station A/V already comes from ONE -re FFmpeg,
      // so preserve its real 25fps picture cadence instead of phase-stopping it.
      // Normal music clips keep the proven R1123 PCM-phase deficit wait.
      // R1290 NORMAL MUSIC CLIP: never full-stop picture on a transient
      // submitted-PCM deficit. The audio and video come from the same -re FFmpeg;
      // stopping video here grows the rawvideo queue, eventually backpressures that
      // unified child, stalls PCM too, then causes the old freeze -> rush cycle.
      // Station behavior is preserved byte-for-byte below/around this branch.
      if(!exactStationTailR1142 && !stationInsertRelayR1142 && !smoothMusicClipR1135){
        const deficitMs=(relay.targetLeadSec-leadSec)*1000;
        if(deficitMs>1){
          scheduleIn(deficitMs);
          return;
        }
      }

      // R1141 adaptive pacing remains unchanged for normal music clips.
      // R1160N: every station frame (start + middle + tail) is constrained to
      // exact 25fps / 40ms minimum cadence. No 38ms station catch-up and no
      // full PCM-phase hold are allowed. Sink backpressure is still respected.
      const debtMsR1141=Math.max(0,(leadSec-relay.targetLeadSec)*1000);
      const stationStartLockedR1143=Boolean(
        stationInsertRelayR1142 &&
        !relay.sourceEnded &&
        Number(relay.stationStartFramesR1143||0)<STATION_START_LOCK_FRAMES_R1143
      );
      const effectiveMinMsR1141=stationInsertRelayR1142
        ? STATION_TAIL_FRAME_MS_R1142
        : ((smoothMusicClipR1135 && debtMsR1141>MUSIC_CLIP_R1123_DEBT_THRESHOLD_MS_R1141)
            ? MUSIC_CLIP_R1123_DEBT_CATCHUP_MS_R1141
            : relay.minCatchupMs);
      const effectiveMinNsR1141=BigInt(Math.max(1,Math.round(effectiveMinMsR1141)))*1000000n;
      state.r1123EffectiveMinFrameMsR1141=Number(effectiveMinMsR1141);
      state.r1123PhaseDebtMsR1141=Math.round(debtMsR1141);
      if(stationStartLockedR1143){
        state.r1143StationStartFrameLock={
          active:true,
          frames:Number(relay.stationStartFramesR1143||0),
          lockFrames:STATION_START_LOCK_FRAMES_R1143,
          frameMs:STATION_TAIL_FRAME_MS_R1142,
          leadMs:Math.round(leadSec*1000),
          childPid:Number(child.pid||0)
        };
      }
      if(exactStationTailR1142){
        state.r1142StationTailExact={
          ...(state.r1142StationTailExact||{}),
          active:true,
          queuedFrames:Number(relay.queue.length||0),
          frameMs:STATION_TAIL_FRAME_MS_R1142,
          childPid:Number(child.pid||0)
        };
      }
      if(smoothMusicClipR1135){
        // R1290 EXACT-25FPS WALL-CLOCK PACER.
        // Deadline advances by exactly 40ms per REAL frame. A late JS wake-up is
        // compensated on the following interval, so 235s can no longer drift to
        // ~23fps. Catch-up is bounded to >=38ms between visible frames, preventing
        // the user-visible fast-forward burst that the old 24ms phase recovery made.
        if(relay.lastWriteNs>0n){
          if(relay.musicNextDueNsR1290<=0n){
            relay.musicNextDueNsR1290=relay.lastWriteNs+relay.musicNominalFrameNsR1290;
          }
          const sinceNsR1290=now-relay.lastWriteNs;
          const untilDueNsR1290=relay.musicNextDueNsR1290>now
            ? relay.musicNextDueNsR1290-now
            : 0n;
          const untilMinNsR1290=sinceNsR1290<relay.musicMinCatchupNsR1290
            ? relay.musicMinCatchupNsR1290-sinceNsR1290
            : 0n;
          const waitNsR1290=untilDueNsR1290>untilMinNsR1290
            ? untilDueNsR1290
            : untilMinNsR1290;
          if(waitNsR1290>0n){
            scheduleIn(Number(waitNsR1290)/1_000_000);
            return;
          }
          const lateNsR1290=now>relay.musicNextDueNsR1290
            ? now-relay.musicNextDueNsR1290
            : 0n;
          relay.musicLateMaxMsR1290=Math.max(
            Number(relay.musicLateMaxMsR1290||0),
            Number(lateNsR1290)/1_000_000
          );
        }
      }else if(relay.lastWriteNs>0n){
        const sinceNs=now-relay.lastWriteNs;
        if(sinceNs<effectiveMinNsR1141){
          scheduleIn(Number(effectiveMinNsR1141-sinceNs)/1_000_000);
          return;
        }
      }
    }

    const frame=relay.queue.shift();

    if(relay.sourcePausedForQueueR1141 &&
       relay.queue.length<=Math.max(1,relay.maxQueueFrames-VIDEO_FPS)){
      relay.sourcePausedForQueueR1141=false;
      relay.queueResumesR1141++;
      state.r1123VideoQueueResumesR1141=Number(state.r1123VideoQueueResumesR1141||0)+1;
      try{source.resume()}catch(_){ }
    }

    const ok=videoSink.write(frame);

    relay.frames++;
    if(stationInsertRelayR1142 && !relay.sourceEnded){
      relay.stationStartFramesR1143=Number(relay.stationStartFramesR1143||0)+1;
      if(!relay.stationStartLockDoneR1143 && relay.stationStartFramesR1143>=STATION_START_LOCK_FRAMES_R1143){
        relay.stationStartLockDoneR1143=true;
        state.r1143StationStartFrameLock={
          active:false,
          frames:Number(relay.stationStartFramesR1143||0),
          lockFrames:STATION_START_LOCK_FRAMES_R1143,
          frameMs:STATION_TAIL_FRAME_MS_R1142,
          completedAt:new Date().toISOString(),
          childPid:Number(child.pid||0)
        };
        diagRecordR802('r1143-station-start-frame-lock-complete',{
          childPid:Number(child.pid||0),
          frames:Number(relay.stationStartFramesR1143||0),
          frameMs:STATION_TAIL_FRAME_MS_R1142
        });
      }
    }
    relay.firstFrame=false;
    relay.lastWriteNs=process.hrtime.bigint();
    if(smoothMusicClipR1135){
      relay.musicCadenceFramesR1290=Number(relay.musicCadenceFramesR1290||0)+1;
      if(relay.musicNextDueNsR1290<=0n){
        relay.musicNextDueNsR1290=relay.lastWriteNs+relay.musicNominalFrameNsR1290;
      }else{
        relay.musicNextDueNsR1290+=relay.musicNominalFrameNsR1290;
        // If the event loop was blocked for a long time, do not burst dozens of
        // queued frames. Re-anchor only after >1s lateness; normal late wakes are
        // recovered smoothly by the 38ms bounded catch-up above.
        const hardLateNsR1290=relay.lastWriteNs-relay.musicNextDueNsR1290;
        if(hardLateNsR1290>1000000000n){
          relay.musicNextDueNsR1290=relay.lastWriteNs+relay.musicNominalFrameNsR1290;
          state.r1290MusicCadenceHardReanchors=Number(state.r1290MusicCadenceHardReanchors||0)+1;
        }
      }
    }

    state.videoRelayFramesWritten=Number(state.videoRelayFramesWritten||0)+1;
    state.lastVideoFrameAtR816=new Date().toISOString();

    const afterLeadMs=Math.round(masterLeadSec()*1000);
    state.r1123PcmPacedVideo={
      mode:relay.mode,label,
      queuedFrames:Number(relay.queue.length||0),
      sentFrames:Number(relay.frames||0),
      underflows:Number(relay.underflows||0),
      overflowDrops:Number(relay.overflowDrops||0),
      queuePausesR1141:Number(relay.queuePausesR1141||0),
      queueResumesR1141:Number(relay.queueResumesR1141||0),
      sourcePausedForQueueR1141:Boolean(relay.sourcePausedForQueueR1141),
      leadMs:afterLeadMs,
      targetLeadMs:Math.round(relay.targetLeadSec*1000),
      sourceEnded:Boolean(relay.sourceEnded),
      childPid:Number(child.pid||0),
      exact25WallClockR1290:Boolean(smoothMusicClipR1135),
      cadenceFramesR1290:Number(relay.musicCadenceFramesR1290||0),
      cadenceLateMaxMsR1290:Number(Number(relay.musicLateMaxMsR1290||0).toFixed(1))
    };

    if(!ok){
      relay.waitingDrain=true;
      relay.onDrain=onDrain;
      videoSink.once('drain',onDrain);
      return;
    }

    finishTail();

    // R1291: music clips schedule the next absolute 25fps deadline directly.
    // Avoid the old extra 1ms wake + second timer per frame; that extra wake could
    // add visible micro-jitter on a busy 2-vCPU VPS. Recovery remains gentle: no
    // visible interval is intentionally shortened below 38ms.
    if(smoothMusicClipR1135){
      const nowAfterR1291=process.hrtime.bigint();
      const sinceNsR1291=nowAfterR1291-relay.lastWriteNs;
      const untilDueNsR1291=relay.musicNextDueNsR1290>nowAfterR1291
        ? relay.musicNextDueNsR1290-nowAfterR1291
        : 0n;
      const untilMinNsR1291=sinceNsR1291<relay.musicMinCatchupNsR1290
        ? relay.musicMinCatchupNsR1290-sinceNsR1291
        : 0n;
      const waitNsR1291=untilDueNsR1291>untilMinNsR1291
        ? untilDueNsR1291
        : untilMinNsR1291;
      scheduleIn(Math.max(1,Number(waitNsR1291)/1_000_000));
    }else{
      // Station/other insert behavior remains unchanged.
      scheduleIn(1);
    }
  }

  source.on('data',relay.onData);
  source.on('error',relay.onError);
  source.on('end',relay.onEnd);

  diagRecordR802('r1123-pcm-paced-video-promoted',{
    childPid:Number(child.pid||0),label,
    bufferedFrames:Number(relay.queue.length||0),
    targetLeadMs:Math.round(relay.targetLeadSec*1000),
    catchupMinMs:minCatchupMs,
    startLeadMs:Math.round(masterLeadSec()*1000),
    stationStartLockFramesR1143:stationInsertRelayR1142?STATION_START_LOCK_FRAMES_R1143:0,
    stationStartFrameMsR1143:stationInsertRelayR1142?STATION_TAIL_FRAME_MS_R1142:0,
    stationCadenceR1160N:stationInsertRelayR1142?'EXACT-25FPS-NO-PCM-PHASE-HOLD':''
  });

  try{source.resume()}catch(_){ }

  // Same visible start point as R1121B: frame 1 is released immediately.
  tick();
  return true;
}

function waitAudioMasterPacedVideoTailR1123(child,timeoutMs=4000){
  const relay=child?.__r816VideoRelay;
  if(!relay?.r1123)return Promise.resolve(true);

  if(relay.sourceEnded&&relay.queue.length===0&&relay.frameBytes===0&&!relay.waitingDrain){
    return Promise.resolve(true);
  }

  return new Promise(resolve=>{
    relay.tailResolve=resolve;
    relay.tailTimer=setTimeout(()=>{
      relay.tailTimer=null;
      if(relay.tailResolve){
        relay.tailResolve=null;
        state.lastWarning=`R1123 paced tail timeout queue=${relay.queue.length}`;
        diagRecordR802('r1123-pcm-paced-video-tail-timeout',{
          childPid:Number(child.pid||0),
          queuedFrames:Number(relay.queue.length||0),
          sourceEnded:Boolean(relay.sourceEnded),
          leadMs:Math.round(masterLeadSecR1123(relay)*1000)
        });
        resolve(false);
      }
    },Math.max(1000,Number(timeoutMs)||4000));
    relay.tailTimer.unref?.();
    try{relay.__finishTailR1123?.()}catch(_){ }
  });
}

function masterLeadSecR1123(relay){
  const master=relay?.master;
  if(!master)return 0;
  return Number(master.audioBytes||0)/(AUDIO_SAMPLE_RATE*4)-Number(master.videoFrames||0)/VIDEO_FPS;
}


function detachNormalVideoAtBoundaryR752(){
  const active=videoFeeder;
  if(!active)return;
  active.__r816IntentionalStop=true;
  const cut=detachVideoFrameRelayR816(active);
  if(videoFeeder===active)videoFeeder=null;
  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;
  if(active.exitCode===null){
    try{active.kill('SIGTERM')}catch(_){ }
    const killer=setTimeout(()=>{if(active.exitCode===null){try{active.kill('SIGKILL')}catch(_){ }}},700);
    killer.unref?.();
  }
  if(Number(cut?.dropped||0)>0)diagRecordR802('r816-boundary-partial-frame-dropped',{pid:Number(active.pid||0),bytes:Number(cut.dropped||0)});
}

async function playVideoClipR691(previous,item,next,nextListenerPreviewR1135=null,followingAfterNextR1136=null){
  const itemId=primaryIdentity(item);
  if(suppressedVideoIdentityR744&&suppressedVideoIdentityR744===itemId){
    suppressedVideoIdentityR744='';state.suppressedVideoInsert='';state.lastError='';
    console.error('[r752-video-skip] skipped unprepared insert after safe fallback:',shortText(item?.title||'VIDEO',40));
    return false;
  }

  let readyPath='';
  try{
    readyPath=preparedClipReadyNowR742(item);
    if(!readyPath){prefetchPreparedClipR742(item);return await abortInsertHandoffR749(item,next,`prepared cache not ready: ${shortText(item?.title||'VIDEO',40)}`);}
  }catch(error){return await abortInsertHandoffR749(item,next,`clip cache: ${cleanText(error?.message||error)}`);}

  const stationInsert=item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special');
  // R1280: a live cover transcode may use almost one whole vCPU even at nice19.
  // Freeze it before clip/station preparation so the proven R1278 station A/V timing
  // cannot be stretched by scheduler contention.
  pauseAlbumBedBuilderR1280(stationInsert?'station-handoff':'music-clip-handoff');
  if(stationInsert){
    diagRecordR802('station-preplay',{title:item.title||'STATION',media:diagMediaR802(readyPath)});

    // R822: NEVER full-decode a prepared station MP4 at the LIVE boundary.
    // The R791 prepared cache has already passed the offline integrity decode.
    const sourcePath=clipCachePathR691(item);

    if(!preparedClipValidR742(sourcePath,readyPath,item)){
      purgePreparedStationR802(sourcePath,{purgeSource:false});
      diagRecordR802('station-preplay-rebuild',{
        title:item.title||'STATION',
        error:'prepared station cache invalid'
      });

      try{
        readyPath=await ensurePreparedClipR742(item);
      }catch(rebuildError){
        diagRecordR802('station-skip-corrupt',{
          title:item.title||'STATION',
          error:cleanText(rebuildError?.message||rebuildError)
        });
        return await abortInsertHandoffR749(item,next,`R802 station media corrupt: ${cleanText(rebuildError?.message||rebuildError)}`);
      }
    }

    diagRecordR802('r822-station-preplay-no-live-decode',{title:item.title||'STATION'});
  }

  const warmedMetaR752=clipBoundaryMetaR752.get(itemId);
  const duration=(warmedMetaR752&&warmedMetaR752.readyPath===readyPath)?Number(warmedMetaR752.duration||0):await probeDuration(readyPath).catch(()=>0);
  const hasAudio=(warmedMetaR752&&warmedMetaR752.readyPath===readyPath)?Boolean(warmedMetaR752.hasAudio):await probeHasAudioR721(readyPath);
  if(!hasAudio){state.lastError=`R752 video insert skipped: audio stream missing in ${shortText(item.title||'INSERT',40)}`;return await abortInsertHandoffR749(item,next,'prepared insert has no decodable audio stream');}


  // R1156: next MP3 audio becomes PCM-ready BEHIND the live video. The first
  // chunk is parked locally; it is never written to the master until playItem()
  // claims this exact track after the insert has completely finished.
  if(next?.type==='track'){
    buildNextMp3AudioPrearmR1156(next).catch(error=>{
      state.lastWarning=`R1156 next MP3 prearm fallback: ${cleanText(error?.message||error)}`;
    });
  }

  const audioSink=publisher?.stdio?.[3];
  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!audioSink||audioSink.destroyed||audioSink.writableEnded||!videoSink||videoSink.destroyed||videoSink.writableEnded){
    state.lastError='R816 persistent A/V pipe unavailable before video insert';
    return await abortInsertHandoffR749(item,next,'persistent A/V pipe unavailable');
  }

  let child=null;
  let clipExitPromise=null;
  let stationBlackPrearmPromiseR1145=null;
  try{
    clearNextPreviewR726({invalidate:true});
    // R1135: PREVIOUS/NEXT inside a NORMAL music clip must describe listener media,
    // never a radio bumper/special insert. Station inserts themselves still keep previews off.
    const previousIsStationR1135=Boolean(previous && (
      previous.type==='bumper' || previous.type==='special' ||
      previous.sourceType==='radio-bumper' || String(previous.sourceType||'').startsWith('radio-special')
    ));
    const nextIsStationR1135=Boolean(next && (
      next.type==='bumper' || next.type==='special' ||
      next.sourceType==='radio-bumper' || String(next.sourceType||'').startsWith('radio-special')
    ));
    const previousForClipPreviewR1135=!stationInsert && previousIsStationR1135
      ? (previousTrackForPreviewR726||null)
      : previous;
    const nextForClipPreviewR1135=!stationInsert && nextIsStationR1135
      ? nextListenerPreviewR1135
      : next;
    writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,previousOverlayTextR745(previousForClipPreviewR1135));
    writeOverlayFileR726(LIVE_NEXT_FILE_R726,nextOverlayTextR736(nextForClipPreviewR1135));

    // R816: arm the insert while the outgoing MP3 rawvideo feeder remains LIVE and black.
    // Only after BOTH rawvideo and PCM outputs are readable do we cut the old frame relay.
    state.videoHandoffMode=stationInsert?'R816-STATION-ARM-BEHIND-LIVE-BLACK':'R816-CLIP-ARM-BEHIND-LIVE-BLACK';
    stationHandoffActiveR804=true;

    // R1142: if the outgoing MP3 prearmed a music clip and a station insert is
    // injected in between, do NOT carry that frozen clip child across the whole
    // station. Clear it now; R1136 will prearm the same next clip freshly from
    // the station timeline. This guarantees a clean t=0 fade/reveal after black.
    if(stationInsert && next && isVideoHandoffR738(next) &&
       insertPrearmR1069 && insertPrearmR1069.identity===primaryIdentity(next)){
      const staleAgeMsR1142=Date.now()-Number(insertPrearmR1069.startedAt||Date.now());
      await clearInsertPrearmR1069('r1142-station-next-video-fresh-rearm');
      state.lastStationNextVideoPrearmResetR1142={
        at:new Date().toISOString(),
        next:shortText(next?.title||'VIDEO',52),
        staleAgeMs:Math.max(0,staleAgeMsR1142)
      };
      diagRecordR802('r1142-station-next-video-prearm-reset',{
        next:shortText(next?.title||'VIDEO',52),
        staleAgeMs:Math.max(0,staleAgeMsR1142)
      });
    }

    const prearmR1069=takeInsertPrearmR1069(item);

    if(prearmR1069){
      child=prearmR1069.child;
    }else{
      child=spawn('ffmpeg',clipPreparedFeederArgsR742(readyPath,{hasAudio:true,duration,showPreview:!stationInsert,fadeOutToBlack:false,fadeInSeconds:stationInsert?VIDEO_INSERT_FADE_IN_SECONDS_R757:MUSIC_CLIP_FADE_IN_SECONDS_R1136,stationAudioDelayMsR871:stationAudioDelayMsR1013(item)}),{stdio:['ignore','pipe','pipe','pipe','pipe']});
      child.__r752UnifiedAV=true;
      child.__r752Live=false;
    }

    const videoSource=child.stdout;
    const audioSource=child.stdio[3];
    const progressSource=child.stdio[4];
    clipPublisher=child;producer=child;state.producerRunning=true;
    state.clipPlaybackMode='R816-ONE-FFMPEG-BOTH-READY+RAW-FULL-FRAME-RELAY+EXACT-SAMPLE-CLOCK+TAIL-LOCK';
    videoSource.on('error',()=>{});audioSource.on('error',()=>{});
    progressSource?.on('data',d=>{const line=String(d||'').trim();if(line)state.clipProgressLine=line.slice(-500);});
    progressSource?.on('error',()=>{});
    child.stderr.on('data',d=>{const line=String(d||'').trim();if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton|corrupt|missing picture|nal unit/i.test(line))state.lastError=line.slice(-700);diagFfmpegR802(stationInsert?'station-av-r816':'clip-av-r816',line);console.error('[r816-clip-av]',line);}});

    clipExitPromise=new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('exit',async(code,signal)=>{
        if(stationInsert && next?.type==='track' && code===0 && !stopping){
          stationBlackPrearmPromiseR1145=buildStationBlackPrearmR1145(next).catch(error=>{
            state.lastWarning=`R1145 station black prearm: ${cleanText(error?.message||error)}`;
            return false;
          });
        }
        if(child?.__r816VideoRelay?.r1123===true && code===0 && !stopping){
        try{startMasterAudioGapBridgeR824('r1123-pcm-paced-video-tail-drain')}catch(_){ }
        diagRecordR802('r1123-pcm-paced-video-tail-drain-start',{
          childPid:Number(child.pid||0),
          queuedFrames:Number(child?.__r816VideoRelay?.queue?.length||0)
        });
        const queuedTailFramesR1290=Number(child?.__r816VideoRelay?.queue?.length||0);
        // R1292: NEVER cut a normal clip merely because the raw-video relay accumulated
        // a long but valid tail.  The old 15s ceiling could expire while real final
        // frames were still queued on a busy 2-vCPU VPS, making the clip appear to end
        // early.  Size the wait from the exact queue and leave 8s scheduler/drain slack.
        const normalTailWaitMsR1290=Math.max(
          10000,
          Math.min(60000,Math.ceil(queuedTailFramesR1290*(1000/VIDEO_FPS)+8000))
        );
        await waitAudioMasterPacedVideoTailR1123(
          child,
          stationInsert?STATION_TAIL_WAIT_MS_R1142:normalTailWaitMsR1290
        );
      }
      if(stationBlackPrearmPromiseR1145){
        try{await stationBlackPrearmPromiseR1145}catch(_){ }
      }
      try{detachVideoFrameRelayR816(child)}catch(_){ }
        try{audioSource.unpipe(audioSink)}catch(_){ }
        if(masterAudioOwnerSourceR1160H===audioSource){
          masterAudioOwnerSourceR1160H=null;
          masterAudioOwnerSinkR1160H=null;
        }
        if(code===0||stopping)resolve();else reject(new Error(`R816 clip A/V exit ${code||signal}`));
      });
    });
    clipExitPromise.catch(()=>{});

    try{
      await promiseTimeout(Promise.all([streamReadableReadyR752(videoSource,'video',child),streamReadableReadyR752(audioSource,'audio',child)]),INSERT_AUDIO_START_TIMEOUT_MS_R749,`R816 insert A/V ready ${shortText(item.title||'VIDEO',40)}`);
    }catch(error){insertAudioStartFailuresR749++;throw new Error(`insert A/V did not become ready together: ${cleanText(error?.message||error)}`);}

    diagRecordR802(stationInsert?'station-av-ready-r816':'clip-av-ready-r816',{title:item.title||'VIDEO',childPid:Number(child.pid||0),duration:Number(duration||0)});
    if(stationInsert){
      // R821: this is the commit gate. The outgoing MP3 visual is still LIVE/black here.
      // No old-writer drain, no sink-drain wait and no retry loop is allowed before promotion.
      state.stationHandoffModeR821='R821-CANDIDATE-A+V-READY-OLD-BLACK-STILL-LIVE';
      diagRecordR802('r821-station-candidate-av-ready-no-drain',{title:item.title||'STATION',oldPid:Number(videoFeeder?.pid||0),candidatePid:Number(child.pid||0)});
    }

    // R821 station rule: make-before-break. Frame-aligned rawvideo cut happens only AFTER
    // candidate A+V readiness; the persistent x264/RTMPS master never closes and we never
    // wait for an old Annex-B/AU/sink drain. Old relay can drop only an incomplete YUV frame.
    // the persistent x264 encoder itself NEVER restarts and never receives a foreign H264 GOP.
    // R860: allow the persistent master to consume the outgoing
    // MP3 PCM tail BEFORE changing the visible source.
    // Candidate A+V is already ready; old video remains LIVE.
    const clipPreDrainMsR1002B =
      0; // R1065: remove redundant station pre-drain; keep 1500ms A/V prime

    diagRecordR802('r860-av-align-hold-start',{
      title:item.title||'VIDEO',
      station:stationInsert,
      holdMs:clipPreDrainMsR1002B
    });

    if(clipPreDrainMsR1002B>0){
      await new Promise(resolve=>
        setTimeout(resolve,clipPreDrainMsR1002B)
      );
    }

    diagRecordR802('r860-av-align-hold-complete',{
      title:item.title||'VIDEO',
      station:stationInsert,
      holdMs:clipPreDrainMsR1002B
    });

    // R917B-AUDIO-FIRST
    stopMasterAudioGapBridgeR824(
      stationInsert?'station-audio-start-r917b':'clip-audio-start-r917b'
    );

    await drainAudioGapBridgeR917B(audioSink);

    // Real PCM reaches master before picture is promoted.
    // R1025 SINGLE-AUDIO-PIPE:
    // one unified clip/station child may connect PCM to master once only.
    if(!child.__r1025AudioPiped){
      child.__r1025AudioPiped=true;
      connectMasterAudioOwnerR1160H(
        audioSource,
        audioSink,
        stationInsert?'station-insert-r1025':'music-clip-r1025'
      );
      diagRecordR802(
        stationInsert
          ? 'r1025-station-audio-pipe-once'
          : 'r1025-clip-audio-pipe-once',
        {
          title:item.title||'VIDEO',
          childPid:Number(child.pid||0),
          bumperSlot:bumperSlotR724(item)
        }
      );
    }
// R1061: clip/station PCM reaches the persistent master first.
// Viewer test after R1060 showed audio ~0.5 s behind picture.
    // R1135 NORMAL MUSIC CLIP START:
    // R1085 wants ~2000 ms audio lead. R1120 then spends ~950 ms building REAL video
    // frames while PCM keeps flowing. Therefore a normal clip primes only ~1050 ms first:
    // 1050 + 950 ~= 2000 ms. This removes the large phase surplus that R1123 previously
    // had to erase by visibly rushing through the first clip frames.
    // Station inserts retain the proven 2000 ms prime unchanged.
    // R1276: station inserts use the same calibrated math as normal music clips.
    // 1050ms audio prime + 950ms real-video prebuffer ~= 2000ms master lead.
    // The previous station value (2000+950 ~= 2950ms) is exactly why bumper audio
    // could be heard in black before its first visible frame.
    const insertAudioPrimeMsR1135=MUSIC_CLIP_AUDIO_PRIME_MS_R1135;
    await sleep(insertAudioPrimeMsR1135);

    // Keep the proven 950 ms REAL-frame prebuffer for both paths.
    await prebufferRealVideoStartR1120(child,950);

    detachNormalVideoAtBoundaryR752();
    clipActive=true;child.__r752Live=true;
    const boundaryStartedAt=Date.now();
    state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
    state.current={type:String(item.sourceType||'').startsWith('radio-special')?'special':(item.sourceType==='radio-bumper'?'bumper':'clip'),title:item.title,album:item.album,url:item.url,startedAt:new Date(boundaryStartedAt).toISOString(),duration};
    state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
    setLiveTitleR724(stationInsert?'ANDRIK METAL RADIO':currentDisplayTitleR989(item,'VIDEO'),{delayMs:0});
    // R1120: release the real buffered start through the EXISTING
    // R1085 videoSink. R1085 remains free to DROP/DUP as before.
    // R1123: keep R1120's 950ms content delay; pace from the R1085 PCM master clock.
    attachAudioMasterPacedVideoRelayR1123(
      child,
      videoSink,
      stationInsert?'station-insert':'music-clip'
    );
    stationHandoffActiveR804=false;
    state.videoHandoffMode=stationInsert?'R821-STATION-RAWVIDEO-LIVE-NO-DRAIN':'R816-CLIP-RAWVIDEO-LIVE';
    if(stationInsert){
      state.stationHandoffModeR821='R821-STATION-LIVE-NO-DRAIN';
      state.stationNoDrainPromotionsR821=Number(state.stationNoDrainPromotionsR821||0)+1;
      state.lastStationNoDrainPromotionR821={at:new Date().toISOString(),title:shortText(item.title||'STATION',52),candidatePid:Number(child.pid||0)};
      diagRecordR802('r821-station-no-drain-promoted',{title:item.title||'STATION',candidatePid:Number(child.pid||0),count:Number(state.stationNoDrainPromotionsR821||0)});
    }
    diagRecordR802('r816-insert-live-connected',{title:item.title||'VIDEO',station:stationInsert,childPid:Number(child.pid||0)});

    if(next&&next.type!=='track'){
      prefetchPreparedClipR742(next);
      const generation=++videoHandoffGenerationR744;
      const delayMs=Math.max(0,Math.round((Math.max(0,Number(duration)||0)-INSERT_CACHE_WARM_LEAD_SECONDS_R752)*1000));
      setTimeout(()=>{if(stopping||generation!==videoHandoffGenerationR744)return;if(primaryIdentity(state.current)!==itemId)return;warmClipBoundaryMetaR752(next).catch(error=>{state.lastWarning=`R752 next cache warm: ${cleanText(error?.message||error)}`;});},delayMs).unref?.();

      // R1136: prearm VIDEO -> VIDEO as well. By the time this bumper/clip ends,
      // the next video's first A+V bytes are already parked behind SIGSTOP.
      // This shortens the black hold without ever showing the MP3 visual.
      const nextVideoPrearmDelayMsR1136=Math.max(0,Math.round((Math.max(0,Number(duration)||0)-4.0)*1000));
      setTimeout(()=>{
        if(stopping||generation!==videoHandoffGenerationR744)return;
        if(primaryIdentity(state.current)!==itemId)return;
        buildInsertPrearmR1069(next,followingAfterNextR1136).catch(error=>{
          state.lastWarning=`R1136 next-video prearm fallback: ${cleanText(error?.message||error)}`;
          clearInsertPrearmR1069('r1136-next-video-prearm-error').catch(()=>{});
        });
      },nextVideoPrearmDelayMsR1136).unref?.();
    }

    // R1139 CLIP STALL GUARD:
    // The persistent master intentionally keeps ~2000ms PCM lead. A 96-packet raw PCM
    // demux queue was almost the same size as that lead, so short encoder/CPU jitter could
    // fill input #1, back-pressure the unified clip child and prevent a clean EOF.
    // R1221B: AUDIO_INPUT_QUEUE_PACKETS_R732 restored to 96; the R1085 target itself is UNCHANGED.
    //
    // Once a NORMAL music clip has already been promoted LIVE, an EOF timeout is no longer
    // treated as a reason to replay the entire 6-7 minute clip. We terminate the stuck child,
    // preserve the normal black/fade recovery in finally{}, record the incident, and advance.
    // Pre-commit failures still return false and retain the existing bounded R814 retry logic.
    const eofMarginMsR1139=stationInsert
      ? CLIP_END_GUARD_MARGIN_MS_R745
      : NORMAL_CLIP_EOF_MARGIN_MS_R1139;
    const guardMs=Math.max(12000,Math.round(Math.max(1,Number(duration)||1)*1000)+eofMarginMsR1139);
    try{
      await promiseTimeout(clipExitPromise,guardMs,`R816 clip EOF ${shortText(item.title||'VIDEO',40)}`);
    }catch(error){
      const eofReasonR1139=cleanText(error?.message||error);
      const postCommitNormalR1139=Boolean(!stationInsert && child?.__r752Live===true);

      // R1156S:
      // If a STATION already reached LIVE, a late EOF timeout is NOT
      // a failed handoff and must never be sent to the generic R814 retry.
      // Replaying an already-shown station caused VIDEO-on-VIDEO + loop.
      // Pre-commit failures remain unchanged.
      const postCommitStationR1156S=Boolean(
        stationInsert &&
        child?.__r752Live===true
      );

      if(child&&child.exitCode===null){
        try{child.kill('SIGTERM')}catch(_){ }
        if(!(await waitChildExit(child,1200))&&child.exitCode===null){
          try{child.kill('SIGKILL')}catch(_){ }
          await waitChildExit(child,250);
        }
      }

      if(postCommitStationR1156S){

        state.stationSoftEofCutsR1156S=
          Number(state.stationSoftEofCutsR1156S||0)+1;

        state.lastStationSoftEofR1156S={
          at:new Date().toISOString(),
          title:shortText(item.title||'STATION',52),
          duration:Number(duration||0),
          guardMs:Number(guardMs||0),
          reason:eofReasonR1139
        };

        state.lastWarning=
          `R1156S station soft EOF cut (no replay): ${
            shortText(item.title||'STATION',40)
          }`;

        state.lastError='';

        diagRecordR802(
          'r1156s-station-soft-eof-cut',
          {
            title:shortText(item.title||'STATION',52),
            duration:Number(duration||0),
            guardMs:Number(guardMs||0),
            reason:eofReasonR1139,
            next:shortText(next?.title||'',52),
            rtmps:Number(state.rtmpsEgressCount||0)
          }
        );

        // Station was already shown successfully.
        // Do NOT return it to the R814 retry loop.
        return !stopping;
      }

      if(postCommitNormalR1139){
        state.normalClipSoftEofCutsR1139=Number(state.normalClipSoftEofCutsR1139||0)+1;
        state.lastNormalClipSoftEofR1139={
          at:new Date().toISOString(),
          title:shortText(item.title||'VIDEO',52),
          duration:Number(duration||0),
          guardMs:Number(guardMs||0),
          reason:eofReasonR1139
        };
        state.lastWarning=`R1139 clip soft EOF cut (no replay): ${shortText(item.title||'VIDEO',40)}`;
        state.lastError='';
        diagRecordR802('r1139-normal-clip-soft-eof-cut',{
          title:shortText(item.title||'VIDEO',52),
          duration:Number(duration||0),
          guardMs:Number(guardMs||0),
          reason:eofReasonR1139,
          rtmps:Number(state.rtmpsEgressCount||0)
        });
        if(next?.type==='track'){
          clipToTrackBoundaryPendingR753={
            identity:primaryIdentity(next),
            startedAt:Date.now(),
            reason:'R1139-SOFT-EOF-TO-MP3'
          };
        }
        return !stopping;
      }

      state.lastError=`R816 clip EOF guard: ${eofReasonR1139}`;
      return false;
    }
    if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;

    // R917B-SUCCESS-VIDEO-TO-MP3
    if(next?.type==='track'){
      clipToTrackBoundaryPendingR753={
        identity:primaryIdentity(next),
        startedAt:Date.now(),
        reason:'R917B-SUCCESS-VIDEO-TO-MP3'
      };
    }
    state.lastError='';
    return !stopping;
  }catch(error){
    stationHandoffActiveR804=false;
    state.lastError=`R816 VIDEO/AUDIO boundary handoff: ${cleanText(error?.message||error)}`;
    console.error('[r816-video-clip]',error);
    if(child&&child.exitCode===null){try{child.kill('SIGTERM')}catch(_){ }}
    await abortInsertHandoffR749(item,next,cleanText(error?.message||error));
    return false;
  }finally{
    stationHandoffActiveR804=false;
    if(child){try{detachVideoFrameRelayR816(child)}catch(_){ }try{child.stdio?.[3]?.unpipe(audioSink)}catch(_){ }if(child.exitCode===null){try{child.kill('SIGTERM')}catch(_){ }}}
    if(clipPublisher===child)clipPublisher=null;
    if(producer===child)producer=null;
    state.producerRunning=false;
    clipActive=false;
    resumeAlbumBedBuilderR1280(stationInsert?'station-finished':'music-clip-finished');

    // R1084: the insert is now completely detached. If R884 was requested
    // during pre-commit, rebuild the publisher HERE before any bridge/normal
    // feeder is attached. This makes recovery and retry strictly serial.
    if(!stopping&&publisherRecoveryDeferredR1084){
      try{
        await flushDeferredPublisherRecoveryR1084();
      }catch(error){
        state.lastError=`R1084 deferred publisher recovery: ${cleanText(error?.message||error)}`;
      }
    }

    if(!stopping)startMasterAudioGapBridgeR824('video-insert-ended');
    await stopPreparedVideoPrerollR744().catch(()=>{});
    if(stationInsert && next?.type==='track'){
      try{
        const atomicBlackR1145=await claimStationBlackPrearmR1145(next);
        const bridgedR885=atomicBlackR1145
          ? true
          : await startStationToTrackBlackBridgeR885(next);

        if(!bridgedR885){
          await ensureVideoSourceAfterClipR745(next);
        }
      }catch(error){
        state.lastWarning=
          `R885 bridge fallback: ${cleanText(error?.message||error)}`;

        await ensureVideoSourceAfterClipR745(next).catch(
          recoveryError=>{
            state.lastError=
              `R816 clip end visual recovery: ${
                cleanText(
                  recoveryError?.message||
                  recoveryError
                )
              }`;
          }
        );
      }
    }else{
      await ensureVideoSourceAfterClipR745(next).catch(
        error=>{
          state.lastError=
            `R816 clip end visual recovery: ${
              cleanText(error?.message||error)
            }`;
        }
      );
    }
  }
}

function loudnessSidecarR747(localAudioPath){
  return `${localAudioPath}${LOUDNESS_CACHE_SUFFIX_R747}`;
}
function readLoudnessAnalysisR747(localAudioPath){
  try{
    const media=statSync(localAudioPath);
    const row=JSON.parse(readFileSync(loudnessSidecarR747(localAudioPath),'utf8'));
    if(Number(row?.size)!==Number(media.size))return null;
    if(Math.abs(Number(row?.mtimeMs)-Number(media.mtimeMs))>2)return null;
    for(const k of ['input_i','input_lra','input_tp','input_thresh','target_offset'])if(!Number.isFinite(Number(row?.[k])))return null;
    return row;
  }catch(_){return null;}
}
function runCaptureBothR747(command,args,{timeoutMs=12000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{stdio:['ignore','pipe','pipe']});
    let out='',err='',done=false;
    const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);error?reject(error):resolve(value)};
    const timer=setTimeout(()=>{try{child.kill('SIGKILL')}catch(_){ }finish(new Error(`${command} loudness timeout`));},timeoutMs);
    child.stdout.on('data',d=>out+=String(d));
    child.stderr.on('data',d=>err+=String(d));
    child.once('error',e=>finish(e));
    child.once('exit',code=>code===0?finish(null,{stdout:out,stderr:err}):finish(new Error(`${command} loudness exit ${code}: ${err.slice(-900)}`)));
  });
}
async function analyzeLoudnessR747(localAudioPath){
  const cached=readLoudnessAnalysisR747(localAudioPath);
  if(cached)return cached;
  const result=await runCaptureBothR747('nice',[
    '-n',String(LOUDNESS_BACKGROUND_NICE_R750),'ffmpeg',
    '-hide_banner','-nostats','-loglevel','info','-threads','1','-i',localAudioPath,
    '-map','0:a:0','-vn','-sn','-dn',
    '-af',`loudnorm=I=${TRACK_AUDIO_TARGET_I_R726}:LRA=${TRACK_AUDIO_LRA_R726}:TP=${TRACK_AUDIO_TRUE_PEAK_R726}:print_format=json`,
    '-f','null','-'
  ],{timeoutMs:LOUDNESS_ANALYSIS_TIMEOUT_MS_R747});
  const text=String(result.stderr||'');
  const matches=[...text.matchAll(/\{[\s\S]*?"target_offset"[\s\S]*?\}/g)];
  if(!matches.length)throw new Error('R747 loudnorm analysis JSON missing');
  const raw=JSON.parse(matches[matches.length-1][0]);
  const media=statSync(localAudioPath);
  const row={
    size:Number(media.size),mtimeMs:Number(media.mtimeMs),
    input_i:Number(raw.input_i),input_lra:Number(raw.input_lra),input_tp:Number(raw.input_tp),
    input_thresh:Number(raw.input_thresh),target_offset:Number(raw.target_offset),analyzedAt:new Date().toISOString()
  };
  for(const k of ['input_i','input_lra','input_tp','input_thresh','target_offset'])if(!Number.isFinite(row[k]))throw new Error(`R747 loudnorm invalid ${k}`);
  try{writeFileSync(loudnessSidecarR747(localAudioPath),JSON.stringify(row),'utf8')}catch(_){ }
  return row;
}
async function ensureLoudnessAnalysisR747(localAudioPath){
  try{return await analyzeLoudnessR747(localAudioPath)}catch(error){
    // R750: analysis failure is a warning only. Live playback immediately uses the
    // single-pass loudnorm fallback and must never be marked as an FFmpeg stream error.
    state.lastWarning=`R750 background loudness fallback: ${cleanText(error?.message||error)}`;
    console.error('[loudness-r750]',cleanText(error?.message||error));
    return null;
  }
}
function decoderArgs(localAudioPath,duration,loudness=null,startDelaySecondsR872=0){
  const delayR872=Math.max(0,Number(startDelaySecondsR872)||0);
  const delayMsR872=Math.round(delayR872*1000);
  const outStart=Math.max(0,Number(duration||0)-TRACK_AUDIO_FADE_OUT_R726);

  // R1276: never run loudnorm in realtime on the live MP3 decoder.
  // Prepared clips/stations do not do this expensive analysis on their live path either.
  // If an R747 measurement exists, preserve target loudness with one static gain.
  let gainDbR1276=0;
  if(loudness){
    const inputI=Number(loudness.input_i);
    const inputTp=Number(loudness.input_tp);
    if(Number.isFinite(inputI)&&Number.isFinite(inputTp)){
      const loudnessGain=TRACK_AUDIO_TARGET_I_R726-inputI;
      const peakSafeGain=TRACK_AUDIO_TRUE_PEAK_R726-inputTp;
      gainDbR1276=Math.max(-12,Math.min(12,loudnessGain,peakSafeGain));
    }
  }

  const af=[
    ...(Math.abs(gainDbR1276)>0.01?[`volume=${gainDbR1276.toFixed(3)}dB:precision=float`]:[]),
    ...(delayMsR872>0?[`adelay=${delayMsR872}:all=1`]:[]),
    `afade=t=in:st=${delayR872.toFixed(3)}:d=${TRACK_AUDIO_FADE_IN_R726}`,
    `afade=t=out:st=${outStart.toFixed(3)}:d=${TRACK_AUDIO_FADE_OUT_R726}`,
    `aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0`,
    `asetpts=N/SR/TB`
  ].join(',');

  return [
    '-hide_banner','-loglevel','warning',
    '-threads','1','-filter_threads','1',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err',
    '-re','-i',localAudioPath,
    '-map','0:a:0','-vn','-sn','-dn',
    '-af',af,
    '-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2',
    '-f','s16le','pipe:1'
  ];
}

function peekNextBumperR736(){
  const available=[...bumperLibrary].sort((a,b)=>bumperSlotR724(a)-bumperSlotR724(b));
  if(!available.length)return null;
  let idx=available.findIndex(x=>bumperSlotR724(x)>lastBumperSlotR724);
  if(idx<0)idx=0;
  return available[idx]||null;
}
function predictedImmediateNextR736(next,durationSeconds=0){
  const endAt=Date.now()+Math.max(0,Number(durationSeconds)||0)*1000;
  // Use the same priority as the real post-song scheduler: 60m special -> 30m special -> bumper -> queue item.
  if(specialHourlyInsertR727 && endAt-lastSpecialHourlyPlayedAtR727>=SPECIAL_HOURLY_INTERVAL_MS_R727)return specialHourlyInsertR727;
  if(specialInsertR726 && endAt-lastSpecialPlayedAtR726>=SPECIAL_INTERVAL_MS_R726)return specialInsertR726;
  if(bumperLibrary.length && songsSinceBumperR724+1>=bumperAfterSongsR724)return peekNextBumperR736()||next||null;
  return next||null;
}
function nextOverlayTextR736(item){
  if(!item)return '';
  // R1160A: PREVIOUS/NEXT are always title-only.
  // Album / Silent / cover suffixes belong ONLY to CURRENT.
  const title=item?.type==='track'
    ? previewDisplayTitleR989(item.title||'TRACK')
    : shortText(item.title||'ANDRIK',32);
  // R753: never expose internal scheduler names such as SPECIAL 30/60 or radio-bumper.
  // To the viewer every station insert is simply the ANDRIK radio ident.
  if(item.sourceType==='radio-special-30')return 'NEXT • СПЕЦВСТАВКА • 30 МИН';
  if(item.sourceType==='radio-special-60')return 'NEXT • СПЕЦВСТАВКА • 60 МИН';
  if(item.sourceType==='radio-bumper'||item.type==='bumper')return 'NEXT • ЗАСТАВКА';
  if(item.type==='clip')return `NEXT • КЛИП • ${title}`;
  return `NEXT — ${title}`;
}
function previousOverlayTextR745(item){
  if(!item)return '';
  // R1160A: PREVIOUS/NEXT are always title-only.
  // Album / Silent / cover suffixes belong ONLY to CURRENT.
  const title=item?.type==='track'
    ? previewDisplayTitleR989(item.title||'TRACK')
    : shortText(item.title||'ANDRIK',32);
  if(item.sourceType==='radio-special-30')return 'PREVIOUS • СПЕЦВСТАВКА • 30 МИН';
  if(item.sourceType==='radio-special-60')return 'PREVIOUS • СПЕЦВСТАВКА • 60 МИН';
  if(item.sourceType==='radio-bumper'||item.type==='bumper')return 'PREVIOUS • ЗАСТАВКА';
  if(item.type==='clip')return `PREVIOUS • КЛИП • ${title}`;
  return `PREVIOUS — ${title}`;
}
function currentOverlayTextR738(item){
  if(!item)return 'ANDRIK';
  if(item.sourceType==='radio-special-30')return 'СПЕЦВСТАВКА • 30 МИН';
  if(item.sourceType==='radio-special-60')return 'СПЕЦВСТАВКА • 60 МИН';
  if(item.sourceType==='radio-bumper')return 'ЗАСТАВКА';
  if(item.type==='clip')return currentDisplayTitleR989(item,'VIDEO');
  return currentDisplayTitleR989(item,'TRACK');
}
function isVideoHandoffR738(item){
  return Boolean(item && (item.type==='clip'||item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special')));
}

// R1154 ACTUAL NEXT OWNER.
//
// R736 is intentionally a start-of-song prediction. The real queue/timed-insert
// owner can still change while a long MP3 is playing. R1154 re-reads the SAME
// live scheduler inputs at the tail, instead of trusting the frozen mp3Boundary.
//
// Priority mirrors the real post-song scheduler:
//   60m special -> 30m special -> automatic bumper -> immediate queue video.
//
// For an immediate queue video (including a manually planned R943 bumper), the
// queue itself is authoritative. For the automatic bumper path we preserve the
// scheduler's !hasPlannedBumperAheadR943() gate exactly.
function actualNextVideoOwnerR1154(remainingMs=0){
  const rem=Math.max(0,Number(remainingMs)||0);
  const atBoundary=Date.now()+rem;

  const immediate=queue[queueIndex+1]||null;
  const afterImmediate=queue[queueIndex+2]||null;

  if(
    specialHourlyInsertR727 &&
    atBoundary-Number(lastSpecialHourlyPlayedAtR727||0)>=SPECIAL_HOURLY_INTERVAL_MS_R727
  ){
    return {
      item:specialHourlyInsertR727,
      afterItem:immediate,
      kind:'radio-special-60',
      source:'timed-special-60'
    };
  }

  if(
    specialInsertR726 &&
    atBoundary-Number(lastSpecialPlayedAtR726||0)>=SPECIAL_INTERVAL_MS_R726
  ){
    return {
      item:specialInsertR726,
      afterItem:immediate,
      kind:'radio-special-30',
      source:'timed-special-30'
    };
  }

  if(
    bumperLibrary.length &&
    Number(songsSinceBumperR724||0)+1>=Number(bumperAfterSongsR724||0) &&
    !hasPlannedBumperAheadR943()
  ){
    const bumper=peekNextBumperR736();
    if(bumper){
      return {
        item:bumper,
        afterItem:immediate,
        kind:'radio-bumper',
        source:'automatic-bumper'
      };
    }
  }

  if(immediate && isVideoHandoffR738(immediate)){
    return {
      item:immediate,
      afterItem:afterImmediate,
      kind:String(immediate.sourceType||immediate.type||'video'),
      source:immediate.__manualPlannedR943===true
        ? 'queue-immediate-r943'
        : 'queue-immediate'
    };
  }

  return null;
}

function scheduleActualNextPrearmR1154(child,owner,remainingMs){
  if(!child || !owner?.item || child.__r1154PrearmScheduled)return;
  if(!isVideoHandoffR738(owner.item))return;

  child.__r1154PrearmScheduled=true;
  child.__r1154ActualNextItem=owner.item;
  child.__r1154ActualNextAfterItem=owner.afterItem||null;

  // Metadata/cache warm can begin now. It never sends candidate frames LIVE.
  try{prefetchPreparedClipR742(owner.item)}catch(_){}
  warmClipBoundaryMetaR752(owner.item).catch(error=>{
    state.lastWarning=`R1154 late warm fallback: ${cleanText(error?.message||error)}`;
  });

  const delayMs=Math.max(
    0,
    Math.round(Math.max(0,Number(remainingMs)||0)-R1154_PREARM_BEFORE_END_MS)
  );

  const fire=()=>{
    if(stopping || child.exitCode!==null || child.killed)return;
    buildInsertPrearmR1069(owner.item,owner.afterItem||null).catch(error=>{
      state.lastWarning=`R1154 late prearm fallback: ${cleanText(error?.message||error)}`;
      clearInsertPrearmR1069('r1154-prearm-error').catch(()=>{});
    });
  };

  if(delayMs>0){
    child.__r1154PrearmTimer=setTimeout(fire,delayMs);
    child.__r1154PrearmTimer.unref?.();
  }else{
    fire();
  }

  diagRecordR802('r1154-actual-next-prearm-scheduled',{
    childPid:Number(child.pid||0),
    title:shortText(owner.item?.title||'VIDEO',52),
    kind:owner.kind||'video',
    source:owner.source||'runtime',
    remainingMs:Math.round(Math.max(0,Number(remainingMs)||0)),
    prearmDelayMs:delayMs
  });
}

async function playItem(previous,item,next,following,localAudioPath,nextTrackPreview=null){
  // R1281: a video prearm belongs only to the boundary that created it.
  // If a normal MP3 has started, any older stopped clip/station child is stale by definition.
  // Diagnostics caught one being claimed 378 seconds later, which froze MP3->clip handoff.
  if(insertPrearmR1069){
    await clearInsertPrearmR1069('r1281-new-mp3-clears-inherited-video-prearm').catch(()=>{});
  }
  const sourceDurationR872=await probeDuration(localAudioPath||item.url);
  const mp3StartDelaySecondsR872=Boolean(
    previous && String(previous.type||'track')==='track'
  ) ? 1.50 : 0;
  const duration=sourceDurationR872+mp3StartDelaySecondsR872;
  const actualNextR736=predictedImmediateNextR736(next,duration);
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.next=actualNextR736?{type:actualNextR736.sourceType?.startsWith('radio-special')?'special':(actualNextR736.sourceType==='radio-bumper'?'bumper':(actualNextR736.type||'track')),title:actualNextR736.title,album:actualNextR736.album||'',url:actualNextR736.url||''}:null;

  // R1130: only a normal MP3 boundary consumes the armed master-video change.
  // The local slot file was atomically replaced by the agent beforehand, so the
  // outgoing feeder keeps playing the old inode until this exact track start.
  consumeVisualNextTrackR1130(item);

  // R732: write the exact three labels BEFORE spawning this song's feeder.
  // The bounded raw-audio input queue prevents the radio loop from getting tens of seconds
  // ahead of what the listener actually hears. PREVIOUS/NEXT remain FFmpeg-frame-timed; R736 NEXT is the actual immediate item.
  // R731: write the exact three labels BEFORE spawning this song's feeder. Normal
  // feeders load them once and FFmpeg itself reveals PREVIOUS/NEXT only at T-8s.
  // No Node wall-clock timer can get ahead of the audio anymore.
  clearNextPreviewR726({invalidate:true});
  // R745: PREVIOUS must mean the item that ACTUALLY played immediately before this one.
  // The old R733 track-only fallback could show an older song after a clip and therefore lie.
  const previousIsStationR1059=Boolean(
    previous && (
      previous.type==='bumper' ||
      previous.sourceType==='radio-bumper' ||
      String(previous.sourceType||'').startsWith('radio-special')
    )
  );

  const previousForListenerR1059=
    previousIsStationR1059
      ? previousTrackFallbackR733(previous)
      : (previous||previousTrackFallbackR733(previous));

  const nextIsStationR1059=Boolean(
    actualNextR736 && (
      actualNextR736.type==='bumper' ||
      actualNextR736.sourceType==='radio-bumper' ||
      String(actualNextR736.sourceType||'').startsWith('radio-special')
    )
  );

  const nextForListenerR1059=
    nextIsStationR1059
      ? nextTrackPreview
      : actualNextR736;

  writeOverlayFileR726(LIVE_CURRENT_FILE,currentDisplayTitleR989(item,'TRACK'));
  writeOverlayFileR726(
    LIVE_PREVIOUS_FILE_R726,
    previousOverlayTextR745(previousForListenerR1059)
  );
  writeOverlayFileR726(
    LIVE_NEXT_FILE_R726,
    nextOverlayTextR736(nextForListenerR1059)
  );
  // R790: preload the exact next CURRENT title into a separate immutable textfile.
  // FFmpeg itself selects this file by feeder PTS during the black phase; Node never
  // changes LIVE_CURRENT_FILE early anymore.
  // R826 TITLE BLACK LOCK:
  // NEVER reveal NEXT as the large CURRENT title on the outgoing MP3.
  // The outgoing feeder keeps its own CURRENT all the way into full black.
  // The incoming feeder owns the new CURRENT and reveals it from black.
  // Small PREVIOUS/NEXT preview remains untouched.
  const boundaryTitleSwitchAtR790=0;
  writeOverlayFileR726(LIVE_BOUNDARY_TITLE_FILE_R790,'');
  state.titleBoundarySwitchTarget=boundaryTitleSwitchAtR790>0?shortText(actualNextR736.title||'TRACK',52):'';
  state.titleBoundarySwitchScheduledAt=boundaryTitleSwitchAtR790>0?`PTS=${boundaryTitleSwitchAtR790.toFixed(3)}s`:null;
  state.titleBoundarySwitchFiredAt=null;

  // R750: NEVER wait for loudness analysis on the live path. Use cached two-pass
  // measurements when available; otherwise start immediately with the safe single-pass
  // loudnorm filter and analyze this file later at low priority for its next play.
  const loudnessR747=readLoudnessAnalysisR747(localAudioPath);
  state.currentLoudnessMode=loudnessR747?'R1276-MEASURED-STATIC-GAIN':'R1276-UNITY-NO-LIVE-LOUDNORM';
  state.currentMeasuredInputLufs=loudnessR747?Number(loudnessR747.input_i):null;
  if(!loudnessR747 && BACKGROUND_LOUDNESS_ENABLED_R791){const t=setTimeout(()=>scheduleLoudnessAnalysisR750(localAudioPath),5000);t.unref?.();}

  // R747: MP3->MP3 uses the proven R743 exact feeder clock. A normal feeder may be
  // pre-rolled only when the PREVIOUS item was a real video insert; that preroll now
  // has trackDuration=duration+lead, so its T-8/fade absolute times still match audio.
  const currentIdentityR744=primaryIdentity(item);
  const clipToTrackBoundaryR753=Boolean(
    clipToTrackBoundaryPendingR753 && clipToTrackBoundaryPendingR753.identity===currentIdentityR744
  );
  const currentVideoPrerolledR744=Boolean(
    videoFeeder && videoFeeder.exitCode===null && videoFeederTrackIdentityR744===currentIdentityR744 && videoFeederPrerolledR744
  );
  // R975B-FIRST-PCM-VISUAL-GATE
  //
  // Existing R885 already provides the black bridge after a
  // station/clip. Keep that bridge visible until MP3 produces
  // its first REAL PCM chunk.
  const clipToMp3PcmGateR975B = Boolean(
    (
      typeof previous !== 'undefined' &&
      previous &&
      String(previous.type || 'track') !== 'track'
    ) ||
    String(state?.videoHandoffMode || '').toLowerCase().includes('black') ||
    String(
      typeof videoFeederPath !== 'undefined'
        ? videoFeederPath
        : ''
    ).toLowerCase().includes('black')
  );

  const nextMp3AudioClaimR1156=clipToMp3PcmGateR975B
    ? claimNextMp3AudioPrearmR1156(item,localAudioPath)
    : null;

  // R763: keep the proven R753 alpha-mask architecture but extend the cinematic timing.
  // The old MP3 feeder owns the transition: start 1.0 s earlier than R762, 0.65 s darken,
  // 0.05 s black hold, then a clearly visible 0.80 s recovery. Do NOT add a second fade-in on the next MP3.
  // Only MP3→real-video keeps R757's black hold through the boundary.
  // R816: every MP3→MP3 boundary is now split only at the RAW-FRAME layer:
  // OLD raw feeder fades TO BLACK; NEW raw feeder fades FROM BLACK. The one persistent
  // H.264 encoder never changes, so GOP/DPB/SPS/PPS state remains continuous.
  const mp3ToMp3BoundaryR809=Boolean(actualNextR736 && actualNextR736.type==='track');
  const endFadeToBlackR760=Boolean(actualNextR736 && (isVideoHandoffR738(actualNextR736)||mp3ToMp3BoundaryR809));
  const mp3FromMp3R809=Boolean(previous && String(previous.type||'track')==='track' && !clipToTrackBoundaryR753);
  state.mp3BoundaryFadeMode=mp3ToMp3BoundaryR809
    ? 'R816-OLD-RAWVIDEO-TO-BLACK+NEW-RAWVIDEO-FROM-BLACK'
    : (endFadeToBlackR760?'R813-TO-VIDEO-BLACK':'R806-IN-FEEDER-FADE');
  diagRecordR802('mp3-r816-boundary-fade-armed',{
    track:shortText(item.title||'TRACK',52),
    duration:Number(duration.toFixed(3)),
    nextType:String(actualNextR736?.type||actualNextR736?.sourceType||''),
    fadeOut:mp3ToMp3BoundaryR809?MP3_BOUNDARY_FADE_OUT_SECONDS_R814:VIDEO_FADE_SECONDS_R726,
    blackHold:mp3ToMp3BoundaryR809?MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814:VIDEO_BLACK_HOLD_SECONDS_R736,
    nextFadeIn:mp3ToMp3BoundaryR809?MP3_BOUNDARY_FADE_IN_SECONDS_R814:(clipToTrackBoundaryR753?CLIP_TO_TRACK_FADE_IN_SECONDS_R753:0),
    lead:mp3ToMp3BoundaryR809?0.00:VIDEO_FADE_LEAD_SECONDS_R735,
    mode:state.mp3BoundaryFadeMode
  });
  if(!currentVideoPrerolledR744 && !clipToMp3PcmGateR975B){
    const feederChangedR816=await ensureNormalVideoFeederR721({
      force:true,
      fadeIn:(clipToTrackBoundaryR753||mp3FromMp3R809),
      fadeInSeconds:mp3FromMp3R809?MP3_BOUNDARY_FADE_IN_SECONDS_R814:CLIP_TO_TRACK_FADE_IN_SECONDS_R753,
      endFadeToBlack:endFadeToBlackR760,
      mp3Boundary:mp3ToMp3BoundaryR809,
      trackDuration:duration+(
        mp3ToMp3BoundaryR809
          ? MP3_TO_VIDEO_TAIL_GUARD_MS_R972/1000 + MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814
          : (
              isVideoHandoffR738(actualNextR736)
                ? (
                    actualNextR736?.sourceType==='radio-bumper' ||
                    String(actualNextR736?.sourceType||'').startsWith('radio-special')
                      ? 0.000 // R1070: station fade follows real MP3 end; no +500ms visual tail
                      : 0
                  )
                : 0
            )
      ),
      previewReload:false,
      boundaryTitleSwitchAt:boundaryTitleSwitchAtR790,
      visualItem:item
    });
    if(feederChangedR816===false && videoFeeder && videoFeeder.exitCode===null){
      // Candidate failed BEFORE old was touched. Keep the proven old black/live raw feeder
      // rather than starving the persistent rawvideo master. Audio may continue; watchdog stays fed.
      state.lastWarning=state.lastWarning||'R816 rawvideo candidate not promoted; previous black feeder kept LIVE';
    }
    videoFeederTrackIdentityR744=currentIdentityR744;
    videoFeederPrerolledR744=false;
  }
  if(clipToTrackBoundaryR753){
    clipToTrackBoundaryPendingR753=null;
    state.videoHandoffMode='R753-CLIP-TO-MP3-SINGLE-FEEDER-LIVE';
  }

  const audioSink=publisher?.stdio?.[3];
  if(!publisher || publisher.exitCode!==null || !audioSink || audioSink.destroyed) throw new Error('master audio pipe unavailable');

  const mediaStartedAt=Date.now();
  state.current={type:item.type||'track',sourceType:item.sourceType||'',title:item.title,album:item.album||'',key:item.key||'',url:item.url,startedAt:new Date(mediaStartedAt).toISOString(),duration};
  const currentIdentity=primaryIdentity(state.current);
  setLiveTitleR724(currentDisplayTitleR989(item,'TRACK'),{delayMs:0});
  // R790: MP3→MP3 title switching is inside the FFmpeg filtergraph and uses the same
  // feeder PTS as the black alpha mask. No setTimeout/Date.now title handoff exists.
  if(boundaryTitleSwitchAtR790>0)state.titleBoundarySwitchCount=Number(state.titleBoundarySwitchCount||0)+1;
  if(actualNextR736 && isVideoHandoffR738(actualNextR736)){
    scheduleTrackVideoHandoffR744(item,actualNextR736,next,following,duration);
  }
  // R743: NEVER preload the future CURRENT into the old song. The next track/clip
  // writes its own CURRENT exactly when its feeder is created. This restores the
  // R732 behavior that previously matched the audible handoff.
  // PREVIOUS/NEXT remain FFmpeg-frame-timed in the final 8 seconds.

  state.producerRunning=true;
  producer=nextMp3AudioClaimR1156?.child || spawn('ffmpeg',decoderArgs(localAudioPath,duration,loudnessR747,mp3StartDelaySecondsR872),{stdio:['ignore','pipe','pipe']});
  if(nextMp3AudioClaimR1156?.firstChunk){
    // Put the already-proven first PCM bytes back at the head of the SAME stream.
    // The existing first-PCM gate below therefore fires immediately and audio order
    // stays byte-exact; no sample is played early or discarded.
    try{
      producer.stdout.unshift(nextMp3AudioClaimR1156.firstChunk);
      nextMp3AudioClaimR1156.firstChunk=null;
      state.videoHandoffMode='R1156-NEXT-MP3-PCM-PREARM-CLAIMED';
    }catch(error){
      state.lastWarning=`R1156 PCM unshift fallback: ${cleanText(error?.message||error)}`;
    }
  }
  producer.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      const brokenArtProbe=/Invalid PNG signature|Could not find codec parameters for stream 1 \(Video: png/i.test(line);
      if(!brokenArtProbe && /error|fail|invalid|corrupt/i.test(line))state.lastError=line.slice(-700);
      if(!brokenArtProbe)console.error('[decoder]',line);
    }
  });

  let playedOkR726=false;
  try{
    await new Promise((resolve,reject)=>{
      const source=producer.stdout;

      // R1293 MP3 PCM RESERVOIR:
      // 44.1kHz stereo s16le = 176400 bytes/sec. PassThrough still forwards immediately
      // in the steady state (zero intentional delay), but it can now absorb up to 8 s
      // of short master/audio-pipe backpressure without pausing the realtime MP3 decoder.
      // This does NOT change FFmpeg AUDIO_INPUT_QUEUE_PACKETS_R732, AAC, PTS or RTMPS.
      const audioReservoirR1272=new PassThrough({
        writableHighWaterMark:MP3_PCM_RESERVOIR_BYTES_R1293,
        readableHighWaterMark:MP3_PCM_RESERVOIR_BYTES_R1293
      });
      state.mp3AudioReservoirModeR1272=`R1293-${MP3_PCM_RESERVOIR_SECONDS_R1293}S-PASSTHROUGH-ZERO-DELAY`;
      state.mp3AudioReservoirHighWaterBytesR1272=MP3_PCM_RESERVOIR_BYTES_R1293;
      state.mp3AudioReservoirSecondsR1293=MP3_PCM_RESERVOIR_SECONDS_R1293;
      state.mp3AudioReservoirPauseCountR1272=0;

      // R1293 TRUE UNDERRUN PROBE:
      // The old R1276 probe measured gaps between decoder stdout chunks. A full reservoir
      // intentionally pauses decoder stdout, so those pauses were often logged as
      // "audible gaps" even while buffered PCM was still feeding the master. Subtract
      // intentional backpressure-pause time and only report the unbuffered remainder.
      let lastPcmChunkAtR1276=0;
      let sourcePauseStartedAtR1293=0;
      let sourcePausedMsSinceChunkR1293=0;
      const reservoirBytesR1293=()=>Number(audioReservoirR1272.readableLength||0)+Number(audioReservoirR1272.writableLength||0);
      const onSourcePauseR1272=()=>{
        if(!sourcePauseStartedAtR1293)sourcePauseStartedAtR1293=Date.now();
        state.mp3AudioReservoirPauseCountR1272=Number(state.mp3AudioReservoirPauseCountR1272||0)+1;
        state.mp3AudioReservoirBufferedBytesR1272=reservoirBytesR1293();
      };
      const onSourceResumeR1272=()=>{
        const now=Date.now();
        if(sourcePauseStartedAtR1293){
          sourcePausedMsSinceChunkR1293+=Math.max(0,now-sourcePauseStartedAtR1293);
          sourcePauseStartedAtR1293=0;
        }
        state.mp3AudioReservoirBufferedBytesR1272=reservoirBytesR1293();
      };
      const onPcmGapProbeR1276=chunk=>{
        const now=Date.now();
        if(sourcePauseStartedAtR1293){
          sourcePausedMsSinceChunkR1293+=Math.max(0,now-sourcePauseStartedAtR1293);
          sourcePauseStartedAtR1293=now;
        }
        if(lastPcmChunkAtR1276>0){
          const rawGap=now-lastPcmChunkAtR1276;
          const intentionalPause=Math.min(rawGap,Math.max(0,sourcePausedMsSinceChunkR1293));
          const trueGap=Math.max(0,rawGap-intentionalPause);
          const buffered=reservoirBytesR1293();
          state.mp3PcmLastGapMsR1276=rawGap;
          state.mp3PcmLastTrueUnderrunMsR1293=trueGap;
          state.mp3PcmMaxGapMsR1276=Math.max(Number(state.mp3PcmMaxGapMsR1276||0),rawGap);
          state.mp3PcmMaxTrueUnderrunMsR1293=Math.max(Number(state.mp3PcmMaxTrueUnderrunMsR1293||0),trueGap);
          state.mp3AudioReservoirBufferedBytesR1272=buffered;
          if(trueGap>=120){
            state.mp3PcmAudibleGapCountR1276=Number(state.mp3PcmAudibleGapCountR1276||0)+1;
            state.mp3PcmLastAudibleGapR1276={
              at:new Date().toISOString(),
              gapMs:trueGap,rawDecoderGapMs:rawGap,backpressurePauseMs:intentionalPause,
              reservoirBufferedBytes:buffered,reservoirSeconds:MP3_PCM_RESERVOIR_SECONDS_R1293,
              bytes:Number(chunk?.length||0),track:shortText(item?.title||'',52),
              producerPid:Number(producer?.pid||0),audioQueued:Number(audioSink?.writableLength||0),
              audioNeedsDrain:Boolean(audioSink?.writableNeedDrain)
            };
            diagRecordR802('r1293-mp3-pcm-true-underrun',state.mp3PcmLastAudibleGapR1276);
          }
        }
        sourcePausedMsSinceChunkR1293=0;
        lastPcmChunkAtR1276=now;
      };
      source.on('data',onPcmGapProbeR1276);
      source.on('pause',onSourcePauseR1272);
      source.on('resume',onSourceResumeR1272);

      // R769: commit the promised normal NEXT only when THIS track has actually begun
      // producing PCM. On the same first PCM chunk, clear a checkpoint that belongs to
      // this item (recovered after a restart), then checkpoint the newly promised NEXT.
      let firstPcmCommittedR769=false;
      source.once('data',()=>{
        if(firstPcmCommittedR769)return;

        firstPcmCommittedR769=true;

        // R975B:
        // Silence/bridge ends only when the decoder has really
        // produced PCM. No more "picture first, sound 3 sec later".
        stopMasterAudioGapBridgeR824(
          clipToMp3PcmGateR975B
            ? 'clip-to-mp3-first-pcm-r975b'
            : 'mp3-first-pcm-r975b'
        );

        if(clipToMp3PcmGateR975B){

          state.clipToMp3FirstPcmAtR975B =
            new Date().toISOString();

          state.videoHandoffMode =
            'R975B-FIRST-PCM-VISUAL-START';

          const stationNextR984B=Boolean(
            actualNextR736 && (
              actualNextR736.sourceType==='radio-bumper' ||
              String(actualNextR736.sourceType||'').startsWith('radio-special')
            )
          );

          const tailExtraR975B = (
            typeof MP3_TO_VIDEO_TAIL_GUARD_MS_R972 !== 'undefined' &&
            actualNextR736 &&
            isVideoHandoffR738(actualNextR736)
          )
            ? (
                stationNextR984B
                  ? 0.500
                  : 0
              )
            : 0;

          const startClipToMp3VisualR1135=()=>{
            ensureNormalVideoFeederR721({
              force:true,
              fadeIn:true,
              fadeInSeconds:CLIP_TO_TRACK_FADE_IN_SECONDS_R753,
              endFadeToBlack:endFadeToBlackR760,
              mp3Boundary:mp3ToMp3BoundaryR809,
              trackDuration:Number(duration || 0)+(
                mp3ToMp3BoundaryR809
                  ? MP3_TO_VIDEO_TAIL_GUARD_MS_R972/1000 + MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814
                  : tailExtraR975B
              ),
              previewReload:false,
              boundaryTitleSwitchAt:boundaryTitleSwitchAtR790,
              visualItem:item
            }).then(()=>{

              videoFeederTrackIdentityR744 =
                currentIdentityR744;

              videoFeederPrerolledR744 = false;

              state.videoHandoffMode =
                'R1135-CLIP-TO-MP3-BLACK-HOLD+FADE-LIVE';

            }).catch(error=>{

              state.lastError =
                `R1135 clip->MP3 visual start: ${
                  cleanText(error?.message || error)
                }`;

            });
          };

          const clipToMp3HoldMsR1135=Math.max(
            0,
            Math.round(CLIP_TO_TRACK_BLACK_HOLD_SECONDS_R917B*1000)
          );
          state.clipToMp3BlackHoldMsR1135=clipToMp3HoldMsR1135;
          if(clipToMp3HoldMsR1135>0){
            const tR1135=setTimeout(startClipToMp3VisualR1135,clipToMp3HoldMsR1135);
            tR1135.unref?.();
          }else{
            startClipToMp3VisualR1135();
          }
        }

        clearCommittedNextR769(item);

        if(actualNextR736?.type==='track'){
          writeCommittedNextR769(actualNextR736);
        }
      });

      // Decoder/pipe begins immediately.
      // The callback above commits at the first real PCM chunk.
      // Listener above is already armed; now start the zero-delay reservoir path.
      source.pipe(audioReservoirR1272);
      connectMasterAudioOwnerR1160H(
        audioReservoirR1272,
        audioSink,
        'normal-mp3-r1272-reservoir'
      );
      producer.once('error',reject);
      producer.once('exit',(code,signal)=>{
        state.mp3AudioReservoirBufferedBytesR1272=Number(audioReservoirR1272.readableLength||0)+Number(audioReservoirR1272.writableLength||0);
        try{source.off('data',onPcmGapProbeR1276);}catch(_){}
        try{source.off('pause',onSourcePauseR1272);}catch(_){}
        try{source.off('resume',onSourceResumeR1272);}catch(_){}
        try{source.unpipe(audioReservoirR1272);}catch(_){}
        try{audioReservoirR1272.unpipe(audioSink);}catch(_){}
        try{audioReservoirR1272.end();}catch(_){}
        if(masterAudioOwnerSourceR1160H===audioReservoirR1272){
          masterAudioOwnerSourceR1160H=null;
          masterAudioOwnerSinkR1160H=null;
        }

        const exitOkR972=(code===0||stopping);

        // R1154 FINAL BOUNDARY OWNER CHECK:
        // The start-of-song actualNextR736 can be stale. Re-read the real scheduler
        // at decoder EOF so a late station/clip NEVER falls into R978B's false
        // MP3->MP3 wait while the gap bridge writes silence.
        const runtimeOwnerAtEndR1154=
          actualNextVideoOwnerR1154(0) ||
          (
            videoFeeder?.__r1154RuntimeVideoHandoff===true &&
            videoFeeder?.__r1154ActualNextItem
              ? {
                  item:videoFeeder.__r1154ActualNextItem,
                  afterItem:videoFeeder.__r1154ActualNextAfterItem||null,
                  kind:videoFeeder.__r1154ActualNextKind||'video',
                  source:videoFeeder.__r1154ActualNextSource||'tail-latched'
                }
              : null
          );

        const runtimeVideoNextR1154=Boolean(
          runtimeOwnerAtEndR1154?.item &&
          isVideoHandoffR738(runtimeOwnerAtEndR1154.item)
        );

        const videoNextR972=Boolean(
          runtimeVideoNextR1154 ||
          (
            actualNextR736 &&
            isVideoHandoffR738(actualNextR736)
          )
        );

        const stationItemAtEndR1154=
          runtimeVideoNextR1154
            ? runtimeOwnerAtEndR1154.item
            : actualNextR736;

        const stationNextR978C=Boolean(
          stationItemAtEndR1154 && (
            stationItemAtEndR1154.sourceType==='radio-bumper' ||
            String(stationItemAtEndR1154.sourceType||'')
              .startsWith('radio-special')
          )
        );

        if(runtimeVideoNextR1154){
          diagRecordR802('r1154-mp3-eof-video-owner-no-false-mp3-wait',{
            title:shortText(runtimeOwnerAtEndR1154.item?.title||'VIDEO',52),
            kind:runtimeOwnerAtEndR1154.kind||'video',
            source:runtimeOwnerAtEndR1154.source||'runtime',
            staticNextType:String(actualNextR736?.type||actualNextR736?.sourceType||''),
            staticMp3Boundary:Boolean(mp3ToMp3BoundaryR809)
          });
        }

        const videoTailGuardMsR978C=
          stationNextR978C
            ? 0 // R1068: no artificial MP3->station tail gap
            : 0;

        if(!stopping)
          startMasterAudioGapBridgeR824(
            videoNextR972
              ? 'mp3-ended-video-tail-guard-r972'
              : 'mp3-ended'
          );

        state.producerRunning=false;
        producer=null;

        if(!exitOkR972){
          reject(new Error(`decoder exit ${code||signal}`));
          return;
        }

        if(
          !stopping &&
          videoNextR972 &&
          videoTailGuardMsR978C>0
        ){
          state.mp3VideoTailGuardActiveR972=true;
          state.mp3VideoTailGuardMsR972=
            videoTailGuardMsR978C;

          state.mp3VideoTailGuardModeR978C=
            stationNextR978C
              ? 'R978C-STATION-500MS'
              : 'R972-CLIP-2000MS';

          state.lastMp3VideoTailGuardAtR972=
            new Date().toISOString();

          setTimeout(()=>{
            state.mp3VideoTailGuardActiveR972=false;
            resolve();
          },videoTailGuardMsR978C);

          return;
        }

        if(!stopping && mp3ToMp3BoundaryR809 && !runtimeVideoNextR1154){
          const waitMsR978B=
            MP3_TO_VIDEO_TAIL_GUARD_MS_R972+
            Math.round(MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814*1000);

          state.mp3GoldBoundaryWaitMsR978B=waitMsR978B;

          setTimeout(resolve,waitMsR978B);
          return;
        }

        resolve();
      });
    });
    playedOkR726=true;
  }finally{
    clearNextPreviewR726({invalidate:true});
  }
  if(playedOkR726){rememberTrackR726(item);previousTrackForPreviewR726=item;}
}



let lastCycleFirstTrackR906='';

function shuffleTracksForCycleR906(items){
  const src=Array.isArray(items)?items.slice():[];
  if(src.length<2)return src;

  // Safety: only normal TRACK / CLIP queue is touched.
  if(src.some(x=>x?.type!=='track' && x?.type!=='clip')){
    return src;
  }

  const trackPositions=[];
  const tracks=[];

  src.forEach((item,index)=>{
    if(item?.type==='track'){
      trackPositions.push(index);
      tracks.push(item);
    }
  });

  if(tracks.length<2)return src;

  // Fisher-Yates: completely fresh MP3 order every cycle.
  for(let i=tracks.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [tracks[i],tracks[j]]=[tracks[j],tracks[i]];
  }

  // Avoid starting two consecutive cycles with the same song.
  const identity=item=>String(
    item?.key ||
    item?.url ||
    item?.title ||
    ''
  );

  if(
    lastCycleFirstTrackR906 &&
    identity(tracks[0])===lastCycleFirstTrackR906 &&
    tracks.length>2
  ){
    const j=1+Math.floor(Math.random()*(tracks.length-1));
    [tracks[0],tracks[j]]=[tracks[j],tracks[0]];
  }

  lastCycleFirstTrackR906=identity(tracks[0]);

  trackPositions.forEach((position,index)=>{
    src[position]=tracks[index];
  });

  return src;
}

let clipRotationCursorR905=0;

function rebalanceClipRotationR905(items){
  const src=Array.isArray(items)?items.slice():[];
  if(!src.length)return src;

  // Safety: R905 only rearranges the normal track/clip queue.
  // Any unknown queue type => leave original queue untouched.
  if(src.some(x=>x?.type!=='track' && x?.type!=='clip')){
    return src;
  }

  const tracks=src.filter(x=>x?.type==='track');

  // Remove accidental duplicate clip entries before round-robin.
  const seen=new Set();
  const clips=src.filter(x=>x?.type==='clip').filter((x,i)=>{
    const id=String(x?.key||x?.url||x?.title||`clip-${i}`);
    if(seen.has(id))return false;
    seen.add(id);
    return true;
  });

  if(!tracks.length || !clips.length)return src;

  const out=[];
  let ti=0;

  while(ti<tracks.length){
    // Exactly 3, 4 or 5 songs between ordinary clips.
    const gap=3+Math.floor(Math.random()*3);
    const take=Math.min(gap,tracks.length-ti);

    for(let n=0;n<take;n++){
      out.push(tracks[ti++]);
    }

    // Do not put a clip after a tiny tail of only 1–2 songs.
    if(take>=3){
      const clip=clips[clipRotationCursorR905 % clips.length];
      clipRotationCursorR905=(clipRotationCursorR905+1) % clips.length;
      out.push(clip);
    }
  }

  return out;
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  prefetchAllVisuals();
  // R1277: finish album image refresh + prepared-bed generation before the LIVE
  // publisher exists. Once startPublisher() runs, album-bed code is strictly cache-only.
  await prefetchAlbumBackgroundsR1211();
  await prewarmExistingAlbumVideosR1274();
  await ensureScheduledVisual();
  if(!startPublisher())return;
  await ensureNormalVideoFeederR721({force:true});
  startMasterAudioGapBridgeR824('startup-before-first-media');
  scheduleTimerR721=setInterval(()=>{scheduleVisualTickR721().catch(error=>{state.lastError=`R721 schedule: ${cleanText(error?.message||error)}`;});},30000);
  scheduleTimerR721.unref?.();
  albumBackgroundWatcherTimerR1279=setInterval(()=>{
    pollAlbumBackgroundChangesR1279().catch(error=>{state.lastWarning=`R1279 background watcher tick: ${cleanText(error?.message||error)}`;});
  },ALBUM_BACKGROUND_WATCH_MS_R1279);
  albumBackgroundWatcherTimerR1279.unref?.();
  videoSourceWatchdogTimerR749=setInterval(()=>{videoSourceWatchdogTickR749().catch(error=>{state.lastError=`R749 watchdog tick: ${cleanText(error?.message||error)}`;});},VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749);
  videoSourceWatchdogTimerR749.unref?.();
  masterBackpressureWatchdogTimerR750=setInterval(masterBackpressureWatchdogTickR750,MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750);
  masterBackpressureWatchdogTimerR750.unref?.();
  rtmpsEgressWatchdogTimerR792=setInterval(()=>{rtmpsEgressWatchdogTickR792().catch(error=>{state.lastWarning=`R792 egress watchdog tick: ${cleanText(error?.message||error)}`;});},RTMPS_EGRESS_WATCH_INTERVAL_MS_R792);
  rtmpsEgressWatchdogTimerR792.unref?.();

  // R1278/R1129 CPU HEADROOM: the persistent master owns only the LOCAL encoded
  // pipe/reservoir, never the RTMPS socket. The relay watchdog is authoritative.
  const isolatedRelayTransportR1278=/^(R1125-|R1278-)/.test(String(state.transportArchitectureR1125||''));
  if(!isolatedRelayTransportR1278){
    rtmpsProgressWatchdogTimerR1124=setInterval(()=>{
      rtmpsProgressWatchdogTickR1124().catch(error=>{
        state.lastWarning=`R1124 progress watchdog tick: ${cleanText(error?.message||error)}`;
      });
    },RTMPS_PROGRESS_WATCH_INTERVAL_MS_R1124);
    rtmpsProgressWatchdogTimerR1124.unref?.();
  }else{
    state.rtmpsProgressProbeAvailableR1124=false;
  }

  // R1125: lane-specific transport health. A stalled lane is killed/restarted
  // independently; encoder, R1123/R1085 and the other RTMPS lane keep running.
  transportRelayWatchdogTimerR1125=setInterval(()=>{
    transportRelayWatchdogTickR1125().catch(error=>{
      state.lastWarning=`R1125 relay watchdog: ${cleanText(error?.message||error)}`;
    });
  },R1125_RELAY_WATCH_INTERVAL_MS);
  transportRelayWatchdogTimerR1125.unref?.();

  // R1160P: low-frequency orphan cleanup; current owned LIVE children are excluded.
  orphanFfmpegGcTimerR1160P=setInterval(()=>{
    orphanFfmpegGcTickR1160P().catch(error=>{
      state.lastWarning=`R1160P child GC: ${cleanText(error?.message||error)}`;
    });
  },ORPHAN_FFMPEG_GC_INTERVAL_MS_R1160P);
  orphanFfmpegGcTimerR1160P.unref?.();
  setTimeout(()=>{orphanFfmpegGcTickR1160P().catch(()=>{});},15000).unref?.();

  while(!stopping){
    try{
      const refreshAt=Date.parse(state.lastLibraryRefresh||0);
      if(!library.length || !refreshAt || Date.now()-refreshAt>LIBRARY_REFRESH_MS){
        const refreshed=await loadLibrary();
        if(refreshed.changed && queue.length)reconcileQueueWithLibrary();
      }

      if(!queue.length || queueIndex>=queue.length){
        queue=rebalanceClipRotationR905(shuffleTracksForCycleR906(buildQueue()));
        queueIndex=0;
      }

      planBumperIntoQueueR943();


      const item=queue[queueIndex];
      const next=queue[queueIndex+1]||queue[0]||null;
      const following=queue[queueIndex+2]||queue[1]||queue[0]||null;
      const nextTrackPreview=queue.slice(queueIndex+1).find(x=>x?.type==='track')||queue.find(x=>x?.type==='track')||null;
      const nextListenerPreviewR1135=
        queue.slice(queueIndex+1).find(x=>x && !stationInsertR802(x) && (x.type==='track'||x.type==='clip')) ||
        queue.find(x=>x && !stationInsertR802(x) && (x.type==='track'||x.type==='clip')) ||
        nextTrackPreview || null;
      state.queuePosition=queueIndex+1;

      if(item?.type==='clip'){
        if(next?.type==='track'){
          try{
            await ensureNextTrackReadyR712(next);
          }catch(error){
            state.lastError=`R712 clip deferred: next MP3 not ready: ${cleanText(error?.message||error)}`;
            console.error('[clip-deferred]',state.lastError);
            queueIndex++;
            continue;
          }
        }
        if(following?.type==='track')prefetchTrack(following);else if(following?.type==='clip')prefetchPreparedClipR742(following);
        const clipPlayed=await playVideoClipR691(lastPlayed,item,next,nextListenerPreviewR1135,following);
        if(clipPlayed){
          normalClipRetryR814.delete(primaryIdentity(item));
          // R764: only media that actually reached LIVE may become PREVIOUS.
          lastPlayed=item;
          queueIndex++;
          if(item?.sourceType==='radio-bumper' && (item?.__manualPlannedR943===true||item?.__manualSelectedR1155===true)){
            songsSinceBumperR724=0;
            bumperAfterSongsR724=randomBumperGapR724();
            state.songsSinceBumper=0;
            state.nextBumperAfterSongs=bumperAfterSongsR724;
          }
          if(item?.__manualSelectedR1155===true && item?.sourceType==='radio-special-30'){
            lastSpecialPlayedAtR726=Date.now();
            state.lastSpecialPlayedAt=new Date(lastSpecialPlayedAtR726).toISOString();
          }
          if(item?.__manualSelectedR1155===true && item?.sourceType==='radio-special-60'){
            lastSpecialHourlyPlayedAtR727=Date.now();
            state.lastSpecialHourlyPlayedAt=new Date(lastSpecialHourlyPlayedAtR727).toISOString();
            lastSpecialPlayedAtR726=lastSpecialHourlyPlayedAtR727;
            state.lastSpecialPlayedAt=new Date(lastSpecialPlayedAtR726).toISOString();
          }
          state.lastError='';
        }else{
          // R814 CLIP LOCK: a clip that was already selected at the boundary is not
          // silently skipped to the next MP3 on one transient handoff failure. Retry it
          // in place twice. Only after bounded retries do we defer it safely.
          const clipKeyR814=primaryIdentity(item);
          const retryR814=Number(normalClipRetryR814.get(clipKeyR814)||0)+1;
          normalClipRetryR814.set(clipKeyR814,retryR814);
          diagRecordR802('r814-normal-clip-retry',{title:shortText(item?.title||'VIDEO',52),retry:retryR814,max:NORMAL_CLIP_RETRY_MAX_R814,reason:shortText(state.lastError||'clip did not commit',180)});
          if(retryR814<=NORMAL_CLIP_RETRY_MAX_R814){
            state.lastWarning=`R814 clip locked for retry ${retryR814}/${NORMAL_CLIP_RETRY_MAX_R814}: ${shortText(item?.title||'VIDEO',40)}`;
            prefetchPreparedClipR742(item);
            await sleep(NORMAL_CLIP_RETRY_DELAY_MS_R814);
            continue;
          }
          normalClipRetryR814.delete(clipKeyR814);
          const failed=queue.splice(queueIndex,1)[0]||item;
          state.queueLength=queue.length;
          state.normalClipDeferredCount=Number(state.normalClipDeferredCount||0)+1;
          state.lastNormalClipDeferred={at:new Date().toISOString(),title:shortText(failed?.title||'VIDEO',52),reason:shortText(state.lastError||'clip did not commit',180)};
          if(next?.type==='track')clipToTrackBoundaryPendingR753={identity:primaryIdentity(next),startedAt:Date.now(),reason:'R814-FAILED-CLIP-FALLBACK-FADE-IN'};
          prefetchPreparedClipR742(failed);
          state.lastWarning=`R814 clip deferred only after bounded retries: ${shortText(failed?.title||'VIDEO',40)}`;
          console.error('[r814-clip-deferred]',state.lastWarning);
        }
        continue;
      }

      const localAudioPath=await downloadTrackToCache(item);
      if(next?.type==='track')prefetchTrack(next);else if(next?.type==='clip')prefetchPreparedClipR742(next);
      if(following?.type==='track')prefetchTrack(following);else if(following?.type==='clip')prefetchPreparedClipR742(following);
      const keep=[localAudioPath];
      if(next?.type==='track')keep.push(audioCachePath(next));
      if(following?.type==='track')keep.push(audioCachePath(following));
      pruneAudioCache(keep);

      await playItem(lastPlayed,item,next,following,localAudioPath,nextTrackPreview);
      lastPlayed=item;
      queueIndex++;
      songsSinceBumperR724++;
      state.songsSinceBumper=songsSinceBumperR724;
      state.nextBumperAfterSongs=bumperAfterSongsR724;

      // R1155: an owner action "put next" is authoritative for ONE boundary.
      // Do not let an automatically-due 30m/60m/bumper jump in front of it.
      const manualPriorityNextR1155=Boolean(queue[queueIndex]?.__manualPriorityNextR1155===true);
      if(manualPriorityNextR1155){
        diagRecordR802('r1155-manual-next-auto-inserts-suppressed',{
          title:shortText(queue[queueIndex]?.title||'',52),
          sourceType:String(queue[queueIndex]?.sourceType||''),
          queueIndex:Number(queueIndex||0)
        });
      }

      let specialPlayedR726=false;
      let specialHourlyPlayedR727=false;
      const nowSpecialR727=Date.now();
      if(!manualPriorityNextR1155 && !stopping && specialHourlyInsertR727 && nowSpecialR727-lastSpecialHourlyPlayedAtR727>=SPECIAL_HOURLY_INTERVAL_MS_R727){
        // R727: hourly station ID has priority at the hour mark so 30min + 60min never play back-to-back.
        moveUpcomingClipAfterTrackR724();
        const afterSpecial=queue[queueIndex]||null;
        if(afterSpecial?.type==='track'){
          try{await ensureNextTrackReadyR712(afterSpecial)}catch(error){console.error('[special60-prefetch]',cleanText(error?.message||error));}
        }
        specialHourlyPlayedR727=await playVideoClipR691(item,specialHourlyInsertR727,afterSpecial);
        if(specialHourlyPlayedR727){
          lastPlayed=specialHourlyInsertR727;
          lastSpecialHourlyPlayedAtR727=Date.now();
          state.lastSpecialHourlyPlayedAt=new Date(lastSpecialHourlyPlayedAtR727).toISOString();
          lastSpecialPlayedAtR726=lastSpecialHourlyPlayedAtR727;
          state.lastSpecialPlayedAt=new Date(lastSpecialPlayedAtR726).toISOString();
          state.lastError='';
        }
      }
      if(!manualPriorityNextR1155 && !specialHourlyPlayedR727 && !stopping && specialInsertR726 && Date.now()-lastSpecialPlayedAtR726>=SPECIAL_INTERVAL_MS_R726){
        // R726/R727: 30-minute station ID is inserted only BETWEEN songs, never interrupts music.
        moveUpcomingClipAfterTrackR724();
        const afterSpecial=queue[queueIndex]||null;
        if(afterSpecial?.type==='track'){
          try{await ensureNextTrackReadyR712(afterSpecial)}catch(error){console.error('[special30-prefetch]',cleanText(error?.message||error));}
        }
        specialPlayedR726=await playVideoClipR691(item,specialInsertR726,afterSpecial);
        if(specialPlayedR726){
          lastPlayed=specialInsertR726;
          lastSpecialPlayedAtR726=Date.now();
          state.lastSpecialPlayedAt=new Date(lastSpecialPlayedAtR726).toISOString();
          state.lastError='';
        }
      }

      if(!manualPriorityNextR1155 && !specialHourlyPlayedR727 && !specialPlayedR726 && !stopping && bumperLibrary.length && songsSinceBumperR724>=bumperAfterSongsR724 && !hasPlannedBumperAheadR943()){
        // Keep a station bumper between SONGS, never bumper -> normal clip back-to-back.
        moveUpcomingClipAfterTrackR724();
        const bumper=nextBumperR724();
        const afterBumper=queue[queueIndex]||null;
        if(bumper){
          if(afterBumper?.type==='track'){
            try{await ensureNextTrackReadyR712(afterBumper)}catch(error){console.error('[bumper-prefetch]',cleanText(error?.message||error));}
          }
          const bumperPlayed=await playVideoClipR691(item,bumper,afterBumper);
          if(bumperPlayed){
            lastPlayed=bumper;
            songsSinceBumperR724=0;
            bumperAfterSongsR724=randomBumperGapR724();
            state.songsSinceBumper=0;
            state.nextBumperAfterSongs=bumperAfterSongsR724;
            state.lastError='';
          }
        }
      }
      state.lastError='';
    }catch(error){
      state.lastError=String(error?.stack||error).slice(-1200);
      console.error('[radio]',error);

      if(producer && producer.exitCode===null)producer.kill('SIGTERM');
      producer=null;
      state.producerRunning=false;

      await sleep(1000);

      if(/library|HTTP|empty/i.test(String(error)))library=[];
      else queueIndex++;
    }
  }
}


// R943_QUEUE_PATCH_BEGIN
// Manual next-six queue.
// publicStatus() is READ ONLY.

function queueItemPublicR943(item,index){
  if(!item)return null;

  const id=String(
    item.__manualPlannedIdR943 ||
    primaryIdentity(item) ||
    `${item.type||'media'}:${shortText(item.title||'',80)}`
  );

  return {
    index:Number(index||0),
    id,
    type:String(item.sourceType||'').startsWith('radio-special')
      ? 'special'
      : (
          item.sourceType==='radio-bumper'
            ? 'bumper'
            : (item.type||'track')
        ),
    title:shortText(item.title||'UNTITLED',120),
    album:shortText(item.album||'',80),
    sourceType:shortText(item.sourceType||'',50),
    duration:Number(item.duration||0)||null
  };
}

function hasPlannedBumperAheadR943(){
  return queue.some(
    (x,i)=>
      i>=queueIndex &&
      x?.sourceType==='radio-bumper' &&
      x?.__manualPlannedR943===true
  );
}

function planBumperIntoQueueR943(){
  if(
    !queue.length ||
    !bumperLibrary.length ||
    hasPlannedBumperAheadR943()
  ) return false;

  const remaining=Math.max(
    0,
    Number(bumperAfterSongsR724||0)-
    Number(songsSinceBumperR724||0)
  );

  if(remaining<1 || remaining>6)
    return false;

  let insertAt=queueIndex+1;

  if(remaining>1){
    let tracks=0;
    let found=false;

    for(let i=queueIndex+1;i<queue.length;i++){
      if(queue[i]?.type==='track')
        tracks++;

      if(tracks>=remaining-1){
        insertAt=i+1;
        found=true;
        break;
      }
    }

    if(!found)
      return false;
  }

  const base=nextBumperR724();

  if(!base)
    return false;

  const bumper={
    ...base,
    __manualPlannedR943:true,
    __manualPlannedIdR943:
      `bumper:${primaryIdentity(base)||base.title||'station'}:${Date.now()}`
  };

  queue.splice(
    Math.max(queueIndex+1,insertAt),
    0,
    bumper
  );

  state.queueLength=queue.length;
  return true;
}

function firstFutureQueueIndexR1155(){
  if(!queue.length)return 0;

  const q=Math.max(0,Math.min(queue.length-1,Number(queueIndex)||0));
  const queuedNow=queue[q]||null;
  const liveNow=state.current||null;

  // Normal queue-owned media (track, normal clip, manually planned bumper):
  // queueIndex still points at the item that is LIVE, so NEXT is +1.
  const sameQueueOwner=Boolean(
    queuedNow && liveNow && (
      primaryIdentity(queuedNow)===primaryIdentity(liveNow) ||
      (queuedNow?.url && liveNow?.url && String(queuedNow.url)===String(liveNow.url)) ||
      (cleanText(queuedNow?.title||'') && cleanText(queuedNow?.title||'')===cleanText(liveNow?.title||''))
    )
  );
  if(sameQueueOwner)
    return Math.min(queue.length,q+1);

  // Timed 30/60 station inserts are played BETWEEN queue items after queueIndex
  // was already incremented. During such an insert queue[queueIndex] itself is NEXT.
  return Math.max(0,Math.min(queue.length,Number(queueIndex)||0));
}

function upcomingQueueR943(limit=6){
  if(!queue.length)
    return [];

  const out=[];
  const firstFuture=firstFutureQueueIndexR1155();

  for(
    let i=firstFuture;
    i<queue.length && out.length<limit;
    i++
  ){
    const row=queueItemPublicR943(
      queue[i],
      i-firstFuture
    );

    if(row)
      out.push(row);
  }

  return out.slice(0,limit);
}

function moveUpcomingQueueR943(offset,direction,itemId=''){
  const dir=String(direction||'').toLowerCase();
  const off=Math.max(0,Math.min(5,Number(offset)||0));
  const expected=String(itemId||'');

  if(!['up','down','next'].includes(dir))
    return {
      ok:false,
      error:'invalid-direction',
      upcoming:upcomingQueueR943(6)
    };

  const firstFuture=firstFutureQueueIndexR1155();
  let absolute=firstFuture+off;

  if(expected){
    const found=queue.findIndex(
      (x,i)=>
        i>=firstFuture &&
        String(
          x?.__manualPlannedIdR943 ||
          primaryIdentity(x) ||
          ''
        )===expected
    );

    if(found>=firstFuture)
      absolute=found;
  }

  if(
    absolute<firstFuture ||
    absolute>=queue.length
  ){
    return {
      ok:false,
      error:'queue-item-not-found',
      upcoming:upcomingQueueR943(6)
    };
  }

  const actualId=String(
    queue[absolute]?.__manualPlannedIdR943 ||
    primaryIdentity(queue[absolute]) ||
    ''
  );

  if(expected && actualId!==expected)
    return {
      ok:false,
      error:'stale-queue-item',
      upcoming:upcomingQueueR943(6)
    };

  if(dir==='next'){
    if(absolute===firstFuture){
      queue[absolute].__manualPriorityNextR1155=true;
      return {
        ok:true,
        alreadyNext:true,
        move:{
          at:new Date().toISOString(),
          direction:'next',
          id:actualId,
          title:shortText(queue[absolute]?.title||'',80),
          from:0,
          to:0
        },
        upcoming:upcomingQueueR943(6)
      };
    }
    const [picked]=queue.splice(absolute,1);
    picked.__manualPriorityNextR1155=true;
    queue.splice(firstFuture,0,picked);
    state.queueLength=queue.length;
    state.lastManualQueueMoveR943={
      at:new Date().toISOString(),
      direction:'next',
      id:actualId,
      title:shortText(picked?.title||'',80),
      from:absolute-firstFuture,
      to:0
    };
    diagRecordR802('r1155-queue-item-made-next',{
      id:actualId,
      title:shortText(picked?.title||'',52),
      from:absolute-firstFuture,
      firstFuture
    });
    return {
      ok:true,
      alreadyNext:false,
      move:state.lastManualQueueMoveR943,
      upcoming:upcomingQueueR943(6)
    };
  }

  const target=
    dir==='up'
      ? absolute-1
      : absolute+1;

  if(
    target<firstFuture ||
    target>=queue.length
  ){
    return {
      ok:false,
      error:'queue-edge',
      upcoming:upcomingQueueR943(6)
    };
  }

  [queue[absolute],queue[target]]=
    [queue[target],queue[absolute]];

  state.queueLength=queue.length;

  state.lastManualQueueMoveR943={
    at:new Date().toISOString(),
    direction:dir,
    id:actualId,
    title:shortText(
      queue[target]?.title||'',
      80
    ),
    from:absolute-firstFuture,
    to:target-firstFuture
  };

  return {
    ok:true,
    move:state.lastManualQueueMoveR943,
    upcoming:upcomingQueueR943(6)
  };
}

function queuePickCandidateR1155(mediaType,key){
  const type=String(mediaType||'').trim().toLowerCase();
  const wanted=String(key||'').trim().replace(/^\/+/, '');
  if(!wanted)return null;

  if(type==='track'){
    return library.find(x=>String(x?.key||'').replace(/^\/+/, '')===wanted)||null;
  }

  if(type==='clip'){
    const videos=[
      ...clipLibrary,
      ...bumperLibrary,
      ...(specialInsertR726?[specialInsertR726]:[]),
      ...(specialHourlyInsertR727?[specialHourlyInsertR727]:[])
    ];
    return videos.find(x=>String(x?.key||'').replace(/^\/+/, '')===wanted)||null;
  }

  return null;
}

function queuePickNextR1155(mediaType,key,title=''){
  const type=String(mediaType||'').trim().toLowerCase();
  if(!['track','clip'].includes(type))
    return {ok:false,error:'invalid-media-type',upcoming:upcomingQueueR943(6)};

  const found=queuePickCandidateR1155(type,key);
  if(!found)
    return {ok:false,error:'media-not-found',key:String(key||''),upcoming:upcomingQueueR943(6)};

  const item={...found};
  const firstFuture=firstFutureQueueIndexR1155();
  const id=primaryIdentity(item);

  // Station items selected manually must behave like intentional station queue
  // entries, so the normal cadence is reset after they really reach LIVE.
  if(item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special')){
    item.__manualSelectedR1155=true;
    item.__manualPlannedR943=true;
    item.__manualPlannedIdR943=`manual:${id}:${Date.now()}`;
  }

  // If the same media is already in the future queue, MOVE that exact object.
  // This preserves any prepared/manual metadata and prevents duplicates.
  let existing=-1;
  for(let i=firstFuture;i<queue.length;i++){
    if(primaryIdentity(queue[i])===id){existing=i;break;}
  }

  if(existing===firstFuture){
    const current=queue[firstFuture];
    current.__manualPriorityNextR1155=true;
    if(item.__manualSelectedR1155){
      current.__manualSelectedR1155=true;
      current.__manualPlannedR943=true;
      current.__manualPlannedIdR943=current.__manualPlannedIdR943||item.__manualPlannedIdR943;
    }
    if(type==='track')prefetchTrack(current);
    else prefetchPreparedClipR742(current);
    state.lastManualQueuePickR1155={
      at:new Date().toISOString(),type,key:String(current?.key||key),title:shortText(current?.title||title||'',100),position:1,alreadyNext:true
    };
    return {ok:true,alreadyNext:true,position:1,pick:state.lastManualQueuePickR1155,upcoming:upcomingQueueR943(6)};
  }

  let picked=item;
  if(existing>firstFuture){
    [picked]=queue.splice(existing,1);
    if(item.__manualSelectedR1155){
      picked.__manualSelectedR1155=true;
      picked.__manualPlannedR943=true;
      picked.__manualPlannedIdR943=picked.__manualPlannedIdR943||item.__manualPlannedIdR943;
    }
  }

  picked.__manualPriorityNextR1155=true;
  queue.splice(firstFuture,0,picked);
  state.queueLength=queue.length;

  if(type==='track')prefetchTrack(picked);
  else prefetchPreparedClipR742(picked);

  state.lastManualQueuePickR1155={
    at:new Date().toISOString(),
    type,
    key:String(picked?.key||key),
    title:shortText(picked?.title||title||'',100),
    sourceType:String(picked?.sourceType||''),
    position:1,
    alreadyNext:false,
    firstFuture
  };

  diagRecordR802('r1155-media-picked-next',{
    type,
    key:shortText(String(picked?.key||key),120),
    title:shortText(picked?.title||title||'',52),
    sourceType:String(picked?.sourceType||''),
    firstFuture
  });

  return {
    ok:true,
    alreadyNext:false,
    position:1,
    pick:state.lastManualQueuePickR1155,
    upcoming:upcomingQueueR943(6)
  };
}

// R943_QUEUE_PATCH_END

function publicStatus(){
  const now=Date.now();
  const masterR1160K=publisher?.__r1085AudioMaster;
  const memoryR1160K=process.memoryUsage();
  return {
    ok:Boolean(state.publisherRunning && state.transportHealthy!==false && ((clipPublisher&&clipPublisher.exitCode===null&&clipPublisher.__r752UnifiedAV===true&&clipPublisher.__r752Live===true)||(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null)||(videoFeeder&&videoFeeder.exitCode===null))),
    service:state.service,
    auditRevisionR1160K:'R1160L-MP3-CADENCE-REAL-COUNTERS',
    auditRevisionR1160L:'R1160L-MP3-CADENCE-REAL-COUNTERS',
    auditRevisionR1160N:'R1160N-STATION-EXACT-25FPS-NO-PHASE-HOLD',
    normalVisualFramesR1160L:Number(state.normalVisualFramesR1160L||0),
    audioMasterVideoDropsR1085:Number(masterR1160K?.dropped||0),
    audioMasterVideoDuplicatesR1085:Number(masterR1160K?.duplicated||0),
    lastPostVideoPhaseR1160L:state.lastPostVideoPhaseR1160L||null,
    ffmpegLogCountersR1160K:Object.fromEntries(ffmpegLogCountersR1160K),
    runtimeMetricsR1160K:{
      nodePid:process.pid,
      nodeUptimeSeconds:Math.round(process.uptime()),
      publisherPid:Number(publisher?.pid||0),
      videoPid:Number(videoFeeder?.pid||0),
      producerPid:Number(producer?.pid||0),
      memoryBytes:memoryR1160K,
      audioPipeQueuedBytes:Number(publisher?.stdio?.[3]?.writableLength||0),
      videoPipeQueuedBytes:Number(publisher?.stdio?.[4]?.writableLength||0),
      audioPipeNeedsDrain:Boolean(publisher?.stdio?.[3]?.writableNeedDrain),
      videoPipeNeedsDrain:Boolean(publisher?.stdio?.[4]?.writableNeedDrain),
      mp3AudioReservoirBufferedBytesR1293:Number(state.mp3AudioReservoirBufferedBytesR1272||0),
      mp3AudioReservoirHighWaterBytesR1293:Number(state.mp3AudioReservoirHighWaterBytesR1272||MP3_PCM_RESERVOIR_BYTES_R1293),
      mp3AudioReservoirPauseCountR1293:Number(state.mp3AudioReservoirPauseCountR1272||0),
      mp3PcmLastTrueUnderrunMsR1293:Number(state.mp3PcmLastTrueUnderrunMsR1293||0),
      mp3PcmMaxTrueUnderrunMsR1293:Number(state.mp3PcmMaxTrueUnderrunMsR1293||0),
      encodedTransportBufferedBytesR1278:Number(
        ((encodedTransportReservoirsR1281.primary?.readableLength||0)+(encodedTransportReservoirsR1281.primary?.writableLength||0))+
        ((encodedTransportReservoirsR1281.backup?.readableLength||0)+(encodedTransportReservoirsR1281.backup?.writableLength||0))
      ),
      encodedTransportHighWaterBytesR1278:R1278_ENCODED_RESERVOIR_BYTES,
      encodedTransportRelayDrainR1278:Boolean(
        encodedTransportRelaySinksR1281.primary?.writableNeedDrain||
        encodedTransportRelaySinksR1281.backup?.writableNeedDrain
      ),
      encodedTransportPrimaryBufferedBytesR1281:Number((encodedTransportReservoirsR1281.primary?.readableLength||0)+(encodedTransportReservoirsR1281.primary?.writableLength||0)),
      encodedTransportBackupBufferedBytesR1281:Number((encodedTransportReservoirsR1281.backup?.readableLength||0)+(encodedTransportReservoirsR1281.backup?.writableLength||0)),
      encodedTransportPrimaryDrainR1281:Boolean(encodedTransportRelaySinksR1281.primary?.writableNeedDrain),
      encodedTransportBackupDrainR1281:Boolean(encodedTransportRelaySinksR1281.backup?.writableNeedDrain),
      audioBytesSubmitted:Number(masterR1160K?.audioBytes||0),
      actualVideoFramesSubmitted:Number(masterR1160K?.actualVideoFramesR1160K||0),
      phaseVideoFrames:Number(masterR1160K?.videoFrames||0),
      phaseOffsetFrames:Number(masterR1160K?.videoFrames||0)-Number(masterR1160K?.actualVideoFramesR1160K||0),
      // Submitted data includes pipe/demux queues; this is NOT viewer A/V latency.
      submittedLeadMs:masterR1160K?Math.round((masterR1160K.audioBytes/(AUDIO_SAMPLE_RATE*4)-masterR1160K.actualVideoFramesR1160K/VIDEO_FPS)*1000):null,
      visualProbePending:visualProbePendingR1160K.size,
      visualProbeCached:visualProbeCacheR1132.size
    },
    version:state.version,
    mode:state.mode,
    overlayMode:state.overlayMode,
    audioMode:state.audioMode,
    engine:`R820 DETERMINISTIC MASTER PTS + R819 FULLFRAME GEOMETRY + RAWVIDEO QUEUE${VIDEO_INPUT_QUEUE_PACKETS_R732} + ONE X264 + R814 FADE + R1250 SINGLE RTMPS`,
    feederFilterChainGuard:'R769-SEMICOLON-ENDMASK-TO-STARTMASK',
    committedNextCheckpointFile:COMMITTED_NEXT_FILE_R769,
    committedNextTitle:state.committedNextTitle||'',
    committedNextRecovered:Boolean(state.committedNextRecovered),
    committedNextCommittedAt:state.committedNextCommittedAt||null,
    videoPipeline:`R1242 STATIC ALBUM ART -> RAW YUV420P -> QUEUE${VIDEO_INPUT_QUEUE_PACKETS_R732} FRAME RELAY -> PROVEN H264 GOP50 CAVLC ENCODE -> SINGLE RTMPS`,
    outputTimeshiftSeconds:OUTPUT_TIMESHIFT_SECONDS,
    youtubeDualIngestEnabled:Boolean(DUAL_INGEST_ENABLED_R792),
    youtubeBackupIngestArmed:Boolean(DUAL_INGEST_ENABLED_R792 && STREAM_BACKUP_URL && !safeRestartBackupHoldActiveR1287()),
    safeRestartBackupHoldActiveR1287:Boolean(safeRestartBackupHoldActiveR1287()),
    youtubeIngestMode:DUAL_INGEST_ENABLED_R792?'R792-PRIMARY+BACKUP-SAME-PACKETS-INDEPENDENT-FIFO':'SINGLE-RTMPS',
    rtmpsEstablishedConnectionsR792:Number(state.rtmpsEstablishedConnectionsR792||0),
    rtmpsExpectedConnectionsR792:expectedRtmpsConnectionsR1287(),
    rtmpsEgressEverObservedR792:Boolean(state.rtmpsEgressEverObservedR792),
    rtmpsEgressZeroGraceMsR792:RTMPS_EGRESS_ZERO_GRACE_MS_R792,
    rtmpsZeroSinceR792:state.rtmpsZeroSinceR792||null,
    transportTransientCountR792:Number(state.transportTransientCountR792||0),
    lastTransportTransientAtR792:state.lastTransportTransientAtR792||null,
    lastTransportTransientReasonR792:state.lastTransportTransientReasonR792||'',
    stationBoundaryDrainMsR792:0, // R821 compatibility field: legacy station drain disabled
    videoBitrate:VIDEO_BITRATE,
    audioBitrate:AUDIO_BITRATE,
    audioSampleRate:AUDIO_SAMPLE_RATE,
      radioTitleLabelsR1160:'R1160L-MP3-CADENCE-REAL-COUNTERS+R1160K+R1160J+R1160H',
      stationCadenceR1160N:'EXACT-25FPS-NO-PCM-PHASE-HOLD',
    videoFps:VIDEO_FPS,
    videoGop:VIDEO_GOP,
    streamProfileR819:{
      video:{codec:'H.264 / AVC',encoder:'libx264 (persistent master only)',profile:'High 4.1',width:1920,height:1080,fps:VIDEO_FPS,bitrate:VIDEO_BITRATE,gopFrames:VIDEO_GOP,bFrames:0,pixelFormat:'yuv420p',sampleAspectRatio:'1:1',displayAspectRatio:'16:9'},
      audio:{codec:'AAC-LC',sampleRate:AUDIO_SAMPLE_RATE,channels:2,channelLayout:'stereo',bitrate:AUDIO_BITRATE},
      transport:{container:'FLV',protocol:'RTMPS',lanes:Number(state.rtmpsEstablishedConnectionsR792||0),expectedLanes:DUAL_INGEST_ENABLED_R792?2:1,dualIngest:Boolean(DUAL_INGEST_ENABLED_R792)},
      handoff:{mode:state.videoHandoffMode||'R816-RAWVIDEO-FRAME-ALIGNED',frameAligned:true,feederCodec:'rawvideo',persistentEncoder:true},
      geometry:{raster:'1920x1080',sampleAspectRatio:'1:1',displayAspectRatio:'16:9',fullFrame:true,noCrop:true,guard:'R819 exact R784/R814 viewer-proven scale=decrease + pad 1920x1080 + setsar=1 at feeder; master has NO geometry filter'}
    },
    streamProfileR816:{
      video:{codec:'H.264 / AVC',encoder:'libx264 (persistent master only)',profile:'High 4.1',width:1920,height:1080,fps:VIDEO_FPS,bitrate:VIDEO_BITRATE,gopFrames:VIDEO_GOP,bFrames:0,pixelFormat:'yuv420p'},
      audio:{codec:'AAC-LC',sampleRate:AUDIO_SAMPLE_RATE,channels:2,channelLayout:'stereo',bitrate:AUDIO_BITRATE},
      transport:{container:'FLV',protocol:'RTMPS',lanes:Number(state.rtmpsEstablishedConnectionsR792||0),expectedLanes:DUAL_INGEST_ENABLED_R792?2:1,dualIngest:Boolean(DUAL_INGEST_ENABLED_R792)},
      handoff:{mode:state.videoHandoffMode||'R816-RAWVIDEO-FRAME-ALIGNED',frameAligned:true,feederCodec:'rawvideo',persistentEncoder:true}
    },
    streamProfileR813:{
      video:{codec:'H.264 / AVC',encoder:'libx264 (persistent master only)',profile:'High 4.1',width:1920,height:1080,fps:VIDEO_FPS,bitrate:VIDEO_BITRATE,gopFrames:VIDEO_GOP,bFrames:0,pixelFormat:'yuv420p'},
      audio:{codec:'AAC-LC',sampleRate:AUDIO_SAMPLE_RATE,channels:2,channelLayout:'stereo',bitrate:AUDIO_BITRATE},
      transport:{container:'FLV',protocol:'RTMPS',lanes:Number(state.rtmpsEstablishedConnectionsR792||0),expectedLanes:DUAL_INGEST_ENABLED_R792?2:1,dualIngest:Boolean(DUAL_INGEST_ENABLED_R792)},
      handoff:{mode:state.videoHandoffMode||'R816-RAWVIDEO-FRAME-ALIGNED',frameAligned:true,feederCodec:'rawvideo',persistentEncoder:true}
    },
    qrOverlay:QR_OVERLAY,
    subscribeLikeOverlay:CTA_OVERLAY_R767,
    likeOverlay:CTA_LIKE_OVERLAY_R783,
    ctaAlternateMode:'R783-SUBSCRIBE-LIKE-ALTERNATE-EVERY-120S',
    subscribeLikeShowSeconds:CTA_SHOW_SECONDS_R722,
    subscribeLikePeriodSeconds:CTA_PERIOD_SECONDS_R722,
    subscribeLikeFirstShowSeconds:CTA_FIRST_SHOW_SECONDS_R748,
    subscribeLikeFadeSeconds:CTA_FADE_SECONDS_R748,
    subscribeLikePosition:'bottom-right-above-ticker',
    subscribeLikeSize:'420x140-approx',
    startPreviewDelaySeconds:START_PREVIEW_DELAY_SECONDS_R748,
    startPreviewShowSeconds:START_PREVIEW_SHOW_SECONDS_R748,
    titleHandoffDelayMs:TITLE_HANDOFF_DELAY_MS_R724,
    videoInputQueuePackets:VIDEO_INPUT_QUEUE_PACKETS_R732,
    rawVideoQueueGuardR819:`${VIDEO_INPUT_QUEUE_PACKETS_R732} frames / ${(VIDEO_INPUT_QUEUE_PACKETS_R732/VIDEO_FPS).toFixed(2)}s at ${VIDEO_FPS}fps`,
    liveGeometryModeR819:'R784-VIEWER-PROVEN-FIT-PAD-1920x1080-NO-CROP',
    videoInputQueueMaxWindowSecondsR756:Number((VIDEO_INPUT_QUEUE_PACKETS_R732/VIDEO_FPS).toFixed(2)),
    audioInputQueuePackets:AUDIO_INPUT_QUEUE_PACKETS_R732,
    clipStallGuardR1139:R1139_CLIP_STALL_GUARD,
    normalClipEofMarginMsR1139:NORMAL_CLIP_EOF_MARGIN_MS_R1139,
    normalClipSoftEofCutsR1139:Number(state.normalClipSoftEofCutsR1139||0),
    lastNormalClipSoftEofR1139:state.lastNormalClipSoftEofR1139||null,
    masterAvClockMode:'R816-PERSISTENT-RAWVIDEO-N25+AUDIO-SAMPLE-CLOCK',
    rightSubscribeMode:'R767-TRANSPARENT-420PX-BOTTOM-RIGHT',
    rightCtaMode:'R783-SUBSCRIBE-LIKE-420PX-BOTTOM-RIGHT-SMOOTH-ALTERNATING',
    clipSubscribeOverlay:'R783-PREBAKED-ALTERNATING-SUBSCRIBE-LIKE-RIGHT-CTA',
    stationInsertSync:'R821-ARM-A+V-BEHIND-LIVE-BLACK+RAW-FRAME-CUT+NO-DRAIN+SAME-TICK-AUDIO / R791-AUDIO-PTS0',
    stationLeadingSilenceTrimSeconds:Number(state.stationLeadingSilenceTrimSeconds||0),
    stationLeadingSilenceTrimByKey:state.stationLeadingSilenceTrimByKey||{},
    overlayPixelPath:'YUV420-NO-ARGB-R732',
    trackUiClock:'ffmpeg-frame-bound-R732-audio-lead-bounded',
    nextPreviewSeconds:NEXT_PREVIEW_SECONDS_R726,
    nextPreviewTiming:'R748-INTRO-2S-5S-PLUS-FINAL-10S-FRAME-BOUND',
    mp3BoundaryMode:'R816-RAWVIDEO-FRAME-ALIGNED-MP3-CLOCK+R753-CLIP-RETURN',
    clipAvTailLockMode:'R766-PER-OUTPUT-T+VIDEO-TPAD-TRIM+AUDIO-APAD-ATRIM',
    clipAvSyncFix:'R816-ALL-INSERTS-ARM-BEFORE-RAW-FRAME-CUT+ONE-FFMPEG+BOTH-READY+SAME-TICK+Q8-Q8',
    currentTitleHandoff:'R790-FFMPEG-PTS-LOCKED-NEXT-TITLE-DURING-BLACK-NO-WALLCLOCK',
    titleSwitchBeforeBoundarySeconds:TITLE_SWITCH_BEFORE_BOUNDARY_R781,
    titleBoundarySwitchTarget:state.titleBoundarySwitchTarget||'',
    titleBoundarySwitchScheduledAt:state.titleBoundarySwitchScheduledAt||null,
    titleBoundarySwitchFiredAt:state.titleBoundarySwitchFiredAt||null,
    titleBoundarySwitchCount:Number(state.titleBoundarySwitchCount||0),
    rightSubscribeMp3Enabled:true,
    rightSubscribeClipEnabled:false,
    nextPreviewHideBeforeEndSeconds:NEXT_PREVIEW_HIDE_BEFORE_END_R726,
    audioNormalizationTargetLufs:TRACK_AUDIO_TARGET_I_R726,
    audioTruePeakDb:TRACK_AUDIO_TRUE_PEAK_R726,
    audioFadeInSeconds:TRACK_AUDIO_FADE_IN_R726,
    audioFadeOutSeconds:TRACK_AUDIO_FADE_OUT_R726,
    audioNormalizationMode:'R750-NONBLOCKING-R747-TWO-PASS-CACHE-WITH-INSTANT-SINGLE-PASS-FALLBACK',
    currentLoudnessMode:state.currentLoudnessMode||'pending',
    currentMeasuredInputLufs:state.currentMeasuredInputLufs??null,
    loudnessAnalysisTimeoutMs:LOUDNESS_ANALYSIS_TIMEOUT_MS_R747,
    loudnessAnalysisBlockingLive:false,
    loudnessBackgroundNice:LOUDNESS_BACKGROUND_NICE_R750,
    loudnessBackgroundPending:loudnessPendingR750.size,
    videoFadeSeconds:VIDEO_FADE_SECONDS_R726,
      videoFadeStrategy:'R816-RAWVIDEO-MP3-ONLY-1.10S-HOLD-0.20S-LIGHT-1.15S / OTHER-BOUNDARIES-PRESERVED',
      videoFadeInEnabled:true,
      videoBaseNeverFaded:true,
      videoOverlayMask:'BLACK_ALPHA_ONLY_R738',
      videoFadeInSeconds:VIDEO_FADE_IN_SECONDS_R736,
      videoBlackHoldSeconds:VIDEO_BLACK_HOLD_SECONDS_R736,
      videoFadeLeadSeconds:VIDEO_FADE_LEAD_SECONDS_R735,
      titleVisualLeadSeconds:0,
      videoTimelineCompensationSeconds:0,
      videoTimelineCompensationMode:'R753-R752-EXACT-BOUNDARY-NO-LIVE-VIDEO-PREROLL',
      clipAvSyncMode:'R816-STATION+CLIP-RAWVIDEO-FRAME-ALIGNED+ONE-FFMPEG+BOTH-READY+SAME-TICK',
      clipPreDrainMs:0,
      clipPostDrainMs:0,
      stationInsertAudioRequired:true,
      nextPreviewSource:'ACTUAL_IMMEDIATE_ITEM_R738',
      clipPlaybackMode:state.clipPlaybackMode||'R816-PREPARED-RAWVIDEO-FULL-FRAME-RELAY',
      clipPreparationMode:state.clipPreparationMode||'R787-R760-SERIAL-NICE12-FRESH-NOCROP-GEOMETRY-CACHE',
      preparedClipReady:state.preparedClipReady||0,
      preparedClipPending:state.preparedClipPending||0,
      preparedClipLast:state.preparedClipLast||'',
      clipLiveVideoCodec:'rawvideo-yuv420p-frame-relay',
      clipPreparedVideoCodec:'libx264-ultrafast-6000k-no-bframes-r760-fit-pad',
      videoPipelineLeadSeconds:0,
      clipCacheWarmLeadSeconds:INSERT_CACHE_WARM_LEAD_SECONDS_R752,
      clipCacheWarmEntries:clipBoundaryMetaR752.size,
      clipToTrackHandoffPending:Boolean(clipToTrackBoundaryPendingR753),
      clipToTrackHandoffAgeMs:clipToTrackBoundaryPendingR753?Date.now()-Number(clipToTrackBoundaryPendingR753.startedAt||0):null,
      clipToTrackHandoffGuardMs:CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753,
      clipToTrackFadeInSeconds:CLIP_TO_TRACK_FADE_IN_SECONDS_R753,
      clipToTrackBlackHoldSecondsR1135:CLIP_TO_TRACK_BLACK_HOLD_SECONDS_R917B,
      nextMp3PcmPrearmR1156:R1156_NEXT_MP3_PCM_PREARM,
      nextMp3PcmPrearmReadyR1156:Boolean(nextMp3AudioPrearmR1156?.ready),
      nextMp3PcmPrearmTitleR1156:shortText(nextMp3AudioPrearmR1156?.title||'',52),
      musicClipAudioPrimeMsR1135:MUSIC_CLIP_AUDIO_PRIME_MS_R1135,
      videoToVideoBlackProfileR1136:R1136_VIDEO_TO_VIDEO_BLACK_SMOOTH,
      clipPacerRuntimeFixR1140B:R1140B_CLIP_PACER_RUNTIME_FIX,
      clipIoBackpressureFixR1141:R1141_CLIP_IO_BACKPRESSURE_FIX,
      stationToClipTailLockR1142:R1142_STATION_TO_CLIP_TAIL_LOCK,
      stationTailFrameMsR1142:STATION_TAIL_FRAME_MS_R1142,
      stationTailWaitMsR1142:STATION_TAIL_WAIT_MS_R1142,
      stationTailExactR1142:state.r1142StationTailExact||null,
      stationStartFrameLockR1143:R1143_STATION_START_FRAME_LOCK,
      stationStartLockFramesR1143:STATION_START_LOCK_FRAMES_R1143,
      stationMidMinFrameMsR1143:STATION_MID_MIN_FRAME_MS_R1143,
      stationStartLockStateR1143:state.r1143StationStartFrameLock||null,
      stationMp3AtomicBlackR1145:R1145_STATION_MP3_ATOMIC_BLACK,
      stationBlackMasterLockR1147:R1147_STATION_BLACK_MASTER_LOCK,
      stationBlackMasterLockActiveR1147:Boolean(publisher?.__r1085AudioMaster?.transitionPassThroughR1147),
      stationBlackMasterLockFramesR1147:Number(publisher?.__r1085AudioMaster?.transitionPassFramesR1147||0),
      lastStationBlackMasterLockR1147:state.lastStationBlackMasterLockR1147||null,
      mp3CinematicMasterLockR1148:R1148_MP3_CINEMATIC_MASTER_LOCK,
      mp3CinematicMasterLockActiveR1148:Boolean(publisher?.__r1085AudioMaster?.transitionPassThroughR1148),
      mp3CinematicMasterLockFramesR1148:Number(publisher?.__r1085AudioMaster?.transitionPassFramesR1148||0),
      mp3MasterFrameReleaseTargetR1148C:Number(publisher?.__r1085AudioMaster?.transitionReleaseVideoFrameR1148||0),
      lastMp3CinematicMasterLockR1148:state.lastMp3CinematicMasterLockR1148||null,
      installHealthFixR1148B:R1148B_PUBLIC_STATUS_HEALTH_FIX,
      mp3MasterFrameReleaseFixR1148C:R1148C_MASTER_FRAME_RELEASE_FIX,
      mp3IncomingFeederReleaseFixR1148D:R1148D_INCOMING_FEEDER_RELEASE_FIX,
      mp3LockOwnedReleaseFixR1148E:R1148E_LOCK_OWNED_RELEASE_FIX,
      mp3EdgeFrameShieldR1150:R1150_MP3_EDGE_FRAME_SHIELD,
      mp3ToVideoPhasePreserveR1151:R1151_MP3_TO_VIDEO_PHASE_PRESERVE,
      actualNextOwnerFixR1154:R1154_ACTUAL_NEXT_OWNER,
      actualNextPrearmBeforeEndMsR1154:R1154_PREARM_BEFORE_END_MS,
      queueControlR1155:R1155_QUEUE_CONTROL,
      lastManualQueuePickR1155:state.lastManualQueuePickR1155||null,
      mp3EdgeStartExactSecondsR1150:MP3_EDGE_START_EXACT_SECONDS_R1150,
      mp3EdgeTailExactSecondsR1150:MP3_EDGE_TAIL_EXACT_SECONDS_R1150,
      mp3EdgePassActiveR1150:Boolean(publisher?.__r1085AudioMaster?.normalMp3EdgePassThroughR1150),
      mp3MasterFrameReleaseTargetR1148D:Number(publisher?.__r1085AudioMaster?.transitionReleaseVideoFrameR1148||0),
      mp3MasterFrameReleaseTargetR1148E:Number(publisher?.__r1085AudioMaster?.transitionReleaseVideoFrameR1148||0),
      hardStallSelfHealR1146:R1146_HARD_STALL_SELF_HEAL,
      hardStallRecoveryBusyR1146:Boolean(masterHardRecoveryBusyR1146),
      lastStationMp3AtomicBlackR1145:state.lastStationMp3AtomicBlackR1145||null,
      stationBlackPrearmReadyR1145:Boolean(stationBlackPrearmR1145?.ready),
      lastStationNextVideoPrearmResetR1142:state.lastStationNextVideoPrearmResetR1142||null,
      audioInputQueuePacketsR732:AUDIO_INPUT_QUEUE_PACKETS_R732,
      musicClipDebtCatchupMsR1141:MUSIC_CLIP_R1123_DEBT_CATCHUP_MS_R1141,
      musicClipDebtThresholdMsR1141:MUSIC_CLIP_R1123_DEBT_THRESHOLD_MS_R1141,
      musicClipFadeInSecondsR1136:MUSIC_CLIP_FADE_IN_SECONDS_R1136,
      musicClipR1123MinFrameMsR1135:MUSIC_CLIP_R1123_MIN_FRAME_MS_R1135,
      clipMp3CinematicProfileR1135:R1135_CLIP_MP3_CINEMATIC,
      mp3BoundaryFadeMode:state.mp3BoundaryFadeMode,
      mp3BoundaryFadeOutSecondsR814:MP3_BOUNDARY_FADE_OUT_SECONDS_R814,
      mp3BoundaryBlackHoldSecondsR814:MP3_BOUNDARY_BLACK_HOLD_SECONDS_R814,
      mp3BoundaryFadeInSeconds:MP3_BOUNDARY_FADE_IN_SECONDS_R814,
      stationNextLabel:'NEXT • ЗАСТАВКА',
      normalClipAdmissionMode:state.normalClipAdmissionMode,
      normalClipDeferredCount:state.normalClipDeferredCount,
      lastNormalClipDeferred:state.lastNormalClipDeferred,
      bumperCadenceMode:state.bumperCadenceMode,
      bumperMinSongs:BUMPER_MIN_SONGS_R724,
      bumperMaxSongs:BUMPER_MAX_SONGS_R724,
      videoHandoffMode:state.videoHandoffMode||'R816-RAWVIDEO-FRAME-ALIGNED-IDLE',
      clipUnifiedAvRunning:Boolean(clipPublisher&&clipPublisher.exitCode===null&&clipPublisher.__r752UnifiedAV===true&&clipPublisher.__r752Live===true),
      clipVideoPrerollRunning:Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null),
      clipVideoPrerollIdentity:clipVideoPrerollIdentityR744||'',
      clipVideoPrerollArmed:Boolean(clipVideoPrerollArmedR749&&clipVideoPrerollArmedR749.invalid!==true),
      clipVideoPrerollCompletedOk:Boolean(clipVideoPrerollArmedR749?.completedOk),
      clipVideoPrerollArmIdentity:clipVideoPrerollArmedR749?.identity||'',
      clipVideoPrerollArmAgeMs:clipVideoPrerollArmedR749?Math.max(0,Date.now()-Number(clipVideoPrerollArmedR749.startedAt||Date.now())):null,
      videoSourceWatchdogMode:'R816-NO-RAWVIDEO-WRITER-FORCED-NORMAL',
      videoSourceWatchdogIntervalMs:VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749,
      videoSourceStuckMs:VIDEO_SOURCE_STUCK_MS_R749,
      insertPrerollArmGraceMs:INSERT_PREROLL_ARM_GRACE_MS_R749,
      insertAudioStartTimeoutMs:INSERT_AUDIO_START_TIMEOUT_MS_R749,
      backgroundLoudnessEnabled:BACKGROUND_LOUDNESS_ENABLED_R791,
      backgroundPrefetchLoudnessPolicyR793:'DOWNLOAD-ONLY-WHEN-BACKGROUND-OFF',
      liveScalePolicyR794:'FAST-BILINEAR-LIVE-MP3-ONLY-OFFLINE-LANCZOS-PRESERVED',
      fadeEngineR795:'R816-R814-ABSOLUTE-TIMELINE-ALPHA-MASK-110-BLACK-HOLD-115-RECOVER',
      fadeRuntimePolicyR796:'R816-RAWVIDEO-ABSOLUTE-ALPHA-MASK-110-020-115',
      fadeRestoreR799:'R816-R814-FADE-UNCHANGED + RAWVIDEO-FRAME-ALIGNED-SWITCH',
      equalizerPolicyR796:'QTRLE-1180PX-25FPS-100FRAME-SEAMLESS-NO-LIVE-SCALE',
      tickerPolicyR796:'FONT36-Y62-SPEED105-RELOAD2S',
      staticOverlayPolicyR794:'PRE-SCALED-QR160-CTA420',
      liveEncoderThreadsR794:2,
      stationPreparedAudioClock:'R791-PTS-STARTPTS-BEFORE-ARESAMPLE-SAMPLECOUNT-CLOCK',
      stationArmPolicyR792:'R821 KEEP-LIVE-BLACK-UNTIL-BOTH-READY-THEN-RAW-FRAME-CUT-AND-ATTACH-NO-DRAIN',
      insertUnhandledRejectionGuard:'R753-R752-UNIFIED-AV-EXIT-CATCH+R751-GUARD',
      insertRecoveryCount:insertRecoveryCountR749,
      insertAudioStartFailures:insertAudioStartFailuresR749,
      lastInsertRecoveryAt:state.lastInsertRecoveryAt||null,
      lastInsertRecoveryReason:state.lastInsertRecoveryReason||'',
      videoFeederTrackIdentity:videoFeederTrackIdentityR744||'',
      videoFeederPrerolled:Boolean(videoFeederPrerolledR744),
      suppressedVideoInsert:state.suppressedVideoInsert||'',
    visualTimelineAnchor:'PTS-STARTPTS-R733',
    visualContinuityMode:state.visualContinuityMode,
    visualLoopOffsetSeconds:state.visualLoopOffsetSeconds,
    previousPreviewFallback:'R748-R747-ACTUAL-PREVIOUS-ITEM-FROZEN-PER-MP3-FEEDER',
    antiRepeatTrackHistory:TRACK_HISTORY_LIMIT_R726,
    qrPosition:'top-right',
    visualTimeZone:state.visualTimeZone,
    forceVisualSlot:runtimeForceVisualSlot||null,
    visualAutoSchedule:runtimeVisualAutoSchedule,
    visualNextTrackPendingR1130:pendingVisualNextTrackR1130?{...pendingVisualNextTrackR1130}:null,
    visualNextTrackLastAppliedR1130:state.visualNextTrackLastAppliedR1130||null,
    visualNextTrackLastActionR1130:state.visualNextTrackLastActionR1130||'',
    visualPeriod:state.visualPeriod,
    visualPath:state.visualPath,
    visualInsetCrop:state.visualInsetCrop||'',
    equalizerPeriod:state.equalizerPeriod,
    equalizerStyle:state.equalizerStyle,
    equalizerEngine:state.equalizerEngine,
    publisherRunning:state.publisherRunning,
    masterVideoMode:`R819-R784-GEOMETRY-PERSISTENT-RAWVIDEO-QUEUE${VIDEO_INPUT_QUEUE_PACKETS_R732}-SINGLE-X264-SINGLE-RTMPS`,
    masterBitstreamFilter:'none-R816-rawvideo-input-before-encoding',
    masterAudioBytesWritten:Number(publisher?.stdio?.[3]?.bytesWritten||0),
    masterVideoBytesWritten:Number(publisher?.stdio?.[4]?.bytesWritten||0),
    videoRelayFrameBytes:VIDEO_FRAME_BYTES_R816,
    videoRelayFramesWritten:Number(state.videoRelayFramesWritten||0),
    videoRelayPartialBytesDropped:Number(state.videoRelayPartialBytesDropped||0),
    lastVideoFrameAtR816:state.lastVideoFrameAtR816||null,
    videoRelayMode:state.videoRelayMode||'R816-FULL-FRAME-ONLY-YUV420P',
    masterVideoReencode:true,
    masterTimestampMode:'R820-EXPLICIT-VIDEO-N25-AUDIO-NSR-PTS-LOCK',
    masterTimestampErrorCount:Number(state.masterTimestampErrorCount||0),
    lastMasterTimestampErrorAt:state.lastMasterTimestampErrorAt||null,
    videoTimestampOffsetSecondsR787:Number(state.videoTimestampOffsetSecondsR787||0),
    fullFrameGuardMode:state.fullFrameGuardMode,
    stationAudioGuardMode:state.stationAudioGuardMode,
    stationSourceAudioByKey:state.stationSourceAudioByKey||{},
    stationPreparedAudioByKey:state.stationPreparedAudioByKey||{},
    masterFlvTagMode:'R780-VTAG7-ATAG10-OLD-FFMPEG-FIFO-COMPAT',
    outputEgressGuardMode:state.outputEgressGuardMode,
    lastOutputFatalAt:state.lastOutputFatalAt,
    lastOutputFatalReason:state.lastOutputFatalReason,
    videoEncodePasses:1,
    videoQualityMode:'R763-R762-6000K-CBR-ULTRAFAST-SINGLE-ENCODE-NO-GENERATIONAL-LOSS',
    videoBitrate:'6000k',
    audioBitrate:'160k',
    videoPreset:'ultrafast-zerolatency-UNCHANGED-FOR-STABILITY',
    permanentFullscreenMode:'R819-EXACT-R784-R814-VIEWER-PROVEN-FIT-PAD-1920x1080-SAR1',
    permanentFullscreenWidth:1920,
    permanentFullscreenHeight:1080,
    permanentFullscreenFitPolicy:'R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE',
    feederBoundaryMode:'R816-FULL-YUV-FRAMES-NO-FEEDER-CODEC-STATE',
    transportRecoveryMode:'R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT',
    transportHealthy:state.transportHealthy!==false,
    transportWatchdogMode:'R1293-R1124-ACK+R792-LANES+R751-MASTER-NO-PROGRESS',
    watchdogR1293:{
      mode:'R1125-LANE-ACK-WATCHDOG',
      r1125:{
        intervalMs:R1125_RELAY_WATCH_INTERVAL_MS,
        ackStallMs:R1125_RELAY_ACK_STALL_MS,
        noSocketMs:R1125_RELAY_NO_SOCKET_MS,
        primary:{
          pid:Number(transportRelayHealthR1125.primary?.pid||0),
          socket:Boolean(state.rtmpsPrimarySocketR1125),
          ackedBytes:Number(state.rtmpsPrimaryAckedR1125||transportRelayHealthR1125.primary?.lastAck||0),
          lastProgressAt:state.rtmpsPrimaryLastProgressR1125||null,
          noSocketSince:Number(transportRelayHealthR1125.primary?.noSocketSince||0)||null,
          recycles:Number(transportRelayHealthR1125.primary?.recycles||0)
        },
        backup:{
          pid:Number(transportRelayHealthR1125.backup?.pid||0),
          socket:Boolean(state.rtmpsBackupSocketR1125),
          ackedBytes:Number(state.rtmpsBackupAckedR1125||transportRelayHealthR1125.backup?.lastAck||0),
          lastProgressAt:state.rtmpsBackupLastProgressR1125||null,
          noSocketSince:Number(transportRelayHealthR1125.backup?.noSocketSince||0)||null,
          recycles:Number(transportRelayHealthR1125.backup?.recycles||0)
        }
      },
      r1124Legacy:{
        active:!/^R(?:1125|1278|1281)-/.test(String(state.transportArchitectureR1125||'')),
        probeAvailable:Boolean(state.rtmpsProgressProbeAvailableR1124),
        stallMs:Number(state.rtmpsProgressStallMsR1124||0),
        stallThresholdMs:RTMPS_PROGRESS_STALL_MS_R1124
      },
      r792:{
        lanes:Number(state.rtmpsEstablishedConnectionsR792||0),
        expected:expectedRtmpsConnectionsR1287(),
        zeroSince:state.rtmpsZeroSinceR792||null,
        zeroGraceMs:RTMPS_EGRESS_ZERO_GRACE_MS_R792,
        transientCount:Number(state.transportTransientCountR792||0),
        lastTransientAt:state.lastTransportTransientAtR792||null,
        lastTransientReason:state.lastTransportTransientReasonR792||''
      },
      r751:{
        noProgressMs:MASTER_BACKPRESSURE_STUCK_MS_R750,
        backpressureSince:state.publisherBackpressureSince||null,
        recoveries:Number(state.publisherBackpressureRecoveries||0),
        lastRecoveryAt:state.lastPublisherBackpressureAt||null
      },
      selfHeal:{
        pending:Boolean(state.transportSelfHealPending),
        count:Number(state.transportSelfHealCount||0),
        lastFatalAt:state.lastTransportFatalAt||null,
        lastFatalReason:state.lastTransportFatalReason||''
      }
    },
    outputFifoQueuePackets:OUTPUT_FIFO_QUEUE_PACKETS_R750,
    outputDropPacketsOnOverflow:true,
    masterBackpressureWatchdogMs:MASTER_BACKPRESSURE_STUCK_MS_R750,
    masterBackpressureDetection:'R816-SINGLE-X264-MASTER+R751-BLOCKED-PLUS-ZERO-BYTE-PROGRESS',
    publisherBackpressureSince:state.publisherBackpressureSince||null,
    publisherBackpressureRecoveries:Number(state.publisherBackpressureRecoveries||0),
    lastPublisherBackpressureAt:state.lastPublisherBackpressureAt||null,
    transportSelfHealDelayMs:TRANSPORT_FATAL_RESTART_DELAY_MS_R746,
    transportSelfHealPending:Boolean(state.transportSelfHealPending),
    transportSelfHealCount:Number(state.transportSelfHealCount||0),
    lastTransportFatalAt:state.lastTransportFatalAt||null,
    lastTransportFatalReason:state.lastTransportFatalReason||'',
    lastWarning:state.lastWarning||'',
    producerRunning:state.producerRunning,
    audioGapBridgeActive:Boolean(state.audioGapBridgeActive),
    audioGapBridgeStarts:Number(state.audioGapBridgeStarts||0),
    audioGapBridgeBytes:Number(state.audioGapBridgeBytes||0),
    videoFeederRunning:Boolean(videoFeeder&&videoFeeder.exitCode===null),
    clipActive,
    stationHandoffActiveR804,
    stationLegacyCleanStopTimeoutMsR804:0, // R821 compatibility field
    stationPipeDrainTimeoutMsR804:0, // R821 compatibility field
    stationLegacyDrainDisabledR821:STATION_LEGACY_DRAIN_DISABLED_R821,
    stationHandoffModeR821:state.stationHandoffModeR821,
    stationNoDrainPromotionsR821:Number(state.stationNoDrainPromotionsR821||0),
    lastStationNoDrainPromotionR821:state.lastStationNoDrainPromotionR821||null,
    clipBoundaryReconnect:false,
    clipEndGuardMode:'R753-SINGLE-RETURN-HANDOFF+R752-UNIFIED-AV-DURATION-GUARD',
    clipEndGuardMarginMs:CLIP_END_GUARD_MARGIN_MS_R745,
    lastClipGuardRecovery:state.lastClipGuardRecovery||null,
    libraryTracks:state.libraryTracks,
    libraryAlbumTracks:state.libraryAlbumTracks,
    librarySingleTracks:state.librarySingleTracks,
    libraryCoverTracks:state.libraryCoverTracks,
    duplicateSinglesSkipped:state.duplicateSinglesSkipped,
    libraryRefreshSeconds:Math.round(LIBRARY_REFRESH_MS/1000),
    libraryVideos:state.libraryVideos,
    libraryBumpers:state.libraryBumpers,
    librarySpecial:state.librarySpecial,
    librarySpecial30:state.librarySpecial30,
    librarySpecial60:state.librarySpecial60,
    specialIntervalSeconds:Math.round(SPECIAL_INTERVAL_MS_R726/1000),
    specialHourlyIntervalSeconds:Math.round(SPECIAL_HOURLY_INTERVAL_MS_R727/1000),
    specialLoaded:Boolean(specialInsertR726),
    specialHourlyLoaded:Boolean(specialHourlyInsertR727),
    lastSpecialPlayedAt:state.lastSpecialPlayedAt,
    lastSpecialHourlyPlayedAt:state.lastSpecialHourlyPlayedAt,
    specialDueInSeconds:specialInsertR726?Math.max(0,Math.ceil((SPECIAL_INTERVAL_MS_R726-(Date.now()-lastSpecialPlayedAtR726))/1000)):null,
    specialHourlyDueInSeconds:specialHourlyInsertR727?Math.max(0,Math.ceil((SPECIAL_HOURLY_INTERVAL_MS_R727-(Date.now()-lastSpecialHourlyPlayedAtR727))/1000)):null,
    bumperSlots:bumperLibrary.map(x=>x.bumperSlot||bumperSlotR724(x)).filter(Boolean),
    songsSinceBumper:songsSinceBumperR724,
    nextBumperAfterSongs:bumperAfterSongsR724,
    lastBumperSlot:lastBumperSlotR724,
    cycle:state.cycle,
    queueLength:state.queueLength,
    queuePosition:state.queuePosition,
    previous:state.previous,
    current:state.current,
    next:state.next,
    upcomingR943:upcomingQueueR943(6),
    upcomingR942:upcomingQueueR943(6),
    lastManualQueueMoveR943:state.lastManualQueueMoveR943||null,
    startedAt:state.startedAt,
    streamStartedAt:state.streamStartedAt,
    uptimeSeconds:Math.max(0,Math.round((now-Date.parse(state.startedAt))/1000)),
    lastLibraryRefresh:state.lastLibraryRefresh,
    lastExit:state.lastExit,
    lastError:state.lastError,
    lastFfmpegLine:state.lastFfmpegLine,
    diagnosticsR802:{
      version:'R802',lastEventAt:state.lastDiagnosticAtR802||diagnosticRingR802.at(-1)?.at||null,
      latest:diagnosticRingR802.at(-1)||null,
      events:diagnosticRingR802.slice(-80),
      logFile:'r802-events.ndjson'
    },
    youtubeLiveUrl:YOUTUBE_LIVE_URL
  };
}


function setTimelineCompensationR739(seconds){
  const value=Number(seconds);
  if(!Number.isFinite(value))throw new Error('timeline seconds must be numeric');
  // R752: live video preroll is intentionally disabled. Keep the endpoint compatible,
  // but never allow it to move clip pixels ahead of the real audio boundary again.
  videoPipelineLeadR744=0;
  state.videoPipelineLeadSeconds=0;
  state.videoTimelineCompensationSeconds=0;
  return Promise.resolve({
    ok:true,
    seconds:0,
    requested:value,
    mode:'R752-LIVE-VIDEO-PREROLL-DISABLED-BOUNDARY-LOCKED',
    publisherRestarted:false,
    audioRestarted:false
  });
}

const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
  const headers={
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*'
  };

  if(url.pathname==='/'||url.pathname==='/health'||url.pathname==='/status'){
    res.writeHead(200,headers);
    res.end(JSON.stringify(publicStatus()));
    return;
  }

  if(req.method==='POST' && url.pathname.startsWith('/control/')){
    const remote=String(req.socket?.remoteAddress||'');
    const loopback=remote==='127.0.0.1'||remote==='::1'||remote==='::ffff:127.0.0.1';
    if(!loopback){res.writeHead(403,headers);res.end(JSON.stringify({ok:false,error:'local-control-only'}));return;}
    (async()=>{
      let result;
      if(url.pathname==='/control/visual-now')result=await applyVisualModeR721({slot:url.searchParams.get('slot')||''});
      else if(url.pathname==='/control/visual-next')result=armVisualNextTrackR1130(url.searchParams.get('slot')||'');
      else if(url.pathname==='/control/visual-auto')result=await applyVisualModeR721({auto:true});
      else if(url.pathname==='/control/full-fit')result=await ensureNormalVideoFeederR721({force:true}).then(()=>({ok:true,noCrop:true,restartedPublisher:false}));
      else if(url.pathname==='/control/timeline-offset')result=await setTimelineCompensationR739(url.searchParams.get('seconds'));
      else if(url.pathname==='/control/queue-move')result=moveUpcomingQueueR943(
        url.searchParams.get('offset'),
        url.searchParams.get('direction'),
        url.searchParams.get('itemId')
      );
      else if(url.pathname==='/control/queue-pick-r989')result=queuePickNextR1155(
        url.searchParams.get('type'),
        url.searchParams.get('key'),
        url.searchParams.get('title')
      );
      else throw new Error('unknown local control');
      res.writeHead(200,headers);res.end(JSON.stringify(result));
    })().catch(error=>{res.writeHead(500,headers);res.end(JSON.stringify({ok:false,error:cleanText(error?.message||error)}));});
    return;
  }

  if(url.pathname==='/library'){
    res.writeHead(200,headers);
    res.end(JSON.stringify({
      ok:true,
      tracks:state.libraryTracks,
      albumTracks:state.libraryAlbumTracks,
      singleTracks:state.librarySingleTracks,
      coverTracks:state.libraryCoverTracks,
      duplicateSinglesSkipped:state.duplicateSinglesSkipped,
      libraryRefreshSeconds:Math.round(LIBRARY_REFRESH_MS/1000),
      videos:state.libraryVideos,
      bumpers:state.libraryBumpers,
      special30min:state.librarySpecial30,
      special60min:state.librarySpecial60,
      specialLoaded:Boolean(specialInsertR726),
      specialHourlyLoaded:Boolean(specialHourlyInsertR727),
      specialDueInSeconds:specialInsertR726?Math.max(0,Math.ceil((SPECIAL_INTERVAL_MS_R726-(Date.now()-lastSpecialPlayedAtR726))/1000)):null,
      specialHourlyDueInSeconds:specialHourlyInsertR727?Math.max(0,Math.ceil((SPECIAL_HOURLY_INTERVAL_MS_R727-(Date.now()-lastSpecialHourlyPlayedAtR727))/1000)):null,
      bumperSlots:bumperLibrary.map(x=>x.bumperSlot||bumperSlotR724(x)).filter(Boolean),
      songsSinceBumper:songsSinceBumperR724,
      nextBumperAfterSongs:bumperAfterSongsR724,
      total:library.length,
      mode:state.mode,
      previous:state.previous,
      current:state.current,
      next:state.next
    }));
    return;
  }

  res.writeHead(404,headers);
  res.end(JSON.stringify({ok:false,error:'not-found'}));
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`ANDRIK Radio R1278 RELIABLE ENCODED PIPE + AUDIO/CHROMA FIX listening on :${PORT}`);
  radioLoop();
  // R1230: pre-build the five clean album ticker videos one-by-one at the lowest priority.
  // R1232: baked 92s album ticker prewarm disabled; final-stage ticker renders once before publisher encode.
  // setTimeout(()=>prewarmAlbumTickerVideosR1224(),30000).unref?.();
});

let shutdownStarted=false;
function waitChildExit(child,timeoutMs){
  return new Promise(resolve=>{
    // A signal-terminated child has exitCode=null and signalCode set.
    const exited=()=>!child||child.exitCode!=null||child.signalCode!=null;
    if(exited())return resolve(true);
    let done=false;
    let timer=null;
    const onExit=()=>finish(true);
    const finish=value=>{
      if(done)return;
      done=true;
      if(timer!==null)clearTimeout(timer);
      child.off('exit',onExit);
      resolve(value);
    };
    child.once('exit',onExit);
    timer=setTimeout(()=>finish(false),timeoutMs);
    if(exited())finish(true);
  });
}

async function shutdown(){
  if(shutdownStarted)return;
  shutdownStarted=true;
  stopping=true;stopMasterAudioGapBridgeR824('shutdown');if(transportFatalTimerR746){clearTimeout(transportFatalTimerR746);transportFatalTimerR746=null;}if(outputFatalTimerR780){clearTimeout(outputFatalTimerR780);outputFatalTimerR780=null;}
  if(liveTitleTimerR724){clearTimeout(liveTitleTimerR724);liveTitleTimerR724=null;}
  if(scheduleTimerR721)clearInterval(scheduleTimerR721);
  if(albumBackgroundWatcherTimerR1279)clearInterval(albumBackgroundWatcherTimerR1279);
  if(videoSourceWatchdogTimerR749){clearInterval(videoSourceWatchdogTimerR749);videoSourceWatchdogTimerR749=null;}
  if(masterBackpressureWatchdogTimerR750){clearInterval(masterBackpressureWatchdogTimerR750);masterBackpressureWatchdogTimerR750=null;}
  if(rtmpsEgressWatchdogTimerR792){clearInterval(rtmpsEgressWatchdogTimerR792);rtmpsEgressWatchdogTimerR792=null;}
  if(rtmpsProgressWatchdogTimerR1124){clearInterval(rtmpsProgressWatchdogTimerR1124);rtmpsProgressWatchdogTimerR1124=null;}
  if(transportRelayWatchdogTimerR1125){clearInterval(transportRelayWatchdogTimerR1125);transportRelayWatchdogTimerR1125=null;}
  if(orphanFfmpegGcTimerR1160P){clearInterval(orphanFfmpegGcTimerR1160P);orphanFfmpegGcTimerR1160P=null;}
  await clearNextMp3AudioPrearmR1156('shutdown-r1160p').catch(()=>{});
  await clearInsertPrearmR1069('shutdown-r1160p').catch(()=>{});
  await clearStationBlackPrearmR1145('shutdown-r1160p').catch(()=>{});
  try{server.close();}catch(_){ }

  const activeClip=clipPublisher;
  if(activeClip&&activeClip.exitCode===null){try{activeClip.kill('SIGTERM')}catch(_){ }}
  await waitChildExit(activeClip,1500);

  await stopPreparedVideoPrerollR744().catch(()=>{});
  await stopNormalVideoFeederR721();

  const activeDecoder=producer;
  if(activeDecoder&&activeDecoder.exitCode===null){try{activeDecoder.kill('SIGTERM')}catch(_){ }}
  await waitChildExit(activeDecoder,1800);

  // Only systemctl stop/restart closes the persistent master. Normal MP3, clip and
  // time-of-day transitions never execute this path and therefore never drop LIVE.
  const activeMaster=publisher;
  try{
    const audioSink=activeMaster?.stdio?.[3];
    const videoSink=activeMaster?.stdio?.[4];
    if(audioSink&&!audioSink.destroyed&&!audioSink.writableEnded)audioSink.end();
    if(videoSink&&!videoSink.destroyed&&!videoSink.writableEnded)videoSink.end();
  }catch(_){ }
  let clean=await waitChildExit(activeMaster,9000);
  if(!clean&&activeMaster&&activeMaster.exitCode===null){try{activeMaster.kill('SIGTERM')}catch(_){ }clean=await waitChildExit(activeMaster,2500);}
  if(!clean&&activeMaster&&activeMaster.exitCode===null){try{activeMaster.kill('SIGKILL')}catch(_){ }}

  // R1125 network workers are separate from the persistent encoder.
  await stopTransportRelaysR1125().catch(()=>{});
  process.exit(0);
}

process.once('SIGTERM',()=>{shutdown().catch(()=>process.exit(0));});
process.once('SIGINT',()=>{shutdown().catch(()=>process.exit(0));});
