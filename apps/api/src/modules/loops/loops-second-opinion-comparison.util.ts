import { createHash } from 'crypto';
import type {
  LoopGlobalReviewRecord,
  LoopReviewRecord,
  LoopSecondOpinion,
  LoopSecondOpinionReviewer,
} from '@repo/contracts';

type Severity = LoopSecondOpinionReviewer['findings'][number]['severity'];
type Finding = LoopSecondOpinionReviewer['findings'][number];

export function normalizeSecondOpinionFingerprint(input: { desc: string; fingerprint?: string }) {
  const explicit = input.fingerprint?.trim();
  if (explicit) {
    return explicit.toLowerCase();
  }
  const normalizedDesc = input.desc
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, ' ')
    .trim();
  return createHash('sha256')
    .update(normalizedDesc || input.desc)
    .digest('hex')
    .slice(0, 16);
}

export function buildPrimarySecondOpinionFindings(input: {
  reviewRecords: LoopReviewRecord[];
  globalReview?: LoopGlobalReviewRecord;
}): Finding[] {
  const shardFindings = input.reviewRecords.flatMap((record) =>
    record.issues.map((issue) => ({
      fingerprint: normalizeSecondOpinionFingerprint({ desc: issue.desc }),
      severity: issue.severity,
      desc: issue.desc,
      sourceEvidenceId: record.id,
    })),
  );
  const globalFindings =
    input.globalReview?.issues.map((issue) => ({
      fingerprint: normalizeSecondOpinionFingerprint({ desc: issue.desc }),
      severity: issue.severity,
      desc: issue.desc,
      sourceEvidenceId: input.globalReview?.id,
    })) ?? [];
  return dedupeFindings([...shardFindings, ...globalFindings]);
}

export function buildSecondarySecondOpinionFindings(
  findings: Array<{ severity: Severity; desc: string; fingerprint?: string }>,
): Finding[] {
  return dedupeFindings(
    findings.map((finding) => ({
      fingerprint: normalizeSecondOpinionFingerprint(finding),
      severity: finding.severity,
      desc: finding.desc,
    })),
  );
}

export function compareSecondOpinionFindings(input: {
  primary: Finding[];
  secondary: Finding[];
}): LoopSecondOpinion['comparison'] {
  const primaryByFingerprint = new Map(
    input.primary.map((finding) => [finding.fingerprint, finding]),
  );
  const secondaryByFingerprint = new Map(
    input.secondary.map((finding) => [finding.fingerprint, finding]),
  );
  const agreementFingerprints: string[] = [];
  const conflictFingerprints: string[] = [];
  const primaryOnlyFingerprints: string[] = [];
  const secondaryOnlyFingerprints: string[] = [];

  for (const [fingerprint, primaryFinding] of primaryByFingerprint.entries()) {
    const secondaryFinding = secondaryByFingerprint.get(fingerprint);
    if (!secondaryFinding) {
      primaryOnlyFingerprints.push(fingerprint);
      continue;
    }
    if (primaryFinding.severity === secondaryFinding.severity) {
      agreementFingerprints.push(fingerprint);
    } else {
      conflictFingerprints.push(fingerprint);
    }
  }

  for (const fingerprint of secondaryByFingerprint.keys()) {
    if (!primaryByFingerprint.has(fingerprint)) {
      secondaryOnlyFingerprints.push(fingerprint);
    }
  }

  return {
    agreementCount: agreementFingerprints.length,
    primaryOnlyCount: primaryOnlyFingerprints.length,
    secondaryOnlyCount: secondaryOnlyFingerprints.length,
    conflictCount: conflictFingerprints.length,
    agreementFingerprints,
    primaryOnlyFingerprints,
    secondaryOnlyFingerprints,
    conflictFingerprints,
  };
}

function dedupeFindings(findings: Finding[]): Finding[] {
  const byFingerprint = new Map<string, Finding>();
  for (const finding of findings) {
    const existing = byFingerprint.get(finding.fingerprint);
    if (!existing || severityRank(finding.severity) > severityRank(existing.severity)) {
      byFingerprint.set(finding.fingerprint, finding);
    }
  }
  return [...byFingerprint.values()];
}

function severityRank(severity: Severity) {
  if (severity === 'critical') return 3;
  if (severity === 'major') return 2;
  return 1;
}
