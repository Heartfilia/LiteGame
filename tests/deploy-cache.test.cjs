const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const nginx = fs.readFileSync(path.join(root, 'deploy/nginx.conf'), 'utf8');
const deploy = fs.readFileSync(path.join(root, 'deploy/deploy.sh'), 'utf8');

function location(pattern) {
  const match = nginx.match(pattern);
  assert.ok(match, `missing Nginx location: ${pattern}`);
  return match[0];
}

test('Nginx revalidates replaceable resources without immutable caching', () => {
  const html = location(/location ~\* \\.html\$ \{[\s\S]*?\n    \}/);
  const scripts = location(/location ~\* \\.\(css\|js\|nes\|json\)\$ \{[\s\S]*?\n    \}/);
  const media = location(/location ~\* \\.\(jpg\|jpeg\|png\|gif\|svg\|webp\|ico\|woff2\?\)\$ \{[\s\S]*?\n    \}/);

  assert.match(html, /Cache-Control "no-store, no-cache, must-revalidate" always/);
  assert.match(html, /Pragma "no-cache" always/);
  assert.match(scripts, /Cache-Control "no-cache, must-revalidate" always/);
  assert.match(media, /Cache-Control "no-cache, must-revalidate" always/);
  assert.doesNotMatch(nginx, /immutable/);
  assert.doesNotMatch(nginx, /expires\s+(?:1d|30d)/);
});

test('deployment checks Nginx before and after publishing', () => {
  const firstCheck = deploy.indexOf('nginx -t');
  const sync = deploy.indexOf('rsync -a');
  const reload = deploy.indexOf('systemctl reload nginx');
  const finalCheck = deploy.lastIndexOf('nginx -t');

  assert.ok(firstCheck >= 0, 'deployment must check the existing configuration first');
  assert.ok(sync > firstCheck, 'configuration check must precede file synchronization');
  assert.ok(finalCheck > sync, 'deployment must check the configuration after synchronization');
  assert.ok(reload > finalCheck, 'Nginx must reload only after the final configuration check');
});
