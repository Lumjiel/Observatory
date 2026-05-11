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
    filter(arg) {
        const cat = arg.toLowerCase();
        if (!VALID_CATEGORIES.includes(cat)) return;
        clearFilterCache();
        setActiveFilter(cat === 'all' ? null : cat);
        setActiveKeyword(null);
        renderLogStream(state.activeFilter);
        renderFilterChips();
                showView('log');
    },

    grep(arg) {
        if (!arg) return;
        clearFilterCache();
        setActiveKeyword(arg);
        setActiveFilter(null);
        renderLogStream(null, arg);
        renderFilterChips();
        showView('log');
    },

    stats() { renderDashboard(); },
    dashboard() { renderDashboard(); },

    repo() { renderErrors(); },
    errors() { renderErrors(); },
    milestones() { renderMilestones(); },
    projects() { renderProjects(); },

    skills() { renderSkillsView(); },
    neofetch() { renderSkillsView(); },

    about() { renderAbout(); },
    help() { renderHelp(); },

    clear() {
        clearFilterCache();
        setActiveFilter(null);
        setActiveKeyword(null);
        renderLogStream();
        renderFilterChips();
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
    }
}

window.executeCommand = executeCommand;