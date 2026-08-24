R624 — AWS RADIO CONTROL + ONE-BUTTON LIVE

- New terminal control center: sudo andrik-radio
- Menu item 1 launches YouTube LIVE without opening YouTube Studio.
- If no upcoming/live broadcast exists, Device OAuth API creates a fresh public broadcast and binds it to the exact stream key configured in /etc/andrik-radio.env.
- Starts/restarts encoder, waits for YouTube streamStatus=active, then transitions broadcast to LIVE.
- Recover button repairs signal/broadcast state.
- Status, 1080p master checks, logs, OAuth and Auto-start controls in one menu.
- R623 exact current-LIVE website radio button retained.
- R622 1080p25 / AAC 192k / local AWS master cache retained.
- YouTube refresh token remains only on AWS (0600).
