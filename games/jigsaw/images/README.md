# 自由拼图图片

这批图片由项目维护者提供，来源目录为本机 `Pictures/game`，用于自由模式（100／400 块）。它们不属于 Chogan 原有代码绘制图案。

处理方式：按 EXIF 方向校正，中心裁剪为 3:4，Lanczos 缩小到最高 1200×1600，WebP quality=86 / method=6。较小的胡桃图片输出 1080×1440，不放大。

- 6 张源 PNG 合计 56,360,642 字节。
- 6 张 WebP 合计 1,167,058 字节，约减少 97.9%。
- 原始图片不被修改，网页只加载当前局使用的图片。
- `manifest.json` 记录源文件名、哈希、原始尺寸、裁剪区域和输出大小；`catalog.js` 为静态网页使用的同一份目录。
- 图片 ID 基于源文件 SHA-256，已存在存档绑定对应图片，不随目录顺序改变。

重新生成（需要 Pillow）：

```sh
python3 deploy/prepare-jigsaw-images.py /path/to/pictures
```

新增／替换图片时保留仍被存档引用的旧 ID 和资源，或显式迁移存档。经典模式继续使用 `JigsawPictures()` 中的原有绘图。
