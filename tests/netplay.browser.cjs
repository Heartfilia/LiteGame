// Two isolated browser contexts (authenticated 1P Host + unauthenticated 2P Guest) playing 2P Contra over Netplay v1.
const { chromium, webkit } = require('playwright');
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const catalog = require('../games/nes/catalog.json');

const base = process.env.GAME_BASE_URL || 'http://127.0.0.1:8766';
const contra = catalog.games.find(g => g.title === '魂斗罗' && g.status === 'boot');
const circus = catalog.games.find(g => g.title === '马戏团' && g.status === 'boot');

// Reference in-memory LiteGameServer v1 sync + Netplay v1 room/WS implementation.
const accounts = new Map();
const tokens = new Map();
const rooms = new Map();
let nextToken = 0;
let nextRoomSeq = 482900;

function account(name) {
  if (!accounts.has(name)) accounts.set(name, { id: accounts.size + 1, username: name, revision: 0, records: new Map() });
  return accounts.get(name);
}

function wsSend(socket, opcode, data) {
  if (!socket || socket.destroyed) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function wsSendJSON(socket, obj) {
  wsSend(socket, 0x1, JSON.stringify(obj));
}

function attachWS(socket, onMessage, onClose) {
  let buf = Buffer.alloc(0);
  let fragOpcode = 0;
  let fragChunks = [];
  let closed = false;
  const finish = () => { if (!closed) { closed = true; onClose(); } };
  socket.on('error', finish);
  socket.on('close', finish);
  socket.on('end', finish);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const b0 = buf[0], b1 = buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f, offset = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        offset = 10;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < offset + maskLen + len) return;
      const payload = Buffer.from(buf.subarray(offset + maskLen, offset + maskLen + len));
      if (masked) {
        const mask = buf.subarray(offset, offset + 4);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      buf = buf.subarray(offset + maskLen + len);
      if (opcode === 0x8) { wsSend(socket, 0x8, Buffer.alloc(0)); socket.end(); finish(); return; }
      if (opcode === 0x9) { wsSend(socket, 0xa, payload); continue; }
      if (opcode === 0xa) continue;
      if (opcode === 0x0) {
        fragChunks.push(payload);
        if (fin) {
          const full = Buffer.concat(fragChunks);
          const op = fragOpcode;
          fragOpcode = 0;
          fragChunks = [];
          onMessage(op, full);
        }
      } else if (!fin) {
        fragOpcode = opcode;
        fragChunks = [payload];
      } else {
        onMessage(opcode, payload);
      }
    }
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', new URL(base).origin);
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
  const send = (code, value) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(value)); };
  if (req.method === 'OPTIONS') return send(200, {});

  const url = new URL(req.url, 'http://test');
  const path = url.pathname;
  let text = '';
  for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : {};

  if (path === '/api/v1/info') return send(200, { service: 'litegame-sync', protocol_version: 1, netplay_version: 1 });
  if (path === '/api/v1/auth/login') {
    const a = account(body.username);
    const token = 'np-token-' + (++nextToken);
    tokens.set(token, a);
    return send(200, { access_token: token, expires_at: Date.now() / 1000 + 3600, user: { id: a.id, username: a.username } });
  }
  if (path === '/api/v1/auth/logout') {
    tokens.delete((req.headers.authorization || '').replace('Bearer ', ''));
    return send(200, { ok: true });
  }

  // Public Netplay lookup & guest join endpoints (no account required).
  const roomMatch = path.match(/^\/api\/v1\/rooms\/(\d{6})(?:\/(join))?$/);
  if (roomMatch) {
    const room = rooms.get(roomMatch[1]);
    if (!room) return send(404, { error: { code: 'room_not_found', message: '房间不存在或已过期' } });
    if (req.method === 'GET' && !roomMatch[2]) {
      return send(200, {
        room_code: room.code,
        game_id: room.gameId,
        game_title: room.gameTitle,
        kind: room.kind,
        rom_sha256: room.romSha256,
        url: room.url,
        host_connected: !!room.hostSock,
        guest_connected: !!room.guestSock,
        expires_at: room.expiresAt
      });
    }
    if (req.method === 'POST' && roomMatch[2] === 'join') {
      if (body.game_id && body.game_id !== room.gameId) {
        return send(409, { error: { code: 'game_mismatch', message: '房间正在游玩另一款卡带' } });
      }
      if (body.rom_sha256 && body.rom_sha256 !== room.romSha256) {
        return send(409, { error: { code: 'game_mismatch', message: '卡带校验不一致' } });
      }
      if (room.guestSock && !room.guestSock.destroyed) {
        return send(409, { error: { code: 'room_full', message: '该房间 2P 席位已满' } });
      }
      room.guestTicket = 'guest-' + crypto.randomUUID();
      return send(200, {
        room_code: room.code,
        role: 2,
        ticket: room.guestTicket,
        game_id: room.gameId,
        game_title: room.gameTitle,
        kind: room.kind,
        rom_sha256: room.romSha256,
        url: room.url,
        expires_at: room.expiresAt,
        ice_servers: []
      });
    }
  }

  // Authenticated endpoints below.
  const authUser = tokens.get((req.headers.authorization || '').replace('Bearer ', ''));
  if (!authUser) return send(401, { error: { code: 'unauthorized', message: '请先登录游戏服务器账号' } });

  if (path === '/api/v1/records') {
    return send(200, { records: [], has_more: false, next_cursor: authUser.revision, revision: authUser.revision });
  }
  if (path === '/api/v1/records/batch') {
    const { key, value } = body.changes[0];
    const r = { kind: 'local', key, version: ++authUser.revision, deleted: value === null, value };
    authUser.records.set('local:' + key, r);
    return send(200, { records: [r], revision: authUser.revision });
  }
  if (path === '/api/v1/rooms' && req.method === 'POST') {
    // Close any previous room owned by this user.
    for (const [oldCode, oldRoom] of rooms) {
      if (oldRoom.ownerId === authUser.id) {
        if (oldRoom.guestSock) wsSendJSON(oldRoom.guestSock, { type: 'room_closed', reason: 'replaced' });
        oldRoom.hostSock?.end();
        oldRoom.guestSock?.end();
        rooms.delete(oldCode);
      }
    }
    const code = String(++nextRoomSeq);
    const room = {
      code,
      ownerId: authUser.id,
      gameId: body.game_id,
      gameTitle: body.game_title,
      kind: body.kind || 'nes',
      romSha256: body.rom_sha256,
      url: body.url,
      hostTicket: 'host-' + crypto.randomUUID(),
      guestTicket: null,
      hostSock: null,
      guestSock: null,
      expiresAt: Math.floor(Date.now() / 1000) + 1800
    };
    rooms.set(code, room);
    return send(200, { room_code: code, role: 1, ticket: room.hostTicket, expires_at: room.expiresAt, ice_servers: [] });
  }

  return send(404, { error: { code: 'not_found' } });
});

