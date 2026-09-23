ANDRIK CONTROL R1155 · QUEUE NEXT

WEB/CLOUDFLARE:
- radio-control-admin.html: unified song/clip/station search
- radio-media-picker-r989.js: songs + clips + bumpers + specials
- radio-queue-r943.js: one atomic "Поставить следующей"
- _worker.js: queue-move direction=next transport support

VPS AGENT:
- andrik-radio-web-agent-r803.mjs -> Agent R1155
- accepts queue-move: next and keeps queue-pick-r989 bridge
- install-r1155-control-queue-agent-no-radio-restart.sh updates only the agent

RADIO CORE:
- radio247/server.mjs is an R1155 snapshot based on R1154.
- The website deployment NEVER auto-installs this snapshot on the VPS.
- Use the separate ANDRIK-R1155-QUEUE-CONTROL-VPS package to update the live radio safely.
