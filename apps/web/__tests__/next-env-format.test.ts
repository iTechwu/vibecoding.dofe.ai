import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('next-env.d.ts generated format', () => {
  it('matches the Next dev output that should remain committed', () => {
    const content = readFileSync(join(process.cwd(), 'next-env.d.ts'), 'utf8');

    expect(content).toBe(`/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/dev/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`);
  });
});
