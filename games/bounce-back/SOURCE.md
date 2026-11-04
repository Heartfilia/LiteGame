# Bounce Back · LiteGame adaptation

- Original: Frank Force, 2019, https://github.com/js13kGames/bounce-back
- Imported commit: `faa7bf4f578d9e2cc9fa32e7042c4ac3dd24820a`
- License: GPL-2.0-or-later; complete original license is in [LICENSE](LICENSE).
- Original preferred-form JavaScript sources are shipped directly: [game.js](game.js), [gameEngine.js](gameEngine.js), [gameEngineDebug.js](gameEngineDebug.js), plus [tiles.png](tiles.png). No minification or build is needed.
- Original README is retained in [README.md](README.md).

## Modifications (2026-11-04)

`index.html` and `adapter.js`: Chinese instructions, responsive canvas, directional touch controls, touch aim/throw, nearby-target throw button, dash, explicit pause/restart, level-entry checkpoints and retained ending. `game.js`: original per-frame storage writes replaced by in-memory metadata; level transition invokes checkpoint capture. `gameEngine.js`: canvas fits its container, toolbar clicks do not throw, explicit pause joins focus-loss pause.

The checkpoint stores level, starting equipment/health/coins and persistent metadata. Reload regenerates the current level at its entrance; it is **not** a snapshot of every enemy or pickup. This is stated in the game UI. Defeat allows returning to camp with earned coins. Victory remains in the journal.

Shared adaptation sources: [port-shell.js](../lib/port-shell.js), [campaign-save.js](../lib/campaign-save.js), [port.css](../lib/port.css), and the [cover](../../assets/images/covers/bounce-back.svg). These adaptation files are available under GPL-2.0-or-later when distributed with Bounce Back (shared files are also available under MIT for other games). All corresponding sources are in this static distribution; no build scripts or server are necessary. Open `index.html` through a static HTTP server.
