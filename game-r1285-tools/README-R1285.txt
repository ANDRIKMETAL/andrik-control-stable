ANDRIK GAME R1285 — RUINS OF EPOCHS — RIGHT THEN LEFT HAND PUNCH

This update requires EXACT R1284 build. It changes ONLY dreaming-of-lira.html and installs two new game JS modules. The 24/7 radio, VPS streaming service, control panel, other levels, and saved level IDs are not touched.

INSTALL ON A COPY OF THE SITE FIRST. Root is the directory containing dreaming-of-lira.html.

1) Extract PATCH-R1285 into a temporary folder.
2) Check: python3 game-r1285-tools/install-game.py --root /path/to/site --check
3) Install: python3 game-r1285-tools/install-game.py --root /path/to/site
4) Clear browser cache, restart the game, check RUINS OF EPOCHS.
5) Roll back: python3 game-r1285-tools/install-game.py --root /path/to/site --rollback

Right arm lifts above shoulder (elbow bent), strikes down and forwards. Then the left arm repeats. Hitboxes activate only during actual strikes. Three melee opponent types and the final boss are updated; flying shooter logic is unchanged. Two-hit combo has a visible gap for dodging.

Verification: JS syntax, Three.js rig movement, Node state simulation, archive consistency, installation and rollback in temporary copy. Chromium/mobile interactive playthrough not completed: please test on Android before production.
