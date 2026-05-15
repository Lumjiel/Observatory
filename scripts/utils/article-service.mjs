import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { CATEGORIES } from './categories.mjs';
import { slugify } from './slug.mjs';
import { calculateReadingTime } from './reading-time.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
export const ARTICLES_DIR = path.join(ROOT, 'content', 'articles');
const ARTICLES_JSON = path.join(ROOT, 'src', 'articles', '_data', 'articles.json');

// ============================================================
// Utilities
// ============================================================

export function validateCategory(category) {
  return CATEGORIES.includes(category);
}

export function getArticlePath(category, filename) {
  const userPath = path.join(category, filename);
  const normalized = path.normalize(userPath);
  const resolved = path.resolve(ARTICLES_DIR, normalized);
  if (!resolved.startsWith(ARTICLES_DIR)) return null;
  return resolved;
}

function parseTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags.map(t => String(t));
  if (typeof tags === 'string') return tags.split(',').map(t => t.trim()).filter(Boolean);
  return [];
}

function extractHashtags(content) {
  const hashtagRegex = /#([a-zA-Z][a-zA-Z0-9]*[a-zA-Z0-9一-龥]?)/gu;
  return [...content.matchAll(hashtagRegex)].map(m => m[1]);
}

function generateExcerpt(content, maxLength = 150) {
  const cleaned = content.replace(/---[\s\S]*?---/, '').replace(/#+\s/g, '').trim();
  return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned;
}

function extractTagsFromTitle(title) {
  const stopWords = ['理解', '学习', '总结', '关于', '的', '和', '是', '分析', '笔记', '记录'];
  return title.split(/[^\w一-龥]+/)
    .filter(w => w.length > 1 && !stopWords.includes(w))
    .slice(0, 5);
}

function ensureDateStr(date) {
  if (!date) return new Date().toISOString().split('T')[0];
  if (date instanceof Date) return date.toISOString().split('T')[0];
  return String(date);
}

// ============================================================
// Index management (articles.json cache)
// ============================================================

let articlesCache = null;

export function readArticleIndex() {
  if (articlesCache) return articlesCache;
  try {
    articlesCache = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf8'));
    return articlesCache;
  } catch (err) {
    const backup = ARTICLES_JSON + '.bak';
    try { fs.copyFileSync(ARTICLES_JSON, backup); } catch {}
    throw new Error(`articles.json 读取失败: ${err.message}`);
  }
}

export function saveArticleIndex(articles) {
  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('拒绝写入空的 articles.json，索引可能已损坏');
  }
  fs.writeFileSync(ARTICLES_JSON, JSON.stringify(articles, null, 2));
  articlesCache = articles;
}

function loadExistingIndexMap() {
  try {
    if (fs.existsSync(ARTICLES_JSON)) {
      const data = JSON.parse(fs.readFileSync(ARTICLES_JSON, 'utf-8'));
      const map = new Map();
      data.forEach(a => map.set(`${a.slug}:${a.category}`, a));
      return map;
    }
  } catch { /* index corrupt or missing, start fresh */ }
  return new Map();
}

function updateArticleIndex(slug, updates) {
  const articles = readArticleIndex();
  const idx = articles.findIndex(a => a.slug === slug);
  if (idx !== -1) {
    articles[idx] = { ...articles[idx], ...updates };
  } else {
    articles.push({
      id: `article_${randomUUID()}`,
      slug,
      title: updates.title || slug,
      category: updates.category,
      tags: updates.tags || [],
      excerpt: updates.excerpt || '',
      readingTime: updates.readingTime || '1 min',
      date: updates.date || new Date().toISOString().split('T')[0],
      filename: updates.filename || `${slug}.md`,
      source: 'manual',
      sourceLogId: null,
      status: updates.draft ? 'draft' : 'published',
    });
  }
  saveArticleIndex(articles);
}

function removeArticleFromIndex(slug, category) {
  const articles = readArticleIndex();
  saveArticleIndex(articles.filter(a => !(a.slug === slug && a.category === category)));
}

