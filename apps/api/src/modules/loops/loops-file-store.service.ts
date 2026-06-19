import { Injectable } from '@nestjs/common';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  LoopAnnotation,
  LoopConvergencePr,
  LoopCostItem,
  LoopDetail,
  LoopGlobalReviewRecord,
  LoopImplementationRecord,
  LoopIntake,
  LoopIssue,
  LoopLogEntry,
  LoopNotification,
  LoopReviewRecord,
  LoopShard,
  LoopSpec,
  LoopStateItem,
  LoopTestMatrix,
  LoopTestRecord,
} from '@repo/contracts';

type StateFile = {
  loops: LoopStateItem[];
};

export type LoopsDoctorResult = {
  ok: boolean;
  root: string;
  loops: number;
  issues: number;
  problems: string[];
};

export type LoopsResumeResult = {
  resumed: number;
  updatedShards: Array<{
    issueId: string;
    shardId: string;
    from: string;
    to: string;
  }>;
};

type LoopsCostConfig = {
  tokenCapPerLoop: number;
  callCapPerLoop: number;
};

@Injectable()
export class LoopsFileStoreService {
  private readonly root = path.join(this.findWorkspaceRoot(), '.loops');

  async ensureInitialized() {
    await Promise.all(
      [
        'issues',
        'intakes',
        'specs',
        'shards',
        'tests',
        'runs',
        'annotations',
        'notifications',
        'archive',
      ].map((dir) => fs.mkdir(path.join(this.root, dir), { recursive: true })),
    );

    await this.writeJsonIfMissing('state.json', { loops: [] });
    await this.writeTextIfMissing('log.jsonl', '');
  }

  async list() {
    await this.ensureInitialized();
    const state = await this.readState();
    const issues = await this.readAllIssues();
    return { issues, loops: state.loops };
  }

  async readDetail(issueId: string): Promise<LoopDetail> {
    await this.ensureInitialized();
    const issue = await this.readJson<LoopIssue>(`issues/${issueId}.json`);
    const intake = await this.readJson<LoopIntake>(`intakes/${this.intakeId(issueId)}.json`);
    const state = (await this.readState()).loops.find((item) => item.issueId === issueId);

    if (!state) {
      throw new Error(`Loop state not found for ${issueId}`);
    }

    const spec =
      state.specVersion === 'v0'
        ? undefined
        : await this.readOptionalJson<LoopSpec>(`specs/${issueId}/spec.${state.specVersion}.json`);
    const shards = await this.readOptionalJson<LoopShard[]>(`shards/${issueId}/shards.json`);
    const testMatrix = await this.readOptionalJson<LoopTestMatrix>(`tests/${issueId}/matrix.json`);
    const annotations = await this.readOptionalJson<LoopAnnotation[]>(
      `annotations/${issueId}.json`,
    );
    const implementationRecords = await this.readImplementationRecords(issueId);
    const reviewRecords = await this.readReviewRecords(issueId);
    const testRecords = await this.readTestRecords(issueId);
    const logs = await this.readLogs({ issueId, limit: 40 });
    const notifications = await this.readNotifications({ issueId, limit: 20 });
    const globalReview = await this.readOptionalJson<LoopGlobalReviewRecord>(
      `runs/${issueId}/global-review.json`,
    );
    const convergencePr = await this.readOptionalJson<LoopConvergencePr>(
      `runs/${issueId}/convergence-pr.json`,
    );

    return {
      issue,
      intake,
      spec,
      shards: shards ?? [],
      testMatrix,
      annotations: annotations ?? [],
      implementationRecords,
      reviewRecords,
      testRecords,
      logs,
      notifications,
      state,
      globalReview,
      convergencePr,
    };
  }

  async readLogs(input: { issueId?: string; limit?: number } = {}) {
    await this.ensureInitialized();
    const content = await fs.readFile(path.join(this.root, 'log.jsonl'), 'utf8').catch(() => '');
    const entries = content
      .split('\n')
      .filter(Boolean)
      .map((line) => this.parseLogLine(line))
      .filter((entry): entry is LoopLogEntry => Boolean(entry))
      .filter((entry) => {
        if (!input.issueId) return true;
        return entry.loop === input.issueId || entry.issue === input.issueId;
      })
      .sort((a, b) => b.ts.localeCompare(a.ts));

    return entries.slice(0, input.limit ?? 50);
  }

