// 侧边栏组件
import { state } from '../state.js';

export function renderSidebarSkills() {
    const container = document.getElementById('skillList');
    if (!container) return;
    const { categoryStats } = state;
    const cats = [
        { name: '教程', count: categoryStats.tutorials, color: 'green' },
        { name: '博客', count: categoryStats.blog, color: 'blue' },
        { name: '随笔', count: categoryStats.essays, color: 'magenta' },
        { name: '项目', count: categoryStats.projects, color: 'amber' },
    ];
    const total = categoryStats.total;
    container.innerHTML = cats.map(c => `
        <div class="skill-row"><span>${c.name}</span><span>${c.count}篇</span></div>
        <div class="skill-bar-wrap"><div class="skill-bar-fill ${c.color}" style="width:${total > 0 ? (c.count / total * 100) : 0}%"></div></div>
    `).join('');
}

export function renderRecentErrors() {
    const container = document.getElementById('recentErrors');
    if (!container) return;
    const recent = [...state.feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
    container.innerHTML = recent.map(a => `
        <li><span style="color:var(--blue);">📄</span> ${a.description.slice(0, 20)}${a.description.length > 20 ? '...' : ''}</li>
    `).join('');
}

export function renderQuote() {
    const container = document.getElementById('randomQuote');
    if (!container) return;
    const quotes = [
        '这段代码只有我和上帝知道什么意思，现在只剩下上帝了',
        '能跑就行，改什么改，万一出问题了你负责？',
        '这不是bug，是隐藏的feature，已经和产品确认过了',
        '我明天就改，我发誓，这次一定改，保证不拖延',
        'debug三件套：print、print、print，不行就再加一个',
        '这个需求很简单嘛，不就是加个功能嘛，估计一个小时就搞定了',
        '我已经在本地测试过了，绝对没问题，部署上去肯定也没问题',
    ];
    container.textContent = quotes[Math.floor(Math.random() * quotes.length)];
}