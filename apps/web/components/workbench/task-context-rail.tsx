import { Check, Circle, CircleDot, TriangleAlert } from 'lucide-react';

export type TaskContextStageStatus = 'blocked' | 'complete' | 'current' | 'upcoming';

export interface TaskContextStage {
  label: string;
  status: TaskContextStageStatus;
}

export interface TaskContextRailLabels {
  blocked: string;
  changes: string;
  complete: string;
  current: string;
  deliveryProgress: string;
  deliveryTracking: string;
  environment: string;
  upcoming: string;
  validation: string;
}

interface TaskContextRailProps {
  changes?: { added: number; removed: number };
  environment: string;
  labels?: Partial<TaskContextRailLabels>;
  stages: TaskContextStage[];
  validation: string;
}

const defaultLabels: TaskContextRailLabels = {
  blocked: 'Blocked',
  changes: 'Changes',
  complete: 'Complete',
  current: 'Current',
  deliveryProgress: 'Delivery progress',
  deliveryTracking: 'Delivery tracking',
  environment: 'Environment',
  upcoming: 'Upcoming',
  validation: 'Validation',
};

const statusPresentation: Record<
  TaskContextStageStatus,
  {
    Icon: typeof Check;
    labelKey: keyof Pick<TaskContextRailLabels, 'blocked' | 'complete' | 'current' | 'upcoming'>;
    className: string;
  }
> = {
  complete: { Icon: Check, labelKey: 'complete', className: 'text-emerald-600' },
  current: { Icon: CircleDot, labelKey: 'current', className: 'text-foreground' },
  upcoming: { Icon: Circle, labelKey: 'upcoming', className: 'text-muted-foreground' },
  blocked: { Icon: TriangleAlert, labelKey: 'blocked', className: 'text-amber-700' },
};

export function TaskContextRail({
  changes,
  environment,
  labels: labelsInput,
  stages,
  validation,
}: TaskContextRailProps) {
  const labels = { ...defaultLabels, ...labelsInput };

  return (
    <aside
      aria-label={labels.deliveryTracking}
      className="w-full border-t border-border bg-muted/20 p-4 lg:w-72 lg:border-t-0 lg:border-l"
    >
      <h2 className="text-sm font-semibold text-foreground">{labels.deliveryTracking}</h2>
      <ol className="mt-4 space-y-2" aria-label={labels.deliveryProgress}>
        {stages.map((stage) => {
          const presentation = statusPresentation[stage.status];
          return (
            <li className="flex items-center gap-2 text-sm" key={stage.label}>
              <presentation.Icon
                aria-hidden="true"
                className={`size-4 ${presentation.className}`}
              />
              <span className="min-w-0 flex-1 truncate">{stage.label}</span>
              <span className="text-xs text-muted-foreground">{labels[presentation.labelKey]}</span>
            </li>
          );
        })}
      </ol>

      <section
        className="mt-5 border-t border-border pt-4"
        aria-labelledby="task-context-environment"
      >
        <h3 className="text-xs font-medium text-muted-foreground" id="task-context-environment">
          {labels.environment}
        </h3>
        <p className="mt-1 break-words text-sm text-foreground">{environment}</p>
      </section>

      {changes ? (
        <section
          className="mt-5 border-t border-border pt-4"
          aria-labelledby="task-context-changes"
        >
          <h3 className="text-xs font-medium text-muted-foreground" id="task-context-changes">
            {labels.changes}
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
          {labels.validation}
        </h3>
        <p className="mt-1 text-sm text-foreground">{validation}</p>
      </section>
    </aside>
  );
}
