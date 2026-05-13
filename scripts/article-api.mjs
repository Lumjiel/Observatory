import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chokidar from 'chokidar';
import livereload from 'livereload';
import matter from 'gray-matter';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import markdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import rateLimit from 'express-rate-limit';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CONTENT_DIR = path.join(ROOT, 'content');
const ARTICLES_DIR = path.join(CONTENT_DIR, 'articles');
const ARTICLES_JSON = path.join(ROOT, 'src', 'articles', '_data', 'articles.json');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');
const SITE_DIR = path.join(ROOT, '_site');
const PORT = process.env.PORT || 8080;

const md = markdownIt();
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
// 图片路径解析 — Obsidian ![[Pasted_image_xxx.png]] → 实际存储路径
// 搜索 content/images/{year}/{slug}/ 下是否存在同名文件
// ============================================================
function resolveImagePath(filename, slug) {
  if (!slug) return `/img/${filename}`;
  try {
    const yearDirs = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });
    for (const entry of yearDirs) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(IMAGES_DIR, entry.name, slug, filename);
      if (fs.existsSync(candidate)) {
        return `/img/${entry.name}/${slug}/${filename}`;
      }
    }
  } catch (e) {
    // 目录不存在，忽略
  }
  // fallback: 使用当前年份
  const year = new Date().getFullYear().toString();
  return `/img/${year}/${slug}/${filename}`;
}

// 保存时将 Obsidian 图片语法转为带目录的标准 Markdown 路径
function convertObsidianImages(content, slug) {
  return content.replace(
    /!\[\[(Pasted_image_.+?\.png)\]\]/g,
    (match, filename) => {
      const resolved = resolveImagePath(filename, slug);
      return `![${filename}](${resolved})`;
    }
  );
}

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

function renderAdminPage(articles) {
  const categoryLabels = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
  const categoryOptions = Object.entries(categoryLabels)
    .map(([v, l]) => `<option value="${escapeHtml(v)}">${escapeHtml(l)}</option>`)
    .join('');

  const articleList = articles.map(a => `
    <div class="article-item" data-slug="${escapeHtml(a.slug)}" onclick="window.handleItemClick('${escapeHtml(a.slug)}', event)">
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
    .replace('%%CATEGORY_OPTIONS%%', categoryOptions);
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
  let articles = listArticles();
  const q = req.query.q;
  if (q) {
    const keyword = q.toLowerCase();
    articles = articles.filter(a =>
      (a.title || '').toLowerCase().includes(keyword) ||
      (a.tags || []).some(t => t.toLowerCase().includes(keyword))
    );
  }
  res.json(articles);
});

app.get('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const article = getArticle(req.params.slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json(article);
});

app.post('/api/articles', (req, res) => {
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
  const safePath = safePath(ARTICLES_DIR, path.join(category, filename));
  if (!safePath) return res.status(400).json({ error: '无效的路径' });

  if (fs.existsSync(safePath)) {
    return res.status(409).json({ error: '文章已存在' });
  }

  // 保存时转换 Obsidian 图片语法为标准路径
  const convertedContent = convertObsidianImages(content, slug);
  const frontmatter = matter.stringify(convertedContent, {
    title,
    date: new Date().toISOString(),
    category,
    tags: tags || [],
    excerpt: excerpt || '',
    readingTime: readingTime || '1 min',
    order: order || 0,
  });

  fs.writeFileSync(safePath, frontmatter);
  updateArticleIndex(slug, { title, category, tags, excerpt, readingTime, order });

  try {
    execSync('npx eleventy --incremental', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 重建失败:', e.message);
  }

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true, slug, path: safePath });
});

app.put('/api/articles/:slug', (req, res) => {
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
  const finalContent = convertObsidianImages(newContent, slug);
  const frontmatter = matter.stringify(finalContent, {
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
  });

  try {
    execSync('npx eleventy --incremental', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 重建失败:', e.message);
  }

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

  try {
    execSync('npx eleventy --incremental', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 重建失败:', e.message);
  }

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// Markdown 预览（POST 方式避免 URL 长度限制）
app.post('/api/preview', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { content, slug } = req.body;

  if (!content) return res.json({ html: '' });

  // 图片路径转换：兼容 Obsidian 语法 + 相对路径
  const processed = content
    .replace(
      /!\[\[(Pasted_image_.+?\.png)\]\]/g,
      (match, filename) => {
        const resolved = resolveImagePath(filename, slug);
        return `![${filename}](${resolved})`;
      }
    )
    .replace(/\]\(img\//g, '](/img/');

  const html = md.render(processed);
  const cleanHtml = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      img: ['src', 'alt', 'title'],
      a: ['href', 'title', 'target', 'rel']
    },
    allowedSchemes: ['http', 'https', 'mailto']
  });

  res.json({ html: cleanHtml });
});

// 图片上传
app.post('/api/upload-image', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { image, slug, year } = req.body;
  if (!image) return res.status(400).json({ error: '缺少图片数据' });

  const targetYear = year || new Date().getFullYear().toString();
  const targetSlug = slug || 'misc';
  const uploadDir = path.join(IMAGES_DIR, targetYear, targetSlug);

  try {
    fs.mkdirSync(uploadDir, { recursive: true });
  } catch (e) {
    return res.status(500).json({ error: '创建目录失败' });
  }

  // 解析 base64 数据
  const matches = image.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) return res.status(400).json({ error: '无效的图片格式' });

  const ext = matches[1];
  const data = matches[2];
  const filename = `${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);

  try {
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  } catch (e) {
    return res.status(500).json({ error: '保存图片失败' });
  }

  const imagePath = `/img/${targetYear}/${targetSlug}/${filename}`;
  res.json({ success: true, path: imagePath });
});

