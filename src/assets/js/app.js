// ============================================================
// 终端观测站 - 主入口
// ============================================================

import { state } from './modules/state.js';
import { showView, handleHashRoute } from './modules/router.js';
import { generateParticles } from './modules/utils/particles.js';
import { formatUptime } from './modules/utils/text.js';

// 渲染器
import { renderLogStream } from './modules/renderers/logStream.js';
import { renderDashboard } from './modules/renderers/dashboard.js';
import { renderErrors } from './modules/renderers/errors.js';
import { renderMilestones, renderProjects, renderSkillsView, renderHelp } from './modules/renderers/views.js';
import { renderAbout } from './modules/renderers/about.js';

// 组件
import { renderSignalOverview } from './modules/components/signalOverview.js';
import { renderFilterChips } from './modules/components/filterChips.js';
import { renderSidebarSkills, renderRecentErrors, renderQuote } from './modules/components/sidebar.js';

// 事件
import { initCommandInput } from './modules/events/input.js';
import { initKeyboard } from './modules/events/keyboard.js';
import { initMobileNav } from './modules/events/mobile.js';

// 命令（注入渲染器）
import { setRenderers } from './modules/commands.js';

// ============================================================
// 初始化
// ============================================================

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

// 面包屑导航
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

// 主题切换
const themeToggle = state.dom.themeToggle;
if (themeToggle) {
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('light');
        const isLight = document.body.classList.contains('light');
        this.textContent = isLight ? '☀️' : '🌙';
        localStorage.setItem('terminal-theme', isLight ? 'light' : 'dark');
    });
}

// hash 路由处理
window.addEventListener('hashchange', () => {
    handleHashRoute({
        renderLogStream,
        renderDashboard,
        renderErrors,
        renderMilestones,
        renderProjects,
        renderSkillsView,
        renderAbout,
        renderHelp
    });
});

// ============================================================
// 启动
// ============================================================

try {
    setRenderers({
        renderLogStream,
        renderFilterChips,
        renderSignalOverview,
        renderDashboard,
        renderErrors,
        renderMilestones,
        renderProjects,
        renderSkillsView,
        renderAbout,
        renderHelp,
        showView
    });

    initTheme();
    generateParticles();
    renderSignalOverview();
    renderFilterChips();
    renderSidebarSkills();
    renderRecentErrors();
    renderQuote();
    updateStatusBar();
    setInterval(updateStatusBar, 60000);

    initCommandInput();
    initKeyboard();
    initMobileNav();

    renderLogStream();
    showView('log');
    handleHashRoute({
        renderLogStream,
        renderDashboard,
        renderErrors,
        renderMilestones,
        renderProjects,
        renderSkillsView,
        renderAbout,
        renderHelp
    });
} catch(e) {
    console.error(e);
} finally {
    const loading = document.getElementById('loadingOverlay');
    if (loading) { loading.style.display = 'none'; loading.remove(); }
}

console.log('🌌 观测站已启动。');
console.log('📡 正在监听学习宇宙的信号...');
console.log('💡 试试点击卡片、切换过滤器、或按 j/k 键浏览。');