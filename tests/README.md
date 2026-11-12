# 游戏检查与回归测试

## 游戏服务器同步

`node tests/server-sync.browser.cjs` 使用 Playwright Chromium／WebKit 与独立 HTTP 协议模拟服务，网站默认 `http://127.0.0.1:8766`（可用 `GAME_BASE_URL` 覆盖）。不需要真实账号。

覆盖服务器设置 UI、密码清除、备份排除令牌、两个独立浏览器的前台恢复／分页／不同键同步、写回执游标隔离、上传中的本地继续修改、冲突持久化与选择、显式删除、断网重试、提交成功但响应丢失、413 单项隔离、429 退避、服务器 revision 回退、NES 快照、游戏旧内存写入保护、账号切换与 401 停止。使用真实浏览器存储、Web Locks 和跨 origin HTTP/CORS。

重新生成 HTML 后执行 `node deploy/sync-entrypoints.cjs`；同步模块必须位于所有游戏脚本之前。

## 规则测试（无需安装依赖）

```sh
node --test tests/*.test.cjs
```

- `card-engines.test.cjs`：9 款纸牌游戏的牌数守恒、合法出牌、撤销、AI 对局和计分。
- `game-engines.test.cjs`：全部游戏脚本语法与引擎加载；谜题可解性、棋类规则、体育计分、物理状态和存档往返等。
- `new-games.test.cjs`：2048、贪吃蛇、节拍音符及目录资源检查。
- `category-expansion.test.cjs`：弯道计时赛、极速换挡、云端叠塔、音高侦探、旋律拼图的规则、通关路径、计分与存档；目录测试要求每个分区至少三款。
- `fogtown.test.cjs`：RPG 完整主线与支线路径、战斗、一次性奖励、版本校验、备份恢复、多标签页冲突和源码体积。
- `chronicles.test.cjs`：六款原创的合法主线通关路径、战棋六关、魔塔百层、牌组守恒、生存开局资源链、设施结局、重复拾取与致命战斗限制，以及主备存档、跨标签页和 1MB 体积预算。当前九个分区均至少三款。
- `casual-ports.test.cjs`：泡泡龙与三消以合法动作走完各 20 关（允许重试），泡泡簇与反弹、三消交叉消除与恢复确定性、围猫 BFS／胜负／撤销、无效存档拒绝。
- `deploy-cache.test.cjs`：检查 Nginx 对 HTML、CSS、JS、图片和字体使用重新验证缓存，并确认部署在同步文件前后校验 Nginx 配置。
- `nes.test.cjs`：怀旧目录完整性、ROM 内容校验与三款代表游戏的启动／存档确定性。
- `jigsaw-free.test.cjs`：100／400 块自由拼图的任意摆放、真实邻接吸附、组合合并／移动、完整拼接、存档恢复与损坏校验，以及旧 20×20 存档兼容。
- `five-games.test.cjs`：山路拉力与车流穿梭的合法通关／失败、节拍回声的复奏／超时、和弦工坊的选音／评分、四款存档恢复。
- `collection.test.cjs`：53 款原创初始化与存档、接龙牌张守恒／撤销、音乐答案及节奏判定、赛车通关、体育目标可达性。
- `collection-routes.test.cjs`：十二个 RPG 短篇分别通过合法移动、战斗、职业机制和出口完成任务。
- `h5-sources.test.cjs`：37 款 ABA 原文哈希、许可证与本地依赖；当前目录检查要求每个分区至少 **20** 个条目。

### 每区二十款扩充的浏览器检查

```sh
node tests/static-server.cjs
# 另一个终端，playwright 需在 node_modules 或 NODE_PATH 中可解析
GAME_BASE_URL=http://127.0.0.1:8766 node tests/h5-imports.browser.cjs
GAME_BASE_URL=http://127.0.0.1:8766 BROWSER_ENGINE=webkit node tests/h5-imports.browser.cjs
node tests/collection.browser.cjs
BROWSER_ENGINE=webkit node tests/collection.browser.cjs
```

ABA 检查真实触摸、暂停、外部资源及四种尺寸。原创专项逐款进行输入、有效存档和刷新一致性检查，并验证五个家族的实际结算。通用 `mobile-games.browser.cjs` 可用 `GAME_IDS` 选择新增 Chogan 游戏。
- `nes-audit.cjs`：逐个独立进程检查全部 ROM 的 180 帧启动与 START 输入，结果写入 `games/nes/catalog.json`，再运行 `python3 deploy/publish-nes.py` 更新展示目录。启动检查不等于完整通关验证。

## 浏览器测试

