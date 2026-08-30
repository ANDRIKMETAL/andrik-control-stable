import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
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
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const PORT = Number(process.env.PORT || 8080);
const PLAYLIST_URL = process.env.PLAYLIST_URL || 'https://andrikmetal.com/api/music/downloads';
const STREAM_KEY = String(process.env.YOUTUBE_STREAM_KEY || '').trim();
const STREAM_URL = String(process.env.STREAM_URL_OVERRIDE || '').trim() || (STREAM_KEY ? `rtmps://a.rtmps.youtube.com:443/live2/${STREAM_KEY}` : '');
const YOUTUBE_LIVE_URL = process.env.YOUTUBE_LIVE_URL || 'https://www.youtube.com/@andrikmetal/live';
const CACHE_DIR = process.env.RADIO_CACHE_DIR || '/var/cache/andrik-radio-r622';
const AUDIO_CACHE_DIR = `${CACHE_DIR}/audio`;
const VISUAL_CACHE_DIR = `${CACHE_DIR}/visuals`;
const MAX_CACHED_TRACKS = 10;
const VISUAL_TIME_ZONE = process.env.VISUAL_TIME_ZONE || 'Europe/Bratislava';
const FORCE_VISUAL_SLOT = ['morning','day','evening','night'].includes(String(process.env.FORCE_VISUAL_SLOT||'').trim().toLowerCase()) ? String(process.env.FORCE_VISUAL_SLOT).trim().toLowerCase() : '';
const VISUAL_AUTO_SCHEDULE_R658 = String(process.env.VISUAL_AUTO_SCHEDULE_R658||'').trim()==='1';
// R651: DAY / EVENING / NIGHT are owner-selected R2 videos cached locally on AWS.
// IMPORTANT: preserve the exact working R649 hotfix behavior: direct 1920x1080 scale,
// no crop and no pad. This intentionally fills the whole 16:9 frame every time.
const MORNING_VISUAL = process.env.MORNING_VISUAL || `${VISUAL_CACHE_DIR}/stream-morning-master-r703.mp4`;
const DAY_VISUAL = process.env.DAY_VISUAL || `${VISUAL_CACHE_DIR}/stream-day-master-r620.mp4`;
const EVENING_VISUAL = process.env.EVENING_VISUAL || `${VISUAL_CACHE_DIR}/stream-evening-master-r620.mp4`;
const NIGHT_VISUAL = process.env.NIGHT_VISUAL || `${VISUAL_CACHE_DIR}/stream-night-master-r620.mp4`;
const MORNING_VISUAL_URL = process.env.MORNING_VISUAL_URL || MORNING_VISUAL;
const DAY_VISUAL_URL = process.env.DAY_VISUAL_URL || DAY_VISUAL;
const EVENING_VISUAL_URL = process.env.EVENING_VISUAL_URL || EVENING_VISUAL;
const NIGHT_VISUAL_URL = process.env.NIGHT_VISUAL_URL || NIGHT_VISUAL;
const EMERGENCY_VISUAL = process.env.EMERGENCY_VISUAL || new URL('../assets/live-eye-r223.mp4', import.meta.url).pathname;
const QR_OVERLAY = process.env.QR_OVERLAY || new URL('../assets/andrik-qr-r612.png', import.meta.url).pathname;
const CTA_OVERLAY_R767 = process.env.CTA_OVERLAY_R767 || new URL('../assets/subscribe-right-r767.png', import.meta.url).pathname;
const CTA_LIKE_OVERLAY_R783 = process.env.CTA_LIKE_OVERLAY_R783 || new URL('../assets/like-right-r783.png', import.meta.url).pathname;
const CTA_SHOW_SECONDS_R722 = 8;
const CTA_PERIOD_SECONDS_R722 = 120; // kept cadence; R748 schedules full local windows only (no partial flashes)
const CTA_FIRST_SHOW_SECONDS_R748 = 20; // first compact CTA after feeder settles
const CTA_FADE_SECONDS_R748 = 0.35; // smooth alpha in/out instead of blink
const CTA_BOTTOM_GAP_R748 = 72; // R767: compact CTA directly above ticker
const CTA_RIGHT_GAP_R767 = 34; // R767: right side; old left CTA removed
const CLIP_PREP_SUFFIX_R782 = '.r787-ready.mp4'; // R787: rebuild all prepared video on the permanent no-crop geometry + verified station-audio path
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
const BUMPER_MIN_SONGS_R724 = 3; // R764: station bumpers more often
const BUMPER_MAX_SONGS_R724 = 4; // R764: every 3-4 real songs
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
const TRACK_AUDIO_FADE_IN_R726 = 0.55;
const TRACK_AUDIO_FADE_OUT_R726 = 1.25; // R743: clearly audible but short old-track fade-out
const VIDEO_FADE_SECONDS_R726 = 0.65; // R736: short cinematic fade-out on the OLD track
const VIDEO_FADE_IN_SECONDS_R736 = 0.80; // R763: longer viewer-visible recovery/brightening; same alpha-mask architecture
const VIDEO_BLACK_HOLD_SECONDS_R736 = 0.05; // almost no dead-black hold
const VIDEO_FADE_LEAD_SECONDS_R735 = 1.40; // R763: start the proven R753 boundary darkening exactly 1.0s earlier than R762
const TITLE_SWITCH_BEFORE_BOUNDARY_R781 = Math.max(0.50,Math.min(2.50,Number(process.env.TITLE_SWITCH_BEFORE_BOUNDARY_R781 || (VIDEO_FADE_LEAD_SECONDS_R735 + VIDEO_BLACK_HOLD_SECONDS_R736/2)))); // R781: switch CURRENT to the next MP3 while the screen is black, before recovery
const TITLE_VISUAL_LEAD_SECONDS_R738 = 3.20; // compensate persistent video path latency; CURRENT is preloaded early but appears at the real handoff
const CLIP_PRE_DRAIN_MS_R738 = 900; // let the bounded MP3 PCM queue drain while the normal visual keeps running
const CLIP_POST_DRAIN_MS_R738 = 650; // let the clip PCM/video tail drain before the next MP3 feeder starts
const VIDEO_TIMELINE_COMP_DEFAULT_R739 = 0.0; // R743: disable R739 global compensation; it hid/late-shifted proven R732 boundary UI
const CLIP_PREP_NICE_R742 = 12; // background clip preparation yields CPU to the live stream
const CLIP_PREP_TIMEOUT_MS_R742 = 45*60*1000;
const CLIP_PREP_MIN_BYTES_R742 = 500000; // prepared 1080p H264+AAC cache sanity check
const VIDEO_PIPELINE_LEAD_SECONDS_R745 = Math.max(2,Math.min(15,Number(process.env.VIDEO_PIPELINE_LEAD_SECONDS_R745 || process.env.VIDEO_PIPELINE_LEAD_SECONDS_R744 || 10.0))); // R745: 10s default after real viewer-side test; keeps backward env compatibility
const VIDEO_BOUNDARY_FADE_SECONDS_R744 = 0.80;
const CLIP_END_GUARD_MARGIN_MS_R745 = Math.max(8000,Number(process.env.CLIP_END_GUARD_MARGIN_MS_R745 || 15000)); // watchdog margin after measured clip duration
const TRANSPORT_FATAL_RESTART_DELAY_MS_R746 = Math.max(1500,Math.min(15000,Number(process.env.TRANSPORT_FATAL_RESTART_DELAY_MS_R746 || 3500))); // R746: restart whole service when FFmpeg/FIFO keeps a dead RTMPS/TLS session alive
const TRANSPORT_FATAL_REGEX_R746 = /the specified session has been invalidated|error in the pull function|io error:\s*end of file|server returned 4\d\d|connection reset by peer|broken pipe|connection timed out|connection refused|network is unreachable|tls[^\n]*(?:error|fail)|error writing (?:trailer|header|packet)|av_interleaved_write_frame/i;
const OUTPUT_FATAL_REGEX_R780 = /tag\s+.*incompatible with output codec|could not write header|error opening output file|error opening output files|bitstream filter not found|invalid data found when processing input/i; // R780: FIFO child can stay alive while FLV header is permanently rejected
const LOUDNESS_ANALYSIS_TIMEOUT_MS_R747 = Math.max(8000,Math.min(120000,Number(process.env.LOUDNESS_ANALYSIS_TIMEOUT_MS_R747 || 45000)));
// R750: loudness analysis is background-only and serialized. It can never delay a live MP3 handoff.
const LOUDNESS_BACKGROUND_NICE_R750 = Math.max(10,Math.min(19,Number(process.env.LOUDNESS_BACKGROUND_NICE_R750 || 15)));
// R750: keep the 6 s FIFO timeshift, but never allow minutes of queued packets to back-pressure
// the live A/V pipes. A bounded FIFO with overflow drop keeps YouTube receiving fresh media.
const OUTPUT_FIFO_QUEUE_PACKETS_R750 = Math.max(768,Math.min(4096,Number(process.env.OUTPUT_FIFO_QUEUE_PACKETS_R750 || 2048)));
const MASTER_BACKPRESSURE_STUCK_MS_R750 = Math.max(10000,Math.min(120000,Number(process.env.MASTER_BACKPRESSURE_STUCK_MS_R750 || 30000))); // R751: only no-progress stalls, not normal needDrain
const MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750 = Math.max(500,Math.min(5000,Number(process.env.MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750 || 1000)));
const LOUDNESS_CACHE_SUFFIX_R747 = '.r747-loudnorm.json';
// R749: harden mandatory MP4 inserts without touching the proven ONE-RTMPS transport.
// A prepared video may legitimately finish writing into the deep H264 queue shortly
// before its audio boundary. Keep a short, identity-bound arm record instead of
// mistaking that clean EOF for a dead insert. A separate source watchdog guarantees
// that the persistent publisher is never left with zero live H264 writers.
const INSERT_PREROLL_ARM_GRACE_MS_R749 = Math.max(2500,Math.min(15000,Number(process.env.INSERT_PREROLL_ARM_GRACE_MS_R749 || 6000)));
const VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749 = Math.max(500,Math.min(5000,Number(process.env.VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749 || 1000)));
const VIDEO_SOURCE_STUCK_MS_R749 = Math.max(1200,Math.min(10000,Number(process.env.VIDEO_SOURCE_STUCK_MS_R749 || 2500)));
const INSERT_AUDIO_START_TIMEOUT_MS_R749 = Math.max(1000,Math.min(12000,Number(process.env.INSERT_AUDIO_START_TIMEOUT_MS_R749 || 4000))); // R751: slow AAC/MP4 startup must skip safely, never crash
const INSERT_CACHE_WARM_LEAD_SECONDS_R752 = Math.max(2,Math.min(8,Number(process.env.INSERT_CACHE_WARM_LEAD_SECONDS_R752 || 5.0))); // metadata/cache warm only; ZERO media frames before boundary
const CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753 = Math.max(2500,Math.min(10000,Number(process.env.CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753 || 5000))); // allow one clean clip→MP3 feeder handoff without watchdog racing it
const CLIP_TO_TRACK_FADE_IN_SECONDS_R753 = Math.max(0.25,Math.min(1.5,Number(process.env.CLIP_TO_TRACK_FADE_IN_SECONDS_R753 || 0.55))); // black→picture on first MP3 frames after a clip
const VIDEO_INSERT_FADE_IN_SECONDS_R757 = Math.max(0.25,Math.min(1.5,Number(process.env.VIDEO_INSERT_FADE_IN_SECONDS_R757 || 0.55))); // guaranteed black→video on MP3→clip/insert boundary
const MP3_BOUNDARY_FADE_IN_SECONDS_R758 = Math.max(0.20,Math.min(1.5,Number(process.env.MP3_BOUNDARY_FADE_IN_SECONDS_R758 || 0.80))); // R763 metadata/env compatibility: longer visible MP3 boundary recovery
// R721 keeps the proven 100-frame / 4-second exact-periodic QTRLE loops from R720.
// The EQ is encoded inside the current local H264 feeder, while the YouTube RTMPS
// publisher stays open permanently across MP3, clip and visual-period switches.
const EQUALIZER_FILES_R721 = Object.freeze({
  morning: new URL('../assets/equalizer-morning-r720.mov', import.meta.url).pathname,
  day: new URL('../assets/equalizer-day-r720.mov', import.meta.url).pathname,
  evening: new URL('../assets/equalizer-evening-r720.mov', import.meta.url).pathname,
  night: new URL('../assets/equalizer-night-r720.mov', import.meta.url).pathname
});
const OUTPUT_TIMESHIFT_SECONDS = 6; // R637: network recovery cushion; packets are NEVER dropped
const VIDEO_BITRATE = '6000k'; // R762: safe 1080p25 quality lift; CBR only, encoder architecture/preset unchanged
const AUDIO_BITRATE = '160k'; // R762: modest stereo AAC quality lift; sample rate/queues unchanged
const AUDIO_SAMPLE_RATE = 44100; // YouTube Live recommendation for stereo
const VIDEO_FPS = 25;
const FULL_FRAME_FILTER_R787 = 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1'; // immutable CONTAIN: entire source visible, never crop/zoom
const VIDEO_INPUT_QUEUE_PACKETS_R732 = 8; // R767: max ~0.32s at 25fps; prevents stale MP3 frames from trailing into clip audio
const AUDIO_INPUT_QUEUE_PACKETS_R732 = 8; // ~0.74 s FFmpeg raw-packet cushion; ~1 s incl. pipe; prevents 20–30 s title/audio drift
const VIDEO_GOP = 50; // exactly 2 seconds at 25 fps
const LIBRARY_REFRESH_MS = Math.max(60000, Number(process.env.LIBRARY_REFRESH_MS || 120000));
const LIVE_TICKER_FILE = process.env.LIVE_TICKER_FILE || `${CACHE_DIR}/live-ticker.txt`;
const LIVE_CURRENT_FILE = process.env.LIVE_CURRENT_FILE || `${CACHE_DIR}/current-live.txt`;
const LIVE_PREVIOUS_FILE_R726 = process.env.LIVE_PREVIOUS_FILE_R726 || `${CACHE_DIR}/previous-live-r726.txt`;
const LIVE_NEXT_FILE_R726 = process.env.LIVE_NEXT_FILE_R726 || `${CACHE_DIR}/next-live-r726.txt`;
const LIVE_BOUNDARY_TITLE_FILE_R790 = process.env.LIVE_BOUNDARY_TITLE_FILE_R790 || `${CACHE_DIR}/boundary-title-r790.txt`;
const COMMITTED_NEXT_FILE_R769 = process.env.COMMITTED_NEXT_FILE_R769 || `${CACHE_DIR}/committed-next-r769.json`;
const CLIP_CACHE_DIR = `${CACHE_DIR}/clips`;
const RADIO_CLIPS_URL_R691 = process.env.RADIO_CLIPS_URL_R691 || 'https://andrikmetal.com/api/music/radio-clips-r691';
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
const DISABLED_ALBUM_PREFIXES = Object.freeze([
  'albums/illusion-of-life/',
  'albums/ocean/'
]);

