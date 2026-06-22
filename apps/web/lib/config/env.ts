import { z } from 'zod';

const frontendEnvSchema = z.object({
  NEXT_PUBLIC_SERVER_BASE_URL: z.string().default('http://localhost:13100'),
  NEXT_PUBLIC_API_VERSION: z.string().optional(),
  NEXT_PUBLIC_APP_BUILD: z.string().optional(),
  NEXT_PUBLIC_BRAND_NAME: z.string().default('Dofe.AI'),
  NEXT_PUBLIC_BRAND_LOGO: z.string().optional(),
  NEXT_PUBLIC_BRAND_TITLE: z.string().optional(),
  NEXT_PUBLIC_BRAND_DESCRIPTION: z.string().optional(),
});

export type FrontendEnv = z.infer<typeof frontendEnvSchema>;

let cached: FrontendEnv | null = null;

function getCurrentPageProtocol(): string | undefined {
  return typeof window === 'undefined' ? undefined : window.location.protocol;
}

export function normalizeFrontendServerBaseUrl(
  baseUrl: string,
  pageProtocol = getCurrentPageProtocol(),
): string {
  if (pageProtocol !== 'https:') {
    return baseUrl;
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol === 'http:' && url.hostname.endsWith('.local.dofe.ai')) {
      url.protocol = 'https:';
      return url.toString().replace(/\/$/, '');
    }
  } catch {
    return baseUrl;
  }

  return baseUrl;
}

export function getFrontendEnv(): FrontendEnv {
  if (cached) return cached;
  const result = frontendEnvSchema.safeParse({
    NEXT_PUBLIC_SERVER_BASE_URL: process.env.NEXT_PUBLIC_SERVER_BASE_URL,
    NEXT_PUBLIC_API_VERSION: process.env.NEXT_PUBLIC_API_VERSION,
    NEXT_PUBLIC_APP_BUILD: process.env.NEXT_PUBLIC_APP_BUILD,
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
    NEXT_PUBLIC_BRAND_LOGO: process.env.NEXT_PUBLIC_BRAND_LOGO,
    NEXT_PUBLIC_BRAND_TITLE: process.env.NEXT_PUBLIC_BRAND_TITLE,
    NEXT_PUBLIC_BRAND_DESCRIPTION: process.env.NEXT_PUBLIC_BRAND_DESCRIPTION,
  });
  if (!result.success) {
    console.error('[Config] 前端环境变量校验失败:', result.error.issues);
    // 不阻止启动，使用默认值
    cached = frontendEnvSchema.parse({});
    return cached;
  }
  cached = {
    ...result.data,
    NEXT_PUBLIC_SERVER_BASE_URL: normalizeFrontendServerBaseUrl(
      result.data.NEXT_PUBLIC_SERVER_BASE_URL,
    ),
  };
  return cached;
}
