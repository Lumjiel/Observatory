// 帮助视图
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderHelp() {
    const container = state.dom.viewContainers.help;
    if (!container) return;

    container.innerHTML = `
        <h2 style="color:var(--green);">📖 可用命令</h2>
        <pre style="color:var(--text); line-height:1.6;">
/filter [category]    筛选：all|tutorials|blog|essays|projects
/grep [关键词]        搜索文章标题和描述
/stats                统计概览
/issues              GitHub 仓库 Issues
/projects             项目列表
/milestones           文章列表
/skills               技能栈
/about                关于
/help                 显示帮助
/clear                清除筛选
/theme [dark|light]   切换主题
/export [txt|json]    导出数据
        </pre>
        <p style="color:var(--text-dim);">快捷键: j/k 移动 | Esc 关闭 | Tab 补全</p>`;

    showView('help');
}