const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
function load(id) {
  if (['ridge-rally','neon-traffic','beat-echo','chord-lab'].includes(id)) return require('../games/lib/five-engines.js')(id);
  if (['starfarm','runetraveler','caravan','wardens','island','magictower'].includes(id)) return require('../games/lib/chronicles-engines.js')(id);
  const html = fs.readFileSync(path.join(root, 'games', id, 'index.html'), 'utf8');
  const source = html.split('/* ==== ENGINE START ==== */')[1].split('/* ==== ENGINE END ==== */')[0].replace(/<\/?script[^>]*>/g, '');
  const sandbox = { module: { exports: {} }, console };
  vm.runInNewContext(source, sandbox, { filename: id, timeout: 10000 });
  let cue;
  if (id === 'eightball' || id === 'snooker') {
    const core = { module: { exports: {} } };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'games/lib/cue.js'), 'utf8'), core);
    cue = core.module.exports;
  }
  return sandbox.module.exports(cue);
}
function rng(seed) { return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; }
module.exports = { load, rng, root };
