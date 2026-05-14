import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import chokidar from 'chokidar';
import livereload from 'livereload';
import matter from 'gray-matter';
import { randomUUID } from 'crypto';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import rateLimit from 'express-rate-limit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const ARTICLES_DIR = path.join(CONTENT_DIR, 'articles');
const ARTICLES_JSON = path.join(ROOT, 'src', 'articles', '_data', 'articles.json');
const SITE_DIR = path.join(ROOT, '_site');
const PORT = process.env.PORT || 8080;
const ADMIN_PATH = process.env.ADMIN_PATH || '/admin';
const DEV = process.env.NODE_ENV !== 'production';

const PASSWORD = process.env.ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error('[观测站] 错误: ADMIN_PASSWORD 环境变量未设置');
  process.exit(1);
}

const app = express();
app.use(express.json());

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
// 安全工具函数
// ============================================================

const VALID_CATEGORIES = ['tutorials', 'blog', 'essays', 'projects'];

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function validateCategory(category) {
  return VALID_CATEGORIES.includes(category);
}

function safePath(baseDir, userPath) {
  const normalized = path.normalize(userPath);
  const resolved = path.resolve(baseDir, normalized);
  if (!resolved.startsWith(baseDir)) {
    return null; // 路径穿越尝试
  }
  return resolved;
}

// ============================================================
// 异步构建队列（防止 execSync 阻塞事件循环）
// ============================================================

let buildQueue = Promise.resolve();

function enqueueBuild() {
  buildQueue = buildQueue.then(() => runCommand('eleventy', ['npx', 'eleventy'])).catch(err => {
    console.error('[观测站] 构建失败:', err.message);
  });
  return buildQueue;
}

function runCommand(name, cmdArgs) {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = cmdArgs;
    const child = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${name} exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

// ============================================================
// 文章数据读写（基于 articles.json 增量更新）
// ============================================================

function readArticlesIndex() {
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf8'));
  } catch (err) {
    const backup = ARTICLES_JSON + '.bak';
    try {
      fs.copyFileSync(ARTICLES_JSON, backup);
      console.error(`[观测站] articles.json 损坏，已备份到 ${backup}: ${err.message}`);
    } catch {}
    throw new Error(`articles.json 读取失败: ${err.message}`);
  }
}

function saveArticlesIndex(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('拒绝写入空的 articles.json，索引可能已损坏');
  }
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));
}

function getArticlePath(entry) {
  return path.join(ARTICLES_DIR, entry.category, entry.filename);
}

// 从 articles.json 读取列表（不含 content）
function listArticles() {
  return readArticlesIndex().map(a => ({
    slug: a.slug,
    category: a.category,
    title: a.title,
    tags: a.tags || [],
    excerpt: a.excerpt || '',
    order: a.order !== undefined ? a.order : 0,
    path: getArticlePath(a),
  }));
}

// 读取单篇（含 content）
function getArticle(slug) {
  const index = readArticlesIndex();
  const entry = index.find(a => a.slug === slug);
  if (!entry) return null;

  const filePath = getArticlePath(entry);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug: entry.slug,
    category: entry.category,
    title: entry.title || data.title || entry.slug,
    tags: entry.tags || data.tags || [],
    excerpt: entry.excerpt || data.excerpt || '',
    readingTime: entry.readingTime || data.readingTime || '1 min',
    order: entry.order !== undefined ? entry.order : 0,
    path: filePath,
    content,
  };
}

// 增量更新 articles.json 中单篇文章的元数据
function updateArticleIndex(slug, updates) {
  const articles = readArticlesIndex();
  const idx = articles.findIndex(a => a.slug === slug);
  const now = new Date().toISOString().split('T')[0];

  if (idx !== -1) {
    articles[idx] = { ...articles[idx], ...updates, date: now };
  } else {
    articles.push({
      id: `article_${randomUUID()}`,
      slug,
      title: updates.title || slug,
      category: updates.category,
      tags: updates.tags || [],
      excerpt: updates.excerpt || '',
      readingTime: updates.readingTime || '1 min',
      date: now,
      filename: `${slug}.md`,
      source: 'manual',
      sourceLogId: null,
      status: 'published',
    });
  }

  saveArticlesIndex(articles);
}

// 从 articles.json 中删除一篇文章
function removeArticleIndex(slug, category) {
  const articles = readArticlesIndex();
  const filtered = articles.filter(
    a => !(a.slug === slug && a.category === category)
  );
  saveArticlesIndex(filtered);
}

// ============================================================
// 模板渲染
// ============================================================

const LOGIN_TPL = path.join(__dirname, 'templates', 'admin-login.html');
const PANEL_TPL = path.join(__dirname, 'templates', 'admin-panel.html');

function readTemplate(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

function renderLoginPage() {
  return readTemplate(LOGIN_TPL);
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
    .replace('%%PAGE_MODE%%', pageMode);
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
      secure: process.env.NODE_ENV === 'production',
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
  res.json(listArticles());
});

