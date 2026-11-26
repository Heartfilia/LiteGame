# LiteGameServer 双人联机协议规范（Netplay Protocol v1）

本文档定义 `LiteGame` 前端（`assets/js/netplay.js`）与自托管 `LiteGameServer` 之间的实时双人联机接入契约。

设计原则：

1. **零数据库依赖、零游戏规则耦合**：服务端仅在内存中维护短期活跃房间（`Map<roomCode, Room>`），不落库、不存储 ROM、不解析具体游戏规则；同一套协议同时适用于 FC / NES 帧同步联机与棋牌回合同步。
2. **房主鉴权防滥用、好友免账号即玩**：仅“创建房间”需要现有 `LiteGameServer` 登录令牌（`Authorization: Bearer <access_token>`）；受邀好友（2P）凭 6 位数字房间码或邀请链接即可匿名换取临时房间票据加入，无需注册账号或预先配置同步。
3. **HTTPS / WSS 单端口穿透**：默认通过现有 `443` 端口的 `wss://` 实时转发（同时支持同通道透传 WebRTC `RTCPeerConnection` 信令升级 P2P `DataChannel`，对称 NAT 打洞受阻时无缝保持 WebSocket 转发，无需部署 `coturn` 或开放额外 UDP 端口）。

---

## 1. 公共约定与 CORS

- **路由前缀**：`/api/v1/rooms`，与现有同步接口共用同一服务器根地址（例如 `https://save.example.com`；本机开发允许 `http://localhost` / `http://127.0.0.1`）。
- **CORS 响应头**（与同步协议一致）：
  - `Access-Control-Allow-Origin`: 允许 `LiteGame` 静态站点 Origin
  - `Access-Control-Allow-Headers`: `Authorization, Content-Type`
  - `Access-Control-Allow-Methods`: `GET, POST, DELETE, OPTIONS`
  - `Access-Control-Expose-Headers`: `Retry-After`
- **错误响应格式**（沿用 v1 统一信封）：
  ```json
  {
    "error": {
      "code": "room_not_found",
      "message": "房间不存在或已过期"
    }
  }
  ```
- **可选能力声明**：`GET /api/v1/info` 可附加 `"netplay_version": 1` 与可选 `"ice_servers": [{"urls": "stun:stun.l.google.com:19302"}]`。若旧版服务端未实现 `/api/v1/rooms` 返回 `404`，前端会明确提示升级服务端。

---

## 2. HTTP 接口

### 2.1 创建房间（1P 房主，需 Bearer 令牌）

`POST /api/v1/rooms`

- **请求头**：`Authorization: Bearer <access_token>`，`Content-Type: application/json`
- **请求体**：
  ```json
  {
    "game_id": "nes-c78c9d18f6ae9739",
    "game_title": "魂斗罗",
    "kind": "nes",
    "rom_sha256": "c154be5067c9c5cc3e31eb994bf1e21d7cb3e8ef82a437eb523882a710582370",
    "url": "games/nes/index.html?game=nes-c78c9d18f6ae9739&from=retro"
  }
  ```
  - `game_id`：必填，`^[a-z0-9-]{1,64}$`。
  - `game_title`：必填，最长 80 字符。
  - `kind`：必填，当前为 `"nes"`（后续可扩展 `"board"` 等）。
  - `rom_sha256`：`kind === "nes"` 时必填，64 位小写十六进制 SHA-256，用于客机强校验卡带一致性。
  - `url`：必填，站内相对入口路径（禁止以 `/`、`//` 或协议开头，仅限 `games/...`）。
- **服务端行为**：
  - 若同一 `user.id` 已有未关闭的旧房间，主动关闭旧房间（每账号同时最多保留 1 个活跃房间）。
  - 生成当前未占用的 **6 位纯数字房间码**（例如 `"482910"`，避免 `000000`）。
  - 生成房主专用随机票据 `ticket`（至少 128 bit 随机熵，绑定 `role = 1`）。
- **响应 `200 OK`**：
  ```json
  {
    "room_code": "482910",
    "role": 1,
    "ticket": "host-random-ticket",
    "expires_at": 1795512000,
    "ice_servers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  }
  ```
- **错误状态码**：
  - `401 unauthorized`：登录令牌缺失、过期或已撤销。
  - `422 invalid_request`：字段格式不合法。
  - `429 rate_limited`：建房过于频繁（建议单账号 10 次 / 分钟），附带 `Retry-After`。

