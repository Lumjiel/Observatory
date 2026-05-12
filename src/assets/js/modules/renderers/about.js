// 关于页渲染器
import { state } from '../state.js';
import { showView } from '../router.js';

const VERSION = 'v1.0';

const BUBBLES = [
  '$ whoami\n> 凌晨三点还在 debug 的 CS 大二狗',
  '$ man love\n> No manual entry for love',
  '$ ./run.sh\n> Segmentation fault (core dumped)',
  '$ sudo rm -rf /\n> [sudo] password for Lumjiel: ********\n> 兄弟你别执行这个啊！',
  '$ git push --force\n> Force push accepted. 后果自负。',
  '$ cat README.md\n> README.md: No such file or directory',
  '$ echo "世界上最慢的编译"\n> 正在编译... 预计完成时间：明天',
  '$ npm install\n> added 2333 packages in 47m',
  '$ 能跑。\n> 别问为什么。',
  '$ 注释以后再补。\n> 以后是哪一天？',
];

const ASCII_ROBOT = `
                 _\\  \\_
                  /__|         "Bug? That's not a
              ___//_           bug, that's a
             /      \\              FEATURE."
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
    _______/_/____\\_\\_______________________________`;

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

  container.innerHTML = `
    <div class="about-terminal">
      <div class="about-header">
        <pre class="about-ascii" id="aboutAscii"></pre>
        <div class="about-bubble" id="aboutBubble" style="opacity:0">
          <span class="bubble-prefix">&gt;</span> <span id="aboutBubbleText"></span>
        </div>
      </div>

      <div class="about-body" id="aboutBody" style="display:none">
        <div class="about-section">
          <div class="about-section-title">📡 系统信息</div>
          <div class="about-contacts">
            <div class="about-contact-item">
              <span class="contact-label">操作者</span>
              <span class="contact-value">Lumjiel</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">工作目录</span>
              <span class="contact-value">~/project/terminal-observatory</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">编辑器</span>
              <span class="contact-value">Claude Code</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">状态</span>
              <span class="contact-value" id="aboutStatus">🟢 摸鱼中...</span>
            </div>
            <div class="about-contact-item">
              <span class="contact-label">GitHub</span>
              <a href="https://github.com/${githubUsername}" target="_blank" class="contact-link">
                @${githubUsername}
              </a>
            </div>
          </div>
        </div>

        <div class="about-section">
          <div class="about-section-title">📋 运维记录</div>
          <div class="about-ops">
            ${OPERATIONS.map(op => `<div class="about-op">${op}</div>`).join('')}
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
      </div>
    </div>`;

  showView('about');
  startTypewriter();
  startStatusUpdater();
}

const STATUS_STATES = ['摸鱼中...', '编译中...', 'debug中...', '重构中...', '看文档中...', '喝水中...'];
let statusInterval;

function startStatusUpdater() {
  if (statusInterval) clearInterval(statusInterval);
  const statusEl = document.getElementById('aboutStatus');
  if (!statusEl) return;
  statusInterval = setInterval(() => {
    const state = STATUS_STATES[Math.floor(Math.random() * STATUS_STATES.length)];
    statusEl.textContent = '🟢 ' + state;
  }, 2000);
}

// 打字机效果
function startTypewriter() {
  const asciiEl = document.getElementById('aboutAscii');
  const bubbleEl = document.getElementById('aboutBubble');
  const bubbleTextEl = document.getElementById('aboutBubbleText');
  const bodyEl = document.getElementById('aboutBody');

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
      // ASCII 显示完后，淡入气泡
      bubbleTextEl.textContent = bubbleText;
      bubbleEl.style.transition = 'opacity 0.5s ease';
      bubbleEl.style.opacity = '1';
      // 气泡淡入后，显示下方卡片
      setTimeout(() => {
        if (bodyEl) {
          bodyEl.style.display = 'block';
          bodyEl.style.animation = 'fadeIn 0.5s ease';
        }
      }, 600);
    }
  }

  typeChar();
}