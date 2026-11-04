# 长期进度游戏

六款原创：`starfarm`、`runetraveler`、`caravan`、`wardens`、`island`、`magictower`。

`chronicles-engines.js` 提供无 DOM 规则：`newGame()`、`act(state, action, value)`、`restore(state)`。`chronicles.js` 提供独立玩法界面和中文说明，`campaign.css` 适配手机与桌面。时间只在玩家操作时推进。

| 游戏 | 主线闭环 |
| --- | --- |
| 星砂牧场 | 种植留种、加工、钓鱼、8 订单与 3 设施；之后可继续经营 |
| 符文旅人 | 9 战、选卡、遗物、删牌、失败重整、最终首领 |
| 口袋商队 | 5 城贸易、途中事件、护卫、货车、6 委托；破产可打工 |
| 遗迹守望者 | 三角色移动／攻击／治疗、敌方回合、6 关、营地升级与失败重试 |
| 荒岛手记 | 海滩起步获得基础工具、4 区探索、采集制作、手记与修船结局 |
| 百层魔塔 | 100 层、确定性战斗预览、拾取记录、商店、10 首领与塔顶结局 |

## 存档

`campaign-save.js`：主键 `litegame.<id>.campaign`，备份 `<主键>.backup`。格式版本 1，游戏标识、内容校验与规则校验同时通过才载入。每次变化保存前保留上份有效进度；相同内容不轮换备份。主档坏时尝试备份，未来版本拒绝自动覆盖，多标签页冲突停止写入。菜单提供导出、导入及恢复备份；完成故事不清档。

此为本地存档，不是云同步。换设备或清理站点数据前导出 JSON。导入校验用于发现错误文件，不是防作弊或加密机制。

## 验证

`tests/chronicles.test.cjs` 通过合法规则动作走完六款主线；`tests/campaigns.browser.cjs` 检查移动尺寸操作、刷新、导入导出和多标签页。开源移植使用 `port-shell.js` 与同一存档协议，具体恢复边界见各自 `SOURCE.md`。

## Shared adaptation license

Copyright (c) 2026 LiteGame contributors

`campaign-save.js`, `port-shell.js` and `port.css` are dual-licensed: choose MIT below or GNU GPL version 2 or any later version (full GPL text in `../bounce-back/LICENSE`).

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
