// Idempotently wire the shared storage guard before all game scripts, including iframe documents.
// Run after importing or regenerating HTML. Vendored source snapshots are not runtime entrypoints.
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['upstream', 'src', 'vendor', 'node_modules'].includes(entry.name)) continue;
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (entry.name.endsWith('.html')) {
      const text = fs.readFileSync(file, 'utf8');
      if (!text.includes('assets/js/server-sync.js') && /<head(?:\s[^>]*)?>/i.test(text)) {
        const src = path.relative(path.dirname(file), path.join(root, 'assets/js/server-sync.js')).split(path.sep).join('/');
        fs.writeFileSync(file, text.replace(/(<head(?:\s[^>]*)?>)/i, '$1<script src="' + src + '"></script>'));
      }
    }
  }
}
visit(path.join(root, 'games'));