需安装 `playwright`，并准备 Chromium 或本机 Chrome。测试依赖可安装在项目外，然后通过 `NODE_PATH` 指向其 `node_modules`；生产站点仍为纯静态文件，无需构建。

在项目根目录启动静态服务：

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

可配置环境变量：

- `GAME_BASE_URL`：默认 `http://127.0.0.1:8765`。
- `CHROME_PATH`：本机 Chrome 可执行文件；省略则使用 Playwright 的 Chromium。
- `GAME_IDS`：全量检查中限定游戏，例如 `spider,klondike,sliding`。
- `AUDIT_REPORT`：全量检查的 JSON 输出路径。
- `BROWSER_ENGINE`：移动全量／教程脚本使用 `chromium`（默认）或 `webkit`；WebKit 需先通过 Playwright 安装。
- `MOBILE_SHOTS`：移动全量脚本的截图输出目录（需预先创建）。

```sh
node tests/card-feedback.browser.cjs
node tests/card-lifecycle.browser.cjs
node tests/resize-animation.browser.cjs
node tests/category-expansion.browser.cjs
node tests/fogtown.browser.cjs
node tests/campaigns.browser.cjs
node tests/nes.browser.cjs
node tests/nes-display.browser.cjs
node tests/nes-system-buttons.browser.cjs
node tests/pagination-desktop.browser.cjs
node tests/category-search.browser.cjs
node tests/favorites.browser.cjs
node tests/ai-games.browser.cjs
node tests/nes-direction.browser.cjs
node tests/jigsaw-free.browser.cjs
node tests/jigsaw-photos.browser.cjs
node tests/five-games.browser.cjs
node tests/casual-ports.browser.cjs
node tests/all-games.browser.cjs
node tests/mobile-games.browser.cjs
BROWSER_ENGINE=webkit node tests/mobile-games.browser.cjs
node tests/mobile-controls.browser.cjs
node tests/navigation-touch.browser.cjs
node tests/mobile-tutorials.browser.cjs
BROWSER_ENGINE=webkit node tests/mobile-tutorials.browser.cjs
```

浏览器测试创建独立上下文，不使用日常浏览器的游戏存档。

`pagination-desktop.browser.cjs` 默认连接 8766，同时运行 Chromium、WebKit：大厅怀旧列表与模拟器卡带列表的上下分页同步、首尾禁用和搜索空结果；PC 八种尺寸（1280×800、1920×1080、1024×600、880×700、768×900、640×600、480×700、1024×400）下画面比例／居中、电视与控制区间距、按钮尺寸与无重叠；键盘启动、全屏滚动范围、640×800 桌面横屏入口不旋转，以及手机分页。

`category-search.browser.cjs`（8766）在两种浏览器逐分区验证限定分类搜索、无结果、清空、怀旧分页重置与返回记忆。`nes-direction.browser.cjs`（8766）直接读取模拟器控制器状态，验证圆盘八方向、连续滑动、中心死区、旋转、释放、菜单暂停；Chromium 另覆盖斜向＋A 多触点、第二根手指不能增加第三方向、触摸取消。

`favorites.browser.cjs`（8766）在 Chromium／WebKit 验证跨分区收藏、取消与刷新持久化、收藏搜索和上下分页、真实下载后在独立浏览器上下文导入、合并去重／未知 ID／损坏文件、完整进度备份往返、跨标签同步、存储失败提示。虚拟时钟检查首页 10 秒切换、进出动画、完整轮播周期、暂停／恢复、单收藏静态展示及清空回退；另覆盖手机搜索下拉收藏、320px 触摸目标与游戏跳转、NES 内部卡带收藏。

`ai-games.browser.cjs`（8766）在 Chromium／WebKit 桌面与触屏上下文实际启动两款 3D 游戏，验证赛车加速、射击消耗弹药、暂停冻结与输入释放、分区返回／收藏、无外部请求；手机检查 844×390 和 568×320 控件边界／中心命中，Chromium 另用真实双触点验证移动＋开火及取消。桌面支持原生鼠标锁定或浏览器拒绝后的拖动瞄准回退。首次程序生成场景可能需要较长时间。

`nes-display.browser.cjs` 和 `nes-system-buttons.browser.cjs` 默认连接 8766 端口（`node tests/static-server.cjs`），同时使用 Chromium 与 WebKit；可通过 `GAME_BASE_URL` 指向其他测试端口。

`jigsaw-free.browser.cjs` 同样默认连接 8766，同时运行 Chromium 和 WebKit：分别验证 10×10、20×20 的空白工作区、难度入口、触摸放置、组间合并、整体拖动／取消、缩放坐标、平移、刷新恢复、四尺寸与可达控件。Chromium 另用 CDP 验证真实触摸拖动和取消；结局采用合法的 99／399 块组合存档，再通过 UI 拼入最后一块。包含旧 20×20 存档和经典模式回归。

