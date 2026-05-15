// 帮助视图
import { state } from '../state.js';
import { showView } from '../router.js';

export function renderHelp() {
    const container = state.dom.viewContainers.help;
    if (!container) return;

    container.innerHTML = `
        <h2 style="color:var(--green);">📖 可用命令</h2>
        <pre style="color:var(--text); line-height:1.6;">
/search [关键词]     搜索文章
/filter [category]   筛选分类：all|tutorials|blog|essays|projects
/dashboard           统计仪表盘
/github              GitHub 仓库
/list                全部文章
/about               关于系统
/help                显示帮助
/clear               清除筛选
/theme [dark|light]  切换主题
/export [txt|json]   导出数据
/admin               管理面板
        </pre>
        <p style="color:var(--text-dim);">快捷键: j/k 移动 | Esc 关闭 | Tab 补全</p>`;

    showView('help');
}
