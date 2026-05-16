# DEVLOG

## 2026-05-13 — 文章管理后台重构

### 问题
管理后台 `/admin` 白屏转圈，fetch 请求无响应。

### 根因
**双重端口占用 + 旧进程残留**：

1. `livereload` 的 3002 端口被占用，导致 `uncaughtException`，但进程本应继续跑（Express 服务器在 8080）
2. 更关键：之前启动的多个 Node 进程都还在跑，端口 8080 被旧进程占着。**`taskkill /F /IM node.exe` 无法彻底杀掉所有进程**（Windows 权限问题）
3. 每次 `npm run server` 时，如果端口被占用，Express 服务器启动失败，浏览器访问的是 `_site/` 的静态文件——而 `_site/admin` 是旧的构建产物，不包含最新的 `admin-panel.html` 模板

### 解决
```bash
# 1. 找到占用端口的进程
netstat -ano | grep ":8080 "

# 2. 强制杀掉指定 PID
taskkill //F //PID <PID号>

# 3. 确认端口释放
netstat -ano | grep ":8080 "  # 应该没有输出

# 4. 重新启动服务器
node scripts/article-api.mjs
```

### 经验
- Windows 上 `taskkill /F /IM node.exe` 有时会漏杀进程，用 `taskkill //F //PID <PID>` 更可靠
- `article-api.mjs` 启动时从模板文件读取 `admin-panel.html` 到内存，后续请求直接用内存中的字符串，不再读文件。修改模板后必须**重启服务器**才能生效
- livereload 端口冲突不影响 8080 主服务，但会导致 `uncaughtException`，不影响 Express 本身

## 2026-05-13 — 管理后台移动端适配

### 改动
- `scripts/templates/admin-panel.html`：重写响应式 CSS，三档布局（桌面 >1024px / 平板 768-1024px / 手机 <768px）
- 手机端视图切换：默认显示文章列表，点击文章或新建时自动切换到编辑器全屏视图
- 手机端「← 列表」按钮可切回列表，工具栏「预览」按钮全屏预览
- 区分了 `mobile-editing`（编辑/列表切换）和 `mobile-preview`（预览开关）两个 CSS class
- 通过内联脚本包装 `window.loadArticle` 和 `window.newArticle` 在手机上自动切到编辑视图

### 文件
| 文件 | 改动 |
|------|------|
| `scripts/templates/admin-panel.html` | 响应式 CSS、hamburger/back/preview-close 按钮、内联 JS |

## 2026-05-13 — 修复 onclick 函数丢失

### 问题
esbuild 打包 `src/assets/js/admin-panel.js` 时，入口与输出为同一文件（`allowOverwrite`），导致源文件被 IIFE 输出覆盖。后续重建时 esbuild 读取 IIFE 作为入口，模块作用域内的函数无法被 HTML onclick 访问。

### 根因
构建脚本中 `entryPoints: ['src/assets/js/admin-panel.js']` + `outfile: 'src/assets/js/admin-panel.js'` + `allowOverwrite: true`：
1. 首次构建：ES module 源文件 → IIFE 打包产物 ✓
2. 源文件被覆盖（IIFE 写入源文件位置）
3. 后续构建：读取 IIFE → esbuild 解析报错
4. `handleItemClick`, `toggleSelect`, `showMoveDialog`, `doBatchMove`, `insertBold` 等函数未暴露到 window，onclick 触发 `Uncaught TypeError`

### 解决
1. **注入 IIFE**：在 `Wee();` 后插入 `window.*` 赋值，捕获 IIFE 作用域内的 `cr`（编辑器实例）、`Vd`（选择集）、`lr`（API 端点）等变量
2. **修复构建脚本**：`build-js.mjs` 增加 `isEsmSource()` 检查，仅当文件以 `import` 开头时才执行 esbuild 打包，避免重复打包 IIFE
3. **修复 article-api.mjs**：服务器端渲染的文章列表 onclick 补 `window.` 前缀
4. **修复 batch-delete API**：category 缺失时回退到 `article.category`

### 涉及文件
| 文件 | 改动 |
|------|------|
| `src/assets/js/admin-panel.js` | IIFE 内注入 window.handleItemClick 等 10 个函数 |
| `scripts/build-js.mjs` | 增加 isEsmSource 检查，防止重复打包 IIFE |
| `scripts/article-api.mjs` | onclick 加 window. 前缀；batch-delete category fallback |

## 2026-05-15 — 统一文章数据管道

### 问题
两条独立的数据管道（admin API 写 `articles.json`，Eleventy 重新扫描文件）存在同构代码维护成本和潜在不一致 bug。`/api/upload-image` 路由缺失（前端已调用但后端无实现）。`safePath` 未覆盖所有路由。

### 改动

**新建 `scripts/utils/article-service.mjs`** — 聚合所有文章文件操作（扫描、CRUD、索引管理、路径安全校验）。导出接口：`scanAllArticles`、`readArticleIndex`、`getArticle`、`createArticle`、`updateArticle`、`deleteArticle`、`duplicateArticle`、`batchDelete`、`batchMove`、`validateCategory`。

**重构 `eleventy.config.js`** — 双 collection（`articles` + `published`）改读 service，删除 60 行重复扫描逻辑。

