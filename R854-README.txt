ANDRIK R854 — R837 RAWVIDEO STABLE ENGINE + R850 TITLE + MP3 FADE

Base: exact R837 GOLD full-site package.
Purpose: remove R814/R813 encoded-H264 MP3 handoff failure path that caused old feeder close stalls,
R749 no-live-H264 gaps and repeated R751 NO-PROGRESS events.

PRESERVED / VERIFIED:
- R837 persistent RAWVIDEO -> ONE permanent x264 master architecture.
- Video queue 24 / audio queue 8.
- Full-frame geometry from R837 GOLD.
- MP3->MP3 visual fade-out 3.10 s.
- Black hold 0.20 s.
- MP3->MP3 fade-in 1.50 s.
- R837 non-fatal R751 suppression.
- R850 behavior: CURRENT title file always reloads in every active feeder.

INTENTIONALLY NOT PORTED:
- R848 RTMPS 15-second title wait.
- R849 hard audio/video title gate.
- R853 forced H264 feeder retirement.
Those belong to the unstable encoded-H264 handoff branch and are not needed by R837 RAWVIDEO frame-aligned handoff.

This is a candidate build assembled from known working R837 code plus the minimal R850 title reload.
