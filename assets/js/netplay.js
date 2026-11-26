/* LiteGame Netplay v1: deterministic lockstep codec, room signaling (WS + optional WebRTC DataChannel) and shared UI. */
(function (root, factory) {
  'use strict';
  const exportsObj = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = exportsObj;
  if (root) root.LiteNetplay = exportsObj;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const STORAGE_SERVER_KEY = 'lgNetplay.v1.server';
  const PACKET_INPUT = 1;
  const MASK_BITS = 0x03ff;
  const QUICK_PHRASES = ['按 SELECT 选双人', '按 START 开始', '等我一下', '漂亮！'];

  function normalizeRoomCode(value) {
    const digits = String(value == null ? '' : value).replace(/[\s-]+/g, '');
    if (!/^\d{6}$/.test(digits) || digits === '000000') throw new Error('请输入有效的 6 位数字房间号');
    return digits;
  }

  function normalizeServer(input) {
    if (root?.LiteSync?.normalizeServer) return root.LiteSync.normalizeServer(input);
    let u;
    try { u = new URL(String(input || '').trim()); } catch (_) { throw new Error('请输入有效的服务器根地址，例如 https://save.example.com'); }
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || u.pathname !== '/')
      throw new Error('请输入服务器根地址，例如 https://save.example.com，不含路径或账号');
    if (u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname))
      throw new Error('公网服务器必须使用 HTTPS');
    return u.origin;
  }

  function safeGameURL(rel) {
    const value = String(rel || '').trim();
    if (!/^games\/[a-z0-9/_-]+(?:\.html)?(?:\?[a-z0-9=&_%-]*)?$/i.test(value) || value.includes('..'))
      throw new Error('服务器返回了无效的游戏入口路径');
    return value;
  }

  function encodeInputFrame(sessionId, frame, mask, prevMask = 0) {
    const out = new Uint8Array(10);
    const view = new DataView(out.buffer);
    out[0] = PACKET_INPUT;
    out[1] = sessionId & 0xff;
    view.setUint32(2, frame >>> 0, false);
    view.setUint16(6, mask & MASK_BITS, false);
    view.setUint16(8, prevMask & MASK_BITS, false);
    return out;
  }

  function decodeInputFrame(raw) {
    if (!raw) return null;
    const bytes = raw instanceof Uint8Array ? raw : raw instanceof ArrayBuffer ? new Uint8Array(raw) : ArrayBuffer.isView(raw) ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength) : null;
    if (!bytes || bytes.byteLength < 8 || bytes[0] !== PACKET_INPUT) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const hasPrev = bytes.byteLength >= 10;
    return {
      sessionId: bytes[1],
      frame: view.getUint32(2, false),
      mask: view.getUint16(6, false) & MASK_BITS,
      prevMask: hasPrev ? (view.getUint16(8, false) & MASK_BITS) : 0,
      hasPrev
    };
  }

  function createLockstep({ role, sessionId = 1, delay = 2 }) {
    if (role !== 1 && role !== 2) throw new Error('无效的玩家席位');
    const safeDelay = Math.max(1, Math.min(8, Math.floor(delay) || 2));
    const sid = sessionId & 0xff;
    let currentFrame = 0;
    let scheduledThrough = safeDelay - 1;
    let remoteMaxFrame = safeDelay - 1;
    const localInputs = new Map();
    const remoteInputs = new Map();
    for (let f = 0; f < safeDelay; f++) {
      localInputs.set(f, 0);
      remoteInputs.set(f, 0);
    }

    return {
      role,
      sessionId,
      delay: safeDelay,
      frame: () => currentFrame,
      produceLocal(sampleFn, sendFn) {
        while (scheduledThrough < currentFrame + safeDelay) {
          const target = ++scheduledThrough;
          const mask = (sampleFn ? sampleFn(target) : 0) & MASK_BITS;
          const prev = localInputs.get(target - 1) || 0;
          localInputs.set(target, mask);
          if (sendFn) sendFn(encodeInputFrame(sid, target, mask, prev));
        }
      },
      receive(packet) {
        const decoded = packet && typeof packet.frame === 'number' ? packet : decodeInputFrame(packet);
        if (!decoded || (decoded.sessionId & 0xff) !== sid) return false;
        if (decoded.frame >= currentFrame) {
          remoteInputs.set(decoded.frame, decoded.mask & MASK_BITS);
          if (decoded.frame > remoteMaxFrame) remoteMaxFrame = decoded.frame;
        }
        if (decoded.hasPrev && decoded.frame > 0 && decoded.frame - 1 >= currentFrame && !remoteInputs.has(decoded.frame - 1)) {
          remoteInputs.set(decoded.frame - 1, decoded.prevMask & MASK_BITS);
        }
        return true;
      },
      canStep() {
        return localInputs.has(currentFrame) && remoteInputs.has(currentFrame);
      },
      consumeFrame() {
        if (!localInputs.has(currentFrame) || !remoteInputs.has(currentFrame)) return null;
        const mine = localInputs.get(currentFrame);
        const theirs = remoteInputs.get(currentFrame);
        remoteInputs.delete(currentFrame);
        if (currentFrame >= 2) localInputs.delete(currentFrame - 2);
        const f = currentFrame++;
        return role === 1 ? { frame: f, p1: mine, p2: theirs } : { frame: f, p1: theirs, p2: mine };
      },
      lagAhead() {
        return remoteMaxFrame - (currentFrame + safeDelay);
      }
    };
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  }

  function base64ToBytes(b64) {
    if (typeof atob !== 'function') return new Uint8Array(Buffer.from(b64, 'base64'));
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }

  async function packSnapshot(snapshot) {
    const json = JSON.stringify(snapshot);
    if (typeof CompressionStream === 'function' && typeof Response === 'function') {
      try {
        const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
        const compressed = new Uint8Array(await new Response(stream).arrayBuffer());
        return { encoding: 'gzip-base64', data: bytesToBase64(compressed) };
      } catch (_) { /* Fall back to plain JSON if stream compression is unavailable. */ }
    }
    return { encoding: 'json', data: json };
  }

  async function unpackSnapshot(packed) {
    if (!packed || typeof packed !== 'object' || typeof packed.data !== 'string') throw new Error('同步快照格式无效');
    if (packed.encoding === 'json') {
      if (packed.data.length > 12 * 1024 * 1024) throw new Error('同步快照超过大小限制');
      return JSON.parse(packed.data);
    }
    if (packed.encoding === 'gzip-base64') {
      if (packed.data.length > 4 * 1024 * 1024) throw new Error('压缩快照超过大小限制');
      if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器不支持解压同步快照');
      const bytes = base64ToBytes(packed.data);
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      const reader = stream.getReader();
      const chunks = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > 12 * 1024 * 1024) { await reader.cancel(); throw new Error('解压后的同步快照过大'); }
        chunks.push(value);
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }
      return JSON.parse(new TextDecoder().decode(merged));
    }
    throw new Error('未知的同步快照编码');
  }

  async function requestJSON(server, path, { method = 'GET', token = null, body = undefined } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(server + '/api/v1' + path, {
        method,
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 404 && !result?.error?.code) {
          const err = new Error('房间不存在，或当前服务器尚未启用双人联机（/api/v1/rooms）');
          err.status = 404;
          throw err;
        }
        const err = new Error(result?.error?.message || ('HTTP ' + response.status));
        err.status = response.status;
        err.code = result?.error?.code;
        throw err;
      }
      if (!result) throw new Error('服务器返回了无效响应');
      return result;
    } finally {
      clearTimeout(timer);
    }
  }

  function wsEndpoint(server, roomCode, ticket) {
    const u = new URL(server);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    u.pathname = '/api/v1/rooms/' + encodeURIComponent(roomCode) + '/ws';
    u.search = '?ticket=' + encodeURIComponent(ticket);
    return u.href;
  }

  function formatRoomCode(code) {
    return code && code.length === 6 ? code.slice(0, 3) + ' ' + code.slice(3) : String(code || '');
  }

  // Inject netplay stylesheet automatically when loaded in a browser document.
  let scriptBase = null;
  if (root?.document?.currentScript?.src) {
    scriptBase = new URL(root.document.currentScript.src);
    const cssHref = new URL('../css/netplay.css', scriptBase).href;
    if (![...root.document.querySelectorAll('link[rel="stylesheet"]')].some(n => n.href === cssHref)) {
      const link = root.document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssHref;
      root.document.head.append(link);
    }
  }

  function savedGuestServer() {
    try { return root?.LiteSync?.session?.()?.server || root?.localStorage?.getItem(STORAGE_SERVER_KEY) || ''; }
    catch (_) { return ''; }
  }

  function rememberGuestServer(server) {
    try { root?.localStorage?.setItem(STORAGE_SERVER_KEY, server); } catch (_) {}
  }

  async function copyText(text) {
    if (root?.navigator?.clipboard?.writeText) {
      try { await root.navigator.clipboard.writeText(text); return true; } catch (_) {}
    }
    try {
      const area = root.document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.setAttribute('data-allow-select', '');
      area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      root.document.body.append(area);
      area.select();
      const ok = root.document.execCommand('copy');
      area.remove();
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  function createController(adapter = {}) {
    const doc = root.document;
    const homeURL = scriptBase ? new URL('../../index.html', scriptBase) : new URL('../../index.html', root.location.href);

    let tab = 'host';
    let busy = false;
    let feedback = { text: '', error: false };
    let room = null; // { code, role, server, ticket, ws, pc, dc, iceServers, peerConnected, peerReady, rttMs, sessionId, lockstep, playing, waitingSince }
    let pingTimer = null;
    let toastTimer = null;
    let lastFocus = null;

    const initialParams = new URLSearchParams(root.location.search);
    let pendingAutoJoin = initialParams.get('room') ? {
      code: initialParams.get('room'),
      server: initialParams.get('server') || savedGuestServer()
    } : null;
    if (pendingAutoJoin) tab = 'join';

    // Build shared DOM elements (modal + HUD pill + quick toast).
    const modal = doc.createElement('div');
    modal.id = 'lg-netplay-modal';
    modal.className = 'lg-netplay-modal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'lg-netplay-title');
    modal.innerHTML =
      '<div class="lg-netplay-backdrop" data-np-close></div>' +
      '<div class="lg-netplay-panel">' +
        '<div class="lg-netplay-topbar">' +
          '<span class="lg-netplay-tag" id="lg-netplay-tag">NETPLAY · 双人联机</span>' +
          '<button type="button" class="lg-netplay-close" id="lg-netplay-close" data-np-close aria-label="关闭联机窗口">关闭</button>' +
        '</div>' +
        '<h2 class="lg-netplay-title" id="lg-netplay-title">双人联机大厅</h2>' +
        '<p class="lg-netplay-sub" id="lg-netplay-sub"></p>' +
        '<div id="lg-netplay-body"></div>' +
        '<p class="lg-netplay-msg" id="lg-netplay-msg" role="status" aria-live="polite" hidden></p>' +
      '</div>';

    const pill = doc.createElement('button');
    pill.type = 'button';
    pill.id = 'lg-netplay-pill';
    pill.className = 'lg-netplay-pill';
    pill.hidden = true;
    pill.innerHTML = '<span class="lg-netplay-dot" aria-hidden="true"></span><span id="lg-netplay-pill-text">联机中</span>';

    const toast = doc.createElement('div');
    toast.id = 'lg-netplay-toast';
    toast.className = 'lg-netplay-toast';
    toast.hidden = true;
    toast.setAttribute('role', 'status');

    function mountUI() {
      const modalParent = adapter.mountModalTarget?.() || doc.fullscreenElement || doc.body;
      if (modalParent && modal.parentElement !== modalParent) modalParent.append(modal);
      const pillParent = adapter.mountPillTarget?.() || doc.body;
      if (pillParent && pill.parentElement !== pillParent) pillParent.append(pill, toast);
    }

    function setFeedback(text, error = false) {
      feedback = { text: text || '', error: !!error };
      const node = modal.querySelector('#lg-netplay-msg');
      node.hidden = !feedback.text;
      node.textContent = feedback.text;
      node.classList.toggle('is-error', feedback.error);
    }

    function showToast(text) {
      mountUI();
      toast.textContent = text;
      toast.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
    }

    function clearRoomParamsFromURL() {
      try {
        const url = new URL(root.location.href);
        if (!url.searchParams.has('room') && !url.searchParams.has('server')) return;
        url.searchParams.delete('room');
        url.searchParams.delete('server');
        root.history.replaceState(null, '', url.pathname + url.search + url.hash);
      } catch (_) {}
    }

    function inviteLink() {
      if (!room) return '';
      const game = adapter.getGame?.();
      const base = new URL(root.location.href);
      base.hash = '';
      if (game?.id) base.searchParams.set('game', game.id);
      if (!base.searchParams.get('from')) base.searchParams.set('from', 'retro');
      base.searchParams.set('server', room.server);
      base.searchParams.set('room', room.code);
      return base.href;
    }

    function updatePill() {
      mountUI();
      if (!room) {
        pill.hidden = true;
        toast.hidden = true;
        return;
      }
      pill.hidden = false;
      const roleLabel = room.role === 1 ? '1P' : '2P';
      let state = 'waiting';
      let label = roleLabel + ' 房间 ' + room.code;
      if (!room.ws || room.ws.readyState > 1) {
        state = 'offline';
        label = roleLabel + ' 连接已断开';
      } else if (room.peerConnected) {
        state = 'online';
        const rtt = room.rttMs != null ? ' · ' + room.rttMs + 'ms' : '';
        const chan = room.dc?.readyState === 'open' ? ' P2P' : '';
        label = roleLabel + ' 双人在线' + rtt + chan;
      } else {
        label = roleLabel + ' 等待加入 · ' + room.code;
      }
      pill.dataset.state = state;
      pill.querySelector('#lg-netplay-pill-text').textContent = label;
    }

    function closeRTC(r) {
      if (!r) return;
      try { r.dc?.close(); } catch (_) {}
      try { r.pc?.close(); } catch (_) {}
      r.dc = null;
      r.pc = null;
    }

    function sendJSON(payload) {
      if (room?.ws?.readyState === 1) room.ws.send(JSON.stringify(payload));
    }

    function sendBinary(bytes) {
      if (!room) return;
      if (room.dc?.readyState === 'open') {
        try { room.dc.send(bytes); return; } catch (_) {}
      }
      if (room.ws?.readyState === 1) room.ws.send(bytes);
    }

    function setupDataChannel(r, channel) {
      r.dc = channel;
      channel.binaryType = 'arraybuffer';
      channel.onopen = () => { if (room === r) updatePill(); };
      channel.onclose = () => { if (room === r) { r.dc = null; updatePill(); } };
      channel.onmessage = ev => {
        if (room !== r || !r.lockstep) return;
        r.lockstep.receive(ev.data);
      };
    }

    async function maybeUpgradeWebRTC(r, initiator) {
      if (typeof RTCPeerConnection !== 'function' || root.LITEGAME_DISABLE_WEBRTC) return;
      closeRTC(r);
      try {
        const pc = new RTCPeerConnection({ iceServers: Array.isArray(r.iceServers) ? r.iceServers : [] });
        r.pc = pc;
        pc.onicecandidate = ev => {
          if (room === r && ev.candidate) sendJSON({ type: 'rtc_signal', candidate: ev.candidate });
        };
        if (initiator) {
          setupDataChannel(r, pc.createDataChannel('litegame-lockstep', { ordered: true }));
          const offer = await pc.createOffer();
          if (room !== r) return;
          await pc.setLocalDescription(offer);
          sendJSON({ type: 'rtc_signal', description: pc.localDescription });
        } else {
          pc.ondatachannel = ev => { if (room === r) setupDataChannel(r, ev.channel); };
        }
      } catch (_) {
        closeRTC(r);
      }
    }

    async function handleRTCSignal(r, msg) {
      if (typeof RTCPeerConnection !== 'function' || root.LITEGAME_DISABLE_WEBRTC) return;
      try {
        if (msg.description) {
          if (msg.description.type === 'offer' && r.role === 2) {
            await maybeUpgradeWebRTC(r, false);
            if (!r.pc) return;
            await r.pc.setRemoteDescription(msg.description);
            const answer = await r.pc.createAnswer();
            await r.pc.setLocalDescription(answer);
            sendJSON({ type: 'rtc_signal', description: r.pc.localDescription });
          } else if (msg.description.type === 'answer' && r.role === 1 && r.pc) {
            await r.pc.setRemoteDescription(msg.description);
          }
        } else if (msg.candidate && r.pc) {
          await r.pc.addIceCandidate(msg.candidate);
        }
      } catch (_) { /* WebSocket binary relay remains active whenever WebRTC negotiation fails. */ }
    }

    function computedDelay() {
      const rtt = room?.rttMs;
      if (rtt == null || rtt < 45) return 2;
      if (rtt < 95) return 3;
      if (rtt < 150) return 4;
      return 5;
    }

    async function beginLockstep({ sessionId, delay, mode, payload }) {
      if (!room) return;
      let unpacked = null;
      if (mode === 'snapshot') unpacked = await unpackSnapshot(payload);
      room.sessionId = sessionId;
      room.lockstep = createLockstep({ role: room.role, sessionId, delay });
      room.playing = true;
      room.waitingSince = 0;
      closeModal();
      await adapter.onSessionStart?.({
        role: room.role,
        sessionId,
        delay,
        mode,
        snapshot: unpacked
      });
      updatePill();
      showToast(room.role === 1 ? '双人联机已启动 · 你控制 1P' : '双人联机已启动 · 你控制 2P');
    }

    async function hostStartSession(mode = 'reset') {
      if (!room || room.role !== 1 || !room.peerConnected) return;
      const game = adapter.getGame?.();
      if (!game?.romSha256) { setFeedback('请先载入游戏卡带', true); return; }
      try {
        busy = true;
        renderModal();
        const sessionId = ((room.sessionId || 0) + 1) & 0xff || 1;
        const delay = computedDelay();
        let payload = undefined;
        if (mode === 'snapshot') {
          const snap = adapter.exportSnapshot?.();
          if (!snap) throw new Error('当前没有可同步的游戏画面');
          payload = await packSnapshot(snap);
        }
        sendJSON({
          type: mode === 'snapshot' && room.sessionId > 0 ? 'sync_state' : 'start',
          session_id: sessionId,
          delay,
          mode,
          rom_sha256: game.romSha256,
          ...(payload ? { payload } : {})
        });
        await beginLockstep({ sessionId, delay, mode, payload });
      } catch (e) {
        setFeedback('启动联机失败：' + e.message, true);
      } finally {
        busy = false;
        if (!modal.hidden) renderModal();
      }
    }

    function sendGuestReady() {
      if (!room || room.role !== 2 || room.ws?.readyState !== 1) return;
      const game = adapter.getGame?.();
      if (!game?.romSha256) return;
      room.peerReady = true;
      sendJSON({ type: 'guest_ready', ready: true, rom_sha256: game.romSha256 });
    }

    function attachWebSocket(r) {
      clearInterval(pingTimer);
      const ws = new WebSocket(wsEndpoint(r.server, r.code, r.ticket));
      ws.binaryType = 'arraybuffer';
      r.ws = ws;

      ws.onopen = () => {
        if (room !== r) { ws.close(); return; }
        updatePill();
        renderModal();
        pingTimer = setInterval(() => {
          if (room === r && ws.readyState === 1) sendJSON({ type: 'ping', t: Math.round(performance.now()) });
        }, 2500);
      };

      ws.onmessage = async ev => {
        if (room !== r) return;
        if (typeof ev.data !== 'string') {
          if (r.lockstep) r.lockstep.receive(ev.data);
          return;
        }
        let msg;
        try { msg = JSON.parse(ev.data); } catch (_) { return; }
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'welcome') {
          r.peerConnected = !!msg.peer_connected;
          if (r.role === 2 && r.peerConnected) sendGuestReady();
          if (r.peerConnected) sendJSON({ type: 'ping', t: Math.round(performance.now()) });
          updatePill();
          renderModal();
        } else if (msg.type === 'peer_joined') {
          r.peerConnected = true;
          r.peerReady = false;
          showToast(r.role === 1 ? '2P 好友已进入房间！' : '已连上 1P 房主！');
          sendJSON({ type: 'ping', t: Math.round(performance.now()) });
          if (r.role === 1) maybeUpgradeWebRTC(r, true);
          else sendGuestReady();
          updatePill();
          renderModal();
        } else if (msg.type === 'peer_left') {
          r.peerConnected = false;
          r.peerReady = false;
          r.playing = false;
          closeRTC(r);
          adapter.onPeerLeft?.(r.role === 1 ? '2P 好友已断开连接，游戏已暂停（对方可重连）' : '1P 房主已离线，游戏已暂停');
          setFeedback(r.role === 1 ? '2P 已断开连接。可等待好友重新打开链接加入，连接后点击“从当前画面同步同玩”。' : '1P 房主已断开连接。', true);
          updatePill();
          renderModal();
        } else if (msg.type === 'room_closed') {
          disconnectRoom({ silentServer: true, clearURL: true, notice: '房主已结束双人房间，已返回单人模式。' });
        } else if (msg.type === 'guest_ready') {
          const game = adapter.getGame?.();
          if (game?.romSha256 && msg.rom_sha256 && msg.rom_sha256 !== game.romSha256) {
            setFeedback('2P 载入的卡带校验值不一致，无法同步开始', true);
            return;
          }
          r.peerConnected = true;
          r.peerReady = !!msg.ready;
          updatePill();
          renderModal();
        } else if (msg.type === 'start' || msg.type === 'sync_state') {
          if (r.role !== 2) return;
          try {
            const mode = msg.type === 'sync_state' ? 'snapshot' : (msg.mode === 'snapshot' ? 'snapshot' : 'reset');
            await beginLockstep({
              sessionId: Number(msg.session_id) || 1,
              delay: Number(msg.delay) || 2,
              mode,
              payload: msg.payload
            });
          } catch (e) {
            setFeedback('同步开局失败：' + e.message, true);
          }
        } else if (msg.type === 'pause') {
          if (r.sessionId && msg.session_id === r.sessionId) {
            r.playing = false;
            adapter.onRemotePause?.(msg.reason || ((r.role === 1 ? '2P' : '1P') + ' 已暂停游戏'));
            showToast((r.role === 1 ? '2P' : '1P') + ' 已暂停');
            if (!modal.hidden) renderModal();
          }
        } else if (msg.type === 'resume') {
          if (r.sessionId && msg.session_id === r.sessionId) {
            r.playing = true;
            adapter.onRemoteResume?.();
            showToast((r.role === 1 ? '2P' : '1P') + ' 继续了游戏');
            if (!modal.hidden) renderModal();
          }
        } else if (msg.type === 'quick_msg' && typeof msg.text === 'string') {
          const clean = msg.text.trim().slice(0, 24);
          if (clean) showToast((r.role === 1 ? '2P：' : '1P：') + clean);
        } else if (msg.type === 'ping' && typeof msg.t === 'number') {
          sendJSON({ type: 'pong', t: msg.t });
        } else if (msg.type === 'pong' && typeof msg.t === 'number') {
          const sample = Math.max(1, Math.round(performance.now() - msg.t));
          r.rttMs = r.rttMs == null ? sample : Math.round(r.rttMs * 0.65 + sample * 0.35);
          updatePill();
          if (!modal.hidden) renderModal();
        } else if (msg.type === 'rtc_signal') {
          await handleRTCSignal(r, msg);
        }
      };

      ws.onclose = () => {
        if (room !== r) return;
        clearInterval(pingTimer);
        closeRTC(r);
        r.playing = false;
        adapter.onPeerLeft?.('与游戏房间的连接已断开，游戏已暂停。');
        setFeedback('与服务器的房间连接已断开，请重新创建或加入房间。', true);
        updatePill();
        if (!modal.hidden) renderModal();
      };
    }

    function disconnectRoom({ silentServer = false, clearURL = true, notice = '已退出双人联机，当前为单人模式。' } = {}) {
      clearInterval(pingTimer);
      pingTimer = null;
      const prev = room;
      room = null;
      if (prev) {
        if (!silentServer && prev.role === 1 && prev.ws?.readyState === 1) {
          try { prev.ws.send(JSON.stringify({ type: 'close_room' })); } catch (_) {}
        }
        closeRTC(prev);
        try { prev.ws?.close(1000, 'leave'); } catch (_) {}
      }
      if (clearURL) clearRoomParamsFromURL();
      updatePill();
      adapter.onExitNetplay?.(notice);
      if (!modal.hidden) renderModal();
    }

    async function createRoom() {
      const game = adapter.getGame?.();
      if (!game?.id || !game?.romSha256) { setFeedback('请先选择并载入一款游戏卡带', true); return; }
      const session = root?.LiteSync?.session?.();
      if (!session || session.expired || !session.accessToken) {
        setFeedback('创建房间需先登录你的游戏服务器账号（受邀好友无需登录）', true);
        renderModal();
        return;
      }
      busy = true;
      setFeedback('正在创建双人房间…');
      renderModal();
      try {
        disconnectRoom({ clearURL: false, notice: '' });
        const created = await requestJSON(session.server, '/rooms', {
          method: 'POST',
          token: session.accessToken,
          body: {
            game_id: game.id,
            game_title: game.title,
            kind: game.kind || 'nes',
            rom_sha256: game.romSha256,
            url: game.url
          }
        });
        const code = normalizeRoomCode(created.room_code);
        if (!created.ticket) throw new Error('服务器未返回房间连接票据');
        rememberGuestServer(session.server);
        room = {
          code,
          role: 1,
          server: session.server,
          ticket: created.ticket,
          iceServers: created.ice_servers || [],
          ws: null,
          pc: null,
          dc: null,
          peerConnected: false,
          peerReady: false,
          rttMs: null,
          sessionId: 0,
          lockstep: null,
          playing: false,
          waitingSince: 0
        };
        attachWebSocket(room);
        setFeedback('房间已就绪！复制下方邀请链接发给好友，对方点开即可作为 2P 加入。');
        updatePill();
      } catch (e) {
        if (e.status === 401) root?.LiteSync?.markExpired?.();
        setFeedback('创建房间失败：' + e.message, true);
      } finally {
        busy = false;
        renderModal();
      }
    }

    async function joinRoom(rawCode, rawServer) {
      busy = true;
      setFeedback('正在连接好友房间…');
      renderModal();
      try {
        const code = normalizeRoomCode(rawCode);
        const server = normalizeServer(rawServer);
        rememberGuestServer(server);

        let currentGame = adapter.getGame?.();
        if (!currentGame?.id) {
          const info = await requestJSON(server, '/rooms/' + code);
          if (adapter.loadGameById && info.kind === 'nes' && info.game_id) {
            setFeedback('正在载入房间卡带《' + (info.game_title || info.game_id) + '》…');
            await adapter.loadGameById(info.game_id);
            currentGame = adapter.getGame?.();
          } else if (info.url) {
            const target = new URL(safeGameURL(info.url), homeURL);
            target.searchParams.set('server', server);
            target.searchParams.set('room', code);
            root.location.href = target.href;
            return;
          }
        }

        if (!currentGame?.id || !currentGame?.romSha256) throw new Error('未能载入房间对应的游戏卡带');

        disconnectRoom({ clearURL: false, notice: '' });
        let joined;
        try {
          joined = await requestJSON(server, '/rooms/' + code + '/join', {
            method: 'POST',
            body: { game_id: currentGame.id, rom_sha256: currentGame.romSha256 }
          });
        } catch (err) {
          if (err.code === 'game_mismatch' && adapter.loadGameById) {
            const info = await requestJSON(server, '/rooms/' + code);
            if (info.game_id && info.game_id !== currentGame.id) {
              setFeedback('正在切换到房主选择的《' + (info.game_title || info.game_id) + '》…');
              await adapter.loadGameById(info.game_id);
              currentGame = adapter.getGame?.();
              joined = await requestJSON(server, '/rooms/' + code + '/join', {
                method: 'POST',
                body: { game_id: currentGame.id, rom_sha256: currentGame.romSha256 }
              });
            } else throw err;
          } else throw err;
        }

        if (!joined.ticket) throw new Error('服务器未返回 2P 房间票据');
        room = {
          code,
          role: 2,
          server,
          ticket: joined.ticket,
          iceServers: joined.ice_servers || [],
          ws: null,
          pc: null,
          dc: null,
          peerConnected: true,
          peerReady: true,
          rttMs: null,
          sessionId: 0,
          lockstep: null,
          playing: false,
          waitingSince: 0
        };
        attachWebSocket(room);
        setFeedback('已加入房间！等待 1P 房主开始游戏；你的方向键与 A/B 键已自动映射为 2P。');
        updatePill();
      } catch (e) {
        if (e.status === 404) clearRoomParamsFromURL();
        setFeedback('加入房间失败：' + e.message, true);
      } finally {
        busy = false;
        renderModal();
      }
    }

    function esc(text) {
      return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderModal() {
      mountUI();
      const body = modal.querySelector('#lg-netplay-body');
      const title = modal.querySelector('#lg-netplay-title');
      const sub = modal.querySelector('#lg-netplay-sub');
      const tag = modal.querySelector('#lg-netplay-tag');
      const game = adapter.getGame?.();
      const hallOnly = !!adapter.hallMode;

      if (room) {
        tag.textContent = room.role === 1 ? 'ROOM · 1P 房主' : 'ROOM · 2P 玩家二';
        title.textContent = (game?.title ? game.title + ' · ' : '') + '双人房间 ' + formatRoomCode(room.code);
        sub.textContent = room.role === 1
          ? '你控制 1P 角色。好友点开邀请链接无需登录即可作为 2P 加入同一局。'
          : '你已作为 2P 加入！直接使用你习惯的方向盘 / 键盘方向键与 A、B 操作 2P 角色。';

        const link = inviteLink();
        const p2Ready = room.role === 1 ? (room.peerConnected && room.peerReady) : true;
        const rttText = room.rttMs != null ? (' · 延迟 ' + room.rttMs + 'ms') : '';
        const canSyncSnap = room.role === 1 && room.peerConnected && adapter.canSyncCurrent?.();

        body.innerHTML =
          '<div class="lg-netplay-card">' +
            '<div class="lg-netplay-code-wrap">' +
              '<div><span class="lg-netplay-code-label">6 位房间号</span><span class="lg-netplay-code" id="lg-netplay-code" data-allow-select>' + esc(formatRoomCode(room.code)) + '</span></div>' +
              '<div class="lg-netplay-actions" style="margin-top:0">' +
                '<button type="button" class="lg-netplay-btn lg-netplay-btn-primary" id="np-copy-link">复制邀请链接</button>' +
                '<button type="button" class="lg-netplay-btn" id="np-copy-code">复制房间号</button>' +
              '</div>' +
            '</div>' +
            '<p class="lg-netplay-link-preview" id="lg-netplay-link" data-allow-select>' + esc(link) + '</p>' +
          '</div>' +
          '<div class="lg-netplay-seats">' +
            '<div class="lg-netplay-seat is-ready">' +
              '<strong>1P 房主' + (room.role === 1 ? '（你）' : '') + '</strong>' +
              '<span>' + (room.role === 1 || room.peerConnected ? '在线 · 已就绪' : '连接中…') + '</span>' +
            '</div>' +
            '<div class="lg-netplay-seat ' + (room.peerConnected ? 'is-ready' : '') + '">' +
              '<strong>2P 玩家二' + (room.role === 2 ? '（你）' : '') + '</strong>' +
              '<span id="np-seat-p2">' + (room.peerConnected ? ('已连接' + esc(rttText) + (p2Ready ? ' · 已就绪' : ' · 正在读取卡带…')) : '等待好友加入…') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="lg-netplay-actions">' +
            (room.role === 1
              ? '<button type="button" class="lg-netplay-btn lg-netplay-btn-primary" id="np-start-reset" ' + (busy || !p2Ready ? 'disabled' : '') + '>' +
                  (room.sessionId > 0 ? '重新双人开机' : '开始双人游戏') +
                '</button>' +
                (canSyncSnap
                  ? '<button type="button" class="lg-netplay-btn" id="np-start-snap" ' + (busy ? 'disabled' : '') + '>从当前画面同步同玩</button>'
                  : '')
              : '<button type="button" class="lg-netplay-btn lg-netplay-btn-primary" id="np-guest-audio">准备就绪（开启声音）</button>') +
            (room.sessionId > 0 && room.peerConnected
              ? '<button type="button" class="lg-netplay-btn" id="np-resume-close">返回游戏画面</button>'
              : '') +
            '<button type="button" class="lg-netplay-btn lg-netplay-btn-danger" id="np-leave">断开联机</button>' +
          '</div>' +
          (room.peerConnected
            ? '<div class="lg-netplay-quick" aria-label="快捷互动消息">' +
                QUICK_PHRASES.map(p => '<button type="button" data-np-phrase="' + esc(p) + '">' + esc(p) + '</button>').join('') +
              '</div>'
            : '');

        body.querySelector('#np-copy-link').onclick = async () => {
          const ok = await copyText(link);
          setFeedback(ok ? '已复制邀请链接！发给好友点开即可直接进入房间。' : '浏览器限制自动复制，请长按上方链接手动复制。', !ok);
        };
        body.querySelector('#np-copy-code').onclick = async () => {
          const ok = await copyText(room.code);
          setFeedback(ok ? ('已复制房间号 ' + room.code) : '请手动复制上方 6 位数字房间号。', !ok);
        };
        const startResetBtn = body.querySelector('#np-start-reset');
        if (startResetBtn) startResetBtn.onclick = () => hostStartSession('reset');
        const startSnapBtn = body.querySelector('#np-start-snap');
        if (startSnapBtn) startSnapBtn.onclick = () => hostStartSession('snapshot');
        const guestAudioBtn = body.querySelector('#np-guest-audio');
        if (guestAudioBtn) guestAudioBtn.onclick = async () => {
          await adapter.onUnlockAudio?.();
          sendGuestReady();
          setFeedback('已就绪并开启声音！等待 1P 房主点击开始。');
        };
        const resumeClose = body.querySelector('#np-resume-close');
        if (resumeClose) resumeClose.onclick = () => closeModal();
        body.querySelector('#np-leave').onclick = () => disconnectRoom();
        body.querySelectorAll('[data-np-phrase]').forEach(btn => {
          btn.onclick = () => {
            const phrase = btn.dataset.npPhrase;
            sendJSON({ type: 'quick_msg', text: phrase });
            showToast('我：' + phrase);
          };
        });
        setFeedback(feedback.text, feedback.error);
        return;
      }

      // Not in a room yet: Host vs Join view.
      tag.textContent = 'NETPLAY · 双人联机';
      title.textContent = hallOnly ? '加入好友双人房间' : ((game?.title ? game.title + ' · ' : '') + '双人联机');
      sub.textContent = hallOnly
        ? '输入好友分享的 6 位数字房间号，无需登录即可直接进入对应游戏与好友同玩。'
        : '1P 创建房间生成邀请链接，2P 点开链接或输入 6 位房间号即可异地同屏双打。';

      const activeTab = hallOnly || !game?.id ? 'join' : tab;
      const session = root?.LiteSync?.session?.();
      const connectedOk = !!(session && !session.expired && session.accessToken);
      const defaultServer = pendingAutoJoin?.server || savedGuestServer();
      const defaultCode = pendingAutoJoin?.code || '';

      body.innerHTML =
        (!hallOnly && game?.id
          ? '<div class="lg-netplay-tabs" role="tablist">' +
              '<button type="button" role="tab" class="lg-netplay-tab" id="np-tab-host" aria-selected="' + (activeTab === 'host') + '">我是 1P · 创建房间</button>' +
              '<button type="button" role="tab" class="lg-netplay-tab" id="np-tab-join" aria-selected="' + (activeTab === 'join') + '">我是 2P · 加入房间</button>' +
            '</div>'
          : '') +
        (activeTab === 'host'
          ? '<div class="lg-netplay-card">' +
              (connectedOk
                ? '<p style="margin:0 0 10px;color:#d6f5e3">已连接游戏服务器：<strong>' + esc(session.username) + '</strong><br><small style="color:#b7b3c9">' + esc(session.server) + '</small></p>' +
                  '<div class="lg-netplay-actions">' +
                    '<button type="button" class="lg-netplay-btn lg-netplay-btn-primary" id="np-create" ' + (busy ? 'disabled' : '') + '>创建房间并获取邀请链接</button>' +
                  '</div>'
                : '<p style="margin:0 0 10px">创建房间需先连接你的 <strong>LiteGameServer</strong> 账号（受邀加入的 2P 好友<strong>无需账号</strong>，点开链接直接同玩）。</p>' +
                  '<div class="lg-netplay-actions">' +
                    '<a class="lg-netplay-btn lg-netplay-btn-primary" id="np-go-server" href="' + esc(homeURL.href + '#server') + '">前往连接游戏服务器</a>' +
                  '</div>') +
            '</div>'
          : '<form class="lg-netplay-card" id="np-join-form">' +
              '<label class="lg-netplay-field"><span>6 位数字房间号</span>' +
                '<input id="np-room-code" inputmode="numeric" pattern="[0-9\\s-]*" maxlength="7" placeholder="例如 482910" autocomplete="off" value="' + esc(defaultCode) + '" required>' +
              '</label>' +
              '<label class="lg-netplay-field"><span>好友所在服务器地址</span>' +
                '<input id="np-server-url" type="url" placeholder="https://save.example.com" autocomplete="url" value="' + esc(defaultServer) + '" required>' +
              '</label>' +
              '<div class="lg-netplay-actions">' +
                '<button type="submit" class="lg-netplay-btn lg-netplay-btn-primary" id="np-join-submit" ' + (busy ? 'disabled' : '') + '>加入双人房间</button>' +
              '</div>' +
            '</form>');

      const tabHost = body.querySelector('#np-tab-host');
      const tabJoin = body.querySelector('#np-tab-join');
      if (tabHost) tabHost.onclick = () => { tab = 'host'; setFeedback(''); renderModal(); };
      if (tabJoin) tabJoin.onclick = () => { tab = 'join'; setFeedback(''); renderModal(); };
      const createBtn = body.querySelector('#np-create');
      if (createBtn) createBtn.onclick = () => createRoom();
      const joinForm = body.querySelector('#np-join-form');
      if (joinForm) {
        joinForm.onsubmit = ev => {
          ev.preventDefault();
          const codeVal = body.querySelector('#np-room-code').value;
          const serverVal = body.querySelector('#np-server-url').value;
          joinRoom(codeVal, serverVal);
        };
      }
      setFeedback(feedback.text, feedback.error);
    }

    function openModal(preferredTab) {
      if (preferredTab) tab = preferredTab;
      adapter.onOpenModal?.();
      lastFocus = doc.activeElement;
      mountUI();
      modal.hidden = false;
      renderModal();
      modal.querySelector('#lg-netplay-close')?.focus({ preventScroll: true });
    }

    function closeModal() {
      if (modal.hidden) return;
      modal.hidden = true;
      if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
    }

    modal.addEventListener('click', ev => {
      if (ev.target.closest('[data-np-close]')) closeModal();
    });

    pill.addEventListener('click', () => openModal());

    doc.addEventListener('keydown', ev => {
      if (modal.hidden) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        ev.stopPropagation();
        closeModal();
      } else if (ev.key === 'Tab') {
        const nodes = [...modal.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')]
          .filter(n => !n.disabled && n.getClientRects().length);
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (ev.shiftKey && (doc.activeElement === first || !modal.contains(doc.activeElement))) {
          ev.preventDefault();
          last.focus();
        } else if (!ev.shiftKey && (doc.activeElement === last || !modal.contains(doc.activeElement))) {
          ev.preventDefault();
          first.focus();
        }
      }
    }, true);

    return {
      open: openModal,
      close: closeModal,
      isOpen: () => !modal.hidden,
      active: () => !!(room && room.sessionId > 0 && room.lockstep),
      inRoom: () => !!room,
      role: () => room?.role || 0,
      roomCode: () => room?.code || '',
      frame: () => room?.lockstep?.frame() ?? -1,
      transport: () => room?.dc?.readyState === 'open' ? 'webrtc' : (room?.ws?.readyState === 1 ? 'ws' : 'none'),
      refreshMount: mountUI,
      async onGameLoaded() {
        updatePill();
        if (pendingAutoJoin) {
          const { code, server } = pendingAutoJoin;
          pendingAutoJoin = null;
          openModal('join');
          if (code && server) await joinRoom(code, server);
          else setFeedback('已填入房间号，请确认服务器地址后点击“加入双人房间”。');
        } else if (room?.role === 2) {
          sendGuestReady();
        }
      },
      stepFrame(sampleLocalMaskFn) {
        if (!room?.lockstep) return { ready: false };
        room.lockstep.produceLocal(sampleLocalMaskFn, sendBinary);
        const step = room.lockstep.consumeFrame();
        if (!step) {
          if (!room.waitingSince) room.waitingSince = performance.now();
          return { ready: false, stalledMs: performance.now() - room.waitingSince };
        }
        room.waitingSince = 0;
        return {
          ready: true,
          ...step,
          catchUp: room.lockstep.lagAhead() >= 2 && room.lockstep.canStep()
        };
      },
      notifyLocalPause(reason) {
        if (!room || !room.sessionId || !room.playing) return;
        room.playing = false;
        sendJSON({ type: 'pause', session_id: room.sessionId, frame: room.lockstep?.frame() || 0, reason: reason || '已暂停' });
      },
      notifyLocalResume() {
        if (!room || !room.sessionId || room.playing || !room.peerConnected) return;
        room.playing = true;
        sendJSON({ type: 'resume', session_id: room.sessionId, frame: room.lockstep?.frame() || 0 });
      },
      async syncFromHost(mode = 'snapshot') {
        if (room?.role === 1 && room.peerConnected) await hostStartSession(mode);
      },
      disconnect: disconnectRoom
    };
  }

  return {
    encodeInputFrame,
    decodeInputFrame,
    createLockstep,
    normalizeRoomCode,
    normalizeServer,
    packSnapshot,
    unpackSnapshot,
    createController
  };
});