server.on('upgrade', (req, socket) => {
  const url = new URL(req.url, 'http://test');
  const m = url.pathname.match(/^\/api\/v1\/rooms\/(\d{6})\/ws$/);
  const ticket = url.searchParams.get('ticket');
  const room = m ? rooms.get(m[1]) : null;
  let role = 0;
  if (room && ticket && ticket === room.hostTicket) role = 1;
  else if (room && ticket && ticket === room.guestTicket) role = 2;
  if (!room || !role) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1')
    .update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n'
  );
  socket.setNoDelay(true);

  if (role === 1) room.hostSock = socket;
  else room.guestSock = socket;

  const peer = () => (role === 1 ? room.guestSock : room.hostSock);
  wsSendJSON(socket, {
    type: 'welcome',
    room_code: room.code,
    role,
    peer_connected: !!(peer() && !peer().destroyed),
    game_id: room.gameId,
    game_title: room.gameTitle,
    rom_sha256: room.romSha256
  });
  if (peer() && !peer().destroyed) {
    wsSendJSON(peer(), { type: 'peer_joined', role });
  }

  attachWS(socket, (opcode, payload) => {
    const other = peer();
    if (opcode === 0x2) {
      if (payload.length <= 64 && other && !other.destroyed) wsSend(other, 0x2, payload);
      return;
    }
    if (opcode === 0x1) {
      let msg;
      try { msg = JSON.parse(payload.toString('utf8')); } catch (_) { return; }
      if (msg.type === 'close_room' && role === 1) {
        if (other && !other.destroyed) { wsSendJSON(other, { type: 'room_closed', reason: 'host_closed' }); other.end(); }
        rooms.delete(room.code);
        socket.end();
        return;
      }
      if (msg.type === 'ping' && (!other || other.destroyed)) {
        wsSendJSON(socket, { type: 'pong', t: msg.t });
        return;
      }
      if (other && !other.destroyed) wsSend(other, 0x1, payload);
    }
  }, () => {
    if (role === 1 && room.hostSock === socket) room.hostSock = null;
    if (role === 2 && room.guestSock === socket) room.guestSock = null;
    const other = peer();
    if (other && !other.destroyed && rooms.has(room.code)) {
      wsSendJSON(other, { type: 'peer_left', role, reason: 'disconnected' });
    }
  });
});

