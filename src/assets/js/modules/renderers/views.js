// 里程碑/全部文章渲染器
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

export function renderHelp() {
    const container = state.dom.viewContainers.help;
    if (!container) return;

    container.innerHTML = `
        <h2 style="color:var(--green);">📖 可用命令</h2>
        <pre style="color:var(--text); line-height:1.6;">
filter [all|tutorials|blog|essays|projects]       按分类筛选
grep [关键词]                                    全文搜索
status / dashboard                               打开星系（仪表盘）
errors                                           外部信号（GitHub仓库）
milestones                                       全部文章
skills / neofetch                                技能树
about                                            系统（关于）
help                                             显示此帮助
clear                                            清除筛选/返回文章流
theme dark|light                                 切换主题
export txt|json                                  导出当前视图
        </pre>
        <p style="color:var(--text-dim);">快捷键: j/k 移动 | Esc 关闭 | / 聚焦搜索 | Tab 补全</p>`;

    showView('help');
}