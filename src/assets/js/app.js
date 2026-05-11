import { state, initDOM } from './modules/state.js';
import { showView, handleHashRoute } from './modules/router.js';
import { generateParticles } from './modules/utils/particles.js';
import { formatUptime } from './modules/utils/text.js';

import { renderLogStream } from './modules/renderers/logStream.js';
import { renderFilterChips } from './modules/components/filterChips.js';
import { renderSidebarSkills, renderRecentErrors, renderQuote } from './modules/components/sidebar.js';

import { initCommandInput } from './modules/events/input.js';
import { initKeyboard } from './modules/events/keyboard.js';

function initTheme() {
    const saved = localStorage.getItem('terminal-theme');
    const themeToggle = state.dom.themeToggle;
    if (saved === 'light') {
        document.body.classList.add('light');
        if (themeToggle) themeToggle.textContent = '☀️';
    } else if (saved === 'dark') {
        document.body.classList.remove('light');
        if (themeToggle) themeToggle.textContent = '🌙';
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.body.classList.add('light');
        if (themeToggle) themeToggle.textContent = '☀️';
    }
}

function updateStatusBar() {
    const uptime = document.getElementById('uptime');
    const activeCount = document.getElementById('activeCount');
    if (uptime) uptime.textContent = formatUptime();
    if (activeCount) activeCount.textContent = '📋 ' + state.feed.length + '篇文章';
}

document.querySelectorAll('.breadcrumb-category').forEach(function(link) {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        const cat = this.dataset.category;
        if (cat) {
            state.activeFilter = cat;
            state.activeKeyword = null;
            renderLogStream(cat);
            showView('log');
            window.scrollTo(0, 0);
        }
    });
});

const themeToggle = state.dom.themeToggle;
if (themeToggle) {
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        this.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('terminal-theme', isLight ? 'light' : 'dark');
    });
}

window.addEventListener('hashchange', handleHashRoute);

try {
    initDOM();
    initTheme();
    generateParticles();
        renderFilterChips();
    renderSidebarSkills();
    renderRecentErrors();
    renderQuote();
    updateStatusBar();
    setInterval(updateStatusBar, 60000);

    initCommandInput();
    initKeyboard();

    renderLogStream();
    showView('log');
    handleHashRoute();
} catch(e) {
    console.error(e);
} finally {
    const loading = document.getElementById('loadingOverlay');
    if (loading) { loading.style.display = 'none'; loading.remove(); }
}

console.log('🌌 观测站已启动。');
console.log('📡 正在监听学习宇宙的信号...');
console.log('💡 试试点击卡片、切换过滤器、或按 j/k 键浏览。');