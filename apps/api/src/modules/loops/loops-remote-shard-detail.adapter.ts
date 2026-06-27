import { Injectable } from '@nestjs/common';
import type { LoopDetail } from '@repo/contracts';
import { LoopsIssuesService } from '@app/services/loops-issues';

@Injectable()
export class LoopsRemoteShardDetailAdapter {
  constructor(private readonly issues: LoopsIssuesService) {}

  readDetail(issueId: string): Promise<LoopDetail> {
    return this.issues.getIssue(issueId, (detail: LoopDetail) => detail);
  }
}
