import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const ARTICLES_DIR = path.join('src', 'articles');

const CATEGORY_MAP = {
    'tech': { category: 'tech', tags: ['技术'] },
    'reading': { category: 'reading', tags: ['阅读'] },
    'projects': { category: 'projects', tags: ['项目'] },
    'essays': { category: 'essays', tags: ['随笔'] },
};

function extractTitle(filename) {
    let name = path.basename(filename, '.md');
    // 去掉开头的编号如 "01  " "02  "
    name = name.replace(/^\d+\s+/, '');
    // 还原被转码的冒号
    name = name.replace(/：/g, ':');
    return name.trim();
}

function estimateReadingTime(content) {
    const words = content.replace(/[#*`\[\]]/g, '').length;
    const minutes = Math.max(1, Math.round(words / 500));
    return `${minutes} min`;
}

function extractExcerpt(content, maxLen = 100) {
    // 跳过标题行和空行，取第一段正文
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const firstPara = lines[0] || '';
    return firstPara.length > maxLen ? firstPara.slice(0, maxLen) + '...' : firstPara;
}

function getDate(filename) {
    try {
        const stats = fs.statSync(filename);
        // 使用文件修改时间，格式化为 YYYY-MM-DD
        return stats.mtime.toISOString().split('T')[0];
    } catch {
        return new Date().toISOString().split('T')[0];
    }
}

function processFile(filepath) {
    const content = fs.readFileSync(filepath, 'utf-8');
    const parsed = matter(content);

    // 已经有完整 frontmatter 的跳过（必须有 title 和 date）
    if (parsed.data.title && parsed.data.date) {
        console.log(`[跳过] ${filepath} - 已有完整 frontmatter`);
        return;
    }

    const dir = path.basename(path.dirname(filepath));
    const config = CATEGORY_MAP[dir] || { category: dir, tags: [] };
    const filename = path.basename(filepath);

    const frontmatter = {
        title: parsed.data.title || extractTitle(filename),
        date: parsed.data.date || getDate(filepath),
        category: parsed.data.category || config.category,
        tags: parsed.data.tags || config.tags,
        excerpt: parsed.data.excerpt || extractExcerpt(parsed.content),
        readingTime: parsed.data.readingTime || estimateReadingTime(parsed.content),
    };

    const newContent = matter.stringify(parsed.content, frontmatter);
    fs.writeFileSync(filepath, newContent, 'utf-8');
    console.log(`[更新] ${filepath}`);
    console.log(`  title: ${frontmatter.title}`);
    console.log(`  date: ${frontmatter.date}`);
    console.log(`  category: ${frontmatter.category}`);
}

function scanDirectory(dir) {
    if (!fs.existsSync(dir)) return;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            scanDirectory(fullPath);
        } else if (entry.name.endsWith('.md')) {
            try {
                processFile(fullPath);
            } catch (err) {
                console.error(`[错误] ${fullPath}: ${err.message}`);
            }
        }
    }
}

console.log('开始扫描文章目录...\n');
scanDirectory(ARTICLES_DIR);
console.log('\n完成！');
