import express from 'express';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import chokidar from 'chokidar';
import livereload from 'livereload';
import { randomUUID } from 'crypto';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import rateLimit from 'express-rate-limit';
import * as articleService from './utils/article-service.mjs';
import { CONTENT_DIR, IMAGES_DIR, SITE_DIR, SITE_DATA_PATH, GITHUB_DATA_PATH, TEMPLATES_DIR } from './utils/paths.mjs';

const PORT = process.env.PORT || 8080;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin';
const DEV = process.env.NODE_ENV !== 'production';

const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error('[观测站] 错误: ADMIN_PASSWORD 环境变量未设置');
  process.exit(1);
}

const BASE_PATH = process.env.BASE_PATH || '';

const app = express();
app.use(express.json({ limit: '10mb' }));

// 去掉 base path 再路由（保持原有路由逻辑不变）
if (BASE_PATH) {
  app.use((req, res, next) => {
    if (req.path.startsWith(BASE_PATH)) {
      req.url = req.url.slice(BASE_PATH.length);
    }
    next();
  });
}

// ============================================================
// Cookie 解析
// ============================================================

const COOKIE_NAME = 'admin_auth';
const AUTH_VALUE = Buffer.from('admin:' + PASSWORD).toString('base64');

function checkAuth(req) {
  return req.cookies && req.cookies[COOKIE_NAME] === AUTH_VALUE;
}

app.use((req, res, next) => {
  const cookies = {};
  req.headers.cookie && req.headers.cookie.split(';').forEach(c => {
    const eqIdx = c.indexOf('=');
    if (eqIdx > 0) {
      const k = c.slice(0, eqIdx).trim();
      const v = c.slice(eqIdx + 1).trim();
      cookies[k] = v;
    }
  });
  req.cookies = cookies;
  next();
});

// ============================================================
// 速率限制（防止暴力破解）
// ============================================================

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 最多5次尝试
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '请求过于频繁，请稍后再试' },
});

// ============================================================
// 异步构建（debounced，不阻塞 API 响应）
// ============================================================

let buildTimer = null;
const childProcesses = new Set();

function runEleventy() {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['eleventy'], { cwd: process.cwd(), stdio: 'inherit', shell: true });
    childProcesses.add(child);
    child.on('close', (code) => {
      childProcesses.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`eleventy exited with code ${code}`));
    });
    child.on('error', (err) => {
      childProcesses.delete(child);
      reject(err);
    });
  });
}

// 合并相邻构建：2s 内多次触发只执行一次
function scheduleBuild() {
  if (buildTimer) clearTimeout(buildTimer);
  buildTimer = setTimeout(async () => {
    buildTimer = null;
    try {
      await runEleventy();
      if (DEV && lrServer) lrServer.refresh('/');
    } catch (e) {
      console.error('[观测站] 构建失败:', e.message);
    }
  }, 2000);
}

// 立即构建（用于初始构建）
function runBuildImmediate() {
  return runEleventy();
}

// ============================================================
// 模板渲染
// ============================================================

const LOGIN_TPL = path.join(TEMPLATES_DIR, 'admin-login.html');
const PANEL_TPL = path.join(TEMPLATES_DIR, 'admin-panel.html');

