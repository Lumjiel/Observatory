// 提取 git log 生成运维记录
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { ABOUT_JS_PATH } from './utils/paths.mjs';

try {
  const gitLog = execSync(
    'git log --oneline --format="[%ad] %s" --date=short -20',
    { cwd: process.cwd(), encoding: 'utf-8' }
  ).trim();

  const operations = gitLog.split('\n').filter(line => line.trim());

  let content = fs.readFileSync(ABOUT_JS_PATH, 'utf-8');

  const opsString = operations
    .map(op => `  '${op}'`)
    .join(',\n');

  content = content.replace(
    /\/\/ 运维记录\(从 git log 提取[\s\S]*?const OPERATIONS = \[[\s\S]*?\];/,
    `// 运维记录（从 git log 提取，每次 build 时更新）\nconst OPERATIONS = [\n${opsString}\n];`
  );

  fs.writeFileSync(aboutJsPath, content);
  console.log('✅ 运维记录已从 git log 更新');
} catch (err) {
  console.error('❌ 提取 git log 失败:', err.message);
  process.exit(1);
}