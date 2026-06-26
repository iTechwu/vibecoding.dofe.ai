import { Injectable } from '@nestjs/common';
import type { LoopCapabilitiesResponse, LoopCapabilityItem } from '@repo/contracts';

/**
 * Static Loops capability + agent/tool registry.
 *
 * Extracted verbatim from `LoopsService.capabilities()` (R14) where it was
 * ~294 lines of inline data. Pure data with a derived summary — zero
 * behaviour change — pulled out so `LoopsService` stays focused on
 * orchestration. The only consumer is `LoopsService.capabilities()`.
 */
@Injectable()
export class LoopsCapabilityRegistry {
  build(): LoopCapabilitiesResponse {
    const capabilities: LoopCapabilityItem[] = [
      {
        id: 'codex-claude-adapters',
        label: 'Codex / Claude Code Adapters',
        category: 'agent',
        status: 'done',
        summary: 'Primary implementation and review agents are wired into the Loops lifecycle.',
        currentFoundation: [
          'Codex and Claude adapter interfaces exist behind deterministic service boundaries.',
          'Loop execution records implementation, review, test, and final annotation evidence.',
        ],
        nextSteps: ['Promote adapter health and model routing into the registry view.'],
        risks: [],
      },
      {
        id: 'a2a-tool-registry',
        label: 'A2A / Tool Registry',
        category: 'tool',
        status: 'in-progress',
        summary:
          'Expose agent-to-agent capabilities, tool ownership, permissions, and compatibility checks as a deterministic registry.',
        currentFoundation: [
          'Codex and Claude adapters already run behind stable Loops service contracts.',
          'Capability registry API now provides a product-visible planning index.',
          'Agent/tool ownership and deterministic execution boundaries are now represented in the registry payload.',
        ],
        nextSteps: [
          'Add third-party agent lifecycle states and compatibility checks.',
          'Promote registry entries from static service metadata to admin-managed configuration.',
        ],
        risks: ['Tool execution permissions and tenant isolation require explicit policy review.'],
        agentToolRegistry: {
          agents: [
            {
              id: 'codex-planner-reviewer',
              label: 'Codex Planner / Reviewer',
              provider: 'codex',
              lifecycle: 'active',
              responsibilities: [
                'Normalize initial requirements into specs and shards.',
                'Review implementation evidence before convergence.',
                'Refresh final annotations and requirement coverage.',
              ],
              supportedPhases: [
                'PHASE_1_SPEC',
                'PHASE_2_REVIEW',
                'PHASE_3_DECOMPOSE',
                'PHASE_5_REVIEW',
                'PHASE_7_GLOBAL_REVIEW',
                'PHASE_8_ANNOTATE',
              ],
              permissions: ['read-repo', 'run-tests', 'human-approval-required'],
              toolIds: ['spec-shard-planner', 'implementation-reviewer', 'trace-evidence-reader'],
            },
            {
              id: 'claude-code-implementer',
              label: 'Claude Code Implementer',
              provider: 'claude-code',
              lifecycle: 'active',
              responsibilities: [
                'Implement approved shards inside the target repository.',
                'Report changed files, tests changed, duration, and token/call estimates.',
              ],
              supportedPhases: ['PHASE_4_IMPLEMENT'],
              permissions: ['read-repo', 'write-repo', 'run-tests', 'human-approval-required'],
              toolIds: ['repo-code-editor', 'test-runner', 'trace-evidence-reader'],
            },
            {
              id: 'third-party-agent-slot',
              label: 'Third-party Agent Slot',
              provider: 'third-party',
              lifecycle: 'planned',
              responsibilities: [
                'Declare compatible phases, permissions, and tool ownership before execution.',
                'Pass registry compatibility checks before receiving loop work.',
              ],
              supportedPhases: ['PHASE_4_IMPLEMENT', 'PHASE_5_REVIEW'],
              permissions: ['read-repo', 'human-approval-required'],
              toolIds: [],
            },
          ],
          tools: [
            {
              id: 'spec-shard-planner',
              label: 'Spec / Shard Planner',
              kind: 'artifact',
              lifecycle: 'active',
              ownerAgentIds: ['codex-planner-reviewer'],
              permissions: ['read-repo'],
              deterministicBoundary:
                'Writes spec, shard, test matrix, and annotation records through LoopsService only.',
              compatibility: { codex: true, claudeCode: false, thirdParty: 'planned' },
            },
            {
              id: 'repo-code-editor',
              label: 'Repository Code Editor',
              kind: 'code-execution',
              lifecycle: 'active',
              ownerAgentIds: ['claude-code-implementer'],
              permissions: ['read-repo', 'write-repo', 'human-approval-required'],
              deterministicBoundary:
                'Requires approved shard scope and records changed files before review.',
              compatibility: { codex: false, claudeCode: true, thirdParty: 'planned' },
            },
            {
              id: 'test-runner',
              label: 'Shard Test Runner',
              kind: 'test',
              lifecycle: 'active',
              ownerAgentIds: ['claude-code-implementer', 'codex-planner-reviewer'],
              permissions: ['run-tests'],
              deterministicBoundary:
                'Runs only recorded test commands and persists stdout/stderr in test records.',
              compatibility: { codex: true, claudeCode: true, thirdParty: 'planned' },
            },
            {
              id: 'implementation-reviewer',
              label: 'Implementation Reviewer',
              kind: 'review',
              lifecycle: 'active',
              ownerAgentIds: ['codex-planner-reviewer'],
              permissions: ['read-repo'],
              deterministicBoundary:
                'Consumes implementation and test records, then emits PASS/NEEDS-WORK/FAIL.',
              compatibility: { codex: true, claudeCode: false, thirdParty: 'planned' },
            },
            {
              id: 'convergence-pr-provider',
              label: 'Convergence PR Provider',
              kind: 'git',
              lifecycle: 'experimental',
              ownerAgentIds: ['codex-planner-reviewer'],
              permissions: ['read-repo', 'create-pr', 'human-approval-required'],
              deterministicBoundary:
                'Creates convergence PR evidence only after all shards pass global review.',
              compatibility: { codex: true, claudeCode: false, thirdParty: 'unsupported' },
            },
            {
              id: 'human-notification-sender',
              label: 'Human Notification Sender',
              kind: 'notification',
              lifecycle: 'active',
              ownerAgentIds: ['codex-planner-reviewer'],
              permissions: ['notify-human'],
              deterministicBoundary:
                'Records notification attempts and skips external channels without configuration.',
              compatibility: { codex: true, claudeCode: false, thirdParty: 'planned' },
            },
            {
              id: 'trace-evidence-reader',
              label: 'Trace Evidence Reader',
              kind: 'artifact',
              lifecycle: 'active',
              ownerAgentIds: ['codex-planner-reviewer', 'claude-code-implementer'],
              permissions: ['read-repo'],
              deterministicBoundary:
                'Reads Loops logs, records, and evidence artifacts without arbitrary file access.',
              compatibility: { codex: true, claudeCode: true, thirdParty: 'planned' },
            },
          ],
          compatibilityChecks: [
            {
              id: 'phase-tool-ownership',
              status: 'pass',
              summary: 'Every active tool is owned by at least one active Loops agent.',
            },
            {
              id: 'write-repo-approval-boundary',
              status: 'pass',
              summary: 'Repository write tools require human approval and shard scope.',
            },
            {
              id: 'third-party-lifecycle',
              status: 'planned',
              summary:
                'Third-party agents must declare lifecycle, permissions, and compatible tools before execution.',
            },
          ],
        },
      },
      {
        id: 'feishu-integration',
        label: 'Feishu Integration',
        category: 'integration',
        status: 'planned',
        summary: 'Support Feishu as an intake, approval, and notification channel.',
        currentFoundation: [
          'Loops notification sender supports Feishu webhook configuration.',
          'Notification records are already visible in the control plane.',
        ],
        nextSteps: [
          'Add Feishu intake client and signed webhook validation.',
          'Map Feishu approval commands into Loops intervention actions.',
        ],
        risks: ['Workspace credentials and command permission mapping are deployment-specific.'],
      },
      {
        id: 'remote-pr-diff',
        label: 'Remote PR / Diff',
        category: 'integration',
        status: 'planned',
        summary: 'Ingest remote provider pull requests, diffs, and review artifacts into Loops.',
        currentFoundation: [
          'Convergence PR evidence exists in the finalize phase.',
          'Git adapter boundaries isolate provider-specific commit and PR behavior.',
        ],
        nextSteps: [
          'Add provider client auth and diff artifact ingestion.',
          'Link recovered evidence back to shard and global review records.',
        ],
        risks: ['Provider rate limits and fork permission models need runtime handling.'],
      },
      {
        id: 'worker-concurrency',
        label: 'Worker / Concurrency',
        category: 'runtime',
        status: 'planned',
        summary: 'Run Loops safely across workers while preserving deterministic issue state.',
        currentFoundation: [
          'Work lock service protects issue-level execution.',
          'Resume endpoint can recover interrupted shard states.',
        ],
        nextSteps: [
          'Introduce queue worker ownership and concurrency limits.',
          'Define repo lock policy for multi-issue execution.',
        ],
        risks: ['Repository mutation conflicts must be prevented before parallel writes.'],
      },
      {
        id: 'complete-span-trace',
        label: 'Complete Span Trace',
        category: 'trace',
        status: 'planned',
        summary: 'Represent every loop step as parent/child spans with lifecycle timing.',
        currentFoundation: [
          'Immutable log entries and trace summary are exposed by metrics.',
          'Dashboard already surfaces recent event types and last signal timing.',
        ],
        nextSteps: [
          'Add span id, parent id, start/end timestamps, and outcome fields.',
          'Render a per-issue span tree beside existing recent events.',
        ],
        risks: ['Trace volume needs retention and filtering policy before production scale.'],
      },
      {
        id: 'checkpoint-snapshot-browser',
        label: 'Backend Checkpoint Snapshot Browser',
        category: 'checkpoint',
        status: 'planned',
        summary:
          'Browse backend checkpoints and restore candidates without inspecting files manually.',
        currentFoundation: [
          'Resume summary exposes resumable shard and affected issue counts.',
          'Issue detail includes logs, records, state, and evidence artifacts.',
        ],
        nextSteps: [
          'Persist immutable checkpoint snapshots for state transitions.',
          'Add browser API with snapshot metadata, diff, and restore eligibility.',
        ],
        risks: ['Snapshot visibility must avoid leaking repo paths or sensitive payloads.'],
      },
      {
        id: 'snapshot-storage-recovery',
        label: 'Snapshot Storage / Recovery Semantics',
        category: 'checkpoint',
        status: 'planned',
        summary: 'Define durable snapshot storage, replay, restore, and rollback semantics.',
        currentFoundation: [
          '.loops remains the source of truth with DB indexing for control-plane reads.',
          'Resume endpoint repairs interrupted shard status from persisted state.',
        ],
        nextSteps: [
          'Introduce immutable snapshot records with retention policy.',
          'Define replay, restore, rollback guard, and audit requirements.',
        ],
        risks: ['Recovery must remain deterministic across file store and DB index drift.'],
      },
    ];
    const summary = capabilities.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'done') {
          acc.done += 1;
        } else if (item.status === 'planned') {
          acc.planned += 1;
        } else {
          acc.inProgress += 1;
        }
        return acc;
      },
      { total: 0, done: 0, planned: 0, inProgress: 0 },
    );

    return { capabilities, summary };
  }
}
