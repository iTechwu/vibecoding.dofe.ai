#!/usr/bin/env node
/**
 * 将当前仓库中 git 跟踪的文件导出到 packages/create-dofe-ai/template/
 * 供 create-dofe-ai 在 npx create-dofe-ai xxx 时复制到目标目录。
 *
 * 排除：
 * - packages/create-dofe-ai/*（避免把脚手架生成器自身打进模板）
 * - apps/api/generated/（构建产物）
 *
 * 注意：@dofe/infra-* 包位于独立仓库 infra.dofe.ai，不在本仓库 git 跟踪范围内。
 * 脚手架模板中的 pnpm-workspace.yaml 引用同级 infra.dofe.ai 目录。
 *
 * 使用：在仓库根目录执行
 *   node scripts/export-scaffold-for-create.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_ROOT = path.join(REPO_ROOT, 'packages', 'create-dofe-ai', 'template');
const EXCLUDE_PREFIX = 'packages/create-dofe-ai/';
const EXCLUDE_PATTERNS = [
  'apps/api/generated/',
  'docs/0426/',
  'docs/0427/',
  '.claude/',
  '.cursor/',
  '.mcp.json',
  '.gitignore', // 单独复制为 _gitignore 以避免 npm 发布时被排除
];

function main() {
  process.chdir(REPO_ROOT);

  let list;
  try {
    list = execSync('git ls-files', { encoding: 'utf8' });
  } catch (e) {
    console.error('export-scaffold: git ls-files failed. Run from repository root.');
    process.exit(1);
  }

  // git ls-files wraps non-ASCII filenames in double quotes with octal escapes.
  // Parse each line: if quoted, decode octal \xxx sequences to proper UTF-8 bytes.
  function decodeGitPath(line) {
    if (line.startsWith('"') && line.endsWith('"')) {
      let s = line.slice(1, -1);
      const bytes = [];
      let i = 0;
      while (i < s.length) {
        if (s[i] === '\\' && i + 3 < s.length) {
          const oct = s.substring(i + 1, i + 4);
          if (/^[0-7]{3}$/.test(oct)) {
            bytes.push(parseInt(oct, 8));
            i += 4;
            continue;
          }
        }
        bytes.push(s.charCodeAt(i));
        i++;
      }
      return Buffer.from(bytes).toString('utf-8');
    }
    return line;
  }

  const files = list
    .trim()
    .split(/\n/)
    .map(decodeGitPath)
    .filter((p) => p && !p.startsWith(EXCLUDE_PREFIX) && !EXCLUDE_PATTERNS.some((pat) => p.startsWith(pat)));

  if (files.length === 0) {
    console.warn('export-scaffold: no files to export (or all excluded).');
    return;
  }

  if (fs.existsSync(TEMPLATE_ROOT)) {
    fs.rmSync(TEMPLATE_ROOT, { recursive: true });
  }
  fs.mkdirSync(TEMPLATE_ROOT, { recursive: true });

  let copied = 0;
  for (const rel of files) {
    const src = path.join(REPO_ROOT, rel);
    const dest = path.join(TEMPLATE_ROOT, rel);
    if (!fs.existsSync(src)) {
      console.warn('export-scaffold: skip (missing):', rel);
      continue;
    }
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(src, dest);
    copied++;
  }

  // npm 发布时会自动排除 .gitignore，模板中保存为 _gitignore
  // cli.js 复制到新项目时再改回 .gitignore
  const gitignoreSrc = path.join(REPO_ROOT, '.gitignore');
  const gitignoreDest = path.join(TEMPLATE_ROOT, '_gitignore');
  if (fs.existsSync(gitignoreSrc)) {
    fs.copyFileSync(gitignoreSrc, gitignoreDest);
  }

  // 注入 @dofe/infra-* workspace 引用到模板的 pnpm-workspace.yaml
  const workspaceYamlPath = path.join(TEMPLATE_ROOT, 'pnpm-workspace.yaml');
  if (fs.existsSync(workspaceYamlPath)) {
    let content = fs.readFileSync(workspaceYamlPath, 'utf8');
    if (!content.includes('infra.dofe.ai')) {
      content += "\n  # DofeAI shared infra (development: local path reference)\n  - '../infra.dofe.ai/packages/*'\n";
      fs.writeFileSync(workspaceYamlPath, content);
      console.log('export-scaffold: injected infra workspace reference into pnpm-workspace.yaml');
    }
  }

  console.log('export-scaffold: copied', copied, 'files to packages/create-dofe-ai/template/');
}

main();