// ============================================================
// Scan all articles from disk (canonical source of truth)
// ============================================================

export function scanAllArticles() {
  const existingMap = loadExistingIndexMap();
  const results = [];

  for (const category of CATEGORIES) {
    const catDir = path.join(ARTICLES_DIR, category);
    if (!fs.existsSync(catDir)) continue;

    let files;
    try { files = fs.readdirSync(catDir).filter(f => f.endsWith('.md')); }
    catch { continue; }

    for (const file of files) {
      const filePath = path.join(catDir, file);
      let raw;
      try { raw = fs.readFileSync(filePath, 'utf-8'); }
      catch { continue; }

      let data, content;
      try { ({ data, content } = matter(raw)); }
      catch { continue; }

      const slug = data.slug || file.replace(/\.md$/, '');
      const title = data.title || slug;
      const date = ensureDateStr(data.date);

      const tags = parseTags(data.tags);
      if (tags.length === 0) {
        const hashtags = extractHashtags(content);
        if (hashtags.length > 0) {
          tags.push(...[...new Set(hashtags)].slice(0, 10));
        } else {
          tags.push(...extractTagsFromTitle(title));
        }
      }

      const readingTime = data.readingTime || calculateReadingTime(content);
      const excerpt = data.excerpt || generateExcerpt(content);

      const key = `${slug}:${category}`;
      const existing = existingMap.get(key);
      const id = existing ? existing.id : `article_${randomUUID()}`;

      results.push({
        id,
        slug,
        title,
        category,
        tags,
        excerpt,
        readingTime: typeof readingTime === 'number' ? `${readingTime} min` : readingTime,
        date,
        filename: file,
        source: data.source || 'manual',
        sourceLogId: data.sourceLogId || null,
        status: data.status || 'published',
        draft: data.draft === true || data.status === 'draft',
        order: data.order || 0,
      });
    }
  }

  results.sort((a, b) => new Date(b.date) - new Date(a.date));
  return results;
}

// ============================================================
// Single article read (metadata + content)
// ============================================================

export function getArticle(slug) {
  for (const category of CATEGORIES) {
    const filePath = path.join(ARTICLES_DIR, category, `${slug}.md`);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    return {
      slug,
      category,
      filename: `${slug}.md`,
      title: data.title || slug,
      tags: parseTags(data.tags),
      excerpt: data.excerpt || generateExcerpt(content),
      readingTime: data.readingTime || calculateReadingTime(content),
      order: data.order || 0,
      draft: data.draft === true || data.status === 'draft',
      date: ensureDateStr(data.date),
      source: data.source || 'manual',
      sourceLogId: data.sourceLogId || null,
      status: data.status || 'published',
      content,
    };
  }
  return null;
}

// ============================================================
// CRUD
// ============================================================

export function createArticle({ title, category, content, tags, excerpt, readingTime, order }) {
  if (!title || !category || !content) {
    throw new Error('缺少必填字段');
  }
  if (!validateCategory(category)) {
    throw new Error('无效的分类');
  }

  const slug = slugify(title);
  const filename = `${slug}.md`;
  const filePath = getArticlePath(category, filename);
  if (!filePath) throw new Error('无效的路径');
  if (fs.existsSync(filePath)) throw new Error('文章已存在');

  const dateStr = new Date().toISOString().split('T')[0];
  const readingTimeStr = readingTime || calculateReadingTime(content);

  const frontmatter = matter.stringify(content, {
    title,
    date: dateStr,
    category,
    tags: tags || [],
    excerpt: excerpt || '',
    readingTime: readingTimeStr,
    order: order || 0,
  });

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, frontmatter);

  updateArticleIndex(slug, {
    title,
    category,
    tags: tags || [],
    excerpt: excerpt || '',
    readingTime: readingTimeStr,
    order: order || 0,
    date: dateStr,
  });

  return { slug, path: filePath };
}

