# Terminal Observatory

一个终端风格的 CS 学习数据监控中心。以 Markdown 文章为数据源，通过终端日志流界面展示学习轨迹。

## 功能

- **终端日志流** — 命令行风格的文章流，支持分类筛选、关键词搜索、分页
- **GitHub 面板** — 显示个人 GitHub 仓库列表与贡献热力图
- **统计仪表盘** — 分类统计、标签云、近期更新、月度热力图
- **管理后台** — 基于 CodeMirror + Markdown 预览的在线文章编辑系统
- **暗色/亮色主题** — 支持切换，跟随系统偏好
- **导出功能** — 支持 JSON / TXT 格式导出文章数据
- **键盘快捷键** — `j/k` 移动、命令式操作

## 技术栈

| 层 | 技术 |
|-----|--------|
| 前端 | 原生 JS (ES Module)、esbuild 打包 |
| 样式 | PostCSS (autoprefixer + cssnano) |
| 后端 | Express 5 + Marked + gray-matter |
| 静态站点 | Eleventy (11ty) 3.x |
| 进程管理 | PM2 |
| 编辑器 | CodeMirror 6 |
| CI/CD | GitHub Actions |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（构建 + 扫描 + 启动开发服务器，自动监听 JS/CSS 变化热更新）
npm run dev

# 部署模式（API 服务器）
ADMIN_PASSWORD=yourpassword npm run server
```

访问 `http://localhost:8080` 查看前端，`http://localhost:8080/admin` 进入管理后台。

## NPM 脚本

| 命令 | 功能 |
|------|------|
| `npm run dev` | 开发模式：构建 + 扫描 + Eleventy 服务器，自动监听 JS/CSS 热更新 |
| `npm run build` | 完整构建（JS 打包 + CSS 处理 + 文章扫描 + GitHub 数据 + 静态站点） |
| `npm run build:prod` | 生产构建（含 JS/CSS 压缩，`BASE_PATH=/observatory`） |
| `npm run build:js` | 仅打包 JS（esbuild） |
| `npm run build:css` | 仅处理 CSS（autoprefixer） |
| `npm run optimize-images` | 压缩 `src/img/` 下的 PNG/JPEG 图片 |
| `npm run server` | 启动 Express API 服务器（需 `ADMIN_PASSWORD`） |
| `npm run scan:articles` | 扫描文章目录更新索引 |
| `npm run fetch-github` | 拉取 GitHub 仓库与贡献数据 |
| `npm run import:article` | 从 Markdown 文件导入文章 |
| `npm run new-article` | 交互式创建新文章 |
| `npm run pm2:start` | PM2 启动 API 服务 |
| `npm run pm2:stop` | PM2 停止服务 |
| `npm run pm2:restart` | PM2 重启服务 |
| `npm run pm2:logs` | 查看 PM2 日志 |
| `npm run pm2:status` | 查看 PM2 状态 |

## 可用命令

| 命令 | 功能 |
|------|--------|
| `/search [关键词]` | 搜索文章标题和描述 |
| `/filter [category]` | 筛选分类：all/tutorials/blog/essays/projects |
| `/dashboard` | 统计仪表盘 |
| `/github` | GitHub 仓库与贡献热力图 |
| `/list` | 全部文章列表 |
| `/about` | 关于系统 |
| `/help` | 显示帮助 |
| `/clear` | 清除筛选条件 |
| `/theme [dark\|light]` | 切换主题 |
| `/export [txt\|json]` | 导出文章数据 |
| `/admin` | 进入管理后台 |

快捷键：`j/k` 移动焦点，`Esc` 关闭详情，`Tab` 补全命令，`↑/↓` 历史命令

## 项目结构

