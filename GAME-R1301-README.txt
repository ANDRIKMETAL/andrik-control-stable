ANDRIK DREAMING OF LÍRA — R1301 · THREE 3D CHAPTERS · RU/EN
Based on SITE-R1300-GAME-3D-RU-EN-FULL.zip.

CHANGES IMPLEMENTED IN GAME:
- ONLY 3D launch remains, Russian and English language switch retained.
- Chapter difficulty: EASY (damage received x0.70, damage dealt x1.22), NORMAL (x1/x1), HARD (x1.35/x0.87). Difficulty is stored locally, can be changed in the pause/chapter panel.
- Combo scoring, increasing points per consecutive hit, combos break on being hit; crystal bonus at 5/10 hit combo; extra hit effects, score and checkpoint indicator.
- STREETS: wooden crates can be smashed with guitar: collision removed, crystals drop, score +120 per crate. Existing brawlers, chase and boss remain.
- PORTRAIT: three interactive portraits in corridor and one hidden gallery secret. Rewards, replenishment, two-enemy ambush, and visible glowing markers. Existing mirror puzzle remains.
- RUINS: double-type enemies also hop across broken boards; deflecting projectiles grants score and crystals. Existing double jump, fragile platforms, reflected projectiles and three-phase guardian remain.
- A mid-zone checkpoint captures enemies, puzzles and loot when the player crosses a safe corridor. On death, a saved checkpoint is restored and HP and energy are at least 65. Chapter-start checkpoints preserved.
- End-of-chapter result panel: rank C/B/A/S, score, kills, best combo, deaths, secrets, deflections and duration; best score per chapter/difficulty saved locally.
- Restart chapter now clears chapter stats, objects, secrets and checkpoint, without removing global campaign unlocks.
- All new UI strings are translated through i18n; RU/EN can be selected in each chapter and main menu.

NOT ALTERED: radio, YouTube/FB, worker, VPS, stream, other pages, original music and the base 3D rendering architecture.

DEPLOY:
1. Back up your current R1300 site first.
2. If R1300 is currently installed, upload ANDRIK-GAME-R1301-PATCH.zip to site root and overwrite only the matching index.html and dreaming-of-lira.html. It adds new assets while preserving old ones.
3. Alternatively replace site with SITE-R1301-GAME-3D-FULL.zip (complete site based on R1300).
4. Open https://andrikmetal.com/game-refresh-r1301.html then https://andrikmetal.com/dreaming-of-lira.html?v=r1301
5. Verify Streets 3D startup and difficulties on real Android/Chrome, then Portrait/Ruins. Do not remove old files until smoke tests pass.

ROLLBACK: Restore R1300 copies of index.html and dreaming-of-lira.html. New R1301 assets may remain harmlessly in place.

TESTS: Node --check on all new JS modules, logic tests for difficulty, hits/combo, crate destruction, painting ambush, reflection, checkpoint save & resume, restart, results. Browser/WebGL Android end-to-end was NOT tested in this environment (navigation blocked).
