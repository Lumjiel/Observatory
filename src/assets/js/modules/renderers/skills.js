// 技能树/统计视图
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderSkillsView() {
    const container = state.dom.viewContainers.skills;
    if (!container) return;

    const { categoryStats } = state;
    const techCount = categoryStats.tutorials;
    const readingCount = categoryStats.blog + categoryStats.essays;
    const projectsCount = categoryStats.projects;
    const total = categoryStats.total;

    container.innerHTML = `
        <h2 style="color:var(--green);">🌳 文章分类统计</h2>
        <pre style="color:var(--green); background:transparent; line-height:1.6; margin:1rem 0;">
        student@observatory
        ───────────────────
        Articles: ${total}
        ├── <span style="color:var(--green);">技术</span>: ${techCount} 篇
        ├── <span style="color:var(--blue);">读书</span>: ${readingCount} 篇
        └── <span style="color:var(--amber);">项目</span>: ${projectsCount} 篇
        </pre>
        <p style="color:var(--text-dim);">点击分类标签可筛选文章</p>`;

    showView('skills');
}