```
terminal-observatory/
├── scripts/                        # 后端脚本
│   ├── article-api.mjs             # Express API 服务器（主进程）
│   ├── article-importer.mjs        # 从 Markdown 文件导入文章
│   ├── article-scanner.mjs         # CLI 入口：扫描 Markdown 生成索引
│   ├── build-js.mjs                # esbuild 前端打包
│   ├── build-css.mjs               # PostCSS 样式处理（autoprefixer + 压缩）
│   ├── dev.mjs                     # 开发模式：初始构建 + 文件监听热更新
│   ├── github-scraper.mjs          # 拉取 GitHub 仓库与贡献数据
│   ├── new-article.mjs             # 交互式创建文章
│   ├── optimize-images.mjs         # PNG/JPEG 图片压缩
│   ├── update-about-ops.mjs        # 更新关于页面的运维数据
│   └── utils/                      # 共享工具函数
│       ├── article-service.mjs     # 统一文章数据服务层（API + Eleventy 共用）
│       ├── categories.mjs          # 文章分类常量
│       ├── paths.mjs               # 路径配置
│       ├── reading-time.mjs        # 阅读时间计算
│       └── slug.mjs                # 标题转 slug
├── src/
│   ├── articles/                   # Markdown 文章源文件
│   │   ├── blog/                   # 博客类文章
│   │   ├── essays/                 # 随笔类文章
│   │   ├── projects/               # 项目类文章
│   │   └── tutorials/              # 教程类文章
│   ├── assets/
│   │   ├── css/
│   │   │   ├── main.css            # 主样式
│   │   │   └── admin.css           # 管理后台样式
│   │   └── js/
│   │       ├── app.js              # 前端入口
│   │       ├── admin-panel.js      # 管理面板
│   │       └── modules/
│   │           ├── commands.js     # 命令处理器
│   │           ├── router.js       # 视图路由
│   │           ├── state.js        # 全局状态
│   │           ├── components/     # UI 组件（文章详情、筛选标签、侧边栏等）
│   │           ├── events/         # 键盘、输入事件
│   │           ├── renderers/      # 各视图渲染（仪表盘、日志流、帮助等）
│   │           └── utils/          # 前端工具函数（音频、粒子动画、文本处理）
│   ├── img/                        # 图片资源
│   ├── layouts/
│   │   └── base.njk                # 页面模板
│   ├── pages/                      # Eleventy 页面模板
│   └── _data/                      # 站点数据（site.json、github.json 等）
├── .github/workflows/
│   └── build.yml                   # GitHub Actions CI/CD
├── ecosystem.config.cjs            # PM2 配置
├── eleventy.config.js              # 11ty 配置
├── postcss.config.js               # PostCSS 配置
└── package.json
```

## 架构说明

### 文章管理

所有文章以 Markdown 文件存储在 `src/articles/{category}/` 目录，frontmatter 包含元数据。**`scripts/utils/article-service.mjs`** 是统一数据服务层，Express API 和 Eleventy 构建都通过它读写文章：

```
                    ┌─────────────────────────┐
                    │  Markdown 文件            │
                    │  src/articles/{cat}/     │
                    └──────────┬──────────────┘
                               │
                    ┌──────────▼──────────────┐
                    │  article-service.mjs     │   ← 唯一入口
                    │  (扫描 / CRUD / 索引)     │
                    └──────┬──────────┬───────┘
                           │          │
              ┌────────────▼──┐  ┌───▼───────────┐
              │ Express API   │  │ Eleventy 构建   │
              │ (admin CRUD)  │  │ (静态站点生成)   │
              └───────────────┘  └───────────────┘
```

- **CRUD 操作**：API 写入 `.md` 文件 + 更新 `articles.json` 索引，异步触发站点重建
- **批量操作**：合并构建触发，2 秒内多次写入只执行一次 `eleventy` 构建
- **数据一致性**：API 和 Eleventy 共用同一套 frontmatter 解析逻辑，消除双管道 bug
- **路径安全**：所有文件路径通过 `safePath` 校验，防止路径穿越

### 构建流程

```
                    ┌──────────────┐
                    │  build-js    │  esbuild 打包 JS → bundle.js
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  build-css   │  PostCSS 处理（autoprefixer + 压缩）
                    └──────┬───────┘
                           │
                    ┌──────▼──────────┐
                    │ article-scanner │  扫描文章 → 更新 articles.json
                    └──────┬──────────┘
                           │
                    ┌──────▼──────────┐
                    │ github-scraper  │  拉取 GitHub 数据 → github.json
                    └──────┬──────────┘
                           │
                    ┌──────▼──────┐
                    │  eleventy   │  生成静态站点 → _site/
                    └─────────────┘
```

## 部署

### 当前：服务器部署（PM2 + Express）

```bash
# 生产构建
NODE_ENV=production npm run build:prod

# 启动 API 服务
ADMIN_PASSWORD=yourpassword pm2 start ecosystem.config.cjs
```

详见 [DEPLOY_SERVER.md](DEPLOY_SERVER.md)。

### 未来：GitHub Pages

项目已配置 GitHub Actions 工作流，支持一键部署到 GitHub Pages：

1. GitHub 仓库 → Settings → Pages → Source 选择 **GitHub Actions**
2. 前往 Actions 页面，手动运行 **Build and Deploy** workflow
3. 勾选 **"部署到 GitHub Pages"**，等待部署完成

工作流行为：
- **push 到 main**：仅执行构建验证，不部署
- **手动触发（勾选部署）**：构建 + 部署到 GitHub Pages
- **每周定时**：仅构建验证

如需改为 push 自动部署，修改 `.github/workflows/build.yml` 中 deploy job 的 `if` 条件为 `github.ref == 'refs/heads/main'` 即可。

## 许可

MIT