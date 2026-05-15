import { state, setCurrentView } from './state.js';
import { renderLogStream } from './renderers/logStream.js';
import { renderDashboard } from './renderers/dashboard.js';
import { renderErrors } from './renderers/errors.js';
import { renderMilestones } from './renderers/milestones.js';
import { renderAbout } from './renderers/about.js';
import { renderHelp } from './renderers/help.js';

export const ROUTES = {
    'dashboard': renderDashboard,
    'errors': renderErrors,
    'milestones': renderMilestones,
    'about': renderAbout,
    'help': renderHelp,
};

export function showView(viewName) {
    const { viewContainers, mobileNav } = state.dom;
    Object.keys(viewContainers).forEach(v => viewContainers[v].classList.remove('active'));
    if (viewContainers[viewName]) viewContainers[viewName].classList.add('active');
    setCurrentView(viewName);
    document.body.classList.toggle('view-log-active', viewName === 'log');
    mobileNav?.querySelectorAll('button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    window.location.hash = viewName === 'log' ? '' : viewName;
}

export function handleHashRoute() {
    const hash = window.location.hash.slice(1);
    if (!hash) {
        renderLogStream();
        showView('log');
        return;
    }
    const renderFn = ROUTES[hash];
    if (renderFn) {
        renderFn();
    } else {
        renderLogStream();
        showView('log');
        return;
    }
    showView(hash);
}