(function() {
    const rawArticles = window.ARTICLES_DATA;

    if (!rawArticles || !Array.isArray(rawArticles)) {
        console.error('[Observatory] articles.json 数据为空，请运行 npm run scan:articles');
    }

    const articles = Array.isArray(rawArticles) ? rawArticles : [];

    // 将 articles 映射为统一 feed 条目
    const CATEGORY_TYPE_MAP = { tutorials: 'INFO', blog: 'READ', essays: 'READ', projects: 'BUILD' };
    const feed = articles.map(a => ({
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
    }));

    // logs 保留为空数组（兼容旧代码中的类型判断）
    const logs = [];
    const projects = [];
    const skills = { categories: [] };

    // 一次性计算分类统计，所有渲染函数复用
    const categoryStats = {
        tutorials: feed.filter(a => a.typeLabel === 'tutorials').length,
        blog: feed.filter(a => a.typeLabel === 'blog').length,
        essays: feed.filter(a => a.typeLabel === 'essays').length,
        projects: feed.filter(a => a.typeLabel === 'projects').length,
        total: feed.length
    };

    let currentView = 'log';
    let openLogId = null;
    let commandHistory = JSON.parse(localStorage.getItem('cmdHistory') || '[]');
    let historyIndex = commandHistory.length;
    let activeFilter = null;
    let activeKeyword = null;
    let focusedEntryIndex = -1;
    const PAGE_SIZE = 8;
    let currentPage = 1;
    let filteredLogs = [];
    let isLoadingMore = false;
    let audioCtx = null;

    const cmdInput = document.getElementById('cmdInput');
    const viewContainers = {
        log: document.getElementById('view-log'),
        dashboard: document.getElementById('view-dashboard'),
        errors: document.getElementById('view-errors'),
        milestones: document.getElementById('view-milestones'),
        projects: document.getElementById('view-projects'),
        skills: document.getElementById('view-skills'),
        about: document.getElementById('view-about'),
        help: document.getElementById('view-help'),
    };
    const mobileNav = document.getElementById('mobileNav');
    const themeToggle = document.getElementById('themeToggle');

    function initTheme() {
        const saved = localStorage.getItem('terminal-theme');
        if (saved === 'light') {
            document.body.classList.add('light');
            if (themeToggle) themeToggle.textContent = '☀️';
        }
        else if (saved === 'dark') {
            document.body.classList.remove('light');
            if (themeToggle) themeToggle.textContent = '🌙';
        }
        else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
            document.body.classList.add('light');
            if (themeToggle) themeToggle.textContent = '☀️';
        }
    }
    initTheme();

    function generateParticles() {
        const container = document.getElementById('particleLayer');
        if (!container) return;
        container.innerHTML = '';
        const count = window.innerWidth < 768 ? 20 : 40;
        for (let i = 0; i < count; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.left = Math.random() * 100 + '%';
            p.style.top = Math.random() * 100 + '%';
            p.style.animationDelay = Math.random() * 12 + 's';
            p.style.animationDuration = (12 + Math.random() * 8) + 's';
            container.appendChild(p);
        }
    }

    function renderSignalOverview() {
        const container = document.getElementById('signalOverview');
        if (!container) return;
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

    function renderFilterChips() {
        const container = document.getElementById('filterChips');
        if (!container) return;
        const categories = [
            { key: 'all', label: '全部' },
            { key: 'tutorials', label: '教程' },
            { key: 'blog', label: '博客' },
            { key: 'essays', label: '随笔' },
            { key: 'projects', label: '项目' },
        ];
        container.innerHTML = categories.map(c =>
            `<button class="filter-chip ${activeFilter === c.key || (!activeFilter && c.key === 'all') ? 'active' : ''}" data-filter="${c.key}">${c.label}</button>`
        ).join('');
        container.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', function() {
                const filter = this.dataset.filter;
                if (filter === 'all') {
                    activeFilter = null;
                    renderLogStream();
                } else {
                    activeFilter = filter;
                    renderLogStream(filter);
                }
                renderFilterChips();
                renderSignalOverview();
                showView('log');
            });
        });
    }

    function renderSidebarSkills() {
        const container = document.getElementById('skillList');
        if (!container) return;
        const cats = [
            { name: '教程', count: categoryStats.tutorials, color: 'green' },
            { name: '博客', count: categoryStats.blog, color: 'blue' },
            { name: '项目', count: categoryStats.projects, color: 'amber' },
        ];
        const total = categoryStats.total;
        container.innerHTML = cats.map(c => `
            <div class="skill-row"><span>${c.name}</span><span>${c.count}篇</span></div>
            <div class="skill-bar-wrap"><div class="skill-bar-fill ${c.color}" style="width:${total > 0 ? (c.count / total * 100) : 0}%"></div></div>
        `).join('');
    }

    function renderRecentErrors() {
        const container = document.getElementById('recentErrors');
        if (!container) return;
        const recent = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 4);
        container.innerHTML = recent.map(a => `
            <li><span style="color:var(--blue);">📄</span> ${a.description.slice(0, 20)}${a.description.length > 20 ? '...' : ''}</li>
        `).join('');
    }

    function renderQuote() {
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

    function playClickSound() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = 800;
            osc.type = 'square';
            gain.gain.value = 0.03;
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.08);
        } catch (e) {}
    }

    function getTagCounts() {
        const counts = {};
        feed.forEach(l => l.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
        return counts;
    }
    const tagCounts = getTagCounts();

    function formatUptime() {
        const startDate = (window.SITE_DATA && window.SITE_DATA.startDate) ? window.SITE_DATA.startDate : '2026-05-07';
        const start = new Date(startDate);
        const now = new Date();
        const diff = now - start;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days < 1) return '🚀 今天上线';
        return `📈 已运行 ${days} 天`;
    }

    function updateStatusBar() {
        const uptime = document.getElementById('uptime');
        const activeCount = document.getElementById('activeCount');
        if (uptime) uptime.textContent = formatUptime();
        if (activeCount) activeCount.textContent = '📋 ' + feed.length + '篇文章';
    }
    updateStatusBar();
    setInterval(updateStatusBar, 60000);

    function getStatusHint(status) {
        const hints = { done: '✓ 已完成', wip: '⚠ 进行中', error: '✗ 未解决', dropped: '✗ 已中断' };
        return hints[status] || status;
    }

    function showView(viewName) {
        Object.keys(viewContainers).forEach(v => viewContainers[v].classList.remove('active'));
        if (viewContainers[viewName]) viewContainers[viewName].classList.add('active');
        currentView = viewName;
        document.body.classList.toggle('view-log-active', viewName === 'log');
        document.querySelectorAll('#mobileNav button').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewName);
        });
        window.location.hash = viewName === 'log' ? '' : viewName;
    }

    function handleHashRoute() {
        const hash = window.location.hash.slice(1);
        if (!hash) { renderLogStream(); showView('log'); return; }
        if (hash === 'dashboard') renderDashboard();
        else if (hash === 'errors') renderErrors();
        else if (hash === 'milestones') renderMilestones();
        else if (hash === 'projects') renderProjects();
        else if (hash === 'skills') renderSkillsView();
        else if (hash === 'about') renderAbout();
        else if (hash === 'help') renderHelp();
        else { renderLogStream(); showView('log'); return; }
        showView(hash);
    }
    window.addEventListener('hashchange', handleHashRoute);

    function renderLogStream(filterType = null, keyword = null, page = 1) {
        filteredLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        // filterType 是 category: tech/reading/essays/projects
        if (filterType && filterType !== 'all') {
            filteredLogs = filteredLogs.filter(l => l.typeLabel === filterType);
        }
        if (keyword) {
            const kw = keyword.toLowerCase();
            filteredLogs = filteredLogs.filter(l =>
                l.description.toLowerCase().includes(kw) ||
                l.tags.some(t => t.toLowerCase().includes(kw)) ||
                l.typeLabel.toLowerCase().includes(kw)
            );
        }
        currentPage = page;
        const container = viewContainers['log'];
        if (!container) return;
        container.innerHTML = '';
        if (filteredLogs.length === 0) {
            container.innerHTML = '<p style="color:var(--gray)">没有匹配的文章。</p>';
            return;
        }
        const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, filteredLogs.length);
        const pageLogs = filteredLogs.slice(startIdx, endIdx);
        const stream = document.createElement('div');
        stream.className = 'log-stream';
        pageLogs.forEach((log, idx) => {
            const entry = document.createElement('div');
            entry.className = 'log-entry';
            entry.dataset.logId = log.id;
            entry.dataset.index = startIdx + idx;
            entry.dataset.href = log.href;
            const statusSymbol = log.status === 'done' ? '✓' : log.status === 'wip' ? '⚠' : log.stale ? '⏳' : '★';
            const descHtml = keyword ? highlightText(log.description, keyword) : log.description;
            const typeClass = log.typeLabel === 'tutorials' ? 'green' : log.typeLabel === 'blog' || log.typeLabel === 'essays' ? 'blue' : log.typeLabel === 'projects' ? 'amber' : 'gray';
            const catLabel = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' }[log.typeLabel] || log.typeLabel;
            entry.innerHTML = `
                <div class="log-line">
                  <span class="event-type-dot ${typeClass}"></span>
                  <span class="log-time" data-timestamp="${log.id}">[${formatTimestamp(log.timestamp)}]</span>
                  <span class="log-tag ${log.typeLabel}" data-tag="${log.typeLabel}">[${catLabel}]</span>
                  <span class="log-desc"><a href="${log.href}" class="log-link">${descHtml}</a></span>
                  <span class="log-meta">${log.tags.slice(0, 3).map(t => `<span class="tag-hover" data-tag="${t}">#${t}</span>`).join(' ')}</span>
                </div>`;
            stream.appendChild(entry);
        });
        container.appendChild(stream);
        if (totalPages > 1) {
            const pagination = document.createElement('div');
            pagination.className = 'pagination';
            pagination.innerHTML = renderPaginationButtons(totalPages, currentPage);
            container.appendChild(pagination);
            pagination.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', function() {
                    const page = parseInt(this.dataset.page);
                    if (page && page !== currentPage) {
                        renderLogStream(activeFilter, activeKeyword, page);
                        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                });
            });
        }
        attachLogEvents();
        attachTagHoverEvents();
    }

    function renderPaginationButtons(totalPages, current) {
        let html = '';
        html += `<button ${current === 1 ? 'disabled' : ''} data-page="${current - 1}">←</button>`;
        const maxVisible = 5;
        let startPage = Math.max(1, current - Math.floor(maxVisible / 2));
        let endPage = Math.min(totalPages, startPage + maxVisible - 1);
        if (endPage - startPage < maxVisible - 1) {
            startPage = Math.max(1, endPage - maxVisible + 1);
        }
        if (startPage > 1) {
            html += `<button data-page="1">1</button>`;
            if (startPage > 2) html += `<span class="page-info">...</span>`;
        }
        for (let i = startPage; i <= endPage; i++) {
            html += `<button class="${i === current ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) html += `<span class="page-info">...</span>`;
            html += `<button data-page="${totalPages}">${totalPages}</button>`;
        }
        html += `<button ${current === totalPages ? 'disabled' : ''} data-page="${current + 1}">→</button>`;
        html += `<span class="page-info">${current}/${totalPages}</span>`;
        return html;
    }

    window.loadMoreLogs = function() {
        if (isLoadingMore) return;
        isLoadingMore = true;
        currentPage++;
        renderLogStream(activeFilter, activeKeyword, currentPage);
        isLoadingMore = false;
    };

    function highlightText(text, keyword) {
        if (!keyword) return text;
        const regex = new RegExp('(' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
        return text.replace(regex, '<mark style="background:var(--amber);color:var(--bg);padding:0 2px;border-radius:2px;">$1</mark>');
    }

    function formatTimestamp(ts) {
        const d = new Date(ts);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0') + ':' +
            String(d.getSeconds()).padStart(2, '0');
    }

    function renderDetail(log) {
        let html = '<h2>' + log.description + '</h2>';
        html += '<div class="detail-body">' + parseMarkdown(log.detail) + '</div>';
        if (log.duration) html += '<p style="color:var(--gray)">⏱️ 耗时: ' + log.duration + '</p>';
        if (log.progress !== undefined && log.progress !== null) {
            const bar = '█'.repeat(Math.floor(log.progress / 10)) + '░'.repeat(10 - Math.floor(log.progress / 10));
            html += '<p>📊 进度: <span class="progress-bar-ascii">[' + bar + '] ' + log.progress + '%</span></p>';
        }
        if (log.related && log.related.length > 0) {
            html += '<p style="color:var(--gray)">🔗 关联: ' + log.related.join(', ') + '</p>';
        }
        if (log.commit) {
            html += '<p style="color:var(--gray)">📝 Git: <code>' + log.commit.slice(0, 8) + '</code></p>';
        }
        return html;
    }

    function parseMarkdown(text) {
        if (!text) return '';
        let html = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            .replace(/^### (.+)$/gm, '<h3>$1</h3>')
            .replace(/^## (.+)$/gm, '<h2>$1</h2>')
            .replace(/^# (.+)$/gm, '<h1>$1</h1>')
            .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        if (html.includes('<li>')) html = '<ul>' + html + '</ul>';
        return '<p>' + html + '</p>';
    }

    function attachLogEvents() {
        document.querySelectorAll('.log-entry').forEach(entry => {
            entry.addEventListener('click', function(e) {
                if (e.target.closest('.tag-hover') || e.target.closest('.log-time') || e.target.closest('.log-link')) return;
                // 文章条目直接跳转，不展开详情
                const href = this.dataset.href;
                if (href) {
                    window.location.href = href;
                    return;
                }
                const logId = this.dataset.logId;
                toggleDetail(logId, this);
            });
            let pressTimer;
            entry.addEventListener('touchstart', function(e) {
                if (e.target.closest('.tag-hover') || e.target.closest('.log-link')) return;
                const href = this.dataset.href;
                pressTimer = setTimeout(() => {
                    if (href) window.location.href = href;
                }, 500);
            }, { passive: true });
            entry.addEventListener('touchend', () => clearTimeout(pressTimer));
            entry.addEventListener('touchmove', () => clearTimeout(pressTimer));
        });
    }

    function showLongPressMenu(logId, x, y) {
        const existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:var(--surface);border:1px solid var(--border);padding:0.5rem;z-index:50;border-radius:4px;`;
        menu.innerHTML = `
            <div style="padding:0.3rem 0.8rem;cursor:pointer;color:var(--green);" data-action="copy">📋 复制文本</div>
            <div style="padding:0.3rem 0.8rem;cursor:pointer;color:var(--green);" data-action="detail">📄 查看详情</div>
            <div style="padding:0.3rem 0.8rem;cursor:pointer;color:var(--green);" data-action="share">🔗 分享链接</div>
        `;
        document.body.appendChild(menu);
        menu.querySelectorAll('div').forEach(item => {
            item.addEventListener('click', function() {
                const log = feed.find(l => l.id === logId);
                if (!log) return;
                const action = this.dataset.action;
                if (action === 'copy') {
                    navigator.clipboard.writeText(log.description + '\n' + log.detail).then(() => alert('已复制到剪贴板'));
                } else if (action === 'detail') {
                    const entry = document.querySelector('.log-entry[data-log-id="' + logId + '"]');
                    toggleDetail(logId, entry);
                } else if (action === 'share') {
                    const url = window.location.origin + '/#' + currentView;
                    navigator.clipboard.writeText(url).then(() => alert('链接已复制'));
                }
                menu.remove();
            });
        });
        setTimeout(() => {
            document.addEventListener('click', function handler() {
                menu.remove();
                document.removeEventListener('click', handler);
            }, { once: true });
        }, 100);
    }

    function attachTagHoverEvents() {
        document.querySelectorAll('.tag-hover').forEach(tag => {
            tag.addEventListener('mouseenter', function() {
                this.style.cursor = 'pointer';
            });
            tag.addEventListener('click', function(e) {
                e.stopPropagation();
                const t = this.dataset.tag;
                window.location.href = '/tags/?tag=' + encodeURIComponent(t);
            });
        });
    }

    function attachTimestampEvents() {
        document.querySelectorAll('.log-time').forEach(ts => {
            ts.addEventListener('click', function(e) {
                e.stopPropagation();
                const logId = this.dataset.timestamp;
                const entry = document.querySelector('.log-entry[data-log-id="' + logId + '"]');
                if (entry) {
                    entry.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    entry.style.background = 'var(--amber)';
                    setTimeout(() => { entry.style.background = ''; }, 1000);
                }
            });
        });
    }

    function attachStatusHintEvents() {
        document.querySelectorAll('.log-status').forEach(s => {
            s.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        });
    }

    function toggleDetail(logId, entryElement) {
        const panel = entryElement.querySelector('.detail-panel');
        if (!panel) return;
        const isOpen = entryElement.classList.contains('active');
        document.querySelectorAll('.log-entry.active').forEach(p => {
            if (p !== entryElement) {
                p.classList.remove('active');
            }
        });
        if (!isOpen) {
            entryElement.classList.add('active');
            openLogId = logId;
            if (window.innerWidth <= 899) {
                panel.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            entryElement.classList.remove('active');
            openLogId = null;
        }
    }

    function closeDetail(logId, entryElement) {
        if (entryElement) {
            entryElement.classList.remove('active');
            if (openLogId === logId) openLogId = null;
        }
    }

    function attachMobileGestures() {
        if (window.innerWidth > 899) return;
        document.querySelectorAll('.log-entry').forEach(entry => {
            const panel = entry.querySelector('.detail-panel');
            if (!panel) return;
            let startY = 0, currentY = 0, isDragging = false;
            panel.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                isDragging = true;
            }, { passive: true });
            panel.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                currentY = e.touches[0].clientY;
                const diff = currentY - startY;
                if (diff > 0) panel.style.transform = 'translateY(' + diff + 'px)';
            }, { passive: true });
            panel.addEventListener('touchend', function() {
                if (!isDragging) return;
                isDragging = false;
                if (currentY - startY > 100) {
                    const logId = entry.dataset.logId;
                    closeDetail(logId, entry);
                }
                panel.style.transform = '';
                startY = 0; currentY = 0;
            });
        });
    }

    function renderDashboard() {
        const container = viewContainers['dashboard'];
        if (!container) return;

        const total = categoryStats.total;
        const blogCount = categoryStats.blog;
        const essaysCount = categoryStats.essays;
        const tutorialsCount = categoryStats.tutorials;
        const projectsCount = categoryStats.projects;
        const maxSourceCount = Math.max(blogCount, essaysCount, tutorialsCount, projectsCount, 1);

        // 活跃标签 Top 8
        const allTags = {};
        feed.forEach(l => l.tags.forEach(t => { allTags[t] = (allTags[t] || 0) + 1; }));
        const topTags = Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 40);
        const maxTag = topTags.length > 0 ? topTags[0][1] : 1;

        // GitHub 热力图
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
            const count = contributions[dateStr] || 0;
            heatmapDays.push({ date: dateStr, day: dayName, count });
        }
        // 按周分组
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

        // 最近信号
        const recentLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);
        const catLabelMap = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
        const catColorMap = { tutorials: 'var(--blue)', blog: 'var(--green)', essays: 'var(--magenta)', projects: 'var(--amber)' };

        // 信号源状态
        const signalSection = `
            <div class="dash-section">
                <div class="dash-section-title">📡 信号源状态</div>
                <div class="source-list">
                    <div class="source-row">
                        <span class="source-dot" style="color:var(--green)">🟢</span>
                        <span class="source-label">博客信号</span>
                        <span class="source-count">${String(blogCount).padStart(2)}</span>
                        <span class="source-bar">${'█'.repeat(Math.round(blogCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(blogCount / maxSourceCount * 22))}</span>
                    </div>
                    <div class="source-row">
                        <span class="source-dot" style="color:var(--magenta)">🟣</span>
                        <span class="source-label">随笔信号</span>
                        <span class="source-count">${String(essaysCount).padStart(2)}</span>
                        <span class="source-bar">${'█'.repeat(Math.round(essaysCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(essaysCount / maxSourceCount * 22))}</span>
                    </div>
                    <div class="source-row">
                        <span class="source-dot" style="color:var(--blue)">🔵</span>
                        <span class="source-label">教程信号</span>
                        <span class="source-count">${String(tutorialsCount).padStart(2)}</span>
                        <span class="source-bar">${'█'.repeat(Math.round(tutorialsCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(tutorialsCount / maxSourceCount * 22))}</span>
                    </div>
                    <div class="source-row">
                        <span class="source-dot" style="color:var(--amber)">🟠</span>
                        <span class="source-label">项目信号</span>
                        <span class="source-count">${String(projectsCount).padStart(2)}</span>
                        <span class="source-bar">${'█'.repeat(Math.round(projectsCount / maxSourceCount * 22))}${'░'.repeat(22 - Math.round(projectsCount / maxSourceCount * 22))}</span>
                    </div>
                </div>
                <div class="source-summary">📋 总计 ${total} 条信号 | 信号强度: 稳定</div>
            </div>`;

        // 标签星系
        const tagGalaxySection = `
            <div class="dash-section">
                <div class="dash-section-title">🏷️ 标签星系</div>
                <div class="tag-galaxy" id="tagGalaxy">
                    ${topTags.map(([tag, count], i) => {
                        const opacity = 0.45 + (count / maxTag) * 0.55;
                        const colors = ['var(--green)', 'var(--blue)', 'var(--amber)', 'var(--magenta)'];
                        const color = colors[i % colors.length];
                        const seed = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                        const x = 2 + (seed % 92);
                        const y = 5 + ((seed * 7) % 85);
                        const delay = (seed % 30) / 10;
                        const duration = 3 + (seed % 20) / 10;
                        const floatClass = count >= 2 ? 'float' : '';
                        return `<span class="galaxy-tag ${floatClass}" data-tag="${tag}" onclick="filterByTag('${tag}')" style="left:${x}%;top:${y}%;color:${color};opacity:${opacity};--float-delay:${delay}s;--float-dur:${duration}s;">#${tag}</span>`;
                    }).join('')}
                </div>
            </div>`;

        // GitHub 热力图
        const dayLabels = ['Mon', '', 'Wed', '', 'Fri', '', ''];
        const heatmapSection = `
            <div class="dash-section">
                <div class="dash-section-title">🔥 GitHub 贡献热力图 (近90天)</div>
                <div class="heatmap-wrap">
                    <div class="heatmap-day-labels">
                        ${dayLabels.map(d => `<div class="day-label">${d}</div>`).join('')}
                    </div>
                    <div class="heatmap-container">
                        <div class="heatmap-grid">
                            ${weeks.map((week, wi) => `
                                <div class="heatmap-col" style="grid-column:${wi + 1}">
                                    ${week.map(day => {
                                        const level = day.count === 0 ? 0 : day.count <= 2 ? 1 : day.count <= 5 ? 2 : 3;
                                        return `<div class="heatmap-cell" data-level="${level}" data-date="${day.date}" data-count="${day.count}" title="${day.date}: ${day.count}次"></div>`;
                                    }).join('')}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
                <div class="heatmap-legend">
                    <span>少</span>
                    <div class="heatmap-cell" data-level="0"></div>
                    <div class="heatmap-cell" data-level="1"></div>
                    <div class="heatmap-cell" data-level="2"></div>
                    <div class="heatmap-cell" data-level="3"></div>
                    <span>多</span>
                </div>
            </div>`;

        const recentSection = `
            <div class="dash-section">
                <div class="dash-section-title">📡 最近信号接收记录</div>
                <div class="recent-table-wrap">
                    <table class="recent-table">
                        <thead>
                            <tr>
                                <th>时间</th><th>类型</th><th>内容</th><th>标签</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${recentLogs.map(log => `
                                <tr>
                                    <td>${log.timestamp.slice(0, 10)}</td>
                                    <td style="color:${catColorMap[log.typeLabel]}">${catLabelMap[log.typeLabel]}</td>
                                    <td class="recent-desc"><a href="${log.href}">${log.description.slice(0, 20)}</a></td>
                                    <td>${log.tags.slice(0, 1).map(t => '#' + t).join('')}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>`;

        container.innerHTML = `
            <div class="dashboard-container">
                <div class="dash-header">📊 观测站仪表盘</div>
                ${signalSection}
                ${tagGalaxySection}
                ${recentSection}
                ${heatmapSection}
            </div>`;
        showView('dashboard');
    }

    function renderErrors() {
        const container = viewContainers['errors'];
        if (!container) return;
        const tech = feed.filter(a => a.typeLabel === 'tutorials');
        const reading = feed.filter(a => a.typeLabel === 'blog');
        const essays = feed.filter(a => a.typeLabel === 'essays');
        const projects = feed.filter(a => a.typeLabel === 'projects');
        container.innerHTML = `
            <h2 style="color:var(--green);margin-bottom:1rem;">📚 文章分类</h2>
            <h3 style="color:var(--green);margin-top:1rem;">🛠️ 教程 (${tech.length})</h3>
            <ul style="list-style:none;padding:0;">${tech.map(l => `<li style="margin:0.3rem 0;"><a href="${l.href}" style="color:var(--text);">${l.description}</a></li>`).join('')}</ul>
            <h3 style="color:var(--blue);margin-top:1rem;">📖 博客 (${reading.length})</h3>
            <ul style="list-style:none;padding:0;">${reading.map(l => `<li style="margin:0.3rem 0;"><a href="${l.href}" style="color:var(--text);">${l.description}</a></li>`).join('')}</ul>
            <h3 style="color:var(--magenta);margin-top:1rem;">✍️ 随笔 (${essays.length})</h3>
            <ul style="list-style:none;padding:0;">${essays.map(l => `<li style="margin:0.3rem 0;"><a href="${l.href}" style="color:var(--text);">${l.description}</a></li>`).join('')}</ul>
            <h3 style="color:var(--amber);margin-top:1rem;">🚀 项目 (${projects.length})</h3>
            <ul style="list-style:none;padding:0;">${projects.map(l => `<li style="margin:0.3rem 0;"><a href="${l.href}" style="color:var(--text);">${l.description}</a></li>`).join('')}</ul>

            <h3 style="color:var(--green);margin-top:1.5rem;">📡 GitHub 活跃仓库</h3>
            <div id="github-repos" style="color:var(--text-dim);">加载中...</div>`;
        showView('errors');

        // 渲染 GitHub 仓库
        const reposContainer = document.getElementById('github-repos');
        const githubData = window.GITHUB_DATA || {};
        const repos = githubData.repos || [];
        if (reposContainer) {
            if (repos.length > 0) {
                const langColor = (lang) => ({ JavaScript: '#F7DF1E', TypeScript: '#3178C6', Python: '#3572A5', Java: '#B07219', Go: '#00ADD8', Vue: '#41B883', HTML: '#E34C26' }[lang] || '#888');
                reposContainer.innerHTML = `<div class="repo-grid" style="grid-template-columns:1fr 1fr;gap:0.8rem;">
                    ${repos.slice(0, 6).map(r => `
                        <a href="${r.url}" target="_blank" rel="noopener" style="display:block;padding:0.7rem;background:var(--surface);border:1px solid var(--border);border-radius:6px;text-decoration:none;">
                            <div style="color:var(--green);font-weight:600;font-size:0.85rem;margin-bottom:0.3rem;">📦 ${r.name}</div>
                            <div style="color:var(--text-dim);font-size:0.75rem;margin-bottom:0.3rem;">${r.description || '暂无描述'}</div>
                            <div style="color:var(--gray);font-size:0.7rem;">
                                ${r.language ? `<span style="color:${langColor(r.language)}">●</span> ${r.language} &nbsp;` : ''}
                                ⭐ ${r.stars} &nbsp; 🍴 ${r.forks} &nbsp;
                                <span style="float:right;">${r.updatedAgo}</span>
                            </div>
                        </a>
                    `).join('')}
                </div>
                <p style="color:var(--gray-dim);font-size:0.7rem;margin-top:0.5rem;">数据来源: <a href="https://github.com/${githubData.username}" target="_blank" rel="noopener" style="color:var(--green);">github.com/${githubData.username}</a> · 更新于 ${repos.length > 0 ? new Date(githubData.lastFetched).toLocaleString('zh-CN') : '未知'}</p>`;
            } else {
                reposContainer.innerHTML = '<span style="color:var(--text-dim);">暂无仓库数据</span>';
            }
        }
    }

    function renderMilestones() {
        const container = viewContainers['milestones'];
        if (!container) return;
        // 改为显示全部文章
        container.innerHTML = `
            <h2 style="color:var(--magenta);margin-bottom:1rem;">📚 全部文章</h2>
            <ul style="list-style:none;padding:0;">${feed.map(l => {
                const catLabel = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' }[l.typeLabel] || l.typeLabel;
                return `<li style="margin:0.4rem 0;display:flex;gap:0.5rem;">
                    <span style="color:var(--gray);font-size:0.75rem;min-width:80px;">${l.timestamp}</span>
                    <span style="color:var(--${l.typeLabel === 'tutorials' ? 'green' : l.typeLabel === 'blog' || l.typeLabel === 'essays' ? 'blue' : 'amber'});font-size:0.7rem;">[${catLabel}]</span>
                    <a href="${l.href}" style="color:var(--text);">${l.description}</a>
                </li>`;
            }).join('')}</ul>`;
        showView('milestones');
    }

    function renderProjects() {
        const container = viewContainers['projects'];
        if (!container) return;
        const projArticles = feed.filter(a => a.typeLabel === 'projects');
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

    function renderSkillsView() {
        const container = viewContainers['skills'];
        if (!container) return;
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

    function padRight(str, len) {
        return String(str).padEnd(len, ' ');
    }

    function renderHelp() {
        const container = viewContainers['help'];
        if (!container) return;
        container.innerHTML = `
            <h2 style="color:var(--green);">📖 可用命令</h2>
            <pre style="color:var(--text); line-height:1.6;">
filter [all|tech|reading|essays|projects]       按分类筛选
grep [关键词]                                    全文搜索
status / dashboard                               打开仪表盘
errors                                           文章总览
milestones                                       全部文章
skills / neofetch                                技能树
about                                            关于本站
help                                             显示此帮助
clear                                            清除筛选/返回文章流
theme dark|light                                 切换主题
export txt|json                                  导出当前视图
            </pre>
            <p style="color:var(--text-dim);">快捷键: j/k 移动 | Esc 关闭 | / 聚焦搜索 | Tab 补全</p>`;
        showView('help');
    }

    function renderAbout() {
        const container = viewContainers['about'];
        if (!container) return;

        const siteData = window.SITE_DATA || {};
        const author = siteData.author || '[操作员代号]';
        const location = siteData.location || '未知地点';
        const hostname = window.location.hostname || 'observatory.local';
        const uptime = formatUptime();
        const total = feed.length;
        const published = feed.filter(a => a.status === 'done').length;
        const unpublished = feed.filter(a => a.status !== 'done').length;
        const wipProjects = 0;
        const healthPercent = total > 0 ? Math.round((published / total) * 100) : 100;
        const barLen = 10;
        const filled = Math.round((healthPercent / 100) * barLen);
        const healthBar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

        const TYPE_MAP = { tutorials: 'INFO', blog: 'READ', essays: 'READ', projects: 'BUILD' };
        const recentSignals = [...feed]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5)
            .map(a => ({
                date: a.timestamp.slice(0, 10),
                type: TYPE_MAP[a.typeLabel] || 'READ',
                msg: a.description
            }));

        const currentTargets = [...feed]
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, 5)
            .map(a => a.description);

        const currentAsciiLines = [
            '                    _\\  \\_                             ',
            '                     /__|         "Bug? That\'s not a    ',
            '                 ___//_           bug, that\'s a          ',
            '                /      \\              FEATURE."         ',
            '               /        /\\                              ',
            '              / /\\     \\/  )                           ',
            '              \\_\\|     |  /                            ',
            '               (_      |\\/                              ',
            '                 |     |                                 ',
            '                 |_    |                                 ',
            '                  /   |                                  ',
            '                 / /| |                                  ',
            '                /_/ |_|                                  ',
            '               /|    /\\                                 ',
            '      _______/_/____\\_\\______________________________________________________ ',
        ];

        const mkSection = (title, icon, color, items) => `
            <div class="about-section">
                <div class="about-section-title" style="color:var(--${color});">
                    ${icon} ${title}
                </div>
                ${items.map(t => `
                    <div class="about-row">
                        <span class="about-label">${t.label}</span>
                        <span class="about-value">${t.value}</span>
                    </div>
                `).join('')}
            </div>`;

        const mkListSection = (title, icon, color, items) => `
            <div class="about-section">
                <div class="about-section-title" style="color:var(--${color});">
                    ${icon} ${title}
                </div>
                ${items.map(t => `
                    <div class="about-list-item">${t}</div>
                `).join('')}
            </div>`;

        const sysSection = mkSection('系统信息', '🖥️', 'green', [
            { label: '主机名', value: hostname },
            { label: '操作员', value: author },
            { label: '观测位置', value: location }
        ]);

        const runSection = mkSection('实时运行数据', '📊', 'amber', [
            { label: '运行时间', value: uptime },
            { label: '接收信号', value: total + '条' },
            { label: '已解码', value: published + '条' },
            { label: '未解决', value: unpublished + '条' },
            { label: '系统健康度', value: healthBar + ' ' + healthPercent + '%' }
        ]);

        const moduleSection = mkSection('活跃模块状态', '⚙️', 'blue', [
            { label: '日志接收器', value: '🟢 正常' },
            { label: '信号分析仪', value: '🟢 正常' },
            { label: '项目追踪器', value: wipProjects > 0 ? '🟡 ' + wipProjects + '项进行中' : '🟢 正常' },
            { label: '错误复盘器', value: unpublished > 0 ? '🟡 ' + unpublished + '条未解决' : '🟢 正常' }
        ]);

        const signalSection = mkListSection('近期信号事件', '📡', 'green',
            recentSignals.map(s => `[${s.date}] ${s.type} ${s.msg}`)
        );

        const targetSection = mkListSection('当前观测目标', '🎯', 'magenta',
            currentTargets.map(t => '▸ ' + t)
        );

        container.innerHTML = `
            <div class="about-layout">
                <div class="about-ascii">
                    <pre id="aboutAsciiPre" style="color:var(--green);line-height:1.4;font-size:0.7rem;"></pre>
                </div>
                <div class="about-info hidden">
                    ${sysSection}
                    ${runSection}
                    ${moduleSection}
                    ${signalSection}
                    ${targetSection}
                    <div class="about-footer">
                        <span>观测仍在继续。下个信号随时出现。</span>
                        <span style="color:var(--text-dim);">$ _</span>
                    </div>
                </div>
            </div>`;
        showView('about');
        // 打字机效果 - 逐字显示
        const asciiPre = document.getElementById('aboutAsciiPre');
        if (asciiPre) {
            const fullText = currentAsciiLines.join('\n') + '\n';
            let charIdx = 0;
            asciiPre.textContent = '';
            const typeChar = () => {
                if (charIdx < fullText.length) {
                    asciiPre.textContent += fullText[charIdx];
                    charIdx++;
                    setTimeout(typeChar, 8);
                } else {
                    // 打字完成，延迟移除hidden
                    setTimeout(() => {
                        const info = document.querySelector('.about-info.hidden');
                        if (info) info.classList.remove('hidden');
                    }, 300);
                }
            };
            typeChar();
        }
    }

    function executeCommand(cmdStr) {
        playClickSound();
        const parts = cmdStr.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        if (cmd === 'filter') {
            const cat = arg.toLowerCase();
            if (['all', 'tutorials', 'blog', 'essays', 'projects'].includes(cat)) {
                activeFilter = cat === 'all' ? null : cat; activeKeyword = null;
                renderLogStream(activeFilter); renderFilterChips(); renderSignalOverview(); showView('log');
            }
        } else if (cmd === 'grep') {
            if (arg) { activeKeyword = arg; activeFilter = null; renderLogStream(null, arg); renderFilterChips(); showView('log'); }
        } else if (cmd === 'status' || cmd === 'dashboard') { renderDashboard(); }
        else if (cmd === 'errors') { renderErrors(); }
        else if (cmd === 'milestones') { renderMilestones(); }
        else if (cmd === 'projects') { renderProjects(); }
        else if (cmd === 'skills' || cmd === 'neofetch') { renderSkillsView(); }
        else if (cmd === 'about') { renderAbout(); }
        else if (cmd === 'help') { renderHelp(); }
        else if (cmd === 'clear') { activeFilter = null; activeKeyword = null; renderLogStream(); renderFilterChips(); renderSignalOverview(); showView('log'); }
        else if (cmd === 'theme') {
            if (arg === 'dark') { document.body.classList.remove('light'); localStorage.setItem('terminal-theme', 'dark'); }
            else if (arg === 'light') { document.body.classList.add('light'); localStorage.setItem('terminal-theme', 'light'); }
        } else if (cmd === 'export') {
            const data = activeFilter ? feed.filter(l => l.typeLabel === activeFilter) : feed;
            if (arg === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'articles-export.json'; a.click();
            } else {
                const text = data.map(l => '[' + l.typeLabel + '] ' + l.timestamp + ' ' + l.description).join('\n');
                const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'articles-export.txt'; a.click();
            }
        }
    }

    window.executeCommand = executeCommand;
    window.renderErrors = renderErrors;

    if (cmdInput) {
        cmdInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                const cmd = this.value.trim();
                if (cmd) {
                    commandHistory.push(cmd);
                    if (commandHistory.length > 20) commandHistory.shift();
                    historyIndex = commandHistory.length;
                    localStorage.setItem('cmdHistory', JSON.stringify(commandHistory));
                    executeCommand(cmd);
                }
                this.value = '';
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (commandHistory.length && historyIndex > 0) { historyIndex--; this.value = commandHistory[historyIndex]; }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIndex < commandHistory.length - 1) { historyIndex++; this.value = commandHistory[historyIndex]; }
                else { historyIndex = commandHistory.length; this.value = ''; }
            } else if (e.key === 'Tab') {
                e.preventDefault();
                const val = this.value.toLowerCase();
                const commands = ['filter', 'grep', 'status', 'dashboard', 'errors', 'milestones', 'skills', 'neofetch', 'about', 'help', 'clear', 'theme', 'export'];
                const allTags = Object.keys(tagCounts);
                const parts = this.value.split(/\s+/);
                if (parts.length === 1) {
                    const match = commands.find(c => c.startsWith(val));
                    if (match) this.value = match + ' ';
                } else if (parts[0] === 'filter') {
                    const cats = ['all', 'tutorials', 'blog', 'essays', 'projects'];
                    const match = cats.find(c => c.startsWith(parts[1]?.toLowerCase()));
                    if (match) this.value = 'filter ' + match + ' ';
                } else if (parts[0] === 'theme') {
                    const themes = ['dark', 'light'];
                    const match = themes.find(t => t.startsWith(parts[1]));
                    if (match) this.value = 'theme ' + match + ' ';
                } else if (parts[0] === 'export') {
                    const formats = ['txt', 'json'];
                    const match = formats.find(f => f.startsWith(parts[1]));
                    if (match) this.value = 'export ' + match + ' ';
                } else {
                    const match = allTags.find(t => t.toLowerCase().startsWith(parts[1]?.toLowerCase()));
                    if (match) this.value = parts[0] + ' ' + match + ' ';
                }
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.target === cmdInput) return;
        if (e.key === '/') { e.preventDefault(); if (cmdInput) cmdInput.focus(); }
        else if (e.key === 'Escape') {
            if (openLogId) { const entry = document.querySelector('.log-entry[data-log-id="' + openLogId + '"]'); closeDetail(openLogId, entry); }
            else if (activeFilter || activeKeyword) { activeFilter = null; activeKeyword = null; renderLogStream(); showView('log'); }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
            if (!entries.length) return;
            if (focusedEntryIndex < entries.length - 1) {
                focusedEntryIndex++;
                entries[focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[focusedEntryIndex].style.outline = '2px solid var(--green)';
                if (focusedEntryIndex > 0) entries[focusedEntryIndex - 1].style.outline = '';
            }
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
            if (!entries.length) return;
            if (focusedEntryIndex > 0) {
                focusedEntryIndex--;
                entries[focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[focusedEntryIndex].style.outline = '2px solid var(--green)';
                if (focusedEntryIndex < entries.length - 1) entries[focusedEntryIndex + 1].style.outline = '';
            }
        } else if (e.key === 'Enter' && focusedEntryIndex >= 0) {
            const entries = document.querySelectorAll('.log-entry');
            const entry = entries[focusedEntryIndex];
            if (entry) toggleDetail(entry.dataset.logId, entry);
        } else if (e.key === 'J') { window.scrollBy({ top: 400, behavior: 'smooth' }); }
        else if (e.key === 'K') { window.scrollBy({ top: -400, behavior: 'smooth' }); }
    });

    if (mobileNav) {
        mobileNav.addEventListener('click', function(e) {
            const btn = e.target.closest('button');
            if (btn) {
                const view = btn.dataset.view;
                if (view === 'log') renderLogStream();
                else if (view === 'dashboard') renderDashboard();
                else if (view === 'errors') renderErrors();
                else if (view === 'about') renderAbout();
                showView(view);
            }
        });
    }

    // 移动端底部导航：滚动时隐藏，停止时显示
    let lastScrollY = 0;
    let hideTimer;
    function onMobileScroll() {
        const currentY = window.scrollY;
        if (Math.abs(currentY - lastScrollY) > 10) {
            mobileNav.classList.add('hidden');
            clearTimeout(hideTimer);
            hideTimer = setTimeout(function() {
                mobileNav.classList.remove('hidden');
            }, 1500);
        }
        lastScrollY = currentY;
    }
    if (mobileNav) {
        if (window.innerWidth <= 899) {
            window.addEventListener('scroll', onMobileScroll, { passive: true });
        }
        window.addEventListener('beforeunload', () => {
            window.removeEventListener('scroll', onMobileScroll);
            clearTimeout(hideTimer);
        });
    }

    // 面包屑 category 点击：SPA 跳转，不白屏
    document.querySelectorAll('.breadcrumb-category').forEach(function(link) {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const cat = this.dataset.category;
            if (cat) {
                activeFilter = cat;
                activeKeyword = null;
                renderLogStream(cat);
                showView('log');
                window.scrollTo(0, 0);
            }
        });
    });

    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('light');
            const isLight = document.body.classList.contains('light');
            this.textContent = isLight ? '☀️' : '🌙';
            localStorage.setItem('terminal-theme', isLight ? 'light' : 'dark');
        });
    }

    try {
    generateParticles();
    renderSignalOverview();
    renderFilterChips();
    renderSidebarSkills();
    renderRecentErrors();
    renderQuote();
    renderLogStream();
    showView('log');
    handleHashRoute();
    } catch(e) { console.error(e); }
    finally {
    const loading = document.getElementById('loadingOverlay');
    console.log('loadingOverlay found:', loading);
    if (loading) { loading.style.display = 'none'; loading.remove(); }
    console.log('Init complete');
    }

    console.log('🌌 观测站已启动。');
    console.log('📡 正在监听学习宇宙的信号...');
    console.log('💡 试试点击卡片、切换过滤器、或按 j/k 键浏览。');
})();
