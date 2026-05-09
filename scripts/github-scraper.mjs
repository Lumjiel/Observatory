import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const siteDataPath = join(__dirname, '../src/_data/site.json');
const outputPath = join(__dirname, '../src/_data/github.json');

const siteData = JSON.parse(readFileSync(siteDataPath, 'utf-8'));
const username = siteData.githubUsername;

if (!username) {
    console.error('[github-scraper] 未配置 githubUsername，请检查 site.json');
    process.exit(1);
}

const url = `https://api.github.com/users/${username}/repos?sort=updated&per_page=10&type=public`;
console.log(`[github-scraper] 正在获取 ${username} 的仓库...`);

try {
    const res = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'terminal-observatory/1.0'
        }
    });

    if (!res.ok) {
        if (res.status === 404) {
            console.error(`[github-scraper] 用户 ${username} 不存在`);
        } else {
            console.error(`[github-scraper] API 请求失败: ${res.status}`);
        }
        process.exit(1);
    }

    const repos = await res.json();

    const data = {
        username,
        repos: repos.map(r => ({
            name: r.name,
            fullName: r.full_name,
            description: r.description || '暂无描述',
            language: r.language,
            stars: r.stargazers_count,
            forks: r.forks_count,
            url: r.html_url,
            updatedAt: r.updated_at,
            updatedAgo: timeAgo(new Date(r.updated_at))
        })),
        lastFetched: new Date().toISOString()
    };

    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`[github-scraper] 已获取 ${data.repos.length} 个仓库，数据写入 ${outputPath}`);
} catch (err) {
    console.error('[github-scraper] 获取失败:', err.message);
    process.exit(1);
}

function timeAgo(date) {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return '刚刚';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}天前`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}个月前`;
    return `${Math.floor(months / 12)}年前`;
}