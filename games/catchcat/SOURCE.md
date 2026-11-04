# 围住小猫：来源与移植说明

- 原项目：[Ganlv / phaser-catch-the-cat](https://github.com/ganlvtech/phaser-catch-the-cat)
- 固定 commit：`75b67f97a405dd5b0fc8a48d8f647efb72f070a3`
- 原作者：Copyright (c) 2021 Ganlv
- 许可证：[MIT](LICENSE)，保留原始版权及许可全文。

`upstream/` 保存 README、`src/solvers/nearestSolver.ts` 和 `src/scenes/mainScene.ts`，记录寻路与场景规则来源。它们是参考源码，不是可独立运行的完整原仓库。

## 本版实现

`engine.js` 移植 `nearestSolver.ts` 的边缘反向 BFS，以及最短路径中优先选择路线数较多方向的策略。使用 11×11 错位六邻格；没有到边缘的路线时获胜，小猫到达边缘时失败。

移除 Phaser 依赖，由 `../lib/casual-ports.js` 使用 Canvas 重新绘制棋盘和猫咪，不使用原作猫咪图像资源。增加 20 关、逐步减少初始障碍、换局、胜负后撤销、键盘光标和触屏操作。共享存档日志保存墙壁、猫咪位置、撤销历史与关卡记录，支持刷新恢复和 JSON 导入导出。

随机初始障碍确保猫咪开局存在逃生路线，不承诺每个随机局面都有玩家必胜策略；可通过换局或撤销继续挑战。本版适配代码和封面为 LiteGame 修改，采用 MIT。
