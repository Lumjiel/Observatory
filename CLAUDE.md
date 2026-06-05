# Terminal Observatory — 终端观测站

## 项目基本信息

| 项目 | 值 |
|:---|:---|
| 本地路径 | `E:\project\terminal-observatory` |
| GitHub | `Lumjiel/Observatory` |
| 服务器路径 | `/var/www/observatory/` |
| 访问地址 | https://observatory-jie.duckdns.org/observatory/ |
| 管理后台 | `/observatory/admin` |
| 运行方式 | Express 端口 8080，PM2 管理 |
| 静态站点生成 | Eleventy (`npm run build`) |

## 分支策略

| 分支 | 用途 |
|:---|:---|
| `main` | 本地开发，最新代码。push 到 GitHub |
| `server` | 服务器运行。从 main 合并后推送，服务器 pull |

**工作流：**
1. 本地在 `main` 改 → commit → push
2. 部署：`git checkout server && git merge main && git push`
3. 服务器：`git pull origin server` 或 git bundle 推送

## 部署

### 常规部署（GitHub 可用时）

```bash
# 在 云服务器 项目下
cd E:\claudecode\云服务器
bash scripts/deploy-observatory.sh
```

### 服务器手动更新

```bash
ssh root@49.234.178.53 -p 22222
cd /var/www/observatory
git pull origin server
npm run build:prod
pm2 restart observatory
```

### GitHub 超时备用方案（git bundle）

```bash
# 1. 本地生成 bundle
git bundle create deploy.bundle main server
# 2. SCP 到服务器
scp -P 22222 deploy.bundle root@49.234.178.53:/var/www/observatory/
# 3. 服务器上
git fetch deploy.bundle main:refs/remotes/origin/main server:refs/remotes/origin/server
git merge origin/server --ff-only
npm run build:prod
pm2 restart observatory
rm deploy.bundle
```

## PM2 管理

```bash
# 服务器上
pm2 status                     # 查看进程状态
pm2 logs observatory --lines 100   # 查看日志
pm2 restart observatory        # 重启
pm2 stop observatory           # 停止
```

## 本地开发

```bash
npm run dev        # 开发模式（热更新）
npm run build      # 完整构建
npm run server     # 启动 Express 服务器（不构建）
```

## 关键文件

| 文件 | 说明 |
|:---|:---|
| `scripts/article-api.mjs` | Express API 服务器（管理后台 + API） |
| `scripts/utils/article-service.mjs` | 文章 CRUD 统一数据层 |
| `scripts/templates/admin-panel.html` | 管理后台模板 |
| `eleventy.config.js` | Eleventy 静态站点生成配置 |
| `DEPLOY_SERVER.md` | 完整部署指南 |
| `content/articles/` | Markdown 文章（被 gitignore，非代码文件） |

## 架构要点

- 部署在 `/observatory/` 子路径，所有资源路径通过构建时 `BASE_PATH` 注入
- Express 运行时中间件拦截 HTML，注入最新 `SITE_DATA`
- 管理后台使用 `__BASE_PATH__` 占位符，渲染时替换为实际路径
- 图片上传同时写入 `content/images/` 和 `_site/img/`，无需等待重建即可访问

## 运维守则

- 改 `article-api.mjs` 后必须重启 PM2
- 改模板（`admin-panel.html`）后重启 Express 服务器
- `npm run build` 是完整构建（JS + CSS + 文章扫描 + GitHub 数据 + Eleventy）
- 服务器上 `node_modules/`、`_site/`、`content/`、`.env`、`logs/` 被 gitignore
