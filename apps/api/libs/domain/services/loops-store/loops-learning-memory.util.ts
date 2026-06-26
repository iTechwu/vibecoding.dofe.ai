import { createHash } from 'crypto';
import type { LoopLearning } from '@repo/contracts';

const SIMILARITY_THRESHOLD = 0.38;

export function enrichLoopLearning(learning: LoopLearning): LoopLearning {
  const tags = learning.tags?.length ? learning.tags : buildLearningTags(learning);
  return {
    ...learning,
    fingerprint: learning.fingerprint ?? buildLearningFingerprint(learning, tags),
    tags,
  };
}

export function withLearningSimilaritySuggestions(learnings: LoopLearning[]): LoopLearning[] {
  const enriched = learnings.map(enrichLoopLearning);
  return enriched.map((learning) => ({
    ...learning,
    similarLearningIds: enriched
      .filter((candidate) => candidate.id !== learning.id)
      .map((candidate) => ({
        id: candidate.id,
        score: learningSimilarity(learning, candidate),
      }))
      .filter((candidate) => candidate.score >= SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, 3)
      .map((candidate) => candidate.id),
  }));
}

function buildLearningFingerprint(learning: LoopLearning, tags: string[]) {
  const seed = [learning.workspaceId, learning.repo ?? '', learning.kind, ...tags].join('|');
  return createHash('sha256').update(seed).digest('hex').slice(0, 16);
}

function buildLearningTags(learning: LoopLearning) {
  const rawTokens = `${learning.kind} ${learning.repo ?? ''} ${learning.summary}`
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fff]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return [...new Set(rawTokens)].slice(0, 12);
}

function learningSimilarity(a: LoopLearning, b: LoopLearning) {
  const aTags = new Set(a.tags ?? []);
  const bTags = new Set(b.tags ?? []);
  const union = new Set([...aTags, ...bTags]);
  if (union.size === 0) return 0;
  let intersection = 0;
  for (const tag of aTags) {
    if (bTags.has(tag)) intersection += 1;
  }
  const base = intersection / union.size;
  const kindBoost = a.kind === b.kind ? 0.18 : 0;
  const repoBoost = a.repo && b.repo && a.repo === b.repo ? 0.12 : 0;
  return Math.min(1, base + kindBoost + repoBoost);
}

const STOP_WORDS = new Set([
  'and',
  'before',
  'this',
  'that',
  'the',
  'with',
  'for',
  'from',
  'loop',
  'loops',
  'was',
  'were',
  '已完成',
]);
