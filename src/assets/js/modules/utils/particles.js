// 粒子效果
export function generateParticles() {
    const container = document.getElementById('particleLayer');
    if (!container) return;
    container.innerHTML = '';
    const count = window.innerWidth < 768 ? 20 : 40;
    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = Math.random() * 100 + '%';
        p.style.top = Math.random() * 100 + '%';
        p.style.animationDelay = Math.random() * 12 + 's';
        p.style.animationDuration = (12 + Math.random() * 8) + 's';
        container.appendChild(p);
    }
}