export function updateArticle(slug, { title, content, category, tags, excerpt, readingTime, order }) {
  const article = getArticle(slug);
  if (!article) return null;

  const newCategory = category || article.category;
  const filename = `${slug}.md`;
  const newPath = getArticlePath(newCategory, filename);
  const oldPath = getArticlePath(article.category, article.filename);
  if (!newPath) throw new Error('无效的路径');

  if (category && category !== article.category) {
    fs.mkdirSync(path.join(ARTICLES_DIR, newCategory), { recursive: true });
  }

  const mergedContent = content !== undefined ? content : article.content;
  const dateStr = new Date().toISOString().split('T')[0];
  const readingTimeStr = readingTime || (content !== undefined ? calculateReadingTime(content) : article.readingTime);

  const frontmatter = matter.stringify(mergedContent, {
    title: title || article.title,
    date: dateStr,
    category: newCategory,
    tags: tags !== undefined ? tags : article.tags,
    excerpt: excerpt !== undefined ? excerpt : article.excerpt,
    readingTime: readingTimeStr,
    order: order !== undefined ? order : article.order,
  });

  fs.writeFileSync(newPath, frontmatter);

  if (oldPath && oldPath !== newPath && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }

  updateArticleIndex(slug, {
    title: title || article.title,
    category: newCategory,
    tags: tags !== undefined ? tags : article.tags,
    excerpt: excerpt !== undefined ? excerpt : article.excerpt,
    readingTime: readingTimeStr,
    order: order !== undefined ? order : article.order,
    date: dateStr,
  });

  return { slug };
}

export function deleteArticle(slug) {
  const article = getArticle(slug);
  if (!article) return null;

  const filePath = getArticlePath(article.category, article.filename);
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  removeArticleFromIndex(slug, article.category);
  return { slug, category: article.category };
}

export function duplicateArticle(slug) {
  const article = getArticle(slug);
  if (!article) return null;

  const newTitle = '副本-' + article.title;
  const newSlug = slugify(newTitle);
  const filename = `${newSlug}.md`;
  const filePath = getArticlePath(article.category, filename);
  if (!filePath) throw new Error('无效的路径');
  if (fs.existsSync(filePath)) throw new Error('文章已存在');

  const dateStr = new Date().toISOString().split('T')[0];

  const frontmatter = matter.stringify(article.content, {
    title: newTitle,
    date: dateStr,
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
    date: dateStr,
  });

  return { slug: newSlug };
}

// ============================================================
// Batch operations
// ============================================================

export function batchDelete(slugs) {
  if (!Array.isArray(slugs)) throw new Error('slugs 必须是数组');
  const results = [];
  for (const { slug, category } of slugs) {
    const filePath = getArticlePath(category, `${slug}.md`);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
    removeArticleFromIndex(slug, category);
    results.push({ slug, category });
  }
  return results;
}

export function batchMove(slugs, targetCategory) {
  if (!Array.isArray(slugs) || !targetCategory) {
    throw new Error('需要 slugs 数组和 targetCategory');
  }
  if (!validateCategory(targetCategory)) {
    throw new Error('无效的分类');
  }

  const results = [];
  for (const { slug } of slugs) {
    const article = getArticle(slug);
    if (!article) continue;
    if (article.category === targetCategory) {
      results.push({ slug, category: targetCategory });
      continue;
    }

    const newPath = getArticlePath(targetCategory, `${slug}.md`);
    if (!newPath) continue;
    const oldPath = getArticlePath(article.category, article.filename);
    if (!oldPath) continue;

    if (fs.existsSync(oldPath)) {
      const raw = fs.readFileSync(oldPath, 'utf-8');
      const { data, content } = matter(raw);
      const frontmatter = matter.stringify(content, { ...data, category: targetCategory });
      fs.mkdirSync(path.dirname(newPath), { recursive: true });
      fs.writeFileSync(newPath, frontmatter);
      fs.unlinkSync(oldPath);
    }

    updateArticleIndex(slug, { category: targetCategory });
    results.push({ slug, category: targetCategory });
  }

  return results;
}
