#!/usr/bin/env node
/**
 * new-article.mjs - 交互式创建新文章
 *
 * 使用方式:
 *   node scripts/new-article.mjs              # 交互模式
 *   node scripts/new-article.mjs --title "标题" --category tech  # 非交互模式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const CATEGORIES = ['tutorials', 'blog', 'projects', 'essays'];
const CATEGORY_LABELS = {
  tutorials: '教程',
  blog: '博客',
  projects: '项目',
  essays: '随笔'
};

// 计算预估阅读时间
function estimateReadingTime(title) {
  const baseWords = 200; // 默认字数
  const titleWords = title.length;
  const totalWords = baseWords + titleWords;
  const minutes = Math.ceil(totalWords / 200);
  return `${minutes} min`;
}

// 生成 slug
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// 生成 frontmatter
function generateFrontmatter({ title, category, tags, date, readingTime }) {
  const slug = slugify(title);
  return `---
title: '${title}'
date: '${date}'
category: ${category}
tags:
${tags.length > 0 ? tags.map(t => `  - ${t}`).join('\n') : '  -'}
excerpt: ''
readingTime: '${readingTime}'
---

`;
}

// 询问问题
function ask(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// 解析命令行参数
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--title' || arg === '-t') {
      args.title = argv[++i];
    } else if (arg === '--category' || arg === '-c') {
      args.category = argv[++i];
    } else if (arg === '--tags') {
      args.tags = argv[++i].split(',').map(t => t.trim());
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    }
  }
  return args;
}

// 显示帮助
function showHelp() {
  console.log(`
📝 new-article - 创建新文章

用法:
  node scripts/new-article.mjs              # 交互模式
  node scripts/new-article.mjs [选项]        # 非交互模式

选项:
  -t, --title <标题>      文章标题 (必需)
  -c, --category <分类>    文章分类: tutorials/blog/projects/essays
  --tags <标签>           标签，逗号分隔
  -h, --help             显示帮助

示例:
  node scripts/new-article.mjs --title "MySQL配置" --category tech --tags "MySQL,数据库"
`);
}

// 交互模式
async function interactiveMode() {
  console.log('\n📝 创建新文章\n');

  // 输入标题
  const title = await ask('文章标题: ');
  if (!title.trim()) {
    console.log('❌ 标题不能为空');
    process.exit(1);
  }

  // 选择分类
  console.log('\n选择分类:');
  CATEGORIES.forEach((cat, i) => {
    console.log(`  ${i + 1}. ${CATEGORY_LABELS[cat]} (${cat})`);
  });
  const catAnswer = await ask('\n分类 (1-4): ');
  const catIndex = parseInt(catAnswer) - 1;
  if (catIndex < 0 || catIndex >= CATEGORIES.length || isNaN(catIndex)) {
    console.log('❌ 无效的分类');
    process.exit(1);
  }
  const category = CATEGORIES[catIndex];

  // 输入标签
  const tagsAnswer = await ask('\n标签 (逗号分隔，回车跳过): ');
  const tags = tagsAnswer
    ? tagsAnswer.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  return { title, category, tags };
}

// 非交互模式
function nonInteractiveMode(args) {
  if (!args.title) {
    console.log('❌ 缺少标题，请使用 --title 指定');
    console.log('   使用 --help 查看帮助');
    process.exit(1);
  }

  const category = args.category || 'tech';
  if (!CATEGORIES.includes(category)) {
    console.log(`❌ 无效的分类: ${category}`);
    console.log(`   可选值: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }

  return {
    title: args.title,
    category,
    tags: args.tags || []
  };
}

// 主函数
async function main(argv) {
  // 解析参数
  const args = parseArgs(argv);

  // 显示帮助
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // 获取文章信息
  const isInteractive = !args.title && !args.category;
  const { title, category, tags } = isInteractive
    ? await interactiveMode()
    : nonInteractiveMode(args);

  // 生成文件
  const date = new Date().toISOString().split('T')[0];
  const readingTime = estimateReadingTime(title);
  const frontmatter = generateFrontmatter({ title, category, tags, date, readingTime });

  const slug = slugify(title);
  const filePath = path.join(ROOT, 'content', 'articles', category, `${slug}.md`);

  // 检查是否已存在
  if (fs.existsSync(filePath)) {
    console.log(`\n❌ 文件已存在: ${filePath}`);
    process.exit(1);
  }

  // 写入文件
  fs.writeFileSync(filePath, frontmatter, 'utf-8');
  console.log(`\n✅ 文章已创建: ${filePath}`);
  console.log(`   路径: /articles/${category}/${slug}/`);
  console.log(`   预估阅读时间: ${readingTime}`);

  // 更新索引
  console.log('\n🔄 更新索引...');
  const { execSync } = await import('child_process');
  try {
    execSync('node scripts/article-scanner.mjs', {
      cwd: ROOT,
      stdio: 'inherit'
    });
    console.log('✅ 索引已更新');
  } catch (e) {
    console.log('⚠️ 索引更新失败，请手动运行 npm run scan:articles');
  }

  console.log('\n✨ 完成!');
}

main(process.argv).catch(console.error);