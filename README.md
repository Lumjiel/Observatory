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
| 后端 | Express 5 + Marked + gray-matter |
| 静态站点 | Eleventy (11ty) 3.x |
| 进程管理 | PM2 |
| 编辑器 | CodeMirror 6 |

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（构建 + 扫描 + 启动开发服务器）
npm run dev

# 部署模式（API 服务器）
ADMIN_PASSWORD=yourpassword npm run server
```

访问 `http://localhost:8080` 查看前端，`http://localhost:8080/admin` 进入管理后台。

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
├── scripts/                    # 后端脚本
│   ├── article-api.mjs         # Express API 服务器（主进程）
│   ├── article-scanner.mjs     # 扫描 Markdown 生成文章索引
│   ├── build-js.mjs            # esbuild 前端打包
│   ├── github-scraper.mjs      # 拉取 GitHub 数据
│   ├── new-article.mjs         # 交互式创建文章
│   ├── frontmatter-fixer.mjs   # 修复 Markdown frontmatter
│   └── utils/                  # 共享工具函数
├── src/
│   ├── assets/
│   │   ├── css/main.css        # 主样式
│   │   ├── css/admin.css       # 管理后台样式
│   │   └── js/                 # 前端 JS
│   │       ├── app.js          # 入口
│   │       ├── admin-panel.js  # 管理面板
│   │       └── modules/
│   │           ├── commands.js     # 命令处理器
│   │           ├── router.js       # 视图路由
│   │           ├── state.js        # 全局状态
│   │           ├── events/         # 键盘、输入事件
│   │           ├── renderers/      # 各视图渲染
│   │           ├── components/     # UI 组件
│   │           └── utils/         # 工具函数
│   ├── layouts/base.njk        # 页面模板
│   ├── pages/                  # Eleventy 页面
│   └── _data/                  # 站点数据
├── ecosystem.config.cjs        # PM2 配置
├── eleventy.config.js          # 11ty 配置
└── package.json
```

## 数据流

```
Markdown 文件 (content/articles/)
    ↓ article-scanner.mjs
文章索引 (src/articles/_data/articles.json)
    ↓ Eleventy build
静态站点 (_site/)
    ↓ Express serve
浏览器访问
```

## 部署

详见 [DEPLOY_SERVER.md](DEPLOY_SERVER.md)。

## 许可

MIT
