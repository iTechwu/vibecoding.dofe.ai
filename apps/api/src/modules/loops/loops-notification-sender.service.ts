import { Injectable, Optional } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import type { LoopNotification } from '@repo/contracts';

type SendStatus = LoopNotification['status'];

@Injectable()
export class LoopsNotificationSender {
  constructor(@Optional() private readonly httpService?: HttpService) {}

  async send(notification: LoopNotification): Promise<SendStatus> {
    const webhookUrl = this.webhookUrl(notification.channel);
    if (!webhookUrl) {
      return notification.channel === 'web' ? 'RECORDED' : 'SKIPPED';
    }

    const payload = {
      id: notification.id,
      issueId: notification.issueId,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      recipient: notification.recipient,
      actionHref: notification.actionHref,
      created: notification.created,
    };
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.authHeaders(notification.channel),
    };

    try {
      if (this.httpService) {
        // Production (Nest) path: external HTTP MUST go through @nestjs/axios
        // HttpService (Rule 3). `validateStatus: () => true` keeps non-2xx from
        // throwing so we can map them to FAILED uniformly.
        const response = await firstValueFrom(
          this.httpService.post(webhookUrl, payload, {
            headers,
            timeout: 10_000,
            validateStatus: () => true,
          }),
        );
        return response.status >= 200 && response.status < 300 ? 'SENT' : 'FAILED';
      }
      // Standalone (ts-node / non-Nest consumers) fallback only.
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      }).catch(() => undefined);
      return response?.ok ? 'SENT' : 'FAILED';
    } catch {
      return 'FAILED';
    }
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
