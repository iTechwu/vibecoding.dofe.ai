/**
 * 运行时翻译注册表：供 fetch 层、非 React 模块在客户端使用 next-intl 文案。
 * 由 RuntimeI18nBridge 在挂载时注入各 namespace 的 t 函数。
 */

export type NamespaceTranslate = (
  key: string,
  values?: Record<string, string | number>,
) => string;

const registry = new Map<string, NamespaceTranslate>();

export function registerIntlNamespace(
  namespace: string,
  translate: NamespaceTranslate | null,
): void {
  if (translate) {
    registry.set(namespace, translate);
  } else {
    registry.delete(namespace);
  }
}

export function intlNs(
  namespace: string,
  key: string,
  values?: Record<string, string | number>,
): string {
  const t = registry.get(namespace);
  if (!t) {
    return key;
  }
  try {
    return values && Object.keys(values).length > 0 ? t(key, values) : t(key);
  } catch {
    return key;
  }
}

/** 带 locale 前缀的登录路径，供 401 跳转 */
export function getLocaleLoginPath(): string {
  if (typeof window === 'undefined') {
    return '/login';
  }
  const pathname = window.location.pathname;
  const m = pathname.match(/^\/(en|zh-CN)(?=\/|$)/);
  return m ? `${m[0]}/login` : '/login';
}
