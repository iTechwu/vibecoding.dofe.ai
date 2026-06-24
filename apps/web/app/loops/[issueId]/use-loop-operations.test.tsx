import type { FormEvent } from 'react';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useFormState } from './use-loop-operations';

const mutations = vi.hoisted(() => ({
  advance: { mutate: vi.fn(), isPending: false, isError: false },
  reviewSpec: { mutate: vi.fn(), isPending: false, isError: false },
  reloop: { mutate: vi.fn(), isPending: false, isError: false },
  intervene: { mutate: vi.fn(), isPending: false, isError: false },
  browserQa: { mutate: vi.fn(), isPending: false, isError: false },
  secondOpinion: { mutate: vi.fn(), isPending: false, isError: false },
  deliveryGovernance: { mutate: vi.fn(), isPending: false, isError: false },
  resolveSecondOpinion: { mutate: vi.fn(), isPending: false, isError: false },
}));

vi.mock('@/lib/api/contracts/hooks', () => ({
  useAdvanceLoop: () => mutations.advance,
  useReviewLoopSpec: () => mutations.reviewSpec,
  useReloopIssue: () => mutations.reloop,
  useInterveneLoop: () => mutations.intervene,
  useRunLoopBrowserQa: () => mutations.browserQa,
  useRunLoopSecondOpinion: () => mutations.secondOpinion,
  useGovernLoopDelivery: () => mutations.deliveryGovernance,
  useResolveSecondOpinion: () => mutations.resolveSecondOpinion,
}));

describe('useFormState delivery actions', () => {
  it('maps Browser QA and second-opinion actions to ts-rest mutation payloads', () => {
    mutations.browserQa.mutate.mockClear();
    mutations.secondOpinion.mutate.mockClear();
    mutations.deliveryGovernance.mutate.mockClear();
    const { result } = renderHook(() => useFormState('issue-1'));
    const form = document.createElement('form');
    form.innerHTML = `
      <input name="targetUrl" value="https://example.com/qa" />
      <input name="checkedFlows" value="page-load, smoke" />
      <input name="authSessionRef" value=".loops/auth/session.json" />
      <input name="notes" value="Report-only QA" />
    `;

    result.current.runBrowserQa({
      preventDefault: vi.fn(),
      currentTarget: form,
    } as unknown as FormEvent<HTMLFormElement>);
    result.current.runSecondOpinion();

    expect(mutations.browserQa.mutate).toHaveBeenCalledWith({
      params: { issueId: 'issue-1' },
      body: {
        targetUrl: 'https://example.com/qa',
        checkedFlows: ['page-load', 'smoke'],
        authSessionRef: '.loops/auth/session.json',
        notes: 'Report-only QA',
        viewports: [{ name: 'desktop', width: 1440, height: 900 }],
      },
    });
    expect(mutations.secondOpinion.mutate).toHaveBeenCalledWith({
      params: { issueId: 'issue-1' },
      body: {},
    });
  });

  it('maps delivery governance actions to ts-rest mutation payloads', () => {
    mutations.deliveryGovernance.mutate.mockClear();
    mutations.resolveSecondOpinion.mutate.mockClear();
    const { result } = renderHook(() => useFormState('issue-1'));

    result.current.requireSecondOpinion();
    expect(mutations.deliveryGovernance.mutate).toHaveBeenCalledWith({
      params: { issueId: 'issue-1' },
      body: {
        action: 'set-second-opinion-policy',
        requiredForRelease: true,
        conflictHumanGate: true,
        actor: 'human',
        reason: 'Require Claude Code second opinion before release.',
      },
    });

    result.current.acceptSecondaryFindings(['conflict-a', 'conflict-b']);
    expect(mutations.resolveSecondOpinion.mutate).toHaveBeenCalledWith({
      params: { issueId: 'issue-1' },
      body: {
        action: 'accept-secondary',
        findingFingerprints: ['conflict-a', 'conflict-b'],
      },
    });

    const canaryForm = document.createElement('form');
    canaryForm.innerHTML = `
      <input name="status" value="passed" />
      <input name="targetUrl" value="https://example.com/canary" />
      <input name="environment" value="staging-us" />
      <input name="environmentOwner" value="release-manager" />
      <input name="reason" value="Smoke passed" />
      <input name="rollbackNote" value="Revert the release branch" />
    `;
    result.current.recordReleaseCanary({
      preventDefault: vi.fn(),
      currentTarget: canaryForm,
    } as unknown as FormEvent<HTMLFormElement>);

    expect(mutations.deliveryGovernance.mutate).toHaveBeenLastCalledWith({
      params: { issueId: 'issue-1' },
      body: {
        action: 'record-release-canary',
        status: 'passed',
        targetUrl: 'https://example.com/canary',
        environment: 'staging-us',
        environmentOwner: 'release-manager',
        rollbackNote: 'Revert the release branch',
        actor: 'human',
        reason: 'Smoke passed',
      },
    });

    const requiredGatesForm = document.createElement('form');
    requiredGatesForm.innerHTML = `
      <input type="checkbox" name="gateKinds" value="product" checked />
      <input type="checkbox" name="gateKinds" value="code" checked />
    `;
    result.current.setRequiredReviewGates({
      preventDefault: vi.fn(),
      currentTarget: requiredGatesForm,
    } as unknown as FormEvent<HTMLFormElement>);

    expect(mutations.deliveryGovernance.mutate).toHaveBeenLastCalledWith({
      params: { issueId: 'issue-1' },
      body: {
        action: 'set-required-review-gates',
        gateKinds: ['product', 'code'],
        actor: 'human',
        reason: 'Configured from Delivery Controls required review gates.',
      },
    });
  });
});