async function canvasHashAtExactFrame(hostPage, guestPage, targetFrame) {
  // Capture exact RGBA digest on each page at the instant lockstep reaches targetFrame.
  const armCapture = (page, target) => page.evaluate(target => new Promise(resolve => {
    const canvas = document.getElementById('screen');
    const ctx = canvas.getContext('2d');
    const check = () => {
      if (window.nesNetplay && window.nesNetplay.frame() >= target) {
        // Pause locally on exact target frame if we hit it.
        resolve({ frame: window.nesNetplay.frame(), bytes: Array.from(ctx.getImageData(0, 0, 256, 240).data) });
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  }), targetFrame);

  const [a, b] = await Promise.all([armCapture(hostPage, targetFrame), armCapture(guestPage, targetFrame)]);
  return {
    frameA: a.frame,
    frameB: b.frame,
    hashA: crypto.createHash('sha256').update(Buffer.from(a.bytes)).digest('hex'),
    hashB: crypto.createHash('sha256').update(Buffer.from(b.bytes)).digest('hex')
  };
}

async function screenDigest(page) {
  const bytes = await page.evaluate(() => Array.from(document.getElementById('screen').getContext('2d').getImageData(0, 0, 256, 240).data));
  return crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
}

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const serverURL = 'http://127.0.0.1:' + server.address().port;

  try {
    for (const [engineName, engine] of [['chromium', chromium], ['webkit', webkit]]) {
      // Test both WebSocket binary relay fallback (symmetric 5G NAT mode) and WebRTC DataChannel mode.
      for (const disableWebRTC of [true, false]) {
        // WebKit headless does not always expose loopback ICE candidates cleanly; cover WebRTC upgrade on Chromium and WS relay on both.
        if (!disableWebRTC && engineName === 'webkit') continue;

        const browser = await engine.launch();
        try {
          const hostCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
          const guestCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
          if (disableWebRTC) {
            await hostCtx.addInitScript(() => { window.LITEGAME_DISABLE_WEBRTC = true; });
            await guestCtx.addInitScript(() => { window.LITEGAME_DISABLE_WEBRTC = true; });
          }

          // Instrument JSNES instance reference so we can directly verify P1 and P2 controller registers on both peers.
          for (const ctx of [hostCtx, guestCtx]) {
            await ctx.addInitScript(() => {
              window.nesControllerLog = { p1: new Set(), p2: new Set() };
            });
            await ctx.route('**/nes/nes.js', async route => {
              const res = await route.fetch();
              const src = (await res.text())
                .replace('nes = candidate; rom = bytes;', 'nes = candidate; window.nesTest = nes; rom = bytes;')
                .replace(
                  'applyPlayerMask(2, step.p2);',
                  'applyPlayerMask(2, step.p2); if (step.p1) window.nesControllerLog.p1.add(step.p1); if (step.p2) window.nesControllerLog.p2.add(step.p2);'
                );
              await route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: src });
            });
          }

          const host = await hostCtx.newPage();
          const guest = await guestCtx.newPage();
          const errors = [];
          for (const p of [host, guest]) p.on('pageerror', e => errors.push(e.message));

          // 1. Unauthenticated host is guided to connect LiteGameServer first.
          await host.goto(base + '/games/nes/?game=' + contra.id);
          await host.waitForFunction(() => !document.getElementById('netplay').disabled);
          await host.locator('#netplay').click();
          assert.ok(await host.locator('#np-go-server').isVisible(), 'prompts server login when unauthenticated');
          await host.locator('#lg-netplay-close').click();

          // 2. Host connects LiteGameServer, creates Contra room and obtains 6-digit code + invite link.
          await host.evaluate(async serverURL => {
            await LiteSync.connect({ server: serverURL, username: 'host-player', password: 'pw', importLocal: false });
          }, serverURL);
          await host.locator('#netplay').click();
          await host.locator('#np-create').click();
          await host.locator('#lg-netplay-code').waitFor();
          const codeText = (await host.locator('#lg-netplay-code').textContent()).replace(/\s+/g, '');
          assert.match(codeText, /^\d{6}$/);
          const inviteURL = await host.locator('#lg-netplay-link').textContent();
          assert.ok(inviteURL.includes('room=' + codeText) && inviteURL.includes('game=' + contra.id));
          assert.ok(await host.locator('#np-start-reset').isDisabled(), 'cannot start before P2 joins');

          // 3. Guest (NO account, NO login!) joins from Hall retro category using 6-digit room code -> auto-redirects to Contra!
          await guest.goto(base + '/index.html#/category/retro');
          await guest.locator('[data-open-netplay-join]').click();
          await guest.locator('#np-room-code').fill(codeText);
          await guest.locator('#np-server-url').fill(serverURL);
          await guest.locator('#np-join-submit').click();
          await guest.waitForURL('**/games/nes/index.html*');
          await guest.waitForFunction(() => window.nesNetplay?.inRoom() && window.nesNetplay.role() === 2);

          // 4. A third party trying to join an occupied 2P room is rejected with 409 room_full.
          const thirdRes = await fetch(serverURL + '/api/v1/rooms/' + codeText + '/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ game_id: contra.id })
          });
          assert.equal(thirdRes.status, 409);

          // 5. Host sees P2 ready and starts 2-player Contra!
          await host.waitForFunction(() => !document.getElementById('np-start-reset')?.disabled);
          await host.locator('#np-start-reset').click();

          await Promise.all([
            host.waitForFunction(() => document.getElementById('play').textContent === '运行中'),
            guest.waitForFunction(() => document.getElementById('play').textContent === '运行中')
          ]);
          assert.ok(await host.locator('#lg-netplay-pill').isVisible());
          assert.ok(await guest.locator('#lg-netplay-pill').isVisible());
          // Guest cannot unilaterally reset or restore while in 2P mode.
          assert.ok(await guest.locator('#reset').isDisabled());
          assert.ok(await guest.locator('#restore').isDisabled());

          if (!disableWebRTC) {
            await host.waitForFunction(() => window.nesNetplay.transport() === 'webrtc', null, { timeout: 5000 }).catch(() => {});
          } else {
            assert.equal(await host.evaluate(() => window.nesNetplay.transport()), 'ws');
          }

          // 6. Both players input simultaneously!
          // Host (1P) presses SELECT + START + holds KeyZ (A); Guest (2P) holds Guest's own [data-key="B"] and touch disc LEFT!
          await host.locator('[data-key="SELECT"]').click();
          await host.waitForTimeout(60);
          await host.locator('[data-key="START"]').click();
          await host.locator('#screen').focus();
          await host.keyboard.down('KeyZ');
          await host.keyboard.down('ArrowRight');

          await guest.locator('[data-key="B"]').scrollIntoViewIfNeeded();
          const bBox = await guest.locator('[data-key="B"]').boundingBox();
          await guest.mouse.move(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
          await guest.mouse.down();

          await Promise.all([
            host.waitForFunction(() => window.nesControllerLog.p1.size > 0 && window.nesControllerLog.p2.size > 0),
            guest.waitForFunction(() => window.nesControllerLog.p1.size > 0 && window.nesControllerLog.p2.size > 0)
          ]);

          await host.keyboard.up('KeyZ');
          await host.keyboard.up('ArrowRight');
          await guest.mouse.up();

          // Verify both peers recorded the exact same P1 and P2 controller bitmasks!
          const [hostLog, guestLog] = await Promise.all([
            host.evaluate(() => ({ p1: [...window.nesControllerLog.p1].sort(), p2: [...window.nesControllerLog.p2].sort() })),
            guest.evaluate(() => ({ p1: [...window.nesControllerLog.p1].sort(), p2: [...window.nesControllerLog.p2].sort() }))
          ]);
          assert.deepEqual(hostLog, guestLog, 'both peers applied identical P1 and P2 input bitmasks');

          // 7. Synchronized pause & exact pixel-identical state verification!
          await host.locator('#pause').click();
          await Promise.all([
            host.waitForFunction(() => document.getElementById('play').textContent === '开始 / 继续'),
            guest.waitForFunction(() => document.getElementById('play').textContent === '开始 / 继续')
          ]);

          // Quick phrase from Guest reaches Host HUD toast; Host resume wakes Guest too.
          await guest.locator('#lg-netplay-pill').click();
          await guest.locator('[data-np-phrase="漂亮！"]').click();
          await guest.locator('#lg-netplay-close').click();
          await host.waitForFunction(() => document.getElementById('lg-netplay-toast').textContent.includes('2P：漂亮！'));

          await host.locator('#play').click();
          await Promise.all([
            host.waitForFunction(() => document.getElementById('play').textContent === '运行中'),
            guest.waitForFunction(() => document.getElementById('play').textContent === '运行中')
          ]);

          // 8. Guest opens wrong cartridge first, uses room code -> auto-switches cartridge to Contra; then Host syncs mid-game snapshot!
          await guest.goto(base + '/games/nes/?game=' + circus.id);
          await host.waitForFunction(() => document.getElementById('play').textContent === '开始 / 继续'); // Host auto-paused on P2 disconnect!
          await guest.waitForFunction(() => !document.getElementById('netplay').disabled);
          await guest.locator('#netplay').click();
          await guest.locator('#np-tab-join').click();
          await guest.locator('#np-room-code').fill(codeText);
          await guest.locator('#np-server-url').fill(serverURL);
          await guest.locator('#np-join-submit').click();
          await guest.waitForFunction(() => window.nesNetplay?.inRoom() && document.getElementById('title').textContent === '魂斗罗');

          // Host syncs mid-game snapshot ("从当前画面同步同玩") and pauses at quiescent state to compare exact pixels!
          await host.locator('#netplay').click();
          await host.waitForFunction(() => !!document.getElementById('np-start-snap') && !document.getElementById('np-start-snap').disabled);
          await host.locator('#np-start-snap').click();
          await Promise.all([
            host.waitForFunction(() => document.getElementById('play').textContent === '运行中' && window.nesNetplay.frame() >= 20),
            guest.waitForFunction(() => document.getElementById('play').textContent === '运行中' && window.nesNetplay.frame() >= 20)
          ]);

          // Step to a shared quiescent point after snapshot sync and compare state!
          await host.locator('#pause').click();
          await guest.waitForFunction(() => document.getElementById('play').textContent === '开始 / 继续');
          // Advance whichever peer paused 1-2 delay frames earlier up to the exact same lockstep frame to assert bit-identical PPU output!
          const [fH, fG] = await Promise.all([
            host.evaluate(() => window.nesNetplay.frame()),
            guest.evaluate(() => window.nesNetplay.frame())
          ]);
          assert.ok(Math.abs(fH - fG) <= 3, 'paused within delay window: ' + fH + ' vs ' + fG);
          const target = Math.max(fH, fG);
          for (const [p, cur] of [[host, fH], [guest, fG]]) {
            if (cur < target) {
              await p.evaluate(n => { for (let i = 0; i < n; i++) window.nesTest.frame(); }, target - cur);
            }
          }
          assert.equal(await screenDigest(host), await screenDigest(guest), '256x240 screen pixels match bit-for-bit after snapshot resync');

          // 9. Mobile landscape handheld mode (#console-menu -> #menu-netplay) and clean disconnect.
          await guest.locator('#landscape').tap();
          await guest.waitForFunction(() => document.getElementById('console').classList.contains('immersive'));
          await guest.locator('#console-menu').tap();
          await guest.locator('#menu-netplay').tap();
          assert.equal(await guest.evaluate(() => document.getElementById('lg-netplay-modal').parentElement.classList.contains('console-layout')), true);
          const leaveBox = await guest.locator('#np-leave').boundingBox();
          assert.ok(leaveBox && leaveBox.width >= 44 && leaveBox.height >= 44, 'netplay modal reachable inside immersive/fullscreen console');
          await guest.locator('#np-leave').tap();
          assert.equal(await guest.evaluate(() => window.nesNetplay.inRoom()), false);
          assert.ok(await guest.locator('#lg-netplay-pill').isHidden());
          await guest.locator('#lg-netplay-close').tap();
          await guest.locator('#console-menu').tap();
          await guest.locator('#exit-display').tap();
          await guest.waitForFunction(() => !document.fullscreenElement && !document.getElementById('console').classList.contains('immersive'));

          for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
            await guest.setViewportSize(size);
            await guest.locator('#netplay').tap();
            assert.ok(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await guest.locator('#lg-netplay-close').tap();
          }

          assert.deepEqual(errors, []);
          console.log(`${engineName} (${disableWebRTC ? 'ws-relay' : 'webrtc+ws'}): 1P/2P room, Hall code join, 409 full guard, simultaneous 1P+2P Contra controls, sync pause/resume, quick msg, auto cartridge switch, snapshot resync and handheld modal passed`);
          await hostCtx.close();
          await guestCtx.close();
        } finally {
          await browser.close();
        }
      }
    }
  } finally {
    server.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
