import fs from 'fs';
import path from 'path';

const LOGS_FILE = path.join('src', '_data', 'logs.json');
const AUTO_FILE = path.join('src', '_data', 'auto-generated.json');

function generateWeeklySummary() {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    let allLogs = [];
    if (fs.existsSync(LOGS_FILE)) {
        try {
            allLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
        } catch (err) {
            console.error(`logs.json 解析失败: ${err.message}`);
        }
    }
    if (fs.existsSync(AUTO_FILE)) {
        try {
            const autoLogs = JSON.parse(fs.readFileSync(AUTO_FILE, 'utf-8'));
            allLogs = allLogs.concat(autoLogs);
        } catch (err) {
            console.error(`auto-generated.json 解析失败: ${err.message}`);
        }
    }

    const weekLogs = allLogs.filter(l => new Date(l.timestamp) >= weekAgo);

    if (weekLogs.length === 0) {
        console.log('本周没有日志记录。');
        return;
    }

    const typeCounts = {};
    weekLogs.forEach(l => { typeCounts[l.type] = (typeCounts[l.type] || 0) + 1; });

    const totalHours = weekLogs.reduce((sum, l) => {
        const match = l.duration ? l.duration.match(/(\d+(?:\.\d+)?)h/) : null;
        return sum + (match ? parseFloat(match[1]) : 1);
    }, 0);

    const topTags = {};
    weekLogs.forEach(l => l.tags.forEach(t => { topTags[t] = (topTags[t] || 0) + 1; }));
    const topTagsSorted = Object.entries(topTags).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const startDate = weekAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    const summaryId = 'summary_' + startDate + '_' + endDate;

    const summary = {
        id: summaryId,
        timestamp: now.toISOString(),
        type: 'SUMMARY',
        description: `周报 (${startDate} ~ ${endDate})`,
        tags: ['周报', '自动生成'],
        status: 'done',
        detail: generateSummaryDetail(weekLogs, typeCounts, totalHours, topTagsSorted),
        related: weekLogs.slice(0, 5).map(l => l.id),
        weekStats: {
            totalLogs: weekLogs.length,
            totalHours: Math.round(totalHours * 10) / 10,
            typeCounts,
            topTags: topTagsSorted.map(([tag]) => tag),
        }
    };

    let autoLogs = [];
    if (fs.existsSync(AUTO_FILE)) {
        try {
            autoLogs = JSON.parse(fs.readFileSync(AUTO_FILE, 'utf-8'));
        } catch (err) {
            console.error(`auto-generated.json 解析失败: ${err.message}`);
            autoLogs = [];
        }
    }

    const existingSummary = autoLogs.find(l => l.id === summaryId);
    if (!existingSummary) {
        autoLogs.push(summary);
        fs.writeFileSync(AUTO_FILE, JSON.stringify(autoLogs, null, 2));
        console.log(`已生成本周周报: ${summary.description}`);
    } else {
        console.log('本周周报已存在。');
    }
}

function generateSummaryDetail(weekLogs, typeCounts, totalHours, topTags) {
    let detail = `<h2>📊 本周学习总结</h2>`;
    detail += `<p>本周共记录 <strong>${weekLogs.length}</strong> 条日志，总学习时长约 <strong>${totalHours}h</strong>。</p>`;
    detail += `<h3>类型分布</h3><ul>`;
    for (const [type, count] of Object.entries(typeCounts)) {
        detail += `<li>[${type}] ${count} 条</li>`;
    }
    detail += `</ul>`;
    detail += `<h3>活跃标签</h3><p>${topTags.map(([tag]) => '#' + tag).join(' ')}</p>`;
    detail += `<h3>本周亮点</h3><ul>`;
    const milestones = weekLogs.filter(l => l.type === 'MILESTONE');
    if (milestones.length > 0) {
        milestones.forEach(m => { detail += `<li>★ ${m.description}</li>`; });
    }
    const builds = weekLogs.filter(l => l.type === 'BUILD');
    if (builds.length > 0) {
        builds.forEach(b => { detail += `<li>🛠️ ${b.description}</li>`; });
    }
    detail += `</ul>`;
    return detail;
}

generateWeeklySummary();
