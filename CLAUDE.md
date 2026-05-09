# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**终端博客·观测站** — 一个以终端风格呈现的个人博客系统。使用 Eleventy (11ty) 构建静态站点，客户端通过原生 JavaScript 实现 SPA 行为和多视图切换。

## 常用命令

```bash
npm run dev          # 开发模式：扫描文章 → 启动 Eleventy 热重载服务
npm run build        # 生产构建：扫描文章 → 生成静态文件到 _site
npm run scan:articles   # 扫描 src/articles 生成 articles.json 索引
npm run import:article # 单独运行文章导入脚本
```

## 架构要点

### 静态生成 + 客户端交互
- Eleventy 负责生成静态 HTML，数据来自 JSON 文件
- 所有视图切换、筛选、命令执行都在客户端通过 `src/assets/js/app.js` 实现
- `window.ARTICLES_DATA` 在模板中内嵌供 JS 访问（文章为唯一数据源）

### 数据文件结构
```
src/_data/
  logs.json      # 占位空数组（日志系统已废弃，文章为唯一数据源）
  projects.json  # 占位（项目数据来自 articles.json）
  skills.json    # 占位（同上）

src/articles/_data/articles.json  # 文章索引（由 article-scanner.mjs 生成）
```

### 文章 frontmatter 字段
| 字段 | 类型 | 说明 |
|------|------|------|
| title | string | 文章标题 |
| date | string/Date | 发布日期，ISO格式 |
| category | string | 分类：tutorials/blog/essays/projects |
| tags | array | 标签数组，优先使用；缺失时从内容#标签和标题关键词自动提取 |
| excerpt | string | 摘要，缺失时自动生成（取正文前150字符） |
| readingTime | string | 阅读时间，如"5 min"，缺失时按200字/分钟计算 |
| slug | string | URL slug，缺失时从标题生成 |
| status | string | 发布状态，默认 published |
| source | string | 来源：manual 或从前置系统导入 |
| sourceLogId | string/null | 关联的原始日志ID（导入数据保留） |

### 文章分类
- `tutorials/` — 教程/环境配置
- `blog/` — 博客内容
- `essays/` — 随笔
- `projects/` — 项目记录

### 模板与过滤器
- `eleventy.config.js` 定义了 Collection 和 Filter
- Collection: `articles`（读 articles.json）
- Filter: `categoryLabel`、`renderMarkdown`、`getPrevArticle`、`getNextArticle`
- Shortcode: `articleContent`（按 category/filename 加载 Markdown 内容）

### CSS 架构
- `main.css` 使用 CSS 变量定义全局颜色系统（暗色/亮色两套）
- 主题切换：`.light` 类加在 `<body>` 上，变量全部重写
- 暗色主题变量前缀 `--bg-deep`/`--green`/`--amber`/`--magenta`
- 亮色主题羊皮纸风格：`--bg: #FDF6E3`，`--green: #00A070`

### 客户端视图系统
- `viewContainers` 对象管理所有视图容器 ID（log/dashboard/errors/milestones/projects/skills/about/help）
- Hash 路由：`#dashboard`、`#errors` 等直接映射到对应视图
- 命令系统：`executeCommand(cmdStr)` 解析并路由到各渲染函数
- 筛选器：`filter [all|tutorials|blog|essays|projects]` 按分类筛选
- 分页：前端计算 PAGE_SIZE=8，纯 JS 切片

### 文章系统
> **注意**：markdown-it 不支持路径含空格（>9字符）的图片语法。`![[Pasted image xxx.png]]` 已通过 shortcode 转为链接格式，点击可下载。

- `article-scanner.mjs` 是入口，运行后生成 `src/articles/_data/articles.json` 索引
- 扫描时会自动补全 frontmatter 缺失字段（readingTime、excerpt、tags、slug）
- 文章页面路径：`/articles/{category}/{slug}/`，由 `src/pages/article.njk` 模板渲染
- `article.njk` 通过 `articleContent` shortcode 加载 Markdown 内容，并提供上一篇/下一篇导航

## 脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| article-scanner.mjs | `npm run scan:articles` | 扫描 src/articles 生成索引，自动补全 frontmatter 缺失字段 |
| article-importer.mjs | `npm run import:article` | 单独导入某篇文章 |
| new-article.mjs | `npm run new-article` | 交互式创建新文章（支持非交互模式：传递 title 参数）|

