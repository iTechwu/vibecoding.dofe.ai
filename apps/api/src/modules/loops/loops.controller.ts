import { Controller, Req, VERSION_NEUTRAL } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { created, success } from '@dofe/infra-common/ts-rest';
import { loopsContract as c } from '@repo/contracts/api';
import { Auth } from '@app/auth';
import type { AuthenticatedRequest } from '@app/auth';
import { LoopsService } from './loops.service';

@Auth('api')
@Controller({
  version: VERSION_NEUTRAL,
})
export class LoopsController {
  constructor(private readonly loopsService: LoopsService) {}

  @TsRestHandler(c.list)
  async list() {
    return tsRestHandler(c.list, async ({ query }) => {
      return success(await this.loopsService.list(query));
    });
  }

  @TsRestHandler(c.listLegacy)
  async listLegacy() {
    return tsRestHandler(c.listLegacy, async ({ query }) => {
      return success(await this.loopsService.list(query));
    });
  }

  @TsRestHandler(c.createIssue)
  async createIssue(@Req() req: AuthenticatedRequest) {
    return tsRestHandler(c.createIssue, async ({ body }) => {
      // Submitter is derived server-side from the authenticated SSO user
      // (provider `dofe-sso`), ignoring any client-supplied submitter fields
      // so identity cannot be spoofed. The CLI/internal path calls the service
      // directly without a request and falls back to the `dev` defaults.
      return created(await this.loopsService.createIssue(body, req.userInfo));
    });
  }

  @TsRestHandler(c.getIssue)
  async getIssue() {
    return tsRestHandler(c.getIssue, async ({ params }) => {
      return success(await this.loopsService.getIssue(params.issueId));
    });
  }

  @TsRestHandler(c.generateSpec)
  async generateSpec() {
    return tsRestHandler(c.generateSpec, async ({ params }) => {
      return success(await this.loopsService.generateSpec(params.issueId));
    });
  }

  @TsRestHandler(c.reviewSpec)
  async reviewSpec() {
    return tsRestHandler(c.reviewSpec, async ({ params, body }) => {
      return success(await this.loopsService.reviewSpec(params.issueId, body));
    });
  }

  @TsRestHandler(c.decompose)
  async decompose() {
    return tsRestHandler(c.decompose, async ({ params }) => {
      return success(await this.loopsService.decompose(params.issueId));
    });
  }

  @TsRestHandler(c.runShardTests)
  async runShardTests() {
    return tsRestHandler(c.runShardTests, async ({ params, body }) => {
      return success(await this.loopsService.runShardTests(params.issueId, params.shardId, body));
    });
  }

  @TsRestHandler(c.recordShardImplementation)
  async recordShardImplementation() {
    return tsRestHandler(c.recordShardImplementation, async ({ params, body }) => {
      return success(
        await this.loopsService.recordShardImplementation(params.issueId, params.shardId, body),
      );
    });
  }

  @TsRestHandler(c.reviewShard)
  async reviewShard() {
    return tsRestHandler(c.reviewShard, async ({ params, body }) => {
      return success(await this.loopsService.reviewShard(params.issueId, params.shardId, body));
    });
  }

  @TsRestHandler(c.runLoop)
  async runLoop() {
    return tsRestHandler(c.runLoop, async ({ params }) => {
      return success(await this.loopsService.runLoop(params.issueId));
    });
  }

  @TsRestHandler(c.reviewGlobal)
  async reviewGlobal() {
    return tsRestHandler(c.reviewGlobal, async ({ params }) => {
      return success(await this.loopsService.reviewGlobal(params.issueId));
    });
  }

  @TsRestHandler(c.reloop)
  async reloop() {
    return tsRestHandler(c.reloop, async ({ params, body }) => {
      return success(await this.loopsService.reloop(params.issueId, body));
    });
  }

  @TsRestHandler(c.finalize)
  async finalize() {
    return tsRestHandler(c.finalize, async ({ params }) => {
      return success(await this.loopsService.finalize(params.issueId));
    });
  }

  @TsRestHandler(c.intervene)
  async intervene() {
    return tsRestHandler(c.intervene, async ({ params, body }) => {
      return success(await this.loopsService.intervene(params.issueId, body));
    });
  }

  @TsRestHandler(c.doctor)
  async doctor() {
    return tsRestHandler(c.doctor, async () => {
      return success(await this.loopsService.doctor());
    });
  }

  @TsRestHandler(c.cost)
  async cost() {
    return tsRestHandler(c.cost, async () => {
      return success(await this.loopsService.cost());
    });
  }

  @TsRestHandler(c.logs)
  async logs() {
    return tsRestHandler(c.logs, async ({ query }) => {
      return success(await this.loopsService.logs(query));
    });
  }

  @TsRestHandler(c.notifications)
  async notifications() {
    return tsRestHandler(c.notifications, async ({ query }) => {
      return success(await this.loopsService.notifications(query));
    });
  }

  @TsRestHandler(c.resume)
  async resume() {
    return tsRestHandler(c.resume, async () => {
      return success(await this.loopsService.resume());
    });
  }
}
