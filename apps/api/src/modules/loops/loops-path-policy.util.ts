import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';

export async function resolveAllowedTargetRepo(input: string): Promise<string> {
  const target = path.resolve(input);
  const stat = await fs.stat(target).catch(() => undefined);
  if (!stat?.isDirectory()) {
    throw new Error(`Loop targetRepo is not a directory: ${input}`);
  }

  const allowedRoots = allowedRepoRoots();
  if (!allowedRoots.some((root) => isSameOrChildPath(root, target))) {
    throw new Error(`Loop targetRepo is outside allowed roots: ${target}`);
  }

  return target;
}

export function allowedRepoRoots() {
  const configured = (process.env.LOOPS_ALLOWED_REPO_ROOTS ?? '')
    .split(path.delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
  const roots = configured.length > 0 ? configured : [findWorkspaceRoot()];
  return roots.map((root) => path.resolve(root));
}

function isSameOrChildPath(root: string, target: string) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function findWorkspaceRoot() {
  let current = process.cwd();
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}
