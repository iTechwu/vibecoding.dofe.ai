import type { LoopNotification } from '@repo/contracts';
import { LoopsNotificationSender } from './loops-notification-sender.service';

function notification(channel: LoopNotification['channel']): LoopNotification {
  return {
    id: 'notification-1',
    issueId: 'issue-1',
    channel,
    kind: 'COST_GUARD_TRIPPED',
    recipient: 'ops',
    title: 'Cost guard tripped',
    body: 'Loop paused by cost guard.',
    status: 'RECORDED',
    actionHref: '/loops/issue-1',
    created: '2026-06-20T00:00:00.000Z',
  };
}

describe('LoopsNotificationSender', () => {
  const originalFetch = global.fetch;
  const previousEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of [
      'LOOPS_ALERT_WEBHOOK_URL',
      'LOOPS_ALERT_WEBHOOK_TOKEN',
      'LOOPS_FEISHU_WEBHOOK_URL',
      'LOOPS_FEISHU_WEBHOOK_TOKEN',
    ]) {
      previousEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('sends web alerts to the configured webhook', async () => {
    process.env.LOOPS_ALERT_WEBHOOK_URL = 'https://alerts.example/loops';
    process.env.LOOPS_ALERT_WEBHOOK_TOKEN = 'secret';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(new LoopsNotificationSender().send(notification('web'))).resolves.toBe('SENT');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://alerts.example/loops',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    );
  });

  it('skips Feishu notifications when webhook config is absent', async () => {
    await expect(new LoopsNotificationSender().send(notification('feishu'))).resolves.toBe(
      'SKIPPED',
    );
  });

  it('marks failed webhook responses as failed', async () => {
    process.env.LOOPS_FEISHU_WEBHOOK_URL = 'https://open.feishu.cn/webhook';
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    await expect(new LoopsNotificationSender().send(notification('feishu'))).resolves.toBe(
      'FAILED',
    );
  });
});
