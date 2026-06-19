'use client';

/**
 * 公共状态组件
 * 用于统一页面加载、错误、空状态的展示
 */

import { Loader2 } from 'lucide-react';
import { Button } from '@repo/ui';
import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@repo/utils';

// ============================================================================
// Loading Spinner
// ============================================================================

interface LoadingSpinnerProps {
  /** 自定义类名 */
  className?: string;
  /** 图标大小 */
  size?: 'sm' | 'md' | 'lg';
  /** 最小高度 */
  minHeight?: string | number;
}

const sizeMap = {
  sm: 'size-4',
  md: 'size-8',
  lg: 'size-12',
};

/**
 * 统一的加载状态组件
 */
export function LoadingSpinner({
  className,
  size = 'md',
  minHeight = 400,
}: LoadingSpinnerProps) {
  const minHeightStyle =
    typeof minHeight === 'number' ? `${minHeight}px` : minHeight;

  return (
    <div
      className={cn('flex items-center justify-center', className)}
      style={{ minHeight: minHeightStyle }}
    >
      <Loader2 className={cn(sizeMap[size], 'animate-spin text-primary')} />
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  /** 错误消息 */
  message?: string;
  /** 重试回调 */
  onRetry?: () => void;
  /** 重试按钮文字 */
  retryText?: string;
  /** 自定义类名 */
  className?: string;
  /** 最小高度 */
  minHeight?: string | number;
}

/**
 * 统一的错误状态组件
 */
export function ErrorState({
  message,
  onRetry,
  retryText,
  className,
  minHeight = 400,
}: ErrorStateProps) {
  const t = useTranslations('common');
  const displayMessage = message ?? t('messages.loadFailed');
  const displayRetry = retryText ?? t('actions.retry');
  const minHeightStyle =
    typeof minHeight === 'number' ? `${minHeight}px` : minHeight;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        className,
      )}
      style={{ minHeight: minHeightStyle }}
    >
      <p className="text-destructive">{displayMessage}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="rounded-lg">
          {displayRetry}
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  /** 标题 */
  title?: string;
  /** 描述 */
  description?: string;
  /** 图标 */
  icon?: ReactNode;
  /** 操作按钮 */
  action?: ReactNode;
  /** 自定义类名 */
  className?: string;
  /** 最小高度 */
  minHeight?: string | number;
}

/**
 * 统一的空状态组件
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  minHeight = 200,
}: EmptyStateProps) {
  const t = useTranslations('common');
  const displayTitle = title ?? t('messages.noData');
  const minHeightStyle =
    typeof minHeight === 'number' ? `${minHeight}px` : minHeight;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4',
        className,
      )}
      style={{ minHeight: minHeightStyle }}
    >
      {icon}
      <div className="text-center">
        <p className="text-muted-foreground">{displayTitle}</p>
        {description && (
          <p className="text-sm text-muted-foreground/60 mt-1">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

// ============================================================================
// Page Loading (Full Page)
// ============================================================================

interface PageLoadingProps {
  /** 自定义类名 */
  className?: string;
}

/**
 * 全页面加载状态
 */
export function PageLoading({ className }: PageLoadingProps) {
  return (
    <div
      className={cn(
        'p-6 flex items-center justify-center min-h-[400px]',
        className,
      )}
    >
      <Loader2 className="size-8 animate-spin text-primary" />
    </div>
  );
}

// ============================================================================
// Page Error (Full Page with Shell)
// ============================================================================

interface PageErrorProps {
  /** 错误消息 */
  message?: string;
  /** 重试回调 */
  onRetry?: () => void;
}

/**
 * 全页面错误状态
 */
export function PageError({ message, onRetry }: PageErrorProps) {
  const t = useTranslations('common');
  const displayMessage = message ?? t('messages.loadFailed');
  const retryLabel = t('actions.retry');

  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-4">
      <p className="text-destructive">{displayMessage}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="rounded-lg">
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
