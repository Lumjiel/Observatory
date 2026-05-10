import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chokidar from 'chokidar';
import livereload from 'livereload';
import matter from 'gray-matter';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src', 'articles');
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
    const [k, v] = c.trim().split('=');
    cookies[k] = v;
  });
  req.cookies = cookies;
  next();
});

// ============================================================
// 文章数据读写（基于 articles.json 增量更新）
// ============================================================

function readArticlesIndex() {
  try {
    return JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf8'));
  } catch {
    return [];
  }
}

function saveArticlesIndex(articles) {
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));
}

function getArticlePath(slug, category) {
  return path.join(ARTICLES_DIR, category, `${slug}.md`);
}

// 从 articles.json 读取列表（不含 content）
function listArticles() {
  return readArticlesIndex().map(a => ({
    slug: a.slug,
    category: a.category,
    title: a.title,
    tags: a.tags || [],
    path: getArticlePath(a.slug, a.category),
  }));
}

// 读取单篇（含 content）
function getArticle(slug) {
  const index = readArticlesIndex();
  const entry = index.find(a => a.slug === slug);
  if (!entry) return null;

  const filePath = getArticlePath(entry.slug, entry.category);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug: entry.slug,
    category: entry.category,
    title: entry.title || data.title || entry.slug,
    tags: entry.tags || data.tags || [],
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

function renderAdminPage(articles) {
  const categoryLabels = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
  const categoryOptions = Object.entries(categoryLabels)
    .map(([v, l]) => `<option value="${v}">${l}</option>`)
    .join('');

  const articleList = articles.map(a => `
    <div class="article-item" data-slug="${a.slug}" onclick="loadArticle('${a.slug}')">
      <div class="article-item-title">${a.title}</div>
      <div class="article-item-meta">
        <span class="cat-tag cat-${a.category}">${categoryLabels[a.category] || a.category}</span>
        <span>${a.tags.slice(0, 2).join(', ')}${a.tags.length > 2 ? '...' : ''}</span>
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
    .replace('%%CATEGORY_OPTIONS%%', categoryOptions);
}

// ============================================================
// API 路由（认证相关放最前）
// ============================================================

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    res.cookie(COOKIE_NAME, AUTH_VALUE, {
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 86400000,
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

app.post('/api/articles', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { title, category, content, tags } = req.body;
  if (!title || !category || !content) {
    return res.status(400).json({ error: '缺少必填字段' });
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '');
  const filePath = getArticlePath(slug, category);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: '文章已存在' });
  }

  const frontmatter = matter.stringify(content, {
    title,
    date: new Date().toISOString(),
    category,
    tags: tags || [],
  });

  fs.writeFileSync(filePath, frontmatter);
  updateArticleIndex(slug, { title, category, tags });

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true, slug, path: filePath });
});

app.put('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;
  const { title, content, category, tags } = req.body;

  const article = getArticle(slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });

  const newCategory = category || article.category;
  const newPath = getArticlePath(slug, newCategory);

  if (category && category !== article.category) {
    fs.mkdirSync(path.join(ARTICLES_DIR, newCategory), { recursive: true });
    fs.unlinkSync(article.path);
    removeArticleIndex(slug, article.category);
  }

  const newContent = content !== undefined ? content : article.content;
  const frontmatter = matter.stringify(newContent, {
    title: title || article.title,
    date: new Date().toISOString(),
    category: newCategory,
    tags: tags !== undefined ? tags : article.tags,
  });

  fs.writeFileSync(newPath, frontmatter);

  updateArticleIndex(slug, {
    title: title || article.title,
    category: newCategory,
    tags: tags !== undefined ? tags : article.tags,
  });

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

app.delete('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;

  const article = getArticle(slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });

  fs.unlinkSync(article.path);
  removeArticleIndex(slug, article.category);

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// ============================================================
// 管理界面路由（必须在静态中间件之前）
// ============================================================

app.get(ADMIN_PATH, (req, res) => {
  if (checkAuth(req)) {
    res.send(renderAdminPage(listArticles()));
  } else {
    res.send(renderLoginPage());
  }
});

app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect(ADMIN_PATH);
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

function startDevServer() {
  console.log('[观测站] 正在构建...');
  try {
    execSync('node scripts/build-js.mjs && node scripts/article-scanner.mjs && npx eleventy', { cwd: ROOT, stdio: 'inherit' });
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
    rebuildTimer = setTimeout(() => {
      console.log('[观测站] 正在重建...');
      try {
        execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
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

app.listen(PORT, () => {
  console.log(`[观测站] 网站已托管在 http://localhost:${PORT}`);
  console.log(`[观测站] 管理界面 http://localhost:${PORT}${ADMIN_PATH}`);
});