### CI 可选步骤
`.github/workflows/build.yml` 中的 `parse-git` 和 `gen-summary` 在 `package.json` 中未定义（`continue-on-error: true`），属于可选的日志生成步骤，忽略不影响构建。调试 CI 时可跳过这两个 step。

## GitHub Actions CI/CD

`.github/workflows/build.yml` 配置：
- push 到 main 分支触发构建和部署到 GitHub Pages
- 每周日午夜执行 `npm run auto-update`（即 `npm run scan:articles`）

## 本次会话新增功能

### 分类目录重构
- `tech/` → `tutorials/`（教程/环境配置）
- `reading/` → `blog/`（博客内容）
- 更新了 article-scanner、eleventy.config、app.js 中的分类映射
- 重写了 `articles-redirect-*.njk` 重定向页面

### 安全加固
- `articleContent` shortcode 添加 `sanitize-html` 净化，防止 XSS
- 文章 ID 生成改为 `crypto.randomUUID()`

### 前端交互优化
- signal-card 分类卡片：仅当前选中卡片显示绿色边条和背景
- filter-chip 筛选标签：点击后正确切换 active 高亮
- categoryStats 一次性计算，各渲染函数复用，减少重复遍历
- j/k 快捷键添加空日志边界检查

### 样式美化
- 移动端底部导航：圆角、选中态绿色背景、触摸区域 44x44px
- 删除未使用的 CSS 规则（.heatmap/.timeline/.stale-badge 等）

### RSS/Atom 订阅源
- `src/pages/feed.xml.njk` 生成 Atom Feed，路径 `/feed.xml`
- `<head>` 自动注入 `<link rel="alternate" type="application/atom+xml">`
- 站点元数据由 `src/_data/site.json` 提供

### 标签归档页
- 路径 `/tags/?tag=标签名`，展示该标签下所有文章
- 点击任意标签跳转到归档页（不再执行 `grep`）

### 加载状态
- 页面首次加载显示 terminal 风格遮罩（旋转 spinner + "📡 观测站加载中..."）
- 加载完成后淡出移除

### 命令历史持久化
- 命令历史存入 `localStorage`，刷新页面后保留（最多 20 条）

### 文章页返回链接
- 文章底部 `prev/next` 导航前新增"返回文章列表"链接

### 文章管理暗门
- `scripts/article-api.mjs` — 集成到主站的 Express 服务器，同时托管静态网站和文章管理
- 部署步骤：`npm run build` 构建静态文件 → `npm install express` → `npm run server`
- 端口：默认 8080（`PORT` 环境变量可改）
- 访问 `http://localhost:8080/admin` 进入管理界面（需认证）
- 认证：环境变量 `ADMIN_PASSWORD`，默认密码 `your-secret-password`
- API 端点：GET/POST /api/articles，PUT/DELETE /api/articles/:slug

### 移动端导航
- 底部导航 4 个按钮（log/dashboard/errors/about）
- 选中态有绿色背景和圆角效果
- `errors` 视图显示分类文章（blog/essays 分离为独立分类）

### 站点元数据配置
- `src/_data/site.json` 包含 `title`、`description`、`url`、`author`、`startDate`
- 运行时间从 `site.startDate` 读取，不再硬编码

### 分类页合并
- 4 个静态分类页（tutorials/blog/projects/essays）合并为 `articles.njk` 的 query param 路由
- 旧路径通过 11ty 重定向页（`articles-redirect-*.njk`）301 跳转到新路径

### 仪表盘全新改版
- 信号源状态：博客/随笔/教程/项目4色进度条样式，末尾显示"总计 X 条信号 | 信号强度: 稳定"
- 标签星系：Top40标签伪随机分布形成星云，频次≥2的标签有漂浮动画，字号统一0.7rem，点击标签筛选
- GitHub热力图：左侧Mon/Wed/Thu英文标签，近90天贡献数据，4级颜色
- 热力图legend横排显示"少 → 多"
- 最近信号记录表

### GitHub 数据
- `scripts/github-scraper.mjs` 获取用户仓库列表和近90天贡献事件
- `src/_data/github.json` 存储数据，`window.GITHUB_DATA` 供前端使用
- `site.json` 中 `githubUsername` 配置 GitHub 用户名

### 关于页打字机效果
- ASCII人物艺术（15行）在关于页加载时逐字打印，每字符8ms
- 定义在 `renderAbout()` 中 `currentAsciiLines` 数组（line 907-925）
- 修改 ASCII 内容直接改该数组即可
