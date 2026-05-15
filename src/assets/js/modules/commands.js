import { state, setActiveFilter, setActiveKeyword, clearFilterCache } from './state.js';
import { playClickSound } from './utils/audio.js';
import { renderLogStream } from './renderers/logStream.js';
import { renderDashboard } from './renderers/dashboard.js';
import { renderErrors } from './renderers/errors.js';
import { renderMilestones } from './renderers/milestones.js';
import { renderAbout } from './renderers/about.js';
import { renderHelp } from './renderers/help.js';
import { renderFilterChips } from './components/filterChips.js';
import { renderSignalOverview } from './components/signalOverview.js';
import { showView } from './router.js';

const VALID_CATEGORIES = ['all', 'tutorials', 'blog', 'essays', 'projects'];

const KNOWN_COMMANDS = ['/search', '/grep', '/filter', '/dashboard', '/stats', '/github', '/issues', '/list', '/articles', '/about', '/help', '/clear', '/theme', '/export', '/admin'];

const commands = {
    filter(arg) {
        const cat = arg.toLowerCase();
        if (!VALID_CATEGORIES.includes(cat)) return;
        clearFilterCache();
        setActiveFilter(cat === 'all' ? null : cat);
        setActiveKeyword(null);
        renderLogStream(state.activeFilter);
        renderFilterChips();
        renderSignalOverview();
        showView('log');
    },

    // /search 和 /grep 都走这里
    grep(arg) {
        if (!arg) return;
        clearFilterCache();
        setActiveKeyword(arg);
        setActiveFilter(null);
        renderLogStream(null, arg);
        renderFilterChips();
        showView('log');
    },

    search(arg) {
        commands.grep(arg);
    },

    dashboard() { renderDashboard(); },
    stats() { renderDashboard(); },

    github() { renderErrors(); },
    issues() { renderErrors(); },

    list() { renderMilestones(); },
    articles() { renderMilestones(); },

    about() { renderAbout(); },
    help() { renderHelp(); },

    clear() {
        clearFilterCache();
        setActiveFilter(null);
        setActiveKeyword(null);
        renderLogStream();
        renderFilterChips();
        renderSignalOverview();
        showView('log');
    },

    theme(arg) {
        if (arg === 'dark') {
            document.body.classList.remove('light');
            localStorage.setItem('terminal-theme', 'dark');
        } else if (arg === 'light') {
            document.body.classList.add('light');
            localStorage.setItem('terminal-theme', 'light');
        }
    },

    export(arg) {
        const data = state.activeFilter
            ? state.feed.filter(l => l.typeLabel === state.activeFilter)
            : state.feed;
        if (arg === 'json') {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'articles-export.json';
            a.click();
            URL.revokeObjectURL(a.href);
        } else {
            const text = data.map(l => `[${l.typeLabel}] ${l.timestamp} ${l.description}`).join('\n');
            const blob = new Blob([text], { type: 'text/plain' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'articles-export.txt';
            a.click();
            URL.revokeObjectURL(a.href);
        }
    },

    admin() {
        window.location.href = '/admin';
    }
};

function showCommandError(cmd) {
    const el = document.getElementById('cmdError');
    if (!el) return;
    const suggestions = KNOWN_COMMANDS.filter(c => c.startsWith('/' + cmd[0]) || c.includes(cmd));
    let msg = `未知命令 "${cmd}"`;
    if (suggestions.length) {
        msg += `。试试: ${suggestions.slice(0, 3).join(', ')}`;
    }
    el.textContent = '⚠ ' + msg;
    el.classList.add('show');
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('show'), 3000);
}

export function executeCommand(cmdStr) {
    playClickSound();
    // 清除上次的错误提示
    const errEl = document.getElementById('cmdError');
    if (errEl) errEl.classList.remove('show');

    const parts = cmdStr.trim().split(/\s+/);
    let cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd.startsWith('/')) cmd = cmd.slice(1);

    const handler = commands[cmd];
    if (handler) {
        handler(arg);
    } else {
        showCommandError(parts[0].toLowerCase() || cmd);
    }
}

window.executeCommand = executeCommand;
