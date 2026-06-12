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
npm run import:article # 从日志条目导入文章
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

单一 `main` 分支，本地开发和服务器运行同一分支。

**部署流程：**
1. 本地改完 → `git push`（GitHub Actions 自动同步到 Gitee）
2. 服务器部署：

```bash
python E:\claudecode\云服务器\scripts\ssh_connect.py "cd /var/www/observatory && git pull origin main && npm run build:prod && pm2 restart observatory"
```

同步链路：`本地 → GitHub → GitHub Actions → Gitee → 服务器 pull`

## 构建管道

`npm run build` 按顺序执行 6 步：

1. **`build-js.mjs`** — esbuild 打包 `src/assets/js/` → `_site/js/bundle.js`
2. **`article-scanner.mjs`** — 扫描 `src/articles/` 生成 `src/_data/articles.json`
3. **`optimize-images.mjs`** — 压缩 `src/img/` 下的图片（sharp，递归子目录）
4. **`github-scraper.mjs`** — 调用 GitHub API 生成 `src/_data/github.json`（异步不阻塞）
5. **`eleventy`** — 用 Nunjucks 模板 + JSON 数据生成静态 HTML（含 passthrough 复制 `src/img/` → `_site/img/`）
6. **`build-css.mjs`** — PostCSS 处理 `src/assets/css/` → `_site/assets/css/`（在 Eleventy 之后，覆盖 passthrough 的未处理 CSS）

## 架构

### 双渲染架构

站点有两条渲染路径，理解这点是修改代码的前提：

1. **构建时渲染**（Eleventy）：`npm run build` 扫描 `src/articles/` → 生成 `_site/*.html` 静态文件。模板用 Nunjucks（`src/layouts/*.njk`），数据来自 `src/_data/` 下的 JSON 文件。
2. **运行时渲染**（Express）：`article-api.mjs` 托管静态文件的同时，通过中间件拦截 HTML 请求，注入最新的 `SITE_DATA` 到 `<script>` 标签，使管理后台和页面数据在不重新构建的情况下保持最新。

管理后台 CRUD 操作直接读写 `src/articles/` 下的 Markdown 文件，然后触发异步 Eleventy 重建（2s debounce 合并相邻构建）。

### 数据流

```
src/articles/{category}/*.md  (Markdown + frontmatter)
    ↓ article-scanner.mjs（构建时）
src/_data/articles.json       → Eleventy collection → _site/*.html

Express article-api.mjs（运行时）
    ↓ 中间件拦截 HTML，注入最新 SITE_DATA
    → 管理后台 CRUD → 直接读写 src/articles/*.md
    → 图片上传 → src/img/{year}/{slug}/
    → 触发异步 Eleventy 重建
```

### 文章 Frontmatter 格式

```yaml
---
title: '文章标题'
date: '2026-03-23'          # 发布日期，创建后不可被 API 覆盖
category: blog               # tutorials | blog | essays | projects
tags:
  - 标签1
  - 标签2
excerpt: '摘要文本...'        # 可选，用于列表页展示
readingTime: '7 min'         # 可选，自动计算
updated: '2026-04-01'        # 可选，更新日期（API 更新时自动设置）
draft: true                  # 可选，草稿不发布
---
```

分类定义在 `scripts/utils/categories.mjs`，标签栏中的中文标签通过 `#标签名` 语法从正文自动提取。

### Slug 生成规则

文件名经 `scripts/utils/slug.mjs` 的 `slugify()` 处理：去除标点符号（中文冒号、括号、问号等）、空格和特殊字符替换为 `-`、转小写。例如 `Java 值传递.md` → `java-值传递`。文章可选在 frontmatter 中用 `slug` 字段覆盖自动生成的 slug。

### 图片处理

- **Obsidian 语法**：`![[Pasted_image_xxx.png]]` 在 Eleventy 构建和 Express 渲染时自动转换为标准 Markdown 图片语法，路径解析到 `src/img/{year}/{slug}/`
- **构建时压缩**：`optimize-images.mjs` 使用 sharp 递归压缩 `src/img/` 下所有图片
- **上传路径**：管理后台上传的图片写入 `src/img/`，Express 直接托管该目录作为静态文件

### 关键路径

| 路径 | 说明 |
|:---|:---|
| `scripts/article-api.mjs` | Express 服务器（管理后台 + API + 静态文件托管） |
| `scripts/utils/article-service.mjs` | 文章 CRUD 统一数据层（读写 Markdown + 索引管理） |
| `scripts/utils/paths.mjs` | 所有关键路径常量（ARTICLES_DIR、IMAGES_DIR 等） |
| `scripts/utils/categories.mjs` | 分类定义和中文标签映射 |
| `scripts/utils/slug.mjs` | Slug 生成（处理中英文标点） |
| `scripts/templates/admin-panel.html` | 管理后台 HTML 模板（Express 渲染时替换 `__BASE_PATH__` 占位符） |
| `eleventy.config.js` | Eleventy 配置（filters、shortcodes、collections，引用 scripts/utils/） |
| `src/_data/env.js` | 向前端暴露 `BASE_PATH` |
| `src/layouts/base.njk` | 基础布局（状态栏、RSS 链接、命令框） |
| `src/layouts/article.njk` | 文章详情布局（返回顶部、prev/next 导航） |
| `src/pages/articles.njk` | 文章列表页（排序、搜索、tag 筛选、分页） |
| `src/assets/js/modules/` | 前端模块（router、commands、renderers） |

### 管理后台鉴权

Cookie-based 认证，密码通过 `ADMIN_PASSWORD` 环境变量设置。登录页 POST 到 `/api/login`，服务端比对后设置 base64 编码的 cookie（`admin_auth`）。登录接口有速率限制（1 分钟内最多 5 次）。模板中 `__BASE_PATH__` 在 Express 渲染时被替换为实际的 `BASE_PATH`。

### 子路径部署

所有资源路径在构建时通过 `BASE_PATH` 环境变量注入。Eleventy 数据层 `src/_data/env.js` 读取此变量，模板和 JS 中引用 `env.BASE_PATH` 拼接路径。Express 层面，如果设置了 `BASE_PATH`，中间件会在路由匹配前将其从 `req.url` 中剥离。

### 运维守则

- 改 `article-api.mjs` → 必须重启 PM2
- 改 `admin-panel.html` 模板 → 重启 Express
- 改前端 JS/CSS → `npm run build:js` / `npm run build:css`（或 dev 模式自动重建）
- 服务器上 `node_modules/`、`_site/`、`content/`、`.env`、`logs/` 被 gitignore
- `github-scraper.mjs` 异步执行，不阻塞启动
- **本地不要跑 `build:prod`**，会把路径改成 `/observatory/...`，本地预览用 `npm run build`
