# 服务器部署指南

本文档介绍如何将「终端观测站」部署到 Linux 服务器，使用 PM2 管理进程。

---

## 一、服务器环境要求

- Linux 系统（Ubuntu / Debian / CentOS 等）
- Node.js 18+
- Nginx（用于反向代理）
- Git（用于拉取代码）

---

## 二、基础环境安装

### 1. 安装 Node.js 18

```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证
node -v   # 应显示 v18.x.x
npm -v
```

### 2. 安装 Nginx

```bash
# Ubuntu / Debian
sudo apt update
sudo apt install -y nginx

# CentOS
sudo yum install -y nginx

# 启动并设置开机自启
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 3. 安装 Git

```bash
# Ubuntu / Debian
sudo apt install -y git

# CentOS
sudo yum install -y git
```

---

## 三、部署项目

### 1. 创建项目目录

```bash
sudo mkdir -p /var/www/observatory
sudo chown -R $USER:$USER /var/www/observatory
```

### 2. 拉取代码

```bash
cd /var/www/observatory
git clone https://github.com/你的用户名/terminal-observatory.git .
```

### 3. 安装依赖

```bash
npm install
```

### 4. 设置管理员密码

```bash
# 方式一：直接设置环境变量（临时，重启失效）
ADMIN_PASSWORD=你的密码 npm run server

# 方式二（推荐）：写入系统环境变量
echo 'ADMIN_PASSWORD=你的密码' | sudo tee -a /etc/environment

# 方式三：使用 .env 文件（适合普通用户部署）
echo 'ADMIN_PASSWORD=你的密码' > .env
```

### 5. 创建日志目录

```bash
mkdir -p logs
```

### 6. 本地测试运行

```bash
# 先执行构建
npm run build

# 启动服务（测试是否能正常运行）
ADMIN_PASSWORD=你的密码 npm run server

# 访问 http://服务器IP:8080 确认正常后 Ctrl+C 停止
```

---

## 四、配置 PM2 进程管理

### 1. 启动服务

```bash
# 安装依赖后直接启动（PM2 会读取 ecosystem.config.js）
npm run pm2:start
```

### 2. 常用命令

```bash
pm2 status                          # 查看进程状态
pm2 logs observatory                # 查看实时日志
pm2 restart observatory             # 重启服务
pm2 stop observatory                # 停止服务
pm2 delete observatory              # 删除进程
pm2 save                            # 保存当前进程列表（重启后自动恢复）
pm2 startup                         # 设置开机自启（运行后按提示执行输出的命令）
```

### 3. 开机自启配置

```bash
# 保存当前 PM2 进程列表
pm2 save

# 生成开机自启脚本（会输出一行命令，需要 sudo 执行）
pm2 startup

# 将输出的一行命令复制粘贴执行，例如：
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp /home/你的用户名
```

---

## 五、配置 Nginx 反向代理（可选但强烈推荐）

直接用 `http://IP:8080` 访问有以下问题：
- 端口暴露不安全
- 无法启用 HTTPS
- 无法绑定域名

### 1. 创建 Nginx 配置

```bash
sudo nano /etc/nginx/sites-available/observatory
```

写入以下内容（将 `example.com` 替换为你的域名或 IP）：

```nginx
server {
    listen 80;
    server_name example.com;        # 你的域名或服务器IP

    # 静态文件服务
    location / {
        root /var/www/observatory/_site;
        try_files $uri $uri/ =404;
    }

    # API 代理到 Express
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    # Admin 代理
    location /admin {
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

### 2. 启用配置

```bash
# 启用站点
sudo ln -s /etc/nginx/sites-available/observatory /etc/nginx/sites-enabled/

# 测试配置语法
sudo nginx -t

# 重载 Nginx
sudo systemctl reload nginx
```

### 3. 申请免费 HTTPS（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 申请证书（将 example.com 替换为你的域名）
sudo certbot --nginx -d example.com

# 自动续期测试
sudo certbot renew --dry-run
```

---

## 六、升级部署

代码更新时，只需在服务器上：

```bash
cd /var/www/observatory
git pull                    # 拉取最新代码
npm install                 # 安装新依赖（如有）
npm run build               # 重新构建
pm2 restart observatory    # 重启服务
```

---

## 七、目录结构

部署完成后的目录结构：

```
/var/www/observatory/
├── _site/                  # 静态文件（由 npm run build 生成）
├── scripts/                # 脚本（article-api.mjs 等）
├── src/                    # 源代码
├── ecosystem.config.cjs     # PM2 配置
├── .env                    # 环境变量（含密码，不要提交到 Git）
├── logs/                   # PM2 日志
└── package.json
```

---

## 八、故障排查

```bash
# 查看 PM2 日志
pm2 logs observatory --lines 100

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log

# 检查端口占用
sudo lsof -i :8080

# 重启所有服务
sudo systemctl restart nginx
pm2 restart observatory
```

---

## 九、一行命令总结

```bash
# 完整部署命令（假设已配置好域名/IP 和密码）
cd /var/www/observatory && npm install && npm run build && pm2 start ecosystem.config.js && pm2 save && pm2 startup
```