**重构 `article-api.mjs`** — Route handlers 变为调用 service 的薄包装：
- 移除所有直接 `fs` / `gray-matter` 调用
- `safePath` 通过 service 覆盖所有路由
- 构建触发 debounced（2s 窗口），不再 `await` 构建
- 添加 `POST /api/upload-image`（base64 → `content/images/{year}/{slug}/{filename}`）
- 移除 `readArticlesIndex`/`saveArticlesIndex`/`getArticlePath` 等函数

**精简 `article-scanner.mjs`** — 从 149 行减到 4 行，作为 service 的 CLI 入口。

### 坑
- Windows Git Bash 下 `taskkill //F //PID` 的 `//F` 和 `//PID` 必须双斜杠，单斜杠会被当作路径
- `python3` 在 Windows 上不可用（exit code 49），后续验证用 `node -e` 替代
- 旧 server 进程（PID 6992）极难杀死，`taskkill` 有时返回 success 但进程仍在运行，需要 `cmd.exe /c "taskkill /F /PID ..."` 配合确认

### 涉及文件
| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `scripts/utils/article-service.mjs` | 新建 | 统一文章数据服务层 |
| `eleventy.config.js` | 重构 | collections 改用 service |
| `scripts/article-api.mjs` | 重构 | route 变薄，添加图片上传 |
| `scripts/article-scanner.mjs` | 精简 | 4 行 CLI 包装 |
| `README.md` | 更新 | 架构说明 + 项目结构 |

## 2026-05-16 — 统一路径管理 + 修复主题切换

### 改动
- 创建 `scripts/utils/paths.mjs`，统一管理所有关键路径（相对路径字符串）
- 改造 7 个脚本文件，移除 `__dirname`/`fileURLToPath` 样板代码
- 优化 `DEPLOY_SERVER.md` 部署指南（精简至 129 行，Node 20+，修复错误命令）

### 修复
- `src/assets/js/app.js`：主题切换按钮点击无响应。根因是事件绑定在模块顶层执行，此时 `initDOM()` 尚未调用，`state.dom.themeToggle` 为 `null`，`if (themeToggle)` 判断为 false。修复后将绑定移到 `try` 块内 `initDOM()` 之后执行。

### 涉及文件
| 文件 | 改动 |
|------|------|
| `scripts/utils/paths.mjs` | 新建 |
| `scripts/utils/article-service.mjs` | 重构 |
| `eleventy.config.js` | 重构 |
| `scripts/article-api.mjs` | 重构 |
| `scripts/github-scraper.mjs` | 重构 |
| `scripts/new-article.mjs` | 重构 |
| `scripts/article-importer.mjs` | 重构 |
| `scripts/update-about-ops.mjs` | 重构 |
| `src/assets/js/app.js` | 修复 |
| `DEPLOY_SERVER.md` | 优化 |

## 2026-05-16 — Light 模式修复 + 工程化优化

### Light 模式颜色修复
`main.css` 的 `body.light` 变量颜色对比度不足：surface 跟背景糊在一起、边框太浅看不清、绿色太灰没有终端感。重新设计了所有 light 模式颜色值，同时修复了多处硬编码暗色 rgba 背景（filter-chip、log-tag、cmd-error 等），为 `admin.css` 新增完整的 light 模式支持（之前完全没有）。

### CSS 构建管道
新增 PostCSS 处理流程：
- **`postcss.config.js`** — autoprefixer（dev）+ cssnano（production）
- **`scripts/build-css.mjs`** — 处理 main.css 和 admin.css
- 集成到 `dev`/`build`/`build:prod` 三个命令中
- 生产模式自动压缩 CSS

### 图片压缩
- **`scripts/optimize-images.mjs`** — 用 sharp 批量压缩 PNG/JPEG（去元数据、256 色调色板）
- 40 张截图从 3.1MB → 1.1MB（省 64.5%）

### JS 开发热更新
- **`scripts/dev.mjs`** — 替代原来的串行 dev 命令
- 初始构建后启动 `eleventy --serve`，同时用 chokidar 监听 JS/CSS 变化
- 改 JS → 自动跑 `build-js.mjs` → 浏览器自动刷新
- 改 CSS → 自动跑 `build-css.mjs` → 浏览器自动刷新
- 300ms debounce 防抖

### API 缓存头
`article-api.mjs` 的 GET 端点增加 Cache-Control：
- `/api/articles` → `private, max-age=60`
- `/api/articles/:slug` → `private, max-age=300`
- `/api/github` + `/api/github/repos` → `private, max-age=600`
- 静态文件生产环境 `max-age=1h`，HTML 始终 `no-cache`

### 涉及文件
| 文件 | 改动 |
|------|------|
| `src/assets/css/main.css` | 修复 light 模式颜色变量 + 硬编码 rgba |
| `src/assets/css/admin.css` | 新增 light 模式支持 |
| `postcss.config.js` | 新建 |
| `scripts/build-css.mjs` | 新建 |
| `scripts/dev.mjs` | 新建 |
| `scripts/optimize-images.mjs` | 新建 |
| `scripts/article-api.mjs` | 新增 Cache-Control 头 |
| `package.json` | 更新 scripts，新增依赖 |
| `README.md` | 更新文档 |
