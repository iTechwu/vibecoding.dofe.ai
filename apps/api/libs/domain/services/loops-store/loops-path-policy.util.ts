import * as path from 'path';
import {
  findWorkspaceRoot,
  resolveAllowedTargetPath,
  resolveConfiguredRoots,
} from '@dofe/infra-workspace';

export async function resolveAllowedTargetRepo(input: string): Promise<string> {
  try {
    return await resolveAllowedTargetPath({
      input: path.resolve(input),
      allowedRoots: allowedRepoRoots(),
      directoryOnly: true,
      fieldName: 'Loop targetRepo',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('not a directory')) {
      throw new Error(`Loop targetRepo is not a directory: ${input}`, { cause: error });
    }
    if (message.includes('outside allowed roots')) {
      throw new Error(`Loop targetRepo is outside allowed roots: ${path.resolve(input)}`, {
        cause: error,
      });
    }
    throw error;
  }
}

export function allowedRepoRoots() {
  return resolveConfiguredRoots(
    process.env.LOOPS_ALLOWED_REPO_ROOTS,
    findWorkspaceRoot(),
    path.delimiter,
  );
}
