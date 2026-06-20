import path from 'node:path';
import { Link } from '@/i18n/navigation';
import NewLoopIssueForm from './new-loop-issue-form';

// Resolve the workspace root server-side so the default `targetRepo` is portable
// across machines (the web app runs from `apps/web`, so the repo root is `../..`).
// `NEXT_PUBLIC_LOOPS_DEFAULT_REPO` overrides this when set.
const defaultTargetRepo =
  process.env.NEXT_PUBLIC_LOOPS_DEFAULT_REPO ?? path.resolve(process.cwd(), '../..');

export default function NewLoopIssuePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Web Issue Intake</p>
            <h1 className="text-3xl font-semibold tracking-normal text-balance">New Loops Issue</h1>
          </div>
          <Link className="text-sm text-muted-foreground hover:text-foreground" href="/loops">
            Back
          </Link>
        </div>

        <NewLoopIssueForm defaultTargetRepo={defaultTargetRepo} />
      </div>
    </main>
  );
}
