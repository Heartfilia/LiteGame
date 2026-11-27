/* LiteRoom：通用双人房间客户端
 * 复用 LiteGameServer 的 /api/v1/rooms（Netplay v1）房间与 WebSocket 中继，
 * 面向回合制／抢答类小游戏：房主建房并持有权威状态，客人免账号加入。
 * 不改动服务端协议，只使用现有字段：kind = "board"。
 */
(function (root) {
  'use strict';
  if (root.LiteRoom) return;

  const STORAGE_SERVER = 'lgRoom.v1.server';
  const CODE_RE = /^[0-9]{6}$/;
  // 服务器错误码的中文说法，避免把英文提示直接甩给玩家。
  const ERROR_TEXT = {
    room_not_found: '房间不存在或已过期',
    room_full: '房间已满，换个房间或自己建房',
    game_mismatch: '这个房间在玩别的游戏',
    room_closed: '房间已关闭',
    server_busy: '服务器房间已满，请稍后再试',
    rate_limited: '操作太频繁，请稍等一下'
  };
  const PING_MS = 20000;

  const doc = root.document;

  function normalizeCode(value) {
    return String(value || '').replace(/[^0-9]/g, '').slice(0, 6);
  }

  function normalizeServer(value) {
    let text = String(value || '').trim();
    if (!text) throw new Error('请填写游戏服务器地址');
    if (!/^https?:\/\//i.test(text)) text = 'https://' + text;
    let url;
    try { url = new URL(text); } catch (_) { throw new Error('服务器地址格式不正确'); }
    if (!/^https?:$/.test(url.protocol)) throw new Error('服务器地址必须以 http:// 或 https:// 开头');
    url.hash = '';
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '');
    return url.href.replace(/\/$/, '');
  }

  function savedServer() {
    try {
      const session = root.LiteSync?.session?.();
      if (session?.server) return session.server;
      return root.localStorage.getItem(STORAGE_SERVER) || '';
    } catch (_) { return ''; }
  }

  function rememberServer(server) {
    try { root.localStorage.setItem(STORAGE_SERVER, server); } catch (_) {}
  }

  function sessionInfo() {
    try {
      const session = root.LiteSync?.session?.();
      if (!session || session.expired || !session.accessToken) return null;
      return session;
    } catch (_) { return null; }
  }

  async function requestJSON(server, path, { method = 'GET', token = null, body, timeout = 12000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    let response;
    try {
      response = await fetch(server + '/api/v1' + path, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: 'Bearer ' + token } : {})
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      throw new Error(error.name === 'AbortError'
        ? '服务器响应超时，请检查地址与网络'
        : '无法连接服务器：地址不可达、HTTPS 证书无效，或服务器未启动');
    } finally {
      clearTimeout(timer);
    }
    let payload = null;
    try { payload = await response.json(); } catch (_) { payload = null; }
    if (!response.ok) {
      const code = payload?.error?.code || payload?.detail?.code;
      const detail = payload?.error?.message || payload?.detail?.message || payload?.detail || payload?.message;
      const error = new Error(ERROR_TEXT[code] || (typeof detail === 'string' ? detail : '服务器返回 ' + response.status));
      error.status = response.status;
      error.code = code;
      throw error;
    }
    return payload;
  }

  function wsEndpoint(server, code, ticket) {
    const url = new URL(server);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/api/v1/rooms/' + encodeURIComponent(code) + '/ws';
    url.search = '?ticket=' + encodeURIComponent(ticket);
    return url.href;
  }

  function formatCode(code) {
    return code && code.length === 6 ? code.slice(0, 3) + ' ' + code.slice(3) : String(code || '');
  }

  function inviteURL(code, server) {
    const url = new URL(root.location.href);
    url.hash = '';
    url.searchParams.set('room', code);
    url.searchParams.set('server', server);
    return url.href;
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      try {
        const area = doc.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        doc.body.append(area);
        area.select();
        const ok = doc.execCommand('copy');
        area.remove();
        return ok;
      } catch (_) { return false; }
    }
  }

  function open(options) {
    const cfg = Object.assign({
      gameId: 'idiom-chain',
      gameTitle: '成语接龙',
      kind: 'board',
      url: 'games/idiom-chain/index.html',
      onState: () => {},
      onPeer: () => {},
      onGuestReady: () => {},
      onMessage: () => {},
      onClosed: () => {},
      onExit: () => {},
      mount: () => doc.body,
      maxPlayers: 2,
      tint: '#e8c07d'
    }, options || {});

    let room = null;
    const listeners = { message: [], peer: [], closed: [] };
    function emit(event, ...args) {
      (listeners[event] || []).forEach((fn) => { try { fn(...args); } catch (_) {} });
    }
    let busy = false;
    let pingTimer = null;
    let status = { text: '', error: false };

    const modal = doc.createElement('div');
    modal.className = 'lgrow-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="lgrow-backdrop" data-lgrow-close></div>
      <div class="lgrow-panel" role="dialog" aria-modal="true" aria-labelledby="lgrow-title">
        <div class="lgrow-top">
          <span class="lgrow-tag">双人联机</span>
          <button type="button" class="lgrow-x" data-lgrow-close aria-label="关闭">关闭</button>
        </div>
        <h2 class="lgrow-title" id="lgrow-title">${cfg.gameTitle} · 双人房</h2>
        <div class="lgrow-tabs">
          <button type="button" data-lgrow-tab="host">我建房</button>
          <button type="button" data-lgrow-tab="join">输入房间号</button>
        </div>
        <div class="lgrow-body"></div>
        <p class="lgrow-status" role="status" aria-live="polite" hidden></p>
      </div>`;
    (cfg.mount() || doc.body).append(modal);

    const body = modal.querySelector('.lgrow-body');
    const statusEl = modal.querySelector('.lgrow-status');

    function setStatus(text, error = false) {
      status = { text, error };
      statusEl.hidden = !text;
      statusEl.textContent = text;
      statusEl.classList.toggle('is-error', !!error);
    }

    function render() {
      if (room) {
        const server = room.server;
        const link = inviteURL(room.code, server);
        body.innerHTML = `
          <p class="lgrow-lead">房间号</p>
          <p class="lgrow-code">${formatCode(room.code)}</p>
          <p class="lgrow-hint">把下面的链接发给好友，对方点开就能直接加入；也可以让好友在游戏里输入房间号。</p>
          <div class="lgrow-link"><input readonly value="${link}" aria-label="邀请链接"><button type="button" data-lgrow-copy>复制</button></div>
          <p class="lgrow-state"><span class="lgrow-dot" data-state="${room.peerConnected ? 'on' : 'off'}"></span>${room.peerConnected ? '好友已加入，正在对局' : '等待好友加入…'}</p>
          <div class="lgrow-actions"><button type="button" class="lgrow-secondary" data-lgrow-leave>解散房间</button></div>`;
        return;
      }
      body.innerHTML = `
        <div class="lgrow-tab-body" data-panel="host">
          <p class="lgrow-hint">建房需要先在游戏厅「设置 → 载入服务器」登录账号；受邀的好友无需登录。</p>
          <p class="lgrow-hint" data-lgrow-account></p>
          <div class="lgrow-actions"><button type="button" data-lgrow-create>创建房间</button></div>
        </div>
        <div class="lgrow-tab-body" data-panel="join" hidden>
          <label class="lgrow-field"><span>服务器</span><input data-lgrow-server inputmode="url" placeholder="https://game.example.com" value="${savedServer()}"></label>
          <label class="lgrow-field"><span>房间号</span><input data-lgrow-code inputmode="numeric" maxlength="6" placeholder="6 位数字" value="${pendingCode}"></label>
          <div class="lgrow-actions"><button type="button" data-lgrow-join>加入房间</button></div>
        </div>`;
      const account = body.querySelector('[data-lgrow-account]');
      const session = sessionInfo();
      account.textContent = session ? '当前账号：' + (session.username || '已登录') + '（' + session.server + '）' : '当前未登录，只能作为 2P 加入别人的房间。';
    }

    let pendingCode = '';

    function showPanel(tab) {
      modal.hidden = false;
      render();
      if (tab === 'join') {
        const joinTab = modal.querySelector('[data-lgrow-tab="join"]');
        if (joinTab) joinTab.click();
      }
      setStatus('');
    }

    function hidePanel() {
      modal.hidden = true;
    }

    function closeSocket() {
      clearInterval(pingTimer);
      pingTimer = null;
      if (room?.ws) {
        try {
          if (room.role === 1 && room.ws.readyState === 1) room.ws.send(JSON.stringify({ type: 'close_room' }));
        } catch (_) {}
        try { room.ws.close(1000, 'leave'); } catch (_) {}
      }
      if (room) room.ws = null;
    }

    function detach(reason) {
      const previous = room;
      closeSocket();
      room = null;
      if (previous) cfg.onClosed(reason || 'closed');
      render();
    }

    function attach() {
      const ws = new WebSocket(wsEndpoint(room.server, room.code, room.ticket));
      room.ws = ws;
      ws.onopen = () => {
        emit('ready');
        setStatus('已连接房间 ' + formatCode(room.code) + '，等好友进来就可以开始。');
        pingTimer = setInterval(() => {
          if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'ping', t: Date.now() }));
        }, PING_MS);
      };
      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        let msg;
        try { msg = JSON.parse(event.data); } catch (_) { return; }
        if (!msg || typeof msg.type !== 'string') return;
        switch (msg.type) {
          case 'welcome':
            room.seat = msg.seat || room.role;
            room.role = room.seat;
            room.maxPlayers = msg.max_players || room.maxPlayers;
            room.peers = new Set(Array.isArray(msg.roles) && msg.roles.length ? msg.roles : [room.seat]);
            room.peerConnected = !!msg.peer_connected;
            if (room.role !== 1 && room.peerConnected) {
              // 客人到场后主动报到，房主据此开局。
              ws.send(JSON.stringify({ type: 'ready' }));
            }
            cfg.onPeer(room.peerConnected);
            emit('peer', room.peerConnected, room.seat);
            render();
            break;
          case 'peer_joined':
            if (msg.seat || msg.role) room.peers.add(msg.seat || msg.role);
            room.peerConnected = room.peers.size > 1;
            cfg.onPeer(true);
            emit('peer', true, msg.seat || msg.role);
            if (room.role !== 1) ws.send(JSON.stringify({ type: 'ready' }));
            render();
            break;
          case 'peer_left':
            room.peers.delete(msg.seat || msg.role);
            room.peerConnected = room.peers.size > 1;
            cfg.onPeer(room.peerConnected);
            emit('peer', false, msg.seat || msg.role);
            if (!room.peerConnected) setStatus('好友已离开房间。', true);
            render();
            break;
          case 'room_closed':
            emit('closed', msg.reason || 'closed');
            setStatus(msg.reason === 'host_closed' ? '房主已解散房间。' : '房间已关闭：' + (msg.reason || ''), true);
            room = null;
            closeSocket();
            cfg.onClosed(msg.reason || 'closed');
            render();
            break;
          case 'pong':
            break;
          default:
            emit('message', msg, room.seat);
            cfg.onMessage(msg);
        }
      };
      ws.onclose = () => {
        if (!room) return;
        clearInterval(pingTimer);
        pingTimer = null;
        setStatus('与服务器的连接已断开，请刷新页面重试。', true);
      };
    }

    async function create(opts = {}) {
      if (busy) return;
      const session = sessionInfo();
      if (!session) {
        setStatus('创建房间需要先在游戏厅登录服务器账号；也可以让好友建房，你输入房间号加入。', true);
        return;
      }
      busy = true;
      setStatus('正在创建房间…');
      try {
        detach('replaced');
        const created = await requestJSON(session.server, '/rooms', {
          method: 'POST',
          token: session.accessToken,
          body: {
            game_id: cfg.gameId,
            game_title: cfg.gameTitle,
            kind: cfg.kind,
            url: cfg.url,
            max_players: opts.maxPlayers || cfg.maxPlayers
          }
        });
        rememberServer(session.server);
        room = {
          code: normalizeCode(created.room_code),
          role: 1,
          seat: 1,
          maxPlayers: created.max_players || cfg.maxPlayers,
          peers: new Set([1]),
          server: session.server,
          ticket: created.ticket,
          peerConnected: false
        };
        attach();
        render();
        setStatus('房间已创建，把邀请链接发给好友吧。');
      } catch (error) {
        if (error.status === 401) root.LiteSync?.markExpired?.();
        setStatus('创建房间失败：' + error.message, true);
      } finally {
        busy = false;
      }
    }

    async function join(rawCode, rawServer) {
      if (busy) return;
      const code = normalizeCode(rawCode);
      if (!CODE_RE.test(code)) { setStatus('请输入 6 位数字房间号', true); return; }
      let server;
      try { server = normalizeServer(rawServer); } catch (error) { setStatus(error.message, true); return; }
      busy = true;
      setStatus('正在加入房间…');
      try {
        detach('replaced');
        const info = await requestJSON(server, '/rooms/' + code);
        if (info.game_id && info.game_id !== cfg.gameId) {
          throw new Error('这个房间在玩《' + (info.game_title || info.game_id) + '》，不是当前游戏');
        }
        const joined = await requestJSON(server, '/rooms/' + code + '/join', {
          method: 'POST',
          body: { game_id: cfg.gameId }
        });
        rememberServer(server);
        room = {
          code,
          role: joined.seat || 2,
          seat: joined.seat || 2,
          maxPlayers: joined.max_players || 2,
          peers: new Set([1]),
          server,
          ticket: joined.ticket,
          peerConnected: !!info.host_connected
        };
        attach();
        render();
        setStatus('已加入房间，等待房主开始…');
      } catch (error) {
        setStatus('加入失败：' + error.message, true);
      } finally {
        busy = false;
      }
    }

    function leave() {
      const wasHost = room?.role === 1;
      detach('left');
      setStatus(wasHost ? '房间已解散。' : '已离开房间。');
      cfg.onExit();
    }

    modal.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-lgrow-close],[data-lgrow-tab],[data-lgrow-create],[data-lgrow-join],[data-lgrow-copy],[data-lgrow-leave]');
      if (!target) return;
      if (target.hasAttribute('data-lgrow-close')) {
        hidePanel();
        return;
      }
      if (target.hasAttribute('data-lgrow-tab')) {
        const name = target.getAttribute('data-lgrow-tab');
        modal.querySelectorAll('[data-lgrow-tab]').forEach((node) => node.classList.toggle('is-on', node === target));
        modal.querySelectorAll('[data-panel]').forEach((node) => { node.hidden = node.getAttribute('data-panel') !== name; });
        return;
      }
      if (target.hasAttribute('data-lgrow-create')) { await create(); return; }
      if (target.hasAttribute('data-lgrow-join')) {
        const code = modal.querySelector('[data-lgrow-code]').value;
        const server = modal.querySelector('[data-lgrow-server]').value;
        await join(code, server);
        return;
      }
      if (target.hasAttribute('data-lgrow-copy')) {
        const ok = await copyText(inviteURL(room.code, room.server));
        setStatus(ok ? '邀请链接已复制' : '复制失败，请手动选中链接复制', !ok);
        return;
      }
      if (target.hasAttribute('data-lgrow-leave')) { leave(); }
    });

    modal.querySelectorAll('[data-lgrow-tab]')[0].classList.add('is-on');

    return {
      show: showPanel,
      hide: hidePanel,
      create,
      join,
      leave,
      isHost: () => room?.role === 1,
      connected: () => !!room?.peerConnected,
      send(payload) {
        if (room?.ws?.readyState === 1) room.ws.send(JSON.stringify(payload));
      },
      on(event, fn) { (listeners[event] ||= []).push(fn); return this; },
      roomInfo: () => room ? {
        code: room.code, role: room.role, seat: room.seat,
        maxPlayers: room.maxPlayers, players: [...(room.peers || [])], server: room.server
      } : null,
      /** 自动处理邀请链接里的 ?room= & ?server= */
      autoJoinFromURL() {
        const params = new URLSearchParams(root.location.search);
        const code = normalizeCode(params.get('room'));
        if (!code) return false;
        const server = params.get('server') || savedServer();
        pendingCode = code;
        const url = new URL(root.location.href);
        url.searchParams.delete('room');
        url.searchParams.delete('server');
        root.history.replaceState(null, '', url.pathname + url.search + url.hash);
        showPanel('join');
        if (server) join(code, server);
        else setStatus('请输入游戏服务器地址后加入房间', true);
        return true;
      }
    };
  }

  root.LiteRoom = { open, normalizeCode, normalizeServer, formatCode, inviteURL };
})(typeof window !== 'undefined' ? window : globalThis);