(function() {
    const logs = window.LOGS_DATA || [];
    const projects = window.PROJECTS_DATA || [];
    const skills = window.SKILLS_DATA || { categories: [] };

    let currentView = 'log';
    let openLogId = null;
    let commandHistory = [];
    let historyIndex = -1;
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
        const total = logs.length;
        const done = logs.filter(l => l.status === 'done').length;
        const wip = logs.filter(l => l.status === 'wip').length;
        const errors = logs.filter(l => l.type === 'ERROR' && l.status !== 'done').length;
        const milestones = logs.filter(l => l.type === 'MILESTONE').length;

        container.innerHTML = `
            <div class="signal-card green" onclick="executeCommand('filter INFO')">
                <span class="sig-value">${total}</span>
                <span class="sig-label">总信号</span>
            </div>
            <div class="signal-card blue" onclick="executeCommand('status')">
                <span class="sig-value">${done}</span>
                <span class="sig-label">已完成</span>
            </div>
            <div class="signal-card amber" onclick="executeCommand('errors')">
                <span class="sig-value">${errors}</span>
                <span class="sig-label">待解决</span>
            </div>
            <div class="signal-card magenta" onclick="executeCommand('milestones')">
                <span class="sig-value">${milestones}</span>
                <span class="sig-label">里程碑</span>
            </div>`;
    }

    function renderFilterChips() {
        const container = document.getElementById('filterChips');
        if (!container) return;
        const types = [
            { key: 'all', label: '全部' },
            { key: 'INFO', label: 'INFO' },
            { key: 'READ', label: 'READ' },
            { key: 'BUILD', label: 'BUILD' },
            { key: 'ERROR', label: 'ERROR' },
            { key: 'MILESTONE', label: 'MILESTONE' },
            { key: 'THINK', label: 'THINK' }
        ];
        container.innerHTML = types.map(t =>
            `<button class="filter-chip ${activeFilter === t.key || (!activeFilter && t.key === 'all') ? 'active' : ''}" data-filter="${t.key}">${t.label}</button>`
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
                showView('log');
            });
        });
    }

    function renderSidebarSkills() {
        const container = document.getElementById('skillList');
        if (!container) return;
        const skills = [
            { name: 'C', level: 75, color: 'green' },
            { name: 'Python', level: 70, color: 'green' },
            { name: '数据结构', level: 60, color: 'blue' },
            { name: 'Linux', level: 50, color: 'green' },
            { name: 'JavaScript', level: 30, color: 'amber' },
            { name: '机器学习', level: 20, color: 'amber' },
        ];
        container.innerHTML = skills.map(s => `
            <div class="skill-row"><span>${s.name}</span><span>${s.level}%</span></div>
            <div class="skill-bar-wrap"><div class="skill-bar-fill ${s.color}" style="width:${s.level}%"></div></div>
        `).join('');
    }

    function renderRecentErrors() {
        const container = document.getElementById('recentErrors');
        if (!container) return;
        const errs = logs.filter(l => l.type === 'ERROR').slice(-4);
        container.innerHTML = errs.map(e => `
            <li><span>⚠</span> ${formatTimestamp(e.timestamp)} ${e.description}</li>
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

    function detectStaleLogs() {
        const now = new Date();
        logs.forEach(l => {
            if (l.status === 'wip') {
                const days = (now - new Date(l.timestamp)) / (1000 * 60 * 60 * 24);
                if (days > 14) l.stale = true;
            }
        });
    }
    detectStaleLogs();

    function getTagCounts() {
        const counts = {};
        logs.forEach(l => l.tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
        return counts;
    }
    const tagCounts = getTagCounts();

    function formatUptime() {
        const start = new Date('2026-02-14');
        const now = new Date();
        const diff = now - start;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        return `${days}天 ${hours}小时`;
    }

    function updateStatusBar() {
        const uptime = document.getElementById('uptime');
        const activeCount = document.getElementById('activeCount');
        if (uptime) uptime.textContent = '🕒 ' + formatUptime();
        if (activeCount) activeCount.textContent = '📋 ' + logs.length + '条日志';
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
        filteredLogs = [...logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (filterType) filteredLogs = filteredLogs.filter(l => l.type === filterType);
        if (keyword) {
            const kw = keyword.toLowerCase();
            filteredLogs = filteredLogs.filter(l =>
                l.description.toLowerCase().includes(kw) ||
                l.tags.some(t => t.toLowerCase().includes(kw)) ||
                l.type.toLowerCase().includes(kw)
            );
        }
        currentPage = page;
        const container = viewContainers['log'];
        container.innerHTML = '';
        if (filteredLogs.length === 0) {
            container.innerHTML = '<p style="color:var(--gray)">没有匹配的日志条目。</p>';
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
            const statusSymbol = log.status === 'done' ? '✓' : log.status === 'wip' ? '⚠' : log.stale ? '⏳' : '★';
            const descHtml = keyword ? highlightText(log.description, keyword) : log.description;
            const staleBadge = log.stale ? '<span class="stale-badge">⏳ 停滞</span>' : '';
            const typeClass = log.type === 'INFO' ? 'green' : log.type === 'READ' ? 'blue' : log.type === 'BUILD' ? 'amber' : log.type === 'ERROR' ? 'amber' : log.type === 'MILESTONE' ? 'magenta' : 'gray';
            entry.innerHTML = `
                ${staleBadge}
                <div class="log-line">
                  <span class="event-type-dot ${typeClass}"></span>
                  <span class="log-time" data-timestamp="${log.id}">[${formatTimestamp(log.timestamp)}]</span>
                  <span class="log-tag ${log.type}" data-tag="${log.type}">[${log.type}]</span>
                  <span class="log-desc">${descHtml}</span>
                  <span class="log-meta">${log.tags.map(t => `<span class="tag-hover" data-tag="${t}" title="${tagCounts[t] || 0} 条日志">#${t}</span>`).join(' ')}</span>
                  <span class="log-status ${log.status === 'error' ? 'error-status' : log.status}" data-status="${log.status}" title="${getStatusHint(log.status)}">${statusSymbol}</span>
                </div>
                <div class="detail-panel">${renderDetail(log)}</div>`;
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
        attachMobileGestures();
        attachTagHoverEvents();
        attachTimestampEvents();
        attachStatusHintEvents();
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
                if (e.target.closest('.tag-hover') || e.target.closest('.log-time') || e.target.closest('.log-status')) return;
                const logId = this.dataset.logId;
                toggleDetail(logId, this);
            });
            let pressTimer;
            entry.addEventListener('touchstart', function(e) {
                if (e.target.closest('.tag-hover')) return;
                const logId = this.dataset.logId;
                pressTimer = setTimeout(() => showLongPressMenu(logId, e.touches[0].clientX, e.touches[0].clientY), 500);
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
                const log = logs.find(l => l.id === logId);
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
                executeCommand('grep ' + t);
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
        const total = logs.length;
        const done = logs.filter(l => l.status === 'done').length;
        const wip = logs.filter(l => l.status === 'wip').length;
        const errors = logs.filter(l => l.type === 'ERROR').length;
        const milestones = logs.filter(l => l.type === 'MILESTONE').length;
        const resolvedErrors = logs.filter(l => l.type === 'ERROR' && l.status === 'done').length;
        const staleCount = logs.filter(l => l.stale).length;

        const updateFrequency = Math.min(100, (total / 90) * 100);
        const errorResolutionRate = errors > 0 ? (resolvedErrors / errors) * 100 : 100;
        const activeTaskPenalty = Math.max(0, 100 - (wip * 15) - (staleCount * 10));
        const healthScore = Math.floor((updateFrequency * 0.4) + (errorResolutionRate * 0.3) + (activeTaskPenalty * 0.3));
        const healthBar = '█'.repeat(Math.floor(healthScore / 5)) + '░'.repeat(20 - Math.floor(healthScore / 5));

        const days = ['一', '二', '三', '四', '五', '六', '日'];
        const hours = [2.5, 1.8, 3.0, 2.2, 2.8, 1.5, 2.1];
        const maxHours = Math.max(...hours);
        const heatmapHTML = days.map((d, i) => `
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
                <div class="heat-bar" style="height:${(hours[i]/maxHours)*80}px;opacity:${0.4 + (hours[i]/maxHours)*0.6};"></div>
                <span class="heat-label">${d}</span>
                <span class="heat-label">${hours[i]}h</span>
            </div>`).join('');

        const typeCounts = {};
        logs.forEach(l => { typeCounts[l.type] = (typeCounts[l.type] || 0) + 1; });
        const typeStatsHTML = Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => '<span style="color:var(--' + (type === 'ERROR' ? 'amber' : type === 'MILESTONE' ? 'magenta' : 'green') + ')">' + type + ': ' + count + '</span>')
            .join(' | ');

        const allTags = {};
        logs.forEach(l => l.tags.forEach(t => { allTags[t] = (allTags[t] || 0) + 1; }));
        const tagHTML = Object.entries(allTags).sort((a, b) => b[1] - a[1]).slice(0, 15)
            .map(([t]) => '<span onclick="executeCommand(\'grep ' + t + '\')">#' + t + '</span>').join('');

        container.innerHTML = `
            <div class="dashboard-grid">
                <div class="dash-card">
                    <h3>📊 学习统计</h3>
                    <p>总日志: ${total} | 已完成: ${done} | 进行中: ${wip}</p>
                    <p>错误记录: ${errors} | 里程碑: ${milestones}${staleCount ? ' | <span style="color:var(--amber);">停滞: ' + staleCount + '</span>' : ''}</p>
                    <p style="margin-top:0.5rem;color:var(--gray);">${typeStatsHTML}</p>
                </div>
                <div class="dash-card">
                    <h3>💚 系统健康度</h3>
                    <p style="font-size:1.2rem;margin:0.5rem 0;">${healthBar} ${healthScore}%</p>
                    <p style="color:var(--gray);font-size:0.8rem;">更新频率: ${Math.floor(updateFrequency)}% | 错误解决率: ${Math.floor(errorResolutionRate)}% | 活跃任务: ${wip}</p>
                </div>
                <div class="dash-card">
                    <h3>📅 近7天学习时长</h3>
                    <div class="heatmap">${heatmapHTML}</div>
                </div>
                <div class="dash-card">
                    <h3>🏷️ 活跃标签</h3>
                    <div class="tag-cloud">${tagHTML}</div>
                </div>
                <div class="dash-card" style="grid-column: 1 / -1;">
                    <h3>⚠️ 最近错误</h3>
                    <ul style="color:var(--amber); padding-left:1.5rem; list-style: none;">
                        ${logs.filter(l => l.type === 'ERROR').slice(-3).reverse().map(l =>
                            '<li style="margin:0.3rem 0;"><span style="color:var(--gray);">[' + formatTimestamp(l.timestamp) + ']</span> ' + l.description + ' <span style="color:var(--green);">' + (l.status === 'done' ? '✓已解决' : '⚠未解决') + '</span></li>'
                        ).join('')}
                    </ul>
                </div>
            </div>`;
        showView('dashboard');
    }

    function renderErrors(filter = 'all') {
        const container = viewContainers['errors'];
        let errorLogs = logs.filter(l => l.type === 'ERROR');
        if (filter === 'unresolved') errorLogs = errorLogs.filter(l => l.status !== 'done');
        else if (filter === 'resolved') errorLogs = errorLogs.filter(l => l.status === 'done');
        const unresolvedCount = logs.filter(l => l.type === 'ERROR' && l.status !== 'done').length;
        const resolvedCount = logs.filter(l => l.type === 'ERROR' && l.status === 'done').length;

        container.innerHTML = errorLogs.length ? `
            <h2 style="color:var(--amber);margin-bottom:0.5rem;">⚠️ 错误看板</h2>
            <p style="color:var(--gray);margin-bottom:1rem;font-size:0.8rem;">
                总计: ${logs.filter(l => l.type === 'ERROR').length} |
                已解决: <span style="color:var(--green);">${resolvedCount}</span> |
                未解决: <span style="color:var(--amber);">${unresolvedCount}</span>
            </p>
            <div style="margin-bottom:1rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button onclick="renderErrors('all')" style="background:${filter === 'all' ? 'var(--amber)' : 'transparent'};color:var(--amber);border:1px solid var(--amber);padding:0.3rem 0.8rem;cursor:pointer;font-family:var(--font-mono);font-size:0.8rem;">全部</button>
                <button onclick="renderErrors('unresolved')" style="background:${filter === 'unresolved' ? 'var(--amber)' : 'transparent'};color:var(--amber);border:1px solid var(--amber);padding:0.3rem 0.8rem;cursor:pointer;font-family:var(--font-mono);font-size:0.8rem;">未解决</button>
                <button onclick="renderErrors('resolved')" style="background:${filter === 'resolved' ? 'var(--amber)' : 'transparent'};color:var(--amber);border:1px solid var(--amber);padding:0.3rem 0.8rem;cursor:pointer;font-family:var(--font-mono);font-size:0.8rem;">已解决</button>
            </div>
            <table>
                <tr><th>时间</th><th>描述</th><th>标签</th><th>状态</th></tr>
                ${errorLogs.map(l => `<tr style="${l.status !== 'done' ? 'background:rgba(255,170,0,0.05);' : ''}">
                    <td style="color:var(--gray);white-space:nowrap;">${formatTimestamp(l.timestamp)}</td>
                    <td>${l.description}</td>
                    <td style="color:var(--gray);font-size:0.75rem;">${l.tags.map(t => '#' + t).join(' ')}</td>
                    <td>${l.status === 'done' ? '<span style="color:var(--green);">✓ 已解决</span>' : '<span style="color:var(--amber);">⚠ 未解决</span>'}</td>
                </tr>`).join('')}
            </table>` : '<p style="color:var(--gray);">暂无错误记录。</p>';
        showView('errors');
    }

    function renderMilestones() {
        const container = viewContainers['milestones'];
        const mLogs = logs.filter(l => l.type === 'MILESTONE');
        container.innerHTML = mLogs.length ? `
            <h2 style="color:var(--magenta);margin-bottom:1rem;">★ 里程碑时间轴</h2>
            <div class="timeline">
                ${mLogs.map(l => `<div class="timeline-item">
                    <strong>${formatTimestamp(l.timestamp)}</strong> - ${l.description}
                    ${l.milestone_days ? '<span style="color:var(--gray);"> (连续' + l.milestone_days + '天)</span>' : ''}
                </div>`).join('')}
            </div>` : '<p style="color:var(--gray);">暂无里程碑。</p>';
        showView('milestones');
    }

    function renderProjects() {
        const container = viewContainers['projects'];
        container.innerHTML = projects.length ? `
            <h2 style="color:var(--amber);margin-bottom:1rem;">🛠️ 项目展板</h2>
            <table>
                <tr><th>项目</th><th>进度</th><th>技术栈</th><th>状态</th></tr>
                ${projects.map(p => `<tr>
                    <td>${p.name}</td>
                    <td>${p.progress !== undefined ? '<span class="progress-bar-ascii">[' + '#'.repeat(Math.floor(p.progress / 10)) + '.'.repeat(10 - Math.floor(p.progress / 10)) + '] ' + p.progress + '%</span>' : 'N/A'}</td>
                    <td style="font-size:0.75rem;">${p.tech.join(', ')}</td>
                    <td>${p.status === 'done' ? '<span style="color:var(--green);">✓ 完成</span>' : '<span style="color:var(--amber);">⚠ 进行中</span>'}</td>
                </tr>`).join('')}
            </table>` : '<p style="color:var(--gray);">暂无项目。</p>';
        showView('projects');
    }

    function renderSkillsView() {
        const container = viewContainers['skills'];
        const tree = skills.categories.map(cat => {
            const items = cat.skills.map((s, i) => {
                const isLast = i === cat.skills.length - 1;
                const prefix = isLast ? '└── ' : '├── ';
                return '    ' + prefix + '<span style="color:var(--' + s.color + ')">' + s.name + '</span> (' + s.level + ')';
            }).join('\n');
            return '    <span style="color:var(--green);">' + cat.label + '</span>\n' + items;
        }).join('\n    │\n');
        container.innerHTML = `
            <h2 style="color:var(--green);">🌳 技能树 (neofetch 风格)</h2>
            <pre style="color:var(--green); background:transparent; line-height:1.4; margin:1rem 0;">
        技术栈
        ├── ${tree}
            </pre>
            <p style="color:var(--text-dim); margin-top:1rem;">点击叶子可筛选对应标签</p>`;
        showView('skills');
    }

    function renderAbout() {
        const container = viewContainers['about'];
        container.innerHTML = `
            <pre style="color:var(--green); line-height:1.5;">
        ╔══════════════════════════════╗
        ║   student@observatory      ║
        ╚══════════════════════════════╝
        OS: Computer Science 大二
        Shell: zsh + curiosity
        Uptime: ${formatUptime()}
        Interests: 系统, AI, Web
        Blog: 终端日志观测站 v1.2
        Motto: "Stay hungry, stay foolish."
            </pre>`;
        showView('about');
    }

    function renderHelp() {
        const container = viewContainers['help'];
        container.innerHTML = `
            <h2 style="color:var(--green);">📖 可用命令</h2>
            <pre style="color:var(--text); line-height:1.6;">
filter [INFO|READ|BUILD|ERROR|MILESTONE|THINK]  按类型筛选
grep [关键词]                                    全文搜索
status / dashboard                               打开仪表盘
errors                                           错误看板
milestones                                       里程碑时间轴
projects                                         项目展板
skills / neofetch                                技能树
about                                            关于本站
help                                             显示此帮助
clear                                            清除筛选/返回日志流
theme dark|light                                 切换主题
export txt|json                                  导出当前视图
            </pre>
            <p style="color:var(--text-dim);">快捷键: j/k 移动 | Enter 展开 | Esc 关闭 | / 聚焦搜索 | Tab 补全 | Shift+J/K 快速滚动</p>`;
        showView('help');
    }

    function executeCommand(cmdStr) {
        playClickSound();
        const parts = cmdStr.trim().split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const arg = parts.slice(1).join(' ');

        if (cmd === 'filter') {
            const type = arg.toUpperCase();
            if (['INFO', 'READ', 'BUILD', 'ERROR', 'MILESTONE', 'THINK'].includes(type)) {
                activeFilter = type; activeKeyword = null;
                renderLogStream(type); showView('log');
            }
        } else if (cmd === 'grep') {
            if (arg) { activeKeyword = arg; activeFilter = null; renderLogStream(null, arg); showView('log'); }
        } else if (cmd === 'status' || cmd === 'dashboard') { renderDashboard(); }
        else if (cmd === 'errors') { renderErrors(); }
        else if (cmd === 'milestones') { renderMilestones(); }
        else if (cmd === 'projects') { renderProjects(); }
        else if (cmd === 'skills' || cmd === 'neofetch') { renderSkillsView(); }
        else if (cmd === 'about') { renderAbout(); }
        else if (cmd === 'help') { renderHelp(); }
        else if (cmd === 'clear') { activeFilter = null; activeKeyword = null; renderLogStream(); showView('log'); }
        else if (cmd === 'theme') {
            if (arg === 'dark') { document.body.classList.remove('light'); localStorage.setItem('terminal-theme', 'dark'); }
            else if (arg === 'light') { document.body.classList.add('light'); localStorage.setItem('terminal-theme', 'light'); }
        } else if (cmd === 'export') {
            const data = activeFilter ? logs.filter(l => l.type === activeFilter) : logs;
            if (arg === 'json') {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'logs-export.json'; a.click();
            } else {
                const text = data.map(l => '[' + l.type + '] ' + l.timestamp + ' ' + l.description).join('\n');
                const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = 'logs-export.txt'; a.click();
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
                const commands = ['filter', 'grep', 'status', 'dashboard', 'errors', 'milestones', 'projects', 'skills', 'neofetch', 'about', 'help', 'clear', 'theme', 'export'];
                const allTags = Object.keys(tagCounts);
                const parts = this.value.split(/\s+/);
                if (parts.length === 1) {
                    const match = commands.find(c => c.startsWith(val));
                    if (match) this.value = match + ' ';
                } else if (parts[0] === 'filter') {
                    const types = ['INFO', 'READ', 'BUILD', 'ERROR', 'MILESTONE', 'THINK'];
                    const match = types.find(t => t.startsWith(parts[1]?.toUpperCase()));
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
            if (focusedEntryIndex < entries.length - 1) {
                focusedEntryIndex++;
                entries[focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[focusedEntryIndex].style.outline = '2px solid var(--green)';
                if (focusedEntryIndex > 0) entries[focusedEntryIndex - 1].style.outline = '';
            }
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
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
            if (e.target.tagName === 'BUTTON') {
                const view = e.target.dataset.view;
                if (view === 'log') renderLogStream();
                else if (view === 'dashboard') renderDashboard();
                else if (view === 'skills') renderSkillsView();
                else if (view === 'about') renderAbout();
                showView(view);
            }
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            document.body.classList.toggle('light');
            const isLight = document.body.classList.contains('light');
            this.textContent = isLight ? '☀️' : '🌙';
            localStorage.setItem('terminal-theme', isLight ? 'light' : 'dark');
        });
    }

    generateParticles();
    renderSignalOverview();
    renderFilterChips();
    renderSidebarSkills();
    renderRecentErrors();
    renderQuote();
    renderLogStream();
    showView('log');
    handleHashRoute();

    const loading = document.getElementById('loadingOverlay');
    if (loading) { loading.classList.add('hidden'); setTimeout(() => loading.remove(), 500); }

    console.log('🌌 观测站已启动。');
    console.log('📡 正在监听学习宇宙的信号...');
    console.log('💡 试试点击卡片、切换过滤器、或按 j/k 键浏览。');
})();
