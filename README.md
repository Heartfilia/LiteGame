# LiteGame · 轻量游戏厅

打开即玩的网页小游戏合集，支持电脑键盘、鼠标与手机触屏。项目采用纯静态站点结构，游戏在浏览器中运行，无需登录，也不需要部署业务后端或数据库。

包含原创小游戏、第三方游戏移植、FC / NES 模拟器以及 WebGL 3D 游戏；各游戏的玩法、操作方式与存档能力以游戏页面说明为准。

## 功能概览

- **分类浏览**：怀旧、角色扮演、赛车、射击游戏、动作、益智、桌游、卡牌、休闲、音乐、体育。
- **搜索**：全站搜索与分区内搜索，长列表提供上下同步分页。
- **我的收藏**：跨分区收藏、取消收藏、本地持久化、搜索和分页；支持导出 JSON 后在其他浏览器合并导入。
- **首页推荐**：没有收藏时展示默认推荐；有收藏时主入口切换到“我的收藏”，多款收藏每 10 秒带动画轮播，并支持暂停。
- **本地数据备份**：大厅提供游戏进度与收藏的导入／导出，部分游戏另有独立存档入口。
- **移动适配**：响应式布局、触屏操作、横屏游玩及支持浏览器下的全屏功能。

### 特色游戏

| 游戏／模块 | 入口 | 特点 |
| --- | --- | --- |
| 怀旧游戏机 | `games/nes/` | JSNES 模拟器、卡带搜索、本地 `.nes` 导入、即时存档；电脑老电视布局、手机八方向圆盘与横屏掌机布局 |
| 自由拼图 | `games/jigsaw/` | 10×10／20×20，自由摆放、邻接吸附、组合移动、进度保存与完整图参考 |
| Ai飞车 | `games/ai-speed/` | 3D 赛车、四条赛道、漂移集气、小喷与氮气、电脑车手和道具赛 |
| AiCF·运输船 | `games/ai-cf/` | 3D 团队射击、机器人对战、多种武器、键鼠与独立多点触控 |

## 本地运行

现有游戏运行文件已包含在仓库中，**启动网站无需执行 npm 安装或构建**。请使用 HTTP 服务访问，避免直接双击 HTML 时遇到资源加载和浏览器存储差异。

在项目根目录执行以下任一方式。

### 使用 Python

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

### 使用 Node.js

```sh
node tests/static-server.cjs
```

打开 **http://127.0.0.1:8766/**。

常用页面：

- 赛车分区：`http://127.0.0.1:8766/index.html#/category/racing`
- 射击分区：`http://127.0.0.1:8766/index.html#/category/shooting`
- 怀旧分区：`http://127.0.0.1:8766/index.html#/category/retro`
- 我的收藏：`http://127.0.0.1:8766/index.html#/category/favorites`

3D 游戏需要浏览器支持 WebGL。手机建议横屏游玩；系统全屏、方向锁定与鼠标锁定的支持情况取决于浏览器。

## 收藏、进度与迁移

未连接服务器时，数据保存在当前浏览器的站点存储中。同一设备更换浏览器，或更换访问域名、协议、端口，也会使用不同的本地存储；可使用备份迁移，或连接同一游戏服务器账号自动同步。

| 数据类型 | 保存与迁移方式 |
| --- | --- |
| 收藏列表 | “我的收藏” → 导出收藏／导入收藏；专用导入合并已有列表并去重 |
| 大厅支持的游戏记录 | 页面底部“进度备份”；备份包含收藏，导入会覆盖同名记录 |
| FC / NES 即时存档 | 在模拟器中为对应卡带存档、读档、导出或导入；大厅备份不包含 FC 存档 |
| Ai飞车／AiCF 设置 | 保存选项配置并纳入大厅备份，不保存中途比赛或战斗快照 |

收藏备份只记录游戏列表，不携带游戏进度。清理浏览器站点数据前，可通过对应入口导出备份。

### 游戏服务器与自动同步

