/**
 * Schema Validation Tests
 * Schema 验证测试
 */

import { z } from 'zod';

// Import all schemas to verify exports
import * as schemas from '../schemas';

describe('Schemas', () => {
  describe('Schema Exports', () => {
    it('should export Prisma enums', () => {
      expect(schemas.SexTypeSchema).toBeDefined();
      expect(schemas.AuditActionTypeSchema).toBeDefined();
    });

    it('should export domain schemas', () => {
      expect(schemas.UserCheckResponseSchema).toBeDefined();
      expect(schemas.TaskListResponseSchema).toBeDefined();
      expect(schemas.TaskListQuerySchema).toBeDefined();
      expect(schemas.LoopListResponseSchema).toBeDefined();
      expect(schemas.LoopMetricsResponseSchema).toBeDefined();
      expect(schemas.MessageListResponseSchema).toBeDefined();
    });
  });

  describe('Schema Validation', () => {
    describe('Prisma enum schemas', () => {
      it('should validate generated enum values', () => {
        expect(schemas.SexTypeSchema.safeParse('UNKNOWN').success).toBe(true);
        expect(schemas.AuditActionTypeSchema.safeParse('CREATE').success).toBe(true);

        expect(schemas.SexTypeSchema.safeParse('invalid').success).toBe(false);
      });
    });

    describe('UUID Validation', () => {
      it('should validate UUID format in schemas that require it', () => {
        // Test with a valid UUID
        const validUuid = '550e8400-e29b-41d4-a716-446655440000';
        const invalidUuid = 'not-a-uuid';

        // UserCheckResponseSchema requires userId as UUID
        const validResult = schemas.UserCheckResponseSchema.safeParse({
          userId: validUuid,
        });
        expect(validResult.success).toBe(true);

        const invalidResult = schemas.UserCheckResponseSchema.safeParse({
          userId: invalidUuid,
        });
        expect(invalidResult.success).toBe(false);
      });
    });

    describe('Paginated list schemas', () => {
      it('should validate the standardized task list response shape', () => {
        const result = schemas.TaskListResponseSchema.safeParse({
          list: [
            {
              id: '550e8400-e29b-41d4-a716-446655440000',
              status: 'completed',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        });

        expect(result.success).toBe(true);
      });
    });

    describe('Loops metrics schema', () => {
      it('should validate loop tenant context in issue intake contracts', () => {
        const tenantContext = {
          tenantId: 'tenant-youhuitun',
          tenantName: '优惠豚',
          teamId: 'team-1',
        };

        expect(
          schemas.CreateLoopIssueRequestSchema.safeParse({
            title: 'Add tenant scoped loop audit',
            targetRepo: '.',
            body: 'Persist and display the selected tenant during loop intake.',
            priority: 'P1',
            acceptanceCriteria: ['tenant context is visible'],
            tenantContext,
          }).success,
        ).toBe(true);

        expect(
          schemas.CreateLoopIssueSimpleRequestSchema.safeParse({
            request: 'Persist tenant context for the simple issue flow',
            tenantContext,
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopTenantContextSchema.safeParse({
            tenantId: ' ',
          }).success,
        ).toBe(false);
      });

      it('should validate the Loops capability registry', () => {
        const result = schemas.LoopCapabilitiesResponseSchema.safeParse({
          summary: {
            total: 2,
            done: 1,
            planned: 1,
            inProgress: 0,
          },
          capabilities: [
            {
              id: 'codex-claude-adapters',
              label: 'Codex / Claude Code Adapters',
              category: 'agent',
              status: 'done',
              summary: 'Primary implementation and review agents are wired.',
              currentFoundation: ['Adapters exist behind service boundaries.'],
              nextSteps: ['Expose model routing health.'],
              risks: [],
            },
            {
              id: 'a2a-tool-registry',
              label: 'A2A / Tool Registry',
              category: 'tool',
              status: 'in-progress',
              summary: 'Expose tool contracts as a deterministic registry.',
              currentFoundation: ['Capability registry API exists.'],
              nextSteps: ['Define agent registry schema.'],
              risks: ['Tool permissions require policy review.'],
              agentToolRegistry: {
                agents: [
                  {
                    id: 'codex-planner-reviewer',
                    label: 'Codex Planner / Reviewer',
                    provider: 'codex',
                    lifecycle: 'active',
                    responsibilities: ['Plan loop work.'],
                    supportedPhases: ['PHASE_1_SPEC'],
                    permissions: ['read-repo'],
                    toolIds: ['spec-shard-planner'],
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
                    deterministicBoundary: 'Writes planning artifacts through LoopsService.',
                    compatibility: { codex: true, claudeCode: false, thirdParty: 'planned' },
                  },
                ],
                compatibilityChecks: [
                  {
                    id: 'phase-tool-ownership',
                    status: 'pass',
                    summary: 'Every active tool has an active owner.',
                  },
                ],
              },
            },
          ],
        });

        expect(result.success).toBe(true);
      });

      it('should validate control-plane metrics', () => {
        const result = schemas.LoopMetricsResponseSchema.safeParse({
          health: {
            ok: true,
            root: '/repo/.loops',
            loops: 1,
            issues: 1,
            problems: [],
          },
          summary: {
            total: 1,
            active: 1,
            inLoop: 0,
            paused: 0,
            attention: 0,
            closed: 0,
          },
          phaseDistribution: [{ phase: 'PHASE_1_SPEC', label: 'Spec', count: 1 }],
          costSummary: {
            loops: 1,
            tripped: 0,
            totalCalls: 0,
            totalTokens: 0,
            minCallsRemaining: 10,
            minTokensRemaining: 1000,
          },
          riskQueue: [],
          actionQueue: [
            {
              issueId: 'issue-1',
              title: 'Create spec',
              action: 'generate-spec',
              nextActionCategory: 'continue',
              label: 'Generate spec',
              priority: 'P2',
              phase: 'PHASE_1_SPEC',
              href: '/loops/issue-1',
            },
          ],
          requirementsCoverage: {
            total: 1,
            accepted: 0,
            reviewed: 0,
            tested: 0,
            implemented: 0,
            planned: 1,
            missing: 0,
            percent: 0,
          },
          traceSummary: {
            total: 1,
            recent: 1,
            lastEventAt: '2026-06-20T00:00:00.000Z',
            eventTypes: [{ type: 'ISSUE_CREATED', count: 1 }],
          },
          resumeSummary: {
            resumableShards: 0,
            affectedIssues: 0,
          },
        });

        expect(result.success).toBe(true);
      });

      it('should validate workspace rules summaries', () => {
        const result = schemas.LoopWorkspacesResponseSchema.safeParse({
          current: 'default',
          recentLearnings: [
            {
              id: 'learning-1',
              workspaceId: 'default',
              repo: '/repo',
              kind: 'test_policy',
              summary: 'Run focused tests before type-check.',
              evidenceIds: ['test-record-1'],
              confidence: 0.85,
              createdAt: '2026-06-23T00:00:00.000Z',
            },
          ],
          learningGovernance: {
            dismissed: [
              {
                learningId: 'learning-dismissed',
                actor: 'dashboard',
                reason: 'No longer relevant',
                createdAt: '2026-06-23T01:00:00.000Z',
              },
            ],
            merges: [
              {
                sourceLearningId: 'learning-duplicate',
                targetLearningId: 'learning-1',
                actor: 'human',
                createdAt: '2026-06-23T01:05:00.000Z',
              },
            ],
            deprecated: [
              {
                learningId: 'learning-old',
                actor: 'dashboard',
                reason: 'Superseded by release gate guidance',
                createdAt: '2026-06-23T01:10:00.000Z',
              },
            ],
            superseded: [
              {
                sourceLearningId: 'learning-old-pattern',
                targetLearningId: 'learning-new-pattern',
                actor: 'dashboard',
                reason: 'Replaced by newer guidance',
                createdAt: '2026-06-23T01:12:00.000Z',
              },
            ],
            autoMergeCandidates: [
              {
                sourceLearningId: 'learning-duplicate',
                targetLearningId: 'learning-1',
                status: 'pending-approval',
                reason: 'Similar fingerprint',
                createdAt: '2026-06-23T01:15:00.000Z',
              },
            ],
          },
          learningIndex: {
            generatedAt: '2026-06-23T01:20:00.000Z',
            artifactRef: '.loops/learnings/cross-workspace-index.json',
            summary: {
              total: 1,
              workspaces: 1,
              repos: 1,
              duplicateFingerprints: 0,
              reusable: 0,
            },
            entries: [
              {
                learningId: 'learning-1',
                workspaceId: 'default',
                repo: '/repo',
                kind: 'test_policy',
                fingerprint: 'learning-fingerprint',
                tags: ['test', 'policy'],
                confidence: 0.85,
                evidenceIds: ['test-record-1'],
                recallCount: 0,
                createdAt: '2026-06-23T00:00:00.000Z',
              },
            ],
          },
          workspaces: [
            {
              workspaceId: 'default',
              root: '/repo',
              status: 'VALIDATED',
              isDefault: true,
              selected: { codex: 'local-cli', 'claude-code': 'docker' },
              rules: {
                present: 2,
                total: 4,
                rules: [
                  {
                    id: 'agents',
                    label: 'AGENTS.md',
                    path: 'AGENTS.md',
                    status: 'present',
                    summary: '# AGENTS.md',
                    updated: '2026-06-20T00:00:00.000Z',
                  },
                  {
                    id: 'cline-rules',
                    label: 'Cline rules',
                    path: '.clinerules',
                    status: 'missing',
                  },
                ],
                diagnostics: [
                  {
                    id: 'missing-cursor-rules',
                    level: 'info',
                    message: 'Cursor rules are not present.',
                    evidence: '.cursor/rules',
                  },
                ],
              },
            },
          ],
        });

        expect(result.success).toBe(true);
      });

      it('should validate learning governance requests', () => {
        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'dismiss',
            actor: 'dashboard',
            reason: 'Stale learning',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'merge',
            targetLearningId: 'learning-target',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'approve-merge',
            targetLearningId: 'learning-target',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'reject-merge',
            targetLearningId: 'learning-target',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'deprecate',
            reason: 'Superseded',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'supersede',
            targetLearningId: 'learning-target',
            reason: 'Replaced by newer guidance',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopLearningGovernanceRequestSchema.safeParse({
            action: 'archive',
          }).success,
        ).toBe(false);
      });

      it('should validate MCP server and CI check registry contracts', () => {
        expect(
          schemas.LoopRemoteRunnerListResponseSchema.safeParse({
            list: [
              {
                id: 'remote-runner-primary',
                name: 'Primary Remote Runner Pool',
                status: 'ready',
                runtimeBackends: ['codex-cli', 'claude-code-cli'],
                capacity: { maxConcurrent: 4, leased: 0, available: 4 },
                queue: { pending: 0, running: 0 },
                sandboxProfile: 'remote-sandbox',
                artifactRoot: '.loops/runs/remote-runner-primary',
                leaseTtlSec: 1800,
                health: { ok: true, message: 'Ready' },
                risks: [],
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopRemoteRunnerLeaseSchema.safeParse({
            id: 'lease-1',
            runnerId: 'remote-runner-primary',
            issueId: 'issue-1',
            shardId: 'shard-1',
            runtimeBackend: 'codex-cli',
            status: 'leased',
            leasedAt: '2026-06-24T00:00:00.000Z',
            expiresAt: '2026-06-24T00:30:00.000Z',
            artifactRoot: '.loops/runs/remote-runner-primary/leases',
            message: 'Lease acquired',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopRemoteRunnerJobSchema.safeParse({
            id: 'rr-job-1',
            runnerId: 'remote-runner-primary',
            leaseId: 'lease-1',
            issueId: 'issue-1',
            shardId: 'shard-1',
            runtimeBackend: 'codex-cli',
            workerKind: 'artifact-only',
            status: 'succeeded',
            queuedAt: '2026-06-24T00:00:00.000Z',
            startedAt: '2026-06-24T00:00:01.000Z',
            finishedAt: '2026-06-24T00:00:02.000Z',
            artifactRoot: '.loops/runs/remote-runner-primary/jobs/rr-job-1',
            artifacts: [
              {
                path: '.loops/runs/remote-runner-primary/jobs/rr-job-1/manifest.json',
                kind: 'manifest',
                sizeBytes: 512,
                sha256: 'abc123',
              },
              {
                path: '.loops/runs/remote-runner-primary/jobs/rr-job-1/worker-receipt.json',
                kind: 'evidence',
                sizeBytes: 256,
                sha256: 'def456',
              },
              {
                path: '.loops/runs/remote-runner-primary/jobs/rr-job-1/worker.log',
                kind: 'log',
                sizeBytes: 128,
                sha256: 'ghi789',
              },
              {
                path: '.loops/runs/remote-runner-primary/jobs/rr-job-1/trace.json',
                kind: 'trace',
                sizeBytes: 256,
                sha256: 'jkl012',
              },
            ],
            message: 'Artifact manifest persisted',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopMcpServerListResponseSchema.safeParse({
            list: [
              {
                id: 'mcp-repo-tools',
                name: 'Repository Tools MCP',
                protocol: 'mcp',
                transport: 'stdio',
                status: 'configured',
                toolIds: ['repo-code-editor'],
                permissionProfile: 'workspace-scoped',
                authStatus: 'not-required',
                health: { ok: true, message: 'Config ready' },
                executionAudit: {
                  auditRef: 'mcp-audit-mcp-repo-tools-2026-06-24T00:00:00.000Z',
                  artifactRef:
                    '.loops/mcp-audits/mcp-repo-tools/mcp-audit-mcp-repo-tools-2026-06-24T00-00-00.000Z.json',
                  providerId: 'mcp-repo-tools',
                  action: 'test',
                  outcome: 'success',
                  toolCount: 1,
                  recordedAt: '2026-06-24T00:00:00.000Z',
                },
                risks: [],
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopCiCheckIntegrationListResponseSchema.safeParse({
            list: [
              {
                id: 'github-delivery-evidence',
                provider: 'github-checks',
                name: 'GitHub Delivery Evidence Check',
                status: 'configured',
                requiredForRelease: true,
                checkSuites: ['delivery-readiness'],
                targetRef: 'convergence-pr',
                lastPublishedAt: '2026-06-24T00:00:00.000Z',
                lastPublication: {
                  artifactRef:
                    '.loops/ci-checks/github-delivery-evidence/publications/abc1234567-2026-06-24T00-00-00.000Z.json',
                  provider: 'github',
                  headSha: 'abc1234567',
                  checkRunId: 'check-run-11',
                  url: 'https://github.com/dofe/repo/runs/11',
                  outcome: 'published',
                  publishedAt: '2026-06-24T00:00:00.000Z',
                },
                health: { ok: true, message: 'Ready' },
                risks: ['GitHub App installation required'],
              },
            ],
            total: 1,
            page: 1,
            limit: 20,
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopCiCheckPublicationHistorySchema.safeParse({
            integrationId: 'github-delivery-evidence',
            latest: {
              artifactRef:
                '.loops/ci-checks/github-delivery-evidence/publications/abc1234567-2026-06-24T00-00-00.000Z.json',
              integrationId: 'github-delivery-evidence',
              provider: 'github',
              headSha: 'abc1234567',
              checkRunId: 'check-run-11',
              url: 'https://github.com/dofe/repo/runs/11',
              outcome: 'published',
              issueId: 'issue-1',
              prId: '42',
              evidenceBacklink: 'https://vibecoding.dofe.ai/loops/issue-1/delivery-evidence',
              workPackageCommitMap: [
                {
                  workPackageId: 'shard-1',
                  title: 'Checkout fix',
                  commitSha: 'abc123456789',
                  commitMessage: 'loops(issue-1): shard-1 - Checkout fix',
                  branch: 'loops/issue-1',
                  files: ['apps/web/app/checkout/page.tsx'],
                },
              ],
              request: {
                name: 'DofeAI Delivery Evidence',
                detailsUrl: 'https://dofe.ai/loops/issue-1/evidence',
                evidenceBacklink: 'https://vibecoding.dofe.ai/loops/issue-1/delivery-evidence',
              },
              publishedAt: '2026-06-24T00:00:00.000Z',
            },
            entries: [],
            updatedAt: '2026-06-24T00:00:00.000Z',
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopRecipeAdminActionResponseSchema.safeParse({
            id: 'recipe-admin-createVersion-1',
            actionId: 'createVersion',
            status: 'requested',
            artifactRef: '.loops/recipe-admin/tenant-1/actions/recipe-admin-createVersion-1.json',
            blueprintId: 'delivery-blueprints',
            recipeKind: 'feature',
            targetVersion: 'v2',
            tenantId: 'tenant-1',
            teamId: 'team-1',
            actorId: 'sso-user-42',
            sourcePermission: 'vibecoding:loops:create',
            requestedAt: '2026-06-24T00:00:00.000Z',
            reason: 'promote tenant recipe',
            evidenceRefs: ['loop-1'],
            message: 'Recipe admin action request recorded.',
          }).success,
        ).toBe(true);
      });

      it('should validate browser QA request and report contracts', () => {
        expect(
          schemas.LoopBrowserQaRequestSchema.safeParse({
            targetUrl: 'https://example.com',
            checkedFlows: ['page-load'],
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopBrowserQaReportSchema.safeParse({
            id: 'browser-qa-1',
            issueId: 'issue-1',
            runner: 'playwright-cli',
            status: 'passed',
            targetUrl: 'https://example.com',
            title: 'Example Domain',
            screenshots: [
              {
                path: '.loops/runs/issue-1/browser-qa/browser-qa-1/screenshot.png',
                label: 'page-load',
              },
            ],
            traces: [
              {
                path: '.loops/runs/issue-1/browser-qa/browser-qa-1/trace.zip',
                label: 'page-load',
              },
            ],
            consoleErrors: [],
            networkFailures: [],
            checkedFlows: ['page-load'],
            command: 'pnpm --filter @repo/web exec node -e <browser-qa-worker>',
            durationMs: 120,
            created: '2026-06-23T00:00:00.000Z',
          }).success,
        ).toBe(true);
      });

      it('should validate detail evidence artifacts', () => {
        const result = schemas.LoopDetailSchema.safeParse({
          issue: {
            id: 'issue-1',
            title: 'Evidence issue',
            status: 'OPEN',
            priority: 'P2',
            created: '2026-06-20T00:00:00.000Z',
            updated: '2026-06-20T00:00:00.000Z',
            sourceChannel: 'web',
            sourceKind: 'web_form',
            submitterId: 'dev-user',
            submitterName: 'Developer',
            targetRepo: '/repo',
            body: 'Create an auditable evidence chain.',
            acceptanceCriteria: ['Evidence artifacts are visible'],
            rawPayloadRef: '.loops/intakes/intake-1.raw.json',
          },
          intake: {
            id: 'intake-1',
            issueId: 'issue-1',
            sourceChannel: 'web',
            sourceKind: 'web_form',
            submitter: { provider: 'dev', userId: 'dev-user', name: 'Developer' },
            rawPayloadRef: '.loops/intakes/intake-1.raw.json',
            status: 'NORMALIZED',
            created: '2026-06-20T00:00:00.000Z',
            ruleSnapshot: {
              workspaceId: 'default',
              root: '/repo',
              capturedAt: '2026-06-20T00:00:00.000Z',
              present: 2,
              total: 4,
              rules: [
                {
                  id: 'agents',
                  label: 'AGENTS.md',
                  path: 'AGENTS.md',
                  status: 'present',
                  summary: '# AGENTS.md',
                  updated: '2026-06-20T00:00:00.000Z',
                },
              ],
              diagnostics: [
                {
                  id: 'rules-overlap',
                  level: 'warning',
                  message: 'Multiple agent-readable rule sources are present; verify precedence.',
                  evidence: 'AGENTS.md, CLAUDE.md',
                },
              ],
              enforcement: {
                policy: 'snapshot-required',
                status: 'enforced',
                agentReadable: true,
                evidence: ['AGENTS.md', 'CLAUDE.md'],
              },
            },
          },
          shards: [],
          annotations: [],
          implementationRecords: [],
          reviewRecords: [],
          testRecords: [],
          logs: [],
          notifications: [],
          state: {
            issueId: 'issue-1',
            phase: 'PHASE_1_SPEC',
            round: 1,
            specVersion: 'v0',
            shardsTotal: 0,
            shardsDone: 0,
            shardsInProgress: 0,
            reloopCount: 0,
            costTokens: 0,
            costCalls: 0,
            updated: '2026-06-20T00:00:00.000Z',
            paused: false,
          },
          evidenceArtifacts: [
            {
              id: 'issue-1-raw-payload',
              label: 'Raw Payload',
              kind: 'raw-payload',
              path: '.loops/intakes/intake-1.raw.json',
              status: 'present',
              round: 1,
              summary: 'Original intake payload captured for audit.',
            },
          ],
        });

        expect(result.success).toBe(true);
      });

      it('should validate workflow, review, and release gate contracts with Codex and Claude Code owners', () => {
        const workflow = schemas.LoopWorkflowRecipeSchema.safeParse({
          id: 'default-feature',
          name: 'Feature delivery',
          version: 1,
          appliesTo: ['feature'],
          capturedAt: '2026-06-23T00:00:00.000Z',
          source: 'loop-snapshot',
          steps: [
            {
              id: 'spec-review',
              kind: 'spec_review',
              label: 'Spec Review',
              required: true,
              status: 'current',
              owner: 'codex',
              humanGate: 'approval',
              phase: 'PHASE_2_REVIEW',
              evidenceTypes: ['spec'],
              evidenceIds: ['spec-v1'],
            },
            {
              id: 'implementation',
              kind: 'implementation',
              label: 'Implementation',
              required: true,
              status: 'pending',
              owner: 'claude-code',
              evidenceTypes: ['implementation-record'],
              evidenceIds: [],
            },
          ],
        });
        const reviewGate = schemas.LoopReviewGateSchema.safeParse({
          id: 'gate-code',
          kind: 'code',
          status: 'pending',
          reviewer: 'codex',
          findingsCount: 0,
          requiredByStepId: 'code-review',
          updated: '2026-06-23T00:00:00.000Z',
        });
        const releaseGate = schemas.LoopReleaseGateSchema.safeParse({
          id: 'release-issue-1',
          status: 'ready',
          checklist: {
            specApproved: true,
            implementationEvidence: true,
            testsPassed: true,
            requiredReviewsPassed: true,
            secondOpinionPassed: true,
            browserQaPassed: false,
            docsUpdated: true,
            prReady: true,
            rollbackNote: false,
          },
          evidenceIds: ['global-review-1'],
          updated: '2026-06-23T00:00:00.000Z',
        });
        const deliveryGovernance = schemas.LoopDeliveryGovernanceSchema.safeParse({
          workflowDefaults: [],
          reviewGateOverrides: [],
          requiredReviewGates: {
            gateKinds: ['product', 'code'],
            actor: 'human',
            reason: 'Only product and code gates are required for this loop.',
            updated: '2026-06-23T01:20:00.000Z',
          },
          releaseCanary: {
            status: 'passed',
            environment: 'staging-us',
            environmentOwner: 'release-manager',
            targetUrl: 'https://example.com/canary',
            rollbackNote: 'Revert the generated convergence branch.',
            actor: 'human',
            updated: '2026-06-23T01:30:00.000Z',
          },
          runtimeOverrides: [],
          secondOpinionResolutions: [],
        });
        const requiredGateRequest = schemas.LoopDeliveryGovernanceRequestSchema.safeParse({
          action: 'set-required-review-gates',
          gateKinds: ['product', 'code'],
          actor: 'human',
          reason: 'Reduce this docs loop to human + code review gates.',
        });
        const releaseCanaryRequest = schemas.LoopDeliveryGovernanceRequestSchema.safeParse({
          action: 'record-release-canary',
          status: 'passed',
          environment: 'staging-us',
          environmentOwner: 'release-manager',
          targetUrl: 'https://example.com/canary',
          rollbackNote: 'Revert the generated convergence branch.',
          actor: 'human',
        });

        expect(workflow.success).toBe(true);
        expect(reviewGate.success).toBe(true);
        expect(releaseGate.success).toBe(true);
        expect(deliveryGovernance.success).toBe(true);
        expect(requiredGateRequest.success).toBe(true);
        expect(releaseCanaryRequest.success).toBe(true);
        expect(
          schemas.LoopRuntimeSecurityExceptionSchema.safeParse({
            id: 'runtime-security-test-record-1-0',
            testRecordId: 'test-record-1',
            shardId: 'shard-1',
            round: 1,
            level: 'warning',
            reason: 'Command was blocked by runtime policy.',
            evidence: 'runtime-security:command-policy · TEST-FAIL',
            command: 'pnpm test && rm -rf /tmp/out',
            created: '2026-06-23T00:00:00.000Z',
          }).success,
        ).toBe(true);
        expect(
          schemas.LoopSecondOpinionSchema.safeParse({
            id: 'issue-1-second-opinion',
            status: 'not_required',
            primary: {
              role: 'primary',
              reviewer: 'codex',
              status: 'passed',
              findingsCount: 1,
              findings: [
                {
                  fingerprint: 'browser-qa-report',
                  severity: 'major',
                  desc: 'Browser QA report must be present before release.',
                  sourceEvidenceId: 'global-review-1',
                },
              ],
              evidenceIds: ['global-review-1'],
            },
            secondary: {
              role: 'secondary',
              reviewer: 'claude-code',
              status: 'needs_changes',
              findingsCount: 1,
              findings: [
                {
                  fingerprint: 'browser-qa-report',
                  severity: 'critical',
                  desc: 'Claude Code marked the same Browser QA gap as release-critical.',
                },
              ],
              evidenceIds: ['issue-1-second-opinion'],
            },
            comparison: {
              agreementCount: 0,
              primaryOnlyCount: 0,
              secondaryOnlyCount: 0,
              conflictCount: 1,
              conflictFingerprints: ['browser-qa-report'],
            },
            requiredForRelease: false,
            updated: '2026-06-23T00:00:00.000Z',
          }).success,
        ).toBe(true);
        expect(
          schemas.LoopResolveSecondOpinionSchema.safeParse({
            action: 'accept-secondary',
            findingFingerprints: ['browser-qa-report', 'release-risk'],
            reason: 'Batch accept Claude Code findings.',
          }).success,
        ).toBe(true);
        expect(
          schemas.LoopRuntimeSecurityPolicySnapshotSchema.safeParse({
            id: 'runtime-security-shard-1-r1',
            mode: 'test-command',
            shell: {
              strategy: 'allowlist',
              allowedCommands: ['pnpm test'],
              blockedOperators: ['&&', '||', ';', '|', '<', '>', '`', '$(', 'newline'],
            },
            network: {
              strategy: 'deny-by-default',
              status: 'not-requested',
            },
            write: {
              strategy: 'workspace-scoped',
              scope: 'target-repo',
            },
            approvals: {
              override: 'not-supported',
              requiredFor: ['shell-control-operator'],
            },
            canary: {
              strategy: 'env-token',
              status: 'armed',
              leakedInCommands: [],
            },
            capturedAt: '2026-06-23T00:00:00.000Z',
          }).success,
        ).toBe(true);
        expect(
          schemas.LoopWorkflowStepSchema.safeParse({
            id: 'bad-host',
            kind: 'implementation',
            label: 'Bad host',
            required: true,
            status: 'pending',
            owner: 'openclaw',
          }).success,
        ).toBe(false);
      });

      it('should validate detail spec history snapshots', () => {
        const result = schemas.LoopDetailSchema.safeParse({
          issue: {
            id: 'issue-1',
            title: 'Spec diff issue',
            status: 'OPEN',
            priority: 'P1',
            created: '2026-06-20T00:00:00.000Z',
            updated: '2026-06-20T00:00:00.000Z',
            sourceChannel: 'web',
            sourceKind: 'web_form',
            submitterId: 'dev-user',
            submitterName: 'Developer',
            targetRepo: '/repo',
            body: 'Review spec changes between loop rounds.',
            acceptanceCriteria: ['Spec changes are visible'],
            rawPayloadRef: '.loops/intakes/intake-1.raw.json',
          },
          intake: {
            id: 'intake-1',
            issueId: 'issue-1',
            sourceChannel: 'web',
            sourceKind: 'web_form',
            submitter: { provider: 'dev', userId: 'dev-user', name: 'Developer' },
            rawPayloadRef: '.loops/intakes/intake-1.raw.json',
            status: 'NORMALIZED',
            created: '2026-06-20T00:00:00.000Z',
          },
          spec: {
            id: 'spec-2',
            issueId: 'issue-1',
            version: 'v2',
            status: 'DRAFT',
            created: '2026-06-20T00:10:00.000Z',
            contextBudget: 24000,
            body: 'Draft v2 body',
          },
          specHistory: [
            {
              id: 'spec-1',
              issueId: 'issue-1',
              version: 'v1',
              status: 'APPROVED',
              created: '2026-06-20T00:00:00.000Z',
              approvedBy: 'reviewer',
              body: 'Approved v1 body',
            },
            {
              id: 'spec-2',
              issueId: 'issue-1',
              version: 'v2',
              status: 'DRAFT',
              created: '2026-06-20T00:10:00.000Z',
              body: 'Draft v2 body',
            },
          ],
          shards: [],
          annotations: [],
          implementationRecords: [],
          reviewRecords: [],
          testRecords: [],
          logs: [],
          notifications: [],
          state: {
            issueId: 'issue-1',
            phase: 'PHASE_2_REVIEW',
            round: 2,
            specVersion: 'v2',
            shardsTotal: 0,
            shardsDone: 0,
            shardsInProgress: 0,
            reloopCount: 1,
            costTokens: 0,
            costCalls: 0,
            updated: '2026-06-20T00:10:00.000Z',
            paused: false,
          },
        });

        expect(result.success).toBe(true);
      });

      it('should validate deterministic natural command responses', () => {
        const result = schemas.LoopNaturalCommandResponseSchema.safeParse({
          issueId: 'issue-1',
          intent: 'query-evidence',
          executed: false,
          message: 'Returned recent evidence logs.',
          logs: [
            {
              ts: '2026-06-20T00:00:00.000Z',
              type: 'NATURAL_COMMAND',
              issue: 'issue-1',
              action: 'query-evidence',
              payload: { command: 'show evidence' },
            },
          ],
        });

        expect(result.success).toBe(true);
      });

      it('should validate eval historical baseline and trend worker payloads', () => {
        expect(
          schemas.EvalRunSchema.safeParse({
            id: 'eval-run-delivery-readiness-issue-1',
            suiteId: 'delivery-readiness',
            loopId: 'issue-1',
            targetRef: 'issue-1',
            blueprintId: 'default-feature@v1',
            baselineVersion: 'default-feature-v1:delivery-readiness:2026-06-24T00:00:00.000Z',
            baselineScore: 67,
            status: 'attention',
            score: 33,
            trendDelta: -34,
            checkResults: [],
            evidenceRefs: ['.loops/issues/issue-1.json'],
            runAt: '2026-06-24T00:10:00.000Z',
          }).success,
        ).toBe(true);

        expect(
          schemas.EvalTrendWorkerResponseSchema.safeParse({
            generatedAt: '2026-06-24T00:10:00.000Z',
            snapshotCount: 1,
            baselines: [
              {
                id: 'eval-baseline-default-feature-v1-delivery-readiness-1',
                suiteId: 'delivery-readiness',
                blueprintId: 'default-feature@v1',
                baselineVersion: 'default-feature-v1:delivery-readiness:2026-06-24T00:10:00.000Z',
                capturedAt: '2026-06-24T00:10:00.000Z',
                runCount: 3,
                averageScore: 67,
                passRate: 33,
                previousAverageScore: 55,
                trendDelta: 12,
              },
            ],
          }).success,
        ).toBe(true);

        expect(
          schemas.LoopBenchTrendWorkerResponseSchema.safeParse({
            generatedAt: '2026-06-24T00:10:00.000Z',
            historyCount: 2,
            snapshot: {
              id: 'loop-bench-20260624001000000',
              capturedAt: '2026-06-24T00:10:00.000Z',
              artifactRef: '.loops/bench-trends/2026-06-24T00-10-00-000Z.json',
              loopCount: 4,
              metrics: {
                firstPassReviewRate: 50,
                browserQaRegressionRate: 25,
                secondOpinionConflictRate: 0,
                releaseBlockerRate: 25,
                runtimeViolationRate: 0,
                learningReuseRate: 50,
                canaryPassRate: 75,
              },
              previousMetrics: {
                firstPassReviewRate: 40,
                browserQaRegressionRate: 25,
                secondOpinionConflictRate: 10,
                releaseBlockerRate: 30,
                runtimeViolationRate: 5,
                learningReuseRate: 25,
                canaryPassRate: 70,
              },
              deltas: {
                firstPassReviewRate: 10,
                browserQaRegressionRate: 0,
                secondOpinionConflictRate: -10,
                releaseBlockerRate: -5,
                runtimeViolationRate: -5,
                learningReuseRate: 25,
                canaryPassRate: 5,
              },
            },
          }).success,
        ).toBe(true);
      });
    });
  });

  describe('Type Inference', () => {
    it('should correctly infer types from schemas', () => {
      // This is a compile-time check - if it compiles, types are correct
      type SexType = z.infer<typeof schemas.SexTypeSchema>;
      const sex: SexType = 'UNKNOWN';
      expect(sex).toBe('UNKNOWN');

      type UserCheckResponse = z.infer<typeof schemas.UserCheckResponseSchema>;
      const response: UserCheckResponse = {
        userId: '550e8400-e29b-41d4-a716-446655440000',
      };
      expect(response.userId).toBeDefined();
    });
  });
});
