import {
  buildPrimarySecondOpinionFindings,
  buildSecondarySecondOpinionFindings,
  compareSecondOpinionFindings,
} from './loops-second-opinion-comparison.util';

describe('second opinion finding comparison', () => {
  it('compares agreement, unique findings, and severity conflicts by fingerprint', () => {
    const primary = buildPrimarySecondOpinionFindings({
      reviewRecords: [
        {
          id: 'review-1',
          issueId: 'issue-1',
          shardId: 'shard-1',
          round: 1,
          reviewer: 'codex',
          verdict: 'NEEDS-WORK',
          issues: [
            { severity: 'major', desc: 'Persist browser QA reports before release' },
            { severity: 'minor', desc: 'Add a visible Browser QA trigger' },
          ],
          fixInstructions: [],
          summary: 'Primary review found release evidence gaps.',
          created: '2026-06-23T00:00:00.000Z',
        },
      ],
    });
    const shared = primary[0].fingerprint;
    const conflict = primary[1].fingerprint;
    const secondary = buildSecondarySecondOpinionFindings([
      {
        severity: 'major',
        desc: 'Claude agreed with browser QA persistence.',
        fingerprint: shared,
      },
      {
        severity: 'critical',
        desc: 'Claude raised Browser QA trigger as a release blocker.',
        fingerprint: conflict,
      },
      {
        severity: 'major',
        desc: 'Claude found a missing runtime approval audit trail.',
        fingerprint: 'runtime-approval-audit',
      },
    ]);

    expect(compareSecondOpinionFindings({ primary, secondary })).toEqual({
      agreementCount: 1,
      primaryOnlyCount: 0,
      secondaryOnlyCount: 1,
      conflictCount: 1,
      agreementFingerprints: [shared],
      primaryOnlyFingerprints: [],
      secondaryOnlyFingerprints: ['runtime-approval-audit'],
      conflictFingerprints: [conflict],
    });
  });
});
