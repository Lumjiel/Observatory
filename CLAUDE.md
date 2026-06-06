# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Terminal Observatory — 终端观测站

个人学习数据监控中心，终端风格单页应用 + Markdown 博客。

| 项 | 值 |
|:---|:---|
| GitHub | `Lumjiel/Observatory` |
| 服务器路径 | `/var/www/observatory/` |
| 访问地址 | https://observatory-jie.duckdns.org/observatory/ |
| 管理后台 | `/observatory/admin` |
| 运行方式 | Express 端口 8080，PM2 管理 |
| 静态站点生成 | Eleventy 3 (Nunjucks 模板) |
| 模块系统 | ESM (`"type": "module"`) |

## 开发命令

```bash
npm run dev           # 开发模式：JS/CSS 构建 + Eleventy --serve + 热更新
npm run build         # 本地完整构建（不含 BASE_PATH）
npm run build:prod    # 生产构建（注入 BASE_PATH=/observatory，需 cross-env）
npm run server        # 只启 Express API 服务器（不构建）
npm run scan:articles # 扫描 src/articles/ 生成 articles.json
npm run fetch-github  # 抓取 GitHub 数据生成 github.json
npm run new-article   # 交互式创建新文章
npm run optimize-images # 压缩 src/img/ 下的图片（递归子目录）
```

## 环境变量

`.env` 文件（被 gitignore）：

| 变量 | 说明 |
|:---|:---|
| `ADMIN_PASSWORD` | 管理后台密码（必须，否则 Express 启动失败） |
| `GITHUB_TOKEN` | GitHub API token（`github-scraper.mjs` 需要） |
| `BASE_PATH` | **本地留空**，生产构建由 `build:prod` 脚本设置为 `/observatory` |

> ⚠️ **Git Bash 注意：** `.env` 中 `BASE_PATH=/observatory` 会被 Git Bash 转成 Windows 路径 `E:/develop/Git/Git/observatory`。本地开发时 `BASE_PATH` 必须留空，生产构建用 `cross-env` 处理。

## 分支策略

| 分支 | 用途 |
|:---|:---|
| `main` | 本地开发，push 到 GitHub |
| `server` | 服务器运行，从 main 合并后推送 |

**部署流程：**
1. 本地在 `main` 改 → `git push`（GitHub Actions 自动同步到 Gitee）
2. 合并部署：`git checkout server && git merge main && git push && git checkout main`
3. 服务器更新：

```bash
python E:\claudecode\云服务器\scripts\ssh_connect.py "cd /var/www/observatory && git pull origin server && npm run build:prod && pm2 restart observatory"
```

同步链路：`本地 → GitHub → GitHub Actions → Gitee → 服务器 pull`

## 构建管道

`npm run build` 按顺序执行 6 步：

1. **`build-js.mjs`** — esbuild 打包 `src/assets/js/` → `_site/js/bundle.js`
2. **`build-css.mjs`** — PostCSS 处理 `src/assets/css/` → `_site/css/`
3. **`article-scanner.mjs`** — 扫描 `src/articles/` 生成 `src/_data/articles.json`
4. **`optimize-images.mjs`** — 压缩 `src/img/` 下的图片（sharp，递归子目录）
5. **`github-scraper.mjs`** — 调用 GitHub API 生成 `src/_data/github.json`（异步不阻塞）
6. **`eleventy`** — 用 Nunjucks 模板 + JSON 数据生成静态 HTML

## 架构

### 数据流

```
src/articles/ (Markdown)
    ↓ article-scanner.mjs
src/_data/articles.json  ← Eleventy collection
    ↓ Eleventy 渲染
_site/*.html             ← 静态输出

Express (article-api.mjs)
    ↓ 运行时中间件拦截 HTML
    ↓ 注入最新 SITE_DATA 到 <script>
    → 管理后台 CRUD 直接读写 src/articles/
    → 图片上传同时写 content/images/ + _site/img/
```

### 关键路径

| 路径 | 说明 |
|:---|:---|
| `scripts/article-api.mjs` | Express 服务器（管理后台 + API + 静态文件托管） |
| `scripts/utils/article-service.mjs` | 文章 CRUD 统一数据层 |
| `scripts/templates/admin-panel.html` | 管理后台 HTML 模板 |
| `eleventy.config.js` | Eleventy 配置（filters、shortcodes、collections） |
| `src/layouts/base.njk` | 基础布局（状态栏、RSS 链接、命令框） |
| `src/layouts/article.njk` | 文章详情布局（返回顶部、prev/next 导航） |
| `src/pages/articles.njk` | 文章列表页（排序、搜索、tag 筛选、分页） |
| `src/pages/sitemap.njk` | sitemap.xml 生成 |
| `src/assets/css/articles.css` | 文章列表页样式（独立文件） |
| `src/assets/css/article-detail.css` | 文章详情页样式（独立文件） |
| `src/assets/js/modules/` | 前端模块（router、commands、renderers） |
| `src/articles/` | Markdown 文章（按分类：blog/tutorials/essays/projects） |

### 文章系统

- **文章列表页** (`/articles/`)：排序（最新/最早）、搜索框、tag 筛选（10 个高频标签）、分页（每页 10 篇）
- **文章详情页**：移动端 0.75x 缩放、发布/更新双日期、返回顶部按钮、prev/next 导航
- **时间字段**：`date` 保留原始格式，`updateArticle` 不覆盖发布日期，新增 `updated` 字段
- **图片压缩**：sharp 递归压缩 `src/img/` 子目录，构建时自动执行

### 子路径部署

所有资源路径在构建时通过 `BASE_PATH` 环境变量注入。Eleventy 数据层 `src/_data/env.js` 读取此变量，模板和 JS 中引用 `env.BASE_PATH` 拼接路径。管理后台使用 `__BASE_PATH__` 占位符，Express 渲染时替换。

## 运维守则

- 改 `article-api.mjs` → 必须重启 PM2
- 改 `admin-panel.html` 模板 → 重启 Express
- 改前端 JS/CSS → `npm run build:js` / `npm run build:css`（或 dev 模式自动重建）
- 服务器上 `node_modules/`、`_site/`、`content/`、`.env`、`logs/` 被 gitignore
- `github-scraper.mjs` 异步执行，不阻塞启动
- **本地不要跑 `build:prod`**，会把路径改成 `/observatory/...`，本地预览用 `npm run build`
