import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import type {
  LoopAnnotation,
  LoopDetail,
  LoopIntake,
  LoopIssue,
  LoopShard,
  LoopSpec,
  LoopStateItem,
} from '@repo/contracts';

type StateFile = {
  loops: LoopStateItem[];
};

@Injectable()
export class LoopsFileStoreService {
  private readonly root = path.join(process.cwd(), '..', '..', '.loops');

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
    const intake = await this.readJson<LoopIntake>(
      `intakes/${this.intakeId(issueId)}.json`,
    );
    const spec = await this.readOptionalJson<LoopSpec>(
      `specs/${issueId}/spec.v1.json`,
    );
    const shards = await this.readOptionalJson<LoopShard[]>(
      `shards/${issueId}/shards.json`,
    );
    const annotations = await this.readOptionalJson<LoopAnnotation[]>(
      `annotations/${issueId}.json`,
    );
    const state = (await this.readState()).loops.find(
      (item) => item.issueId === issueId,
    );

    if (!state) {
      throw new Error(`Loop state not found for ${issueId}`);
    }

    return {
      issue,
      intake,
      spec,
      shards: shards ?? [],
      annotations: annotations ?? [],
      state,
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
    await this.writeText(
      `issues/${input.issue.id}.md`,
      this.renderIssueMarkdown(input.issue),
    );
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
  }

  async writeSpec(issue: LoopIssue, spec: LoopSpec, state: LoopStateItem) {
    await fs.mkdir(path.join(this.root, 'specs', issue.id), { recursive: true });
    await this.writeJson(`specs/${issue.id}/spec.v1.json`, spec);
    await this.writeText(`specs/${issue.id}/spec.v1.md`, spec.body);
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
  }

  async writeShards(input: {
    issue: LoopIssue;
    spec: LoopSpec;
    shards: LoopShard[];
    annotations: LoopAnnotation[];
    state: LoopStateItem;
  }) {
    await fs.mkdir(path.join(this.root, 'shards', input.issue.id), {
      recursive: true,
    });
    await this.writeJson(`shards/${input.issue.id}/shards.json`, input.shards);
    await this.writeText(
      `shards/${input.issue.id}/dag.yaml`,
      this.renderDag(input.shards),
    );
    await Promise.all(
      input.shards.map((shard) =>
        this.writeText(
          `shards/${input.issue.id}/${shard.id}.md`,
          this.renderShardMarkdown(shard),
        ),
      ),
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
      required_count: input.shards.length * 2,
    });
    await this.appendLog({
      type: 'ANNOTATE',
      issue: input.issue.id,
      count: input.annotations.length,
    });
  }

  async appendLog(payload: Record<string, unknown>) {
    const entry = {
      ts: new Date().toISOString(),
      ...payload,
    };
    await fs.appendFile(
      path.join(this.root, 'log.jsonl'),
      `${JSON.stringify(entry)}\n`,
      'utf8',
    );
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

  private async readState(): Promise<StateFile> {
    await this.ensureInitialized();
    return this.readJson<StateFile>('state.json');
  }

  private async readJson<T>(relativePath: string): Promise<T> {
    const content = await fs.readFile(path.join(this.root, relativePath), 'utf8');
    return JSON.parse(content) as T;
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
}
