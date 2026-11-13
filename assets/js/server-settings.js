(function () {
  'use strict';
  const $ = id => document.getElementById(id), api = window.LiteSync;
  let rendering = 0, error = '';
  function open() {
    $('serverSettings').hidden = false; $('serverBtn').setAttribute('aria-expanded', 'true'); render();
  }
  async function render() {
    const generation = ++rendering;
    try {
      const state = await api.details(); if (generation !== rendering) return;
      const connected = !!state.connection, active = connected && !state.connection.expired;
      $('dataBtn').classList.toggle('server-linked', active);
      $('dataBtn').title = active ? '进度备份 · 已连接游戏服务器' : connected ? '进度备份 · 服务器登录已失效' : '导入 / 导出游戏进度';
      $('dataBtn').setAttribute('aria-label', $('dataBtn').title);
      $('serverForm').hidden = connected;
      $('serverBtn').hidden = connected;
      if (connected) {
        $('serverSettings').hidden = false;
        $('serverBtn').setAttribute('aria-expanded', 'true');
        $('serverUrl').value = state.connection.server;
        $('serverUsername').value = state.connection.username;
      }
      $('serverIdentity').hidden = !connected;
      $('serverIdentity').textContent = connected ? (active ? '已连接服务器' : '登录已失效，请断开后重新连接') + '\n服务器：' + state.connection.server + '\n账号：' + state.connection.username : '';
      $('serverStatus').textContent = error || state.message;
      $('serverConnected').hidden = !state.connection;
      const box = $('serverConflicts'); box.replaceChildren();
      for (const item of state.conflicts) {
        const card = document.createElement('article'); card.className = 'server-conflict';
        const title = document.createElement('h4'); title.textContent = (item.kind === 'nes' ? 'FC 存档 ' : '') + item.key;
        const note = document.createElement('p'); note.textContent = '本机与云端均有不同记录。此条已暂停上传，稍后处理会保留双方副本。云端版本：' + item.remote.version;
        const preview = document.createElement('details'), summary = document.createElement('summary'); summary.textContent = '查看双方内容'; preview.append(summary);
        for (const [label, value] of [['本机', item.local], ['云端', item.remote.value]]) {
          const pre = document.createElement('pre'); pre.textContent = label + '：\n' + (value === null ? '（删除 / 无记录）' : (typeof value === 'string' ? value : JSON.stringify(value)).slice(0, 4000)); preview.append(pre);
        }
        const buttons = document.createElement('div'); buttons.className = 'data-actions';
        for (const [choice, text] of [['cloud', '使用云端'], ['local', '保留本地'], ['defer', '稍后处理']]) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'data-btn'; button.textContent = text;
          button.onclick = () => run(async () => { await api.resolve(item.kind, item.key, choice); if (choice === 'defer') error = '已保留双方记录，可随时回来选择。'; }); buttons.append(button);
        }
        card.append(title, note, preview, buttons); box.append(card);
      }
      for (const item of state.blocked) { const p = document.createElement('p'); p.textContent = item.key + '：' + item.message; box.append(p); }
    } catch (e) { $('serverStatus').textContent = '同步存储不可用：' + e.message; }
  }
  async function run(task) {
    error = '';
    try { await task(); } catch (e) { error = e.message + (e.status === 429 ? '，请按服务器限流时间稍后重试。' : ''); }
    await render();
  }
  $('serverBtn').onclick = () => { if ($('serverSettings').hidden) open(); else { $('serverSettings').hidden = true; $('serverBtn').setAttribute('aria-expanded', 'false'); } };
  $('serverForm').onsubmit = event => {
    event.preventDefault(); const password = $('serverPassword').value; $('serverPassword').value = '';
    $('serverConnect').disabled = true;
    run(async () => {
      await api.connect({ server: $('serverUrl').value, username: $('serverUsername').value, password, importLocal: $('serverImport').checked });
      await api.sync();
    }).finally(() => { $('serverConnect').disabled = false; });
  };
  $('serverDisconnect').onclick = () => run(() => api.disconnect());
  $('serverSyncNow').onclick = () => run(async () => { await api.retryBlocked(); await api.sync(); });
  $('serverRecovery').onclick = () => run(async () => {
    const payload = await api.exportRecovery(), url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'litegame-sync-recovery.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  });
  window.addEventListener('litesyncchange', render);
  $('dataBtn').addEventListener('click', render);
  if (location.hash === '#server') { $('dataModal').hidden = false; open(); }
  render();
})();
