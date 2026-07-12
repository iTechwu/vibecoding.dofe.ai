'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { cn } from '@dofe/infra-web-runtime/cn';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui';

export type IssueDetailTab = 'overview' | 'plan' | 'execution' | 'evidence';

interface IssueDetailTabsProps {
  children: ReactNode;
  labels: Record<IssueDetailTab, string>;
}

interface IssueDetailTabPanelProps {
  children: ReactNode;
  className?: string;
  primary?: boolean;
  value: IssueDetailTab;
}

const anchorTabs: Record<string, IssueDetailTab> = {
  'next-action-diagnostic': 'overview',
  'loop-next-action-title': 'overview',
  'loop-intake-tenant-title': 'overview',
  'delivery-controls': 'evidence',
  'evidence-artifacts': 'evidence',
};

const IssueDetailTabContext = createContext<IssueDetailTab>('overview');

function tabForHash(hash: string): IssueDetailTab {
  return anchorTabs[hash.replace(/^#/, '')] ?? 'overview';
}

export function IssueDetailTabs({ children, labels }: IssueDetailTabsProps) {
  const [value, setValue] = useState<IssueDetailTab>('overview');

  useEffect(() => {
    const syncHash = () => {
      const hash = window.location.hash;
      setValue(tabForHash(hash));
      if (!hash) return;

      window.requestAnimationFrame(() => {
        document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
      });
    };

    syncHash();
    window.addEventListener('hashchange', syncHash);
    return () => window.removeEventListener('hashchange', syncHash);
  }, []);

  return (
    <Tabs onValueChange={(nextValue) => setValue(nextValue as IssueDetailTab)} value={value}>
      <TabsList
        aria-label="Issue detail sections"
        className="h-auto w-full flex-wrap justify-start gap-1"
      >
        <TabsTrigger
          aria-controls="issue-detail-panel-overview"
          id="issue-detail-tab-overview"
          value="overview"
        >
          {labels.overview}
        </TabsTrigger>
        <TabsTrigger
          aria-controls="issue-detail-panel-plan"
          id="issue-detail-tab-plan"
          value="plan"
        >
          {labels.plan}
        </TabsTrigger>
        <TabsTrigger
          aria-controls="issue-detail-panel-execution"
          id="issue-detail-tab-execution"
          value="execution"
        >
          {labels.execution}
        </TabsTrigger>
        <TabsTrigger
          aria-controls="issue-detail-panel-evidence"
          id="issue-detail-tab-evidence"
          value="evidence"
        >
          {labels.evidence}
        </TabsTrigger>
      </TabsList>
      <IssueDetailTabContext.Provider value={value}>{children}</IssueDetailTabContext.Provider>
    </Tabs>
  );
}

export function IssueDetailTabPanel({
  children,
  className,
  primary = false,
  value,
}: IssueDetailTabPanelProps) {
  const activeTab = useContext(IssueDetailTabContext);
  return (
    <section
      aria-labelledby={primary ? `issue-detail-tab-${value}` : undefined}
      className={cn(activeTab === value ? '' : 'hidden', className)}
      id={primary ? `issue-detail-panel-${value}` : undefined}
      role={primary ? 'tabpanel' : undefined}
    >
      {children}
    </section>
  );
}
