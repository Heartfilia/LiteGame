// Two isolated browser stores against a real HTTP v1 fixture (including CORS and optimistic concurrency).
const { chromium, webkit } = require('playwright');
const http = require('node:http'), assert = require('node:assert/strict');
const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8766';
const accounts = new Map(), tokens = new Map();
let nextToken = 0, forcedError = 0, afterWrite = null, rejectedKey = null, dropAfterWrite = false;
function account(name) { if (!accounts.has(name)) accounts.set(name, { id: accounts.size + 1, revision: 0, records: new Map() }); return accounts.get(name); }
function write(a, kind, key, value) { const r = { kind, key, version: ++a.revision, deleted: value === null, value }; a.records.set(kind + ':' + key, r); return r; }
function meta(r) { if (r.kind !== 'nes') return r; const { value, ...out } = r; return out; }
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', new URL(base).origin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.method === 'OPTIONS') return send(200, {});
  const url = new URL(req.url, 'http://test'), path = url.pathname;
  let text = ''; for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : {};
  if (path === '/api/v1/info') return send(200, { service: 'litegame-sync', protocol_version: 1 });
  if (path === '/api/v1/auth/login') {
    const a = account(body.username), token = 'test-token-' + ++nextToken; tokens.set(token, a);
    return send(200, { access_token: token, expires_at: Date.now() / 1000 + 3600, user: { id: a.id, username: body.username } });
  }
  const a = tokens.get((req.headers.authorization || '').replace('Bearer ', ''));
  if (!a || forcedError === 401) return send(401, { error: { code: 'unauthorized' } });
  if (forcedError) { res.setHeader('Retry-After', '2'); return send(forcedError, { error: { message: 'fixture error' } }); }
  if (path === '/api/v1/auth/logout') { tokens.delete(req.headers.authorization.slice(7)); return send(200, { ok: true }); }
  if (path === '/api/v1/records') {
    const since = Number(url.searchParams.get('since'));
    if (since > a.revision) return send(409, { error: { code: 'cursor_invalid' } });
    const records = [...a.records.values()].filter(r => r.version > since).sort((a, b) => a.version - b.version);
    const page = records.slice(0, 2); // Exercise pagination, not just a single page.
    return send(200, { records: page.map(meta), has_more: records.length > page.length, next_cursor: page.at(-1)?.version || a.revision, revision: a.revision });
  }
  let kind, key, value, expected;
  if (path === '/api/v1/records/batch') { ({ key, value, expected_version: expected } = body.changes[0]); kind = 'local'; }
  else if (path.startsWith('/api/v1/nes/')) {
    kind = 'nes'; key = path.split('/').at(-1);
    if (req.method === 'GET') { const r = a.records.get('nes:' + key); return r ? send(200, { ...meta(r), snapshot: r.value }) : send(404, { error: { code: 'not_found' } }); }
    expected = req.method === 'DELETE' ? Number(url.searchParams.get('expected_version')) : body.expected_version;
    value = req.method === 'DELETE' ? null : body.snapshot;
  } else return send(404, {});
  const current = a.records.get(kind + ':' + key);
  if (key === rejectedKey) return send(413, { error: { message: 'fixture oversized record' } });
  if ((current?.version || 0) !== expected) return send(409, { error: { code: 'version_conflict', conflicts: [{ key, current: current ? meta(current) : null }] } });
  const r = write(a, kind, key, value);
  if (afterWrite) { const fn = afterWrite; afterWrite = null; await fn(a); }
  if (dropAfterWrite) { dropAfterWrite = false; return res.destroy(); }
  send(200, { records: [meta(r)], revision: a.revision });
});
const key = 'litegame.sync-test.progress'; // Allowed ordinary key, not reserved litegame.sync.*.
async function flush(page) {
  // A reload/foreground pull may already be running; join it, then reconcile the latest local writes.
  await page.evaluate(async () => { await LiteSync.sync(); await LiteSync.sync(); });
}
async function set(page, name, value) { await page.evaluate(([k, v]) => v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v), [name, value]); }
async function value(page, name = key) { return page.evaluate(k => localStorage.getItem(k), name); }
async function login(page, serverURL, username, importLocal = true) {
  await page.evaluate(args => LiteSync.connect(args), { server: serverURL, username, password: 'fixture-only', importLocal }); await flush(page);
}
async function snapshot(page, sha, value) {
  await page.evaluate(async ([sha, value]) => {
    await new Promise((resolve, reject) => {
      const r = indexedDB.open('litegame-nes', 1); r.onupgradeneeded = () => r.result.createObjectStore('states');
      r.onsuccess = () => { const tx = r.result.transaction('states', 'readwrite'); tx.objectStore('states').put(value, sha); tx.oncomplete = () => { r.result.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }); LiteSync.nesSaved(sha);
  }, [sha, value]);
}
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const serverURL = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      const browser = await engine.launch(), contexts = [];
      try {
        const ca = await browser.newContext(), cb = await browser.newContext(); contexts.push(ca, cb);
        const a = await ca.newPage(), b = await cb.newPage(), errors = [];
        for (const p of [a, b]) p.on('pageerror', e => errors.push(e.message));
        await a.goto(base); await b.goto(base);
        // UI connection and credential/backup isolation.
        await set(a, key, 'first');
        await a.locator('#dataBtn').click(); await a.locator('#serverBtn').click();
        await a.locator('#serverUrl').fill(serverURL); await a.locator('#serverUsername').fill(engineName); await a.locator('#serverPassword').fill('fixture-only');
        await a.locator('#serverConnect').click(); await a.waitForFunction(() => document.querySelector('#serverStatus').textContent.includes('已同步'));
        assert.equal(await a.locator('#serverPassword').inputValue(), '');
        assert.ok(await a.locator('#serverForm').isHidden());
        assert.ok(await a.locator('#serverBtn').isHidden());
        assert.ok((await a.locator('#dataBtn').getAttribute('class')).includes('server-linked'));
        await a.reload(); await a.locator('#dataBtn').click();
        await a.locator('#serverIdentity').waitFor();
        assert.ok((await a.locator('#serverIdentity').textContent()).includes(serverURL));
        assert.ok(await a.locator('#serverForm').isHidden());
        const cloud = account(engineName); assert.equal(cloud.records.get('local:' + key).value, 'first');
        const backup = a.waitForEvent('download'); await a.locator('#exportBtn').click();
        const stream = await (await backup).createReadStream(); let raw = ''; for await (const chunk of stream) raw += chunk;
        assert.ok(!raw.includes('test-token-') && !raw.includes('fixture-only') && !raw.includes('lgSync'));
        await login(b, serverURL, engineName); assert.equal(await value(b), 'first');
        // Idle A has no writes; B progresses. Foreground event pulls automatically.
        await set(b, key, 'second'); await flush(b);
        await a.evaluate(() => window.dispatchEvent(new Event('pageshow')));
        await a.waitForFunction(k => localStorage.getItem(k) === 'second', key);
        assert.equal(cloud.records.get('local:' + key).value, 'second');
        // Different keys merge; empty strings stay values. Write receipt revision must not skip another device.
        afterWrite = acc => write(acc, 'local', 'litegame.interleaved', 'other-browser');
        await set(a, 'litegame.empty', ''); await flush(a); await flush(a);
        assert.equal(await value(a, 'litegame.interleaved'), 'other-browser');
        await set(b, 'chogan.test.best', '88'); await flush(b); await flush(a);
        assert.equal(await value(a, 'chogan.test.best'), '88'); assert.equal(await value(b, 'litegame.empty'), '');
        // Local edits during an in-flight upload must not be acknowledged as the sent snapshot.
        afterWrite = async () => set(a, 'litegame.inflight', 'newer local');
        await set(a, 'litegame.inflight', 'sent snapshot'); await flush(a); await flush(a);
        assert.equal(cloud.records.get('local:litegame.inflight').value, 'newer local');
        // Oversized items pause independently, and can be retried after correction.
        rejectedKey = 'litegame.bad-item'; await set(a, rejectedKey, 'too large'); await set(a, 'litegame.good-item', 'allowed'); await flush(a);
        assert.equal((await a.evaluate(() => LiteSync.details())).blocked.length, 1);
        assert.equal(cloud.records.get('local:litegame.good-item').value, 'allowed');
        rejectedKey = null; await a.evaluate(() => LiteSync.retryBlocked()); await flush(a);
        assert.equal(cloud.records.get('local:litegame.bad-item').value, 'too large');
        // A request that committed but lost its response is reconciled, not blindly overwritten.
        dropAfterWrite = true; await set(a, 'litegame.ambiguous', 'committed'); await flush(a);
        await a.waitForFunction(() => document.querySelector('#serverStatus').textContent.includes('已同步'), null, { timeout: 15000 });
        assert.equal(cloud.records.get('local:litegame.ambiguous').value, 'committed');
        // Both edit a common baseline offline: keep both, defer, then choose cloud using UI.
        await set(a, key, 'A branch'); await set(b, key, 'B branch'); await flush(b); await flush(a);
        assert.equal((await a.evaluate(() => LiteSync.details())).conflicts.length, 1);
        assert.equal(await value(a), 'A branch'); assert.equal(cloud.records.get('local:' + key).value, 'B branch');
        await a.locator('#serverConflicts button', { hasText: '稍后处理' }).click(); await a.reload();
        assert.equal((await a.evaluate(() => LiteSync.details())).conflicts.length, 1);
        await a.evaluate(k => LiteSync.resolve('local', k, 'cloud'), key); await flush(a); assert.equal(await value(a), 'B branch');
        // Explicit deletion propagates; an empty local store never generates cloud tombstones.
        await set(b, key, null); await flush(b); await flush(a); assert.equal(await value(a), null);
        assert.equal(cloud.records.get('local:' + key).deleted, true);
        // Offline queue survives reload and resumes with a pull first.
        await cb.setOffline(true); await set(b, 'litegame.offline', 'queued'); await b.reload().catch(() => {});
        await cb.setOffline(false); await b.goto(base); await b.waitForFunction(() => !!window.LiteSync); await flush(b);
        // A failed offline attempt can be in backoff. Wait for its scheduled retry.
        await b.waitForFunction(() => document.querySelector('#serverStatus').textContent.includes('已同步'), null, { timeout: 15000 });
        assert.equal(cloud.records.get('local:litegame.offline').value, 'queued');
        // NES full snapshot uses independent endpoint and shared pagination cursor.
        const sha = 'a'.repeat(64), snap = { format: 1, emulator: 'jsnes-2.1.0', sha256: sha, title: 'fixture', savedAt: new Date().toISOString(), state: { cpu: { pc: 42 }, ppu: {}, mmap: {}, papu: {} } };
        await snapshot(b, sha, snap); await flush(b); await flush(a);
        const recovered = await a.evaluate(sha => new Promise(resolve => { const r = indexedDB.open('litegame-nes', 1); r.onsuccess = () => { const tx = r.result.transaction('states'); const get = tx.objectStore('states').get(sha); get.onsuccess = () => resolve(get.result); tx.oncomplete = () => r.result.close(); }; }), sha);
        assert.deepEqual(recovered, snap);
        // Independent game entrypoint + another tab: cloud restore fences stale in-memory writes.
        const game = await ca.newPage(); await game.goto(base + '/games/2048/');
        await set(b, 'litegame.remote-game', 'new progress'); await flush(b); await flush(a);
        await game.locator('#lg-sync-reload').waitFor();
        assert.equal(await game.evaluate(() => { try { localStorage.setItem('litegame.remote-game', 'stale'); return false; } catch (_) { return true; } }), true);
        assert.equal(await value(a, 'litegame.remote-game'), 'new progress'); await game.close();
        // Upload validation failures are isolated; Retry-After prevents an immediate hammering loop.
        forcedError = 429; await flush(b); forcedError = 0;
        assert.ok((await b.evaluate(() => LiteSync.details())).message.includes('同步暂缓'));
        await set(b, 'litegame.retry-after', 'later'); await flush(b);
        assert.ok(!cloud.records.has('local:litegame.retry-after'));
        await b.waitForFunction(() => document.querySelector('#serverStatus').textContent.includes('已同步'), null, { timeout: 15000 });
        assert.equal(cloud.records.get('local:litegame.retry-after').value, 'later');
        // Server restore rolls revision backwards: old version assumptions must not auto-upload.
        const savedRecords = cloud.records;
        cloud.records = new Map(); cloud.revision = 0; write(cloud, 'local', 'litegame.offline', 'restored-backup');
        await flush(b);
        await b.waitForFunction(() => document.querySelector('#serverStatus').textContent.includes('冲突'), null, { timeout: 15000 });
        assert.equal(cloud.records.get('local:litegame.offline').value, 'restored-backup');
        assert.ok((await b.evaluate(() => LiteSync.details())).conflicts.length > 0);
        cloud.records = savedRecords; cloud.revision = Math.max(...[...savedRecords.values()].map(r => r.version));
        // Switch account excludes local-only records. Foreign same-name data requires explicit choice.
        const other = account(engineName + '-other'); write(other, 'local', 'litegame.empty', 'foreign');
        await a.locator('#dataBtn').click();
        await a.locator('#serverDisconnect').click();
        await a.locator('#serverForm').waitFor();
        assert.ok(!(await a.locator('#dataBtn').getAttribute('class')).includes('server-linked'));
        await login(a, serverURL, engineName + '-other', false);
        assert.ok(!other.records.has('local:litegame.offline'));
        assert.equal((await a.evaluate(() => LiteSync.details())).conflicts.length, 1);
        await a.evaluate(() => LiteSync.resolve('local', 'litegame.empty', 'local')); await flush(a);
        assert.equal(other.records.get('local:litegame.empty').value, '');
        // Authentication failure stops automatic uploads without erasing local records.
        forcedError = 401; await flush(a); forcedError = 0;
        assert.equal((await a.evaluate(() => LiteSync.details())).connection.expired, true);
        await a.waitForFunction(() => !document.getElementById('dataBtn').classList.contains('server-linked'));
        await set(a, 'litegame.after-expiry', 'local only'); await flush(a); assert.ok(!other.records.has('local:litegame.after-expiry'));
        const recovery = await b.evaluate(() => LiteSync.exportRecovery()); assert.ok(!JSON.stringify(recovery).includes('test-token-'));
        assert.deepEqual(errors, []);
        console.log(engineName + ': login UI, backup isolation, idle foreground pull, pagination, exact cursor, conflicts, deletion, offline retry, NES, active-game fencing, account switch and 401 passed');
      } finally { forcedError = 0; for (const c of contexts) await c.close(); await browser.close(); }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(e => { console.error(e); process.exitCode = 1; });
