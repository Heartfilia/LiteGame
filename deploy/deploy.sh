#!/usr/bin/env bash
#
# LiteGame 轻量游戏厅 · 部署脚本（Debian / Ubuntu，纯静态站点）
#
# 用法：
#   sudo ./deploy/deploy.sh          # 首次同步文件，检查已有 Nginx 配置
#   sudo ./deploy/deploy.sh update   # 日常更新（只复制文件，无需重启）
#
# 前置条件：
#   - 已安装 Nginx（nginx -v 能输出版本）
#   - 系统使用 systemd
#
# 本项目是纯前端静态站，没有后端进程，因此：
#   - 不需要 Node.js、不需要 systemd 应用服务
#   - 只需要把文件放到站点目录，再挂一份 Nginx 配置

set -euo pipefail

# 站点根目录，与 deploy/nginx.conf 中的 root 保持一致
APP_DIR="${APP_DIR:-/opt/litegame}"

# install = 首次完整部署；update = 日常更新（改完代码后同步）
MODE="${1:-install}"
case "$MODE" in
  install|update) ;;
  *) echo "未知参数：$MODE（可用：install / update）" >&2; exit 2 ;;
esac

# 脚本所在目录的上一级 = 项目根目录
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

# ------------------------------ 前置检查 ------------------------------

[ "$(id -u)" -eq 0 ] || die "请用 root 运行：sudo $0"

command -v nginx >/dev/null 2>&1 || die "未找到 nginx，请先安装：sudo apt install nginx"
command -v systemctl >/dev/null 2>&1 || die "未检测到 systemd，本脚本仅适用于使用 systemd 的发行版"
command -v rsync >/dev/null 2>&1 || die "未找到 rsync，请先安装：sudo apt install rsync"
command -v realpath >/dev/null 2>&1 || die "未找到 realpath，请先安装 coreutils"

# --delete-excluded 会清理旧部署中非公开文件，仅允许独立的站点目录。
APP_DIR="$(realpath -m "$APP_DIR")"
SRC_DIR="$(realpath "$SRC_DIR")"
case "$APP_DIR" in
  /|/opt|/var|/var/www|/home|/root|/etc|/usr|/srv|/tmp) die "APP_DIR 必须是专用站点子目录" ;;
esac
case "$APP_DIR/" in "$SRC_DIR/"*) die "站点目录不能位于源码目录内" ;; esac
case "$SRC_DIR/" in "$APP_DIR/"*) die "站点目录不能包含源码目录" ;; esac
[ -f "$SRC_DIR/deploy/publish.rules" ] || die "缺少发布规则 deploy/publish.rules"
# 不允许源码符号链接将站点指向工作区之外的文件。
[ -z "$(find "$SRC_DIR/assets" "$SRC_DIR/games" -type l -print -quit)" ] || die "assets/games 中存在符号链接，请改为实际公开资源"
[ ! -L "$SRC_DIR/index.html" ] || die "首页不能是符号链接"

# 在更新文件前检查现有配置，避免配置已损坏时仍继续发布。
nginx -t || die "Nginx 配置校验失败，请先修复配置"

[ -f "$SRC_DIR/index.html" ] || die "未找到 $SRC_DIR/index.html，请在项目根目录内运行本脚本"

log "源目录：$SRC_DIR"
log "站点目录：$APP_DIR"

# ------------------------------ 复制文件 ------------------------------

log "同步站点文件到 $APP_DIR"
mkdir -p "$APP_DIR"

# 仅发布首页、assets/、games/；清掉旧部署遗留的 .git、tests、deploy、秘密文件。
# APP_DIR 是发布产物目录，不应放证书、备份、上传文件或其他站点。
rsync -a --delete --delete-excluded \
  --filter="merge $SRC_DIR/deploy/publish.rules" \
  "$SRC_DIR"/ "$APP_DIR"/

# 静态文件全局可读即可，避免出现权限导致的 403
chown -R root:root "$APP_DIR"
find "$APP_DIR" -type d -exec chmod 755 {} +
find "$APP_DIR" -type f -exec chmod 644 {} +

