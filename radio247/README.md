# ANDRIK Radio snapshot

This website bundle carries a **snapshot only** of the current radio core for disaster-reference purposes. It is not installed by Cloudflare Pages and must never be copied to the VPS blindly.

- radio247/server.mjs: R1136 branch snapshot (R1125 transport isolation + R1132 CPU-low baseline preserved)
- radio247/vm-lite/: only currently relevant operational helpers; legacy patch installers were removed in R1138 cleanup

Use the dedicated installers in `vm-lite/` and always keep `/root/ANDRIK-SAFE` backups.
