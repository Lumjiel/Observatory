// 文本处理工具

export function highlightText(text, keyword) {
    if (!keyword) return text;
    const regex = new RegExp('(' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
    return text.replace(regex, '<mark style="background:var(--amber);color:var(--bg);padding:0 2px;border-radius:2px;">$1</mark>');
}

export function formatTimestamp(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0') + ':' +
        String(d.getSeconds()).padStart(2, '0');
}

export function parseMarkdown(text) {
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

export function formatUptime() {
    const startDate = (window.SITE_DATA && window.SITE_DATA.startDate) ? window.SITE_DATA.startDate : '2026-05-07';
    const start = new Date(startDate);
    const now = new Date();
    const diff = now - start;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 1) return '🚀 今天上线';
    return `📈 已运行 ${days} 天`;
}

export const CAT_LABELS = { tutorials: '教程', blog: '博客', essays: '随笔', projects: '项目' };
export const CAT_COLORS = { tutorials: 'var(--blue)', blog: 'var(--green)', essays: 'var(--magenta)', projects: 'var(--amber)' };
export const TYPE_CLASS_MAP = { tutorials: 'green', blog: 'blue', essays: 'blue', projects: 'amber', default: 'gray' };

export function getTypeClass(typeLabel) {
    return TYPE_CLASS_MAP[typeLabel] || TYPE_CLASS_MAP.default;
}

export function getCatLabel(typeLabel) {
    return CAT_LABELS[typeLabel] || typeLabel;
}