ANDRIK CONTROL R1138 · CURRENT VPS OPS

ACTIVE / CURRENT:
- andrik-radio-web-agent-r803.mjs -> Agent R1138 telemetry + controls
- install-r1138-control-ops-no-radio-restart.sh -> installs Agent/recovery helpers only; radio PID must not change
- andrik-radio-air-restore-r925 -> compatibility filename; R1138 GOLD-CURRENT radio-core restore
- andrik-radio-screen-restore-r926 -> compatibility filename; current visual feeder recovery, no radio restart
- R1137 SAFE LOUDNESS files -> sidecar-only -14 LUFS analysis
- andrik-radio-load-r988 / R1126 installer -> R1125-aware VPS CPU monitor
- safe cache/process/audio-sync helpers retained because the current agent references them

LEGACY PATCH INSTALLERS WERE REMOVED FROM THIS WEBSITE PACKAGE TO AVOID ACCIDENTAL DOWNGRADE.
The radio247/server.mjs file is a snapshot only and is never auto-installed by the website.