app.get('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const article = getArticle(req.params.slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json(article);
});

app.post('/api/articles', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { title, category, content, tags, excerpt, readingTime, order } = req.body;
  if (!title || !category || !content) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  if (!validateCategory(category)) {
    return res.status(400).json({ error: '无效的分类' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${slug}.md`;
  const filePath = safePath(ARTICLES_DIR, path.join(category, filename));
  if (!filePath) return res.status(400).json({ error: '无效的路径' });

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: '文章已存在' });
  }

  const frontmatter = matter.stringify(content, {
    title,
    date: new Date().toISOString(),
    category,
    tags: tags || [],
    excerpt: excerpt || '',
    readingTime: readingTime || '1 min',
    order: order || 0,
  });

  fs.writeFileSync(filePath, frontmatter);
  updateArticleIndex(slug, { title, category, tags, excerpt, readingTime, order });

  await enqueueBuild().catch(e => console.error('[观测站] 重建失败:', e.message));

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true, slug, path: filePath });
});

// 批量更新排序
app.put('/api/articles/order', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { orders } = req.body;
  if (!Array.isArray(orders)) return res.status(400).json({ error: 'orders 必须是数组' });

  const articles = readArticlesIndex();
  orders.forEach(({ slug, order }) => {
    const idx = articles.findIndex(a => a.slug === slug);
    if (idx !== -1) articles[idx].order = order;
  });
  saveArticlesIndex(articles);
  res.json({ success: true });
});

app.put('/api/articles/:slug', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;
  const { title, content, category, tags, excerpt, readingTime, order } = req.body;

  const article = getArticle(slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });

  const newCategory = category || article.category;
  const newPath = path.join(ARTICLES_DIR, newCategory, `${slug}.md`);
  const oldPath = article.path;

  if (category && category !== article.category) {
    fs.mkdirSync(path.join(ARTICLES_DIR, newCategory), { recursive: true });
  }

  const newContent = content !== undefined ? content : article.content;
  const frontmatter = matter.stringify(newContent, {
    title: title || article.title,
    date: new Date().toISOString(),
    category: newCategory,
    tags: tags !== undefined ? tags : article.tags,
    excerpt: excerpt !== undefined ? excerpt : article.excerpt,
    readingTime: readingTime !== undefined ? readingTime : article.readingTime,
    order: order !== undefined ? order : article.order,
  });

  try {
    fs.writeFileSync(newPath, frontmatter);
  } catch (e) {
    return res.status(500).json({ error: '写入文件失败: ' + e.message });
  }

  // 如果路径变了（旧分类变到新分类，或者同分类但路径不同），删旧文件
  if (newPath !== oldPath && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }

  // 增量更新索引：只更新已有条目，不新建
  updateArticleIndex(slug, {
    title: title || article.title,
    category: newCategory,
    tags: tags !== undefined ? tags : article.tags,
    excerpt: excerpt !== undefined ? excerpt : article.excerpt,
    readingTime: readingTime !== undefined ? readingTime : article.readingTime,
    order: order !== undefined ? order : article.order,
    filename: `${slug}.md`,
  });

  await enqueueBuild().catch(e => console.error('[观测站] 重建失败:', e.message));

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

app.delete('/api/articles/:slug', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;

  const article = getArticle(slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });

  fs.unlinkSync(article.path);
  removeArticleIndex(slug, article.category);

  await enqueueBuild().catch(e => {
    console.error('[观测站] 重建失败:', e.message);
  });

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// Markdown 预览（支持 GET query 和 POST body）
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
  const article = getArticle(slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });

  const newTitle = '副本-' + article.title;
  const newSlug = newTitle.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${newSlug}.md`;
  const filePath = path.join(ARTICLES_DIR, article.category, filename);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: '文章已存在' });
  }

  const frontmatter = matter.stringify(article.content, {
    title: newTitle,
    date: new Date().toISOString(),
    category: article.category,
    tags: article.tags,
    excerpt: article.excerpt,
    readingTime: article.readingTime,
    order: 0,
  });

  fs.writeFileSync(filePath, frontmatter);
  updateArticleIndex(newSlug, {
    title: newTitle,
    category: article.category,
    tags: article.tags,
    excerpt: article.excerpt,
    readingTime: article.readingTime,
    order: 0,
  });

  await enqueueBuild().catch(e => console.error('[观测站] 重建失败:', e.message));

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true, slug: newSlug });
});

