// 关于页渲染器
import { state } from '../state.js';
import { showView } from '../router.js';

const VERSION = 'v1.0';

const BUBBLES = [
  '"Code is like humor. When you have to explain it, it\'s bad." — Cory House',
  '"First, solve the problem. Then, write the code." — John Johnson',
  '"Talk is cheap. Show me the code." — Linus Torvalds',
  '"程序员的三大谎言：我明天就改、注释以后补、这是别人的bug"',
  '"Stay hungry, stay foolish." — Steve Jobs',
  '"The best way to predict the future is to invent it." — Alan Kay',
  '"Premature optimization is the root of all evil." — Donald Knuth',
  '"Any fool can write code that a computer can understand. Good programmers write code that humans can understand." — Martin Fowler',
  '"程序员的思维：能跑就行，改什么改"',
  '"调试三件套：print、print、print"',
];

const ASCII_ROBOT = `╔══════════════════════════╗
║   BUILD SUCCESSFUL      ║
║   observatory ${VERSION}         ║
╚══════════════════════════╝

     _______________________
    < "Bug? That's not a   >
    <  bug, that's a       >
    <  FEATURE."           >
     -----------------------
          \\    ___
           \\  _\\_  \\__
            \\ /__|
             \\___//_
             /      \\
            /        /\\
           / /\\     \\/  )
           \\_\\|     |  /
            (_      |\\/
              |     |
              |_    |
               /   |
              / /| |
             /_/ |_|
            /|    /\\
  _______/_/____\\_\\_______`;

// 运维记录（从 git log 提取，每次 build 时更新）
const OPERATIONS = [
  '[2026-05-11] refactor: 移除信号卡片，修复 Spring 文章解析',
  '[2026-05-10] docs: 完善 README',
  '[2026-05-10] chore: 移除设计文档.md',
  '[2026-05-10] ci: 升级 Node.js 到 v22 避免 2026 年deprecated警告',
  '[2026-05-10] refactor: 拆分 views.js 为独立模块',
  '[2026-05-10] security: 修复 article-api.mjs 安全漏洞',
  '[2026-05-10] feat: 文章管理模块7项优化',
  '[2026-05-10] fix: article-api 保存后触发 Eleventy 重建静态站点',
];

export function renderAbout() {
  const container = state.dom.viewContainers.about;
  if (!container) return;

  const siteData = window.SITE_DATA || {};
  const githubUsername = siteData.githubUsername || 'Lumjiel';
  const githubUrl = `https://github.com/${githubUsername}`;

  container.innerHTML = `
    <div class="about-terminal">
      <div class="about-header">
        <pre class="about-ascii" id="aboutAscii"></pre>
        <div class="about-bubble" id="aboutBubble" style="opacity:0">
          <span class="bubble-prefix">&gt;</span> <span id="aboutBubbleText"></span>
        </div>
      </div>

      <div class="about-section">
        <div class="about-section-title">📋 运维记录</div>
        <div class="about-ops">
          ${OPERATIONS.map(op => `<div class="about-op">${op}</div>`).join('')}
        </div>
      </div>

      <div class="about-section">
        <div class="about-section-title">📡 外部信号源</div>
        <div class="about-external">
          <span>📡 探测到活跃构造体：</span>
          <a href="${githubUrl}" target="_blank" class="about-github-link">
            github.com/${githubUsername}
          </a>
        </div>
      </div>

      <div class="about-footer">
        <div class="about-maintainer">
          > 维护者：CS大二在读 / 后端方向 / 凌晨编译爱好者
        </div>
        <div class="about-status">
          > 状态：存活，仍在输出信号
        </div>
        <div class="about-quit">
          > 观测仍在继续。下一个信号随时会出现。
        </div>
        <span class="about-cursor">$ _</span>
      </div>
    </div>`;

  showView('about');
  startTypewriter();
}

// 打字机效果
function startTypewriter() {
  const asciiEl = document.getElementById('aboutAscii');
  const bubbleEl = document.getElementById('aboutBubble');
  const bubbleTextEl = document.getElementById('aboutBubbleText');

  if (!asciiEl || !bubbleEl || !bubbleTextEl) return;

  const fullText = ASCII_ROBOT;
  const bubbleText = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];

  let charIdx = 0;

  function typeChar() {
    if (charIdx < fullText.length) {
      asciiEl.textContent += fullText[charIdx];
      charIdx++;
      setTimeout(typeChar, 6);
    } else {
      // ASCII 显示完后，淡入气泡并显示文字
      bubbleTextEl.textContent = bubbleText;
      bubbleEl.style.transition = 'opacity 0.5s ease';
      bubbleEl.style.opacity = '1';
    }
  }

  typeChar();
}