import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import chokidar from 'chokidar';
import livereload from 'livereload';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ARTICLES_DIR = path.join(ROOT, 'src', 'articles');
const ARTICLES_JSON = path.join(ROOT, 'src', 'articles', '_data', 'articles.json');
const SITE_DIR = path.join(ROOT, '_site');
const PORT = process.env.PORT || 8080;
const PASSWORD = process.env.ADMIN_PASSWORD || '5jiaobaba';
const DEV = process.env.NODE_ENV !== 'production';

const app = express();
app.use(express.json());

// 简单 sessionless 认证：cookie 标记
const COOKIE_NAME = 'admin_auth';
const AUTH_VALUE = Buffer.from('admin:' + PASSWORD).toString('base64');

function checkAuth(req) {
  return req.cookies && req.cookies[COOKIE_NAME] === AUTH_VALUE;
}

// cookie-parser or manual
app.use((req, res, next) => {
  const cookies = {};
  req.headers.cookie && req.headers.cookie.split(';').forEach(c => {
    const [k, v] = c.trim().split('=');
    cookies[k] = v;
  });
  req.cookies = cookies;
  next();
});

// 读取所有文章（含标签和内容）
function readArticles() {
  const categories = ['tutorials', 'blog', 'essays', 'projects'];
  const articles = [];
  // 从 articles.json 读取完整元数据
  let articlesIndex = [];
  try {
    articlesIndex = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf8'));
  } catch(e) {}

  for (const cat of categories) {
    const catDir = path.join(ARTICLES_DIR, cat);
    if (!fs.existsSync(catDir)) continue;
    for (const file of fs.readdirSync(catDir)) {
      if (!file.endsWith('.md')) continue;
      const filePath = path.join(catDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const fileSlug = file.replace('.md', '');
      const frontmatter = parseFrontmatter(content);
      // 用 filename 直接匹配（最准确）
      let indexEntry = articlesIndex.find(a => a.filename === file);
      // fallback：用 slug 匹配
      if (!indexEntry) {
        indexEntry = articlesIndex.find(a => a.slug === fileSlug);
      }
      articles.push({
        slug: fileSlug,
        category: cat,
        title: indexEntry ? indexEntry.title : (frontmatter.title || fileSlug),
        tags: indexEntry && indexEntry.tags ? indexEntry.tags : frontmatter.tags,
        path: filePath,
        content: frontmatter.body
      });
    }
  }
  return articles;
}

function parseFrontmatter(content) {
  const result = { title: '', tags: [], body: '' };
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) { result.body = content; return result; }
  const frontmatterBlock = match[1];
  result.body = match[2];

  // 处理多行标签格式: tags:\n  - tag1\n  - tag2
  if (frontmatterBlock.includes('tags:')) {
    const tagBlockMatch = frontmatterBlock.match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
    if (tagBlockMatch) {
      result.tags = tagBlockMatch[1].split('\n').map(t => t.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
    } else {
      // 处理单行格式: tags: tag1, tag2
      const tagLineMatch = frontmatterBlock.match(/^tags:\s*(.+)$/m);
      if (tagLineMatch) {
        result.tags = tagLineMatch[1].split(',').map(t => t.trim()).filter(Boolean);
      }
    }
  }

  // 解析标题
  const titleMatch = frontmatterBlock.match(/^title:\s*(.+)$/m);
  if (titleMatch) result.title = titleMatch[1].trim();

  return result;
}

// 重建索引
function rebuildIndex() {
  try {
    execSync('node scripts/article-scanner.mjs', { cwd: ROOT });
    return true;
  } catch(e) {
    console.error('Rebuild failed:', e.message);
    return false;
  }
}

// 开发模式：监听文件变化并重建
let lrServer = null;

function startDevServer() {
  console.log('[观测站] 正在构建...');
  try {
    execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
  } catch(e) {
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
    persistent: true
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
      } catch(e) {
        console.error('[观测站] 重建失败:', e.message);
      }
    }, 800);
  });

  console.log('[观测站] 监听文件变化中...');
}

