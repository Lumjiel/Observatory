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
        '"Stay hungry, stay foolish." — Steve Jobs',
        '"The best way to predict the future is to invent it." — Alan Kay',
        '"Talk is cheap. Show me the code." — Linus Torvalds',
        '"Premature optimization is the root of all evil." — Donald Knuth',
        '"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — Martin Fowler',
        '"First, solve the problem. Then, write the code." — John Johnson',
    ];
    container.textContent = quotes[Math.floor(Math.random() * quotes.length)];
}