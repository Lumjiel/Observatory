#!/usr/bin/env node
/**
 * new-article.mjs - 交互式创建新文章
 *
 * 使用方式: node scripts/new-article.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const CATEGORIES = ['tech', 'reading', 'projects', 'essays'];
const CATEGORY_LABELS = {
  tech: '技术',
  reading: '读书',
  projects: '项目',
  essays: '随笔'
};

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9一-龥]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateFrontmatter({ title, category, tags, date }) {
  const slug = slugify(title);
  return `---
title: '${title}'
date: '${date}'
category: ${category}
tags:
${tags.map(t => `  - ${t}`).join('\n')}
excerpt: ''
---

`;
}

async function main() {
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
  if (catIndex < 0 || catIndex >= CATEGORIES.length) {
    console.log('❌ 无效的分类');
    process.exit(1);
  }
  const category = CATEGORIES[catIndex];

  // 输入标签
  const tagsAnswer = await ask('\n标签 (逗号分隔，回车跳过): ');
  const tags = tagsAnswer
    ? tagsAnswer.split(',').map(t => t.trim()).filter(Boolean)
    : [];

  // 是否包含图片
  const hasImage = await ask('\n是否包含图片? (y/n): ');
  const includeImages = hasImage.toLowerCase() === 'y';

  // 生成文件
  const date = new Date().toISOString().split('T')[0];
  const slug = slugify(title);
  const frontmatter = generateFrontmatter({ title, category, tags, date });

  let content = frontmatter;

  // 如果需要图片，生成图片引用示例
  if (includeImages) {
    content += `## 图片

![图片1](img/${category}/${slug}-01.png)

`;
  }

  // 写入文件
  const filePath = path.join(ROOT, 'src', 'articles', category, `${slug}.md`);

  // 检查是否已存在
  if (fs.existsSync(filePath)) {
    console.log(`\n❌ 文件已存在: ${filePath}`);
    process.exit(1);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`\n✅ 文章已创建: ${filePath}`);

  // 运行扫描
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

  console.log(`\n✨ 完成! 文章路径: /articles/${category}/${slug}/`);
}

main().catch(console.error);