# Observatory — 终端风格的学习数据监控中心

**Terminal-style CS learning dashboard. Track your coding, reading, and thinking as signals.**

*Learning tracker · Terminal UI · Express + Eleventy · PM2 deployed*

[快速开始](#-快速开始) · [功能](#-功能) · [命令](#-命令) · [部署](#-部署) · [技术栈](#-技术栈)

---

## 😤 问题

你想记录每天学了什么，但：

| 方案 | 问题 |
|------|------|
| Notion / 手写笔记 | 无结构化数据，无法统计趋势 |
| GitHub Contributions | 只反映代码，不反映阅读和思考 |
| 专用学习 App | 重、慢、不自定义 |

**你需要一个自托管的终端风格日志系统，把编码、阅读、调试、思考全部变成可量化的信号。**

---

## ✅ 方案

```
Markdown 文章 → article-service → Express API + Eleventy 静态站点
                                                    ↓
                              终端 UI 展示：日志流 / 仪表盘 / GitHub 热力图
```

- **终端美学**：命令行风格的文章流，`j/k` 导航，命令式操作
- **自托管**：自己的数据自己控，Markdown 文件即数据库
- **全链路**：文章扫描 → API → 前端 → CI/CD 自动部署

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（热更新）
npm run dev

# 3. 部署模式（API 服务器）
ADMIN_PASSWORD=yourpassword npm run server
```

访问 `http://localhost:8080` 查看前端，`http://localhost:8080/admin` 进入管理后台。

---

## 功能

| 模块 | 功能 |
|------|------|
| **终端日志流** | 命令行风格文章流，分类筛选、关键词搜索、分页 |
| **统计仪表盘** | 分类统计、标签云、近期更新、月度热力图 |
| **GitHub 面板** | 个人仓库列表 + 贡献热力图 |
| **管理后台** | CodeMirror + Markdown 预览的在线编辑 |
| **主题切换** | 暗色 / 亮色，跟随系统偏好 |
| **数据导出** | JSON / TXT 格式导出 |

---

## 命令

```
/search [关键词]     搜索文章
/filter [category]   筛选分类（tutorials/blog/essays/projects）
/dashboard           统计仪表盘
/github              GitHub 热力图
/list                全部文章列表
/theme [dark|light]  切换主题
/export [txt|json]   导出数据
/admin               管理后台
```

快捷键：`j/k` 移动焦点、`Esc` 关闭详情、`Tab` 补全命令、`↑/↓` 历史命令

---

## 🏗 架构

```
浏览器 → http://localhost:8080
            │
            ├── /              Eleventy 静态前端（终端 UI）
            ├── /api/articles  Express API（CRUD）
            └── /admin         管理后台

文章管理流程：
Markdown 文件 → article-service.mjs → articles.json 索引
                                          ├── Express API（实时读写）
                                          └── Eleventy 构建（静态生成）
```

**构建链**：

```
build-js (esbuild) → build-css (PostCSS) → article-scanner → github-scraper → Eleventy
```

---

## 部署

### 服务器部署（PM2 + Express）

```bash
NODE_ENV=production npm run build:prod
ADMIN_PASSWORD=yourpassword pm2 start ecosystem.config.cjs
```

### GitHub Pages

1. Settings → Pages → Source: **GitHub Actions**
2. Actions → 手动运行 **Build and Deploy**

工作流：push 仅验证 / 手动触发部署 / 每周定时验证

---

## ⚙️ 配置

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `ADMIN_PASSWORD` | — | 管理后台密码（必填） |
| `PORT` | `8080` | 服务端口 |
| `NODE_ENV` | `development` | 环境（production 启用压缩） |

---

## 🧪 NPM 脚本

| 命令 | 功能 |
|------|------|
| `npm run dev` | 开发模式（构建 + 监听 + 热更新） |
| `npm run build` | 完整构建 |
| `npm run build:prod` | 生产构建（JS/CSS 压缩） |
| `npm run server` | 启动 Express API |
| `npm run scan:articles` | 扫描文章目录更新索引 |
| `npm run fetch-github` | 拉取 GitHub 仓库与贡献数据 |
| `npm run new-article` | 交互式创建新文章 |
| `npm run pm2:start/stop/restart/logs/status` | PM2 管理 |

---

## 📁 项目结构

```
Observatory/
├── scripts/
│   ├── article-api.mjs          # Express API 服务器
│   ├── article-scanner.mjs      # CLI：扫描 Markdown 生成索引
│   ├── github-scraper.mjs       # 拉取 GitHub 数据
│   ├── build-js.mjs / build-css.mjs  # 前端构建
│   └── utils/article-service.mjs    # 统一数据服务层
├── src/
│   ├── articles/                # Markdown 文章源
│   │   ├── blog/ essays/ projects/ tutorials/
│   ├── assets/                  # CSS / JS / 图片
│   ├── layouts/ pages/ _data/   # Eleventy 模板
├── .github/workflows/build.yml  # CI/CD
├── ecosystem.config.cjs         # PM2 配置
└── package.json
```

---

## 技术栈

| 层 | 技术 |
|-----|--------|
| 前端 | 原生 JS (ES Module) + esbuild |
| 样式 | PostCSS (autoprefixer + cssnano) |
| 后端 | Express 5 + Marked + gray-matter |
| 静态站点 | Eleventy (11ty) 3.x |
| 进程管理 | PM2 |
| 编辑器 | CodeMirror 6 |
| CI/CD | GitHub Actions |

---

## 📜 License

[MIT](LICENSE)
