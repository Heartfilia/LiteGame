// Each ROM runs in an isolated child with a timeout: bad ROMs cannot stall the audit.
const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const root = path.join(__dirname, '..', 'games/nes');
if (process.argv[2] === '--rom') {
  const { NES, Controller } = require(path.join(root, 'vendor/jsnes.min.js'));
  let colored = false;
  try {
    const nes = new NES({ emulateSound: false, onFrame(buffer) {
      if (!colored) for (let i = 1; i < buffer.length; i += 17) if (buffer[i] !== buffer[0]) { colored = true; break; }
    } });
    const bytes = fs.readFileSync(process.argv[3]);
    if (bytes.length < 16 || bytes.subarray(0,4).toString('hex') !== '4e45531a') throw Error('无效的 iNES 文件头');
    if (bytes.length < 16 + ((bytes[6] & 4) ? 512 : 0) + bytes[4] * 16384 + bytes[5] * 8192) throw Error('卡带文件不完整');
    nes.loadROM(bytes);
    for (let i = 0; i < 180; i++) {
      if (i === 90) nes.buttonDown(1, Controller.BUTTON_START);
      if (i === 100) nes.buttonUp(1, Controller.BUTTON_START);
      nes.frame();
    }
    process.send({ status: colored ? 'boot' : 'blank', detail: colored ? '已通过 180 帧启动与 START 输入检查；支持手机手柄和即时存档。未验证完整通关。' : '启动检查未观察到有效画面，请尝试其他版本。' });
  } catch (e) { process.send({ status: 'unsupported', detail: String(e.message || e).slice(0,240) }); }
  process.exit();
} else {
  const file = path.join(root, 'catalog.json'), manifest = JSON.parse(fs.readFileSync(file));
  const unique = [...new Map(manifest.games.map(g => [g.sha256, g])).values()];
  const results = new Map(); let next = 0;
  async function worker() {
    while (next < unique.length) {
      const game = unique[next++];
      const result = await new Promise(resolve => {
        const child = fork(__filename, ['--rom', path.join(root, game.rom)], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        let result = { status: 'timeout', detail: '启动检查超时或进程退出，请尝试其他版本。' };
        const timer = setTimeout(() => child.kill('SIGKILL'), 20000);
        child.on('message', data => { result = data; });
        child.on('exit', () => { clearTimeout(timer); resolve(result); });
      });
      results.set(game.sha256, result);
      if (results.size % 50 === 0) console.log('Audited', results.size, '/', unique.length);
    }
  }
  Promise.all(Array.from({length: 4}, worker)).then(() => {
    for (const game of manifest.games) Object.assign(game, results.get(game.sha256));
    fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
    const counts = {}; manifest.games.forEach(g => counts[g.status] = (counts[g.status] || 0) + 1);
    console.log('ROM startup audit:', counts);
  }).catch(e => { console.error(e); process.exitCode = 1; });
}
