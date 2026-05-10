// 命令执行器
import { state, setActiveFilter, setActiveKeyword, clearFilterCache } from './state.js';
import { playClickSound } from './utils/audio.js';

// 渲染器通过 setRenderers 注入
let renderers = {};

export function setRenderers(r) {
    renderers = r;
}

export function executeCommand(cmdStr) {
    playClickSound();
    const parts = cmdStr.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ');

    if (cmd === 'filter') {
        const cat = arg.toLowerCase();
        if (['all', 'tutorials', 'blog', 'essays', 'projects'].includes(cat)) {
            clearFilterCache();
            setActiveFilter(cat === 'all' ? null : cat);
            setActiveKeyword(null);
            renderers.renderLogStream?.(state.activeFilter);
            renderers.renderFilterChips?.();
            renderers.renderSignalOverview?.();
            renderers.showView?.('log');
        }
    } else if (cmd === 'grep') {
        if (arg) {
            clearFilterCache();
            setActiveKeyword(arg);
            setActiveFilter(null);
            renderers.renderLogStream?.(null, arg);
            renderers.renderFilterChips?.();
            renderers.showView?.('log');
        }
    } else if (cmd === 'status' || cmd === 'dashboard') {
        renderers.renderDashboard?.();
    } else if (cmd === 'errors') {
        renderers.renderErrors?.();
    } else if (cmd === 'milestones') {
        renderers.renderMilestones?.();
    } else if (cmd === 'projects') {
        renderers.renderProjects?.();
    } else if (cmd === 'skills' || cmd === 'neofetch') {
        renderers.renderSkillsView?.();
    } else if (cmd === 'about') {
        renderers.renderAbout?.();
    } else if (cmd === 'help') {
        renderers.renderHelp?.();
    } else if (cmd === 'clear') {
        clearFilterCache();
        setActiveFilter(null);
        setActiveKeyword(null);
        renderers.renderLogStream?.();
        renderers.renderFilterChips?.();
        renderers.renderSignalOverview?.();
        renderers.showView?.('log');
    } else if (cmd === 'theme') {
        if (arg === 'dark') {
            document.body.classList.remove('light');
            localStorage.setItem('terminal-theme', 'dark');
        } else if (arg === 'light') {
            document.body.classList.add('light');
            localStorage.setItem('terminal-theme', 'light');
        }
    } else if (cmd === 'export') {
        const data = state.activeFilter ? state.feed.filter(l => l.typeLabel === state.activeFilter) : state.feed;
        if (arg === 'json') {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'articles-export.json';
            a.click();
        } else {
            const text = data.map(l => '[' + l.typeLabel + '] ' + l.timestamp + ' ' + l.description).join('\n');
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
            a.download = 'articles-export.txt';
            a.click();
        }
    } else if (cmd === '/admin') {
        window.location.href = '/admin';
    }
}

window.executeCommand = executeCommand;