function readTemplate(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function renderLoginPage() {
  const apiBase = (BASE_PATH || '') + '/api';
  return readTemplate(LOGIN_TPL)
    .replace('</head>', `<script>window.BASE_PATH='${BASE_PATH}';window.API_BASE='${apiBase}';</script></head>`);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function renderAdminPage(articles, pageMode = 'list') {
  const categoryLabels = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
  const categoryOptions = Object.entries(categoryLabels)
    .map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`)
    .join('');

  const articleList = articles.map(a => `
    <div class="article-item" data-slug="${escapeHtml(a.slug)}" onclick="loadArticle('${escapeHtml(a.slug)}')">
      <div class="article-item-title">${escapeHtml(a.title || '')}</div>
      <div class="article-item-meta">
        <span class="cat-tag cat-${escapeHtml(a.category || '')}">${escapeHtml(categoryLabels[a.category] || a.category || '')}</span>
        <span>${escapeHtml(a.tags.slice(0, 2).join(', '))}${a.tags.length > 2 ? '...' : ''}</span>
      </div>
    </div>
  `).join('');

  const emptyState = articles.length === 0
    ? '<div class="empty-state"><p>暂无文章</p></div>'
    : '';

  return readTemplate(PANEL_TPL)
    .replace('%%ARTICLE_COUNT%%', articles.length)
    .replace('%%ARTICLE_LIST%%', articleList)
    .replace('%%EMPTY_STATE%%', emptyState)
    .replace('%%CATEGORY_OPTIONS%%', categoryOptions)
    .replace('%%PAGE_MODE%%', pageMode)
    .replace('</head>', `<script>window.BASE_PATH='${BASE_PATH}';window.API_BASE='${BASE_PATH}/api';</script></head>`);
}

// ============================================================
// API 路由（认证相关放最前）
// ============================================================

app.post('/api/login', loginLimiter, (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    res.cookie(COOKIE_NAME, AUTH_VALUE, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 86400000,
      secure: false,  // 暂时关闭（HTTP 也需要cookie）
    });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

// ============================================================
// 文章管理 API（需认证）
// ============================================================

app.get('/api/articles', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const articles = articleService.readArticleIndex().map(a => ({
    slug: a.slug,
    category: a.category,
    title: a.title,
    tags: a.tags || [],
    excerpt: a.excerpt || '',
    order: a.order !== undefined ? a.order : 0,
  }));
  res.json(articles);
});

app.get('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const article = articleService.getArticle(req.params.slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json({
    slug: article.slug,
    category: article.category,
    title: article.title,
    tags: article.tags,
    excerpt: article.excerpt,
    readingTime: article.readingTime,
    order: article.order,
    content: article.content,
  });
});

app.post('/api/articles', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { title, category, content, tags, excerpt, readingTime, order } = req.body;

  try {
    const result = articleService.createArticle({ title, category, content, tags, excerpt, readingTime, order });
    scheduleBuild();
    res.json({ success: true, slug: result.slug, path: result.path });
  } catch (e) {
    if (e.message === '文章已存在') return res.status(409).json({ error: e.message });
    res.status(400).json({ error: e.message });
  }
});

app.put('/api/articles/order', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders 必须是数组' });

  const articles = articleService.readArticleIndex();
  orders.forEach(({ slug, order }) => {
    const idx = articles.findIndex(a => a.slug === slug);
    if (idx !== -1) articles[idx].order = order;
  });
  articleService.saveArticleIndex(articles);
  res.json({ success: true });
});

app.put('/api/articles/:slug', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;
  const { title, content, category, tags, excerpt, readingTime, order } = req.body;

  try {
    const result = articleService.updateArticle(slug, { title, content, category, tags, excerpt, readingTime, order });
    if (!result) return res.status(404).json({ error: '文章不存在' });
    scheduleBuild();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/articles/:slug', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;

  const result = articleService.deleteArticle(slug);
  if (!result) return res.status(404).json({ error: '文章不存在' });
  scheduleBuild();
  res.json({ success: true });
});

// Markdown 预览
app.all('/api/preview', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const content = req.body?.content || req.query?.content || '';
  const html = content ? marked.parse(content) : '';
  res.json({ html: sanitizeHtml(html, { allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'del', 'input', 'sup', 'sub', 'details', 'summary']) }) });
});

// 文章复制
app.post('/api/articles/:slug/duplicate', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;

  try {
    const result = articleService.duplicateArticle(slug);
    if (!result) return res.status(404).json({ error: '文章不存在' });
    scheduleBuild();
    res.json({ success: true, slug: result.slug });
  } catch (e) {
    if (e.message === '文章已存在') return res.status(409).json({ error: e.message });
    res.status(500).json({ error: e.message });
  }
});

// 批量删除
app.post('/api/articles/batch-delete', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slugs } = req.body;
  if (!Array.isArray(slugs)) return res.status(400).json({ error: 'slugs 必须是数组' });

  articleService.batchDelete(slugs);
  scheduleBuild();
  res.json({ success: true });
});

// 批量移动
app.post('/api/articles/batch-move', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slugs, targetCategory } = req.body;

  try {
    articleService.batchMove(slugs, targetCategory);
    scheduleBuild();
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// 图片上传
app.post('/api/upload-image', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { image, slug } = req.body;
  if (!image) return res.status(400).json({ error: '缺少图片数据' });

  try {
    const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: '无效的图片格式' });

    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const year = new Date().getFullYear().toString();
    const imageDir = path.join(IMAGES_DIR, year, slug || 'misc');
    const imageName = `${randomUUID()}.${ext}`;

    fs.mkdirSync(imageDir, { recursive: true });
    fs.writeFileSync(path.join(imageDir, imageName), buffer);

    const publicPath = `/img/${year}/${slug || 'misc'}/${imageName}`;
    res.json({ path: publicPath });
  } catch (e) {
    res.status(500).json({ error: '图片上传失败: ' + e.message });
  }
});

// ============================================================
// GitHub 仓库 API
// ============================================================

const SITE_JSON_PATH = SITE_DATA_PATH;

function loadSiteData() {
  try {
    return JSON.parse(fs.readFileSync(SITE_JSON_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveSiteData(data) {
  fs.writeFileSync(SITE_JSON_PATH, JSON.stringify(data, null, 2));
}

app.get('/api/github', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const siteData = loadSiteData();
  res.json({ repos: siteData.shownRepos || [] });
});

app.get('/api/github/repos', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const githubJsonPath = GITHUB_DATA_PATH;
  try {
    const data = fs.readFileSync(githubJsonPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (e) {
    res.status(500).json({ error: '无法读取仓库数据' });
  }
});

app.put('/api/github/repos', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { shownRepos } = req.body;
  if (!Array.isArray(shownRepos)) return res.status(400).json({ error: '无效的数据' });
  const siteData = loadSiteData();
  siteData.shownRepos = shownRepos;
  saveSiteData(siteData);
  if (DEV && lrServer) lrServer.refresh('/');
  res.json({ success: true });
});

app.post('/api/github/refresh', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const child = spawn('node', ['scripts/github-scraper.mjs'], { cwd: process.cwd(), stdio: 'inherit' });
  childProcesses.add(child);
  child.on('close', () => {
    childProcesses.delete(child);
    if (DEV && lrServer) lrServer.refresh('/');
  });
  child.on('error', () => childProcesses.delete(child));
  res.json({ success: true, refreshing: true });
});

// ============================================================
// 管理界面路由（必须在静态中间件之前）
// ============================================================

app.get(ADMIN_PATH, (req, res) => {
  if (checkAuth(req)) {
    const articles = articleService.readArticleIndex().map(a => ({
      slug: a.slug, category: a.category, title: a.title, tags: a.tags || [], excerpt: a.excerpt || '',
    }));
    res.send(renderAdminPage(articles, 'list'));
  } else {
    res.send(renderLoginPage());
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect(ADMIN_PATH);
});

app.get('/admin/drafts', (req, res) => {
  if (!checkAuth(req)) return res.redirect(ADMIN_PATH);
  const articles = articleService.readArticleIndex().map(a => ({
    slug: a.slug, category: a.category, title: a.title, tags: a.tags || [], excerpt: a.excerpt || '',
  }));
  res.send(renderAdminPage(articles, 'drafts'));
});

app.get('/admin/settings', (req, res) => {
  if (!checkAuth(req)) return res.redirect(ADMIN_PATH);
  const articles = articleService.readArticleIndex().map(a => ({
    slug: a.slug, category: a.category, title: a.title, tags: a.tags || [], excerpt: a.excerpt || '',
  }));
  res.send(renderAdminPage(articles, 'settings'));
});

app.get('/admin/article/:slug', (req, res) => {
  if (!checkAuth(req)) return res.redirect(ADMIN_PATH);
  const articles = articleService.readArticleIndex().map(a => ({
    slug: a.slug, category: a.category, title: a.title, tags: a.tags || [], excerpt: a.excerpt || '',
  }));
  res.send(renderAdminPage(articles, 'editor'));
});

// ============================================================
// 全局错误处理
// ============================================================

app.use((err, req, res, next) => {
  console.error('[观测站] 未捕获错误:', err.message);
  if (req.path.startsWith('/api/')) {
    res.status(500).json({ error: err.message || '服务器内部错误' });
  } else {
    res.status(500).send('服务器内部错误');
  }
});

// ============================================================
// HTML 运行时注入（BASE_PATH + SITE_DATA 热替换，无需重建）
// ============================================================

app.use((req, res, next) => {
  const _send = res.send.bind(res);
  res.send = function(body) {
    if (body && res.get('content-type')?.includes('text/html')) {
      let str = Buffer.isBuffer(body) ? body.toString('utf-8') : body;
      if (typeof str === 'string') {
        let modified = false;
        // 注入 BASE_PATH（兜底 Eleventy 静态页面）
        if (BASE_PATH && str.includes("window.BASE_PATH = ''")) {
          str = str.replace("window.BASE_PATH = ''", `window.BASE_PATH = '${BASE_PATH}'`);
          modified = true;
        }
        // 注入最新的 SITE_DATA，使管理后台修改 GitHub 展示列表后实时生效
        try {
          const siteData = loadSiteData();
          str = str.replace(/window\.SITE_DATA\s*=\s*[^;]+;/, `window.SITE_DATA = ${JSON.stringify(siteData)};`);
          modified = true;
        } catch {}
        if (modified) {
          res.set('content-length', Buffer.byteLength(str));
          return _send(str);
        }
      }
    }
    return _send(body);
  };
  next();
});

// ============================================================
// 静态文件托管 + SPA fallback
// ============================================================

if (fs.existsSync(SITE_DIR)) {
  app.use(express.static(SITE_DIR, { index: ['index.html', 'index.htm'] }));
  app.use((req, res, next) => {
    if (res.headersSent) return next();
    res.sendFile(path.join(SITE_DIR, 'index.html'));
  });
} else {
  console.warn('[观测站] _site 目录不存在，请先运行 npm run build');
}

// ============================================================
// 开发模式热重载
// ============================================================

let lrServer = null;
let srcWatcher = null;

async function startDevServer() {
  console.log('[观测站] 正在构建...');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('node scripts/build-js.mjs && node scripts/article-scanner.mjs && npx eleventy', [], {
        cwd: process.cwd(), stdio: 'inherit', shell: true,
      });
      child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`initial-build exited with code ${code}`)));
      child.on('error', reject);
    });
  } catch (e) {
    console.error('[观测站] 初始构建失败:', e.message);
    return;
  }

  const lrPort = 3002;
  lrServer = livereload.createServer({ port: lrPort }, () => {
    console.log(`[观测站] 热刷新已启用 http://localhost:${lrPort}`);
  });
  lrServer.watch(SITE_DIR);

  srcWatcher = chokidar.watch('src', {
    ignoreInitial: true,
    persistent: true,
    ignored: [
      /(^|[/\\])_data[/\\]/,
      'src/assets/js/bundle.js',
      'src/assets/js/bundle.js.map',
      'src/assets/js/admin-panel.bundle.js',
      'src/assets/js/admin-panel.bundle.js.map',
    ],
  });

  let rebuildTimer = null;
  srcWatcher.on('all', (event, filePath) => {
    console.log(`[观测站] 检测到变化: ${event} ${path.relative(process.cwd(), filePath)}`);
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      console.log('[观测站] 正在重建...');
      try {
        await runEleventy();
        lrServer.refresh('/');
        console.log('[观测站] 重建完成');
      } catch (e) {
        console.error('[观测站] 重建失败:', e.message);
      }
    }, 800);
  });

  console.log('[观测站] 监听文件变化中...');
}

// ============================================================
// 启动
// ============================================================

if (DEV) {
  startDevServer();
}

const server = app.listen(PORT, () => {
  console.log(`[观测站] 网站已托管在 http://localhost:${PORT}`);
  console.log(`[观测站] 管理界面 http://localhost:${PORT}${ADMIN_PATH}`);
});

// Graceful Shutdown
function shutdown(signal) {
  console.log(`\n[观测站] 收到 ${signal}，正在关闭...`);
  if (buildTimer) clearTimeout(buildTimer);
  if (lrServer) { try { lrServer.close(); } catch (e) {} }
  if (srcWatcher) { try { srcWatcher.close(); } catch (e) {} }
  for (const child of childProcesses) {
    try { child.kill(); } catch (e) {}
  }
  childProcesses.clear();
  server.close(() => {
    console.log('[观测站] 已关闭，再见！');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[观测站] 强制退出');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
