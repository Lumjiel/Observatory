// 日志条目事件
import { state } from '../state.js';
import { toggleDetail } from '../components/detail.js';

export function attachLogEvents() {
    document.querySelectorAll('.log-entry').forEach(entry => {
        entry.addEventListener('click', function(e) {
            if (e.target.closest('.tag-hover') || e.target.closest('.log-time') || e.target.closest('.log-link')) return;
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

export function attachTagHoverEvents() {
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