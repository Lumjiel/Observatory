# 服务器部署指南

将「终端观测站」部署到 Linux 服务器，使用 PM2 管理进程。

---

## 一、环境要求

- Linux 系统（Ubuntu / Debian / CentOS）
- Node.js 18+
- Nginx（可选，推荐用于反向代理 + HTTPS）
- Git

---

## 二、基础环境安装

### 1. 安装 Node.js 18+

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证
node -v
npm -v
```

### 2. 安装 Nginx（可选）

```bash
sudo apt update
sudo apt install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3. 安装 Git

```bash
sudo apt install -y git
```

---

## 三、部署项目

### 1. 拉取代码

```bash
mkdir -p /var/www/observatory
cd /var/www/observatory
git clone https://github.com/Lumjiel/terminal-observatory.git .
```

### 2. 安装依赖

```bash
npm install
```

### 3. 准备文章内容

```bash
# 创建文章目录（可以从本地开发环境同步 content/ 目录）
mkdir -p content/articles/{tutorials,blog,essays,projects}
```

文章内容以 Markdown 文件形式存放在 `content/articles/{category}/` 下，不在 Git 仓库中管理。需要通过以下方式同步：
- 从开发环境通过 SCP/RSYNC 同步 `content/` 目录
- 或通过管理后台在线创建文章

### 4. 设置管理员密码

```bash
# 方式一（推荐）：使用 .env 文件
echo 'ADMIN_PASSWORD=your_secure_password' > .env

# 方式二：使用环境变量
export ADMIN_PASSWORD=your_secure_password
```

### 5. 创建日志目录

```bash
mkdir -p logs
```

### 6. 构建并测试

```bash
# 全量构建（JS 打包 + 文章扫描 + GitHub 数据 + Eleventy）
npm run build

# 启动服务测试
ADMIN_PASSWORD=your_secure_password npm run server
```

访问 `http://服务器IP:8080` 确认正常后 `Ctrl+C` 停止。

---

## 四、PM2 进程管理

### 1. 启动服务

```bash
npm run pm2:start
```

### 2. 常用命令

```bash
pm2 status                          # 查看进程状态
pm2 logs observatory                # 查看日志
pm2 restart observatory             # 重启
pm2 stop observatory                # 停止
pm2 delete observatory              # 删除进程
```

### 3. 开机自启

```bash
pm2 save
pm2 startup     # 按提示执行输出的命令
```

---

## 五、Nginx 反向代理（推荐）

### 1. 创建站点配置

```bash
sudo nano /etc/nginx/sites-available/observatory
```

`example.com` 替换为你的域名或服务器 IP：

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

> Express 服务器同时处理静态文件（`_site/`）和 API 路由（`/api`、`/admin`），所以将全部流量代理到 `127.0.0.1:8080` 即可。

### 2. 启用配置

```bash
sudo ln -s /etc/nginx/sites-available/observatory /etc/nginx/sites-enabled/
sudo nginx -t                    # 语法检查
sudo systemctl reload nginx      # 重载
```

### 3. HTTPS（Let's Encrypt）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d example.com
sudo certbot renew --dry-run
```

---

## 六、更新部署

```bash
cd /var/www/observatory
git pull                    # 拉取最新代码
npm install                 # 安装新依赖
npm run build               # 重新构建
pm2 restart observatory    # 重启服务
```

---

## 七、目录结构（部署后）

```
/var/www/observatory/
├── _site/                  # 静态文件（由 build 生成）
├── content/articles/        # Markdown 文章（独立管理）
├── scripts/                # 后端脚本
├── src/                    # 源代码
├── ecosystem.config.cjs     # PM2 配置
├── .env                    # 环境变量（含密码，勿提交）
├── logs/                   # PM2 日志
└── package.json
```

---

## 八、故障排查

```bash
# PM2 日志
pm2 logs observatory --lines 100

# Nginx 日志
sudo tail -f /var/log/nginx/error.log

# 端口检查
sudo lsof -i :8080

# 手动重启
sudo systemctl restart nginx
pm2 restart observatory
```

---

## 九、一行命令总结

```bash
cd /var/www/observatory && npm install && npm run build && pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
```
