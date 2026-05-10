// 关于页渲染器
import { state } from '../state.js';
import { showView } from '../router.js';
import { formatUptime } from '../utils/text.js';

const ASCII_LINES = [
    '                    _\\  \\_                             ',
    '                     /__|         "Bug? That\'s not a    ',
    '                 ___//_           bug, that\'s a          ',
    '                /      \\              FEATURE."         ',
    '               /        /\\                              ',
    '              / /\\     \\/  )                           ',
    '              \\_\\|     |  /                            ',
    '               (_      |\\/                              ',
    '                 |     |                                 ',
    '                 |_    |                                 ',
    '                  /   |                                  ',
    '                 / /| |                                  ',
    '                /_/ |_|                                  ',
    '               /|    /\\                                 ',
    '      _______/_/____\\_\\______________________________________________________ ',
];

const TYPE_MAP = { tutorials: 'INFO', blog: 'READ', essays: 'READ', projects: 'BUILD' };

export function renderAbout() {
    const container = state.dom.viewContainers.about;
    if (!container) return;

    const siteData = window.SITE_DATA || {};
    const author = siteData.author || '[操作员代号]';
    const location = siteData.location || '未知地点';
    const hostname = window.location.hostname || 'observatory.local';
    const uptime = formatUptime();
    const { feed } = state;
    const total = feed.length;
    const published = feed.filter(a => a.status === 'done').length;
    const unpublished = feed.filter(a => a.status !== 'done').length;
    const healthPercent = total > 0 ? Math.round((published / total) * 100) : 100;
    const barLen = 10;
    const filled = Math.round((healthPercent / 100) * barLen);
    const healthBar = '█'.repeat(filled) + '░'.repeat(barLen - filled);

    const recentSignals = [...feed]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
        .map(a => ({
            date: a.timestamp.slice(0, 10),
            type: TYPE_MAP[a.typeLabel] || 'READ',
            msg: a.description
        }));

    const currentTargets = [...feed]
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
        .map(a => a.description);

    const mkSection = (title, icon, color, items) => `
        <div class="about-section">
            <div class="about-section-title" style="color:var(--${color});">${icon} ${title}</div>
            ${items.map(t => `<div class="about-row"><span class="about-label">${t.label}</span><span class="about-value">${t.value}</span></div>`).join('')}
        </div>`;

    const mkListSection = (title, icon, color, items) => `
        <div class="about-section">
            <div class="about-section-title" style="color:var(--${color});">${icon} ${title}</div>
            ${items.map(t => `<div class="about-list-item">${t}</div>`).join('')}
        </div>`;

    const sysSection = mkSection('系统信息', '🖥️', 'green', [
        { label: '主机名', value: hostname },
        { label: '操作员', value: author },
        { label: '观测位置', value: location }
    ]);

    const runSection = mkSection('实时运行数据', '📊', 'amber', [
        { label: '运行时间', value: uptime },
        { label: '接收信号', value: total + '条' },
        { label: '已解码', value: published + '条' },
        { label: '未解决', value: unpublished + '条' },
        { label: '系统健康度', value: healthBar + ' ' + healthPercent + '%' }
    ]);

    const moduleSection = mkSection('活跃模块状态', '⚙️', 'blue', [
        { label: '日志接收器', value: '🟢 正常' },
        { label: '信号分析仪', value: '🟢 正常' },
        { label: '项目追踪器', value: '🟢 正常' },
        { label: '错误复盘器', value: unpublished > 0 ? '🟡 ' + unpublished + '条未解决' : '🟢 正常' }
    ]);

    const signalSection = mkListSection('近期信号事件', '📡', 'green', recentSignals.map(s => `[${s.date}] ${s.type} ${s.msg}`));
    const targetSection = mkListSection('当前观测目标', '🎯', 'magenta', currentTargets.map(t => '▸ ' + t));

    container.innerHTML = `
        <div class="about-layout">
            <div class="about-ascii">
                <pre id="aboutAsciiPre" style="color:var(--green);line-height:1.4;font-size:0.7rem;"></pre>
            </div>
            <div class="about-info hidden">
                ${sysSection}${runSection}${moduleSection}${signalSection}${targetSection}
                <div class="about-footer">
                    <span>观测仍在继续。下个信号随时出现。</span>
                    <span style="color:var(--text-dim);">$ _</span>
                </div>
            </div>
        </div>`;

    showView('about');

    // 打字机效果
    const asciiPre = document.getElementById('aboutAsciiPre');
    if (asciiPre) {
        const fullText = ASCII_LINES.join('\n') + '\n';
        let charIdx = 0;
        asciiPre.textContent = '';
        const typeChar = () => {
            if (charIdx < fullText.length) {
                asciiPre.textContent += fullText[charIdx];
                charIdx++;
                setTimeout(typeChar, 8);
            } else {
                setTimeout(() => {
                    const info = document.querySelector('.about-info.hidden');
                    if (info) info.classList.remove('hidden');
                }, 300);
            }
        };
        typeChar();
    }
}