import { state, setActiveFilter, setActiveKeyword, clearFilterCache } from './state.js';
import { playClickSound } from './utils/audio.js';
import { renderLogStream } from './renderers/logStream.js';
import { renderDashboard } from './renderers/dashboard.js';
import { renderErrors } from './renderers/errors.js';
import { renderMilestones } from './renderers/milestones.js';
import { renderProjects } from './renderers/projects.js';
import { renderSkillsView } from './renderers/skills.js';
import { renderAbout } from './renderers/about.js';
import { renderHelp } from './renderers/help.js';
import { renderFilterChips } from './components/filterChips.js';
import { showView } from './router.js';

const VALID_CATEGORIES = ['all', 'tutorials', 'blog', 'essays', 'projects'];

const commands = {
    '/filter'(arg) {
        const cat = arg.toLowerCase();
        if (!VALID_CATEGORIES.includes(cat)) return;
        clearFilterCache();
        setActiveFilter(cat === 'all' ? null : cat);
        setActiveKeyword(null);
        renderLogStream(state.activeFilter);
        renderFilterChips();
                showView('log');
    },

    '/grep'(arg) {
        if (!arg) return;
        clearFilterCache();
        setActiveKeyword(arg);
        setActiveFilter(null);
        renderLogStream(null, arg);
        renderFilterChips();
        showView('log');
    },

    '/stats'() { renderDashboard(); },
    '/issues'() { renderErrors(); },
    '/milestones'() { renderMilestones(); },
    '/projects'() { renderProjects(); },

    '/skills'() { renderSkillsView(); },

    '/about'() { renderAbout(); },
    '/help'() { renderHelp(); },

    '/clear'() {
        clearFilterCache();
        setActiveFilter(null);
        setActiveKeyword(null);
        renderLogStream();
        renderFilterChips();
                showView('log');
    },

    '/theme'(arg) {
        if (arg === 'dark') {
            document.body.classList.remove('light');
            localStorage.setItem('terminal-theme', 'dark');
        } else if (arg === 'light') {
            document.body.classList.add('light');
            localStorage.setItem('terminal-theme', 'light');
        }
    },

    '/export'(arg) {
        const data = state.activeFilter
            ? state.feed.filter(l => l.typeLabel === state.activeFilter)
            : state.feed;
        if (arg === 'json') {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'articles-export.json';
            a.click();
        } else {
            const text = data.map(l => `[${l.typeLabel}] ${l.timestamp} ${l.description}`).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            a.download = 'articles-export.txt';
            a.click();
        }
    },

    '/admin'() {
        window.location.href = '/admin';
    }
};

export function executeCommand(cmdStr) {
    playClickSound();
    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    const handler = commands[cmd];
    if (handler) {
        handler(arg);
    } else if (cmdStr.trim()) {
        const suggestion = findSimilar(cmd);
        showError('Error: ' + cmd + ' not found.', suggestion);
    }
}

function showError(msg, suggestion) {
    // 移除之前的错误输出
    const prev = document.querySelector('.cmd-error-output');
    if (prev) prev.remove();

    const errorEl = document.createElement('div');
    errorEl.className = 'cmd-error-output';
    errorEl.style.cssText = 'margin-top:0.5rem;padding:0.4rem 0.6rem;background:rgba(255,60,60,0.08);border-left:2px solid #FF4444;color:#FF4444;font-family:var(--font-mono);font-size:0.8rem;line-height:1.4;';
    errorEl.innerHTML = msg + (suggestion ? `<br><span style="color:#00E5A0;cursor:pointer;" onclick="executeCommand('${suggestion}');this.closest('.cmd-error-output').remove();">→ Did you mean: ${suggestion}?</span>` : '');

    const cmdArea = document.querySelector('.command-area') || document.querySelector('.mobile-cmd-area');
    if (cmdArea) {
        cmdArea.style.marginBottom = '0';
        cmdArea.insertAdjacentElement('afterend', errorEl);
    }

    setTimeout(() => errorEl.remove(), 3000);
}

function findSimilar(cmd) {
    const cmds = Object.keys(commands);
    for (const c of cmds) {
        if (c.slice(1).startsWith(cmd.slice(1)) || cmd.slice(1).startsWith(c.slice(1))) {
            return c;
        }
    }
    return null;
}

window.executeCommand = executeCommand;