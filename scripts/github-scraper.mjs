import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { SITE_DATA_PATH, GITHUB_DATA_PATH } from './utils/paths.mjs';

const siteData = JSON.parse(readFileSync(SITE_DATA_PATH, 'utf-8'));
const username = siteData.githubUsername;

if (!username) {
    console.error('[github-scraper] 未配置 githubUsername，请检查 site.json');
    process.exit(1);
}

async function fetchWithRetry(url, retries = 3) {
    const token = process.env.GITHUB_TOKEN;
    for (let i = 0; i < retries; i++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        try {
            const headers = {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'terminal-observatory/1.0'
            };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            const res = await fetch(url, {
                headers,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (res.status === 403 && i < retries - 1) {
                const reset = res.headers.get('X-RateLimit-Reset');
                const baseDelay = Math.min(1000 * Math.pow(2, i), 30000);
                const wait = reset
                    ? Math.max(baseDelay, Math.ceil((parseInt(reset) * 1000 - Date.now()) / 1000) * 1000)
                    : baseDelay;
                console.log(`[github-scraper] API 限流，${Math.round(wait / 1000)}s 后重试 (${i + 1}/${retries})`);
                await new Promise(r => setTimeout(r, wait));
                continue;
            }
            return res;
        } catch (e) {
            clearTimeout(timeout);
            if (i === retries - 1) throw e;
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
}

async function main() {
    try {
        // 获取所有仓库（分页）
        const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100&type=all`;
        console.log(`[github-scraper] 正在获取 ${username} 的仓库...`);
        const reposRes = await fetchWithRetry(reposUrl);
        if (!reposRes.ok) {
            throw new Error(`仓库获取失败: ${reposRes.status}`);
        }
        let repos = await reposRes.json();

        // 过滤只保留公共仓库（type=all 可能包含 private）
        repos = repos.filter(r => !r.private);

        // 如果有更多页面，继续获取
        const linkHeader = reposRes.headers.get('Link');
        if (linkHeader && linkHeader.includes('rel="next"')) {
            console.log(`[github-scraper] 检测到更多仓库，继续获取...`);
            // GitHub API 分页获取所有仓库
            let page = 2;
            while (true) {
                const nextRes = await fetchWithRetry(`https://api.github.com/users/${username}/repos?per_page=100&type=all&page=${page}`);
                if (!nextRes.ok) break;
                const nextRepos = await nextRes.json();
                if (nextRepos.length === 0) break;
                repos = repos.concat(nextRepos.filter(r => !r.private));
                if (!nextRes.headers.get('Link')?.includes('rel="next"')) break;
                page++;
                await new Promise(r => setTimeout(r, 100)); // 避免限流
            }
        }

        const eventsUrl = `https://api.github.com/users/${username}/events?per_page=100`;
        console.log(`[github-scraper] 正在获取贡献热力图...`);
        const eventsRes = await fetchWithRetry(eventsUrl);
        const contributionData = {};
        if (eventsRes.ok) {
            const events = await eventsRes.json();
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

        writeFileSync(GITHUB_DATA_PATH, JSON.stringify(data, null, 2));
        console.log(`[github-scraper] 已获取 ${data.repos.length} 个仓库，${Object.keys(contributionData).length} 天有贡献记录`);
    } catch (err) {
        console.error(`[github-scraper] 失败，保留旧数据: ${err.message}`);
    }
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