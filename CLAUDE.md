# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

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
| category | string | 分类：tech/reading/essays/projects |
| tags | array | 标签数组，优先使用；缺失时从内容#标签和标题关键词自动提取 |
| excerpt | string | 摘要，缺失时自动生成（取正文前150字符） |
| readingTime | string | 阅读时间，如"5 min"，缺失时按200字/分钟计算 |
| slug | string | URL slug，缺失时从标题生成 |
| status | string | 发布状态，默认 published |
| source | string | 来源：manual 或从前置系统导入 |
| sourceLogId | string/null | 关联的原始日志ID（导入数据保留） |

### 文章分类
- `tech/` — 技术文章
- `reading/` — 读书笔记
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
- 筛选器：`filter [all|tech|reading|essays|projects]` 按分类筛选
- 分页：前端计算 PAGE_SIZE=8，纯 JS 切片

### 文章系统
- `article-scanner.mjs` 是入口，运行后生成 `src/articles/_data/articles.json` 索引
- 扫描时会自动补全 frontmatter 缺失字段（readingTime、excerpt、tags、slug）
- 文章页面路径：`/articles/{category}/{slug}/`，由 `src/pages/article.njk` 模板渲染
- `article.njk` 通过 `articleContent` shortcode 加载 Markdown 内容，并提供上一篇/下一篇导航
- **图片处理**：markdown-it 不支持路径中含空格（>9字符）的图片语法，已在 shortcode 中转为链接格式
  - `![[Pasted image xxx.png]]` → `[Pasted image xxx.png](img/Pasted image xxx.png)`（点击可下载）

## 脚本

| 脚本 | 命令 | 说明 |
|------|------|------|
| article-scanner.mjs | `npm run scan:articles` | 扫描 src/articles 生成索引，自动补全 frontmatter 缺失字段 |
| article-importer.mjs | `npm run import:article` | 单独导入某篇文章 |
| frontmatter-fixer.mjs | `node scripts/frontmatter-fixer.mjs` | 为缺少 frontmatter 的文章批量补全（直接 node 运行）|

### CI 可选步骤
`.github/workflows/build.yml` 中的 `parse-git` 和 `gen-summary` 在 package.json 中未定义（标记了 `continue-on-error: true`），属于可选的日志生成步骤，忽略不影响构建。

## GitHub Actions CI/CD

`.github/workflows/build.yml` 配置：
- push 到 main 分支触发构建和部署到 GitHub Pages
- 每周日午夜执行 `npm run auto-update`（即 `npm run scan:articles`）