  async readNotifications(input: { issueId?: string; limit?: number } = {}) {
    await this.ensureInitialized();
    const issueIds = input.issueId
      ? [input.issueId]
      : await fs
          .readdir(path.join(this.root, 'notifications'))
          .catch(() => [])
          .then((entries) => entries.filter((entry) => !entry.startsWith('.')));
    const notifications = await Promise.all(
      issueIds.map(async (issueId) => {
        const dir = path.join(this.root, 'notifications', issueId);
        const files = await fs.readdir(dir).catch(() => []);
        return Promise.all(
          files
            .filter((file) => file.endsWith('.json'))
            .map((file) => this.readJson<LoopNotification>(`notifications/${issueId}/${file}`)),
        );
      }),
    );

    return notifications
      .flat()
      .sort((a, b) => b.created.localeCompare(a.created))
      .slice(0, input.limit ?? 50);
  }

  async doctor(): Promise<LoopsDoctorResult> {
    await this.ensureInitialized();
    const state = await this.readState();
    const issues = await this.readAllIssues();
    const problems: string[] = [];

    for (const loop of state.loops) {
      const issue = issues.find((item) => item.id === loop.issueId);
      if (!issue) {
        problems.push(`state references missing issue ${loop.issueId}`);
        continue;
      }

      const intakePath = path.join(this.root, 'intakes', `${this.intakeId(loop.issueId)}.json`);
      if (!(await this.exists(intakePath))) {
        problems.push(`missing intake for ${loop.issueId}`);
      }

      if (loop.specVersion !== 'v0') {
        const specPath = path.join(this.root, 'specs', loop.issueId, `spec.${loop.specVersion}.json`);
        if (!(await this.exists(specPath))) {
          problems.push(`missing spec ${loop.specVersion} for ${loop.issueId}`);
        }
      }

      if (loop.shardsTotal > 0) {
        const shardPath = path.join(this.root, 'shards', loop.issueId, 'shards.json');
        if (!(await this.exists(shardPath))) {
          problems.push(`missing shards for ${loop.issueId}`);
        }

        const matrixPath = path.join(this.root, 'tests', loop.issueId, 'matrix.json');
        if (!(await this.exists(matrixPath))) {
          problems.push(`missing test matrix for ${loop.issueId}`);
        }
      }
    }

    return {
      ok: problems.length === 0,
      root: this.root,
      loops: state.loops.length,
      issues: issues.length,
      problems,
    };
  }

  async readCost() {
    await this.ensureInitialized();
    const state = await this.readState();
    const config = await this.readCostConfig();
    const loops: LoopCostItem[] = state.loops.map((loop) => ({
      issueId: loop.issueId,
      costTokens: loop.costTokens,
      costCalls: loop.costCalls,
      tokenCap: config.tokenCapPerLoop,
      callCap: config.callCapPerLoop,
      tokensRemaining: Math.max(0, config.tokenCapPerLoop - loop.costTokens),
      callsRemaining: Math.max(0, config.callCapPerLoop - loop.costCalls),
      paused: loop.paused,
      tripped: loop.costTokens >= config.tokenCapPerLoop || loop.costCalls >= config.callCapPerLoop,
    }));
    return { loops };
  }

  async enforceCostGuard(loop: LoopStateItem): Promise<LoopStateItem> {
    const config = await this.readCostConfig();
    const tripped =
      loop.costTokens >= config.tokenCapPerLoop || loop.costCalls >= config.callCapPerLoop;
    if (!tripped) return loop;

    const next: LoopStateItem = {
      ...loop,
      phase: 'PAUSED',
      paused: true,
      updated: new Date().toISOString(),
    };
    await this.appendLog({
      type: 'COST_TRIP',
      loop: loop.issueId,
      cost_tokens: loop.costTokens,
      cost_calls: loop.costCalls,
      token_cap: config.tokenCapPerLoop,
      call_cap: config.callCapPerLoop,
    });
    await this.writeNotification({
      issueId: loop.issueId,
      channel: 'web',
      kind: 'COST_GUARD_TRIPPED',
      recipient: 'ops',
      title: `Cost guard tripped: ${loop.issueId}`,
      body: `Loop was paused after reaching ${loop.costCalls}/${config.callCapPerLoop} calls and ${loop.costTokens}/${config.tokenCapPerLoop} tokens.`,
      actionHref: `/loops/${loop.issueId}`,
    });
    return next;
  }

