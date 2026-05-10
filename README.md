# 终端观测站 · Observatory

我把每天的编码、阅读、调试和思考都当作信号记录下来。这里是公开的日志，也是一场持续的自我实验。

## 特性

- **终端风格界面** — 伪终端操作体验，命令驱动
- **多视图切换** — 日志流、仪表盘、GitHub 活动、关于页等
- **文章管理** — 支持 Markdown，标签分类，全文搜索
- **响应式设计** — 适配桌面和移动端
- **暗色/亮色主题** — 一键切换

## 技术栈

| 类别 | 技术 |
|------|------|
| 静态站点 | Eleventy (11ty) |
| 前端 | 原生 JavaScript (ES Modules) |
| 打包 | esbuild |
| 样式 | CSS Variables + Grid/Flexbox |
| 图床 | GitHub 仓库 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 生产构建
npm run build

# 启动文章管理后台
ADMIN_PASSWORD=xxx npm run server
# 访问 http://localhost:8080/admin
```

## 文章管理

### 创建文章

在 `src/articles/{category}/` 下创建 `.md` 文件：

```yaml
---
title: 文章标题
date: 2026-05-08
category: tutorials  # tutorials | blog | essays | projects
---
```

### 运行扫描

```bash
npm run scan:articles
```

文章页面路径：`/articles/{category}/{slug}/`

### 插图

两种语法都会被转为绝对路径 `/img/xxx.png`：

```markdown
<!-- Obsidian 风格（推荐） -->
![[Pasted_image_xxx.png]]

<!-- 标准 Markdown -->
![](img/xxx.png)
```

## 命令

| 命令 | 说明 |
|------|------|
| `filter [all\|tutorials\|blog\|essays\|projects]` | 按分类筛选 |
| `grep [关键词]` | 全文搜索 |
| `status` / `dashboard` | 打开仪表盘 |
| `errors` | GitHub 仓库报告 |
| `milestones` | 全部文章 |
| `skills` | 分类统计 |
| `about` | 关于页 |
| `help` | 帮助 |
| `clear` | 清除筛选 |
| `theme dark\|light` | 切换主题 |

快捷键：`j/k` 移动，`Esc` 关闭，`/` 聚焦搜索

## 项目结构

```
.
├── src/
│   ├── articles/          # 文章源文件
│   │   ├── tutorials/
│   │   ├── blog/
│   │   ├── essays/
│   │   └── projects/
│   └── assets/js/         # 前端源码
│       └── modules/       # 模块化 JS
├── scripts/              # 构建脚本
│   ├── article-api.mjs    # 文章管理 API
│   └── article-scanner.mjs # 文章索引扫描
├── _site/                 # 构建输出
└── .github/workflows/    # CI/CD
```

## CI/CD

GitHub Actions 自动构建部署：
- push 到 main 分支触发构建
- 每周日午夜自动更新文章索引

## 关于

一个用爱发电的个人学习记录项目。