// 里程碑/全部文章视图
import { state } from '../state.js';
import { getTypeClass, getCatLabel } from '../utils/text.js';
import { showView } from '../router.js';

export function renderMilestones() {
    const container = state.dom.viewContainers.milestones;
    if (!container) return;

    const { feed } = state;
    const catLabelMap = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };

    container.innerHTML = `
        <h2 style="color:var(--magenta);margin-bottom:1rem;">📚 全部文章</h2>
        <ul style="list-style:none;padding:0;">${feed.map(l => {
            const typeClass = getTypeClass(l.typeLabel);
            const catLabel = getCatLabel(l.typeLabel);
            return `<li style="margin:0.4rem 0;display:flex;gap:0.5rem;">
                <span style="color:var(--gray);font-size:0.75rem;min-width:80px;">${l.timestamp}</span>
                <span style="color:var(--${typeClass});font-size:0.7rem;">[${catLabel}]</span>
                <a href="${l.href}" style="color:var(--text);">${l.description}</a>
            </li>`;
        }).join('')}</ul>`;

    showView('milestones');
}