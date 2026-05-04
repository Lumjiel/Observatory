import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const LOGS_FILE = path.join('src', '_data', 'logs.json');
const AUTO_FILE = path.join('src', '_data', 'auto-generated.json');

const TYPE_MAP = {
    '[LOG]': 'INFO',
    '[READ]': 'READ',
    '[BUILD]': 'BUILD',
    '[ERROR]': 'ERROR',
    '[THINK]': 'THINK',
};

function parseGitLogs() {
    try {
        const gitLog = execSync(
            'git log --pretty=format:"%H|%aI|%s" --since="7 days ago"',
            { encoding: 'utf-8' }
        );

        if (!gitLog.trim()) {
            console.log('没有新的 Git 提交。');
            return;
        }

        const commits = gitLog.split('\n').filter(Boolean);
        const newLogs = [];

        for (const line of commits) {
            const [hash, timestamp, message] = line.split('|');

            for (const [prefix, type] of Object.entries(TYPE_MAP)) {
                if (message.startsWith(prefix)) {
                    const description = message.slice(prefix.length).trim();
                    const id = 'auto_' + hash.slice(0, 8) + '_' + Date.now();

                    newLogs.push({
                        id,
                        timestamp,
                        type,
                        description,
                        tags: ['auto-generated', 'git'],
                        status: 'done',
                        detail: `Git 提交: ${message}\n\nCommit: ${hash}`,
                        related: [],
                        commit: hash,
                    });
                    break;
                }
            }
        }

        if (newLogs.length === 0) {
            console.log('没有找到匹配的提交消息。');
            return;
        }

        let existingLogs = [];
        if (fs.existsSync(LOGS_FILE)) {
            existingLogs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf-8'));
        }

        let autoLogs = [];
        if (fs.existsSync(AUTO_FILE)) {
            autoLogs = JSON.parse(fs.readFileSync(AUTO_FILE, 'utf-8'));
        }

        const existingIds = new Set([...existingLogs, ...autoLogs].map(l => l.id));
        const uniqueNewLogs = newLogs.filter(l => !existingIds.has(l.id));

        if (uniqueNewLogs.length > 0) {
            autoLogs.push(...uniqueNewLogs);
            fs.writeFileSync(AUTO_FILE, JSON.stringify(autoLogs, null, 2));
            console.log(`已添加 ${uniqueNewLogs.length} 条自动日志。`);
        } else {
            console.log('没有新的日志需要添加。');
        }
    } catch (error) {
        console.error('Git 解析失败:', error.message);
    }
}

parseGitLogs();
