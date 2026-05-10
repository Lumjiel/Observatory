// GitHub 仓库渲染器
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderErrors() {
    const container = state.dom.viewContainers.errors;
    if (!container) return;

    const githubData = window.GITHUB_DATA || {};
    const repos = githubData.repos || [];
    const username = githubData.username || 'Lumjiel';
    const lastFetched = githubData.lastFetched ? new Date(githubData.lastFetched).toLocaleDateString('zh-CN') : '未知';
    const mostRecent = repos.length > 0 && repos[0].updatedAt ? new Date(repos[0].updatedAt).toLocaleDateString('zh-CN') : '无数据';

    const langColors = {
        JavaScript: '#F7DF1E', TypeScript: '#3178C6', Python: '#3572A5',
        Java: '#B07219', Go: '#00ADD8', Vue: '#41B883', HTML: '#E34C26'
    };

    container.innerHTML = `
        <div class="report-container">
            <div class="report-header">
                <div class="report-title-wrap">
                    <div class="report-title">外部信号探测报告</div>
                    <div class="report-version">observatory v1.0</div>
                </div>
            </div>
            <div class="report-scan">
                <div class="scan-title">扫描结果</div>
                <div class="scan-stat"><span class="scan-icon">📡</span><span>探测到 <strong>${repos.length}</strong> 个活跃代码构造体</span></div>
                <div class="scan-stat"><span class="scan-dot" style="color:var(--green)">🟢</span><span>最近活跃: ${mostRecent}</span></div>
            </div>
            <div class="report-divider"></div>
            <div class="repo-list">
                ${repos.slice(0, 6).map(r => `
                    <a class="repo-card" href="${r.url}" target="_blank" rel="noopener">
                        <div class="repo-name">📦 ${r.name}</div>
                        <div class="repo-desc">${r.description || '暂无描述'}</div>
                        <div class="repo-meta">
                            ${r.language ? `<span class="repo-lang"><span class="lang-dot" style="background:${langColors[r.language] || '#888'}"></span>${r.language}</span>` : ''}
                            <span>⭐ ${r.stars}</span>
                            <span>🍴 ${r.forks}</span>
                            <span class="repo-updated">更新: ${r.updatedAgo || '未知'}</span>
                        </div>
                    </a>
                `).join('')}
            </div>
            <div class="report-divider"></div>
            <div class="report-log">
                <div class="log-title">探测日志</div>
                <div class="log-entries">
                    <div class="log-entry">[${repos[0] ? new Date(repos[0].updatedAt).toLocaleDateString('zh-CN').replace(/-/g, '') : '05-08'}] 探测到 ${repos[0]?.name || 'observer'} 有新的提交</div>
                    <div class="log-entry">[${repos[1] ? new Date(repos[1].updatedAt).toLocaleDateString('zh-CN').replace(/-/g, '') : '05-03'}] 探测到 ${repos[1]?.name || 'project'} 获得 ${repos[1]?.stars || 0} 个新星</div>
                </div>
            </div>
            <div class="report-divider"></div>
            <div class="report-footer">
                <span>> 数据来源: github.com/${username}</span>
                <span>> 更新频率: 每次构建时自动同步</span>
            </div>
            <p class="report-updated">数据更新于 ${lastFetched}</p>
        </div>`;

    showView('errors');
}