import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const LOGS_FILE = path.join(ROOT, 'src', '_data', 'logs.json');
const ARTICLES_DIR = path.join(ROOT, 'src', 'articles');
const CATEGORIES = ['tech', 'reading', 'projects', 'essays'];

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {};
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--log-id' && args[i + 1]) {
            options.logId = args[++i];
        } else if (args[i] === '--file' && args[i + 1]) {
            options.file = args[++i];
        } else if (args[i] === '--category' && args[i + 1]) {
            options.category = args[++i];
        } else if (args[i] === '--title' && args[i + 1]) {
            options.title = args[++i];
        }
    }
    return options;
}

function loadLogs() {
    if (!fs.existsSync(LOGS_FILE)) {
        console.error('❌ logs.json 不存在');
        return null;
    }
    try {
        return JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
    } catch (err) {
        console.error(`❌ logs.json 解析失败: ${err.message}`);
        return null;
    }
}

function generateSlug(title) {
    return title.toLowerCase()
        .replace(/[^a-z0-9一-龥]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 60);
}

function typeToCategory(type) {
    const map = {
        'INFO': 'tech',
        'ERROR': 'tech',
        'READ': 'reading',
        'BUILD': 'projects',
        'THINK': 'essays',
        'MILESTONE': 'essays',
        'SUMMARY': 'essays'
    };
    return map[type] || 'essays';
}

function importFromLog(logId) {
    const logs = loadLogs();
    if (!logs) return;

    const log = logs.find(l => l.id === logId);
    if (!log) {
        console.error(`❌ 未找到日志: ${logId}`);
        return;
    }

    const category = typeToCategory(log.type);
    const slug = generateSlug(log.description);
    const date = log.timestamp.split('T')[0];
    const filename = `${date}-${slug}.md`;

    const frontmatter = {
        title: log.description,
        date: date,
        category: category,
        tags: log.tags || [],
        excerpt: log.detail?.slice(0, 150) || log.description,
        readingTime: log.duration || '5 min',
        source: 'log',
        sourceLogId: log.id
    };

    let content = log.detail || '';
    content += '\n\n---\n\n';
    content += `*关联日志: [${log.id}] ${log.description}*\n`;
    if (log.related && log.related.length > 0) {
        content += `\n*关联日志: ${log.related.join(', ')}*`;
    }

    const categoryDir = path.join(ARTICLES_DIR, category);
    if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
    }

    const filePath = path.join(categoryDir, filename);
    const fileContent = matter.stringify(content, frontmatter);
    fs.writeFileSync(filePath, fileContent, 'utf-8');

    console.log(`✅ 已将日志 ${logId} 导入到:`);
    console.log(`   ${filePath}`);
    console.log(`   分类: ${category}`);
    console.log(`   标签: ${frontmatter.tags.join(', ')}`);
}

function importFile(filePath, category, title) {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ 文件不存在: ${filePath}`);
        return;
    }

    if (!CATEGORIES.includes(category)) {
        console.error(`❌ 无效的分类: ${category}`);
        console.log(`   可用分类: ${CATEGORIES.join(', ')}`);
        return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    const targetCategory = frontmatter.category || category;
    const slug = generateSlug(title || frontmatter.title || path.basename(filePath));
    const filename = `${slug}.md`;

    const categoryDir = path.join(ARTICLES_DIR, targetCategory);
    if (!fs.existsSync(categoryDir)) {
        fs.mkdirSync(categoryDir, { recursive: true });
    }

    const targetPath = path.join(categoryDir, filename);
    fs.copyFileSync(filePath, targetPath);

    console.log(`✅ 已导入文章:`);
    console.log(`   从: ${filePath}`);
    console.log(`   到: ${targetPath}`);
    console.log(`   分类: ${targetCategory}`);
}

function main() {
    const options = parseArgs();

    if (options.logId) {
        importFromLog(options.logId);
    } else if (options.file) {
        if (!options.category) {
            console.error('❌ 缺少 --category 参数');
            console.log('   用法: npm run import:article -- --file path/to/article.md --category tech');
            return;
        }
        importFile(options.file, options.category, options.title);
    } else {
        console.log(`
📖 文章导入工具

用法:
  # 从日志创建文章
  npm run import:article -- --log-id log_2026_03_03_001

  # 导入 Markdown 文件
  npm run import:article -- --file path/to/article.md --category tech --title "文章标题"

分类: tech | reading | projects | essays
        `);
    }
}

main();