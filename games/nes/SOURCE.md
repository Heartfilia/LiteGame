# 怀旧 FC / NES 分区

## 游戏文件

来源：用户指定的 https://github.com/mengfei523060/nesrom 。精确提交与每个文件的来源路径、SHA-256、Mapper 和启动检查结果记录在 `catalog.json`。

当前导入固定提交 `8f7abad7996f8ec98c798dee5b69456603a82dd0` 下的 932 个卡带文件。目录数包含不同版本与改版，不代表 932 款独立游戏。

仅导入 `.nes` 文件，不发布来源仓库的 APK。相同 SHA-256 共用一个 ROM 文件；不同名称仍保留独立目录入口。来源仓库未声明统一许可证，游戏文件不属于 JSNES 的 Apache-2.0 授权范围。

## 模拟器

JSNES **2.1.0**，https://github.com/bfirsh/jsnes ，Apache-2.0。
`vendor/jsnes.min.js` 来自 npm 固定版本发行包，原始许可证随 `vendor/LICENSE` 保留。本项目编写目录、触屏操作、音频输出、即时存档和静态部署适配层。

## 兼容性边界

目录中的“启动已检查”指自动化执行初始帧、按下 START 并继续运行，没有抛出模拟器异常。它不等同于完整通关、声音准确性或所有关卡的验证。不支持的 Mapper、异常卡带保留目录与原因，可选择其他版本。

支持键盘双人输入和手机玩家一多点触控；光枪、麦克风、四人扩展等特殊配件未接入。存档绑定 ROM 内容 SHA-256 和模拟器版本，使用 IndexedDB 保存；大厅的 localStorage 导出不包含这里的存档，请使用游戏页面的导出功能。

## 更新目录

在项目根目录运行：

```sh
python3 deploy/fetch-nes.py /path/to/nesrom.zip --revision <source-commit>
python3 deploy/import-nes.py /path/to/nesrom.zip --revision <source-commit>
node tests/nes-audit.cjs
python3 deploy/publish-nes.py
```

发布前将 `games/nes/`、新封面、`assets/js/games.js` 与首页代码一起部署。Nginx 对 `.nes`、`.json` 也需使用协商缓存策略。
