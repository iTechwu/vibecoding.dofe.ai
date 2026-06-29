'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/providers';
import { CreateLoopIssueRequestSchema } from '@repo/contracts';
import { useCreateLoopIssue } from '@/lib/api/contracts/hooks';
import {
  DEFAULT_LOOP_ISSUE_TEMPLATE,
  LOOP_ISSUE_TEMPLATES,
  type LoopIssueTemplateId,
} from './loop-issue-templates';
import { useCurrentLoopTenant } from './use-current-loop-tenant';

interface NewLoopIssueFormProps {
  /** Server-resolved workspace root; overridable via NEXT_PUBLIC_LOOPS_DEFAULT_REPO. */
  defaultTargetRepo: string;
}

/**
 * Client-side Loops issue intake.
 *
 * Submitting calls the authenticated ts-rest `createIssue` endpoint — the
 * submitter is derived server-side from the logged-in SSO user (provider
 * `dofe-sso`), so the client never sends identity. Unauthenticated visitors are
 * bounced to /login; the global 401 handler in `customFetch` is the backstop.
 */
export default function NewLoopIssueForm({ defaultTargetRepo }: NewLoopIssueFormProps) {
  const t = useTranslations('loops.newIssue');
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const createIssue = useCreateLoopIssue();
  const tenantContext = useCurrentLoopTenant();
  const getTemplateBody = (template: typeof DEFAULT_LOOP_ISSUE_TEMPLATE) =>
    t(`${template.translationKey}.body`);
  const getTemplateCriteria = (template: typeof DEFAULT_LOOP_ISSUE_TEMPLATE) =>
    t.raw(`${template.translationKey}.criteria`) as string[];

  const [title, setTitle] = useState('');
  const [targetRepo, setTargetRepo] = useState(defaultTargetRepo);
  const [templateId, setTemplateId] = useState<LoopIssueTemplateId>(DEFAULT_LOOP_ISSUE_TEMPLATE.id);
  const [priority, setPriority] = useState<'P0' | 'P1' | 'P2' | 'P3'>(
    DEFAULT_LOOP_ISSUE_TEMPLATE.priority,
  );
  const [body, setBody] = useState(() => getTemplateBody(DEFAULT_LOOP_ISSUE_TEMPLATE));
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(() =>
    getTemplateCriteria(DEFAULT_LOOP_ISSUE_TEMPLATE).join('\n'),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated) {
    return <p className="text-sm text-muted-foreground">{t('redirecting')}</p>;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const criteria = acceptanceCriteria
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    // Rule 2 (client side): validate against the contract Zod schema before
    // hitting the network, so field-level errors are surfaced immediately
    // rather than as a generic server failure.
    const payload = {
      title: title.trim(),
      targetRepo: targetRepo.trim(),
      body: body.trim(),
      priority,
      acceptanceCriteria: criteria,
      tenantContext,
    };
    const parsed = CreateLoopIssueRequestSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    const result = await createIssue.mutateAsync({ body: parsed.data });
    const issueId = result.body.data.issue.id;
    router.push(`/loops/${issueId}`);
  }

  function applyTemplate(nextTemplateId: LoopIssueTemplateId) {
    const template =
      LOOP_ISSUE_TEMPLATES.find((item) => item.id === nextTemplateId) ??
      DEFAULT_LOOP_ISSUE_TEMPLATE;
    setTemplateId(template.id);
    setPriority(template.priority);
    setBody(getTemplateBody(template));
    setAcceptanceCriteria(getTemplateCriteria(template).join('\n'));
  }

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">{t('template')}</legend>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {LOOP_ISSUE_TEMPLATES.map((template) => {
            const isSelected = templateId === template.id;

            return (
              <button
                aria-label={t(`${template.translationKey}.label`)}
                aria-pressed={isSelected}
                className={`group rounded-md border p-4 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                  isSelected
                    ? 'border-foreground bg-foreground text-background hover:border-foreground hover:bg-foreground hover:text-background'
                    : 'border-border bg-background text-foreground hover:border-foreground/35 hover:bg-muted/40 hover:text-foreground'
                }`}
                key={template.id}
                onClick={() => applyTemplate(template.id)}
                type="button"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="font-medium">{t(`${template.translationKey}.label`)}</span>
                  <span
                    className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                      isSelected
                        ? 'border-background/45 bg-background/10 text-background'
                        : 'border-border bg-muted/30 text-muted-foreground group-hover:border-foreground/25 group-hover:text-foreground'
                    }`}
                  >
                    {template.priority}
                  </span>
                </span>
                <span
                  className={`mt-2 block leading-5 transition-colors ${
                    isSelected
                      ? 'text-background/85'
                      : 'text-muted-foreground group-hover:text-foreground/80'
                  }`}
                >
                  {t(`${template.translationKey}.description`)}
                </span>
                <span
                  className={`mt-2 block text-xs transition-colors ${
                    isSelected
                      ? 'text-background/70'
                      : 'text-muted-foreground/80 group-hover:text-muted-foreground'
                  }`}
                >
                  {t(`${template.translationKey}.bestFor`)}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-medium">
        {t('titleLabel')}
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          onChange={(e) => setTitle(e.target.value)}
          required
          value={title}
        />
        {errors.title ? <span className="text-xs text-destructive">{errors.title}</span> : null}
      </label>

      {tenantContext ? (
        <div className="rounded-md border bg-muted/20 p-3 text-sm">
          <p className="text-xs text-muted-foreground">{t('tenant')}</p>
          <p className="mt-1 break-all font-medium">
            {tenantContext.tenantName ?? tenantContext.tenantId}
          </p>
          {tenantContext.tenantName || tenantContext.teamId ? (
            <p className="mt-1 break-all text-xs text-muted-foreground">
              {[tenantContext.tenantId, tenantContext.teamId].filter(Boolean).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <label className="flex flex-col gap-2 text-sm font-medium">
        {t('targetRepo')}
        <input
          className="h-10 rounded-md border bg-background px-3 text-sm"
          onChange={(e) => setTargetRepo(e.target.value)}
          required
          value={targetRepo}
        />
        {errors.targetRepo ? (
          <span className="text-xs text-destructive">{errors.targetRepo}</span>
        ) : null}
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm font-medium">
          {t('priority')}
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            onChange={(e) => setPriority(e.target.value as 'P0' | 'P1' | 'P2' | 'P3')}
            value={priority}
          >
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-2 text-sm font-medium">
        {t('body')}
        <textarea
          className="min-h-36 rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => setBody(e.target.value)}
          required
          value={body}
        />
        {errors.body ? <span className="text-xs text-destructive">{errors.body}</span> : null}
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        {t('acceptanceCriteria')}
        <textarea
          className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => setAcceptanceCriteria(e.target.value)}
          placeholder={t('criteriaPlaceholder')}
          required
          value={acceptanceCriteria}
        />
        {errors.acceptanceCriteria ? (
          <span className="text-xs text-destructive">{errors.acceptanceCriteria}</span>
        ) : null}
      </label>

      {createIssue.isError ? <p className="text-sm text-destructive">{t('error')}</p> : null}

      <div className="flex justify-end gap-3">
        <Link
          className="inline-flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted/30"
          href="/loops"
        >
          {t('cancel')}
        </Link>
        <button
          className="inline-flex h-10 items-center justify-center rounded-md bg-foreground px-4 text-sm font-medium text-background disabled:opacity-60"
          disabled={createIssue.isPending}
          type="submit"
        >
          {createIssue.isPending ? t('creating') : t('create')}
        </button>
      </div>
    </form>
  );
}