页面底部 **进度备份 → 载入服务器**，填写服务器根 URL、账号、密码，点击“连接并同步”。账号需由 LiteGameServer 管理员创建。公网服务使用 HTTPS，开发可用 `http://localhost` / `http://127.0.0.1`；网站本身也应使用 HTTPS（或 localhost），浏览器需支持 Web Locks、IndexedDB 和 Web Crypto。

- 自动同步 `litegame.*`、`chogan.*` 游戏记录和收藏，以及 IndexedDB 中已保存的 FC / NES 即时存档；不上传 ROM、实时游戏画面或搜索／滚动状态。
- 本地保存后约 2 秒上传；可见页面每 20 秒核对，回到前台、恢复网络时立即检查。每次上传前先拉取更新，多标签通过 Web Locks 串行核对。
- 闲置浏览器没有修改时，会下载其他浏览器的新进度。双方修改同一记录时，提供“使用云端 / 保留本地 / 稍后处理”，其他记录照常同步。
- 正在运行的游戏收到恢复数据后会遮罩提示重载，并阻止旧页面继续写存档；此前的持久化记录保留为恢复副本。游戏内尚未保存的运行状态不属于同步存档。
- 首次连接或切换账号时，可选择是否上传本机已有、云端尚无的记录；同名不同内容仍需处理冲突。断开连接保留本地数据。
- 浏览器记住登录令牌，不保存密码；连接信息与同步元数据使用独立 `lgSync.v1.*` / `lgSync-v1` 存储，不进入进度备份。令牌到期或被撤销后需重新登录。
- “导出恢复副本”包含替换前的本地记录、保留本地时的云端副本和未解决冲突；其中普通记录可用大厅“导入进度”恢复。FC 快照位于文件 `records[].value`，取出对应 snapshot 后可由 FC 页面导入，再点击存档。

接入协议为 LiteGameServer v1，部署需允许本站 origin 的 CORS（`Authorization`、`Content-Type`，GET/POST/PUT/DELETE，暴露 `Retry-After`）。已有增量查询及乐观并发接口足够使用，无需新增接口；若以后希望更低延迟，可增加仅通知 revision 的长轮询或推送，客户端仍按现有 API 拉取并核对。

## 项目结构

```text
LiteGame/
├── index.html                 # 游戏厅页面、导航与备份弹窗
├── assets/
│   ├── css/style.css          # 游戏厅样式
│   ├── js/games.js            # 分区与游戏目录数据
│   ├── js/main.js             # 路由、搜索、卡片、首页轮播与备份
│   ├── js/favorites.js        # 收藏存储、校验、导入导出与跨标签同步
│   ├── js/server-sync.js      # 服务器认证、版本同步、冲突与游戏写入保护
│   ├── js/server-settings.js  # 进度备份中的服务器设置与冲突选择
│   └── images/                # 站点图标、游戏封面
├── games/
│   ├── lib/                   # 共享游戏组件与适配层
│   ├── nes/                   # FC 模拟器、目录、卡带与厂商代码
│   ├── jigsaw/                # 拼图与图片资源
│   ├── crisp/                 # ABA / crisp-game-lib 游戏移植
│   ├── ai-speed/              # Ai飞车源码及构建产物
│   ├── ai-cf/                 # AiCF·运输船源码及构建产物
│   └── ...                    # 其他游戏目录
├── deploy/                    # 静态发布、Nginx 参考、资源导入与构建工具
└── tests/                     # Node 规则测试、浏览器测试与检查记录
```

## 添加或修改游戏

1. 将游戏及其运行资源放入 `games/<game-id>/`，通常以 `index.html` 为入口。
2. 准备封面，并在 `assets/js/games.js` 的 `games` 中登记唯一 `id`、标题、分区、URL、封面、标签与简介。
3. 新增分区时，补充同文件的 `categories`；若需要新图标，在 `assets/js/main.js` 的 `ICON_PATHS` 中定义。
4. 接入返回游戏厅／分区入口，检查键盘与触屏操作、暂停和输入释放，以及适用的存档路径。
5. 运行相关检查，保留第三方代码的来源说明与许可证。

独立游戏 HTML 必须在游戏脚本之前载入 `assets/js/server-sync.js`。新增或重新生成页面后执行 `node deploy/sync-entrypoints.cjs` 补齐相对路径；现有生成脚本已包含接入。NES 存档使用独立的保存通知及读取前核对。

