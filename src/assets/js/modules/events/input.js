// 命令输入事件
import { state, saveCommandHistory } from '../state.js';
import { executeCommand } from '../commands.js';

export function initCommandInput() {
    const { cmdInput } = state.dom;
    const { tagCounts } = state;
    if (!cmdInput) return;

    cmdInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const cmd = this.value.trim();
            if (cmd) {
                state.commandHistory.push(cmd);
                if (state.commandHistory.length > 20) state.commandHistory.shift();
                state.historyIndex = state.commandHistory.length;
                saveCommandHistory();
                executeCommand(cmd);
            }
            this.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (state.commandHistory.length && state.historyIndex > 0) {
                state.historyIndex--;
                this.value = state.commandHistory[state.historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (state.historyIndex < state.commandHistory.length - 1) {
                state.historyIndex++;
                this.value = state.commandHistory[state.historyIndex];
            } else {
                state.historyIndex = state.commandHistory.length;
                this.value = '';
            }
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const val = this.value.toLowerCase();
            const commands = ['filter', 'grep', 'status', 'dashboard', 'errors', 'milestones', 'skills', 'neofetch', 'about', 'help', 'clear', 'theme', 'export', '/admin'];
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