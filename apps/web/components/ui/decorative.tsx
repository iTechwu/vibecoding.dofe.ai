'use client';

import { cn } from '@dofe/infra-web-runtime/cn';

interface DecorativeGlowProps {
  position?: 'bottom-right' | 'top-left' | 'top-right' | 'bottom-left' | 'center';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  zIndex?: number;
}

const positionClasses = {
  'bottom-right': '-bottom-11 right-14',
  'top-left': '-top-48 -left-48',
  'top-right': '-top-48 -right-48',
  'bottom-left': '-bottom-48 -left-48',
  center: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
};

const sizeClasses = {
  sm: 'w-64 h-48',
  md: 'w-96 h-64',
  lg: 'w-[500px] h-80',
};

export function DecorativeGlow({
  position = 'bottom-right',
  size = 'md',
  className,
  zIndex = 0,
}: DecorativeGlowProps) {
  return (
    <div
      className={cn(
        'absolute bg-primary/10 blur-[220px] opacity-30 pointer-events-none',
        positionClasses[position],
        sizeClasses[size],
        className,
      )}
      style={{ zIndex }}
    />
  );
}

interface PageContainerProps {
  children: React.ReactNode;
  showGlow?: boolean;
  glowPosition?: DecorativeGlowProps['position'];
  className?: string;
  contentClassName?: string;
}

export function PageContainer({
  children,
  showGlow = true,
  glowPosition = 'bottom-right',
  className,
  contentClassName,
}: PageContainerProps) {
  return (
    <div className={cn('relative', className)}>
      {showGlow && <DecorativeGlow position={glowPosition} />}
      <div className={cn('relative z-1', contentClassName)}>{children}</div>
    </div>
  );
}

interface PageTitleProps {
  children: React.ReactNode;
  actions?: React.ReactNode;
  description?: string;
}

export function PageTitle({ children, actions, description }: PageTitleProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-primary">{children}</h1>
        {description && <p className="text-muted-foreground/60 mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
