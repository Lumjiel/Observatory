// 详情面板组件
import { state, setOpenLogId } from '../state.js';
import { parseMarkdown } from '../utils/text.js';

export function renderDetail(log) {
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

export function toggleDetail(logId, entryElement) {
    const panel = entryElement.querySelector('.detail-panel');
    if (!panel) return;
    const isOpen = entryElement.classList.contains('active');
    document.querySelectorAll('.log-entry.active').forEach(p => {
        if (p !== entryElement) p.classList.remove('active');
    });
    if (!isOpen) {
        entryElement.classList.add('active');
        setOpenLogId(logId);
        if (window.innerWidth <= 899) panel.scrollIntoView({ behavior: 'smooth' });
    } else {
        entryElement.classList.remove('active');
        setOpenLogId(null);
    }
}

export function closeDetail(logId, entryElement) {
    if (entryElement) {
        entryElement.classList.remove('active');
        if (state.openLogId === logId) setOpenLogId(null);
    }
}