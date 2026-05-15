#!/usr/bin/env node
import { scanAllArticles, saveArticleIndex } from './utils/article-service.mjs';

console.log('📡 开始扫描文章...');
const articles = scanAllArticles();
saveArticleIndex(articles);
console.log(`✅ 共扫描 ${articles.length} 篇文章，已写入索引`);
