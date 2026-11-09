# LiteGame 静态站部署防护

## 风险与边界

本站由 Nginx 直接提供静态 HTML/JS/图片，没有登录接口、服务端上传或数据库。游戏运行和存档导入在访客浏览器中完成，正常访问不会直接执行服务器命令。

但暴露公网仍有风险：

- **入侵**：系统／Nginx 漏洞、SSH 口令泄露、其他同机服务漏洞、Web 根目录泄露密钥等。
- **可用性**：大量 HTTP 请求耗尽连接、CPU、磁盘日志或流量；大流量 DDoS 可在请求到达 Nginx 前占满带宽。
- **费用**：流量攻击和大量下载可能增加出口费用。

本次仓库加固不等于已审计或修改服务器，也不证明服务器未被入侵。Nginx 限速能缓解部分 HTTP 滥用，不能替代 CDN／云厂商的 DDoS 清洗。

## 1. 项目已提供的加固

- `publish.rules` 仅发布首页、`assets/`、`games/`，排除隐藏文件、常见密钥、备份与服务端脚本；保留游戏运行源码、许可证及来源链接。
- `deploy.sh` 拒绝运行资源中的符号链接；发布文件归 root 所有，目录 755、文件 644，普通 Nginx worker 不应有写权限。
- `nginx.conf` 拦截隐藏／敏感路径；只接受 GET/HEAD；关闭目录列表和符号链接访问；限制请求体、超时、Range 及单 IP 请求／并发。
- 安全响应头：`nosniff`、同源嵌入限制、Referrer Policy、基础 CSP。当前大量游戏有内联脚本和 Blob Worker，不能直接套用禁止内联脚本的严格 CSP；这里的基础策略也不等于完整 XSS 防护。
- 不存在的路径返回 404；HTTP 跳转固定域名，避免使用访客提交的 Host 构造跳转。
- 当前文件名没有内容 hash：HTML 使用 `no-store`，CSS/JS/图片/字体使用 `no-cache, must-revalidate`。这样手机刷新会重新验证所有可替换资源，未变化的文件仍可用 304，发布后的修改不会被旧的强缓存遮住。

限速初值为单 IP **30 请求/秒、突发 120、并发请求 50**，超限返回 429。HTTP/2 下并发流也计入 Nginx `limit_conn`；这些限制不是原始 TCP 连接总量限制。多人共享出口、快速切换游戏、CDN 回源可能触发阈值，应结合 429 和正常访问日志调整，不要直接降到 1 请求/秒。

## 2. 如何上线

### 发布文件

`APP_DIR` 必须是本站专用发布目录，默认 `/opt/litegame`。新版同步使用 `--delete-excluded`，会清理旧部署中不符合发布规则的文件。证书保留在 `/etc/letsencrypt`，ACME 验证文件保留在 `/var/www/html`；不要把备份、源码仓库或其他站点放在 `APP_DIR` 内。

```sh
sudo bash deploy/deploy.sh update
```

此命令**不会安装新的 Nginx 配置**。如曾把真实密钥发布到 Web 根目录，移除文件后仍须轮换相应凭据；路径拦截不能撤销已泄露的信息。

### 更新 Nginx

1. 先查看实际布局：`sudo nginx -T`。输出可能含内部地址等信息，不要直接公开全文。
2. 备份现有配置：`sudo cp -a /etc/nginx/nginx.conf /etc/nginx/nginx.conf.before-litegame-hardening`；若站点在独立 include 文件中，也备份该文件。
3. `deploy/nginx.conf` 是 **`http {}` 内片段**，不要覆盖整个 `/etc/nginx/nginx.conf`。将两个 `limit_*_zone` 放在 `http {}` 内、`server {}` 外；替换本站原有两个 server 块，其他站点保持原配置。不要同时在 `conf.d` 和主文件重复加载本站配置。
4. 确认域名、`root`、证书路径、Certbot 参数及 ACME webroot 与服务器实际一致。文件中的 `listen ... http2` 是兼容旧版本的写法，新版 Nginx 可能提示改用 `http2 on;`。
5. 验证后重载：

```sh
sudo nginx -t && sudo systemctl reload nginx
curl --resolve game.litetools.top:443:127.0.0.1 -I https://game.litetools.top/
curl --resolve game.litetools.top:443:127.0.0.1 -I https://game.litetools.top/.git/config
curl --resolve game.litetools.top:443:127.0.0.1 -I https://game.litetools.top/tests/README.md
curl --resolve game.litetools.top:443:127.0.0.1 -I https://game.litetools.top/does-not-exist
curl --resolve game.litetools.top:443:127.0.0.1 -X POST -o /dev/null -w '%{http_code}\n' https://game.litetools.top/
```

预期首页 200，敏感／不存在路径 404，POST 405。再打开游戏确认 JS/CSS 的 Content-Type 正确、没有 429，并检查缓存头：

```sh
curl --resolve game.litetools.top:443:127.0.0.1 -sSI https://game.litetools.top/index.html | grep -iE 'cache-control|pragma|etag|last-modified'
curl --resolve game.litetools.top:443:127.0.0.1 -sSI https://game.litetools.top/assets/js/main.js | grep -iE 'cache-control|etag|last-modified'
```

