// 信号卡片组件
import { state } from '../state.js';
import { executeCommand } from '../commands.js';

export function renderSignalOverview() {
    const container = document.getElementById('signalOverview');
    if (!container) return;
    const { categoryStats, activeFilter } = state;
    const total = categoryStats.total;
    const techCount = categoryStats.tutorials;
    const readingCount = categoryStats.blog + categoryStats.essays;
    const projectsCount = categoryStats.projects;

    container.innerHTML = `
        <div class="signal-card green ${!activeFilter ? 'active' : ''}" onclick="executeCommand('filter all')">
            <span class="sig-value">${total}</span>
            <span class="sig-label">全部文章</span>
        </div>
        <div class="signal-card blue ${activeFilter === 'tutorials' ? 'active' : ''}" onclick="executeCommand('filter tutorials')">
            <span class="sig-value">${techCount}</span>
            <span class="sig-label">教程</span>
        </div>
        <div class="signal-card amber ${activeFilter === 'blog' ? 'active' : ''}" onclick="executeCommand('filter blog')">
            <span class="sig-value">${readingCount}</span>
            <span class="sig-label">博客</span>
        </div>
        <div class="signal-card magenta ${activeFilter === 'projects' ? 'active' : ''}" onclick="executeCommand('filter projects')">
            <span class="sig-value">${projectsCount}</span>
            <span class="sig-label">项目</span>
        </div>`;
}