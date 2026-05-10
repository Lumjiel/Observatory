// 全局键盘快捷键
import { state } from '../state.js';
import { closeDetail } from '../components/detail.js';

export function initKeyboard() {
    document.addEventListener('keydown', function(e) {
        if (e.target === state.dom.cmdInput) return;
        if (e.key === '/') {
            e.preventDefault();
            if (state.dom.cmdInput) state.dom.cmdInput.focus();
        } else if (e.key === 'Escape') {
            if (state.openLogId) {
                const entry = document.querySelector('.log-entry[data-log-id="' + state.openLogId + '"]');
                closeDetail(state.openLogId, entry);
            } else if (state.activeFilter || state.activeKeyword) {
                window.executeCommand('clear');
            }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
            if (!entries.length) return;
            if (state.focusedEntryIndex < entries.length - 1) {
                state.focusedEntryIndex++;
                entries[state.focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[state.focusedEntryIndex].style.outline = '2px solid var(--green)';
                if (state.focusedEntryIndex > 0) entries[state.focusedEntryIndex - 1].style.outline = '';
            }
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
            if (!entries.length) return;
            if (state.focusedEntryIndex > 0) {
                state.focusedEntryIndex--;
                entries[state.focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[state.focusedEntryIndex].style.outline = '2px solid var(--green)';
                if (state.focusedEntryIndex < entries.length - 1) entries[state.focusedEntryIndex + 1].style.outline = '';
            }
        } else if (e.key === 'Enter' && state.focusedEntryIndex >= 0) {
            const entries = document.querySelectorAll('.log-entry');
            const entry = entries[state.focusedEntryIndex];
            if (entry && entry.dataset.href) {
                window.location.href = entry.dataset.href;
            }
        } else if (e.key === 'J') {
            window.scrollBy({ top: 400, behavior: 'smooth' });
        } else if (e.key === 'K') {
            window.scrollBy({ top: -400, behavior: 'smooth' });
        }
    });
}