// 文章复制
app.post('/api/articles/:slug/duplicate', (req, res) => {
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

  const convertedContent = convertObsidianImages(article.content, newSlug);
  const frontmatter = matter.stringify(convertedContent, {
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

  try {
    execSync('npx eleventy --incremental', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 重建失败:', e.message);
  }

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true, slug: newSlug });
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

// 批量删除
app.post('/api/articles/batch-delete', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slugs } = req.body;
  if (!Array.isArray(slugs)) return res.status(400).json({ error: 'slugs 必须是数组' });

  slugs.forEach(({ slug, category }) => {
    const article = getArticle(slug);
    if (article && fs.existsSync(article.path)) {
      fs.unlinkSync(article.path);
    }
    removeArticleIndex(slug, category || (article ? article.category : undefined));
  });

  try {
    execSync('npx eleventy --incremental', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 重建失败:', e.message);
  }

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// 批量移动
app.post('/api/articles/batch-move', (req, res) => {
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

  try {
    execSync('npx eleventy --incremental', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 重建失败:', e.message);
  }

  if (DEV && lrServer) lrServer.refresh('/');

  res.json({ success: true });
});

// ============================================================
// 管理界面路由（必须在静态中间件之前）
// ============================================================

app.get(ADMIN_PATH, (req, res) => {
  console.log('DEBUG /admin route hit');
  console.log('DEBUG cookies:', req.cookies);
  console.log('DEBUG AUTH_VALUE:', AUTH_VALUE);
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
// 静态文件托管 + 图片实时服务 + SPA fallback
// ============================================================

// 优先从 content/images 提供图片（上传后立即可用，无需等 Eleventy 重建）
app.use('/img', express.static(IMAGES_DIR));

if (fs.existsSync(SITE_DIR)) {
  app.use(express.static(SITE_DIR, { index: ['index.html', 'index.htm'] }));
  app.use((req, res, next) => {
    if (res.headersSent) return next();
    // 只对非 API 和非管理路径的请求 fallback 到 index.html
    if (req.path.startsWith('/api') || req.path.startsWith('/admin')) return next();
    res.sendFile(path.join(SITE_DIR, 'index.html'));
  });
} else {
  console.warn('[观测站] _site 目录不存在，请先运行 npm run build');
}

// ============================================================
// 开发模式热重载
// ============================================================

let lrServer = null;

// 预先设置 unhandledException 处理，防止 livereload 端口冲突导致进程崩溃
process.on('uncaughtException', (err) => {
  if (err.code === 'EADDRINUSE' || err.message?.includes('EADDRINUSE')) {
    console.warn(`[观测站] 端口冲突忽略: ${err.address}:${err.port || 3002}`);
    return;
  }
  console.error('[观测站] 未捕获的错误:', err);
});

function startDevServer() {
  console.log('[观测站] 正在构建...');
  try {
    execSync('node scripts/build-js.mjs && node scripts/article-scanner.mjs && npx eleventy', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('[观测站] 初始构建失败(非致命):', e.message);
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
      path.join(ROOT, 'src', 'assets', 'js', 'admin-panel.js'),
      path.join(ROOT, 'src', 'assets', 'js', 'admin-panel.js.map'),
    ],
  });

  let rebuildTimer = null;
  srcWatcher.on('all', (event, filePath) => {
    console.log(`[观测站] 检测到变化: ${event} ${path.relative(ROOT, filePath)}`);
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(() => {
      console.log('[观测站] 正在重建...');
      try {
        execSync('npx eleventy', { cwd: ROOT, stdio: 'inherit' });
        if (lrServer) lrServer.refresh('/');
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