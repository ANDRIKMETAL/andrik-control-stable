ANDRIK R1139 LOUDNESS FUNCTION FIX

Fixes:
1. Long scanner is Type=simple, so systemd reports ACTIVE/RUNNING while it works.
2. Start uses --no-block and no longer collides with the web-agent 30s action timeout.
3. Historical lastError no longer blocks a currently healthy RTMPS 2/2 transport.
4. ffmpeg stderr is written to a temporary file instead of an unread PIPE, preventing long-track deadlock.
5. Web-agent R1184 shows currentTrack only during the current active scan and distinguishes PAUSED vs resumed health.
6. Radio service is not restarted by the installer.

Install:
sudo bash INSTALL-R1139-LOUDNESS-FUNCTION-FIX.sh