const state = {
  service: 'ANDRIK Metal Radio 24/7',
  version: 'R790-IRONCLAD-AV-PTS-TITLE-CONTINUOUS-H264-R787-PRESERVED',
  mode: 'R790 IRONCLAD AV + PTS-LOCKED TITLE + CONTINUOUS RAW-H264 MASTER + R787 NOCROP PRESERVED',
  startedAt: new Date().toISOString(),
  streamStartedAt: null,
  publisherRunning: false,
  producerRunning: false,
  overlayMode: 'R757 PREV/NEXT ON MP3 + NORMAL CLIPS @ INTRO 2-7s + FINAL 10s / R756 PRESERVED',
  audioMode: 'R750 NONBLOCKING R747 EBU R128 -14 LUFS / TP -1.5 + R743 FADES + AUDIO QUEUE 8 / ONE RTMPS',
  mp3ToVideoFadeMode: 'R757-END-BLACK-HOLD-THEN-VIDEO-FADE-IN',
  clipPreviewMode: 'R757-NORMAL-CLIPS-PREVNEXT-INTRO-2-7S-PLUS-FINAL-10S',
  mp3BoundaryFadeMode: 'R763-R753-SAME-FEEDER-BLACK-ALPHA-0.65-HOLD-0.05-LEAD-1.40-RECOVER-0.80',
  visualTimeZone: VISUAL_TIME_ZONE,
  visualPeriod: null,
  visualPath: null,
  visualInsetCrop: '',
  libraryTracks: 0,
  libraryAlbumTracks: 0,
  librarySingleTracks: 0,
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
  bumperCadenceMode: 'R764-EVERY-3-4-SONGS',
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
  equalizerEngine: 'R721-EXACT-PERIODIC-QTRLE-FEEDER-4-SLOT',
  visualLoopOffsetSeconds: 0,
  visualContinuityMode: 'R735-WALLCLOCK-SEEK-CONTINUITY',
  clipAvSyncMode: 'R738-PTS0-ASYNC-FIRSTPTS0',
  clipPreDrainMs: CLIP_PRE_DRAIN_MS_R738,
  clipPostDrainMs: CLIP_POST_DRAIN_MS_R738,
  videoTimelineCompensationSeconds: VIDEO_TIMELINE_COMP_DEFAULT_R739,
  videoTimelineCompensationMode: 'R743-DISABLED-FOR-MP3-BOUNDARY',
  clipPlaybackMode: 'R742-PREPARED-H264-COPY',
  clipPreparationMode: 'R742-SERIAL-NICE12-ONE-THREAD',
  preparedClipReady: 0,
  preparedClipPending: 0,
  preparedClipLast: '',
  videoPipelineLeadSeconds: 0,
  videoHandoffMode: 'R753-R752-CACHE-ONLY-NO-LIVE-PREROLL',
  clipAvSyncMode: 'R790-R767-ONE-FFMPEG-BOTH-READY-SAME-TICK+25FPS-FRAMECOUNT+44100-SAMPLECOUNT',
  feederFilterChainMode: 'R769-EXPLICIT-CHAIN-SEPARATOR-BETWEEN-ENDMASK-AND-STARTMASK',
  committedNextMode: 'R769-DISK-CHECKPOINT-NORMAL-TRACK-NEXT',
  committedNextTitle: '',
  committedNextRecovered: false,
  committedNextCommittedAt: null,
  suppressedVideoInsert: '',
  transportHealthy: false,
  transportSelfHealPending: false,
  transportSelfHealCount: 0,
  lastTransportFatalAt: null,
  lastTransportFatalReason: '',
  outputEgressGuardMode: 'R780-FLV-TAG7-A10+HARD-MUX-FATAL-RESTART',
  fullFrameGuardMode: 'R790-R787-VIEWER-PROVEN-FIT-PAD-1920x1080-SAR1-NO-CROP',
  stationAudioGuardMode: 'R784-BEST-AUDIO-STREAM+PREPARED-RMS-VERIFY',
  masterTimestampErrorCount: 0,
  lastMasterTimestampErrorAt: null,
  videoTimestampOffsetSecondsR787: 0,
  lastOutputFatalAt: null,
  lastOutputFatalReason: '',
  titleBoundarySwitchMode: 'R790-FFMPEG-PTS-LOCKED-NEXT-TITLE-DURING-BLACK-NO-WALLCLOCK-TIMER',
  titleBoundarySwitchTarget: '',
  titleBoundarySwitchScheduledAt: null,
  titleBoundarySwitchFiredAt: null,
  titleBoundarySwitchCount: 0,
  publisherBackpressureSince: null,
  publisherBackpressureRecoveries: 0,
  lastPublisherBackpressureAt: null
};

let publisher = null;
let producer = null;
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
let visualSwitching = false;
let scheduleTimerR721 = null;
let runtimeForceVisualSlot = FORCE_VISUAL_SLOT;
let runtimeVisualAutoSchedule = VISUAL_AUTO_SCHEDULE_R658;
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
    if(previousTrack?.type==='track')writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,`РАНЕЕ • ANDRIK — ${shortText(previousTrack.title||'TRACK',32)}`);
    if(nextTrack?.type==='track')writeOverlayFileR726(LIVE_NEXT_FILE_R726,`NEXT • ANDRIK — ${shortText(nextTrack.title||'TRACK',32)}`);
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

function albumName(item){
  const album=cleanText(item.album||'');
  if(album)return album;
  const key=String(item.key||'');
  if(/^singles\//i.test(key))return 'СИНГЛ';
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

function mergeAlbumsAndSingles(albums,singles){
  // Album copy wins over the single copy. This means a single can play immediately
  // after upload, but once the same song appears in an active album it is heard only once.
  const albumIds=new Set(albums.flatMap(identityCandidates));
  const singleIds=new Set();
  const keptSingles=[];
  let skipped=0;

  for(const item of singles){
    const ids=identityCandidates(item);
    if(ids.some(id=>albumIds.has(id)) || ids.some(id=>singleIds.has(id))){
      skipped++;
      continue;
    }
    ids.forEach(id=>singleIds.add(id));
    keptSingles.push(item);
  }
  return {tracks:[...albums,...keptSingles],singles:keptSingles,skipped};
}

function librarySignature(items){
  return items.map(item=>`${item.url}|${item.identity}`).sort().join('\n');
}

async function loadRadioClipsR691(){
  const builtIn=[];
  if(JOY_OF_BEING_CLIP_ENABLED)builtIn.push(prepareClip(JOY_OF_BEING_CLIP));
  builtIn.push(prepareClip(YA_EST_CLIP_R724));
  try{
    const url=`${RADIO_CLIPS_URL_R691}${RADIO_CLIPS_URL_R691.includes('?')?'&':'?'}ts=${Date.now()}`;
    const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-R724-Clips-Bumpers'},signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`R2 radio clips HTTP ${response.status}`);
    const data=await response.json();
    const dynamic=(Array.isArray(data?.clips)?data.clips:[])
      .filter(item=>/^https:\/\//i.test(String(item?.url||'')) && /\.mp4(?:$|\?)/i.test(String(item?.url||'')))
      .map(item=>prepareClip({...item,bumperSlot:Number(item?.bumperSlot)||bumperSlotR724(item),special30min:Boolean(item?.special30min)||isSpecialInsertR726(item),special60min:Boolean(item?.special60min)||isSpecialHourlyInsertR727(item)}));
    const bumpersBySlot=new Map();
    specialInsertR726=null;
    specialHourlyInsertR727=null;
    for(const item of dynamic){
      const slot=bumperSlotR724(item)||Number(item.bumperSlot)||0;
      if(slot>=1&&slot<=3&&!bumpersBySlot.has(slot))bumpersBySlot.set(slot,{...item,bumperSlot:slot,sourceType:'radio-bumper'});
      else if(isSpecialInsertR726(item)&&!specialInsertR726)specialInsertR726={...item,special30min:true,sourceType:'radio-special-30',title:'ANDRIK METAL RADIO • SPECIAL 30'};
      else if(isSpecialHourlyInsertR727(item)&&!specialHourlyInsertR727)specialHourlyInsertR727={...item,special60min:true,sourceType:'radio-special-60',title:'ANDRIK METAL RADIO • SPECIAL 60'};
    }
    bumperLibrary=[...bumpersBySlot.values()].sort((a,b)=>a.bumperSlot-b.bumperSlot);
    const normalDynamic=dynamic.filter(item=>!bumperSlotR724(item)&&!Number(item.bumperSlot)&&!isAnySpecialInsertR727(item));
    const byUrl=new Map();
    for(const clip of [...builtIn,...normalDynamic])if(clip.url&&!byUrl.has(clip.url))byUrl.set(clip.url,clip);
    clipLibrary=[...byUrl.values()];
  }catch(error){
    console.error('[radio-clips-r724]',cleanText(error?.message||error));
    const existingDynamic=clipLibrary.filter(item=>!item.builtIn&&!bumperSlotR724(item)&&!isAnySpecialInsertR727(item));
    clipLibrary=[...builtIn,...existingDynamic.filter(item=>!builtIn.some(b=>b.url===item.url))];
  }
  state.libraryVideos=clipLibrary.length;
  state.libraryBumpers=bumperLibrary.length;
  state.librarySpecial=(specialInsertR726?1:0)+(specialHourlyInsertR727?1:0);
  state.librarySpecial30=specialInsertR726?1:0;
  state.librarySpecial60=specialHourlyInsertR727?1:0;
  // R782: the 3 bumpers + SPECIAL 30 + SPECIAL 60 are mandatory station IDs and
  // must get their fresh A/V-normalized cache first. Normal music clips (with baked CTA)
  // remain background/serial and are queued only after all five station inserts.
  bumperLibrary.forEach(prefetchPreparedClipR742);
  if(specialInsertR726)prefetchPreparedClipR742(specialInsertR726);
  if(specialHourlyInsertR727)prefetchPreparedClipR742(specialHourlyInsertR727);
  clipLibrary.forEach(prefetchPreparedClipR742);
  return clipLibrary;
}

async function loadLibrary(){
  const previousSignature=librarySignature([...library,...clipLibrary,...bumperLibrary,...(specialInsertR726?[specialInsertR726]:[]),...(specialHourlyInsertR727?[specialHourlyInsertR727]:[])]);
  const url=`${PLAYLIST_URL}${PLAYLIST_URL.includes('?')?'&':'?'}ts=${Date.now()}`;
  const response=await fetch(url,{headers:{'user-agent':'ANDRIK-Radio-24-7-R691'}});
  if(!response.ok)throw new Error(`R2 library HTTP ${response.status}`);

  const data=await response.json();
  const source=Array.isArray(data.tracks)?data.tracks:[];
  const validMp3=item=>{
    const url=String(item?.url||'');
    return /^https:\/\//i.test(url) && /\.mp3(?:$|\?)/i.test(url);
  };

  const albums=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    const keyLower=key.toLowerCase();
    const disabled=DISABLED_ALBUM_PREFIXES.some(prefix=>keyLower.startsWith(prefix));
    return /^albums\//i.test(key) && !disabled && validMp3(item);
  }).map(item=>prepareTrack(item,'album')));

  const singles=uniqueByUrl(source.filter(item=>{
    const key=String(item?.key||'');
    return /^singles\/[^/]+\.mp3$/i.test(key) && validMp3(item);
  }).map(item=>prepareTrack(item,'single')));

  const merged=mergeAlbumsAndSingles(albums,singles);
  if(!merged.tracks.length)throw new Error('R2 active MP3 library is empty');

  library=merged.tracks;
  await loadRadioClipsR691();
  state.libraryTracks=library.length;
  state.libraryAlbumTracks=albums.length;
  state.librarySingleTracks=merged.singles.length;
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
  const id=createHash('sha1').update(String(item?.url||'')).digest('hex').slice(0,24);
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
  downloadTrackToCache(item).then(path=>scheduleLoudnessAnalysisR750(path)).catch(error=>{
    console.error('[prefetch]',cleanText(error?.message||error));
  });
}

