# 授权移植说明（ふるかわけい 作品）

## 授权来源

- 原作：ふるかわけい（Kei Furukawa）· <https://keifurukawafunnych.com>
- 取得方式：项目所有者与作者通过 Telegram 沟通后获得许可
- 授权范围（据所有者转述）：
  - ✅ 允许移植到 LiteGame，并翻译为中文
  - ✅ 允许在**中国地区**部署
  - ❌ **不得部署在日本**

> 口头/聊天授权同样有效，但建议把对话截图或邮件留存到 `deploy/license/`（不入公开仓库），
> 以便日后换机器、换域名或有人质疑时能出示。本文件只记录范围，不代替原始证据。

## 我们做了什么

`deploy/import-kf-games.cjs` 按清单 `deploy/kf-manifest.json` 从原作站点抓取页面，并做本地化改造：

| 改动 | 原因 |
| --- | --- |
| 移除 Google Analytics、站内广告脚本、canonical、JSON-LD | 不把原站统计与广告带进本项目 |
| 注入 `deploy/kf-zh/<slug>.js` 中文语言包，默认语言设为 `zh` | 日文界面 → 中文 |
| 语言下拉补「中文」选项 | 保留作者原有的 ja/ko/en/th，可随时切回 |
| three.js 由 jsDelivr CDN 改为 `games/lib/three/` 本地文件 | 国内访问 CDN 不稳定 |
| 「返回顶部」改为回 LiteGame 大厅 | 站内导航闭环 |
| 页脚保留原作者署名 | 署名要求 |

## 部署合规

**这是硬约束：本项目包含授权移植内容，不得部署在日本。**

- 生产环境放在中国大陆（或作者另行同意的地区）；不要选择日本区域的机房、CDN 节点或 Serverless 区域。
- 每次上线前跑一次：

```sh
node deploy/check-deploy-region.cjs --host 你的域名
```

脚本会解析目标域名的公网 IP 并查询所属国家；判定为日本时以退出码 1 结束，可直接接进 CI。
若你的 CDN 在日本有边缘节点，请与作者确认「边缘缓存」是否算部署——保守做法是排除日本节点。

- 新增移植游戏时，只需在 `deploy/kf-manifest.json` 增加条目、在 `deploy/kf-zh/` 放中文语言包，然后重跑导入脚本。

## 新增一款移植的步骤

1. 在 `deploy/kf-manifest.json` 里加 `{ slug, title, description, tags, originalTitle }`
2. 复制 `deploy/kf-zh/<slug>.js`，按该游戏语言表里的 key 写中文（含函数型文案时用箭头函数）
3. `node deploy/import-kf-games.cjs --only <slug>`
4. 打开 `games/kf-<slug>/index.html` 验证：默认中文、返回键回大厅、控制台无报错
5. 跑 `GAME_IDS=kf-<slug> node tests/all-games.browser.cjs` 看资源与布局

如果原作的界面文案不在语言表里（写死在 HTML 或 canvas 里），需要额外在语言包之外处理，
导入脚本只负责语言表、标题替换与静态资源。