# 每区二十款扩充

2026-11-09：非怀旧游戏从 77 款扩充到 180 款，RPG、赛车、动作、益智、桌游、卡牌、休闲、音乐、体育均为 20 款。

| 新增来源 | 数量 | 记录 |
|---|---:|---|
| ABA / crisp-game-lib-games、crisp-game-lib-11-games | 37 | `../crisp/manifest.json`、`../crisp/SOURCE.md` |
| choganhq/chogan | 13 | `chogan-expansion.json`、各游戏的 `SOURCE.md` |
| LiteGame 原创小型游戏 | 53 | `collection-data.js`、`collection-engines.js`、`collection-ui.js` |

开源移植均为 MIT，完整许可证在本地保留。原创部分使用共享引擎家族：十二个职业探索短篇、十一种驾驶挑战、十五种听音／节奏练习、八种经典单人接龙规则、七种体育挑战。同一家族共享绘制与生命周期，各条目的规则或任务机制单独配置。

## 运行与保存

- 所有执行资源本地加载，无运行时 GitHub/CDN、账号或后端依赖。
- ABA 游戏脚本保留原文；外层中文操作说明，游戏内英文短文本保留。
- ABA 保存本机最高分和音效设置；暂停保留本页的一局，刷新重新开始。其 `litegame.crisp.*` 数据不包含在原有 Chogan 存档导出中。
- 原创游戏通过 LiteArcade 保存当前进度；卡牌另提供大按钮选牌区。
- Chogan 弹棋、足球使用独立 `cue-expansion.js`。
- 音乐由 Web Audio 合成。节奏练习暂停后可点击“听音 / 开始”重启当前轮，重新对齐示范。

## 维护

```sh
python3 deploy/import-h5.py
python3 deploy/import-chogan-expansion.py
node deploy/build-original-games.cjs
```

导入固定上游提交和 npm 版本；ABA npm 下载验证 SHA-512，游戏记录 SHA-256。生成脚本用明确标记替换自己的目录区块。自动操作和规则测试不等同于所有随机牌局或每个上游游戏的完整通关认证；检查范围见 `../../tests/AUDIT.md`。
