# 泡泡龙：来源与移植说明

- 原项目：[Rembound / Bubble-Shooter-HTML5](https://github.com/rembound/Bubble-Shooter-HTML5)
- 固定 commit：`2e62806ef5d7471f77566bc1cf6f2ac17a584c4d`
- 原作者：Copyright (c) 2015 Rembound.com
- 许可证：[MIT](LICENSE)，保留原始版权及许可全文。

`upstream/` 保存原始教程脚本、HTML、泡泡素材及 README，供对照；游戏运行时不加载该目录。

## 本版实现

`engine.js` 将原教程的错位六邻格、同色连通簇、顶部连接与悬空簇规则移植为无 DOM 引擎。重新实现发射轨迹、墙面反弹、碰撞落点及绘制，加入 20 个有限球数、不限时间的关卡、下一球交换、失败重试和永久通关记录。画面使用 Canvas 圆形与数字，不依赖原教程图片。

`../lib/casual-ports.js` 提供触屏、滑杆和键盘操作；`casual-shell.js` 管理关卡流程；`campaign-save.js` 与 `port-shell.js` 提供版本校验、主备存档、多标签页冲突保护及 JSON 导入导出。刷新恢复当前棋盘、剩余球数、当前球及下一球，继续前需点击开始。

本版适配代码和封面为 LiteGame 修改，采用 MIT。原教程和本版新增关卡并非完全相同的作品流程。
