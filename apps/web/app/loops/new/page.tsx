import Link from 'next/link';
import path from 'node:path';
import { createLoopIssueAction } from './actions';

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

        <form action={createLoopIssueAction} className="flex flex-col gap-5">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Title
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm"
              name="title"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Target Repository
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm"
              defaultValue={defaultTargetRepo}
              name="targetRepo"
              required
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Priority
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                defaultValue="P2"
                name="priority"
              >
                <option value="P0">P0</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Requirement Body
            <textarea
              className="min-h-36 rounded-md border bg-background px-3 py-2 text-sm"
              name="body"
              required
            />
          </label>

          <label className="flex flex-col gap-2 text-sm font-medium">
            Acceptance Criteria
            <textarea
              className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
              name="acceptanceCriteria"
              placeholder="One acceptance item per line"
              required
            />
          </label>

          <div className="flex justify-end">
            <button
              className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background"
              type="submit"
            >
              Create Issue
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
