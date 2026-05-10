// 路由配置
import { state, setCurrentView } from './state.js';

const ROUTES = {
    'dashboard': 'renderDashboard',
    'errors': 'renderErrors',
    'milestones': 'renderMilestones',
    'projects': 'renderProjects',
    'skills': 'renderSkillsView',
    'about': 'renderAbout',
    'help': 'renderHelp',
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

export function handleHashRoute(renderers) {
    const hash = window.location.hash.slice(1);
    if (!hash) {
        renderers.renderLogStream();
        showView('log');
        return;
    }
    const renderFn = ROUTES[hash];
    if (renderFn && renderers[renderFn]) {
        renderers[renderFn]();
    } else {
        renderers.renderLogStream();
        showView('log');
        return;
    }
    showView(hash);
}

window.addEventListener('hashchange', () => {
    // Rebind will happen in app.js
});