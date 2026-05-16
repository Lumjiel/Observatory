import { scanAllArticles } from './utils/article-service.mjs';
import { saveArticleIndex } from './utils/article-service.mjs';

const articles = scanAllArticles();
saveArticleIndex(articles);
console.log(`[article-scanner] 扫描完成，共 ${articles.length} 篇文章`);