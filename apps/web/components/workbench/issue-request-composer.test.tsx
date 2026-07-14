import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { IssueRequestComposer } from './issue-request-composer';

const labels = {
  label: 'Describe the work to run',
  placeholder: 'Describe what to build',
  hint: 'Enter to send',
  send: 'Send request',
};

function ComposerHarness({
  onSubmit = vi.fn(),
  pending = false,
}: {
  onSubmit?: (value: string) => void;
  pending?: boolean;
}) {
  const [draft, setDraft] = useState('');
  return (
    <IssueRequestComposer
      draft={draft}
      labels={labels}
      onChange={setDraft}
      onSubmit={(value) => {
        onSubmit(value);
        setDraft('');
      }}
      pending={pending}
    />
  );
}

describe('IssueRequestComposer', () => {
  it('submits on Enter but preserves a newline on Shift+Enter', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<ComposerHarness onSubmit={onSubmit} />);

    const input = screen.getByRole('textbox', { name: labels.label });
    await user.type(input, 'Improve checkout recovery{enter}');

    expect(onSubmit).toHaveBeenCalledWith('Improve checkout recovery');

    await user.type(input, '{shift>}{enter}{/shift}second line');

    expect(input).toHaveValue('\nsecond line');
  });

  it('keeps the submit action disabled until the request reaches the minimum length', () => {
    render(<ComposerHarness />);

    expect(screen.getByRole('button', { name: labels.send })).toBeDisabled();
  });
});
