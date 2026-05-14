import markdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname);
const CONTENT_DIR = path.join(PROJECT_ROOT, 'content');
const IMAGES_DIR = path.join(CONTENT_DIR, 'images');

const md = markdownIt();

const CATEGORY_LABELS = {
    'tutorials': '教程',
    'blog': '博客',
    'projects': '项目',
    'essays': '随笔'
};

export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy({ "content/images": "img" });

  eleventyConfig.addFilter("jsonify", (data) => JSON.stringify(data));


  eleventyConfig.addFilter("categoryLabel", (cat) => {
    return CATEGORY_LABELS[cat] || cat;
  });

  eleventyConfig.addFilter("renderMarkdown", (content) => {
    if (!content) return '';
    return md.render(content);
  });

  // 文章列表（直接扫描 Markdown 文件，不依赖 articles.json）
  function parseTags(tags) {
    if (!tags) return [];
    if (Array.isArray(tags)) return tags;
    if (typeof tags === 'string') {
      return tags.split(',').map(t => t.trim()).filter(Boolean);
    }
    return [];
  }

  eleventyConfig.addCollection('articles', () => {
    const articlesDir = path.join(CONTENT_DIR, 'articles');
    const results = [];
    for (const cat of ['tutorials', 'blog', 'projects', 'essays']) {
      const catDir = path.join(articlesDir, cat);
      if (!fs.existsSync(catDir)) continue;
      for (const file of fs.readdirSync(catDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(catDir, file);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(raw);
        const slug = file.replace(/\.md$/, '');
        results.push({
          slug,
          filename: slug + '.md',
          category: cat,
          title: data.title || slug,
          tags: parseTags(data.tags),
          excerpt: data.excerpt || '',
          readingTime: data.readingTime || '1 min',
          order: data.order || 0,
          draft: data.draft || false,
          date: data.date || new Date().toISOString(),
        });
      }
    }
    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  // 已发布文章（排除草稿）
  eleventyConfig.addCollection('published', () => {
    const articlesDir = path.join(CONTENT_DIR, 'articles');
    const results = [];
    for (const cat of ['tutorials', 'blog', 'projects', 'essays']) {
      const catDir = path.join(articlesDir, cat);
      if (!fs.existsSync(catDir)) continue;
      for (const file of fs.readdirSync(catDir)) {
        if (!file.endsWith('.md')) continue;
        const filePath = path.join(catDir, file);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { data, content } = matter(raw);
        if (data.draft === true) continue;
        const slug = file.replace(/\.md$/, '');
        results.push({
          slug,
          filename: slug + '.md',
          category: cat,
          title: data.title || slug,
          tags: parseTags(data.tags),
          excerpt: data.excerpt || '',
          readingTime: data.readingTime || '1 min',
          order: data.order || 0,
          draft: data.draft || false,
          date: data.date || new Date().toISOString(),
        });
      }
    }
    return results.sort((a, b) => new Date(b.date) - new Date(a.date));
  });

  // 解析图片路径：搜索 content/images/{year}/{slug}/ 目录
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
    } catch (e) { /* 目录不存在，忽略 */ }
    const year = new Date().getFullYear().toString();
    return `/img/${year}/${slug}/${filename}`;
  }

  eleventyConfig.addShortcode('articleContent', function(filename, category) {
    const filePath = path.join(process.cwd(), 'content', 'articles', category, filename);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { data, content } = matter(raw);
      // 从文件名推断 slug（与 API 保持一致）
      const slug = (data.title || filename.replace(/\.md$/, ''))
        .toLowerCase()
        .replace(/[^a-z0-9一-龥]+/g, '-')
        .replace(/^-|-$/g, '');
      // 转换图片路径：Obsidian 语法 + 相对路径 → 绝对路径
      const processed = content.replace(
        /!\[\[(Pasted_image_.+?\.png)\]\]/g,
        (match, fn) => `![${fn}](${resolveImagePath(fn, slug)})`
      ).replace(/\]\(img\//g, '](/img/');
      const html = md.render(processed);
      return sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']),
        allowedAttributes: {
          ...sanitizeHtml.defaults.allowedAttributes,
          img: ['src', 'alt', 'title'],
          a: ['href', 'title', 'target', 'rel']
        },
        allowedSchemes: ['http', 'https', 'mailto']
      });
    }
    return '<p>文章内容加载失败</p>';
  });

  eleventyConfig.addFilter('getPrevArticle', (articles, current) => {
    const idx = articles.findIndex(a => a.slug === current.slug && a.category === current.category);
    return idx > 0 ? articles[idx - 1] : null;
  });

  eleventyConfig.addFilter('getNextArticle', (articles, current) => {
    const idx = articles.findIndex(a => a.slug === current.slug && a.category === current.category);
    return idx < articles.length - 1 ? articles[idx + 1] : null;
  });

  eleventyConfig.addFilter('truncate', (str, len) => {
    if (!str) return '';
    return str.slice(0, len);
  });

  eleventyConfig.addFilter('getQueryParam', (url, param) => {
    if (!url) return '';
    const match = url.match(/category=([^&]+)/);
    return match ? match[1] : '';
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "layouts",
      data: "_data"
    },
    templateFormats: ["njk", "html"],
    htmlTemplateEngine: "njk"
  };
};