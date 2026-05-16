import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import chokidar from 'chokidar';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function run(script, label) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script], { cwd: ROOT, stdio: 'inherit', shell: true });
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(`${label} failed (exit ${code})`)));
    child.on('error', reject);
  });
}

async function initialBuild() {
  console.log('\n[dev] 初始构建...\n');
  await run('scripts/build-js.mjs', 'JS');
  await run('scripts/build-css.mjs', 'CSS');
  await run('scripts/article-scanner.mjs', 'Scanner');
  await run('scripts/github-scraper.mjs', 'GitHub');
}

function startEleventy() {
  const child = spawn('npx', ['eleventy', '--serve'], { cwd: ROOT, stdio: 'inherit', shell: true });
  child.on('error', (err) => console.error('[dev] Eleventy 启动失败:', err.message));
  return child;
}

function startWatcher() {
  const watcher = chokidar.watch([
    path.join(ROOT, 'src', 'assets', 'js'),
    path.join(ROOT, 'src', 'assets', 'css'),
  ], {
    ignoreInitial: true,
    persistent: true,
    ignored: [
      '**/bundle.js',
      '**/bundle.js.map',
      '**/admin-panel.bundle.js',
      '**/admin-panel.bundle.js.map',
    ],
  });

  let timer = null;
  let pendingType = null;

  watcher.on('all', (event, filePath) => {
    const rel = path.relative(ROOT, filePath);
    const type = rel.startsWith('src/assets/js') ? 'js' : 'css';
    pendingType = type;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      console.log(`[dev] 检测到变化: ${rel}`);
      try {
        if (pendingType === 'js') {
          await run('scripts/build-js.mjs', 'JS');
        } else {
          await run('scripts/build-css.mjs', 'CSS');
        }
        console.log('[dev] 重建完成，等待浏览器刷新...\n');
      } catch (e) {
        console.error('[dev] 重建失败:', e.message);
      }
    }, 300);
  });

  return watcher;
}

try {
  await initialBuild();
  console.log('\n[dev] 初始构建完成，启动开发服务器...\n');
  const eleventy = startEleventy();
  const watcher = startWatcher();

  process.on('SIGINT', () => {
    console.log('\n[dev] 正在关闭...');
    watcher.close();
    eleventy.kill();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    watcher.close();
    eleventy.kill();
    process.exit(0);
  });
} catch (e) {
  console.error('[dev] 构建失败:', e.message);
  process.exit(1);
}