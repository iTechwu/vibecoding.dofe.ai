'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/providers';
import { normaliseSimpleIssue } from '@repo/contracts';
import type { LoopLearning, LoopPriority, LoopSimpleIssueTemplate } from '@repo/contracts';
import { useCreateSimpleLoopIssue, useLoopsWorkspaces } from '@/lib/api/contracts/hooks';
import { LOOP_ISSUE_TEMPLATES } from './loop-issue-templates';

const TEMPLATE_OPTIONS: Array<{ id: LoopSimpleIssueTemplate; labelKey: string }> = [
  { id: 'auto', labelKey: 'simple.templateAuto' },
  ...LOOP_ISSUE_TEMPLATES.map((t) => ({
    id: t.id as LoopSimpleIssueTemplate,
    labelKey: `${t.translationKey}.label`,
  })),
];

const PRIORITIES: LoopPriority[] = ['P0', 'P1', 'P2', 'P3'];
const EMPTY_WORKSPACES: NonNullable<
  ReturnType<typeof useLoopsWorkspaces>['data']
>['body']['data']['workspaces'] = [];

interface SimpleLoopIssueFormProps {
  /** Server-resolved workspace root; used as the default target repo display. */
  defaultTargetRepo: string;
}

/**
 * Simple-mode-first Loops issue intake (0622 · B5).
 *
 * The user only needs to describe what they want and pick a workspace/template;
 * the backend normalises title/priority/criteria. A live preview (computed from
 * the same deterministic helpers the backend uses) keeps the submission
 * transparent, and advanced settings collapse away for the common case.
 *
 * UX principles: one prominent field, progressive disclosure, field-level
 * errors, disabled submit with guidance when no workspace is available.
 */