// API: 登录
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === PASSWORD) {
    res.cookie(COOKIE_NAME, AUTH_VALUE, { httpOnly: true, sameSite: 'strict', maxAge: 86400000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: '密码错误' });
  }
});

// API: 登出
app.post('/api/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ success: true });
});

// API: 列出文章
app.get('/api/articles', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  res.json(readArticles());
});

// API: 获取单篇文章
app.get('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const articles = readArticles();
  const article = articles.find(a => a.slug === req.params.slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  res.json(article);
});

// API: 新建文章
app.post('/api/articles', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { title, category, content, tags } = req.body;
  if (!title || !category || !content) {
    return res.status(400).json({ error: '缺少必填字段' });
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '');
  const filename = `${slug}.md`;
  const catDir = path.join(ARTICLES_DIR, category);
  const filePath = path.join(catDir, filename);

  if (fs.existsSync(filePath)) {
    return res.status(409).json({ error: '文章已存在' });
  }

  const frontmatter = `---
title: ${title}
date: ${new Date().toISOString()}
category: ${category}
tags: ${tags && tags.length ? tags.join(', ') : ''}
---
${content}`;
  fs.writeFileSync(filePath, frontmatter);
  rebuildIndex();
  res.json({ success: true, slug, path: filePath });
});

// API: 更新文章
app.put('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;
  const { title, content, category, tags } = req.body;
  const articles = readArticles();
  const article = articles.find(a => a.slug === slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });

  let fileContent = fs.readFileSync(article.path, 'utf-8');
  const frontmatterEnd = fileContent.indexOf('---', 4);
  const frontmatter = frontmatterEnd !== -1 ? fileContent.slice(0, frontmatterEnd + 3) : '';

  let newContent = content !== undefined ? content : article.content;
  let newCategory = category !== undefined ? category : article.category;

  if (category && category !== article.category) {
    const newDir = path.join(ARTICLES_DIR, newCategory);
    const newPath = path.join(newDir, `${slug}.md`);
    fs.mkdirSync(newDir, { recursive: true });
    fs.unlinkSync(article.path);
    article.path = newPath;
  }

  // 重建 frontmatter
  const lines = frontmatter.split('\n').filter(l => !l.startsWith('title:') && !l.startsWith('tags:') && !l.startsWith('date:') && !l.startsWith('category:'));
  const newFrontmatter = lines.filter(l => l.trim()).join('\n');
  let newFront = '---\n';
  newFront += `title: ${title || article.title}\n`;
  newFront += `date: ${new Date().toISOString()}\n`;
  newFront += `category: ${newCategory}\n`;
  if (tags !== undefined) {
    newFront += `tags: ${tags.join(', ')}\n`;
  } else if (article.tags.length) {
    newFront += `tags: ${article.tags.join(', ')}\n`;
  }
  newFront += newFrontmatter.replace(/^---\n/, '');

  fs.writeFileSync(article.path, newFront + '\n' + newContent);
  rebuildIndex();
  res.json({ success: true });
});

// API: 删除文章
app.delete('/api/articles/:slug', (req, res) => {
  if (!checkAuth(req)) return res.status(401).json({ error: 'Unauthorized' });
  const { slug } = req.params;
  const articles = readArticles();
  const article = articles.find(a => a.slug === slug);
  if (!article) return res.status(404).json({ error: '文章不存在' });
  fs.unlinkSync(article.path);
  rebuildIndex();
  res.json({ success: true });
});

// 登录页
app.get('/admin', (req, res) => {
  if (checkAuth(req)) {
    const articles = readArticles();
    res.send(buildAdminPage(articles));
  } else {
    res.send(buildLoginPage());
  }
});

// 登出
app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/admin');
});