  async resumeInterruptedLoops(): Promise<LoopsResumeResult> {
    await this.ensureInitialized();
    const state = await this.readState();
    const updatedShards: LoopsResumeResult['updatedShards'] = [];

    for (const loop of state.loops) {
      const shards = await this.readOptionalJson<LoopShard[]>(`shards/${loop.issueId}/shards.json`);
      if (!shards?.length) continue;

      let changed = false;
      const nextShards = shards.map((shard) => {
        if (shard.status !== 'IN_PROGRESS' && shard.status !== 'TIMEOUT') {
          return shard;
        }
        changed = true;
        updatedShards.push({
          issueId: loop.issueId,
          shardId: shard.id,
          from: shard.status,
          to: 'TODO',
        });
        return { ...shard, status: 'TODO' as const };
      });

      if (!changed) continue;

      await this.writeJson(`shards/${loop.issueId}/shards.json`, nextShards);
      await this.writeText(`shards/${loop.issueId}/dag.yaml`, this.renderDag(nextShards));
      const nextState: LoopStateItem = {
        ...loop,
        shardsInProgress: 0,
        updated: new Date().toISOString(),
        paused: false,
      };
      await this.upsertState(nextState);
      await this.appendLog({
        type: 'HUMAN_INTERVENE',
        loop: loop.issueId,
        action: 'resume',
        reset_shards: updatedShards
          .filter((item) => item.issueId === loop.issueId)
          .map((item) => item.shardId),
      });
    }

    return {
      resumed: updatedShards.length,
      updatedShards,
    };
  }

