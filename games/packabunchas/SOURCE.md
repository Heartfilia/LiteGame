# 太空收纳：来源与移植说明

- 原项目：[Mattia Fortunati / packabunchas](https://github.com/MattiaFortunati/packabunchas)
- 固定 commit：`fc4e6331fa4b8c17cc341094e9027bccd02f463f`
- 原作者：Copyright (c) 2021 Mattia Fortunati
- 原作参加 2021 年 js13kGames。
- 许可证：[MIT](LICENSE)，保留原始版权及许可全文。

`game.js` 来自该 commit，保留原作者文件头；`upstream/` 保存原始 HTML 与 README。原始 `game.js` 可在上述固定版本查阅。

## 原作代码修改

- 保留拼块生成、角色和飞船绘制、旋转、容纳与碰撞检测。
- 修复 `collideWithOtherPieces` 遇到自身使用 `break` 导致遗漏后续拼块的问题，改为 `continue`。
- 原 `saveData/loadData` 不再直接读写 localStorage，由适配层统一管理版本化存档。
- 移除全局鼠标、触摸和焦点监听，移除原故事启动及 `update()` 自动启动，改由适配层接管。

## 新增适配层

`adapter.js` 提供中文流程、Canvas 范围内的 Pointer 输入、键盘移动、旋转按钮、参考位置提示、暂停、换盘及下一盘。保留经典、五格、混合、儿童、轻松五种模式，每盘分别为 4、5、6、2、3 个拼块；混合模式由原版 8 块减为 6 块以适应手机。

原作穷举旋转与排列的关卡搜索由“先摆出合法位置，再打乱朝向”替代。形状生成与摆放搜索均有上限，候选耗尽时使用保证互不重叠的分区布局，保留每盘参考解。原作绘制代码继续负责拼块角色美术。

存档记录每块的位置、形状、朝向、颜色、飞船、参考解、模式、盘数和累计救援数；恢复先暂停。完成标记需与实际摆放一致，累计救出 100 只触发里程碑，之后可继续游戏。使用共享存档日志，支持主备恢复、多标签页冲突锁和 JSON 导入导出。

本版适配代码和封面为 LiteGame 修改，采用 MIT。原作故事演出、音乐和菜单不在本版启动流程中。
