# ABA 单键游戏移植

游戏来自 [crisp-game-lib-games](https://github.com/abagames/crisp-game-lib-games) 与
[crisp-game-lib-11-games](https://github.com/abagames/crisp-game-lib-11-games)，作者 ABA，MIT 许可证。
精确提交、逐文件 SHA-256、npm 包版本和完整性值见 `manifest.json`。
各来源与运行库的完整许可证随文件保留。

运行 `python3 deploy/import-h5.py` 可重新下载固定版本并生成入口；部署不需要 Python 或 npm。
所有游戏、音效合成器、运行库在本地提供，不请求 CDN。

适配：中文入口、操作说明、移动端触摸隔离、游戏厅导航、暂停、重开、静音、全屏和本地最高分。
上游 main.js 原样保留。1.0 游戏使用 1.1.1 兼容 API；主题统一到 Canvas simple/dark，
关闭自动回放、GIF 录制与背景音乐，因此不需 Pixi、GIF 捕获库或 Lodash。
运行库帧循环仅添加 `liteCrispPaused` 暂停检查；桥接器监听结算并保存最高分。
短局游戏仅保存最高分，刷新不恢复正在进行的一局，入口明确说明这一点。
