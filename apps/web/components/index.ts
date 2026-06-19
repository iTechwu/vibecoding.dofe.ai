/**
 * Shared Components
 *
 * 通用组件导出
 */
export {
  ErrorBoundary,
  PageErrorBoundary,
  ComponentErrorBoundary,
} from './error-boundary';

export {
  Skeleton,
  CardSkeleton,
  ListItemSkeleton,
  ListSkeleton,
  TableSkeleton,
  FormSkeleton,
  DetailSkeleton,
  AvatarSkeleton,
  PageSkeleton,
} from './skeletons';

export {
  AsyncBoundary,
  CardBoundary,
  ListBoundary,
  PageBoundary,
  withSuspense,
  withAsyncBoundary,
} from './suspense-utils';

// Client-only rendering
export { ClientOnly } from './client-only';

// Runtime i18n bridge
export { RuntimeI18nBridge } from './runtime-i18n-bridge';

// State components
export {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  PageLoading,
  PageError,
} from './state-components';

// Layout components
export { AppShell, AppSidebar, AppNavbar, LocaleSwitcher } from './layout';

// Decorative UI components
export { DecorativeGlow, PageContainer, PageTitle } from './ui/decorative';