自由拼图专项也验证下方完整图缩略图及弹窗与当前图案一致、反复查看与关闭、四尺寸和完成后的参考入口，以及参考前后进度与视图保持一致。

`jigsaw-photos.browser.cjs` 默认 8766，Chromium／WebKit 逐张验证六张本地 WebP 的加载、尺寸、切块、参考图和存档恢复，另检查失败重试和加载期间切换模式的旧请求隔离。

### 检查范围

全量脚本从 `assets/js/games.js` 读取所有游戏，检查加载、资源请求、基础点击/键盘输入、帮助弹窗、刷新、尺寸重绘循环，以及 1280×800、390×844、844×390、320×568 四种窗口尺寸。裁切与零尺寸画布是待人工核实的观察项：例如海战棋布阵时会隐藏敌方棋盘。

专项脚本验证：

- 怀旧底部控制：分别仅用底部“开始”、START、SELECT 启动；验证短按传入两个模拟帧、暂停／继续、顶部与底部状态同步、键盘唤醒、横屏触摸及退出后的暂停状态。
- 怀旧横屏布局：全屏／方向接口缺失、拒绝、模拟成功分支，四尺寸画面比例、按键边界与遮挡检查，菜单存读档；Chromium 另从横屏和竖屏视口进入真实全屏并触摸启动／暂停。
- 无效移动时卡牌只在原位抖动，兼容旧浏览器回退和减少动态效果设置。
- 连续点击不会被旧动画定时器提前打断。
- 疯狂八、金拉米的下一局只发一次牌。
- 金拉米已结束存档恢复后的结算、二十一点结算幂等。
- 发牌过程中调整窗口时，卡牌不继续飞向旧坐标；数字华容道尺寸变化不播放跨屏移动动画。
- 六款原创：手机尺寸实际按钮操作、刷新、JSON 导入导出、无效导入不覆盖、多标签页锁定。
- Bounce Back：屏幕方向／投掷按钮、关卡转换检查点、刷新暂停与通关记录、导入导出和损坏恢复。
- Entombed：屏幕转向、位置／生命／法力恢复、重开统计与钥匙清零、幽灵掉落／钥匙／锁门／梯子终局夹具、暂停动画、导入导出与损坏恢复。此专项通过调用真实流程函数构造结局，不代表完整手动打通原作。
- 四款休闲移植：手机输入、暂停、刷新、有效／无效导入、下载备份、关卡终局、损坏主档回退及多标签页冲突。太空收纳五种模式各生成 100 盘，以原作旋转及碰撞代码核验参考解，另各完成 8 盘并累计救出超过 100 只；拒绝未完成拼盘伪造的完成标记。该验证使用解夹具，不代表人工拼完所有盘面。

这些检查覆盖已列出的规则与操作路径，不代表穷举每一种棋局、浏览器或设备。浏览器基础交互检查也不等同于每款游戏完整通关。

### 手机专项的判定边界

- `mobile-games.browser.cjs`：独立 `isMobile:true`、`hasTouch:true`、DPR 2 上下文；触摸按钮／画面，旋转至 390×844、320×568、844×390、568×320，刷新并记录脚本与资源错误。它跳过首玩教程；触摸事件计数不等于游戏状态一定发生有效变化，刷新成功也不等于逐款存档一致性断言。
- `mobile-controls.browser.cjs`：Chromium CDP 真实触摸长按／滑动；断言贪吃蛇转向、2048 步数改变、Bounce Back 移动、Entombed 转向与松手，以及贪吃蛇四尺寸不与虚拟键重叠、两原作横屏画面／按键同屏。
- `navigation-touch.browser.cjs`：验证游戏厅 hash 路由返回后的滚动位置、Chogan／移植页的游戏厅主页入口，以及移动棋盘的触摸滚动隔离。
- `mobile-tutorials.browser.cjs`：扫描使用 `ctx.tutorialIfNew` 的目录游戏，以首次访问打开教程；检查短横屏／小竖屏的示意图顶部、触摸导航、逐页完成与刷新记忆。它补充首玩路径，不覆盖全部自定义帮助面板。
- 全量脚本的 `clipped`、`blocked`、`small` 是人工审查项，不参与执行成功判定。麻将层叠、纸牌叠放、滚动容器外的格子可能被标记；必须结合截图、滚动后的可达性与实际触摸复核。装饰粒子画布 `.ch-fx` 不作为游戏画面裁切。
- WebKit 自动化并非实体 iPhone/Safari 测试。浏览器工具栏伸缩、系统手势、软键盘、刘海安全区及长期运行性能仍需真机复核。