---

### 2.2 查询房间公开信息（免登录，供大厅房间号跳转）

`GET /api/v1/rooms/:code`

- **路径参数**：`:code` 为 6 位数字 `^\d{6}$`。
- **用途**：当 2P 在游戏厅首页仅输入 6 位房间码时，前端先查询房间对应的游戏入口 `url` 与状态，再跳转到对应游戏页执行正式加入，不提前占用 2P 席位。
- **响应 `200 OK`**：
  ```json
  {
    "room_code": "482910",
    "game_id": "nes-c78c9d18f6ae9739",
    "game_title": "魂斗罗",
    "kind": "nes",
    "rom_sha256": "c154be5067c9c5cc3e31eb994bf1e21d7cb3e8ef82a437eb523882a710582370",
    "url": "games/nes/index.html?game=nes-c78c9d18f6ae9739&from=retro",
    "host_connected": true,
    "guest_connected": false,
    "expires_at": 1795512000
  }
  ```
- **错误状态码**：
  - `404 room_not_found`：房间不存在或已过期。
  - `429 rate_limited`：按客户端 IP 限流（建议 30 次 / 分钟，防止遍历 6 位房间码）。

---

### 2.3 加入房间（2P 好友，免账号准入）

`POST /api/v1/rooms/:code/join`

- **请求头**：`Content-Type: application/json`（无需 `Authorization`）
- **请求体**：
  ```json
  {
    "game_id": "nes-c78c9d18f6ae9739",
    "rom_sha256": "c154be5067c9c5cc3e31eb994bf1e21d7cb3e8ef82a437eb523882a710582370"
  }
  ```
- **服务端行为**：
  - 校验房间存在且未过期。
  - 若请求携带 `game_id` 或 `rom_sha256` 且与房间不一致，返回 `409 game_mismatch`。
  - 若房间当前**已有活跃连接的 2P WebSocket**，返回 `409 room_full`（防止第三人顶掉正在游玩的 2P）；若此前签发过 2P 票据但尚未建立 WebSocket 或已断线，允许签发新 `guest` 票据以支持 2P 刷新重连。
- **响应 `200 OK`**：
  ```json
  {
    "room_code": "482910",
    "role": 2,
    "ticket": "guest-random-ticket",
    "game_id": "nes-c78c9d18f6ae9739",
    "game_title": "魂斗罗",
    "kind": "nes",
    "rom_sha256": "c154be5067c9c5cc3e31eb994bf1e21d7cb3e8ef82a437eb523882a710582370",
    "url": "games/nes/index.html?game=nes-c78c9d18f6ae9739&from=retro",
    "expires_at": 1795512000,
    "ice_servers": [
      { "urls": "stun:stun.l.google.com:19302" }
    ]
  }
  ```
- **错误状态码**：
  - `404 room_not_found`
  - `409 room_full` / `409 game_mismatch`
  - `429 rate_limited`

---

## 3. WebSocket 实时通道

`GET /api/v1/rooms/:code/ws?ticket=<ticket>`

- **鉴权与安全**：
  - 校验 `Origin` 头属于允许的站点列表。
  - 校验 `ticket` 匹配该房间的 1P 或 2P 席位；无效票据直接拒绝握手（`401` / `403`）或以关闭码 `4401` 断开。
  - 启用底层 TCP `TCP_NODELAY`（禁用 Nagle 算法），避免 10 字节输入帧被延迟拼包。
  - 建议关闭帧压缩（`permessage-deflate` 对 10 字节二进制包无收益且增加 CPU 开销）。

### 3.1 服务端主动下发的房间事件（Text JSON）

1. **连接就绪 `welcome`**（握手成功后立即发给当前连接方）：
   ```json
   {
     "type": "welcome",
     "room_code": "482910",
     "role": 1,
     "peer_connected": false,
     "game_id": "nes-c78c9d18f6ae9739",
     "game_title": "魂斗罗",
     "rom_sha256": "c154be5067c9c5cc3e31eb994bf1e21d7cb3e8ef82a437eb523882a710582370"
   }
   ```
2. **对端上线 `peer_joined`**（另一席位连入 WebSocket 时发给已在房内的一方）：
   ```json
   { "type": "peer_joined", "role": 2 }
   ```
3. **对端离线 `peer_left`**（另一席位断开 WebSocket 时发给仍在房内的一方）：
   ```json
   { "type": "peer_left", "role": 2, "reason": "disconnected" }
   ```