// 批量删除
app.post('/api/articles/batch-delete', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slugs } = req.body;
  if (!Array.isArray(slugs)) return res.status(400).json({ error: 'slugs 必须是数组' });

  slugs.forEach(({ slug, category }) => {
    const article = getArticle(slug);
    if (article && fs.existsSync(article.path)) {
      fs.unlinkSync(article.path);
    }
    removeArticleIndex(slug, category);
  });

  await enqueueBuild().catch(e => console.error('[观测站] 重建失败:', e.message));

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// 批量移动
app.post('/api/articles/batch-move', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slugs, targetCategory } = req.body;
  if (!Array.isArray(slugs) || !targetCategory) {
    return res.status(400).json({ error: '需要 slugs 数组和 targetCategory' });
  }
  if (!validateCategory(targetCategory)) {
    return res.status(400).json({ error: '无效的分类' });
  }

  slugs.forEach(({ slug }) => {
    const article = getArticle(slug);
    if (!article) return;
    const safeNewPath = safePath(ARTICLES_DIR, path.join(targetCategory, `${slug}.md`));
    if (!safeNewPath) return; // 路径穿越被阻止
    const oldPath = article.path;
    if (targetCategory !== article.category) {
      fs.mkdirSync(path.join(ARTICLES_DIR, targetCategory), { recursive: true });
    }
    if (fs.existsSync(oldPath)) {
      const raw = fs.readFileSync(oldPath, 'utf-8');
      const { data, content } = matter(raw);
      const frontmatter = matter.stringify(content, { ...data, category: targetCategory });
      fs.writeFileSync(safeNewPath, frontmatter);
      fs.unlinkSync(oldPath);
    }
    updateArticleIndex(slug, { category: targetCategory });
  });

  await enqueueBuild().catch(e => console.error('[观测站] 重建失败:', e.message));

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// ============================================================
// GitHub 仓库 API
// ============================================================

const SITE_JSON_PATH = path.join(ROOT, 'src', '_data', 'site.json');

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

// 获取 shownRepos
app.get('/api/github', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const siteData = loadSiteData();
  res.json({ repos: siteData.shownRepos || [] });
});

// 获取完整 GitHub 仓库列表
app.get('/api/github/repos', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const githubJsonPath = path.join(ROOT, 'src', '_data', 'github.json');
  try {
    const data = fs.readFileSync(githubJsonPath, 'utf-8');
    const githubData = JSON.parse(data);
    res.json(githubData);
  } catch (e) {
    res.status(500).json({ error: '无法读取仓库数据' });
  }
});

// 保存 shownRepos
app.put('/api/github/repos', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { shownRepos } = req.body;
  if (!Array.isArray(shownRepos)) return res.status(400).json({ error: '无效的数据' });
  const siteData = loadSiteData();
  siteData.shownRepos = shownRepos;
  saveSiteData(siteData);
  // 触发热更新：重新构建站点
  if (DEV && lrServer) lrServer.refresh('/');
  res.json({ success: true });
});

// 刷新 GitHub 数据
app.post('/api/github/refresh', async (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  // 异步执行，不阻塞
  const child = spawn('node', ['scripts/github-scraper.mjs'], { cwd: ROOT, stdio: 'inherit' });
  child.on('close', () => {
    if (DEV && lrServer) lrServer.refresh('/');
  });
  res.json({ success: true, refreshing: true });
});

// ============================================================
// 管理界面路由（必须在静态中间件之前）
// ============================================================

app.get(ADMIN_PATH, (req, res) => {
  if (checkAuth(req)) {
    res.send(renderAdminPage(listArticles(), 'list'));
  } else {
    res.send(renderLoginPage());
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect(ADMIN_PATH);
});

// /admin/drafts → 草稿箱
app.get('/admin/drafts', (req, res) => {
  if (!checkAuth(req)) return res.redirect(ADMIN_PATH);
  res.send(renderAdminPage(listArticles(), 'drafts'));
});

// /admin/settings → 设置页
app.get('/admin/settings', (req, res) => {
  if (!checkAuth(req)) return res.redirect(ADMIN_PATH);
  res.send(renderAdminPage(listArticles(), 'settings'));
});

// /admin/article/:slug → 文章编辑
app.get('/admin/article/:slug', (req, res) => {
  if (!checkAuth(req)) return res.redirect(ADMIN_PATH);
  res.send(renderAdminPage(listArticles(), 'editor'));
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

async function startDevServer() {
  console.log('[观测站] 正在构建...');
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('node scripts/build-js.mjs && node scripts/article-scanner.mjs && npx eleventy', [], {
        cwd: ROOT, stdio: 'inherit', shell: true,
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

  const srcWatcher = chokidar.watch(path.join(ROOT, 'src'), {
    ignoreInitial: true,
    persistent: true,
    ignored: [
      path.join(ROOT, 'src', 'assets', 'js', 'bundle.js'),
      path.join(ROOT, 'src', 'assets', 'js', 'bundle.js.map'),
    ],
  });

  let rebuildTimer = null;
  srcWatcher.on('all', (event, filePath) => {
    console.log(`[观测站] 检测到变化: ${event} ${path.relative(ROOT, filePath)}`);
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(async () => {
      console.log('[观测站] 正在重建...');
      try {
        await runCommand('build', ['npm', 'run', 'build']);
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

// Graceful Shutdown（PM2 / Docker / kill 信号优雅关闭）
function shutdown(signal) {
  console.log(`\n[观测站] 收到 ${signal}，正在关闭...`);
  if (lrServer) {
    try { lrServer.close(); } catch (e) {}
  }
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