function clipCachePathR691(item){
  if(String(item?.url||'')===JOY_OF_BEING_CLIP_URL)return JOY_OF_BEING_CLIP_PATH;
  const base=String(item?.key||item?.title||'clip').split('/').pop().replace(/\.mp4$/i,'')
    .normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,56)||'clip';
  const hash=createHash('sha1').update(String(item?.url||item?.key||item?.title||base)).digest('hex').slice(0,10);
  return `${CLIP_CACHE_DIR}/${base}-${hash}.mp4`;
}

async function downloadRadioClipR691(item){
  if(!item?.url)throw new Error('radio clip URL missing');
  prepareCacheDir();
  const dest=clipCachePathR691(item);
  try{if(existsSync(dest)&&statSync(dest).size>500000)return dest}catch(_){ }
  if(clipPrefetchJobs.has(dest))return clipPrefetchJobs.get(dest);
  const job=(async()=>{
    const tmp=`${dest}.part-${process.pid}-${Date.now()}`;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),240000);
    try{
      const response=await fetch(item.url,{headers:{'user-agent':'ANDRIK-Radio-R691-Clip'},signal:controller.signal});
      if(!response.ok)throw new Error(`clip HTTP ${response.status}`);
      if(!response.body)throw new Error('clip empty response');
      await pipeline(Readable.fromWeb(response.body),createWriteStream(tmp,{flags:'w'}));
      if(!existsSync(tmp)||statSync(tmp).size<500000)throw new Error('clip file too small');
      renameSync(tmp,dest);
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
      'drawbox=x=0:y=ih-204:w=iw:h=88:color=black@0.38:t=fill',
      'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill',
      `drawtext=${titleFontPart}textfile='${titlePath}':fontcolor=white@0.01:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=8:bordercolor=black@0.92`,
      `drawtext=${titleFontPart}textfile='${titlePath}':fontcolor=0xF8F4EE:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1:shadowx=4:shadowy=4`,
      `drawtext=${fontPart}textfile='${tickerPath}':fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
    );
  }
  let graph=`[0:v]${base.join(',')}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-24:y=24:shortest=1:format=yuv420,format=yuv420p[qrbase]`;
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
        graph+=`;[${baseLabel}][pctaf${i}]overlay=x=W-w-${CTA_RIGHT_GAP_R767}:y=H-h-${CTA_BOTTOM_GAP_R748}:shortest=0:format=yuv420[${out}]`;
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
  const args=[
    '-hide_banner','-loglevel','warning','-y','-filter_complex_threads','1','-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-i',sourcePath,
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
    ? `${stationLeadTrimR782>0.01?`atrim=start=${stationLeadTrimR782.toFixed(3)},asetpts=N/SR/TB,`:''}aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,apad=pad_dur=${Math.max(0.5,duration).toFixed(3)},atrim=duration=${Math.max(0.5,duration).toFixed(3)},asetpts=N/SR/TB`
    : `aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,asetpts=N/SR/TB`;
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
    const preparedGeometryR787=await probePreparedGeometryR787(tmp);
    const geometryKeyR787=String(item?.key||item?.title||sourcePath.split('/').pop()||'clip');
    state.preparedGeometryByKey={...(state.preparedGeometryByKey||{}),[geometryKeyR787]:{...preparedGeometryR787,verifiedAt:new Date().toISOString()}};
    if(stationInsert){
      const verified=await probeStationBestAudioStreamR784(tmp,{maxStreams:1});
      const key=String(item?.key||item?.title||'station');
      state.stationPreparedAudioByKey={...(state.stationPreparedAudioByKey||{}),[key]:{rms:Number(verified.rms.toFixed(2)),peak:Number(verified.peak),verifiedAt:new Date().toISOString()}};
    }
    renameSync(tmp,readyPath);
    state.preparedClipLast=shortText(item?.title||sourcePath.split('/').pop(),52);
    return readyPath;
  }finally{try{if(existsSync(tmp))unlinkSync(tmp)}catch(_){ }}
}
async function ensurePreparedClipR742(item){
  const sourcePath=await downloadRadioClipR691(item);
  const readyPath=preparedClipPathR742(sourcePath);
  if(preparedClipValidR742(sourcePath,readyPath,item))return readyPath;
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
function clipLiveVideoFilterR757({duration=0,showPreview=false}={}){
  const font=chooseFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const prevPath=ffFilterPath(LIVE_PREVIOUS_FILE_R726);
  const nextPath=ffFilterPath(LIVE_NEXT_FILE_R726);
  const d=Math.max(0,Number(duration)||0);
  const introStart=START_PREVIEW_DELAY_SECONDS_R748;
  const introEnd=introStart+START_PREVIEW_SHOW_SECONDS_R748;
  const outroStart=Math.max(0,d-NEXT_PREVIEW_SECONDS_R726);
  const outroEnd=Math.max(outroStart+0.25,d-NEXT_PREVIEW_HIDE_BEFORE_END_R726);
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
    `fade=t=in:st=0:d=${VIDEO_INSERT_FADE_IN_SECONDS_R757.toFixed(2)}`
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
  if(showPreview&&previewExpr!=='0'){
    const enable=`:enable='${previewExpr}'`;
    vf.push(
      `drawtext=${fontPart}textfile='${prevPath}':fontcolor=white@1:fontsize=32:x=58:y=h-305:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${enable}`,
      `drawtext=${fontPart}textfile='${nextPath}':fontcolor=white@1:fontsize=32:x=w-text_w-58:y=h-305:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${enable}`
    );
  }
  return vf.join(',');
}

function rawH264VideoOutputArgsR790(){
  // R790: feeder-local container timestamps are forbidden on the LIVE video pipe.
  // Every feeder emits only Annex-B H264 access units. The ONE persistent master H264
  // demuxer owns the 25fps clock for the lifetime of the service, so feeder restarts
  // cannot create DTS/PTS discontinuities or wall-clock timestamp jumps.
  return ['-f','h264','pipe:1'];
}

function clipPreparedFeederArgsR742(readyPath,{hasAudio=true,duration=0,showPreview=false}={}){
  const d=Math.max(0,Number(duration)||0);
  const dText=d>0?String(Math.max(0.5,d)):'';
  // R767: raw PCM loses container timestamps at the master pipe. Rebuild its clock
  // from the exact sample count, just like video is rebuilt from exact frame count.
  // 44100 / 25 = 1764 samples per video frame, so the two clocks cannot drift.
  const audioTailLockR766=d>0
    ? `aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,apad=pad_dur=${d.toFixed(3)},atrim=duration=${d.toFixed(3)},asetpts=N/SR/TB`
    : `aresample=${AUDIO_SAMPLE_RATE}:async=0:first_pts=0,asetpts=N/SR/TB`;
  const args=[
    '-hide_banner','-loglevel','warning','-stats_period','0.5','-progress','pipe:4','-nostats',
    '-fflags','+genpts+discardcorrupt','-err_detect','ignore_err','-re','-i',readyPath,
    '-map','0:v:0','-an','-sn','-dn',
    '-vf',clipLiveVideoFilterR757({duration:d,showPreview}),
    ...h264EncoderArgsR721()
  ];
  // R766: -t is an OUTPUT option. R764 placed it only before the SECOND (audio)
  // output, so the H264 pipe could hit EOF early while PCM kept playing. Put the same
  // explicit duration on EACH output and pad the video/audio tails to that boundary.
  if(dText)args.push('-t',dText);
  args.push(...rawH264VideoOutputArgsR790(),
    '-map',hasAudio?'0:a:0':'0:a:0','-vn','-sn','-dn',
    '-af',audioTailLockR766,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
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
    '-vf',`${FULL_FRAME_FILTER_R787},fps=${VIDEO_FPS},format=yuv420p`,
    ...h264EncoderArgsR721()
  ];
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push(...rawH264VideoOutputArgsR790());
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
  if(!child){
    clipVideoPrerollIdentityR744='';
    clipVideoPrerollArmedR749=null;
    return;
  }
  child.__r749IntentionalStop=true;
  const videoSink=publisher?.stdio?.[4];
  try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
  if(child.exitCode===null){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,500))&&child.exitCode===null){
      try{child.kill('SIGKILL')}catch(_){ }
      await waitChildExit(child,150);
    }
  }
  if(clipVideoPrerollR744===child)clipVideoPrerollR744=null;
  clipVideoPrerollIdentityR744='';
  clipVideoPrerollArmedR749=null;
}
async function startPreparedVideoPrerollR744(item,readyPath,duration){
  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!videoSink||videoSink.destroyed||videoSink.writableEnded)throw new Error('R749 persistent video pipe unavailable');
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
    clipVideoPrerollArmedR749={
      identity:itemId,
      startedAt:Date.now(),
      duration:Number(duration)||0,
      lead,
      startedOk:true,
      completedOk:false,
      completedAt:0,
      invalid:false,
      exitCode:null
    };
    child.stdout.pipe(videoSink,{end:false});
    child.stdout.on('error',()=>{});
    child.stderr.on('data',d=>{
      const line=String(d||'').trim();
      if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);console.error('[r749-video-preroll]',line);}
    });
    child.on('exit',(code,signal)=>{
      try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
      const isCurrent=clipVideoPrerollR744===child;
      if(isCurrent)clipVideoPrerollR744=null;
      const arm=clipVideoPrerollArmedR749;
      if(child.__r749IntentionalStop)return;
      if(code===0){
        // Clean EOF is NOT a failure. With the persistent master queue, all prepared
        // H264 packets may already be buffered while the audio boundary is about to fire.
        if(arm&&arm.identity===itemId){arm.completedOk=true;arm.completedAt=Date.now();arm.exitCode=0;}
        state.videoHandoffMode='R749-PREROLL-CLEAN-EOF-ARMED';
        return;
      }
      if(arm&&arm.identity===itemId){arm.invalid=true;arm.exitCode=code??signal??'exit';}
      if(clipVideoPrerollIdentityR744===itemId)clipVideoPrerollIdentityR744='';
      clipActive=false;
      state.lastError=`R749 video preroll failed: ${shortText(item?.title||'VIDEO',40)} exit ${code??signal??'unknown'}`;
      console.error('[r749-video-preroll-exit]',state.lastError);
      ensureVideoSourceAfterClipR745(state.next).catch(error=>{state.lastError+=` | recovery: ${cleanText(error?.message||error)}`;});
    });
    // Store the exact start stamp on the child for diagnostics; the arm object remains
    // authoritative even if the process reaches a clean EOF before the audio boundary.
    child.__r749StartedAt=clipVideoPrerollArmedR749.startedAt;
    state.videoHandoffMode='R749-ARMED-VIDEO-INSERT';
    return true;
  }finally{visualSwitching=false;}
}
async function startNormalVideoPrerollR744(item,duration){
  const visual=await ensureScheduledVisual();
  const period=activeVisualPeriodR721();
  const identity=primaryIdentity(item);
  visualSwitching=true;
  try{
    await stopPreparedVideoPrerollR744();
    clipActive=false;
    await stopNormalVideoFeederR721();
    writeOverlayFileR726(LIVE_CURRENT_FILE,currentOverlayTextR738(item));
    const visualOffsetSeconds=await visualLoopOffsetR735(visual);
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
  state.videoHandoffMode='R752-CACHE-WARM-SCHEDULED-NO-LIVE-PREROLL';
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

function visualSpecForPeriod(period){
  if(period==='morning')return {period,path:MORNING_VISUAL,url:MORNING_VISUAL_URL};
  if(period==='day')return {period,path:DAY_VISUAL,url:DAY_VISUAL_URL};
  if(period==='evening')return {period,path:EVENING_VISUAL,url:EVENING_VISUAL_URL};
  return {period:'night',path:NIGHT_VISUAL,url:NIGHT_VISUAL_URL};
}

async function ensureVisualSpec(spec){
  try{
    if(existsSync(spec.path) && statSync(spec.path).size>2*1024*1024)return spec.path;
  }catch(_){}
  if(/^https:\/\//i.test(spec.url||''))return downloadVisualToCache(spec.url,spec.path,spec.period);
  if(existsSync(spec.url||'') && statSync(spec.url).size>500000)return spec.url;
  throw new Error(`R622 ${spec.period} visual unavailable: ${spec.url||spec.path}`);
}

function prefetchAllVisuals(){
  for(const period of ['morning','day','evening','night']){
    const spec=visualSpecForPeriod(period);
    ensureVisualSpec(spec).catch(error=>console.error('[visual-prefetch]',cleanText(error?.message||error)));
  }
}

async function ensureScheduledVisual(){
  prepareCacheDir();
  const scheduled=visualPeriodForHour(localHourInTimeZone());
  const period=runtimeForceVisualSlot || scheduled;
  const spec=visualSpecForPeriod(period);
  try{
    const path=await ensureVisualSpec(spec);
    state.visualPeriod=runtimeVisualAutoSchedule?`auto-${period}`:(runtimeForceVisualSlot?`manual-${period}`:period);
    state.visualPath=path;
    state.visualInsetCrop='';
    return path;
  }catch(error){
    if(period==='morning'){
      try{
        const fallback=await ensureVisualSpec(visualSpecForPeriod('day'));
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
    morning:{name:'morning-soft-gold-seamless-r721',path:EQUALIZER_FILES_R721.morning},
    day:{name:'day-steel-seamless-r721',path:EQUALIZER_FILES_R721.day},
    evening:{name:'evening-amber-seamless-r721',path:EQUALIZER_FILES_R721.evening},
    night:{name:'night-blue-seamless-r721',path:EQUALIZER_FILES_R721.night}
  };
  const spec=specs[period]||specs.day;
  state.equalizerPeriod=period;
  state.equalizerStyle=spec.name;
  return {period,...spec};
}

function trackLabel(item,fallback='—'){
  if(!item)return fallback;
  const title=shortText(item.title||'ANDRIK',48);
  const album=shortText(item.album||'',24);
  return album ? `${title} (${album})` : title;
}

// R790/R787 NOCROP: source geometry is immutable FIT+PAD. Raw YUV master is forbidden; raw Annex-B H264 is transport-only and never changes geometry.
function titleOverlayFiltersR721({dynamicTitle=false,showPreview=false,previewDuration=0,previewReload=false,boundaryTitleSwitchAt=0}={}){
  const font=chooseFont();
  const titleFont=chooseTitleFont();
  const fontPart=font?`fontfile='${ffFilterPath(font)}':`:'';
  const titleFontPart=titleFont?`fontfile='${ffFilterPath(titleFont)}':`:'';
  const curPath=ffFilterPath(LIVE_CURRENT_FILE);
  const boundaryPath=ffFilterPath(LIVE_BOUNDARY_TITLE_FILE_R790);
  const tickerPath=ffFilterPath(LIVE_TICKER_FILE);
  const prevPath=ffFilterPath(LIVE_PREVIOUS_FILE_R726);
  const nextPath=ffFilterPath(LIVE_NEXT_FILE_R726);
  const titleReload=dynamicTitle?`:reload=1`:'';
  const previewReloadPart=previewReload?`:reload=${VIDEO_FPS}`:'';
  const d=Math.max(0,Number(previewDuration)||0);
  const sw=Math.max(0,Number(boundaryTitleSwitchAt)||0);
  // R790: CURRENT -> NEXT title is selected by THIS feeder's FFmpeg PTS, not Date.now().
  // The exact same t clock also drives the black alpha mask below, so the title cannot
  // run seconds ahead of the fade even if the VPS, FIFO or YouTube transport is delayed.
  const currentTitleEnable=sw>0?`:enable='lt(t\,${sw.toFixed(3)})'`:'';
  const boundaryTitleEnable=sw>0?`:enable='gte(t\,${sw.toFixed(3)})'`:'';
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
    `drawtext=${titleFontPart}textfile='${path}'${titleReload}:fontcolor=white@0.01:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=8:bordercolor=black@0.92${enable}`,
    `drawtext=${titleFontPart}textfile='${path}'${titleReload}:fontcolor=0xF8F4EE:fontsize=58:x=(w-text_w)/2:y=h-188:borderw=4:bordercolor=0xD60024@1:shadowcolor=black@1:shadowx=4:shadowy=4${enable}`
  ];
  const filters=[
    FULL_FRAME_FILTER_R787,
    `fps=${VIDEO_FPS}`,
    'format=yuv420p',
    'drawbox=x=0:y=ih-204:w=iw:h=88:color=black@0.38:t=fill',
    'drawbox=x=92:y=ih-208:w=iw-184:h=4:color=0xE00026@0.96:t=fill',
    ...titlePair(curPath,currentTitleEnable)
  ];
  if(sw>0)filters.push(...titlePair(boundaryPath,boundaryTitleEnable));
  filters.push(
    `drawtext=${fontPart}textfile='${prevPath}'${previewReloadPart}:fontcolor=white@1:fontsize=32:x=58:y=h-305:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${previewEnable}`,
    `drawtext=${fontPart}textfile='${nextPath}'${previewReloadPart}:fontcolor=white@1:fontsize=32:x=w-text_w-58:y=h-305:borderw=3:bordercolor=black@1:box=1:boxcolor=black@0.64:boxborderw=13${previewEnable}`,
    `drawtext=${fontPart}textfile='${tickerPath}':reload=${VIDEO_FPS}:fontcolor=yellow:fontsize=28:x='w-mod(t*110,text_w+w)':y=h-58:borderw=3:bordercolor=black@1:shadowcolor=black@1:shadowx=2:shadowy=2`
  );
  return filters.join(',');
}


function compactCtaChainR783(trackDuration){
  const d=Math.max(0,Number(trackDuration)||0);
  const windows=[];
  // R783: first CTA stays at 20s. Every 120s after that alternate SUBSCRIBE -> LIKE.
  // Only complete 8s windows are scheduled, preserving the no-blink behavior from R748.
  for(let st=CTA_FIRST_SHOW_SECONDS_R748, n=0; st+CTA_SHOW_SECONDS_R722<=d-2.0; st+=CTA_PERIOD_SECONDS_R722, n++){
    windows.push({st,kind:(n%2===0?'subscribe':'like')});
    if(windows.length>=8)break;
  }
  if(!windows.length)return {pre:'',chain:'',final:'qrbase',windows:[]};
  let pre='';
  const addSource=(inputIndex,kind,prefix)=>{
    const subset=windows.map((w,i)=>({...w,i})).filter(w=>w.kind===kind);
    if(!subset.length)return;
    const labels=subset.map(w=>`[cta${w.i}]`).join('');
    pre+=`[${inputIndex}:v]scale=420:-1:flags=lanczos,fps=${VIDEO_FPS},setpts=PTS-STARTPTS,format=yuva420p[${prefix}src];`;
    if(subset.length===1)pre+=`[${prefix}src]null${labels};`;
    else pre+=`[${prefix}src]split=${subset.length}${labels};`;
  };
  addSource(3,'subscribe','ctasub');
  addSource(4,'like','ctalike');
  let chain='';
  let base='qrbase';
  windows.forEach((w,i)=>{
    const st=w.st;
    const fadeOutAt=st+CTA_SHOW_SECONDS_R722-CTA_FADE_SECONDS_R748;
    chain+=`[cta${i}]fade=t=in:st=${st.toFixed(3)}:d=${CTA_FADE_SECONDS_R748.toFixed(2)}:alpha=1,fade=t=out:st=${fadeOutAt.toFixed(3)}:d=${CTA_FADE_SECONDS_R748.toFixed(2)}:alpha=1[ctaf${i}];`;
    const out=`ctaout${i}`;
    chain+=`[${base}][ctaf${i}]overlay=x=W-w-${CTA_RIGHT_GAP_R767}:y=H-h-${CTA_BOTTOM_GAP_R748}:shortest=0:format=yuv420[${out}];`;
    base=out;
  });
  return {pre,chain,final:base,windows};
}

function normalVideoFilterComplexR721({fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,previewReload=false,boundaryTitleSwitchAt=0}={}){
  const vf=titleOverlayFiltersR721({dynamicTitle:false,showPreview:true,previewDuration:trackDuration,previewReload,boundaryTitleSwitchAt}); // R790: CURRENT/NEXT title choice is FFmpeg-PTS-bound to the same feeder as the black mask
  // R748: CTA is feeder-local, full-window only, with alpha fade in/out. This avoids
  // the old partial wall-clock window that looked like a blink at appearance/disappearance.
  const cta=compactCtaChainR783(trackDuration);
  // R738/R737: NEVER run fade filters on the real video. R738 only shifts the safe mask earlier. The R736 black-screen bug was
  // caused by fading the already-darkened base stream back "in". Instead generate a
  // separate opaque BLACK mask whose ALPHA alone rises/falls, then overlay that mask
  // over the untouched live picture. Even if the mask chain misbehaves, the base video
  // is never destructively changed and the next feeder always starts full-bright.
  let maskChain='';
  let finalChain='[ctabase]format=yuv420p[outv]'; // R748 replaces ctabase with compact CTA chain output or qrbase
  let startupMaskChain='';
  // R753: clip→MP3 gets one visible transition without touching the real visual stream:
  // start under an opaque black alpha mask and fade that mask away. This is cheap and
  // cannot leave the base video black if the transition process exits unexpectedly.
  if(fadeIn){
    startupMaskChain=`color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=out:st=0:d=${Math.max(0.05,Number(fadeInSeconds)||CLIP_TO_TRACK_FADE_IN_SECONDS_R753).toFixed(2)}:alpha=1[startmask];`;
  }
  if(Number(trackDuration)>VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736+VIDEO_FADE_IN_SECONDS_R736+VIDEO_FADE_LEAD_SECONDS_R735+1){
    // R747: restore the viewer-proven R743 MP3 boundary clock. The track feeder is
    // rebased exactly when MP3 audio starts, so its t=duration belongs to THIS song.
    // Fade a separate black ALPHA mask: darken 0.65s, tiny 0.05s hold, brighten 0.30s.
    const outAt=Math.max(0,Number(trackDuration)-VIDEO_FADE_SECONDS_R726-VIDEO_BLACK_HOLD_SECONDS_R736-VIDEO_FADE_LEAD_SECONDS_R735);
    const recoverAt=outAt+VIDEO_FADE_SECONDS_R726+VIDEO_BLACK_HOLD_SECONDS_R736;
    // R757: when the next real item is a video clip/insert, finish the MP3 by fading
    // fully to black and HOLD black through the boundary. MP3→MP3 keeps the exact
    // viewer-approved R753 fade-out/recover timing unchanged.
    maskChain=endFadeToBlack
      ? `color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1[blackmask];`
      : `color=c=black@1.0:s=1920x1080:r=${VIDEO_FPS},format=yuva420p,fade=t=in:st=${outAt.toFixed(3)}:d=${VIDEO_FADE_SECONDS_R726.toFixed(2)}:alpha=1,fade=t=out:st=${recoverAt.toFixed(3)}:d=${VIDEO_FADE_IN_SECONDS_R736.toFixed(2)}:alpha=1[blackmask];`;
    finalChain='[ctabase][blackmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]';
  }
  const ctaBaseLabel=cta.final;
  if(ctaBaseLabel!=='qrbase'){
    finalChain=finalChain.replaceAll('[ctabase]',`[${ctaBaseLabel}]`);
  }else{
    finalChain=finalChain.replaceAll('[ctabase]','[qrbase]');
  }
  if(fadeIn){
    // Route the normal final picture through one alpha-only startup mask.
    finalChain=finalChain.replace('[outv]','[prefadeout]');
    // R769: filtergraph chains MUST be separated. Without this semicolon FFmpeg parsed
    // [prefadeout][startmask] as a continuation of the previous overlay and exited INVALID ARGUMENT.
    finalChain+=`;[prefadeout][startmask]overlay=x=0:y=0:shortest=1:format=yuv420,format=yuv420p[outv]`;
  }
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[2:v]fps=${VIDEO_FPS},setpts=N/(${VIDEO_FPS}*TB),format=yuva420p[eqv];[base][eqv]overlay=x=(W-w)/2:y=H-h-64:shortest=0:format=yuv420,format=yuv420p[eqbase];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[eqbase][qr]overlay=x=W-w-24:y=24:shortest=0:format=yuv420,format=yuv420p[qrbase];${cta.pre}${cta.chain}${maskChain}${startupMaskChain}${finalChain}`;
}

function clipFilterComplexR721(){
  const vf=titleOverlayFiltersR721({dynamicTitle:true,showPreview:false});
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-24:y=24:shortest=1:format=yuv420,format=yuv420p[outv]`;
}

function bumperFilterComplexR724(){
  const vf=[
    FULL_FRAME_FILTER_R787,`fps=${VIDEO_FPS}`
  ].join(',');
  return `[0:v]setpts=PTS-STARTPTS,${vf}[base];[1:v]scale=160:160:flags=lanczos,format=yuva420p[qr];[base][qr]overlay=x=W-w-24:y=24:shortest=1:format=yuv420,format=yuv420p[outv]`;
}

function h264EncoderArgsR721(){
  // B-frames are deliberately disabled. The persistent relay assigns one exact 1/25s
  // timestamp per H264 packet, so DTS=PTS remains valid across every feeder switch.
  return [
    '-c:v','libx264','-preset','ultrafast','-tune','zerolatency',
    '-profile:v','high','-level:v','4.1',
    '-b:v',VIDEO_BITRATE,'-minrate',VIDEO_BITRATE,'-maxrate',VIDEO_BITRATE,'-bufsize','12000k',
    '-x264-params',`nal-hrd=cbr:force-cfr=1:repeat-headers=1:aud=1:keyint=${VIDEO_GOP}:min-keyint=${VIDEO_GOP}:scenecut=0`,
    '-g',String(VIDEO_GOP),'-keyint_min',String(VIDEO_GOP),'-sc_threshold','0','-bf','0','-refs','1','-coder','1',
    '-r',String(VIDEO_FPS),'-pix_fmt','yuv420p'
  ];
}

function scheduleOutputFatalRestartR780(rawLine,thisPublisher){
  if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return false;
  const line=cleanText(rawLine);
  if(!line || !OUTPUT_FATAL_REGEX_R780.test(line))return false;
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
    // A FIFO child can otherwise retry forever while Node still sees growing pipe bytes.
    // Exit the service so systemd rebuilds exactly one clean publisher.
    process.exit(78);
  },900);
  outputFatalTimerR780.unref?.();
  return true;
}

function scheduleTransportSelfHealR746(rawLine,thisPublisher){
  if(stopping || publisher!==thisPublisher || thisPublisher?.exitCode!==null)return false;
  const line=cleanText(rawLine);
  if(!line || !TRANSPORT_FATAL_REGEX_R746.test(line))return false;
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
  console.error('[r751-stream-health]',state.lastError,'— systemd rebuilds the ONE RTMPS publisher');
  process.exit(76);
}

function startPublisher(){
  if(!STREAM_URL){
    state.lastError='YOUTUBE_STREAM_KEY is not configured';
    return false;
  }
  if(publisher && publisher.exitCode===null)return true;
  prepareCacheDir();
  if(!existsSync(LIVE_TICKER_FILE)) writeFileSync(LIVE_TICKER_FILE,DEFAULT_LIVE_TICKER,'utf8');
  if(!existsSync(LIVE_CURRENT_FILE)) writeFileSync(LIVE_CURRENT_FILE,'ANDRIK','utf8');

  // R790: no feeder timestamp epoch exists. The persistent raw-H264 demuxer owns one
  // uninterrupted 25fps clock for the whole service lifetime.
  state.videoTimestampOffsetSecondsR787=0;

  // R721 transport: video feeders encode the final 1920x1080 frame to Annex-B H264.
  // This ONE master never closes at MP3<->clip or MORNING/DAY/EVENING/NIGHT boundaries.
  // R790: use the viewer-proven R777 persistent raw-H264 master clock. Feeders contain
  // no transport timestamps at all; the one persistent H264 demuxer assigns 25fps GENPTS
  // continuously across every MP3/clip/station boundary. This removes R787 wall-clock
  // feeder wall-clock timestamp jumps and MPEG-TS discontinuity rebasing without a second encode.
  const args=[
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size',String(VIDEO_INPUT_QUEUE_PACKETS_R732),'-fflags','+genpts+discardcorrupt','-framerate',String(VIDEO_FPS),'-f','h264','-i','pipe:4',
    '-thread_queue_size',String(AUDIO_INPUT_QUEUE_PACKETS_R732),'-f','s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-i','pipe:3',
    '-map','0:v:0','-map','1:a:0',
    // R761: EVERY feeder already produces the final viewer-approved 1920x1080 H264 frame
    // (R760/R753 FIT+PAD, overlays, fades, AUD + repeated SPS/PPS). Do NOT decode+encode it
    // a second time in the persistent master. R760's double x264 path consumed ~40% CPU in
    // the master on top of ~55% in the feeder and could stop reading BOTH Node pipes for
    // 30 s, triggering R751 NO-PROGRESS/status=76 and YouTube BAD/NODATA. The persistent
    // master now copies H264 and encodes AAC. R790 deliberately uses NO video bitstream
    // filter: the persistent raw-H264 demuxer owns one continuous 25fps GENPTS clock.
    // Graceful feeder stop + AUD/repeat-headers keep every Annex-B boundary parseable by the one persistent demuxer.
    '-c:v','copy',
    // R780: old VPS FFmpeg preserves MPEG-TS codec_tag 27 into FIFO->FLV. FLV expects
    // tag 7 for AVC/H264 (and 10 for AAC). Without this reset the FIFO child rejects
    // its header forever while the parent process and Node input-byte counters remain alive.
    '-tag:v','7',
    '-c:a','aac','-profile:a','aac_low','-b:a',AUDIO_BITRATE,'-ar',String(AUDIO_SAMPLE_RATE),'-ac','2','-tag:a','10',
    '-max_muxing_queue_size','4096','-flush_packets','1',
    '-f','fifo','-fifo_format','flv','-queue_size',String(OUTPUT_FIFO_QUEUE_PACKETS_R750),
    '-timeshift',`${OUTPUT_TIMESHIFT_SECONDS}s`,
    '-drop_pkts_on_overflow','1',
    '-attempt_recovery','1','-recover_any_error','1','-recovery_wait_time','1','-restart_with_keyframe','1',
    STREAM_URL
  ];

  const thisPublisher=spawn('ffmpeg',args,{stdio:['ignore','ignore','pipe','pipe','pipe']});
  publisher=thisPublisher;
  state.publisherRunning=true;
  state.transportHealthy=true;
  state.transportSelfHealPending=false;
  if(!state.streamStartedAt)state.streamStartedAt=new Date().toISOString();
  const audioSink=thisPublisher.stdio[3];
  const videoSink=thisPublisher.stdio[4];
  for(const [label,sink] of [['audio',audioSink],['video',videoSink]]){
    sink.on('error',err=>{
      if(!stopping && !/EPIPE|ECONNRESET|ERR_STREAM_DESTROYED/i.test(String(err?.code||err?.message||err)))state.lastError=`${label}-pipe: ${String(err)}`;
    });
  }
  thisPublisher.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      // R790 raw-H264 GENPTS may emit one deprecated first-packet warning at master
      // startup on this FFmpeg generation. It is not a runtime discontinuity and is
      // deliberately excluded from health/error state. Any real DTS/discontinuity remains fatal telemetry.
      const rawH264FirstPacketNotice=/Timestamps are unset in a packet for stream 0/i.test(line);
      if(!rawH264FirstPacketNotice && /DTS .*out of order|timestamp discontinuity|non[- ]monoton/i.test(line)){
        state.masterTimestampErrorCount=Number(state.masterTimestampErrorCount||0)+1;
        state.lastMasterTimestampErrorAt=new Date().toISOString();
      }
      if(!rawH264FirstPacketNotice && /error|fail|invalid|broken pipe|non-monoton|unset in a packet|incompatible with output codec|DTS .*out of order|timestamp discontinuity/i.test(line))state.lastError=line.slice(-700);
      const hardOutputFatal=rawH264FirstPacketNotice?false:scheduleOutputFatalRestartR780(line,thisPublisher);
      if(!hardOutputFatal)scheduleTransportSelfHealR746(line,thisPublisher);
      console.error('[master]',line);
    }
  });
  thisPublisher.on('exit',(code,signal)=>{
    const isCurrent=publisher===thisPublisher;
    if(isCurrent){publisher=null;state.publisherRunning=false;state.transportHealthy=false;state.transportSelfHealPending=false;if(transportFatalTimerR746){clearTimeout(transportFatalTimerR746);transportFatalTimerR746=null;}if(outputFatalTimerR780){clearTimeout(outputFatalTimerR780);outputFatalTimerR780=null;}}
    if(isCurrent && !stopping){
      state.lastExit={layer:'persistent-master',code,signal,at:new Date().toISOString()};
      // An actual RTMPS/master failure is the only reason the service exits/restarts.
      setTimeout(()=>process.exit(code||22),900).unref();
    }
  });
  thisPublisher.on('error',err=>{if(publisher===thisPublisher)state.lastError=String(err);});
  return true;
}

async function visualLoopOffsetR735(visualPath){
  const now=Date.now();
  let st=null;
  try{st=statSync(visualPath);}catch(_){return 0;}
  let rec=visualContinuityR735.get(visualPath);
  const changed=!rec || rec.size!==st.size || rec.mtimeMs!==st.mtimeMs;
  if(changed){
    let duration=0;
    try{duration=await probeDuration(visualPath);}catch(_){duration=0;}
    rec={anchorMs:now,duration,size:st.size,mtimeMs:st.mtimeMs};
    visualContinuityR735.set(visualPath,rec);
    state.visualLoopOffsetSeconds=0;
    return 0;
  }
  if(!Number.isFinite(rec.duration)||rec.duration<=0)return 0;
  const offset=Math.max(0,((now-rec.anchorMs)/1000)%rec.duration);
  state.visualLoopOffsetSeconds=Number(offset.toFixed(3));
  return offset;
}

function normalVideoFeederArgsR721(visualPath,eqPath,{fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,visualOffsetSeconds=0,previewReload=false,boundaryTitleSwitchAt=0}={}){
  const visualSeek=Number(visualOffsetSeconds)>0.05 ? ['-ss',Number(visualOffsetSeconds).toFixed(3)] : [];
  return [
    '-hide_banner','-loglevel','warning',
    '-thread_queue_size','64','-re','-stream_loop','-1',...visualSeek,'-i',visualPath,
    '-loop','1','-framerate','1','-i',QR_OVERLAY,
    '-thread_queue_size','32','-re','-stream_loop','-1','-i',eqPath,
    '-loop','1','-framerate','1','-i',CTA_OVERLAY_R767,
    '-loop','1','-framerate','1','-i',CTA_LIKE_OVERLAY_R783,
    '-filter_complex',normalVideoFilterComplexR721({fadeIn,fadeInSeconds,endFadeToBlack,trackDuration,previewReload,boundaryTitleSwitchAt}),
    '-map','[outv]','-an','-sn','-dn',
    ...h264EncoderArgsR721(),
    ...rawH264VideoOutputArgsR790()
  ];
}

async function stopNormalVideoFeederR721(){
  const active=videoFeeder;
  if(!active)return;
  const videoSink=publisher?.stdio?.[4];
  // R754: do not cut the Annex-B stream in the middle of a NAL unit at MP3 boundaries.
  // Ask FFmpeg to stop cleanly while it is still connected, so it can flush the current
  // encoded access unit. Only detach the pipe after the child has had a short clean-exit
  // window. This prevents a malformed H264 splice from reaching the persistent master.
  if(active.exitCode===null){
    try{active.kill('SIGINT')}catch(_){ }
    await waitChildExit(active,900);
  }
  try{if(active.stdout&&videoSink)active.stdout.unpipe(videoSink)}catch(_){ }
  if(active.exitCode===null){
    try{active.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(active,900)) && active.exitCode===null){
      try{active.kill('SIGKILL')}catch(_){ }
      await waitChildExit(active,250);
    }
  }
  if(videoFeeder===active)videoFeeder=null;
  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;
}

function startNormalVideoFeederR721(visualPath,{fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=0,visualOffsetSeconds=0,previewReload=false,boundaryTitleSwitchAt=0}={}){
  if(stopping || clipActive)return false;
  const videoSink=publisher?.stdio?.[4];
  if(!publisher || publisher.exitCode!==null || !videoSink || videoSink.destroyed || videoSink.writableEnded)throw new Error('R721 persistent video pipe unavailable');
  const eq=equalizerSpecR721();
  if(!existsSync(visualPath) || statSync(visualPath).size<300000)throw new Error(`visual missing: ${visualPath}`);
  if(!existsSync(QR_OVERLAY) || statSync(QR_OVERLAY).size<20000)throw new Error(`QR overlay missing: ${QR_OVERLAY}`);
  if(!existsSync(CTA_OVERLAY_R767) || statSync(CTA_OVERLAY_R767).size<2500)throw new Error(`R767 CTA overlay missing: ${CTA_OVERLAY_R767}`);
  if(!existsSync(CTA_LIKE_OVERLAY_R783) || statSync(CTA_LIKE_OVERLAY_R783).size<2500)throw new Error(`R783 LIKE CTA overlay missing: ${CTA_LIKE_OVERLAY_R783}`);
  if(!existsSync(eq.path) || statSync(eq.path).size<20000)throw new Error(`equalizer missing: ${eq.path}`);

  const child=spawn('ffmpeg',normalVideoFeederArgsR721(visualPath,eq.path,{fadeIn,fadeInSeconds,endFadeToBlack,trackDuration,visualOffsetSeconds,previewReload,boundaryTitleSwitchAt}),{stdio:['ignore','pipe','pipe']});
  videoFeeder=child;
  videoFeederPath=visualPath;
  videoFeederPeriod=eq.period;
  child.stdout.pipe(videoSink,{end:false});
  child.stdout.on('error',()=>{});
  child.stderr.on('data',d=>{
    const line=String(d||'').trim();
    if(line){
      state.lastFfmpegLine=line.slice(-1000);
      if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);
      console.error('[video-feed]',line);
    }
  });
  child.on('exit',(code,signal)=>{
    const isCurrent=videoFeeder===child;
    try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
    if(isCurrent)videoFeeder=null;
    if(isCurrent && !stopping && !clipActive && !visualSwitching){
      state.lastError=`R721 visual feeder exit ${code??signal}; restarting without RTMPS reconnect`;
      setTimeout(()=>ensureNormalVideoFeederR721({force:true}).catch(err=>{state.lastError=`R721 visual feeder restart: ${cleanText(err?.message||err)}`;}),120).unref();
    }
  });
  child.on('error',err=>{if(videoFeeder===child)state.lastError=`R721 visual feeder: ${String(err)}`;});
  return true;
}

async function ensureNormalVideoFeederR721({force=false,fadeIn=false,fadeInSeconds=CLIP_TO_TRACK_FADE_IN_SECONDS_R753,endFadeToBlack=false,trackDuration=null,previewReload=false,boundaryTitleSwitchAt=null}={}){
  if(stopping || clipActive)return true;
  const visual=await ensureScheduledVisual();
  const period=activeVisualPeriodR721();
  if(!force && videoFeeder && videoFeeder.exitCode===null && videoFeederPath===visual && videoFeederPeriod===period)return true;
  visualSwitching=true;
  try{
    await stopNormalVideoFeederR721();
    if(stopping || clipActive)return true;
    const plannedDuration=trackDuration===null ? remainingTrackSecondsR726() : Math.max(0,Number(trackDuration)||0);
    // R735: song boundaries still restart only the overlay/timing feeder, but the selected
    // MORNING/DAY/EVENING/NIGHT MP4 resumes at its wall-clock loop position instead of 0:00.
    // This preserves FFmpeg-frame-timed NEXT/PREVIOUS without visually restarting the background.
    const visualOffsetSeconds=await visualLoopOffsetR735(visual);
    const plannedBoundaryTitleSwitchAt=boundaryTitleSwitchAt===null
      ? ((state.next?.type==='track' && plannedDuration>TITLE_SWITCH_BEFORE_BOUNDARY_R781+0.25)
          ? Math.max(0,plannedDuration-TITLE_SWITCH_BEFORE_BOUNDARY_R781) : 0)
      : Math.max(0,Number(boundaryTitleSwitchAt)||0);
    return startNormalVideoFeederR721(visual,{fadeIn,fadeInSeconds,endFadeToBlack,trackDuration:plannedDuration,visualOffsetSeconds,previewReload,boundaryTitleSwitchAt:plannedBoundaryTitleSwitchAt});
  }finally{
    visualSwitching=false;
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
  args.push(
    '-filter_complex',isStationInsert?bumperFilterComplexR724():clipFilterComplexR721(),
    '-map','[outv]','-an','-sn','-dn',
    ...h264EncoderArgsR721(),
    ...rawH264VideoOutputArgsR790(),
    '-map',hasAudio?'0:a:0':'2:a:0','-vn','-sn','-dn',
    '-af',`aresample=${AUDIO_SAMPLE_RATE}:async=1:first_pts=0,asetpts=PTS-STARTPTS`,'-c:a','pcm_s16le','-ar',String(AUDIO_SAMPLE_RATE),'-ac','2'
  );
  if(duration>0)args.push('-t',String(Math.max(0.5,duration)));
  args.push('-f','s16le','pipe:3');
  return args;
}

async function stopClipFeederR721(child,videoSink,audioSink){
  if(!child)return;
  try{if(child.stdout&&videoSink)child.stdout.unpipe(videoSink)}catch(_){ }
  try{if(child.stdio?.[3]&&audioSink)child.stdio[3].unpipe(audioSink)}catch(_){ }
  if(child.exitCode===null){
    try{child.kill('SIGTERM')}catch(_){ }
    if(!(await waitChildExit(child,350)) && child.exitCode===null){
      try{child.kill('SIGKILL')}catch(_){ }
      await waitChildExit(child,150);
    }
  }
}

async function ensureVideoSourceAfterClipR745(next=null){
  if(stopping)return true;
  const preparedAlive=Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null);
  const normalAlive=Boolean(videoFeeder&&videoFeeder.exitCode===null);
  if(preparedAlive||normalAlive)return true;
  // A failed/late preroll used to leave the persistent master with no H264 input.
  // The master process stayed alive but YouTube eventually reported NODATA. Force a
  // normal visual immediately so the ONE RTMPS publisher never starves at clip EOF.
  clipActive=false;
  await stopPreparedVideoPrerollR744().catch(()=>{});
  await ensureNormalVideoFeederR721({force:true,fadeIn:false});
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
    await ensureNormalVideoFeederR721({force:true,fadeIn:false});
    state.videoHandoffMode='R749-INSERT-ABORT-FORCED-NORMAL';
  }catch(error){
    state.lastError+=` | normal visual: ${cleanText(error?.message||error)}`;
  }
  insertRecoveryCountR749++;
  state.lastInsertRecoveryAt=new Date().toISOString();
  state.lastInsertRecoveryReason=text;
  return false;
}

async function videoSourceWatchdogTickR749(){
  if(stopping||videoSourceRecoveryBusyR749)return;
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
    state.lastInsertRecoveryReason=`no live H264 feeder for ${now-videoSourceMissingSinceR749}ms`;
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

function detachNormalVideoAtBoundaryR752(){
  const active=videoFeeder;
  if(!active)return;
  const videoSink=publisher?.stdio?.[4];
  try{if(active.stdout&&videoSink)active.stdout.unpipe(videoSink)}catch(_){ }
  if(videoFeeder===active)videoFeeder=null;
  videoFeederTrackIdentityR744='';
  videoFeederPrerolledR744=false;
  if(active.exitCode===null){
    try{active.kill('SIGTERM')}catch(_){ }
    const killer=setTimeout(()=>{if(active.exitCode===null){try{active.kill('SIGKILL')}catch(_){ }}},700);
    killer.unref?.();
  }
}

async function playVideoClipR691(previous,item,next){
  const itemId=primaryIdentity(item);
  if(suppressedVideoIdentityR744 && suppressedVideoIdentityR744===itemId){
    suppressedVideoIdentityR744='';
    state.suppressedVideoInsert='';
    state.lastError='';
    console.error('[r752-video-skip] skipped unprepared insert after safe fallback:',shortText(item?.title||'VIDEO',40));
    return false;
  }

  let readyPath='';
  try{
    readyPath=preparedClipReadyNowR742(item);
    if(!readyPath){
      prefetchPreparedClipR742(item);
      return await abortInsertHandoffR749(item,next,`prepared cache not ready: ${shortText(item?.title||'VIDEO',40)}`);
    }
  }catch(error){
    return await abortInsertHandoffR749(item,next,`clip cache: ${cleanText(error?.message||error)}`);
  }

  const warmedMetaR752=clipBoundaryMetaR752.get(itemId);
  const duration=(warmedMetaR752&&warmedMetaR752.readyPath===readyPath)?Number(warmedMetaR752.duration||0):await probeDuration(readyPath).catch(()=>0);
  const hasAudio=(warmedMetaR752&&warmedMetaR752.readyPath===readyPath)?Boolean(warmedMetaR752.hasAudio):await probeHasAudioR721(readyPath);
  const stationInsert=item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special');
  if(!hasAudio){
    state.lastError=`R752 video insert skipped: audio stream missing in ${shortText(item.title||'INSERT',40)}`;
    console.error('[r752-insert-audio]',state.lastError);
    return await abortInsertHandoffR749(item,next,'prepared insert has no decodable audio stream');
  }

  const audioSink=publisher?.stdio?.[3];
  const videoSink=publisher?.stdio?.[4];
  if(!publisher||publisher.exitCode!==null||!audioSink||audioSink.destroyed||audioSink.writableEnded||!videoSink||videoSink.destroyed||videoSink.writableEnded){
    state.lastError='R752 persistent A/V pipe unavailable before video insert';
    return await abortInsertHandoffR749(item,next,'persistent A/V pipe unavailable');
  }

  // R752 atomic boundary handoff:
  // 1) start ONE local FFmpeg for BOTH prepared H264 and PCM, disconnected from LIVE;
  // 2) wait until BOTH outputs have data buffered;
  // 3) only then detach the old song visual and connect BOTH outputs in the same tick.
  // Therefore clip pixels can never appear while the old song is still audible.
  let child=null;
  let clipExitPromise=null;
  try{
    // R757: arm TRUE PREVIOUS/NEXT before the clip FFmpeg is spawned. The prepared
    // clip title is already baked, while these two boundary labels are deliberately
    // live-context only and are shown at clip T=2..7s and again during its final 10s.
    clearNextPreviewR726({invalidate:true});
    writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,previousOverlayTextR745(previous));
    writeOverlayFileR726(LIVE_NEXT_FILE_R726,nextOverlayTextR736(next));

    // R767: playVideoClipR691() is entered only after the previous MP3 decoder has ended.
    // Do NOT keep its feeder writing into the persistent master while the clip child arms:
    // with no audio during that short window the H264 input queue could accumulate old
    // black/MP3 frames, so new clip audio reached YouTube before new clip pictures.
    // R763 already faded the previous visual to black, so detach it here and let the tiny
    // matched 8/8 master queues drain BEFORE we connect the clip's unified A/V outputs.
    detachNormalVideoAtBoundaryR752();
    state.videoHandoffMode='R767-BLACK-PRE-DRAIN-BEFORE-CLIP-ARM';
    child=spawn('ffmpeg',clipPreparedFeederArgsR742(readyPath,{hasAudio:true,duration,showPreview:!stationInsert}),{stdio:['ignore','pipe','pipe','pipe','pipe']});
    child.__r752UnifiedAV=true;
    child.__r752Live=false;
    const videoSource=child.stdout;
    const audioSource=child.stdio[3];
    const progressSource=child.stdio[4];
    clipPublisher=child;
    producer=child;
    state.producerRunning=true;
    state.clipPlaybackMode='R767-ONE-FFMPEG-BOTH-READY+EXACT-FRAME-SAMPLE-CLOCK+TAIL-LOCK';
    videoSource.on('error',()=>{});
    audioSource.on('error',()=>{});
    progressSource?.on('data',d=>{const line=String(d||'').trim();if(line)state.clipProgressLine=line.slice(-500);});
    progressSource?.on('error',()=>{});
    child.stderr.on('data',d=>{
      const line=String(d||'').trim();
      if(line){state.lastFfmpegLine=line.slice(-1000);if(/error|fail|invalid|broken pipe|non-monoton/i.test(line))state.lastError=line.slice(-700);console.error('[r752-clip-av]',line);}
    });

    clipExitPromise=new Promise((resolve,reject)=>{
      child.once('error',reject);
      child.once('exit',(code,signal)=>{
        try{videoSource.unpipe(videoSink)}catch(_){ }
        try{audioSource.unpipe(audioSink)}catch(_){ }
        if(code===0||stopping)resolve(); else reject(new Error(`R752 clip A/V exit ${code||signal}`));
      });
    });
    clipExitPromise.catch(()=>{});

    try{
      await promiseTimeout(
        Promise.all([
          streamReadableReadyR752(videoSource,'video',child),
          streamReadableReadyR752(audioSource,'audio',child)
        ]),
        INSERT_AUDIO_START_TIMEOUT_MS_R749,
        `R752 insert A/V ready ${shortText(item.title||'VIDEO',40)}`
      );
    }catch(error){
      insertAudioStartFailuresR749++;
      throw new Error(`insert A/V did not become ready together: ${cleanText(error?.message||error)}`);
    }

    // REAL media boundary. Up to here the CURRENT song visual was still connected,
    // including its R751 late black fade. Nothing from this clip touched the live pipe.
    clipActive=true;
    child.__r752Live=true;
    // R767: previous feeder was already detached before arm; do not create a second splice.

    const boundaryStartedAt=Date.now();
    state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
    state.current={type:String(item.sourceType||'').startsWith('radio-special')?'special':(item.sourceType==='radio-bumper'?'bumper':'clip'),title:item.title,album:item.album,url:item.url,startedAt:new Date(boundaryStartedAt).toISOString(),duration};
    state.next=next?{type:next.type||'track',title:next.title,album:next.album||'',url:next.url||''}:null;
    setLiveTitleR724(stationInsert?'ANDRIK METAL RADIO':`КЛИП • ANDRIK — ${shortText(item.title||'VIDEO',34)}`,{delayMs:0});

    // Connect both already-ready streams back-to-back in the same event-loop turn.
    // The single source FFmpeg gives both outputs one common t=0 clock.
    videoSource.pipe(videoSink,{end:false});
    audioSource.pipe(audioSink,{end:false});
    state.videoHandoffMode='R752-BOUNDARY-LOCKED-UNIFIED-AV-LIVE';

    // No next-picture LIVE preroll. Warm only file metadata/cache for a following video.
    if(next && next.type!=='track'){
      prefetchPreparedClipR742(next);
      const generation=++videoHandoffGenerationR744;
      const delayMs=Math.max(0,Math.round((Math.max(0,Number(duration)||0)-INSERT_CACHE_WARM_LEAD_SECONDS_R752)*1000));
      setTimeout(()=>{
        if(stopping||generation!==videoHandoffGenerationR744)return;
        if(primaryIdentity(state.current)!==itemId)return;
        warmClipBoundaryMetaR752(next).catch(error=>{state.lastWarning=`R752 next cache warm: ${cleanText(error?.message||error)}`;});
      },delayMs).unref?.();
    }

    const guardMs=Math.max(12000,Math.round(Math.max(1,Number(duration)||1)*1000)+CLIP_END_GUARD_MARGIN_MS_R745);
    try{
      await promiseTimeout(clipExitPromise,guardMs,`R752 clip EOF ${shortText(item.title||'VIDEO',40)}`);
    }catch(error){
      state.lastError=`R752 clip EOF guard: ${cleanText(error?.message||error)}`;
      if(child&&child.exitCode===null){
        try{child.kill('SIGTERM')}catch(_){ }
        if(!(await waitChildExit(child,1200))&&child.exitCode===null){try{child.kill('SIGKILL')}catch(_){ }await waitChildExit(child,250);}
      }
      return false;
    }
    if(item.sourceType==='r2-video')lastClipIdentityR726=itemId;
    state.lastError='';
    return !stopping;
  }catch(error){
    state.lastError=`R752 VIDEO/AUDIO boundary handoff: ${cleanText(error?.message||error)}`;
    console.error('[r752-video-clip]',error);
    if(child&&child.exitCode===null){try{child.kill('SIGTERM')}catch(_){ }}
    await abortInsertHandoffR749(item,next,cleanText(error?.message||error));
    return false;
  }finally{
    if(child){
      try{child.stdout?.unpipe(videoSink)}catch(_){ }
      try{child.stdio?.[3]?.unpipe(audioSink)}catch(_){ }
      if(child.exitCode===null){try{child.kill('SIGTERM')}catch(_){ }}
    }
    if(clipPublisher===child)clipPublisher=null;
    if(producer===child)producer=null;
    state.producerRunning=false;
    clipActive=false;
    await stopPreparedVideoPrerollR744().catch(()=>{});
    if(!stopping){
      if(next?.type==='track' && child?.__r752Live===true){
        // R753: DO NOT start a generic normal feeder here and then restart it again
        // inside playItem(). That double handoff was the clip→MP3 stall seen in R752.
        // Give the next MP3 one exclusive boundary window to start its correctly-timed
        // feeder (PREVIOUS/NEXT + outro fade) exactly once.
        clipToTrackBoundaryPendingR753={identity:primaryIdentity(next),startedAt:Date.now()};
        state.videoHandoffMode='R753-CLIP-END-WAITING-FOR-SINGLE-MP3-FEEDER';
      }else if(!(videoFeeder&&videoFeeder.exitCode===null)){
        // Failed/skipped inserts already invoke the safe fallback; only recover here if
        // no normal source is actually alive.
        try{await ensureVideoSourceAfterClipR745(next);}catch(error){state.lastError=`R753 resume visual: ${cleanText(error?.message||error)}`;}
      }
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
function decoderArgs(localAudioPath,duration,loudness=null){
  const outStart=Math.max(0,Number(duration||0)-TRACK_AUDIO_FADE_OUT_R726);
  const loudnorm=loudness
    ? `loudnorm=I=${TRACK_AUDIO_TARGET_I_R726}:LRA=${TRACK_AUDIO_LRA_R726}:TP=${TRACK_AUDIO_TRUE_PEAK_R726}:measured_I=${Number(loudness.input_i).toFixed(2)}:measured_LRA=${Number(loudness.input_lra).toFixed(2)}:measured_TP=${Number(loudness.input_tp).toFixed(2)}:measured_thresh=${Number(loudness.input_thresh).toFixed(2)}:offset=${Number(loudness.target_offset).toFixed(2)}:linear=true:print_format=summary`
    : `loudnorm=I=${TRACK_AUDIO_TARGET_I_R726}:LRA=${TRACK_AUDIO_LRA_R726}:TP=${TRACK_AUDIO_TRUE_PEAK_R726}:print_format=summary`;
  const af=[
    loudnorm,
    `afade=t=in:st=0:d=${TRACK_AUDIO_FADE_IN_R726}`,
    `afade=t=out:st=${outStart.toFixed(3)}:d=${TRACK_AUDIO_FADE_OUT_R726}`,
    `aresample=${AUDIO_SAMPLE_RATE}`
  ].join(',');
  return [
    '-hide_banner','-loglevel','warning',
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
  const title=shortText(item.title||'ANDRIK',32);
  // R753: never expose internal scheduler names such as SPECIAL 30/60 or radio-bumper.
  // To the viewer every station insert is simply the ANDRIK radio ident.
  if(isAnySpecialInsertR727(item)||item.sourceType==='radio-bumper'||item.type==='bumper')return 'NEXT • ANDRIK METAL RADIO 24/7';
  if(item.type==='clip')return `NEXT • КЛИП • ${title}`;
  return `NEXT • ANDRIK — ${title}`;
}
function previousOverlayTextR745(item){
  if(!item)return '';
  const title=shortText(item.title||'ANDRIK',32);
  if(isAnySpecialInsertR727(item)||item.sourceType==='radio-bumper'||item.type==='bumper')return 'PREVIOUS • ANDRIK METAL RADIO 24/7';
  if(item.type==='clip')return `PREVIOUS • КЛИП • ${title}`;
  return `PREVIOUS • ANDRIK — ${title}`;
}
function currentOverlayTextR738(item){
  if(!item)return 'ANDRIK';
  if(item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special'))return 'ANDRIK METAL RADIO';
  if(item.type==='clip')return `КЛИП • ANDRIK — ${shortText(item.title||'VIDEO',34)}`;
  return `ANDRIK — ${shortText(item.title||'TRACK',42)}`;
}
function isVideoHandoffR738(item){
  return Boolean(item && (item.type==='clip'||item.sourceType==='radio-bumper'||String(item.sourceType||'').startsWith('radio-special')));
}

async function playItem(previous,item,next,following,localAudioPath,nextTrackPreview=null){
  const duration=await probeDuration(localAudioPath||item.url);
  const actualNextR736=predictedImmediateNextR736(next,duration);
  state.previous=previous?{type:previous.type||'track',title:previous.title,album:previous.album||'',url:previous.url||''}:null;
  state.next=actualNextR736?{type:actualNextR736.sourceType?.startsWith('radio-special')?'special':(actualNextR736.sourceType==='radio-bumper'?'bumper':(actualNextR736.type||'track')),title:actualNextR736.title,album:actualNextR736.album||'',url:actualNextR736.url||''}:null;

  // R732: write the exact three labels BEFORE spawning this song's feeder.
  // The bounded raw-audio input queue prevents the radio loop from getting tens of seconds
  // ahead of what the listener actually hears. PREVIOUS/NEXT remain FFmpeg-frame-timed; R736 NEXT is the actual immediate item.
  // R731: write the exact three labels BEFORE spawning this song's feeder. Normal
  // feeders load them once and FFmpeg itself reveals PREVIOUS/NEXT only at T-8s.
  // No Node wall-clock timer can get ahead of the audio anymore.
  clearNextPreviewR726({invalidate:true});
  // R745: PREVIOUS must mean the item that ACTUALLY played immediately before this one.
  // The old R733 track-only fallback could show an older song after a clip and therefore lie.
  const previousForOverlayR745=previous||previousTrackFallbackR733(previous);
  writeOverlayFileR726(LIVE_CURRENT_FILE,`ANDRIK — ${shortText(item.title||'TRACK',42)}`);
  writeOverlayFileR726(LIVE_PREVIOUS_FILE_R726,previousOverlayTextR745(previousForOverlayR745));
  // R736: NEXT means literally the item that will play immediately after this MP3.
  // It may be an MP3, normal clip, 30/60-minute special, or the 4–6-song station bumper.
  writeOverlayFileR726(LIVE_NEXT_FILE_R726,nextOverlayTextR736(actualNextR736));
  // R790: preload the exact next CURRENT title into a separate immutable textfile.
  // FFmpeg itself selects this file by feeder PTS during the black phase; Node never
  // changes LIVE_CURRENT_FILE early anymore.
  const boundaryTitleSwitchAtR790=(actualNextR736?.type==='track' && duration>TITLE_SWITCH_BEFORE_BOUNDARY_R781+0.25)
    ? Math.max(0,duration-TITLE_SWITCH_BEFORE_BOUNDARY_R781) : 0;
  writeOverlayFileR726(LIVE_BOUNDARY_TITLE_FILE_R790,boundaryTitleSwitchAtR790>0?`ANDRIK — ${shortText(actualNextR736.title||'TRACK',42)}`:'');
  state.titleBoundarySwitchTarget=boundaryTitleSwitchAtR790>0?shortText(actualNextR736.title||'TRACK',52):'';
  state.titleBoundarySwitchScheduledAt=boundaryTitleSwitchAtR790>0?`PTS=${boundaryTitleSwitchAtR790.toFixed(3)}s`:null;
  state.titleBoundarySwitchFiredAt=null;

  // R750: NEVER wait for loudness analysis on the live path. Use cached two-pass
  // measurements when available; otherwise start immediately with the safe single-pass
  // loudnorm filter and analyze this file later at low priority for its next play.
  const loudnessR747=readLoudnessAnalysisR747(localAudioPath);
  state.currentLoudnessMode=loudnessR747?'R747-TWO-PASS-MEASURED-LINEAR':'R750-SINGLE-PASS-INSTANT-FALLBACK';
  state.currentMeasuredInputLufs=loudnessR747?Number(loudnessR747.input_i):null;
  if(!loudnessR747){const t=setTimeout(()=>scheduleLoudnessAnalysisR750(localAudioPath),5000);t.unref?.();}

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
  // R763: keep the proven R753 alpha-mask architecture but extend the cinematic timing.
  // The old MP3 feeder owns the transition: start 1.0 s earlier than R762, 0.65 s darken,
  // 0.05 s black hold, then a clearly visible 0.80 s recovery. Do NOT add a second fade-in on the next MP3.
  // Only MP3→real-video keeps R757's black hold through the boundary.
  const endFadeToBlackR760=Boolean(actualNextR736 && isVideoHandoffR738(actualNextR736));
  if(!currentVideoPrerolledR744){
    await ensureNormalVideoFeederR721({force:true,fadeIn:clipToTrackBoundaryR753,endFadeToBlack:endFadeToBlackR760,trackDuration:duration,previewReload:false,boundaryTitleSwitchAt:boundaryTitleSwitchAtR790});
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
  state.current={type:item.type||'track',title:item.title,album:item.album||'',url:item.url,startedAt:new Date(mediaStartedAt).toISOString(),duration};
  const currentIdentity=primaryIdentity(state.current);
  setLiveTitleR724(`ANDRIK — ${shortText(item.title||'TRACK',42)}`,{delayMs:0});
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
  producer=spawn('ffmpeg',decoderArgs(localAudioPath,duration,loudnessR747),{stdio:['ignore','pipe','pipe']});
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
      // R769: commit the promised normal NEXT only when THIS track has actually begun
      // producing PCM. On the same first PCM chunk, clear a checkpoint that belongs to
      // this item (recovered after a restart), then checkpoint the newly promised NEXT.
      let firstPcmCommittedR769=false;
      source.once('data',()=>{
        if(firstPcmCommittedR769)return;
        firstPcmCommittedR769=true;
        clearCommittedNextR769(item);
        if(actualNextR736?.type==='track')writeCommittedNextR769(actualNextR736);
      });
      source.pipe(audioSink,{end:false});
      producer.once('error',reject);
      producer.once('exit',(code,signal)=>{
        try{source.unpipe(audioSink);}catch(_){}
        state.producerRunning=false;
        producer=null;
        if(code===0 || stopping) resolve();
        else reject(new Error(`decoder exit ${code||signal}`));
      });
    });
    playedOkR726=true;
  }finally{
    clearNextPreviewR726({invalidate:true});
  }
  if(playedOkR726){rememberTrackR726(item);previousTrackForPreviewR726=item;}
}

async function radioLoop(){
  if(running)return;
  running=true;

  prepareCacheDir();
  prefetchAllVisuals();
  await ensureScheduledVisual();
  if(!startPublisher())return;
  await ensureNormalVideoFeederR721({force:true});
  scheduleTimerR721=setInterval(()=>{scheduleVisualTickR721().catch(error=>{state.lastError=`R721 schedule: ${cleanText(error?.message||error)}`;});},30000);
  scheduleTimerR721.unref?.();
  videoSourceWatchdogTimerR749=setInterval(()=>{videoSourceWatchdogTickR749().catch(error=>{state.lastError=`R749 watchdog tick: ${cleanText(error?.message||error)}`;});},VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749);
  videoSourceWatchdogTimerR749.unref?.();
  masterBackpressureWatchdogTimerR750=setInterval(masterBackpressureWatchdogTickR750,MASTER_BACKPRESSURE_WATCHDOG_INTERVAL_MS_R750);
  masterBackpressureWatchdogTimerR750.unref?.();

  while(!stopping){
    try{
      const refreshAt=Date.parse(state.lastLibraryRefresh||0);
      if(!library.length || !refreshAt || Date.now()-refreshAt>LIBRARY_REFRESH_MS){
        const refreshed=await loadLibrary();
        if(refreshed.changed && queue.length)reconcileQueueWithLibrary();
      }

      if(!queue.length || queueIndex>=queue.length){
        queue=buildQueue();
        queueIndex=0;
      }

      const item=queue[queueIndex];
      const next=queue[queueIndex+1]||queue[0]||null;
      const following=queue[queueIndex+2]||queue[1]||queue[0]||null;
      const nextTrackPreview=queue.slice(queueIndex+1).find(x=>x?.type==='track')||queue.find(x=>x?.type==='track')||null;
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
        const clipPlayed=await playVideoClipR691(lastPlayed,item,next);
        if(clipPlayed){
          // R764: only media that actually reached LIVE may become PREVIOUS.
          lastPlayed=item;
          queueIndex++;
          state.lastError='';
        }else{
          // R764: never lie about a skipped clip. Remove this failed occurrence, keep
          // lastPlayed on the real previous MP3, prepare it again and retry later.
          const failed=queue.splice(queueIndex,1)[0]||item;
          state.queueLength=queue.length;
          state.normalClipDeferredCount=Number(state.normalClipDeferredCount||0)+1;
          state.lastNormalClipDeferred={at:new Date().toISOString(),title:shortText(failed?.title||'VIDEO',52),reason:shortText(state.lastError||'clip did not commit',180)};
          if(next?.type==='track'){
            // The old MP3 may already have faded toward the promised clip. Make the real
            // next MP3 visibly recover from black instead of hard-cutting.
            clipToTrackBoundaryPendingR753={identity:primaryIdentity(next),startedAt:Date.now(),reason:'R764-FAILED-CLIP-FALLBACK-FADE-IN'};
          }
          prefetchPreparedClipR742(failed);
          state.lastWarning=`R764 clip deferred safely; not marked played: ${shortText(failed?.title||'VIDEO',40)}`;
          console.error('[r764-clip-deferred]',state.lastWarning);
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

      let specialPlayedR726=false;
      let specialHourlyPlayedR727=false;
      const nowSpecialR727=Date.now();
      if(!stopping && specialHourlyInsertR727 && nowSpecialR727-lastSpecialHourlyPlayedAtR727>=SPECIAL_HOURLY_INTERVAL_MS_R727){
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
      if(!specialHourlyPlayedR727 && !stopping && specialInsertR726 && Date.now()-lastSpecialPlayedAtR726>=SPECIAL_INTERVAL_MS_R726){
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

      if(!specialHourlyPlayedR727 && !specialPlayedR726 && !stopping && bumperLibrary.length && songsSinceBumperR724>=bumperAfterSongsR724){
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

function publicStatus(){
  const now=Date.now();
  return {
    ok:Boolean(state.publisherRunning && state.transportHealthy!==false && ((clipPublisher&&clipPublisher.exitCode===null&&clipPublisher.__r752UnifiedAV===true&&clipPublisher.__r752Live===true)||(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null)||(videoFeeder&&videoFeeder.exitCode===null))),
    service:state.service,
    version:state.version,
    mode:state.mode,
    overlayMode:state.overlayMode,
    audioMode:state.audioMode,
    engine:'R790 CONTINUOUS RAW-H264 CLOCK + IRONCLAD AV + PTS TITLE + R787 NOCROP/R784 AUDIO/R783 CTA/R780 EGRESS',
    feederFilterChainGuard:'R769-SEMICOLON-ENDMASK-TO-STARTMASK',
    committedNextCheckpointFile:COMMITTED_NEXT_FILE_R769,
    committedNextTitle:state.committedNextTitle||'',
    committedNextRecovered:Boolean(state.committedNextRecovered),
    committedNextCommittedAt:state.committedNextCommittedAt||null,
    videoPipeline:'R790 IMMUTABLE R787 FIT+PAD -> SINGLE-X264 -> RAW H264 -> ONE PERSISTENT 25FPS GENPTS MASTER -> H264 COPY',
    outputTimeshiftSeconds:OUTPUT_TIMESHIFT_SECONDS,
    videoBitrate:VIDEO_BITRATE,
    audioBitrate:AUDIO_BITRATE,
    audioSampleRate:AUDIO_SAMPLE_RATE,
    videoFps:VIDEO_FPS,
    videoGop:VIDEO_GOP,
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
    videoInputQueueMaxWindowSecondsR756:Number((VIDEO_INPUT_QUEUE_PACKETS_R732/VIDEO_FPS).toFixed(2)),
    audioInputQueuePackets:AUDIO_INPUT_QUEUE_PACKETS_R732,
    masterAvClockMode:'R777-RAW-H264-GENPTS-25FPS+AUDIO-SAMPLE-CLOCK',
    rightSubscribeMode:'R767-TRANSPARENT-420PX-BOTTOM-RIGHT',
    rightCtaMode:'R783-SUBSCRIBE-LIKE-420PX-BOTTOM-RIGHT-SMOOTH-ALTERNATING',
    clipSubscribeOverlay:'R783-PREBAKED-ALTERNATING-SUBSCRIBE-LIKE-RIGHT-CTA',
    stationInsertSync:'R784-ALL5-BEST-AUDIO-STREAM+OFFLINE-PCM-LEAD-TRIM+PREPARED-RMS-VERIFY',
    stationLeadingSilenceTrimSeconds:Number(state.stationLeadingSilenceTrimSeconds||0),
    stationLeadingSilenceTrimByKey:state.stationLeadingSilenceTrimByKey||{},
    overlayPixelPath:'YUV420-NO-ARGB-R732',
    trackUiClock:'ffmpeg-frame-bound-R732-audio-lead-bounded',
    nextPreviewSeconds:NEXT_PREVIEW_SECONDS_R726,
    nextPreviewTiming:'R748-INTRO-2S-5S-PLUS-FINAL-10S-FRAME-BOUND',
    mp3BoundaryMode:'R753-R752-EXACT-MP3-CLOCK-SINGLE-CLIP-RETURN-HANDOFF',
    clipAvTailLockMode:'R766-PER-OUTPUT-T+VIDEO-TPAD-TRIM+AUDIO-APAD-ATRIM',
    clipAvSyncFix:'R790-R767-ONE-FFMPEG-BOTH-READY-SAME-TICK+VIDEO-FRAMECOUNT+AUDIO-SAMPLECOUNT+Q8-Q8',
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
      videoFadeStrategy:'R763-R753-BLACK-ALPHA-0.65S-HOLD-0.05S-LEAD-1.40S-LIGHT-0.80S',
      videoFadeInEnabled:true,
      videoBaseNeverFaded:true,
      videoOverlayMask:'BLACK_ALPHA_ONLY_R738',
      videoFadeInSeconds:VIDEO_FADE_IN_SECONDS_R736,
      videoBlackHoldSeconds:VIDEO_BLACK_HOLD_SECONDS_R736,
      videoFadeLeadSeconds:VIDEO_FADE_LEAD_SECONDS_R735,
      titleVisualLeadSeconds:0,
      videoTimelineCompensationSeconds:0,
      videoTimelineCompensationMode:'R753-R752-EXACT-BOUNDARY-NO-LIVE-VIDEO-PREROLL',
      clipAvSyncMode:'R790-R752-CACHE-WARM+ONE-FFMPEG+BOTH-OUTPUTS-READY+SAME-TICK-ATOMIC-BOUNDARY',
      clipPreDrainMs:0,
      clipPostDrainMs:0,
      stationInsertAudioRequired:true,
      nextPreviewSource:'ACTUAL_IMMEDIATE_ITEM_R738',
      clipPlaybackMode:state.clipPlaybackMode||'R742-PREPARED-H264-COPY',
      clipPreparationMode:state.clipPreparationMode||'R787-R760-SERIAL-NICE12-FRESH-NOCROP-GEOMETRY-CACHE',
      preparedClipReady:state.preparedClipReady||0,
      preparedClipPending:state.preparedClipPending||0,
      preparedClipLast:state.preparedClipLast||'',
      clipLiveVideoCodec:'copy-h264-unified-boundary-child',
      clipPreparedVideoCodec:'libx264-ultrafast-6000k-no-bframes-r760-fit-pad',
      videoPipelineLeadSeconds:0,
      clipCacheWarmLeadSeconds:INSERT_CACHE_WARM_LEAD_SECONDS_R752,
      clipCacheWarmEntries:clipBoundaryMetaR752.size,
      clipToTrackHandoffPending:Boolean(clipToTrackBoundaryPendingR753),
      clipToTrackHandoffAgeMs:clipToTrackBoundaryPendingR753?Date.now()-Number(clipToTrackBoundaryPendingR753.startedAt||0):null,
      clipToTrackHandoffGuardMs:CLIP_TO_TRACK_HANDOFF_GUARD_MS_R753,
      clipToTrackFadeInSeconds:CLIP_TO_TRACK_FADE_IN_SECONDS_R753,
      mp3BoundaryFadeMode:state.mp3BoundaryFadeMode,
      mp3BoundaryFadeInSeconds:VIDEO_FADE_IN_SECONDS_R736,
      stationNextLabel:'NEXT • ANDRIK METAL RADIO 24/7',
      normalClipAdmissionMode:state.normalClipAdmissionMode,
      normalClipDeferredCount:state.normalClipDeferredCount,
      lastNormalClipDeferred:state.lastNormalClipDeferred,
      bumperCadenceMode:state.bumperCadenceMode,
      bumperMinSongs:BUMPER_MIN_SONGS_R724,
      bumperMaxSongs:BUMPER_MAX_SONGS_R724,
      videoHandoffMode:state.videoHandoffMode||'R752-CACHE-ONLY-NO-LIVE-PREROLL',
      clipUnifiedAvRunning:Boolean(clipPublisher&&clipPublisher.exitCode===null&&clipPublisher.__r752UnifiedAV===true&&clipPublisher.__r752Live===true),
      clipVideoPrerollRunning:Boolean(clipVideoPrerollR744&&clipVideoPrerollR744.exitCode===null),
      clipVideoPrerollIdentity:clipVideoPrerollIdentityR744||'',
      clipVideoPrerollArmed:Boolean(clipVideoPrerollArmedR749&&clipVideoPrerollArmedR749.invalid!==true),
      clipVideoPrerollCompletedOk:Boolean(clipVideoPrerollArmedR749?.completedOk),
      clipVideoPrerollArmIdentity:clipVideoPrerollArmedR749?.identity||'',
      clipVideoPrerollArmAgeMs:clipVideoPrerollArmedR749?Math.max(0,Date.now()-Number(clipVideoPrerollArmedR749.startedAt||Date.now())):null,
      videoSourceWatchdogMode:'R749-NO-H264-WRITER-FORCED-NORMAL',
      videoSourceWatchdogIntervalMs:VIDEO_SOURCE_WATCHDOG_INTERVAL_MS_R749,
      videoSourceStuckMs:VIDEO_SOURCE_STUCK_MS_R749,
      insertPrerollArmGraceMs:INSERT_PREROLL_ARM_GRACE_MS_R749,
      insertAudioStartTimeoutMs:INSERT_AUDIO_START_TIMEOUT_MS_R749,
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
    visualPeriod:state.visualPeriod,
    visualPath:state.visualPath,
    visualInsetCrop:state.visualInsetCrop||'',
    equalizerPeriod:state.equalizerPeriod,
    equalizerStyle:state.equalizerStyle,
    equalizerEngine:state.equalizerEngine,
    publisherRunning:state.publisherRunning,
    masterVideoMode:'R790-R787-GEOMETRY-RAW-H264-CONTINUOUS-GENPTS-25FPS-H264-COPY-FLV-TAG7',
    masterBitstreamFilter:'none-R790-raw-h264-genpts-no-video-bsf',
    masterAudioBytesWritten:Number(publisher?.stdio?.[3]?.bytesWritten||0),
    masterVideoBytesWritten:Number(publisher?.stdio?.[4]?.bytesWritten||0),
    masterVideoReencode:false,
    masterTimestampMode:'R790-PERSISTENT-RAW-H264-GENPTS-25FPS-NO-FEEDER-TIMESTAMPS-NO-SECOND-ENCODE',
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
    permanentFullscreenMode:'R787-R783-VIEWER-PROVEN-FIT-PAD-1920x1080-SAR1',
    permanentFullscreenWidth:1920,
    permanentFullscreenHeight:1080,
    permanentFullscreenFitPolicy:'R787-FIT-DECREASE-PAD-NO-CROP-IMMUTABLE',
    feederBoundaryMode:'R787-MONOTONIC-MPEGTS-OFFSET+INITIAL-DISCONTINUITY+AUD',
    transportRecoveryMode:'R754-FFMPEG-FIFO-FIRST-NO-EARLY-SYSTEMD-EXIT',
    transportHealthy:state.transportHealthy!==false,
    transportWatchdogMode:'R787-MONOTONIC-TS+R754-FIFO-FIRST+R751-NO-PROGRESS-30S',
    outputFifoQueuePackets:OUTPUT_FIFO_QUEUE_PACKETS_R750,
    outputDropPacketsOnOverflow:true,
    masterBackpressureWatchdogMs:MASTER_BACKPRESSURE_STUCK_MS_R750,
    masterBackpressureDetection:'R787-LOW-CPU-COPY-MASTER+R751-BLOCKED-PLUS-ZERO-BYTE-PROGRESS',
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
    videoFeederRunning:Boolean(videoFeeder&&videoFeeder.exitCode===null),
    clipActive,
    clipBoundaryReconnect:false,
    clipEndGuardMode:'R753-SINGLE-RETURN-HANDOFF+R752-UNIFIED-AV-DURATION-GUARD',
    clipEndGuardMarginMs:CLIP_END_GUARD_MARGIN_MS_R745,
    lastClipGuardRecovery:state.lastClipGuardRecovery||null,
    libraryTracks:state.libraryTracks,
    libraryAlbumTracks:state.libraryAlbumTracks,
    librarySingleTracks:state.librarySingleTracks,
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
    startedAt:state.startedAt,
    streamStartedAt:state.streamStartedAt,
    uptimeSeconds:Math.max(0,Math.round((now-Date.parse(state.startedAt))/1000)),
    lastLibraryRefresh:state.lastLibraryRefresh,
    lastExit:state.lastExit,
    lastError:state.lastError,
    lastFfmpegLine:state.lastFfmpegLine,
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
      else if(url.pathname==='/control/visual-auto')result=await applyVisualModeR721({auto:true});
      else if(url.pathname==='/control/full-fit')result=await ensureNormalVideoFeederR721({force:true}).then(()=>({ok:true,noCrop:true,restartedPublisher:false}));
      else if(url.pathname==='/control/timeline-offset')result=await setTimelineCompensationR739(url.searchParams.get('seconds'));
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
  console.log(`ANDRIK Radio R787 PERMANENT NOCROP + MONOTONIC TS + R784 STATION AUDIO listening on :${PORT}`);
  radioLoop();
});

let shutdownStarted=false;
function waitChildExit(child,timeoutMs){
  return new Promise(resolve=>{
    if(!child || child.exitCode!==null)return resolve(true);
    let done=false;
    const finish=value=>{if(done)return;done=true;clearTimeout(timer);resolve(value);};
    const timer=setTimeout(()=>finish(false),timeoutMs);
    child.once('exit',()=>finish(true));
  });
}

async function shutdown(){
  if(shutdownStarted)return;
  shutdownStarted=true;
  stopping=true;if(transportFatalTimerR746){clearTimeout(transportFatalTimerR746);transportFatalTimerR746=null;}if(outputFatalTimerR780){clearTimeout(outputFatalTimerR780);outputFatalTimerR780=null;}
  if(liveTitleTimerR724){clearTimeout(liveTitleTimerR724);liveTitleTimerR724=null;}
  if(scheduleTimerR721)clearInterval(scheduleTimerR721);
  if(videoSourceWatchdogTimerR749){clearInterval(videoSourceWatchdogTimerR749);videoSourceWatchdogTimerR749=null;}
  if(masterBackpressureWatchdogTimerR750){clearInterval(masterBackpressureWatchdogTimerR750);masterBackpressureWatchdogTimerR750=null;}
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
  process.exit(0);
}

process.once('SIGTERM',()=>{shutdown().catch(()=>process.exit(0));});
process.once('SIGINT',()=>{shutdown().catch(()=>process.exit(0));});
