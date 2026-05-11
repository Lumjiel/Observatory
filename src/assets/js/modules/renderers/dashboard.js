// 仪表盘渲染器 - 列表布局
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderDashboard() {
    const container = state.dom.viewContainers.dashboard;
    if (!container) return;

    const { categoryStats, feed, topTags } = state;
    const githubData = window.GITHUB_DATA || {};
    const contributions = githubData.contributions || {};
    const total = categoryStats.total;

    // 热力图数据 - 全年
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31);
    const yearDays = [];
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().slice(0, 10);
        yearDays.push({ date: dateStr, count: contributions[dateStr] || 0, day: d.getDay() });
    }

    // 按月分组用于显示
    const months = [];
    let currentMonth = -1;
    yearDays.forEach(day => {
        const month = parseInt(day.date.slice(5, 7));
        if (month !== currentMonth) {
            months.push({ label: day.date.slice(0, 7), weeks: [] });
            currentMonth = month;
        }
        if (months.length > 0) {
            months[months.length - 1].weeks.push(day);
        }
    });

    // 计算活跃率
    const activeDays = yearDays.filter(d => d.count > 0).length;
    const activityRate = Math.round((activeDays / yearDays.length) * 100);

    const catConfig = [
        { key: 'tutorials', label: '教程', count: categoryStats.tutorials, color: 'var(--blue)' },
        { key: 'blog', label: '博客', count: categoryStats.blog, color: 'var(--green)' },
        { key: 'essays', label: '随笔', count: categoryStats.essays, color: 'var(--magenta)' },
        { key: 'projects', label: '项目', count: categoryStats.projects, color: 'var(--amber)' },
    ];
    const maxCount = Math.max(...Object.values(categoryStats), 1);

    // 列表布局
    container.innerHTML = `
        <div class="mobile-dashboard">
            <div class="mobile-header">
                <span class="mobile-title">📡 信号遥测</span>
                <span class="mobile-year">${today.getFullYear()}年</span>
            </div>

            <div class="mobile-heatmap-compact">
                <div class="heatmap-months">
                    ${months.map(m => `
                        <div class="heatmap-month">
                            <div class="month-label">${parseInt(m.label.slice(5))}月</div>
                            <div class="month-weeks">
                                ${Array.from({length: Math.ceil(m.weeks.length / 7)}, (_, wi) => {
                                    const weekDays = m.weeks.slice(wi * 7, wi * 7 + 7);
                                    return `<div class="week-col">${weekDays.map(d => {
                                        const level = d.count === 0 ? 0 : d.count <= 2 ? 1 : d.count <= 5 ? 2 : 3;
                                        return `<div class="strip-cell level${level}" title="${d.date}: ${d.count}次"></div>`;
                                    }).join('')}</div>`;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="mobile-table">
                <div class="table-header">
                    <span>分类</span>
                    <span>信号数</span>
                    <span>强度</span>
                </div>
                ${catConfig.map(c => {
                    const barLen = 10;
                    const filled = Math.round((c.count / maxCount) * barLen);
                    const bar = '█'.repeat(filled) + '░'.repeat(barLen - filled);
                    return `
                        <div class="table-row" data-category="${c.key}">
                            <span class="row-cat"><span class="cat-dot" style="background:${c.color}"></span>${c.label}</span>
                            <span class="row-count">${c.count}</span>
                            <span class="row-bar" style="color:${c.color}">${bar}</span>
                        </div>
                        <div class="table-detail" id="detail-${c.key}">
                            <div class="detail-content">
                                <div class="detail-item"><span>信号数：</span><em>${c.count}</em></div>
                                <div class="detail-item"><span>占比：</span><em>${Math.round(c.count / total * 100)}%</em></div>
                                <div class="detail-item"><span>热门标签：</span><em>${getTopTagsForCategory(c.key, topTags)}</em></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="mobile-total">
                <span class="total-dot"></span>
                <span>总信号：<em>${total}</em></span>
                <span class="total-rate">活跃${activityRate}%</span>
            </div>

            <div class="mobile-section">
                <div class="mobile-section-title">📡 最近活跃</div>
                <div class="recent-list">
                    ${feed.slice(0, 6).map(a => `
                        <a class="recent-item" href="${a.href}">
                            <span class="recent-cat" style="color:${catConfig.find(c => c.key === a.category)?.color || 'var(--gray)'}">${catConfig.find(c => c.key === a.category)?.label || a.category}</span>
                            <span class="recent-title">${a.description.length > 14 ? a.description.slice(0, 14) + '...' : a.description}</span>
                        </a>
                    `).join('')}
                </div>
            </div>

            <div class="mobile-section">
                <div class="mobile-section-title">🏷️ 热门标签</div>
                <div class="tag-cloud">
                    ${topTags.slice(0, 8).map(([tag, count]) => `
                        <span class="tag-item" data-tag="${tag}">#${tag}<span class="tag-count">${count}</span></span>
                    `).join('')}
                </div>
            </div>
        </div>`;

    // 绑定展开事件
    document.querySelectorAll('.table-row').forEach(row => {
        row.addEventListener('click', function() {
            const cat = this.dataset.category;
            const detail = document.getElementById('detail-' + cat);
            if (detail) {
                detail.classList.toggle('open');
            }
        });
    });

    // 绑定标签点击
    document.querySelectorAll('.tag-item').forEach(el => {
        el.addEventListener('click', function() {
            window.executeCommand('grep ' + this.dataset.tag);
        });
    });

    showView('dashboard');
}

function getTopTagsForCategory(category, topTags) {
    // 返回前3个热门标签
    return topTags.slice(0, 3).map(([t]) => '#' + t).join(' ') || '无';
}