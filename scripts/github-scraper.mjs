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

async function fetchWithRetry(url, retries = 3) {
    for (let i = 0; i < retries; i++) {
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'terminal-observatory/1.0'
            }
        });
        if (res.status === 403 && i < retries - 1) {
            const reset = res.headers.get('X-RateLimit-Reset');
            const wait = reset ? Math.ceil((parseInt(reset) * 1000 - Date.now()) / 1000) : 60;
            console.log(`[github-scraper] API 限流，等待 ${wait}s...`);
            await new Promise(r => setTimeout(r, wait * 1000));
            continue;
        }
        return res;
    }
}

async function main() {
    // 获取仓库列表
    const reposUrl = `https://api.github.com/users/${username}/repos?sort=updated&per_page=10&type=public`;
    console.log(`[github-scraper] 正在获取 ${username} 的仓库...`);
    const reposRes = await fetchWithRetry(reposUrl);
    if (!reposRes.ok) {
        console.error(`[github-scraper] 仓库获取失败: ${reposRes.status}`);
        process.exit(1);
    }
    const repos = await reposRes.json();

    // 获取近90天贡献事件
    const eventsUrl = `https://api.github.com/users/${username}/events?per_page=100`;
    console.log(`[github-scraper] 正在获取贡献热力图...`);
    const eventsRes = await fetchWithRetry(eventsUrl);
    const contributionData = {};
    if (eventsRes.ok) {
        const events = await eventsRes.json();
        // 聚合90天内每天的贡献次数
        const now = Date.now();
        const ninetyDays = 90 * 24 * 60 * 60 * 1000;
        events.forEach(e => {
            const day = e.created_at.slice(0, 10);
            if (now - new Date(e.created_at).getTime() < ninetyDays) {
                contributionData[day] = (contributionData[day] || 0) + 1;
            }
        });
    }

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
        contributions: contributionData,
        lastFetched: new Date().toISOString()
    };

    writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`[github-scraper] 已获取 ${data.repos.length} 个仓库，${Object.keys(contributionData).length} 天有贡献记录`);
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

main().catch(err => { console.error('[github-scraper] 失败:', err.message); process.exit(1); });