function buildLoginPage() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文章管理 - 观测站</title>
<style>
  :root {
    --bg: #0A0F16;
    --surface: #111922;
    --border: #1E2A36;
    --green: #00E5A0;
    --text: #E0E8F0;
    --text-dim: #6B7F8F;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .login-box {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 2.5rem;
    width: 360px;
    max-width: 90vw;
  }
  .login-box h1 {
    color: var(--green);
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .login-box p {
    color: var(--text-dim);
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }
  .form-group { margin-bottom: 1rem; }
  .form-group label {
    display: block;
    font-size: 0.8rem;
    color: var(--text-dim);
    margin-bottom: 0.4rem;
  }
  .form-group input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.7rem 1rem;
    color: var(--text);
    font-family: inherit;
    font-size: 1rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .form-group input:focus {
    border-color: var(--green);
  }
  .submit-btn {
    width: 100%;
    background: var(--green);
    color: #000;
    border: none;
    border-radius: 6px;
    padding: 0.8rem;
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .submit-btn:hover { opacity: 0.85; }
  .error-msg {
    color: #ff4757;
    font-size: 0.85rem;
    margin-top: 0.8rem;
    display: none;
  }
  .back-link {
    display: block;
    text-align: center;
    margin-top: 1.2rem;
    color: var(--text-dim);
    text-decoration: none;
    font-size: 0.85rem;
  }
  .back-link:hover { color: var(--green); }
</style>
</head>
<body>
<div class="login-box">
  <h1>📡 文章管理</h1>
  <p>输入密码访问管理后台</p>
  <form id="loginForm">
    <div class="form-group">
      <label>密码</label>
      <input type="password" id="password" placeholder="请输入密码" autofocus>
    </div>
    <button type="submit" class="submit-btn">进入管理后台</button>
    <p class="error-msg" id="errorMsg"></p>
  </form>
  <a href="/" class="back-link">← 返回观测站</a>
</div>
<script>
const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });
  if (res.ok) {
    window.location.href = '/admin';
  } else {
    const data = await res.json();
    errorMsg.textContent = data.error;
    errorMsg.style.display = 'block';
  }
});
</script>
</body>
</html>`;
}

function buildAdminPage(articles) {
  const categoryLabels = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
  const categoryOptions = Object.entries(categoryLabels).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文章管理 - 观测站</title>
<style>
  :root {
    --bg: #0A0F16;
    --surface: #111922;
    --surface-hover: #1a2535;
    --border: #1E2A36;
    --green: #00E5A0;
    --amber: #FFB300;
    --magenta: #FF6B9D;
    --blue: #4DB8FF;
    --text: #E0E8F0;
    --text-dim: #6B7F8F;
    --red: #ff4757;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'JetBrains Mono', 'Fira Code', monospace;
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  /* 顶部栏 */
  .topbar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0.8rem 1.2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .topbar-left { display: flex; align-items: center; gap: 1rem; }
  .topbar h1 { color: var(--green); font-size: 1.1rem; }
  .topbar-stats { color: var(--text-dim); font-size: 0.85rem; }
  .topbar-right { display: flex; align-items: center; gap: 0.8rem; }
  .topbar a {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 0.85rem;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    transition: all 0.2s;
  }
  .topbar a:hover { color: var(--green); background: var(--surface-hover); }
  /* 主布局 */
  .admin-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: calc(100vh - 52px);
  }
  /* 左侧边栏：文章列表 */
  .sidebar {
    width: 280px;
    min-width: 280px;
    background: var(--surface);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sidebar-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .sidebar-header h2 { font-size: 0.9rem; color: var(--text-dim); }
  .new-btn {
    background: var(--green);
    color: #000;
    border: none;
    border-radius: 4px;
    padding: 0.4rem 0.8rem;
    font-family: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .new-btn:hover { opacity: 0.85; }
  .article-list { flex: 1; overflow-y: auto; }
  .article-item {
    padding: 0.8rem 1rem;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    transition: background 0.15s;
  }
  .article-item:hover { background: var(--surface-hover); }
  .article-item.active { background: var(--surface-hover); border-left: 3px solid var(--green); }
  .article-item-title {
    color: var(--text);
    font-size: 0.9rem;
    margin-bottom: 0.3rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .article-item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  .cat-tag {
    padding: 0.1rem 0.4rem;
    border-radius: 3px;
    font-size: 0.7rem;
  }
  .cat-tutorials { background: rgba(77,184,255,0.15); color: var(--blue); }
  .cat-blog { background: rgba(0,229,160,0.15); color: var(--green); }
  .cat-essays { background: rgba(255,179,0,0.15); color: var(--amber); }
  .cat-projects { background: rgba(255,107,157,0.15); color: var(--magenta); }
  /* 中间：编辑器 */
  .editor-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    padding: 1.5rem;
  }
  .editor-panel.hidden { display: none; }
  .editor-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.2rem;
  }
  .editor-header h2 { font-size: 1.1rem; color: var(--green); }
  .editor-actions { display: flex; gap: 0.5rem; }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-family: inherit;
    font-size: 0.85rem;
    cursor: pointer;
    border: none;
    transition: all 0.2s;
  }
  .btn-primary { background: var(--green); color: #000; font-weight: 600; }
  .btn-primary:hover { opacity: 0.85; }
  .btn-danger { background: var(--red); color: #fff; }
  .btn-danger:hover { opacity: 0.85; }
  .btn-ghost {
    background: transparent;
    color: var(--text-dim);
    border: 1px solid var(--border);
  }
  .btn-ghost:hover { border-color: var(--text-dim); color: var(--text); }
  .editor-form { flex: 1; display: flex; flex-direction: column; gap: 1rem; overflow: hidden; }
  .form-row { display: flex; gap: 1rem; }
  .form-row .form-group { flex: 1; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; }
  .form-group label { font-size: 0.8rem; color: var(--text-dim); }
  .form-group input,
  .form-group select,
  .form-group textarea {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.7rem 1rem;
    color: var(--text);
    font-family: inherit;
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.2s;
  }
  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus { border-color: var(--green); }
  .form-group select { cursor: pointer; }
  .form-group textarea { flex: 1; resize: none; min-height: 300px; font-size: 0.85rem; line-height: 1.6; }
  /* 标签输入 */
  .tag-input-wrapper {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.5rem;
    min-height: 42px;
    cursor: text;
    transition: border-color 0.2s;
  }
  .tag-input-wrapper:focus-within { border-color: var(--green); }
  .tag-chip {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: rgba(0,229,160,0.15);
    color: var(--green);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }
  .tag-chip .remove-tag {
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.15s;
  }
  .tag-chip .remove-tag:hover { opacity: 1; }
  .tag-input-wrapper input {
    flex: 1;
    min-width: 80px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-family: inherit;
    font-size: 0.85rem;
    padding: 0.2rem;
  }
  /* 预览区 */
  .preview-panel {
    width: 400px;
    min-width: 400px;
    border-left: 1px solid var(--border);
    background: var(--surface);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .preview-header {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.85rem;
    color: var(--text-dim);
  }
  .preview-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    font-size: 0.85rem;
    line-height: 1.7;
  }
  .preview-content h1, .preview-content h2, .preview-content h3 { color: var(--text); margin: 1rem 0 0.5rem; }
  .preview-content p { margin-bottom: 0.8rem; }
  .preview-content code { background: var(--bg); padding: 0.1rem 0.3rem; border-radius: 3px; }
  .preview-content pre { background: var(--bg); padding: 1rem; border-radius: 6px; overflow-x: auto; margin-bottom: 1rem; }
  .preview-content ul, .preview-content ol { margin-left: 1.5rem; margin-bottom: 1rem; }
  .preview-placeholder {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
    font-size: 0.85rem;
  }
  /* 空状态 */
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--text-dim);
    gap: 1rem;
  }
  .empty-state .icon { font-size: 3rem; opacity: 0.3; }
  .empty-state p { font-size: 0.9rem; }
  /* Toast */
  .toast {
    position: fixed;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--surface);
    border: 1px solid var(--green);
    color: var(--text);
    padding: 0.8rem 1.5rem;
    border-radius: 8px;
    font-size: 0.9rem;
    z-index: 1000;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }
  .toast.show { transform: translateX(-50%) translateY(0); }
  .toast.error { border-color: var(--red); }
  @media (max-width: 900px) {
    .preview-panel { display: none; }
    .sidebar { width: 220px; min-width: 220px; }
  }
  @media (max-width: 600px) {
    .admin-layout { flex-direction: column; }
    .sidebar { width: 100%; height: 200px; }
  }
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-left">
    <h1>📡 文章管理</h1>
    <span class="topbar-stats">共 <span id="articleCount">${articles.length}</span> 篇</span>
  </div>
  <div class="topbar-right">
    <a href="/">← 返回观测站</a>
    <a href="/logout">退出</a>
  </div>
</div>

<div class="admin-layout">
  <!-- 左侧：文章列表 -->
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>文章列表</h2>
      <button class="new-btn" onclick="newArticle()">+ 新建</button>
    </div>
    <div class="article-list" id="articleList">
      ${articles.map(a => `
        <div class="article-item" data-slug="${a.slug}" onclick="loadArticle('${a.slug}')">
          <div class="article-item-title">${a.title}</div>
          <div class="article-item-meta">
            <span class="cat-tag cat-${a.category}">${categoryLabels[a.category] || a.category}</span>
            <span>${a.tags.slice(0,2).join(', ')}${a.tags.length > 2 ? '...' : ''}</span>
          </div>
        </div>
      `).join('')}
      ${articles.length === 0 ? '<div class="empty-state"><p>暂无文章</p></div>' : ''}
    </div>
  </div>

  <!-- 中间：编辑器 -->
  <div class="editor-panel" id="editorPanel">
    <div class="editor-form" id="editorForm">
      <div class="editor-header">
        <h2 id="editorTitle">新建文章</h2>
        <div class="editor-actions">
          <button class="btn btn-ghost" onclick="togglePreview()">预览</button>
          <button class="btn btn-primary" onclick="saveArticle()">保存</button>
          <button class="btn btn-danger" onclick="deleteCurrentArticle()" id="deleteBtn" style="display:none;">删除</button>
          <button class="btn btn-ghost" onclick="newArticle()" id="newArticleBtn">新建</button>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label>标题</label>
          <input type="text" id="articleTitle" placeholder="文章标题">
        </div>
        <div class="form-group">
          <label>分类</label>
          <select id="articleCategory">${categoryOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label>标签</label>
        <div class="tag-input-wrapper" id="tagWrapper" onclick="document.getElementById('tagInput').focus()">
          <div id="tagChips"></div>
          <input type="text" id="tagInput" placeholder="输入标签后按 Enter 添加">
        </div>
      </div>
      <div class="form-group" style="flex:1; display:flex; flex-direction:column;">
        <label>内容 (Markdown)</label>
        <textarea id="articleContent" placeholder="文章内容，支持 Markdown 格式" style="flex:1"></textarea>
      </div>
    </div>
  </div>

  <!-- 右侧：预览 -->
  <div class="preview-panel" id="previewPanel" style="display:none;">
    <div class="preview-header">预览</div>
    <div class="preview-content" id="previewContent">
      <div class="preview-placeholder">输入内容后点击预览</div>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const API = '/api/articles';
let currentSlug = null;
let currentTags = [];
let showPreview = false;

function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' error' : '');
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function loadArticle(slug) {
  document.querySelectorAll('.article-item').forEach(el => el.classList.remove('active'));
  var el = document.querySelector('[data-slug="' + slug + '"]');
  if (el) el.classList.add('active');

  fetch(API + '/' + slug)
    .then(r => r.json())
    .then(article => {
      currentSlug = article.slug;
      document.getElementById('editorTitle').textContent = '编辑文章';
      document.getElementById('articleTitle').value = article.title;
      document.getElementById('articleCategory').value = article.category;
      document.getElementById('articleContent').value = article.content;
      currentTags = article.tags || [];
      renderTagChips();
      document.getElementById('deleteBtn').style.display = '';
      document.getElementById('newArticleBtn').style.display = 'none';
    })
    .catch(err => showToast('加载失败: ' + err, true));
}

function newArticle() {
  document.querySelectorAll('.article-item').forEach(el => el.classList.remove('active'));
  currentSlug = null;
  currentTags = [];
  document.getElementById('editorTitle').textContent = '新建文章';
  document.getElementById('articleTitle').value = '';
  document.getElementById('articleCategory').value = 'blog';
  document.getElementById('articleContent').value = '';
  renderTagChips();
  document.getElementById('deleteBtn').style.display = 'none';
  document.getElementById('newArticleBtn').style.display = '';
}

function renderTagChips() {
  const container = document.getElementById('tagChips');
  container.innerHTML = currentTags.map(t =>
    \`<span class="tag-chip">\${t}<span class="remove-tag" onclick="removeTag('\${t}')">×</span></span>\`
  ).join('');
  document.getElementById('tagInput').value = '';
}

function addTag(tag) {
  tag = tag.trim();
  if (tag && !currentTags.includes(tag)) {
    currentTags.push(tag);
    renderTagChips();
  }
}

function removeTag(tag) {
  currentTags = currentTags.filter(t => t !== tag);
  renderTagChips();
}

document.getElementById('tagInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addTag(e.target.value);
  }
});

async function saveArticle() {
  const title = document.getElementById('articleTitle').value.trim();
  const category = document.getElementById('articleCategory').value;
  const content = document.getElementById('articleContent').value;
  const tags = currentTags;

  if (!title) { showToast('请输入标题', true); return; }
  if (!content) { showToast('请输入内容', true); return; }

  const body = { title, category, content, tags };

  let res;
  if (currentSlug) {
    res = await fetch(API + '/' + currentSlug, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } else {
    res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  const data = await res.json();
  if (res.ok) {
    showToast(currentSlug ? '保存成功' : '创建成功');
    setTimeout(() => window.location.reload(), 1000);
  } else {
    showToast(data.error || '操作失败', true);
  }
}

async function deleteCurrentArticle() {
  if (!currentSlug) return;
  if (!confirm('确定删除这篇文章？')) return;

  const res = await fetch(API + '/' + currentSlug, { method: 'DELETE' });
  if (res.ok) {
    showToast('已删除');
    setTimeout(() => window.location.reload(), 1000);
  } else {
    const data = await res.json();
    showToast(data.error || '删除失败', true);
  }
}

function togglePreview() {
  showPreview = !showPreview;
  const panel = document.getElementById('previewPanel');
  panel.style.display = showPreview ? 'flex' : 'none';
  if (showPreview) {
    const content = document.getElementById('articleContent').value;
    document.getElementById('previewContent').innerHTML = simpleMarkdown(content) || '<div class="preview-placeholder">无内容</div>';
  }
}

// 极简 Markdown 渲染
function simpleMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
    .replace(/\`(.+?)\`/g, '<code>$1</code>')
    .replace(/\\n/g, '<br>');
}
</script>
</body>
</html>`;
}

// 静态文件托管 + SPA fallback
if (fs.existsSync(SITE_DIR)) {
  app.use(express.static(SITE_DIR, { index: ['index.html', 'index.htm'] }));
  app.use((req, res, next) => {
    if (res.headersSent) return next();
    res.sendFile(path.join(SITE_DIR, 'index.html'));
  });
} else {
  console.warn('[观测站] _site 目录不存在，请先运行 npm run build');
}

if (DEV) {
  startDevServer();
}

app.listen(PORT, () => {
  console.log(`[观测站] 网站已托管在 http://localhost:${PORT}`);
  console.log(`[观测站] 管理界面 http://localhost:${PORT}/admin`);
  console.log(`[观测站] 用户名: admin, 密码: 5jiaobaba`);
});