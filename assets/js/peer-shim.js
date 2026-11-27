/* peer-shim.js — 用 LiteGameServer 的房间中继替代 PeerJS
 *
 * 授权移植的联机小游戏调用 window.Peer（PeerJS）。这里提供同名兼容层：
 *   - 房主 new Peer(前缀 + 房号) → 在我们的服务器建房，界面上的房号同步成真实房号
 *   - 客人 peer.connect(前缀 + 房号) → 加入同一个房间
 *   - DataConnection 的 send / on('data') 映射成 WebSocket 消息，由服务端转发
 *
 * 没有 WebRTC、不需要 TURN。房主需要已登录游戏厅账号（站内其他联机游戏同样如此），
 * 客人免账号。
 */
(function (root) {
  'use strict';

  const PREFIX_RE = /^[A-Za-z]+-/;

  function serverUrl() {
    try {
      const session = root.LiteSync?.session?.();
      if (session?.server) return session.server;
      const saved = localStorage.getItem('lgRoom.v1.server');
      if (saved) return saved;
    } catch (_) {}
    try {
      const param = new URLSearchParams(location.search).get('server');
      if (param) return param;
    } catch (_) {}
    // 同域反向代理（/api）时可以直接用当前站点
    return location.origin;
  }

  function injectStyle() {
    if (document.getElementById('psh-style')) return;
    const style = document.createElement('style');
    style.id = 'psh-style';
    style.textContent =
      '.psh-mask{position:fixed;inset:0;z-index:9600;display:grid;place-items:center;background:rgba(8,8,10,.74);padding:16px;font:14px/1.5 -apple-system,"PingFang SC",system-ui,sans-serif;color:#f2ece0}' +
      '.psh-card{width:min(360px,100%);padding:20px;border-radius:16px;background:#17161a;border:1px solid rgba(217,176,106,.34)}' +
      '.psh-card h3{margin:0 0 8px;font-size:17px}.psh-card p{margin:0 0 12px;font-size:12.5px;color:#a9a29a}' +
      '.psh-card label{display:block;margin-bottom:10px;font-size:12px;color:#a9a29a}' +
      '.psh-card input{width:100%;box-sizing:border-box;margin-top:4px;padding:10px;border-radius:9px;border:1px solid rgba(255,255,255,.16);background:#0d0c10;color:#f2ece0}' +
      '.psh-acts{display:flex;gap:8px;margin-top:4px}' +
      '.psh-acts button{flex:1;padding:11px;border-radius:10px;border:0;background:linear-gradient(180deg,#e2bd7d,#c99a52);color:#1a1408;font-weight:600;cursor:pointer}' +
      '.psh-acts button.ghost{background:transparent;color:#c9bfa9;border:1px solid rgba(255,255,255,.18);font-weight:400}' +
      '.psh-msg{min-height:16px;color:#e8a0a0;font-size:12px;margin:8px 0 0}' +
      '.psh-badge{position:fixed;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9500;display:flex;gap:8px;align-items:center;padding:8px 12px;border-radius:999px;background:rgba(20,18,15,.94);border:1px solid rgba(217,176,106,.45);color:#f0e4cc;font:12px/1 -apple-system,"PingFang SC",system-ui,sans-serif}' +
      '.psh-badge b{font-size:15px;letter-spacing:.12em;color:#ffd9a0}' +
      '.psh-badge button{border:0;border-radius:999px;padding:6px 10px;background:#e2bd7d;color:#1a1408;font-weight:600}';
    document.head.append(style);
  }

  function askLogin(done) {
    injectStyle();
    const mask = document.createElement('div');
    mask.className = 'psh-mask';
    mask.innerHTML =
      '<div class="psh-card"><h3>建房需要登录游戏厅账号</h3>' +
      '<p>好友加入不用账号；也可以让好友建房，你输房号加入。</p>' +
      '<label>服务器<input data-psh="server" placeholder="https://game.example.com"></label>' +
      '<label>用户名<input data-psh="user" autocomplete="username"></label>' +
      '<label>密码<input data-psh="pass" type="password" autocomplete="current-password"></label>' +
      '<div class="psh-acts"><button data-psh="ok" type="button">登录并建房</button>' +
      '<button data-psh="cancel" type="button" class="ghost">取消</button></div>' +
      '<p class="psh-msg" data-psh="msg"></p></div>';
    document.body.append(mask);
    mask.querySelector('[data-psh="server"]').value = serverUrl();
    const msg = mask.querySelector('[data-psh="msg"]');
    mask.querySelector('[data-psh="cancel"]').onclick = () => { mask.remove(); done(new Error('cancelled')); };
    mask.querySelector('[data-psh="ok"]').onclick = async () => {
      const server = mask.querySelector('[data-psh="server"]').value.trim();
      const username = mask.querySelector('[data-psh="user"]').value.trim();
      const password = mask.querySelector('[data-psh="pass"]').value;
      msg.textContent = '登录中…';
      try {
        if (!root.LiteSync) throw new Error('页面缺少同步模块');
        await root.LiteSync.connect({ server, username, password, importLocal: false });
        mask.remove();
        done(null);
      } catch (error) {
        msg.textContent = '登录失败：' + (error.message || error);
      }
    };
  }

  function showBadge(code) {
    injectStyle();
    let node = document.getElementById('psh-badge');
    if (!node) {
      node = document.createElement('div');
      node.id = 'psh-badge';
      node.className = 'psh-badge';
      document.body.append(node);
    }
    node.innerHTML = '房间号 <b></b><button type="button">复制</button>';
    node.querySelector('b').textContent = code.slice(0, 3) + ' ' + code.slice(3);
    node.querySelector('button').onclick = () => {
      try { navigator.clipboard?.writeText(code); } catch (_) {}
    };
  }

  /** 游戏界面里显示的还是它自己生成的房号，替换成真实房号 */
  function syncCode(oldCode, newCode) {
    if (!oldCode || oldCode === newCode) return;
    const swap = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        if (node.nodeValue && node.nodeValue.includes(oldCode)) {
          node.nodeValue = node.nodeValue.split(oldCode).join(newCode);
        }
      }
      document.querySelectorAll('input').forEach((input) => {
        if (input.value && input.value.includes(oldCode)) input.value = input.value.split(oldCode).join(newCode);
      });
    };
    swap();
    const timer = setInterval(swap, 400);
    setTimeout(() => clearInterval(timer), 6000);
  }

  class DataConnection {
    constructor(peer, ch) {
      this._peer = peer;
      this._ch = ch || 'default';
      this._handlers = {};
      this.open = false;
      this.metadata = { ch: this._ch };
      this.peer = null;
    }
    on(event, fn) { (this._handlers[event] ||= []).push(fn); return this; }
    emit(event, ...args) { (this._handlers[event] || []).forEach((fn) => { try { fn(...args); } catch (_) {} }); }
    send(data) { this._peer._send(data, this._ch); }
    close() { this.open = false; this.emit('close'); }
  }

  class Peer {
    constructor(id, options) {
      this._handlers = {};
      this._conns = new Map();
      this._seat = 0;
      this._ctrl = null;
      this._code = '';
      this._prefix = (String(id || '').match(PREFIX_RE) || [''])[0];
      this.id = null;
      this.disconnected = false;
      this.destroyed = false;
      const raw = String(id || '');
      if (raw) {
        this._host(raw);
      } else {
        this._options = options || {};
        setTimeout(() => { if (!this.destroyed && !this.id) this.emit('open', null); }, 0);
      }
    }

    on(event, fn) { (this._handlers[event] ||= []).push(fn); return this; }
    emit(event, ...args) { (this._handlers[event] || []).forEach((fn) => { try { fn(...args); } catch (_) {} }); }

    _openRoom() {
      const parts = location.pathname.split('/').filter(Boolean);
      const slug = (parts.length >= 2 ? parts[parts.length - 2] : 'game').replace(/^kf-/, '').slice(0, 64) || 'game';
      const ctrl = root.LiteRoom.open({
        gameId: this._gameId || slug,
        gameTitle: this._gameTitle || (document.title || '联机').slice(0, 80),
        url: location.pathname.replace(/^\//, ''),
        maxPlayers: 4
      });
      ctrl.hide();
      return ctrl;
    }

    _host(raw) {
      const requested = raw.replace(PREFIX_RE, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const start = () => {
        const session = root.LiteSync?.session?.();
        if (!session?.accessToken) {
          askLogin((error) => { if (error) this.emit('error', error); else start(); });
          return;
        }
        const ctrl = this._openRoom();
        ctrl.create({ maxPlayers: 4 }).then(() => {
          const info = ctrl.roomInfo();
          if (!info) throw new Error('房间创建失败');
          this._ctrl = ctrl;
          this._seat = 1;
          this._code = info.code;
          this.id = this._prefix + info.code;
          showBadge(info.code);
          syncCode(requested, info.code);
          ctrl.on('message', (msg) => this._dispatch(msg));
          ctrl.on('peer', (joined, seat) => this._peerEvent(joined === true, seat));
          ctrl.on('closed', () => this.emit('close'));
          this.emit('open', this.id);
        }).catch((error) => this.emit('error', error));
      };
      start();
    }

    _peerEvent(joined, seat) {
      if (!seat || seat === this._seat) return;
      if (!joined) {
        const conn = this._conns.get(seat);
        if (conn) { conn.open = false; conn.emit('close'); this._conns.delete(seat); }
        return;
      }
      let conn = this._conns.get(seat);
      if (!conn) {
        conn = new DataConnection(this, 'default');
        conn.open = true;
        conn.peer = this.id;
        this._conns.set(seat, conn);
        this.emit('connection', conn);
        conn.emit('open');
      }
    }

    _send(data, ch) {
      if (!this._ctrl) return;
      this._ctrl.send({ __p2p: 1, from: this._seat, to: this._seat === 1 ? 0 : 1, ch, data });
    }

    _dispatch(msg) {
      if (!msg || msg.__p2p !== 1) return;
      if (msg.to && msg.to !== this._seat) return;
      let conn;
      if (this._seat === 1) {
        conn = this._conns.get(msg.from);
        if (!conn) {
          conn = new DataConnection(this, msg.ch || 'default');
          conn.open = true;
          conn.peer = this.id;
          this._conns.set(msg.from, conn);
          this.emit('connection', conn);
        }
      } else {
        conn = this._guestConn(msg.ch || 'default');
      }
      if (conn) conn.emit('data', msg.data);
    }

    _guestConn(ch) {
      if (!this._guestConns) this._guestConns = new Map();
      let conn = this._guestConns.get(ch);
      if (!conn) {
        conn = new DataConnection(this, ch);
        this._guestConns.set(ch, conn);
      }
      return conn;
    }

    connect(remoteId, options) {
      const code = String(remoteId || '').replace(PREFIX_RE, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const ch = options?.metadata?.ch || 'default';
      const conn = this._guestConn(ch);
      const finish = () => {
        conn.open = true;
        conn.peer = this.id;
        conn.emit('open');
      };
      if (this._ctrl && this._code === code) { finish(); return conn; }
      const ctrl = this._openRoom();
      this._ctrl = ctrl;
      this._code = code;
      ctrl.on('message', (msg) => this._dispatch(msg));
      ctrl.on('closed', () => this.emit('close'));
      let opened = false;
      const open = () => { if (opened) return; opened = true; finish(); };
      ctrl.on('ready', open);
      // 兜底：有些路径不会触发 ready
      setTimeout(open, 1500);
      ctrl.join(code, serverUrl()).then(() => {
        const info = ctrl.roomInfo();
        this._seat = info?.seat || 2;
        this.id = this._prefix + code;
      }).catch((error) => this.emit('error', error));
      return conn;
    }

    disconnect() { try { this._ctrl?.leave(); } catch (_) {} this.disconnected = true; }
    destroy() { this.disconnect(); this.destroyed = true; }
  }

  root.Peer = Peer;
})(typeof window !== 'undefined' ? window : globalThis);