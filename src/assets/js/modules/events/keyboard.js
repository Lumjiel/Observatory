// 全局键盘快捷键
import { state } from '../state.js';
import { closeDetail } from '../components/detail.js';

function clearOutlines() {
    document.querySelectorAll('.log-entry').forEach(el => { el.style.outline = ''; });
    state.focusedEntryIndex = -1;
}

export function initKeyboard() {
    document.addEventListener('keydown', function(e) {
        if (e.target === state.dom.cmdInput || e.target === state.dom.mobileCmdInput) return;
        if (e.key === 'Escape') {
            clearOutlines();
            if (state.openLogId) {
                const entry = document.querySelector('.log-entry[data-log-id="' + state.openLogId + '"]');
                closeDetail(state.openLogId, entry);
            } else if (state.activeFilter || state.activeKeyword) {
                window.executeCommand('/clear');
            }
        } else if (e.key === 'j' || e.key === 'ArrowDown') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
            if (!entries.length) return;
            if (state.focusedEntryIndex < entries.length - 1) {
                if (state.focusedEntryIndex >= 0) entries[state.focusedEntryIndex].style.outline = '';
                state.focusedEntryIndex++;
                entries[state.focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[state.focusedEntryIndex].style.outline = '2px solid var(--green)';
            }
        } else if (e.key === 'k' || e.key === 'ArrowUp') {
            e.preventDefault();
            const entries = document.querySelectorAll('.log-entry');
            if (!entries.length) return;
            if (state.focusedEntryIndex > 0) {
                entries[state.focusedEntryIndex].style.outline = '';
                state.focusedEntryIndex--;
                entries[state.focusedEntryIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                entries[state.focusedEntryIndex].style.outline = '2px solid var(--green)';
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

export { clearOutlines };