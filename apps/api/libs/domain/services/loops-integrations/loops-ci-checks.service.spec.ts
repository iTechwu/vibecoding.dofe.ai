import { NotFoundException } from '@nestjs/common';
import type { LoopCiCheckAction } from '@repo/contracts';
import { LoopsCiChecksService } from './loops-ci-checks.service';

describe('LoopsCiChecksService', () => {
  let service: LoopsCiChecksService;

  beforeEach(() => {
    service = new LoopsCiChecksService();
  });

  describe('CI checks registry', () => {
    it('exposes the static github + generic-ci integration catalog', () => {
      const items = service.listCiCheckItems();
      expect(items.map((item) => item.id)).toEqual(
        expect.arrayContaining(['github-delivery-evidence', 'generic-ci-regression']),
      );
      const github = items.find((item) => item.id === 'github-delivery-evidence');
      expect(github).toEqual(
        expect.objectContaining({
          provider: 'github-checks',
          requiredForRelease: true,
          checkSuites: expect.arrayContaining(['delivery-readiness']),
        }),
      );
    });

    it('looks up a check item by id and throws when missing', () => {
      expect(service.getCiCheckItem('github-delivery-evidence').provider).toBe('github-checks');
      expect(() => service.getCiCheckItem('nope')).toThrow(NotFoundException);
    });

    it('materialises a status overlay with timestamp + health message', () => {
      const overlay = service.withCiCheckStatus('generic-ci-regression', 'connected', 'ok');
      expect(overlay).toEqual(
        expect.objectContaining({
          id: 'generic-ci-regression',
          status: 'connected',
          lastPublishedAt: expect.any(String),
          health: { ok: true, message: 'ok' },
        }),
      );
      const failed = service.withCiCheckStatus('github-delivery-evidence', 'failed', 'boom');
      expect(failed.health).toEqual({ ok: false, message: 'boom' });
    });
  });

  describe('buildCiCheckPublicationEvidence', () => {
    it('returns a backlink-only record without issueId or port', async () => {
      const action: LoopCiCheckAction = {
        issueId: undefined,
        prId: 'pr-1',
        detailsUrl: 'https://ci/run/1',
      };
      const result = await service.buildCiCheckPublicationEvidence(action);
      expect(result).toEqual({
        prId: 'pr-1',
        detailsUrl: 'https://ci/run/1',
        evidenceBacklink: 'https://ci/run/1',
        workPackageCommitMap: [],
      });
    });

    it('delegates to the delivery-evidence port when issueId is supplied', async () => {
      const port = {
        buildPublicationEvidence: jest.fn().mockResolvedValue({
          issueId: 'issue-1',
          prId: 'pr-9',
          detailsUrl: 'https://ci/run/9',
          evidenceBacklink: 'https://back/9',
          workPackageCommitMap: [{ workPackageId: 'wp-1', files: ['a.ts'], commitSha: 'sha-1' }],
        }),
      };
      const action: LoopCiCheckAction = {
        issueId: 'issue-1',
        detailsUrl: 'https://ci/run/9',
        evidenceBacklink: 'https://back/9',
      };
      const result = await service.buildCiCheckPublicationEvidence(action, port);

      expect(port.buildPublicationEvidence).toHaveBeenCalledWith(
        expect.objectContaining({ issueId: 'issue-1', evidenceBacklink: 'https://back/9' }),
      );
      expect(result.workPackageCommitMap).toHaveLength(1);
      expect(result.issueId).toBe('issue-1');
    });

    it('falls back to minimal record when issueId is set but no port is wired', async () => {
      const action: LoopCiCheckAction = { issueId: 'issue-1', prId: 'pr-2' };
      const result = await service.buildCiCheckPublicationEvidence(action);
      expect(result.workPackageCommitMap).toEqual([]);
      expect(result.prId).toBe('pr-2');
    });
  });
});
