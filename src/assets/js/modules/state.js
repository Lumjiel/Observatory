// 状态管理
const rawArticles = window.ARTICLES_DATA || [];
const CATEGORY_TYPE_MAP = { tutorials: 'INFO', blog: 'READ', essays: 'READ', projects: 'BUILD' };

export const state = {
    feed: rawArticles.map(a => ({
        id: a.id,
        slug: a.slug,
        type: CATEGORY_TYPE_MAP[a.category] || 'READ',
        typeLabel: a.category,
        description: a.title,
        timestamp: a.date,
        tags: a.tags || [],
        detail: a.excerpt || '',
        status: 'done',
        href: `/articles/${a.category}/${a.slug}/`,
        isArticle: true,
    })),

    categoryStats: {
        tutorials: 0,
        blog: 0,
        essays: 0,
        projects: 0,
        total: 0
    },

    tagCounts: {},

    // 仪表盘缓存
    topTags: [],
    recentLogs: [],
    heatmapWeeks: [],

    // 过滤缓存: key = "type:keyword", value = 过滤+排序后的数组
    filterCache: new Map(),

    // 视图状态
    currentView: 'log',
    openLogId: null,

    // 命令历史
    commandHistory: JSON.parse(localStorage.getItem('cmdHistory') || '[]'),
    historyIndex: 0,

    // 筛选状态
    activeFilter: null,
    activeKeyword: null,

    // 导航状态
    focusedEntryIndex: -1,
    currentPage: 1,
    filteredLogs: [],
    isLoadingMore: false,

    // 常量
    PAGE_SIZE: 8,

    // DOM 引用
    dom: {
        cmdInput: null,
        viewContainers: {},
        mobileNav: null,
        themeToggle: null,
    }
};

// 延迟初始化 DOM 引用
export function initDOM() {
    state.dom = {
        cmdInput: document.getElementById('cmdInput'),
        viewContainers: {
            log: document.getElementById('view-log'),
            dashboard: document.getElementById('view-dashboard'),
            errors: document.getElementById('view-errors'),
            milestones: document.getElementById('view-milestones'),
            projects: document.getElementById('view-projects'),
            skills: document.getElementById('view-skills'),
            about: document.getElementById('view-about'),
            help: document.getElementById('view-help'),
        },
        mobileNav: document.getElementById('mobileNav'),
        themeToggle: document.getElementById('themeToggle'),
    };
}

// 计算分类统计
function computeStats() {
    state.categoryStats = {
        tutorials: state.feed.filter(a => a.typeLabel === 'tutorials').length,
        blog: state.feed.filter(a => a.typeLabel === 'blog').length,
        essays: state.feed.filter(a => a.typeLabel === 'essays').length,
        projects: state.feed.filter(a => a.typeLabel === 'projects').length,
        total: state.feed.length
    };

    const counts = {};
    state.feed.forEach(l => l.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    state.tagCounts = counts;
    state.historyIndex = state.commandHistory.length;

    // 预计算仪表盘数据
    const sorted = [...state.feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    state.recentLogs = sorted.slice(0, 5);
    state.topTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 40);

    // 预计算 GitHub 热力图按周分组
    const githubData = window.GITHUB_DATA || {};
    const contributions = githubData.contributions || {};
    const today = new Date();
    const heatmapDays = [];
    for (let i = 89; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
        const dayName = dayNames[d.getDay()];
        heatmapDays.push({ date: dateStr, day: dayName, count: contributions[dateStr] || 0 });
    }
    const weeks = [];
    let currentWeek = [];
    heatmapDays.forEach((day, idx) => {
        if (idx > 0 && day.day === '一' && currentWeek.length > 0) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
        currentWeek.push(day);
    });
    if (currentWeek.length > 0) weeks.push(currentWeek);
    state.heatmapWeeks = weeks;
}

computeStats();

export function getFilterCacheKey(filterType, keyword) {
    return `${filterType || 'all'}:${keyword || ''}`;
}

export function clearFilterCache() {
    state.filterCache.clear();
}

export function saveCommandHistory() {
    localStorage.setItem('cmdHistory', JSON.stringify(state.commandHistory));
}

export function setCurrentView(view) {
    state.currentView = view;
}

export function setActiveFilter(filter) {
    state.activeFilter = filter;
}

export function setActiveKeyword(keyword) {
    state.activeKeyword = keyword;
}

export function setOpenLogId(id) {
    state.openLogId = id;
}

export function setFocusedEntryIndex(idx) {
    state.focusedEntryIndex = idx;
}

export function setCurrentPage(page) {
    state.currentPage = page;
}

export function setFilteredLogs(logs) {
    state.filteredLogs = logs;
}

export function getFilteredLogs() {
    return state.filteredLogs;
}