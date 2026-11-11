# Ai飞车 / AiCF·运输船

## 来源

- 原作者：riba2534，仓库 https://github.com/riba2534/claude-opus-5-5-demo
- 固定版本：`54adc1fb64155f9dd7c1c90ecae7b8185ac540b8`
- 对应目录：`qq-speed/src`、`cf-transport-ship/src`。
- 用户提供的试玩地址：
  - https://lf3-static.bytednsdoc.com/obj/eden-cn/nulojnulwlo/qqfeiche3d/index.html
  - https://lf3-static.bytednsdoc.com/obj/eden-cn/nulojnulwlo/cf-transport-ship/transport-ship.html
- `ai-3d-manifest.json` 记录导入时上游各源文件 SHA-256；本地 `src` 为适配后的可读源码。
- 上游飞车 package.json 标记 ISC；运输船 package.json 未声明许可证，所检版本无仓库级 LICENSE，不将它标记为 MIT。两款均保留原作者源码链接。各自 `THREE-LICENSE` 是打包使用的 Three.js MIT 许可。

## 站点适配

- 展示名称、页面标题、赛车广告牌；新封面；赛车／射击游戏分区及搜索收藏。
- 本地打包 Three.js 与游戏代码，无运行时外部资源依赖；普通静态 HTTP 服务即可运行。
- 共享工具栏：返回分区、游戏厅、收藏、全屏、暂停。保留 WebGL 错误下的导航。
- 手机横屏提示、安全区和紧凑 HUD、44px 以上动作目标；运输船重写独立移动／视角／开火指针捕获，支持多点触控与取消释放。
- 失焦／后台暂停和释放按键；运输船鼠标锁定失败时提供按住鼠标拖动瞄准回退。
- 设置键 `litegame.ai-speed.settings`、`litegame.ai-cf.settings`，纳入大厅进度备份。保存的是选项配置，不是中途比赛／战斗快照。

## 构建

生产文件 `index.html`、`game.js` 已提交，无需服务器安装 Node。
开发时在项目外安装固定依赖：飞车 `three@0.169.0 esbuild@0.28.2`，运输船 `three@0.186.0 esbuild@0.28.2`。

```sh
AI_SPEED_MODULES=/path/to/speed/node_modules \
AI_CF_MODULES=/path/to/cf/node_modules \
node deploy/build-ai-games.cjs
```

`deploy/import-ai-games.py` 仅用于首次从固定版本解压目录导入，已有适配源码时会拒绝覆盖；日常改动修改 `src` 后执行构建。
