'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';

const OPERATIONS_HASHES = new Set([
  'loop-board',
  'review-inbox',
  'exception-center',
  'runtime-panel',
  'agent-runtime',
]);

function operationsHash() {
  if (typeof window === 'undefined') return '';
  return window.location.hash.slice(1);
}

export function LoopsOperationsView({
  children,
  defaultOpen = false,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('loops.dashboard.operations');
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [targetHash, setTargetHash] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const openForHash = () => {
      const hash = operationsHash();
      if (OPERATIONS_HASHES.has(hash)) {
        setTargetHash(hash);
        setIsOpen(true);
      } else {
        setTargetHash('');
      }
    };

    openForHash();
    window.addEventListener('hashchange', openForHash);
    return () => window.removeEventListener('hashchange', openForHash);
  }, []);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined' || typeof document === 'undefined') return;
    if (OPERATIONS_HASHES.has(targetHash)) {
      document.getElementById(targetHash)?.scrollIntoView?.({ block: 'start' });
    }
  }, [isOpen, targetHash]);

  return (
    <section aria-labelledby="operations-title" className="border-y border-border bg-background">
      <div className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h2 className="mt-1 text-base font-semibold" id="operations-title">
            {t('title')}
          </h2>
        </div>
        <button
          aria-controls={isOpen ? 'operations-content' : undefined}
          aria-expanded={isOpen}
          className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background/70 px-3 text-sm font-medium hover:bg-muted/50"
          onClick={() => setIsOpen((open) => !open)}
          type="button"
        >
          {t('trigger')}
          <ChevronDown
            aria-hidden="true"
            className={`size-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {isOpen ? (
        <div className="flex flex-col gap-4 border-t border-border/70 p-4" id="operations-content">
          {children}
        </div>
      ) : null}
    </section>
  );
}
