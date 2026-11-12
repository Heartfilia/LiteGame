/* LiteGame sync protocol v1. Values stay raw; server revisions, never clocks, arbitrate writes. */
(function () {
  'use strict';
  if (window.LiteSync) return;
  const PREFIX = 'lgSync.v1.', CONNECTION = PREFIX + 'connection', EPOCH = PREFIX + 'restoreEpoch';
  const scriptURL = new URL(document.currentScript.src);
  const home = new URL('../../index.html', scriptURL).href;
  const gamePage = location.pathname.includes('/games/');
  const nativeSet = Storage.prototype.setItem, nativeRemove = Storage.prototype.removeItem;
  let initialEpoch = null;
  try { initialEpoch = localStorage.getItem(EPOCH); } catch (_) { /* Offline games retain their own storage handling. */ }
  let timer, busy = null, retryAt = 0, failures = 0, message = '未连接服务器，本地游玩', stale = false;
  let database;
  const validKey = key => typeof key === 'string' && key.length <= 256 && /^(litegame|chogan)\..+/.test(key) &&
    !/[\x00-\x1f\x7f]/.test(key) && !/^litegame\.(sync|server|auth|connection|device)(\.|$)/.test(key);
  const idOf = (kind, key) => kind + ':' + key;
  function connection() { try { return JSON.parse(localStorage.getItem(CONNECTION)); } catch (_) { return null; } }
  function scope(c) { return c.server + '|' + c.user.id; }
  function journal(c, kind, key) { return PREFIX + 'delete.' + encodeURIComponent(scope(c) + '|' + idOf(kind, key)); }
  function status(text) { message = text; window.dispatchEvent(new Event('litesyncchange')); gameNotice(); }
  function gameNotice() {
    if (!gamePage || !document.body || stale || !connection()) return;
    let link = document.getElementById('lg-sync-status');
    if (!link) {
      link = document.createElement('a'); link.id = 'lg-sync-status'; link.href = home + '#server'; link.target = '_top';
      link.style.cssText = 'position:fixed;right:8px;bottom:8px;z-index:2147483646;max-width:70vw;padding:6px 10px;border-radius:8px;background:#232234ed;color:#fff;font:12px/1.5 system-ui;text-decoration:none';
      document.body.append(link);
    }
    link.textContent = '云存档：' + message + ' · 设置';
    // Only actionable states occupy game space; successful background sync stays unobtrusive.
    link.hidden = !/冲突|暂停|暂缓|过期|失效/.test(message);
  }
  function notifyReload() {
    if (!gamePage || stale) return;
    stale = true;
    const show = () => {
      if (document.getElementById('lg-sync-reload')) return;
      document.exitPointerLock?.();
      window.dispatchEvent(new Event('blur'));
      const panel = document.createElement('div'); panel.id = 'lg-sync-reload';
      panel.setAttribute('role', 'alertdialog'); panel.setAttribute('aria-label', '云端进度已更新');
      panel.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#10131ff2;color:white;display:grid;place-content:center;padding:24px;text-align:center;font:16px/1.7 system-ui';
      const text = document.createElement('p'); text.textContent = '已收到新的云端进度。旧页面已停止写入存档，请重新载入后继续。替换前的本地记录已保留在同步恢复副本中。';
      const reload = document.createElement('button'); reload.textContent = '重新载入最新进度'; reload.style.cssText = 'padding:14px;font:inherit;cursor:pointer';
      reload.onclick = () => { if (window.top !== window) window.top.location.reload(); else location.reload(); };
      const link = document.createElement('a'); link.href = home + '#server'; link.target = '_top'; link.textContent = '返回游戏厅处理同步'; link.style.color = '#ffc2df';
      panel.append(text, reload, link); document.body.append(panel);
      for (const name of ['keydown', 'keyup', 'pointerdown', 'touchstart', 'mousedown']) panel.addEventListener(name, e => e.stopPropagation());
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show, { once: true });
  }
  function guard() {
    if (gamePage && (stale || localStorage.getItem(EPOCH) !== initialEpoch)) {
      notifyReload(); throw new Error('云端进度已更新，请重新载入后再存档');
    }
  }
  // Loaded before game code, including inline scripts. Native writes by the synchronizer bypass this hook.
  Storage.prototype.setItem = function (key, value) {
    key = String(key);
    if (this === localStorage && validKey(key)) guard();
    nativeSet.call(this, key, value);
    if (this === localStorage && validKey(key)) {
      const c = connection(); if (c) nativeRemove.call(localStorage, journal(c, 'local', key));
      schedule(2000);
    }
  };
  Storage.prototype.removeItem = function (key) {
    key = String(key);
    if (this === localStorage && validKey(key)) {
      guard();
      const c = connection();
      // Persist intent first: if the subsequent delete fails, the actual value still wins.
      if (c && this.getItem(key) !== null) nativeSet.call(localStorage, journal(c, 'local', key), crypto.randomUUID());
    }
    nativeRemove.call(this, key);
    if (this === localStorage && validKey(key)) schedule(2000);
  };
  // clear() is deliberately not interpreted as cloud deletion.
  function openDB(name, store) {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(store);
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
  }
  async function db() { return database ||= openDB('lgSync-v1', 'data'); }
  async function transact(database, store, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = database.transaction(store, mode), r = action(tx.objectStore(store));
      tx.oncomplete = () => resolve(r?.result); tx.onerror = tx.onabort = () => reject(tx.error || new Error('同步存储失败'));
    });
  }
  async function get(key) { return transact(await db(), 'data', 'readonly', s => s.get(key)); }
  async function put(key, value) { return transact(await db(), 'data', 'readwrite', s => s.put(value, key)); }
  async function nes(action, mode = 'readonly') {
    const d = await openDB('litegame-nes', 'states');
    try { return await transact(d, 'states', mode, action); } finally { d.close(); }
  }
  async function hash(value) {
    if (value === null) return null;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)));
    return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
  }
  function normalizeServer(input) {
    const u = new URL(input.trim());
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/')
      throw new Error('请输入服务器根地址，例如 https://save.example.com，不含路径或账号');
    if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) throw new Error('公网服务器必须使用 HTTPS');
    return u.origin;
  }
  async function call(c, path, method = 'GET', body) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(c.server + '/api/v1' + path, {
        method, credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
        headers: { ...(c.access_token ? { Authorization: 'Bearer ' + c.access_token } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new Error(result?.error?.message || 'HTTP ' + response.status);
        error.status = response.status; error.code = result?.error?.code;
        const retry = response.headers.get('Retry-After');
        error.retry = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 0;
        throw error;
      }
      if (!result) throw new Error('服务器返回了无效数据');
      return result;
    } finally { clearTimeout(timeout); }
  }
  // Web Locks serializes network reconciliation, account changes and conflict resolution across tabs.
  // Without it, local play remains available; never fall back to a racy localStorage "lock".
  async function locked(task) {
    if (!navigator.locks) throw new Error('自动同步需要支持 Web Locks 的浏览器及 HTTPS（本机 localhost 也可）');
    return navigator.locks.request(PREFIX + 'worker', task);
  }
  async function localValue(kind, key) {
    return kind === 'local' ? localStorage.getItem(key) : (await nes(s => s.get(key))) ?? null;
  }
  async function localItems() {
    const items = new Map();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (validKey(key)) items.set(idOf('local', key), { kind: 'local', key });
    }
    for (const key of await nes(s => s.getAllKeys())) if (/^[a-f0-9]{64}$/.test(key)) items.set(idOf('nes', key), { kind: 'nes', key });
    return items;
  }
  const metaKey = c => scope(c) + '|meta';
  const itemKey = (c, item) => scope(c) + '|' + idOf(item.kind, item.key);
  function validateRecord(r) {
    if (!r || !Number.isSafeInteger(r.version) || r.version < 0 ||
      !(r.kind === 'local' ? validKey(r.key) && (r.value === null || typeof r.value === 'string') : r.kind === 'nes' && /^[a-f0-9]{64}$/.test(r.key)))
      throw new Error('服务器记录格式不正确');
  }
  async function remoteRecord(c, r) {
    if (r.kind === 'nes') {
      r = await call(c, '/nes/' + r.key);
      r.value = r.deleted ? null : r.snapshot;
      if (r.value && (r.value.sha256 !== r.key || r.value.format !== 1 || r.value.emulator !== 'jsnes-2.1.0' || !r.value.state)) throw new Error('云端 FC 存档格式不正确');
    }
    validateRecord(r); return r;
  }
  async function apply(c, item, value, expectedHash) {
    const before = await localValue(item.kind, item.key);
    if (await hash(before) !== expectedHash) return false;
    // Recovery is durable before changing local storage, including NES snapshots.
    await put(scope(c) + '|recovery|' + idOf(item.kind, item.key), { kind: item.kind, key: item.key, value: before, savedAt: new Date().toISOString() });
    // Fence every already-running game document, including tabs that have not received storage events yet.
    nativeSet.call(localStorage, EPOCH, crypto.randomUUID());
    notifyReload();
    if (item.kind === 'local') {
      // Recheck after asynchronous recovery persistence.
      if (localStorage.getItem(item.key) !== before) return false;
      if (value === null) nativeRemove.call(localStorage, item.key); else nativeSet.call(localStorage, item.key, value);
      window.dispatchEvent(new Event('favoriteschange'));
    } else {
      const database = await openDB('litegame-nes', 'states');
      let matched = false;
      try {
        await transact(database, 'states', 'readwrite', store => {
          const request = store.get(item.key);
          request.onsuccess = () => {
            if (JSON.stringify(request.result ?? null) !== JSON.stringify(before)) return;
            matched = true;
            if (value === null) store.delete(item.key); else store.put(value, item.key);
          };
          return request;
        });
      } finally { database.close(); }
      if (!matched) return false;
    }
    nativeRemove.call(localStorage, journal(c, item.kind, item.key));
    return true;
  }
  async function reconcile(c, meta, r) {
    const key = itemKey(c, r), item = await get(key) || { kind: r.kind, key: r.key };
    const local = await localValue(r.kind, r.key), lh = await hash(local), rh = await hash(r.value);
    const explicitlyDeleted = localStorage.getItem(journal(c, r.kind, r.key));
    // Retrying a pull of an unchanged remote version must not recreate an accepted conflict.
    if (lh === rh) { item.base = { version: r.version, hash: rh }; delete item.conflict; delete item.excluded; }
    else if (!item.conflict && ((item.base && lh === item.base.hash) || (local === null && !explicitlyDeleted))) {
      if (await apply(c, item, r.value, lh)) { item.base = { version: r.version, hash: rh }; delete item.excluded; }
      else item.conflict = { local: await localValue(r.kind, r.key), remote: r };
    } else if (!item.conflict && item.base && rh === item.base.hash) {
      item.base.version = r.version;
    } else {
      item.conflict = { local, remote: r };
    }
    await put(key, item);
    meta.ids[idOf(r.kind, r.key)] = { kind: r.kind, key: r.key };
  }
  async function pull(c, meta) {
    const full = meta.full, seen = new Set();
    let cursor = full ? 0 : meta.cursor || 0;
    for (;;) {
      const page = await call(c, '/records?since=' + cursor + '&limit=50');
      if (!Array.isArray(page.records) || !Number.isSafeInteger(page.next_cursor) || page.next_cursor < cursor || (page.has_more && page.next_cursor === cursor)) throw new Error('服务器游标格式不正确');
      if (full && cursor === 0 && page.revision < (meta.cursor || 0)) await invalidateVersions(c, meta);
      for (const record of page.records) {
        const r = await remoteRecord(c, record);
        await reconcile(c, meta, r); seen.add(idOf(r.kind, r.key));
      }
      cursor = page.next_cursor;
      // Full scans restart from zero if interrupted; incremental pages only advance after durable reconciliation.
      if (!full) { meta.cursor = cursor; await put(metaKey(c), meta); }
      if (!page.has_more) break;
    }
    if (full) {
      for (const [id, ref] of Object.entries(meta.ids)) {
        if (seen.has(id)) continue;
        const item = await get(itemKey(c, ref));
        if (item?.base?.version || item?.conflict) {
          item.conflict = { local: await localValue(ref.kind, ref.key), remote: { ...ref, value: null, version: 0, deleted: true } };
          delete item.base; await put(itemKey(c, ref), item);
        }
      }
    }
    meta.cursor = cursor; meta.full = false; await put(metaKey(c), meta);
  }
  async function invalidateVersions(c, meta) {
    for (const ref of Object.values(meta.ids)) {
      const k = itemKey(c, ref), item = await get(k);
      if (item) {
        delete item.base;
        item.conflict = { local: await localValue(ref.kind, ref.key), remote: { ...ref, version: 0, value: null, deleted: true } };
        await put(k, item);
      }
    }
  }
  async function upload(c, meta) {
    const current = await localItems();
    for (const [id, ref] of Object.entries(meta.ids)) if (!current.has(id)) current.set(id, ref);
    for (const [id, ref] of current) {
      const key = itemKey(c, ref), item = await get(key) || { ...ref };
      const value = await localValue(ref.kind, ref.key), digest = await hash(value);
      meta.ids[id] = ref;
      if (item.conflict || (item.blocked && item.blocked.hash === digest) || (item.excluded !== undefined && item.excluded === digest)) continue;
      if (item.base && item.base.hash === digest) continue;
      if (value === null && (!item.base || !localStorage.getItem(journal(c, ref.kind, ref.key)))) continue;
      const version = item.base?.version || 0;
      const body = ref.kind === 'local' ? { changes: [{ key: ref.key, value, expected_version: version }] } : { expected_version: version, snapshot: value };
      const size = new TextEncoder().encode(JSON.stringify(body)).length;
      const valueSize = new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
      if (size > c.limits.body_bytes || valueSize > (ref.kind === 'local' ? c.limits.record_bytes : c.limits.nes_bytes)) {
        item.blocked = { hash: digest, message: '记录超过服务器大小限制' }; await put(key, item); continue;
      }
      try {
        const result = ref.kind === 'local' ? await call(c, '/records/batch', 'POST', body) : value === null ?
          await call(c, '/nes/' + ref.key + '?expected_version=' + version, 'DELETE') : await call(c, '/nes/' + ref.key, 'PUT', body);
        const record = result.records?.[0];
        if (!record || !Number.isSafeInteger(record.version) || record.key !== ref.key) throw new Error('无效的上传回执');
        // Acknowledge exactly the sent value. A concurrent local edit remains dirty next pass.
        item.base = { version: record.version, hash: digest }; delete item.blocked;
        await put(key, item);
      } catch (e) {
        if ([413, 422].includes(e.status)) { item.blocked = { hash: digest, message: e.message }; await put(key, item); }
        else throw e;
      }
    }
    await put(metaKey(c), meta);
  }
  function schedule(delay = 0) {
    clearTimeout(timer);
    if (connection()) timer = setTimeout(() => sync(), Math.max(delay, retryAt - Date.now()));
  }
  async function sync() {
    if (busy) { schedule(2000); return busy; }
    if (Date.now() < retryAt) { schedule(); return; }
    let attempt;
    busy = locked(async () => {
      const c = connection(); if (!c || c.expired) return;
      attempt = c.access_token;
      if (c.expires_at * 1000 <= Date.now()) { c.expired = true; nativeSet.call(localStorage, CONNECTION, JSON.stringify(c)); status('登录已过期，请重新连接'); return; }
      const meta = await get(metaKey(c)); if (!meta) return;
      status('正在核对云端进度…');
      await pull(c, meta); // Every retry pulls first, including ambiguous network failures after a committed upload.
      await upload(c, meta);
      failures = 0; retryAt = 0;
      const report = await details();
      status(report.conflicts.length ? '有 ' + report.conflicts.length + ' 条冲突待选择，其余记录继续同步' : report.blocked.length ? '部分记录暂停同步，请查看详情' : '已同步 · ' + new Date().toLocaleTimeString());
    }).catch(async e => {
      const c = connection();
      if (attempt && c?.access_token !== attempt) return;
      if (e.status === 401 && c) { c.expired = true; nativeSet.call(localStorage, CONNECTION, JSON.stringify(c)); status('登录已失效，请重新连接'); }
      else if (e.status === 409 && c) {
        await locked(async () => {
          const m = await get(metaKey(c));
          if (m) {
            m.full = true;
            if (e.code === 'cursor_invalid') {
              // A server restore invalidates every version assumption, not just the cursor.
              await invalidateVersions(c, m);
            }
            await put(metaKey(c), m);
          }
        });
        retryAt = Date.now() + 2000; status('云端版本已变化，正在重新核对'); schedule(2000);
      } else {
        retryAt = Date.now() + Math.max(e.retry || 0, Math.min(300000, 2000 * 2 ** Math.min(++failures, 7)) * (1 + Math.random() * .25));
        status('同步暂缓：' + e.message + '。本地记录保留，将自动重试。'); schedule();
      }
    }).finally(() => { busy = null; window.dispatchEvent(new Event('litesyncchange')); });
    return busy;
  }
  async function connect({ server, username, password, importLocal }) {
    return locked(async () => {
      server = normalizeServer(server);
      const loginWaitKey = PREFIX + 'loginWait.' + encodeURIComponent(server);
      const wait = Number(localStorage.getItem(loginWaitKey)) - Date.now();
      if (wait > 0) throw new Error('服务器登录限流，请在 ' + Math.ceil(wait / 1000) + ' 秒后重试');
      const info = await call({ server }, '/info');
      if (info.service !== 'litegame-sync' || info.protocol_version !== 1) throw new Error('不兼容的游戏同步服务，需要协议 v1');
      let auth;
      try { auth = await call({ server }, '/auth/login', 'POST', { username, password }); }
      catch (e) {
        if (e.status === 429) nativeSet.call(localStorage, loginWaitKey, String(Date.now() + (e.retry || 30000)));
        throw e;
      }
      if (!auth.access_token || !auth.user?.id || !Number.isFinite(auth.expires_at)) throw new Error('登录响应不正确');
      const c = { ...auth, server, limits: { body_bytes: 16777216, record_bytes: 1048576, nes_bytes: 12582912, ...info.limits } };
      const old = connection();
      let meta = await get(metaKey(c));
      const lastScope = localStorage.getItem(PREFIX + 'lastScope');
      const differentAccount = (old && scope(old) !== scope(c)) || (lastScope && lastScope !== scope(c));
      if (!meta || differentAccount) {
        if (meta && differentAccount) {
          for (const ref of Object.values(meta.ids)) {
            const previous = await get(itemKey(c, ref));
            if (previous?.conflict) await put(scope(c) + '|recovery-conflict|' + idOf(ref.kind, ref.key), previous);
            await put(itemKey(c, ref), { ...ref });
          }
        }
        meta = { cursor: 0, full: true, ids: {} };
        for (const [id, ref] of await localItems()) {
          meta.ids[id] = ref;
          // Even excluded records participate in full reconciliation, but cannot silently seed this account.
          await put(itemKey(c, ref), { ...ref, ...(!importLocal ? { excluded: await hash(await localValue(ref.kind, ref.key)) } : {}) });
        }
      }
      meta.full = true;
      await put(metaKey(c), meta);
      nativeSet.call(localStorage, CONNECTION, JSON.stringify(c));
      nativeSet.call(localStorage, PREFIX + 'lastScope', scope(c));
      retryAt = 0; failures = 0; status('连接成功，正在核对已有进度'); schedule();
    });
  }
  async function disconnect() {
    return locked(async () => {
      const c = connection(); nativeRemove.call(localStorage, CONNECTION); clearTimeout(timer);
      status('已断开，本地进度保留');
      if (c) await call(c, '/auth/logout', 'POST').catch(() => {});
    });
  }
  async function details() {
    const c = connection(), out = { connection: c ? { server: c.server, username: c.user.username, expired: !!c.expired } : null, message, conflicts: [], blocked: [] };
    if (!c) return out;
    const meta = await get(metaKey(c));
    for (const ref of Object.values(meta?.ids || {})) {
      const item = await get(itemKey(c, ref));
      if (item?.conflict) out.conflicts.push({ ...ref, local: item.conflict.local, remote: item.conflict.remote });
      if (item?.blocked) out.blocked.push({ ...ref, message: item.blocked.message });
    }
    return out;
  }
  async function resolve(kind, key, choice) {
    return locked(async () => {
      const c = connection(); if (!c) return;
      const ref = { kind, key }, name = itemKey(c, ref), item = await get(name);
      if (!item?.conflict || choice === 'defer') return;
      const r = item.conflict.remote;
      const local = await localValue(kind, key), digest = await hash(local);
      if (choice === 'cloud') {
        if (!await apply(c, ref, r.value, digest)) throw new Error('本地存档刚刚变化，请重新选择');
      } else if (choice === 'local') {
        await put(scope(c) + '|recovery-cloud|' + idOf(kind, key), r);
        if (local === null) nativeSet.call(localStorage, journal(c, kind, key), crypto.randomUUID());
      } else throw new Error('未知的冲突选择');
      item.base = { version: r.version, hash: await hash(r.value) };
      delete item.conflict; delete item.excluded; delete item.blocked;
      await put(name, item); status('已保存选择，继续核对'); schedule();
    });
  }
  async function exportRecovery() {
    const c = connection(); if (!c) throw new Error('请先连接账户');
    const d = await db(), keys = await transact(d, 'data', 'readonly', s => s.getAllKeys());
    const records = [];
    for (const key of keys) if (key.startsWith(scope(c) + '|recovery')) records.push(await get(key));
    const report = await details();
    const data = Object.fromEntries(records.filter(r => r.kind === 'local' && typeof r.value === 'string').map(r => [r.key, r.value]));
    return { app: 'litegame', type: 'progress-backup', version: 1, exportedAt: new Date().toISOString(), data, records, conflicts: report.conflicts };
  }
  window.LiteSync = { connect, disconnect, sync, details, resolve, exportRecovery, normalizeServer, guard,
    // NES calls this only after a durable user save. Scanning covers saves made while disconnected.
    nesSaved(key) { const c = connection(); if (c) nativeRemove.call(localStorage, journal(c, 'nes', key)); schedule(2000); },
    async retryBlocked() {
      await locked(async () => { const c = connection(); if (!c) return; const m = await get(metaKey(c)); for (const ref of Object.values(m?.ids || {})) { const k = itemKey(c, ref), item = await get(k); if (item?.blocked) { delete item.blocked; await put(k, item); } } });
      schedule();
    }
  };
  window.addEventListener('storage', e => {
    if (e.key === EPOCH) notifyReload();
    if (e.key === CONNECTION || (e.key && validKey(e.key))) { window.dispatchEvent(new Event('litesyncchange')); schedule(2000); }
  });
  document.addEventListener('DOMContentLoaded', gameNotice, { once: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  window.addEventListener('pageshow', () => { if (gamePage && localStorage.getItem(EPOCH) !== initialEpoch) notifyReload(); schedule(); });
  window.addEventListener('online', () => schedule());
  setInterval(() => { if (!document.hidden) schedule(); }, 20000);
  schedule();
})();
