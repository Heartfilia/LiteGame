# Entombed · LiteGame adaptation

- Original: Stuart Lee (beeglebug), 2019, https://github.com/beeglebug/js13k-19
- Imported commit: `de0311ef4116f6e539ef3ab8df6c34aa87d70c41`
- License: MIT, original copyright and full license retained in [LICENSE.txt](LICENSE.txt).
- Original README: [README.md](README.md); preferred-form sources: `js/*.js`; original atlas: `assets.png`.

## Modifications (2026-11-04)

`index.html`, `adapter.js`: responsive view, Chinese instructions, touch strafe/turn/drag/attack/interact controls, explicit pause, portable validated journal, retained ending. Restore regenerates the graph from its seed, restores tile changes and persistent entities with original class prototypes, then restores player and statistics. Projectiles and transient effects are omitted; explored minimap fog is redrawn. Opening doors resume their animation.

Original flow repairs:
- `init.js`: restarting actually assigns fresh achievements/statistics, clears the key and cooldown, reuses AudioContext, and defers image startup until the adapter is ready. Win/death remain until explicit restart/recovery.
- `Entity.js`: death and loot resolve synchronously; the delayed callback only resets the old object's visual flash, preventing drops leaking into a new map.
- `loop.js`, `map.js`: pause stops tweens and interaction; map changes clear stale tweens and interaction targets.
- `util.js`: simulation delta capped after tab suspension.
- `input.js`: gameplay-only input, scoped mouse buttons, time-scaled mobile turning.

New adaptation files are MIT-licensed. Shared `../lib/port-shell.js`, `../lib/campaign-save.js`, `../lib/port.css` are available under MIT or GPL-2.0-or-later. Run with any static HTTP server; no build/backend or external asset requests required.