4. **房间关闭**：当 1P 主动解散房间（发送 `{ "type": "close_room" }`）或房间超时，服务端通知对端 `{ "type": "room_closed", "reason": "host_closed" }` 并以 `1000` 关闭连接，随后销毁内存房间。

### 3.2 服务端透传的双端控制消息（Text JSON）

当另一席位在线时，服务端校验基本长度限制后将文本消息**原样转发**给对端，并刷新房间活跃时间 `lastActiveAt`：

| `type` | 方向 | 大小上限 | 说明 |
| :--- | :---: | :---: | :--- |
| `guest_ready` | 2P → 1P | 4 KB | `{ "type": "guest_ready", "ready": true, "rom_sha256": "..." }` |
| `start` | 1P → 2P | 2 MB | `{ "type": "start", "session_id": 1, "delay": 2, "mode": "reset" \| "snapshot", "rom_sha256": "...", "payload"?: "..." }` |
| `sync_state` | 1P → 2P | 2 MB | `{ "type": "sync_state", "session_id": 2, "delay": 2, "rom_sha256": "...", "payload": "..." }`（中途重同步或读档续玩） |
| `pause` | 双向 | 4 KB | `{ "type": "pause", "session_id": 1, "frame": 480, "reason": "玩家已暂停" }` |
| `resume` | 双向 | 4 KB | `{ "type": "resume", "session_id": 1, "frame": 480 }` |
| `quick_msg` | 双向 | 4 KB | `{ "type": "quick_msg", "text": "按 START 开始" }`（预设快捷短语） |
| `ping` / `pong` | 双向 | 1 KB | `{ "type": "ping", "t": 12345.6 }` → 对端回传 `pong` 测算双端真实 RTT；对端未加入时服务端可直接回 `pong` 保活 |
| `rtc_signal` | 双向 | 32 KB | `{ "type": "rtc_signal", "description"?: ..., "candidate"?: ... }`（可选 WebRTC DataChannel 升级信令） |

> **限额保护**：仅 `role === 1`（房主）发送的 `start` / `sync_state` 允许最大 **2 MB** 文本帧（gzip+base64 快照实测约 110 KB，未压缩 JSON 约 980 KB）；其余文本帧超过 **32 KB** 时服务端以 `1009 Message Too Big` 拒绝。

### 3.3 服务端透传的帧同步二进制包（Binary Frame）

在游戏运行期间，1P 与 2P 每推进一帧通过 WebRTC `DataChannel`（优先）或本 WebSocket（无缝回退）发送 **10 字节定长二进制包**（Big-Endian）：

```text
Offset  Type    Field        Description
0       Uint8   packetType   固定为 0x01（Lockstep 输入帧）
1       Uint8   sessionId    当前局会话号 (session_id & 0xff)，隔离重开/读档前的旧包
2..5    Uint32  frame        目标模拟帧序号 (0, 1, 2, ...)
6..7    Uint16  mask         frame 帧的 10 位手柄掩码（bit 0..9 对应 JSNES BUTTON_A..TURBO_B）
8..9    Uint16  prevMask     frame - 1 帧的手柄掩码（冗余携带上一帧；frame === 0 时为 0）
```

- **服务端处理**：收到长度 `<= 64` 字节的 Binary WebSocket 帧时，不解析 JSON，直接原样写出到对端 socket（单房间 60fps 双向总吞吐约 `1.2 KB/s`）。超过 `64` 字节的二进制帧直接丢弃或以 `1009` 关闭。

---

## 4. 服务端资源治理与 Nginx 参考

### 推荐内存与超时阈值

- **房间空闲回收**：连续 `300` 秒无任何控制/输入/心跳消息自动销毁。
- **房间最大寿命**：创建后最长 `7200` 秒（2 小时），支持活跃游玩续期。
- **全局房间上限**：单实例默认上限 `500` 个活跃房间（内存占用仅数 MB），超限返回 `503 server_busy`。

### LiteGameServer 侧 Nginx WebSocket 反代片段

在 `LiteGameServer` 的 HTTPS `server {}` 内（与现有 `/api/v1/` 同域同端口）：

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

# 在 LiteGameServer 的 server 块内：
location ^~ /api/v1/rooms/ {
    proxy_pass http://127.0.0.1:8080; # 替换为 LiteGameServer 实际监听地址
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    proxy_buffering off;
}
```
