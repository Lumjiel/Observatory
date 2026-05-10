// 帮助视图
import { showView } from '../router.js';

export function renderHelp() {
    const container = state.dom.viewContainers.help;
    if (!container) return;

    container.innerHTML = `
        <h2 style="color:var(--green);">📖 可用命令</h2>
        <pre style="color:var(--text); line-height:1.6;">
filter [all|tutorials|blog|essays|projects]       按分类筛选
grep [关键词]                                    全文搜索
status / dashboard                               打开星系（仪表盘）
errors                                           外部信号（GitHub仓库）
milestones                                       全部文章
projects                                         项目展板
skills / neofetch                                技能树
about                                            系统（关于）
help                                             显示此帮助
clear                                            清除筛选/返回文章流
theme dark|light                                 切换主题
export txt|json                                  导出当前视图
        </pre>
        <p style="color:var(--text-dim);">快捷键: j/k 移动 | Esc 关闭 | / 聚焦搜索 | Tab 补全</p>`;

    showView('help');
}