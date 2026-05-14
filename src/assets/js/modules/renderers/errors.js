// GitHub 仓库渲染器
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderErrors() {
    const container = state.dom.viewContainers.errors;
    if (!container) return;

    const githubData = window.GITHUB_DATA || {};
    const siteData = window.SITE_DATA || {};
    const repos = githubData.repos || [];
    const username = githubData.username || siteData.githubUsername || 'Lumjiel';
    const shownRepos = siteData.shownRepos || [];
    const contributions = githubData.contributions || {};
    const lastFetched = githubData.lastFetched ? new Date(githubData.lastFetched).toLocaleDateString('zh-CN') : '未知';

    const langColors = {
        JavaScript: '#F7DF1E', TypeScript: '#3178C6', Python: '#3572A5',
        Java: '#B07219', Go: '#00ADD8', Vue: '#41B883', HTML: '#E34C26'
    };

    // 按 shownRepos 过滤并排序
    const filteredRepos = repos
        .filter(r => shownRepos.includes(r.name))
        .sort((a, b) => {
            const idxA = shownRepos.indexOf(a.name);
            const idxB = shownRepos.indexOf(b.name);
            return idxA - idxB;
        });

    // 热力图数据 - 最近12周
    const today = new Date();
    const weeks = [];
    for (let w = 11; w >= 0; w--) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            const date = new Date(today);
            date.setDate(date.getDate() - (w * 7 + d));
            const dateStr = date.toISOString().slice(0, 10);
            week.push({ date: dateStr, count: contributions[dateStr] || 0, day: d });
        }
        weeks.push(week);
    }
    const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

    // 截断描述
    const truncateDesc = (desc, max = 80) => {
        if (!desc) return '暂无描述';
        return desc.length > max ? desc.slice(0, max) + '...' : desc;
    };

    container.innerHTML = `
        <div class="report-container">
            <div class="report-header">
                <div class="report-user">
                    <div class="user-info">
                        <span class="user-name">${username}</span>
                        <span class="user-label">github</span>
                    </div>
                    <div class="user-stats">
                        <span>📡 ${filteredRepos.length} 仓库</span>
                        <span>🕐 ${lastFetched}</span>
                    </div>
                </div>
            </div>

            <div class="heatmap-section">
                <div class="heatmap-title">GitHub 贡献热力图</div>
                <div class="day-labels">
                    ${dayLabels.map(d => `<span class="day-label">${d}</span>`).join('')}
                </div>
                <div class="heatmap-weeks">
                    ${weeks.map(week => `
                        <div class="heatmap-week">
                            ${week.map(day => {
                                const level = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
                                return `<div class="heatmap-cell level${level}" data-date="${day.date}" data-count="${day.count}"></div>`;
                            }).join('')}
                        </div>
                    `).join('')}
                </div>
                <div class="heatmap-footer">
                    <span></span>
                    <div class="heatmap-legend">
                        <span>Less</span>
                        <div class="legend-cell level0"></div>
                        <div class="legend-cell level1"></div>
                        <div class="legend-cell level2"></div>
                        <div class="legend-cell level3"></div>
                        <span>More</span>
                    </div>
                </div>
            </div>

            <div class="report-divider"></div>

            <div class="repo-list">
                ${filteredRepos.map(r => `
                    <a class="repo-card" href="${r.url}" target="_blank" rel="noopener">
                        <div class="repo-name">📦 ${r.name}</div>
                        <div class="repo-desc">${truncateDesc(r.description)}</div>
                        <div class="repo-meta">
                            ${r.language ? `<span class="repo-lang"><span class="lang-dot" style="background:${langColors[r.language] || '#888'}"></span>${r.language}</span>` : ''}
                            <span>⭐ ${r.stars}</span>
                            <span>🍴 ${r.forks}</span>
                            <span class="repo-updated">${r.updatedAgo || '未知'}</span>
                        </div>
                    </a>
                `).join('')}
            </div>

            <div class="report-footer">
                <span>> 数据来源: github.com/${username}</span>
                <span>> 更新频率: 每次构建时自动同步</span>
            </div>
        </div>`;

    showView('errors');
}