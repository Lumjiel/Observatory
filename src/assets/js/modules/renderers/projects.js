// 项目展板视图
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderProjects() {
    const container = state.dom.viewContainers.projects;
    if (!container) return;

    const projArticles = state.feed.filter(a => a.typeLabel === 'projects');

    container.innerHTML = projArticles.length ? `
        <h2 style="color:var(--amber);margin-bottom:1rem;">🛠️ 项目展板</h2>
        <ul style="list-style:none;padding:0;">${projArticles.map(a => `
            <li style="margin:0.5rem 0;padding:0.8rem;background:var(--surface);border:1px solid var(--border);border-radius:6px;">
                <a href="${a.href}" style="color:var(--text);font-weight:600;">${a.description}</a>
                <p style="color:var(--gray);font-size:0.8rem;margin:0.3rem 0 0 0;">${a.detail || ''}</p>
                <div style="margin-top:0.4rem;">${a.tags.map(t => `<span style="font-size:0.7rem;color:var(--text-dim);">#${t} </span>`).join('')}</div>
            </li>`).join('')}</ul>` : '<p style="color:var(--gray);">暂无项目文章。</p>';

    showView('projects');
}