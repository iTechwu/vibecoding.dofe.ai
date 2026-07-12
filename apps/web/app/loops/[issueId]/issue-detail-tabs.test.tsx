import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IssueDetailTabPanel, IssueDetailTabs } from './issue-detail-tabs';

vi.mock('@repo/ui', async () => {
  const React = await import('react');
  const TabsContext = React.createContext<{
    value: string;
    onValueChange?: (value: string) => void;
  }>({ value: '' });
  const values = ['overview', 'plan', 'execution', 'evidence'];

  return {
    Tabs: ({
      children,
      onValueChange,
      value,
    }: React.PropsWithChildren<{ value: string; onValueChange?: (value: string) => void }>) => (
      <TabsContext.Provider value={{ value, onValueChange }}>{children}</TabsContext.Provider>
    ),
    TabsList: ({ children, ...props }: React.ComponentProps<'div'>) => (
      <div {...props}>{children}</div>
    ),
    TabsTrigger: ({
      children,
      value,
      ...props
    }: React.PropsWithChildren<{ value: string }> & React.ComponentProps<'button'>) => {
      const tabs = React.useContext(TabsContext);
      return (
        <button
          {...props}
          aria-selected={tabs.value === value}
          onKeyDown={(event) => {
            props.onKeyDown?.(event);
            if (event.key === 'ArrowRight')
              tabs.onValueChange?.(values[(values.indexOf(value) + 1) % values.length]!);
          }}
          onClick={() => tabs.onValueChange?.(value)}
          role="tab"
          type="button"
        >
          {children}
        </button>
      );
    },
    TabsContent: ({
      children,
      value,
      ...props
    }: React.PropsWithChildren<{ value: string }> & React.ComponentProps<'div'>) => {
      const tabs = React.useContext(TabsContext);
      const { forceMount: _forceMount, ...contentProps } = props as typeof props & {
        forceMount?: boolean;
      };
      void _forceMount;
      return (
        <div {...contentProps} hidden={tabs.value !== value} role="tabpanel">
          {children}
        </div>
      );
    },
  };
});

const labels = {
  overview: 'Overview',
  plan: 'Plan',
  execution: 'Execution',
  evidence: 'Evidence',
};

function TabsFixture() {
  return (
    <IssueDetailTabs labels={labels}>
      <IssueDetailTabPanel primary value="overview">
        <p id="loop-intake-tenant-title">Overview content</p>
      </IssueDetailTabPanel>
      <IssueDetailTabPanel primary value="plan">
        <p>Plan content</p>
      </IssueDetailTabPanel>
      <IssueDetailTabPanel primary value="execution">
        <p>Execution content</p>
      </IssueDetailTabPanel>
      <IssueDetailTabPanel primary value="evidence">
        <div id="delivery-controls">Evidence content</div>
      </IssueDetailTabPanel>
    </IssueDetailTabs>
  );
}

function renderTabs() {
  return render(<TabsFixture />);
}

describe('IssueDetailTabs', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/');
    vi.restoreAllMocks();
  });

  it('renders exactly four semantic tabs with Overview selected by default', () => {
    renderTabs();

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(4);
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Overview',
      'Plan',
      'Execution',
      'Evidence',
    ]);
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Overview' })).toHaveTextContent(
      'Overview content',
    );
  });

  it('uses Radix keyboard navigation to select the next tab', () => {
    renderTabs();

    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    fireEvent.keyDown(overview, { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: 'Plan' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Plan' })).toHaveTextContent('Plan content');
  });

  it('opens the Evidence tab and scrolls its target for an initial evidence hash', async () => {
    const scrollIntoView = vi.fn();
    window.history.replaceState(null, '', '#delivery-controls');
    Element.prototype.scrollIntoView = scrollIntoView;

    renderTabs();

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('updates the active tab and scroll target after hash changes', async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    renderTabs();
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');

    window.location.hash = '#loop-intake-tenant-title';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(scrollIntoView).toHaveBeenCalled();
    });

    scrollIntoView.mockClear();
    window.location.hash = '#delivery-controls';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(scrollIntoView).toHaveBeenCalled();
    });
  });

  it('hydrates Overview markup before selecting a hash-owned tab after mount', async () => {
    vi.stubGlobal('window', undefined);
    const html = renderToString(<TabsFixture />);
    vi.unstubAllGlobals();

    expect(html).toContain('aria-selected="true"');
    window.history.replaceState(null, '', '#delivery-controls');
    Element.prototype.scrollIntoView = vi.fn();

    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.appendChild(container);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let root: ReturnType<typeof hydrateRoot> | undefined;

    try {
      await act(async () => {
        root = hydrateRoot(container, <TabsFixture />);
        await Promise.resolve();
      });

      expect(consoleError).not.toHaveBeenCalledWith(
        expect.stringContaining(
          "Hydration failed because the server rendered text didn't match the client",
        ),
        expect.anything(),
      );
      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Evidence' })).toHaveAttribute(
          'aria-selected',
          'true',
        );
      });
    } finally {
      act(() => root?.unmount());
      container.remove();
    }
  });
});
