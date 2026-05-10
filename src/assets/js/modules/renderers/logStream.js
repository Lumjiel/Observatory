// 文章流渲染器
import { state, setCurrentPage, setFilteredLogs, setActiveFilter, setActiveKeyword, getFilterCacheKey, clearFilterCache } from '../state.js';
import { highlightText, formatTimestamp, getTypeClass, getCatLabel } from '../utils/text.js';
import { showView } from '../router.js';
import { toggleDetail } from '../components/detail.js';

export function renderPaginationButtons(totalPages, current) {
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

function createLogEntry(log, globalIndex) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.dataset.logId = log.id;
    entry.dataset.index = globalIndex;
    entry.dataset.href = log.href;
    return entry;
}

function renderLogEntry(log, globalIndex, keyword) {
    const entry = createLogEntry(log, globalIndex);
    const descHtml = keyword ? highlightText(log.description, keyword) : log.description;
    const typeClass = getTypeClass(log.typeLabel);
    const catLabel = getCatLabel(log.typeLabel);
    entry.innerHTML = `
        <div class="log-line">
          <span class="event-type-dot ${typeClass}"></span>
          <span class="log-time" data-timestamp="${log.id}">[${formatTimestamp(log.timestamp)}]</span>
          <span class="log-tag ${log.typeLabel}" data-tag="${log.typeLabel}">[${catLabel}]</span>
          <span class="log-desc"><a href="${log.href}" class="log-link">${descHtml}</a></span>
          <span class="log-meta">${log.tags.slice(0, 3).map(t => `<span class="tag-hover" data-tag="${t}">#${t}</span>`).join(' ')}</span>
        </div>`;
    return entry;
}

function attachStreamEvents() {
    const stream = document.querySelector('.log-stream');
    if (!stream) return;

    // Click delegation
    stream.addEventListener('click', function(e) {
        const entry = e.target.closest('.log-entry');
        if (!entry) return;

        if (e.target.closest('.tag-hover')) {
            const tag = e.target.dataset.tag;
            window.location.href = '/tags/?tag=' + encodeURIComponent(tag);
            return;
        }
        if (e.target.closest('.log-time')) return;
        if (e.target.closest('.log-link')) return;

        const href = entry.dataset.href;
        if (href) {
            window.location.href = href;
        } else {
            const logId = entry.dataset.logId;
            toggleDetail(logId, entry);
        }
    });

    // Touch delegation
    let pressTimer;
    stream.addEventListener('touchstart', function(e) {
        const entry = e.target.closest('.log-entry');
        if (!entry || e.target.closest('.tag-hover') || e.target.closest('.log-link')) return;
        const href = entry.dataset.href;
        pressTimer = setTimeout(() => {
            if (href) window.location.href = href;
        }, 500);
    }, { passive: true });
    stream.addEventListener('touchend', () => clearTimeout(pressTimer));
    stream.addEventListener('touchmove', () => clearTimeout(pressTimer));
}

export function renderLogStream(filterType = null, keyword = null, page = 1) {
    const { feed, PAGE_SIZE } = state;
    const cacheKey = getFilterCacheKey(filterType, keyword);

    let filteredLogs = state.filterCache.get(cacheKey);
    if (!filteredLogs) {
        filteredLogs = [...feed].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
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
        state.filterCache.set(cacheKey, filteredLogs);
    }

    setFilteredLogs(filteredLogs);
    setCurrentPage(page);

    const container = state.dom.viewContainers.log;
    if (!container) return;

    if (filteredLogs.length === 0) {
        container.innerHTML = '<p style="color:var(--gray)">没有匹配的文章。</p>';
        return;
    }

    const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
    const startIdx = (page - 1) * PAGE_SIZE;
    const endIdx = Math.min(startIdx + PAGE_SIZE, filteredLogs.length);
    const pageLogs = filteredLogs.slice(startIdx, endIdx);

    // Get or create .log-stream
    let stream = container.querySelector('.log-stream');
    if (!stream) {
        stream = document.createElement('div');
        stream.className = 'log-stream';
        container.appendChild(stream);
        attachStreamEvents();
    }

    // Build new page ids
    const newIds = new Set(pageLogs.map(l => l.id));

    // Remove entries not in current page
    stream.querySelectorAll('.log-entry').forEach(el => {
        if (!newIds.has(el.dataset.logId)) el.remove();
    });

    // Get existing entries
    const existingById = new Map(
        [...stream.querySelectorAll('.log-entry')].map(el => [el.dataset.logId, el])
    );

    // Update or create entries
    pageLogs.forEach((log, idx) => {
        if (existingById.has(log.id)) {
            existingById.get(log.id).dataset.index = startIdx + idx;
        } else {
            stream.appendChild(renderLogEntry(log, startIdx + idx, keyword));
        }
    });

    // Remove old pagination
    const oldPagination = container.querySelector('.pagination');
    if (oldPagination) oldPagination.remove();

    if (totalPages > 1) {
        const pagination = document.createElement('div');
        pagination.className = 'pagination';
        pagination.innerHTML = renderPaginationButtons(totalPages, page);
        container.appendChild(pagination);
        pagination.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', function() {
                const pageNum = parseInt(this.dataset.page);
                if (pageNum && pageNum !== page) {
                    renderLogStream(filterType, keyword, pageNum);
                    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }
}

window.loadMoreLogs = function() {
    if (state.isLoadingMore) return;
    state.isLoadingMore = true;
    state.currentPage++;
    renderLogStream(state.activeFilter, state.activeKeyword, state.currentPage);
    state.isLoadingMore = false;
};