import markdownIt from 'markdown-it';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const md = markdownIt();

const CATEGORY_LABELS = {
    'tech': '技术',
    'reading': '读书',
    'projects': '项目',
    'essays': '随笔'
};

export default function(eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");

  eleventyConfig.addFilter("jsonify", (data) => JSON.stringify(data));


  eleventyConfig.addFilter("categoryLabel", (cat) => {
    return CATEGORY_LABELS[cat] || cat;
  });

  eleventyConfig.addFilter("renderMarkdown", (content) => {
    if (!content) return '';
    return md.render(content);
  });

  eleventyConfig.addCollection('articles', () => {
    const articlesFile = path.join(process.cwd(), 'src', 'articles', '_data', 'articles.json');
    if (fs.existsSync(articlesFile)) {
      const data = JSON.parse(fs.readFileSync(articlesFile, 'utf-8'));
      return data;
    }
    return [];
  });

  eleventyConfig.addShortcode('articleContent', function(filename, category) {
    const filePath = path.join(process.cwd(), 'src', 'articles', category, filename);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const { content } = matter(raw);
      return md.render(content);
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