# SELinux 开启时（Amazon Linux / RHEL / CentOS），不给目录打标签 Nginx 会 403
if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce 2>/dev/null)" = "Enforcing" ]; then
  log "SELinux 为 Enforcing，设置站点目录标签"
  chcon -R -t httpd_sys_content_t "$APP_DIR" || warn "标签设置失败，若出现 403 请检查：ls -Z $APP_DIR"
fi

log "文件已就位："
find "$APP_DIR" -maxdepth 2 | sort | sed 's|^|    |'

# 核心文件校验，缺了首页直接不可用
for f in index.html \
         assets/css/style.css \
         assets/js/games.js \
         assets/js/main.js; do
  [ -f "$APP_DIR/$f" ] || die "缺少文件：$APP_DIR/$f"
done
[ -f "$APP_DIR/assets/images/favicon.svg" ] || warn "缺少站点图标：$APP_DIR/assets/images/favicon.svg（页面仍可用，只是标签页没有图标）"

# ---------------------------- 安装 Nginx 配置 ----------------------------

if [ "$MODE" = "install" ]; then
  # Nginx 配置在服务器 /etc/nginx/nginx.conf 的 game.litetools.top 两个 server 块里
  # （参考本目录 nginx.conf），本脚本只负责同步站点文件，不改动 Nginx 配置。

  # 历史遗留检查：这些位置若还有旧配置，会与 nginx.conf 里的域名声明冲突
  if [ -f /etc/nginx/conf.d/litegame.conf ]; then
    warn "检测到遗留的 /etc/nginx/conf.d/litegame.conf，会与 nginx.conf 的 game 块冲突（conflicting server name）"
    warn "处理：sudo mv /etc/nginx/conf.d/litegame.conf /etc/nginx/conf.d/litegame.conf.bak"
  fi
  if [ -e /etc/nginx/sites-enabled/default ] && grep -rq "game.litetools.top" /etc/nginx/sites-enabled/default; then
    warn "检测到 sites-enabled/default 里也有 game.litetools.top 的旧配置（Certbot 时代遗留）"
    warn "处理：sudo mv /etc/nginx/sites-enabled/default /etc/nginx/default.bak"
  fi

  warn "Nginx 配置参考 deploy/nginx.conf，实际生效位置：/etc/nginx/nginx.conf 的 game.litetools.top 块。"
else
  log "update 模式：只同步站点文件，不动 Nginx 配置"
fi

# -------------------------------- 自检 --------------------------------

nginx -t || die "Nginx 配置校验失败，请检查 /etc/nginx/nginx.conf"
systemctl reload nginx

sleep 1
if command -v curl >/dev/null 2>&1; then
   if curl -fsS -o /dev/null --max-time 3 --resolve 'game.litetools.top:443:127.0.0.1' "https://game.litetools.top/"; then
    log "本机自检通过：站点可访问"
  else
    warn "本机自检失败：请检查 nginx 是否在运行（systemctl status nginx）"
  fi
fi

if [ "$MODE" = "install" ]; then
  cat <<EOF

────────────────────────────────────────────────
 部署完成（首次安装）

   站点目录：  $APP_DIR
   Nginx 配置：/etc/nginx/nginx.conf 的 game.litetools.top 块
              （参考副本在 deploy/nginx.conf，改配置时以它为准手工同步）

 还需完成：
   1. 确认 /etc/nginx/nginx.conf 里 game 块的 server_name / 证书路径正确
   2. 放行防火墙 80 / 443
   3. 以后更新代码：在本地改完后把项目同步到服务器任意目录，再执行
      sudo /path/to/LiteGame/deploy/deploy.sh update
      （或直接 rsync 到 $APP_DIR 也行，纯静态站无需重启任何服务）
────────────────────────────────────────────────
EOF
else
  cat <<EOF

────────────────────────────────────────────────
 代码已更新（update 模式）

   站点目录：  $APP_DIR
   纯静态站点即时生效，无需重启服务。
   HTML 不缓存，CSS/JS 每次发布时重新向 Nginx 验证；浏览器仍可能保留
   当前页面的 bfcache，验证时可关闭页面后重新打开，或检查响应头。
────────────────────────────────────────────────
EOF
fi
