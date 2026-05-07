# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**终端日志·实时观测站** — 一个以终端风格呈现的个人学习监控系统。使用 Eleventy (11ty) 构建静态站点，客户端通过原生 JavaScript 实现 SPA 行为和多视图切换。

## 常用命令

```bash
npm run dev          # 开发模式：扫描文章 → 启动 Eleventy 热重载服务
npm run build        # 生产构建：扫描文章 → 生成静态文件到 _site
npm run scan:articles   # 单独扫描 src/articles 生成 articles.json
npm run import:article # 单独运行文章导入脚本
npm run auto-update    # 执行 parse-git + gen-summary
```

## 架构要点

### 静态生成 + 客户端交互
- Eleventy 负责生成静态 HTML，数据来自 JSON 文件
- 所有视图切换、筛选、命令执行都在客户端通过 `src/assets/js/app.js` 实现
- `window.LOGS_DATA`、`window.PROJECTS_DATA`、`window.SKILLS_DATA` 在模板中内嵌供 JS 访问

### 数据文件结构
```
src/_data/
  logs.json      # 学习日志条目（含 type/status/tags/detail 字段）
  projects.json  # 项目元数据（含 progress/todo 字段）
  skills.json    # 技能分类（不含 level 百分比，UI 层计算）

src/articles/_data/articles.json  # 文章索引（由 article-scanner.mjs 生成）
```

### 模板与过滤器的对应关系
- `eleventy.config.js` 定义了所有自定义 Filter 和 Collection
- Filter: `filterByType`、`sortByDate`、`recentLogs`、`categoryLabel`、`renderMarkdown`
- Collection: `articles`（读 articles.json）、`logs`（读 logs.json）
- Shortcode: `articleContent`（按 category/filename 加载文章 Markdown 内容）

### CSS 架构
- `main.css` 使用 CSS 变量定义全局颜色系统（暗色/亮色两套）
- 主题切换：`.light` 类加在 `<body>` 上，变量全部重写
- 暗色主题变量前缀 `--bg-deep`/`--green`/`--amber`/`--magenta`
- 亮色主题羊皮纸风格：`--bg: #FDF6E3`，`--green: #00A070`

### 客户端视图系统
- `viewContainers` 对象管理所有视图容器 ID（log/dashboard/errors/milestones/projects/skills/about/help）
- Hash 路由：`#dashboard`、`#errors` 等直接映射到对应视图
- 命令系统：`executeCommand(cmdStr)` 解析并路由到各渲染函数
- 分页：前端计算 PAGE_SIZE=8，纯 JS 切片

### 文章系统
- 文章存储在 `src/articles/{category}/` 目录（目前有 tech 分类）
- `article-scanner.mjs` 扫描目录，生成 `src/articles/_data/articles.json` 索引
- 文章详情页 `article.njk` 使用 `articleContent` shortcode 动态加载 Markdown

## GitHub Actions CI/CD

`.github/workflows/build.yml` 配置：
- push 到 main 分支触发构建和部署到 GitHub Pages
- 每周日午夜执行 `npm run auto-update` 生成周报

## 设计文档

`设计文档.md` 包含完整的视觉系统、交互逻辑、数据结构规范，是产品层面的核心文档。