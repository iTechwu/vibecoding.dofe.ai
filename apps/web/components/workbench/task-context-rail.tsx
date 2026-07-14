import { Check, Circle, CircleDot, TriangleAlert } from 'lucide-react';

export type TaskContextStageStatus = 'blocked' | 'complete' | 'current' | 'upcoming';

export interface TaskContextStage {
  label: string;
  status: TaskContextStageStatus;
}

interface TaskContextRailProps {
  changes?: { added: number; removed: number };
  environment: string;
  stages: TaskContextStage[];
  validation: string;
}

const statusPresentation: Record<
  TaskContextStageStatus,
  { Icon: typeof Check; label: string; className: string }
> = {
  complete: { Icon: Check, label: 'Complete', className: 'text-emerald-600' },
  current: { Icon: CircleDot, label: 'Current', className: 'text-foreground' },
  upcoming: { Icon: Circle, label: 'Upcoming', className: 'text-muted-foreground' },
  blocked: { Icon: TriangleAlert, label: 'Blocked', className: 'text-amber-700' },
};

export function TaskContextRail({
  changes,
  environment,
  stages,
  validation,
}: TaskContextRailProps) {
  return (
    <aside
      aria-label="Delivery tracking"
      className="w-full border-t border-border bg-muted/20 p-4 lg:w-72 lg:border-t-0 lg:border-l"
    >
      <h2 className="text-sm font-semibold text-foreground">Delivery tracking</h2>
      <ol className="mt-4 space-y-2" aria-label="Delivery progress">
        {stages.map((stage) => {
          const presentation = statusPresentation[stage.status];
          return (
            <li className="flex items-center gap-2 text-sm" key={stage.label}>
              <presentation.Icon
                aria-hidden="true"
                className={`size-4 ${presentation.className}`}
              />
              <span className="min-w-0 flex-1 truncate">{stage.label}</span>
              <span className="text-xs text-muted-foreground">{presentation.label}</span>
            </li>
          );
        })}
      </ol>

      <section
        className="mt-5 border-t border-border pt-4"
        aria-labelledby="task-context-environment"
      >
        <h3 className="text-xs font-medium text-muted-foreground" id="task-context-environment">
          Environment
        </h3>
        <p className="mt-1 break-words text-sm text-foreground">{environment}</p>
      </section>

      {changes ? (
        <section
          className="mt-5 border-t border-border pt-4"
          aria-labelledby="task-context-changes"
        >
          <h3 className="text-xs font-medium text-muted-foreground" id="task-context-changes">
            Changes
          </h3>
          <p className="mt-1 text-sm">
            <span className="text-emerald-700">+{changes.added}</span>{' '}
            <span className="text-amber-700">-{changes.removed}</span>
          </p>
        </section>
      ) : null}

      <section
        className="mt-5 border-t border-border pt-4"
        aria-labelledby="task-context-validation"
      >
        <h3 className="text-xs font-medium text-muted-foreground" id="task-context-validation">
          Validation
        </h3>
        <p className="mt-1 text-sm text-foreground">{validation}</p>
      </section>
    </aside>
  );
}
