# 游戏检查与回归测试

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

```sh
node tests/card-feedback.browser.cjs
node tests/card-lifecycle.browser.cjs
node tests/resize-animation.browser.cjs
node tests/category-expansion.browser.cjs
node tests/fogtown.browser.cjs
node tests/campaigns.browser.cjs
node tests/casual-ports.browser.cjs
node tests/all-games.browser.cjs
```

浏览器测试创建独立上下文，不使用日常浏览器的游戏存档。

### 检查范围

全量脚本从 `assets/js/games.js` 读取所有游戏，检查加载、资源请求、基础点击/键盘输入、帮助弹窗、刷新、尺寸重绘循环，以及 1280×800、390×844、844×390、320×568 四种窗口尺寸。裁切与零尺寸画布是待人工核实的观察项：例如海战棋布阵时会隐藏敌方棋盘。

专项脚本验证：

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
