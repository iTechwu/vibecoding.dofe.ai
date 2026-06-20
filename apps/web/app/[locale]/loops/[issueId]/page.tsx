'use client';

import { AppShell } from '@/components/layout';
import LoopIssueDetailPage from '../../../loops/[issueId]/page';

export default function LocaleLoopIssueDetailPage() {
  return (
    <AppShell>
      <LoopIssueDetailPage />
    </AppShell>
  );
}
