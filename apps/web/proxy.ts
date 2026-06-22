/**
 * Next.js Proxy 中间件
 * 1. 处理每日打卡检查和重定向
 * 2. 处理国际化路由
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import {
  AUTH_EXPIRE_COOKIE,
  AUTH_PRESENCE_COOKIE,
  shouldRedirectToLogin,
} from './lib/auth/proxy-auth';

// 创建国际化中间件
const intlMiddleware = createIntlMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip for static files and API routes
  if (
    pathname.includes('/_next') ||
    pathname.includes('/static') ||
    pathname.includes('/api') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp)$/)
  ) {
    return NextResponse.next();
  }

  if (
    shouldRedirectToLogin({
      pathname,
      tokenPresence: request.cookies.get(AUTH_PRESENCE_COOKIE)?.value,
      tokenExpire: request.cookies.get(AUTH_EXPIRE_COOKIE)?.value,
    })
  ) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set(
      'callbackUrl',
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    // 匹配根路径
    '/',
    // 匹配带语言前缀的路径
    '/(zh-CN|en)/:path*',
    // 匹配除以下之外的所有路径：
    // - api: API 路由
    // - _next: Next.js 内部路由
    // - _vercel: Vercel 内部路由
    // - 包含点号的路径（通常是静态文件）
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
};
