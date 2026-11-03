#!/usr/bin/env bash
#
# LiteGame 轻量游戏厅 · 部署脚本（Debian / Ubuntu，纯静态站点）
#
# 用法：
#   sudo ./deploy/deploy.sh          # 首次完整部署（装 Nginx 配置 + 复制文件）
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
CONF_NAME="litegame.conf"

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

[ -f "$SRC_DIR/index.html" ] || die "未找到 $SRC_DIR/index.html，请在项目根目录内运行本脚本"

log "源目录：$SRC_DIR"
log "站点目录：$APP_DIR"

# ------------------------------ 复制文件 ------------------------------

log "同步站点文件到 $APP_DIR"
mkdir -p "$APP_DIR"

# --delete：删掉线上已不存在于源目录的旧文件，保证两边一致；
# 排除 deploy/ 自身与 .git
rsync -a --delete \
  --exclude 'deploy/' \
  --exclude '.git/' \
  --exclude '.DS_Store' \
  "$SRC_DIR"/ "$APP_DIR"/

# 静态文件全局可读即可，避免出现权限导致的 403
chown -R root:root "$APP_DIR"
chmod -R a+rX "$APP_DIR"

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
  log "安装 Nginx 站点配置 /etc/nginx/conf.d/${CONF_NAME}"
  install -o root -g root -m 644 "$SRC_DIR/deploy/nginx.conf" "/etc/nginx/conf.d/${CONF_NAME}"

  warn "请编辑 /etc/nginx/conf.d/${CONF_NAME}，把 server_name 改成你的域名（当前是 litegame.example.com）"
else
  log "update 模式：保留现有 Nginx 配置，不重新生成"
fi

# -------------------------------- 自检 --------------------------------

nginx -t || die "Nginx 配置校验失败，请检查 /etc/nginx/conf.d/${CONF_NAME}"
systemctl reload nginx

sleep 1
if command -v curl >/dev/null 2>&1; then
  if curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1/"; then
    log "本机自检通过：/ 返回 200"
  else
    warn "本机自检失败：可能 server_name 尚未改成实际域名，默认 server 段不响应 127.0.0.1。
       可先用 curl -H 'Host: litegame.example.com' http://127.0.0.1/ 验证。"
  fi
fi

if [ "$MODE" = "install" ]; then
  cat <<EOF

────────────────────────────────────────────────
 部署完成（首次安装）

   站点目录：  $APP_DIR
   Nginx 配置：/etc/nginx/conf.d/$CONF_NAME

 还需完成：
   1. 编辑 /etc/nginx/conf.d/$CONF_NAME
      把 server_name 改成你的域名，然后 sudo systemctl reload nginx
   2. 申请 HTTPS 证书
      sudo apt install certbot python3-certbot-nginx
      sudo certbot --nginx -d 你的域名
   3. 放行防火墙 80 / 443
   4. 以后更新代码：在本地改完后把项目同步到服务器任意目录，再执行
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
   浏览器可能缓存了旧资源，验证时建议用无痕窗口。
────────────────────────────────────────────────
EOF
fi
