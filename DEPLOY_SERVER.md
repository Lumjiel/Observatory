# 服务器部署指南

将「终端观测站」部署到 Linux 服务器，使用 PM2 管理进程。

---

## 环境要求

- Linux（Ubuntu / Debian / CentOS）
- Node.js 20+ LTS
- Nginx（可选，推荐用于反向代理 + HTTPS）
- Git

---

## 部署步骤

### 1. 安装 Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
```

### 2. 拉取代码并安装依赖

```bash
git clone https://github.com/Lumjiel/terminal-observatory.git /var/www/observatory
cd /var/www/observatory
npm install --production
```

### 3. 配置环境变量

```bash
echo 'ADMIN_PASSWORD=your_secure_password' > .env
```

### 4. 构建

```bash
npm run build
```

构建流程：JS 打包（esbuild）→ CSS 处理（PostCSS: autoprefixer）→ 文章扫描 → GitHub 数据拉取 → 静态站点生成（Eleventy）。

生产环境（带 CSS 压缩 + 自定义 BASE_PATH）：

```bash
npm run build:prod
```

### 5. PM2 启动

```bash
npm run pm2:start
pm2 save
pm2 startup
```

---

## Nginx 反向代理（推荐）

### 配置

```nginx
server {
    listen 80;
    server_name example.com;
    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Express 同时处理静态文件（`_site/`）和 API 路由（`/api`、`/admin`），全部流量代理到 `127.0.0.1:8080` 即可。

```bash
sudo ln -s /etc/nginx/sites-available/observatory /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
```

---

## 更新

```bash
cd /var/www/observatory
git pull
npm install --production
npm run build
pm2 restart observatory
```

---

## 目录结构

```
/var/www/observatory/
├── _site/                  # 构建产物（静态文件）
├── content/articles/       # Markdown 文章
├── scripts/                # 后端脚本
│   ├── article-api.mjs     # Express API 服务器
│   ├── build-js.mjs        # esbuild 前端打包
│   ├── build-css.mjs       # PostCSS 样式处理
│   ├── dev.mjs             # 开发模式（热更新）
│   ├── optimize-images.mjs # 图片压缩
│   └── ...
├── src/                    # 源代码
├── postcss.config.js       # PostCSS 配置
├── ecosystem.config.cjs    # PM2 配置
├── .env                    # 环境变量（含密码，勿提交）
└── package.json
```

---

## 故障排查

```bash
pm2 logs observatory --lines 100          # 应用日志
sudo tail -f /var/log/nginx/error.log     # Nginx 日志
sudo lsof -i :8080                        # 端口检查
pm2 restart observatory                   # 重启应用
```