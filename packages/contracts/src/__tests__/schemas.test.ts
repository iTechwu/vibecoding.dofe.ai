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
              summary: 'Original intake payload captured for audit.',
            },
          ],
        });

        expect(result.success).toBe(true);
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
