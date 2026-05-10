// 仪表盘渲染器
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderDashboard() {
    const container = state.dom.viewContainers.dashboard;
    if (!container) return;

    const { categoryStats, feed } = state;
    const total = categoryStats.total;
    const blogCount = categoryStats.blog;
    const essaysCount = categoryStats.essays;
    const tutorialsCount = categoryStats.tutorials;
    const projectsCount = categoryStats.projects;
    const maxSourceCount = Math.max(blogCount, essaysCount, tutorialsCount, projectsCount, 1);

    // 标签统计
    const allTags = {};
    feed.forEach(l => l.tags.forEach(t => { allTags[t] = (allTags[t] || 0) + 1; }));
    const topTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 40);
    const maxTag = topTags.length > 0 ? topTags[0][1] : 1;

    // GitHub 热力图数据
    const githubData = window.GITHUB_DATA || {};
    const contributions = githubData.contributions || {};
    const today = new Date();
    const heatmapDays = [];
    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const dayName = dayNames[d.getDay()];
        const count = contributions[dateStr] || 0;
        heatmapDays.push({ date: dateStr, day: dayName, count });
    }

    // 按周分组
    const weeks = [];
    let currentWeek = [];
    heatmapDays.forEach((day, idx) => {
        if (idx > 0 && day.day === '一' && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // 最近信号
    const recentLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    const catLabelMap = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
    const catColorMap = { tutorials: 'var(--blue)', blog: 'var(--green)', essays: 'var(--magenta)', projects: 'var(--amber)' };

    // 信号源状态
    const signalSection = `
        <div class="dash-section">
            <div class="dash-section-title">📡 信号源状态</div>
            <div class="source-list">
                <div class="source-row">
                    <span class="source-dot" style="color:var(--green)">🟢</span>
                    <span class="source-label">博客信号</span>
                    <span class="source-count">${String(blogCount).padStart(2)}</span>
                    <span class="source-bar">${'█'.repeat(Math.round(blogCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(blogCount / maxSourceCount * 22))}</span>
                </div>
                <div class="source-row">
                    <span class="source-dot" style="color:var(--magenta)">🟣</span>
                    <span class="source-label">随笔信号</span>
                    <span class="source-count">${String(essaysCount).padStart(2)}</span>
                    <span class="source-bar">${'█'.repeat(Math.round(essaysCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(essaysCount / maxSourceCount * 22))}</span>
                </div>
                <div class="source-row">
                    <span class="source-dot" style="color:var(--blue)">🔵</span>
                    <span class="source-label">教程信号</span>
                    <span class="source-count">${String(tutorialsCount).padStart(2)}</span>
                    <span class="source-bar">${'█'.repeat(Math.round(tutorialsCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(tutorialsCount / maxSourceCount * 22))}</span>
                </div>
                <div class="source-row">
                    <span class="source-dot" style="color:var(--amber)">🟠</span>
                    <span class="source-label">项目信号</span>
                    <span class="source-count">${String(projectsCount).padStart(2)}</span>
                    <span class="source-bar">${'█'.repeat(Math.round(projectsCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(projectsCount / maxSourceCount * 22))}</span>
                </div>
            </div>
            <div class="source-summary">📋 总计 ${total} 条信号 | 信号强度: 稳定</div>
        </div>`;

    // 标签星系
    const tagGalaxySection = `
        <div class="dash-section">
            <div class="dash-section-title">🏷️ 标签星系</div>
            <div class="tag-galaxy" id="tagGalaxy">
                ${topTags.map(([tag, count], i) => {
                    const opacity = 0.45 + (count / maxTag) * 0.55;
                    const colors = ['var(--green)', 'var(--blue)', 'var(--amber)', 'var(--magenta)'];
                    const color = colors[i % colors.length];
                    const seed = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                    const x = 2 + (seed % 92);
                    const y = 5 + ((seed * 7) % 85);
                    const delay = (seed % 30) / 10;
                    const duration = 3 + (seed % 20) / 10;
                    const floatClass = count >= 2 ? 'float' : '';
                    return `<span class="galaxy-tag ${floatClass}" data-tag="${tag}" onclick="filterByTag('${tag}')" style="left:${x}%;top:${y}%;color:${color};opacity:${opacity};--float-delay:${delay}s;--float-dur:${duration}s;">#${tag}</span>`;
                }).join('')}
            </div>
        </div>`;

    // GitHub 热力图
    const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];
    const heatmapSection = `
        <div class="dash-section">
            <div class="dash-section-title">🔥 GitHub 贡献热力图 (近90天)</div>
            <div class="heatmap-wrap">
                <div class="heatmap-day-labels">
                    ${dayLabels.map(d => `<div class="day-label">${d}</div>`).join('')}
                </div>
                <div class="heatmap-container">
                    <div class="heatmap-grid">
                        ${weeks.map((week, wi) => `
                            <div class="heatmap-col" style="grid-column:${wi + 1}">
                                ${week.map(day => {
                                    const level = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
                                    return `<div class="heatmap-cell" data-level="${level}" data-date="${day.date}" data-count="${day.count}" title="${day.date}: ${day.count}次"></div>`;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="heatmap-legend">
                <span>少</span>
                <div class="heatmap-cell" data-level="0"></div>
                <div class="heatmap-cell" data-level="1"></div>
                <div class="heatmap-cell" data-level="2"></div>
                <div class="heatmap-cell" data-level="3"></div>
                <span>多</span>
            </div>
        </div>`;

    // 最近记录表
    const recentSection = `
        <div class="dash-section">
            <div class="dash-section-title">📡 最近信号接收记录</div>
            <div class="recent-table-wrap">
                <table class="recent-table">
                    <thead><tr><th>时间</th><th>类型</th><th>内容</th><th>标签</th></tr></thead>
                    <tbody>
                        ${recentLogs.map(log => `
                            <tr>
                                <td>${log.timestamp.slice(0, 10)}</td>
                                <td style="color:${catColorMap[log.typeLabel]}">${catLabelMap[log.typeLabel]}</td>
                                <td class="recent-desc"><a href="${log.href}">${log.description.slice(0, 20)}</a></td>
                                <td>${log.tags.slice(0, 1).map(t => '#' + t).join('')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;

    container.innerHTML = `
        <div class="dashboard-container">
            <div class="dash-header">📊 观测站仪表盘</div>
            ${signalSection}
            ${tagGalaxySection}
            ${recentSection}
            ${heatmapSection}
        </div>`;

    showView('dashboard');
}