  async writeIssue(input: {
    issue: LoopIssue;
    intake: LoopIntake;
    state: LoopStateItem;
    rawPayload: unknown;
  }) {
    await this.ensureInitialized();
    await this.writeJson(`issues/${input.issue.id}.json`, input.issue);
    await this.writeText(`issues/${input.issue.id}.md`, this.renderIssueMarkdown(input.issue));
    await this.writeJson(`intakes/${input.intake.id}.json`, input.intake);
    await this.writeText(
      `intakes/${input.intake.id}.md`,
      this.renderIntakeMarkdown(input.intake, input.issue),
    );
    await this.writeJson(`intakes/${input.intake.id}.raw.json`, input.rawPayload);
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'INTAKE_RECEIVED',
      source: 'web',
      intake: input.intake.id,
      submitter: input.issue.submitterId,
    });
    await this.appendLog({
      type: 'ISSUE_NORMALIZED',
      issue: input.issue.id,
      intake: input.intake.id,
      target_repo: input.issue.targetRepo,
    });
    await this.writeNotification({
      issueId: input.issue.id,
      channel: 'web',
      kind: 'ISSUE_RECEIVED',
      recipient: input.issue.submitterId,
      title: `Issue received: ${input.issue.title}`,
      body: `Issue ${input.issue.id} has been normalized and queued for planning.`,
      actionHref: `/loops/${input.issue.id}`,
    });
  }

  async writeSpec(issue: LoopIssue, spec: LoopSpec, state: LoopStateItem) {
    await fs.mkdir(path.join(this.root, 'specs', issue.id), { recursive: true });
    await this.writeJson(`specs/${issue.id}/spec.${spec.version}.json`, spec);
    await this.writeText(`specs/${issue.id}/spec.${spec.version}.md`, spec.body);
    await this.writeJson(`issues/${issue.id}.json`, {
      ...issue,
      status: 'IN_LOOP',
      updated: state.updated,
    });
    await this.upsertState(state);
    await this.appendLog({
      type: 'SPEC_STATE',
      issue: issue.id,
      spec: spec.id,
      to: spec.status,
    });
    if (spec.status === 'DRAFT') {
      await this.writeNotification({
        issueId: issue.id,
        channel: 'web',
        kind: 'SPEC_REVIEW_REQUESTED',
        recipient: issue.submitterId,
        title: `Spec review requested: ${issue.title}`,
        body: `Spec ${spec.version} is ready for human review before decomposition.`,
        actionHref: `/loops/${issue.id}`,
      });
    }
  }

  async writeShards(input: {
    issue: LoopIssue;
    spec: LoopSpec;
    shards: LoopShard[];
    testMatrix: LoopTestMatrix;
    annotations: LoopAnnotation[];
    state: LoopStateItem;
  }) {
    await fs.mkdir(path.join(this.root, 'shards', input.issue.id), {
      recursive: true,
    });
    await this.writeJson(`shards/${input.issue.id}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issue.id}/dag.yaml`, this.renderDag(input.shards));
    await Promise.all(
      input.shards.map((shard) =>
        this.writeText(`shards/${input.issue.id}/${shard.id}.md`, this.renderShardMarkdown(shard)),
      ),
    );
    await this.writeJson(`tests/${input.issue.id}/matrix.json`, input.testMatrix);
    await this.writeText(
      `tests/${input.issue.id}/matrix.md`,
      this.renderTestMatrix(input.testMatrix),
    );
    await this.writeJson(`annotations/${input.issue.id}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issue.id}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'TEST_MATRIX',
      issue: input.issue.id,
      spec: input.spec.id,
      required_count: input.testMatrix.requiredTests.length,
    });
    await this.appendLog({
      type: 'ANNOTATE',
      issue: input.issue.id,
      count: input.annotations.length,
    });
    await this.writeNotification({
      issueId: input.issue.id,
      channel: 'web',
      kind: 'LOOP_STARTED',
      recipient: input.issue.submitterId,
      title: `Loop implementation started: ${input.issue.title}`,
      body: `${input.shards.length} shards have been generated and are ready for implementation.`,
      actionHref: `/loops/${input.issue.id}`,
    });
  }

  async writeTestRecord(input: {
    issueId: string;
    shardId: string;
    record: LoopTestRecord;
    annotations: LoopAnnotation[];
    shards: LoopShard[];
    state: LoopStateItem;
  }) {
    const recordDir = `tests/${input.issueId}/records`;
    await this.writeJson(`${recordDir}/${input.record.id}.json`, input.record);
    await this.writeText(`${recordDir}/${input.record.id}.md`, this.renderTestRecord(input.record));
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'TEST_RUN',
      loop: input.issueId,
      shard: input.shardId,
      status: input.record.status,
      commands: input.record.commands.map((item) => item.command),
    });
  }

  async writeImplementationRecord(input: {
    issueId: string;
    shardId: string;
    record: LoopImplementationRecord;
    annotations: LoopAnnotation[];
    shards: LoopShard[];
    state: LoopStateItem;
  }) {
    const recordDir = `runs/${input.issueId}/${input.shardId}/round-${input.record.round}`;
    await this.writeJson(`${recordDir}/implementation.json`, input.record);
    await this.writeText(
      `${recordDir}/implementation.md`,
      this.renderImplementationRecord(input.record),
    );
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'IMPLEMENTATION_RECORD',
      loop: input.issueId,
      shard: input.shardId,
      status: input.record.status,
      implementer: input.record.implementer,
      changed_files: input.record.changedFiles,
    });
  }

  async writeReviewRecord(input: {
    issueId: string;
    shardId: string;
    record: LoopReviewRecord;
    annotations: LoopAnnotation[];
    shards: LoopShard[];
    state: LoopStateItem;
  }) {
    const recordDir = `runs/${input.issueId}/${input.shardId}/round-${input.record.round}`;
    await this.writeJson(`${recordDir}/review.json`, input.record);
    await this.writeText(`${recordDir}/review.md`, this.renderReviewRecord(input.record));
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
    await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'REVIEW_RECORD',
      loop: input.issueId,
      shard: input.shardId,
      verdict: input.record.verdict,
      reviewer: input.record.reviewer,
    });
    if (input.state.phase === 'PHASE_6_CONVERGE') {
      await this.writeNotification({
        issueId: input.issueId,
        channel: 'web',
        kind: 'CONVERGENCE_READY',
        recipient: input.record.reviewer,
        title: `Loop ready to converge: ${input.issueId}`,
        body: 'All shards are marked DONE and the loop is ready for convergence review.',
        actionHref: `/loops/${input.issueId}`,
      });
    }
  }

  async writeGlobalReview(input: {
    issueId: string;
    record: LoopGlobalReviewRecord;
    annotations: LoopAnnotation[];
    state: LoopStateItem;
  }) {
    await this.writeJson(`runs/${input.issueId}/global-review.json`, input.record);
    await this.writeText(
      `runs/${input.issueId}/global-review.md`,
      this.renderGlobalReviewRecord(input.record),
    );
    await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issueId}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'GLOBAL_REVIEW',
      loop: input.issueId,
      verdict: input.record.verdict,
      reviewer: input.record.reviewer,
    });
  }

  async writeFinalize(input: {
    issue: LoopIssue;
    annotations: LoopAnnotation[];
    state: LoopStateItem;
    convergencePr: LoopConvergencePr;
  }) {
    await this.writeJson(`annotations/${input.issue.id}.json`, input.annotations);
    await this.writeText(
      `annotations/${input.issue.id}.yaml`,
      this.renderAnnotations(input.annotations),
    );
    await this.writeJson(`runs/${input.issue.id}/convergence-pr.json`, input.convergencePr);
    await this.writeText(
      `runs/${input.issue.id}/convergence-pr.md`,
      input.convergencePr.prBody,
    );
    await this.writeJson(`issues/${input.issue.id}.json`, {
      ...input.issue,
      status: 'CLOSED',
      updated: input.state.updated,
    });
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'FINAL_ANNOTATE',
      loop: input.issue.id,
      status: input.convergencePr.status,
      pr: input.convergencePr.id,
    });
  }

  async writeIntervention(input: {
    issueId: string;
    action: string;
    actor: string;
    state: LoopStateItem;
    shards?: LoopShard[];
    annotations?: LoopAnnotation[];
    shardId?: string;
    notes?: string;
  }) {
    if (input.shards) {
      await this.writeJson(`shards/${input.issueId}/shards.json`, input.shards);
      await this.writeText(`shards/${input.issueId}/dag.yaml`, this.renderDag(input.shards));
    }
    if (input.annotations) {
      await this.writeJson(`annotations/${input.issueId}.json`, input.annotations);
      await this.writeText(
        `annotations/${input.issueId}.yaml`,
        this.renderAnnotations(input.annotations),
      );
    }
    await this.upsertState(input.state);
    await this.appendLog({
      type: 'HUMAN_INTERVENE',
      loop: input.issueId,
      action: input.action,
      actor: input.actor,
      shard: input.shardId,
      notes: input.notes,
    });
    await this.writeNotification({
      issueId: input.issueId,
      channel: 'web',
      kind: 'HUMAN_INTERVENTION',
      recipient: input.actor,
      title: `Human intervention: ${input.action}`,
      body: input.shardId
        ? `${input.actor} performed ${input.action} on ${input.shardId}.`
        : `${input.actor} performed ${input.action} on the loop.`,
      actionHref: `/loops/${input.issueId}`,
    });
  }

  async writeNotification(input: Omit<LoopNotification, 'id' | 'created' | 'status'>) {
    const created = new Date().toISOString();
    const notification: LoopNotification = {
      ...input,
      id: `notification-${input.issueId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      status: 'RECORDED',
      created,
    };
    await this.writeJson(`notifications/${input.issueId}/${notification.id}.json`, notification);
    await this.writeText(
      `notifications/${input.issueId}/${notification.id}.md`,
      this.renderNotification(notification),
    );
    await this.appendLog({
      type: 'NOTIFY_SENT',
      issue: input.issueId,
      channel: input.channel,
      kind: input.kind,
      recipient: input.recipient,
      status: notification.status,
    });
    return notification;
  }

  async appendLog(payload: Record<string, unknown>) {
    const entry = {
      ts: new Date().toISOString(),
      ...payload,
    };
    await fs.appendFile(path.join(this.root, 'log.jsonl'), `${JSON.stringify(entry)}\n`, 'utf8');
  }

  async upsertState(next: LoopStateItem) {
    const state = await this.readState();
    const index = state.loops.findIndex((item) => item.issueId === next.issueId);
    if (index >= 0) {
      state.loops[index] = next;
    } else {
      state.loops.unshift(next);
    }
    await this.writeJson('state.json', state);
  }

  intakeId(issueId: string) {
    return issueId.replace('issue-', 'intake-') + '-a';
  }

  private async readAllIssues() {
    const dir = path.join(this.root, 'issues');
    const files = await fs.readdir(dir).catch(() => []);
    const issues = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => this.readJson<LoopIssue>(`issues/${file}`)),
    );
    return issues.sort((a, b) => b.created.localeCompare(a.created));
  }

  private async readTestRecords(issueId: string) {
    const dir = path.join(this.root, 'tests', issueId, 'records');
    const files = await fs.readdir(dir).catch(() => []);
    const records = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map((file) => this.readJson<LoopTestRecord>(`tests/${issueId}/records/${file}`)),
    );
    return records.sort((a, b) => b.created.localeCompare(a.created));
  }

  private async readImplementationRecords(issueId: string) {
    return this.readRunRecords<LoopImplementationRecord>(issueId, 'implementation.json');
  }

  private async readReviewRecords(issueId: string) {
    return this.readRunRecords<LoopReviewRecord>(issueId, 'review.json');
  }

  private async readRunRecords<T extends { created: string }>(issueId: string, filename: string) {
    const issueDir = path.join(this.root, 'runs', issueId);
    const shardIds = await fs.readdir(issueDir).catch(() => []);
    const recordPaths: string[] = [];

    for (const shardId of shardIds) {
      const shardDir = path.join(issueDir, shardId);
      const rounds = await fs.readdir(shardDir).catch(() => []);
      for (const round of rounds.filter((item) => item.startsWith('round-'))) {
        const recordPath = path.join(shardDir, round, filename);
        if (await this.exists(recordPath)) {
          recordPaths.push(`runs/${issueId}/${shardId}/${round}/${filename}`);
        }
      }
    }

    const records = await Promise.all(
      recordPaths.map((recordPath) => this.readJson<T>(recordPath)),
    );
    return records.sort((a, b) => b.created.localeCompare(a.created));
  }

  private async readState(): Promise<StateFile> {
    await this.ensureInitialized();
    return this.readJson<StateFile>('state.json');
  }

  private async readCostConfig(): Promise<LoopsCostConfig> {
    const fallback = {
      tokenCapPerLoop: 5000000,
      callCapPerLoop: 500,
    };
    const content = await fs.readFile(path.join(this.root, 'config.yaml'), 'utf8').catch(() => '');
    const tokenMatch = content.match(/token_cap_per_loop:\s*(\d+)/);
    const callMatch = content.match(/call_cap_per_loop:\s*(\d+)/);
    return {
      tokenCapPerLoop: tokenMatch ? Number(tokenMatch[1]) : fallback.tokenCapPerLoop,
      callCapPerLoop: callMatch ? Number(callMatch[1]) : fallback.callCapPerLoop,
    };
  }

  private async readJson<T>(relativePath: string): Promise<T> {
    const content = await fs.readFile(path.join(this.root, relativePath), 'utf8');
    return JSON.parse(content) as T;
  }

  private parseLogLine(line: string): LoopLogEntry | undefined {
    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      const ts = typeof raw.ts === 'string' ? raw.ts : '';
      const type = typeof raw.type === 'string' ? raw.type : '';
      if (!ts || !type) return undefined;
      return {
        ts,
        type,
        loop: typeof raw.loop === 'string' ? raw.loop : undefined,
        issue: typeof raw.issue === 'string' ? raw.issue : undefined,
        shard: typeof raw.shard === 'string' ? raw.shard : undefined,
        action: typeof raw.action === 'string' ? raw.action : undefined,
        status: typeof raw.status === 'string' ? raw.status : undefined,
        verdict: typeof raw.verdict === 'string' ? raw.verdict : undefined,
        payload: raw,
      };
    } catch {
      return undefined;
    }
  }

  private async exists(target: string) {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  }

  private async readOptionalJson<T>(relativePath: string): Promise<T | undefined> {
    try {
      return await this.readJson<T>(relativePath);
    } catch {
      return undefined;
    }
  }

  private async writeJson(relativePath: string, data: unknown) {
    const target = path.join(this.root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  private async writeText(relativePath: string, content: string) {
    const target = path.join(this.root, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }

  private async writeJsonIfMissing(relativePath: string, data: unknown) {
    try {
      await fs.access(path.join(this.root, relativePath));
    } catch {
      await this.writeJson(relativePath, data);
    }
  }

  private async writeTextIfMissing(relativePath: string, content: string) {
    try {
      await fs.access(path.join(this.root, relativePath));
    } catch {
      await this.writeText(relativePath, content);
    }
  }

  private renderIssueMarkdown(issue: LoopIssue) {
    return `---\nid: ${issue.id}\ntitle: ${issue.title}\nstatus: ${issue.status}\npriority: ${issue.priority}\ncreated: ${issue.created}\nsource_channel: ${issue.sourceChannel}\nsubmitter_id: ${issue.submitterId}\ntarget_repo: ${issue.targetRepo}\n---\n\n${issue.body}\n\n## Acceptance Criteria\n${issue.acceptanceCriteria.map((item) => `- [ ] ${item}`).join('\n')}\n`;
  }

  private renderIntakeMarkdown(intake: LoopIntake, issue: LoopIssue) {
    return `---\nid: ${intake.id}\nissue: ${issue.id}\nsource_channel: ${intake.sourceChannel}\nsource_kind: ${intake.sourceKind}\nraw_payload_ref: ${intake.rawPayloadRef}\nstatus: ${intake.status}\n---\n\n## 原始消息摘要\n${issue.title}\n\n## 归一化结果\n- target_repo: ${issue.targetRepo}\n- priority: ${issue.priority}\n\n## 追问与补充\n暂无\n`;
  }

  private renderShardMarkdown(shard: LoopShard) {
    return `---\nid: ${shard.id}\nspec: ${shard.specId} / v1\ntitle: ${shard.title}\nstatus: ${shard.status}\npriority: ${shard.priority}\ndepends_on: [${shard.dependsOn.join(', ')}]\nest_context: ${shard.estContext}\nest_effort: ${shard.estEffort}\n---\n\n## 目标\n${shard.title}\n\n## 实施要求\n${shard.acceptance.map((item) => `- [ ] ${item}`).join('\n')}\n\n## 测试要求\n${[...shard.testRequirements.unit, ...shard.testRequirements.integration, ...shard.testRequirements.e2e].map((item) => `- ${item}`).join('\n')}\n`;
  }

  private renderDag(shards: LoopShard[]) {
    return shards
      .map(
        (shard) =>
          `${shard.id}:\n  depends_on: [${shard.dependsOn.join(', ')}]\n  status: ${shard.status}`,
      )
      .join('\n');
  }

  private renderAnnotations(annotations: LoopAnnotation[]) {
    return annotations
      .map(
        (item) =>
          `- target: ${item.target}\n  annotator: ${item.annotator}\n  round: ${item.round}\n  impl_status: ${item.implStatus}\n  test_status: ${item.testStatus}\n  verdict: ${item.verdict}\n  coverage: ${item.coverage}\n  risk: ${item.risk}\n  notes: ${JSON.stringify(item.notes)}`,
      )
      .join('\n');
  }

  private renderTestRecord(record: LoopTestRecord) {
    const commands = record.commands
      .map(
        (item) =>
          `- \`${item.command}\` exit=${item.exitCode ?? 'null'} duration=${item.durationMs}ms`,
      )
      .join('\n');
    const failures =
      record.failedTests.length > 0
        ? record.failedTests.map((item) => `- ${item.name}: ${item.reason}`).join('\n')
        : '无';
    return `---\nid: ${record.id}\nscope: ${record.shardId}\nround: ${record.round}\nrunner: ${record.runner}\nreviewer: ${record.reviewer}\nstatus: ${record.status}\ncreated: ${record.created}\n---\n\n## 测试执行摘要\n${commands}\n\n## 失败归因\n${failures}\n\n## 修复指令\n${record.fixInstructions.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderTestMatrix(matrix: LoopTestMatrix) {
    const requiredTests = matrix.requiredTests
      .map(
        (item) =>
          `- [${item.required ? 'x' : ' '}] ${item.id} (${item.level}) ${item.shardId}: ${item.title}${item.command ? `\n  - command: \`${item.command}\`` : ''}`,
      )
      .join('\n');
    return `---\nid: ${matrix.id}\nissue: ${matrix.issueId}\nspec: ${matrix.specId}\nowner: ${matrix.owner}\nstatus: ${matrix.status}\ncreated: ${matrix.created}\n---\n\n## 测试矩阵说明\n${requiredTests || '无'}\n\n## 回归范围\n${matrix.regressionScope.map((item) => `- ${item}`).join('\n') || '无'}\n\n## 暂不自动化的人工验收项\n${matrix.manualAcceptance.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderImplementationRecord(record: LoopImplementationRecord) {
    return `---\nid: ${record.id}\nscope: ${record.shardId}\nround: ${record.round}\nimplementer: ${record.implementer}\nstatus: ${record.status}\ncreated: ${record.created}\n---\n\n## 实施摘要\n${record.summary}\n\n## 变更文件\n${record.changedFiles.map((item) => `- ${item}`).join('\n') || '无'}\n\n## 备注\n${record.notes || '无'}\n`;
  }

  private renderReviewRecord(record: LoopReviewRecord) {
    const issues =
      record.issues.length > 0
        ? record.issues.map((item) => `- ${item.severity}: ${item.desc}`).join('\n')
        : '无';
    return `---\nid: ${record.id}\nshard: ${record.shardId}\nreviewer: ${record.reviewer}\nround: ${record.round}\nverdict: ${record.verdict}\ncreated: ${record.created}\n---\n\n## 审查意见\n${record.summary}\n\n## 问题\n${issues}\n\n## 修复指令\n${record.fixInstructions.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderGlobalReviewRecord(record: LoopGlobalReviewRecord) {
    const issues =
      record.issues.length > 0
        ? record.issues.map((item) => `- ${item.severity}: ${item.desc}`).join('\n')
        : '无';
    return `---\nid: ${record.id}\nissue: ${record.issueId}\nreviewer: ${record.reviewer}\nround: ${record.round}\nverdict: ${record.verdict}\ncreated: ${record.created}\n---\n\n## 整体复查结论\n${record.summary}\n\n## 问题\n${issues}\n\n## 修复指令\n${record.fixInstructions.map((item) => `- ${item}`).join('\n') || '无'}\n`;
  }

  private renderNotification(notification: LoopNotification) {
    return `---\nid: ${notification.id}\nissue: ${notification.issueId}\nchannel: ${notification.channel}\nkind: ${notification.kind}\nrecipient: ${notification.recipient}\nstatus: ${notification.status}\ncreated: ${notification.created}\n---\n\n## ${notification.title}\n\n${notification.body}\n\n${notification.actionHref ? `Action: ${notification.actionHref}\n` : ''}`;
  }

  private findWorkspaceRoot() {
    let current = process.env.LOOPS_WORKSPACE_ROOT || process.cwd();
    for (;;) {
      const packageJson = path.join(current, 'package.json');
      const turboJson = path.join(current, 'turbo.json');
      try {
        if (existsSync(packageJson) && existsSync(turboJson)) {
          return current;
        }
      } catch {
        return process.cwd();
      }

      const parent = path.dirname(current);
      if (parent === current) {
        return process.cwd();
      }
      current = parent;
    }
  }
}