首页应包含 `Cache-Control: no-store`，JS/CSS 应包含 `Cache-Control: no-cache, must-revalidate`。证书续期检查：`sudo certbot renew --dry-run`。

怀旧分区包含本地 `.nes` 卡带和 `.json` 目录，使用相同的 `no-cache, must-revalidate` 策略。游戏机按需下载选中的卡带，不会在首页下载整个 ROM 库。发布时需要同步整个 `games/nes/`（包含 `roms/`、`vendor/` 与目录文件）。

本地环境没有可运行的 Nginx／Docker daemon，因此提交前只能完成脚本语法及发布规则的本地检查；服务器上的 `nginx -t` 与实际响应验证是上线必需步骤。

未知 Host 在本站 server 中会被拒绝，但如果同机还有其他默认站点，它可能接收这类请求。可在核查现有默认站点后配置单独的 HTTP catch-all 和 HTTPS 默认拒绝站点；不要盲目增加重复的 `default_server`。Host 校验不是隐藏源站的方法，攻击者可以携带正确域名访问源站 IP。

## 3. 服务器侧优先做的事项

### 云安全组／防火墙

- 对外只开放所需的 80/443；SSH 的实际端口仅允许你的管理 IP／VPN。
- 检查 `sudo ss -lntup`，关闭不需要的公网监听；数据库、Redis、Docker API、管理面板不要直接暴露公网。
- 同时检查 IPv4 和 IPv6。禁止 IPv4 直连却放开 IPv6 会留下绕过路径。
- 修改 SSH 或防火墙前保留当前会话和云控制台入口，并用第二个会话验证能登录后再关闭旧会话。

不要照抄未知 SSH 端口的防火墙启用命令。先明确管理 IP、SSH 端口和同机服务，再设置规则，避免把自己锁在外面。

### SSH 与系统更新

- 使用独立管理用户＋SSH 密钥。验证密钥登录成功后再关闭密码登录和 root 远程登录。
- 修改 SSH 后先运行 `sudo sshd -t`，成功后按发行版重载 SSH 服务，并测试新会话。
- 定期安装系统、内核、Nginx 和 OpenSSL 安全更新；发行版会回移补丁，不能只按 Nginx 版本号判断是否修复漏洞。
- Nginx master 以 root 启动是常见方式，但 worker 应使用 `www-data`／`nginx` 等非特权用户，且不可写站点和配置文件。
- Fail2ban 可补充 SSH 爆破防护；它不是 DDoS 清洗服务。对 Web 429 一律封 IP 容易误伤 NAT／CDN。

## 4. DDoS：CDN／云防护比本机限速更重要

建议使用有 DDoS 防护的 CDN（如 Cloudflare 或所在云厂商 CDN／高防服务），让正常静态资源命中边缘缓存，并启用其基础 WAF／异常请求限速。避免所有页面都强制验证码，手机游戏体验会受影响。

正确接入顺序：

1. 开启域名 CDN 代理，验证 HTTPS；Cloudflare 场景采用 **Full (strict)**，不要用 Flexible。
2. 依据提供商官方最新列表，配置 Nginx `set_real_ip_from`，只信任 CDN 出口 CIDR，再设置该提供商的真实访客 IP 头（Cloudflare 为 `CF-Connecting-IP`）。确认 Nginx 包含 realip 模块。
3. 不要使用 `set_real_ip_from 0.0.0.0/0` 或 `::/0`，也不要未经验证信任任意 `X-Forwarded-For`；否则攻击者可伪造来源绕过限速和日志。
4. 对本站专用源站，在安全组／防火墙仅允许 CDN 出口访问 80/443，保留管理通道；同机其他直连站点需要单独设计入口。维护出口 IP 列表更新，可再使用源站认证／mTLS。
5. 检查日志是否显示真实访客 IP，实测首页、游戏、缓存更新及续期。限制回源后需确保 ACME HTTP-01 仍可通过 CDN 到达验证目录，或改用 DNS-01；Cloudflare 新规则应绕过 ACME 路径的挑战／缓存。

只把 DNS 切到 CDN 而源站仍对所有 IP 开放，攻击者可能通过历史 DNS 找到源站并绕过 CDN。域名解析到服务器本来就会暴露 IP；换域名不构成防护。

CDN 也不提供无限流量／绝对可用保证，应核查套餐的攻击防护、流量计费和资源限制。对这类纯静态项目，也可整体迁移到静态托管平台，减少自行维护公网主机的工作。

## 5. 日志、告警和备份

- Nginx 访问／错误日志位于 `/var/log/nginx/litegame.*.log`。检查发行版 `/etc/logrotate.d/nginx` 是否覆盖它们并设置保留期，避免攻击日志写满磁盘；不要叠加两份轮转规则。
- 设置 CPU、内存、带宽、连接数、磁盘容量、5xx／429 和流量费用告警。大量 404 扫描常见，但不等于已经入侵；结合系统登录记录与文件修改判断。
- 备份 Nginx 配置、部署代码及必要证书配置到站点目录之外，并保留恢复入口。不要把 `.env`／密钥放进代码仓库，即使当前过滤器会排除它们。
- 游戏进度保存在玩家浏览器，服务器备份不会备份玩家的 localStorage；玩家仍需使用已有存档导出功能。
