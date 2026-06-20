import { Injectable } from '@nestjs/common';
import type { LoopNotification } from '@repo/contracts';

type SendStatus = LoopNotification['status'];

@Injectable()
export class LoopsNotificationSender {
  async send(notification: LoopNotification): Promise<SendStatus> {
    const webhookUrl = this.webhookUrl(notification.channel);
    if (!webhookUrl) {
      return notification.channel === 'web' ? 'RECORDED' : 'SKIPPED';
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.authHeaders(notification.channel),
      },
      body: JSON.stringify({
        id: notification.id,
        issueId: notification.issueId,
        kind: notification.kind,
        title: notification.title,
        body: notification.body,
        recipient: notification.recipient,
        actionHref: notification.actionHref,
        created: notification.created,
      }),
    }).catch(() => undefined);

    return response?.ok ? 'SENT' : 'FAILED';
  }

  private webhookUrl(channel: LoopNotification['channel']): string | undefined {
    if (channel === 'feishu') {
      return process.env.LOOPS_FEISHU_WEBHOOK_URL;
    }
    return process.env.LOOPS_ALERT_WEBHOOK_URL;
  }

  private authHeaders(channel: LoopNotification['channel']): Record<string, string> {
    const token =
      channel === 'feishu'
        ? process.env.LOOPS_FEISHU_WEBHOOK_TOKEN
        : process.env.LOOPS_ALERT_WEBHOOK_TOKEN;
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
