import { getFrontendEnv } from '@/lib/config/env';

const env = getFrontendEnv();

export const API_CONFIG = {
  // API 基础地址
  baseUrl: env.NEXT_PUBLIC_SERVER_BASE_URL,
  apiHealthUrl: env.NEXT_PUBLIC_SERVER_BASE_URL + '/health',

  // API 端点路径（认证以 sso.dofe.ai 为唯一真源，经由本项目 OIDC Client 代理）
  endpoints: {
    authorize: '/api/auth/oidc/authorize',
    refreshToken: '/auth/oidc/token',
  },
};

/**
 * 品牌配置
 * 可通过环境变量覆盖：
 * - NEXT_PUBLIC_BRAND_NAME: 品牌名称（默认: "Dofe.AI"）
 * - NEXT_PUBLIC_BRAND_LOGO: Logo 路径（默认: "/logo.svg"）
 * - NEXT_PUBLIC_BRAND_TITLE: 页面标题
 * - NEXT_PUBLIC_BRAND_DESCRIPTION: 页面描述
 */
export const BRAND_CONFIG = {
  name: env.NEXT_PUBLIC_BRAND_NAME || 'DoFe.AI',
  logo: env.NEXT_PUBLIC_BRAND_LOGO || '/logo.svg',
  title:
    env.NEXT_PUBLIC_BRAND_TITLE ||
    'DoFe.AI | Do For Employee · Do For Enterprise · Do For Empowerment',
  description:
    env.NEXT_PUBLIC_BRAND_DESCRIPTION ||
    'DoFe.AI — Do For Employee · Do For Enterprise · Do For Empowerment. A distributed AI execution engine: API gateway, model routing, usage analytics, and intelligent ops console.',
};