export default function SimpleLoopIssueForm({ defaultTargetRepo }: SimpleLoopIssueFormProps) {
  const t = useTranslations('loops.newIssue');
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const workspacesQuery = useLoopsWorkspaces();
  const createIssue = useCreateSimpleLoopIssue();

  const workspaces = workspacesQuery.data?.body?.data?.workspaces ?? EMPTY_WORKSPACES;
  const currentWorkspace = workspacesQuery.data?.body?.data?.current;
  const recentLearnings = workspacesQuery.data?.body?.data?.recentLearnings ?? [];

  const [request, setRequest] = useState('');
  const [workspaceId, setWorkspaceId] = useState(currentWorkspace ?? '');
  const [template, setTemplate] = useState<LoopSimpleIssueTemplate>('auto');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Advanced overrides (empty = use auto-generated).
  const [titleOverride, setTitleOverride] = useState('');
  const [priorityOverride, setPriorityOverride] = useState<LoopPriority | ''>('');
  const [criteriaOverride, setCriteriaOverride] = useState('');
  const [targetRepoOverride, setTargetRepoOverride] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);

  const effectiveWorkspaceId = workspaceId || currentWorkspace;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const selectedWorkspace = useMemo(
    () => workspaces.find((ws) => ws.workspaceId === effectiveWorkspaceId) ?? workspaces[0],
    [workspaces, effectiveWorkspaceId],
  );

  const effectiveTargetRepo =
    targetRepoOverride.trim() || selectedWorkspace?.root || defaultTargetRepo;

  // Live preview uses the exact same deterministic normalisation as the backend
  // (shared from @repo/contracts) so what you see is what gets persisted.
  const preview = useMemo(() => {
    if (request.trim().length < 10) return null;
    const criteriaLines = criteriaOverride
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return normaliseSimpleIssue({
      request,
      template,
      title: titleOverride.trim() || undefined,
      priority: priorityOverride || undefined,
      acceptanceCriteria: criteriaLines.length > 0 ? criteriaLines : undefined,
      targetRepo: effectiveTargetRepo,
    });
  }, [request, template, titleOverride, priorityOverride, criteriaOverride, effectiveTargetRepo]);

  const previewTemplate = useMemo(
    () => (preview ? LOOP_ISSUE_TEMPLATES.find((item) => item.id === preview.template) : undefined),
    [preview],
  );
  const previewLearnings = useMemo(() => {
    if (!preview) return [] as LoopLearning[];
    return recentLearnings
      .filter((learning) => !learning.repo || learning.repo === preview.targetRepo)
      .slice(0, 3);
  }, [preview, recentLearnings]);

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('simple.redirecting')}</p>;
  }

  const workspaceBlocked = !workspacesQuery.isLoading && workspaces.length === 0;
  const requestLength = request.trim().length;
  const requestRemaining = Math.max(0, 10 - requestLength);
  const submitBlockedReason = workspaceBlocked
    ? t('simple.submitWorkspaceBlocked')
    : requestRemaining > 0
      ? t('simple.submitRequestBlocked', { count: requestRemaining })
      : t('simple.submitReady');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.trim().length < 10) {
      setRequestError(t('simple.requestError'));
      return;
    }
    setRequestError(null);
    const criteriaLines = criteriaOverride
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    createIssue
      .mutateAsync({
        body: {
          request: request.trim(),
          workspaceId: selectedWorkspace?.workspaceId,
          targetRepo: targetRepoOverride.trim() || undefined,
          template,
          priority: priorityOverride || undefined,
          title: titleOverride.trim() || undefined,
          acceptanceCriteria: criteriaLines.length > 0 ? criteriaLines : undefined,
        },
      })
      .then((result) => {
        const issueId = result.body.data.issue.id;
        router.push(`/loops/${issueId}`);
      })
      .catch(() => {
        // ts-rest error surfaced via createIssue.isError below.
      });
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <p className="text-sm text-muted-foreground">{t('simple.intro')}</p>

      {/* Primary input: the request. */}
      <label className="flex flex-col gap-2 text-sm font-medium">
        <span>{t('simple.requestLabel')}</span>
        <textarea
          className="min-h-32 rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => setRequest(e.target.value)}
          placeholder={t('simple.requestPlaceholder')}
          value={request}
        />
        <span className="text-xs text-muted-foreground">{t('simple.requestHint')}</span>
        {requestError ? <span className="text-xs text-destructive">{requestError}</span> : null}
      </label>

      {/* Workspace + template, compact row. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          <span>{t('simple.workspaceLabel')}</span>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm disabled:opacity-60"
            disabled={workspacesQuery.isLoading || workspaceBlocked}
            onChange={(e) => setWorkspaceId(e.target.value)}
            value={selectedWorkspace?.workspaceId ?? ''}
          >
            {workspacesQuery.isLoading ? (
              <option value="">{t('simple.workspaceLoading')}</option>
            ) : workspaceBlocked ? (
              <option value="">{t('simple.workspaceEmpty')}</option>
            ) : (
              workspaces.map((ws) => (
                <option key={ws.workspaceId} value={ws.workspaceId}>
                  {ws.workspaceId === currentWorkspace
                    ? t('simple.workspaceCurrent', { id: ws.workspaceId })
                    : ws.workspaceId}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm font-medium">
          <span>{t('simple.templateLabel')}</span>
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            onChange={(e) => setTemplate(e.target.value as LoopSimpleIssueTemplate)}
            value={template}
          >
            {TEMPLATE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.id === 'auto' ? t('simple.templateAuto') : t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Live preview of the normalised issue (read-only). */}
      <section aria-label={t('simple.previewTitle')} className="rounded-md border bg-muted/30 p-4">
        <h2 className="text-xs font-semibold text-muted-foreground">{t('simple.previewTitle')}</h2>
        {preview ? (
          <dl className="mt-3 flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{t('simple.previewTitleLabel')}</dt>
              <dd className="font-medium">{preview.title}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{t('simple.previewPriorityLabel')}</dt>
              <dd>
                <span className="rounded-md border bg-background px-2 py-1 text-xs font-medium">
                  {preview.priority}
                </span>
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">
                {t('simple.previewTargetRepoLabel')}
              </dt>
              <dd className="break-all text-xs text-muted-foreground">{preview.targetRepo}</dd>
            </div>
            {previewTemplate ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">
                    {t('simple.previewAgentPathLabel')}
                  </dt>
                  <dd className="text-xs font-medium">{t(previewTemplate.agentPathKey)}</dd>
                </div>
                <div className="flex flex-col gap-1 rounded-md border bg-background px-3 py-2">
                  <dt className="text-xs text-muted-foreground">
                    {t('simple.previewTestPolicyLabel')}
                  </dt>
                  <dd className="text-xs font-medium">{t(previewTemplate.testPolicyKey)}</dd>
                </div>
              </div>
            ) : null}
            {previewLearnings.length > 0 ? (
              <div className="flex flex-col gap-2 rounded-md border bg-background px-3 py-2">
                <dt className="text-xs text-muted-foreground">
                  {t('simple.previewLearningLabel')}
                </dt>
                <dd>
                  <ul className="flex flex-col gap-2 text-xs">
                    {previewLearnings.map((learning) => (
                      <li className="rounded-md border bg-muted/30 px-2 py-1.5" key={learning.id}>
                        <span className="font-medium">
                          {t(`simple.learningKind.${learning.kind}`)}
                        </span>
                        <span className="text-muted-foreground"> · {learning.summary}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <dt className="text-xs text-muted-foreground">{t('simple.previewCriteriaLabel')}</dt>
              <dd>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-xs">
                  {preview.acceptanceCriteria.map((criterion, idx) => (
                    <li key={idx}>{criterion}</li>
                  ))}
                </ul>
              </dd>
            </div>
            {/* --- Delivery Loop Plan (P1-1: Invent Delivery Loop) --- */}
            {previewTemplate ? (
              <>
                {/* Workforce Plan */}
                <div className="rounded-md border bg-background px-3 py-2">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {t('simple.previewWorkforceLabel')}
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {previewTemplate.workforceSequence.map((persona) => (
                      <span className="rounded-md border bg-muted/30 px-2 py-1" key={persona.id}>
                        {t(`simple.persona.${persona.id}`, { defaultValue: persona.label })}
                      </span>
                    ))}
                  </dd>
                </div>
                {/* Runtime Plan */}
                <div className="rounded-md border bg-background px-3 py-2">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {t('simple.previewRuntimeLabel')}
                  </dt>
                  <dd className="mt-1 text-xs text-muted-foreground">
                    {t('simple.previewRuntimeValue', {
                      primary: previewTemplate.primaryRuntime,
                      secondary: previewTemplate.secondaryRuntime,
                    })}
                  </dd>
                </div>
                {/* Eval Plan */}
                <div className="rounded-md border bg-background px-3 py-2">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {t('simple.previewEvalLabel')}
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {previewTemplate.evalChecks.map((check) => (
                      <span
                        className={`rounded-md border px-2 py-1 ${
                          check.hardGate
                            ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                            : 'bg-muted/30'
                        }`}
                        key={check.id}
                        title={check.hardGate ? t('simple.hardGateHint') : undefined}
                      >
                        {t(`simple.evalCheck.${check.id}`, { defaultValue: check.label })}
                      </span>
                    ))}
                  </dd>
                </div>
                {/* Risk / Gate Plan */}
                <div className="rounded-md border bg-background px-3 py-2">
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {t('simple.previewGateLabel')}
                  </dt>
                  <dd className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {previewTemplate.gates.map((gate) => (
                      <span
                        className={`rounded-md border px-2 py-1 ${
                          gate.kind === 'human'
                            ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/20 dark:text-amber-100'
                            : 'bg-muted/30'
                        }`}
                        key={gate.id}
                      >
                        {t(`simple.gateLabel.${gate.id}`, { defaultValue: gate.label })}
                      </span>
                    ))}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">{t('simple.previewEmpty')}</p>
        )}
      </section>

      {/* Advanced settings (collapsed). */}
      <details
        className="rounded-md border"
        onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
        open={advancedOpen}
      >
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
          {t('simple.advancedSummary')}
        </summary>
        <div className="flex flex-col gap-4 border-t px-4 py-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>{t('simple.advancedTitle')}</span>
            <input
              className="h-10 rounded-md border bg-background px-3 text-sm"
              onChange={(e) => setTitleOverride(e.target.value)}
              placeholder={preview?.title ?? ''}
              value={titleOverride}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>{t('simple.advancedPriority')}</span>
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(e) => setPriorityOverride(e.target.value as LoopPriority | '')}
                value={priorityOverride}
              >
                <option value="">{t('simple.priorityAuto')}</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>{t('simple.advancedTargetRepo')}</span>
              <input
                className="h-10 rounded-md border bg-background px-3 text-sm"
                onChange={(e) => setTargetRepoOverride(e.target.value)}
                placeholder={effectiveTargetRepo}
                value={targetRepoOverride}
              />
            </label>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            <span>{t('simple.advancedCriteria')}</span>
            <textarea
              className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
              onChange={(e) => setCriteriaOverride(e.target.value)}
              placeholder={t('simple.advancedCriteriaPlaceholder')}
              value={criteriaOverride}
            />
          </label>
        </div>
      </details>

      {workspaceBlocked ? (
        <p className="text-sm text-destructive">{t('simple.workspaceRequired')}</p>
      ) : null}
      {createIssue.isError ? <p className="text-sm text-destructive">{t('error')}</p> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p
          aria-live="polite"
          className={`text-sm ${workspaceBlocked || requestRemaining > 0 ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-300'}`}
        >
          {submitBlockedReason}
        </p>
        <div className="flex justify-end gap-3">
          <Link
            className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted/30"
            href="/loops"
          >
            {t('cancel')}
          </Link>
          <button
            className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
            disabled={createIssue.isPending || workspaceBlocked || request.trim().length < 10}
            type="submit"
          >
            {createIssue.isPending ? t('creating') : t('create')}
          </button>
        </div>
      </div>
    </form>
  );
}
