/**
 * i18n 路由配置
 * 定义多语言路由规则
 */

import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  // 支持的语言列表
  locales,

  // 默认语言
  defaultLocale,

  // 无语言前缀的页面始终使用产品默认中文，不受浏览器或历史语言偏好影响。
  localeDetection: false,

  // 语言前缀策略
  // 'as-needed': 默认语言不显示前缀，其他语言显示
  // 'always': 所有语言都显示前缀
  // 'never': 不显示前缀（不推荐）
  localePrefix: 'as-needed',
});
