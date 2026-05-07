import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const CATEGORIES = ['tech', 'reading', 'projects', 'essays'];
const ARTICLES_DIR = path.join(ROOT, 'src', 'articles');
const OUTPUT_FILE = path.join(ARTICLES_DIR, '_data', 'articles.json');

function extractTags(frontmatter, content, title) {
    if (frontmatter.tags && Array.isArray(frontmatter.tags) && frontmatter.tags.length > 0) {
        return frontmatter.tags.map(t => String(t));
    }

    const hashtagRegex = /#([^\s#]+)/gu;
    const hashtags = [...content.matchAll(hashtagRegex)].map(m => m[1]);
    if (hashtags.length > 0) {
        return [...new Set(hashtags)].slice(0, 10);
    }

    const stopWords = ['理解', '学习', '总结', '关于', '的', '和', '是', '分析', '笔记', '记录'];
    const words = title.split(/[^\w一-龥]+/)
        .filter(w => w.length > 1 && !stopWords.includes(w))
        .slice(0, 5);
    return words;
}

function calculateReadingTime(content) {
    const wordsPerMinute = 200;
    const chineseChars = (content.match(/[一-龥]/g) || []).length;
    const englishWords = (content.match(/[a-zA-Z]+/g) || []).length;
    const totalWords = chineseChars + englishWords;
    const minutes = Math.ceil(totalWords / wordsPerMinute);
    return minutes < 1 ? '1 min' : `${minutes} min`;
}

function generateExcerpt(content, maxLength = 150) {
    const cleaned = content.replace(/---[\s\S]*?---/, '').replace(/#+\s/g, '').trim();
    return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned;
}

function generateSlug(title, filename) {
    const base = filename.replace(/\.md$/, '');
    return base.toLowerCase().replace(/[^a-z0-9一-龥]+/g, '-').replace(/^-|-$/g, '');
}

function scanCategory(category) {
    const categoryDir = path.join(ARTICLES_DIR, category);
    const articles = [];

    if (!fs.existsSync(categoryDir)) {
        console.warn(`  [${category}] 目录不存在，跳过`);
        return articles;
    }

    let files;
    try {
        files = fs.readdirSync(categoryDir).filter(f => f.endsWith('.md'));
    } catch (err) {
        console.error(`  [${category}] 读取目录失败: ${err.message}`);
        return articles;
    }

    for (const file of files) {
        const filePath = path.join(categoryDir, file);
        let raw;
        try {
            raw = fs.readFileSync(filePath, 'utf-8');
        } catch (err) {
            console.error(`  [${category}] 读取文件失败 ${file}: ${err.message}`);
            continue;
        }

        let frontmatter, content;
        try {
            ({ data: frontmatter, content } = matter(raw));
        } catch (err) {
            console.error(`  [${category}] 解析失败 ${file}: ${err.message}`);
            continue;
        }

        const slug = frontmatter.slug || generateSlug(frontmatter.title || file, file);
        const title = frontmatter.title || file.replace(/\.md$/, '');
        const date = frontmatter.date
            ? (frontmatter.date instanceof Date
                ? frontmatter.date.toISOString().split('T')[0]
                : String(frontmatter.date))
            : new Date().toISOString().split('T')[0];

        const readingTime = frontmatter.readingTime || calculateReadingTime(content);
        const excerpt = frontmatter.excerpt || generateExcerpt(content);
        const tags = extractTags(frontmatter, content, title);

        articles.push({
            id: `article_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            slug,
            title,
            category,
            tags,
            excerpt,
            readingTime: typeof readingTime === 'number' ? `${readingTime} min` : readingTime,
            date,
            filename: file,
            source: frontmatter.source || 'manual',
            sourceLogId: frontmatter.sourceLogId || null,
            status: frontmatter.status || 'published'
        });
    }

    return articles;
}

function scanArticles() {
    console.log('📡 开始扫描文章...');

    let allArticles = [];
    for (const category of CATEGORIES) {
        const articles = scanCategory(category);
        console.log(`  [${category}] 发现 ${articles.length} 篇文章`);
        allArticles.push(...articles);
    }

    allArticles.sort((a, b) => new Date(b.date) - new Date(a.date));

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allArticles, null, 2));
    console.log(`✅ 共扫描 ${allArticles.length} 篇文章，已写入 ${OUTPUT_FILE}`);

    return allArticles;
}

scanArticles();