// 移动端导航
import { state } from '../state.js';

let lastScrollY = 0;
let hideTimer;

export function initMobileNav() {
    const { mobileNav } = state.dom;
    if (!mobileNav) return;

    mobileNav.addEventListener('click', function(e) {
        const btn = e.target.closest('button');
        if (btn) {
            const view = btn.dataset.view;
            window.executeCommand(view === 'log' ? 'clear' : view);
        }
    });

    if (window.innerWidth <= 899) {
        window.addEventListener('scroll', onMobileScroll, { passive: true });
    }
    window.addEventListener('beforeunload', () => {
        window.removeEventListener('scroll', onMobileScroll);
        clearTimeout(hideTimer);
    });
}

function onMobileScroll() {
    const currentY = window.scrollY;
    if (Math.abs(currentY - lastScrollY) > 10) {
        state.dom.mobileNav?.classList.add('hidden');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function() {
            state.dom.mobileNav?.classList.remove('hidden');
        }, 1500);
    }
    lastScrollY = currentY;
}