目录中的游戏会自动参与大厅搜索和卡片收藏。**游戏 ID 应保持稳定**，收藏记录通过 ID 关联游戏。

### 3D 游戏构建

Ai飞车与 AiCF 的可读源码位于各自 `src/`，发布使用已提交的 `index.html` 和 `game.js`。修改源码后需重新打包。

在项目外分别准备以下依赖：

- Ai飞车：`three@0.169.0`、`esbuild@0.28.2`。
- AiCF：`three@0.186.0`、`esbuild@0.28.2`。

```sh
AI_SPEED_MODULES=/path/to/speed/node_modules \
AI_CF_MODULES=/path/to/cf/node_modules \
node deploy/build-ai-games.cjs
```

完整来源和构建说明见 [3D 游戏适配文档](games/ai-3d-SOURCE.md)。其他 `deploy/import-*`、`build-*` 脚本用于特定游戏或资源维护，不是启动网站的必要步骤。

## 测试

### 规则与资源检查

使用支持内置测试运行器的 Node.js，在项目根目录执行：

```sh
node --test tests/*.test.cjs
```

### 浏览器检查

浏览器测试依赖 Playwright 及对应的 Chromium／WebKit。依赖可以安装在项目外，再通过 `NODE_PATH` 指向其 `node_modules`。

先启动前述本地 HTTP 服务，在另一个终端运行，例如：

```sh
export NODE_PATH=/path/to/browser-tests/node_modules
export GAME_BASE_URL=http://127.0.0.1:8766

node tests/category-search.browser.cjs
node tests/favorites.browser.cjs
node tests/pagination-desktop.browser.cjs
node tests/nes-display.browser.cjs
node tests/jigsaw-free.browser.cjs
node tests/ai-games.browser.cjs
node tests/server-sync.browser.cjs
```

完整测试范围、参数与运行方法见 [tests/README.md](tests/README.md)，历史检查结果见 [tests/AUDIT.md](tests/AUDIT.md)。浏览器自动化覆盖不等同于实体手机实测或所有游戏完整通关。

## 部署

网站可由 Nginx 或其他静态 HTTP 服务提供。运行文件主要是根目录 `index.html`、`assets/` 和 `games/`；目录层级需保持一致。

仓库提供面向 **Debian／Ubuntu、systemd、Nginx** 环境的发布脚本，依赖 `rsync` 与 `realpath`：

```sh
# 在服务器上的源码目录执行，默认发布到 /opt/litegame
sudo bash deploy/deploy.sh

# 后续更新
sudo bash deploy/deploy.sh update
```

- `APP_DIR` 可指定专用发布目录，并需与 Nginx `root` 一致。
- 脚本按 [publish.rules](deploy/publish.rules) 同步文件，并删除发布目录内多余或被排除的文件，因此该目录应仅存放本站发布产物。
- 脚本在同步前后检查 Nginx 配置并重载服务，**不会自动安装或替换 Nginx 配置**。
- [deploy/nginx.conf](deploy/nginx.conf) 是放在 `http {}` 内的参考片段，域名、证书路径与站点目录需按实际环境调整。
- 首页使用 `no-store`；可替换的 JS、CSS、图片等使用重新验证缓存策略。

具体配置与发布步骤见 [部署说明](deploy/SECURITY.md)。Git 提交或推送与服务器发布是两个独立步骤。

## 来源与许可

项目包含多个来源、不同许可证的游戏和依赖，不以某一个第三方组件的许可证代表整个仓库。来源、固定版本和修改说明优先查看对应目录的 `SOURCE.md`、`LICENSE` 或其他许可文件。

- [FC / NES 来源说明](games/nes/SOURCE.md)
- [Ai飞车与 AiCF·运输船来源说明](games/ai-3d-SOURCE.md)
- [ABA / crisp 游戏来源说明](games/crisp/SOURCE.md)
- [Chogan 许可证](games/CHOGAN-LICENSE)
- [拼图实现说明](games/jigsaw/README.md)

第三方游戏、引擎与素材的署名及使用条件以各自说明为准。
