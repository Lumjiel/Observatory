// 筛选器标签组件
import { state, setActiveFilter } from '../state.js';

export function renderFilterChips() {
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
        `<button class="filter-chip ${state.activeFilter === c.key || (!state.activeFilter && c.key === 'all') ? 'active' : ''}" data-filter="${c.key}">${c.label}</button>`
    ).join('');
    container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', function() {
            const filter = this.dataset.filter;
            if (filter === 'all') {
                setActiveFilter(null);
                window.executeCommand('/filter all');
            } else {
                setActiveFilter(filter);
                window.executeCommand('/filter ' + filter);
            }
        });
    });
}