import { existsSync } from 'fs';
import * as path from 'path';

/**
 * Resolve the Loops workspace root (the directory that owns `.loops/`).
 *
 * Mirrors `LoopsFileStoreService.findWorkspaceRoot` so `.loops/runtime/profile.json`
 * lands next to `.loops/issues` regardless of which detector is used. The file
 * store honours `LOOPS_WORKSPACE_ROOT` and otherwise walks up for a directory
 * containing both `package.json` and `turbo.json`.
 */
export function findLoopsWorkspaceRoot(): string {
  let current = process.env.LOOPS_WORKSPACE_ROOT || process.cwd();
  for (;;) {
    const packageJson = path.join(current, 'package.json');
    const turboJson = path.join(current, 'turbo.json');
    try {
      if (existsSync(packageJson) && existsSync(turboJson)) {
        return current;
      }
    } catch {
      return process.cwd();
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return process.env.LOOPS_WORKSPACE_ROOT || process.cwd();
    }
    current = parent;
  }
}

/** The `.loops` directory that is the source of truth for issues + runtime. */
export function resolveLoopsRoot(): string {
  return path.join(findLoopsWorkspaceRoot(), '.loops');
}

/** `.loops/runtime` — workspace profile + per-agent config/cache roots. */
export function resolveLoopsRuntimeDir(): string {
  return path.join(resolveLoopsRoot(), 'runtime');
}

/** `.loops/runtime/profile.json` — the workspace runtime profile. */
export function resolveLoopsRuntimeProfilePath(): string {
  return path.join(resolveLoopsRuntimeDir(), 'profile.json');
}
