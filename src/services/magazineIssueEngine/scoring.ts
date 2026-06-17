import type { IssueArchetype, IssueFacts, IssueScore, IssueSignalName } from './types';
import { getIssueArchetypeProfile, ISSUE_ARCHETYPE_ORDER } from './archetypes';

function signalScore(facts: IssueFacts, signal: IssueSignalName): number {
  return facts.signalScores.find((item) => item.signal === signal)?.score ?? 0;
}

function signalCount(facts: IssueFacts, signal: IssueSignalName): number {
  return facts.signalScores.find((item) => item.signal === signal)?.count ?? 0;
}

function scoreForArchetype(archetype: IssueArchetype, facts: IssueFacts): number {
  const profile = getIssueArchetypeProfile(archetype);

  if (archetype === 'thinIssue') {
    return facts.thinness === 'thin' ? profile.scoreBias : 0;
  }

  if (archetype === 'mixedCultureIssue') {
    return Math.max(
      2,
      facts.sectionEntropy * 12 +
      facts.sectionMix.length * 3 +
      (facts.hasBalancedMix ? 18 : 0) -
      (facts.hasSingleDominantSection ? 8 : 0),
    );
  }

  const signal = profile.signal;
  const baseSignal = signal ? signalScore(facts, signal) : 0;
  const countBoost = signal ? Math.min(signalCount(facts, signal), 5) * 2 : 0;
  let score = baseSignal + profile.scoreBias + countBoost;

  if (signal && baseSignal < profile.minSignalScore) {
    score -= 10;
  }

  switch (archetype) {
    case 'listeningIssue':
      score += facts.hasStrongSound ? 8 : 0;
      score += facts.primarySignal?.signal === 'sound' ? 8 : 0;
      break;
    case 'sceneIssue':
      score += facts.hasStrongPlace ? 8 : 0;
      score += facts.primarySignal?.signal === 'scene' ? 8 : 0;
      break;
    case 'recordReviewIssue':
      score += facts.hasStrongReview ? 8 : 0;
      score += signalCount(facts, 'review') >= 2 ? 10 : 0;
      score += signalScore(facts, 'review') >= signalScore(facts, 'sound') * 0.7 ? 6 : 0;
      break;
    case 'fieldGuideIssue':
      score += facts.hasStrongGuide ? 8 : 0;
      score += facts.readingDoor.mode === 'guide' ? 8 : 0;
      break;
    case 'memoryIssue':
      score += facts.hasStrongMemory ? 8 : 0;
      score += facts.primarySignal?.signal === 'memory' ? 8 : 0;
      break;
    case 'systemsIssue':
      score += facts.hasStrongSystems ? 10 : 0;
      score += facts.primarySignal?.signal === 'systems' ? 8 : 0;
      break;
    case 'imageIssue':
      score += facts.hasStrongImage ? 10 : 0;
      score += facts.primarySignal?.signal === 'image' && facts.secondarySignal ? 6 : 0;
      score -= facts.imageCount < Math.max(2, Math.ceil(facts.articleCount * 0.4)) ? 8 : 0;
      break;
    case 'argumentIssue':
      score += facts.hasStrongArgument ? 8 : 0;
      score += facts.readingDoor.mode === 'argument' ? 8 : 0;
      break;
    default:
      break;
  }

  return score;
}

function selectArchetype(facts: IssueFacts): IssueArchetype {
  if (facts.thinness === 'thin') return 'thinIssue';
  if (facts.issueNumber === 1) return 'mixedCultureIssue';

  const ranked = ISSUE_ARCHETYPE_ORDER
    .filter((archetype) => archetype !== 'thinIssue')
    .map((archetype) => ({ archetype, score: scoreForArchetype(archetype, facts) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return ISSUE_ARCHETYPE_ORDER.indexOf(a.archetype) - ISSUE_ARCHETYPE_ORDER.indexOf(b.archetype);
    });

  return ranked[0]?.archetype ?? 'mixedCultureIssue';
}

function resolveCoverVariant(archetype: IssueArchetype, facts: IssueFacts) {
  if (facts.issueNumber === 1) return 'seal-key-visual' as const;
  const profile = getIssueArchetypeProfile(archetype);
  if (archetype === 'mixedCultureIssue' && facts.hasBalancedMix) return 'seal-key-visual' as const;
  if ((archetype === 'sceneIssue' || archetype === 'fieldGuideIssue' || archetype === 'imageIssue') && !facts.hasStrongImage) return 'type-cover' as const;
  return profile.coverVariant;
}

function resolveFeatureVisualMode(archetype: IssueArchetype, facts: IssueFacts) {
  if (facts.issueNumber === 1) return 'issue-one-route' as const;
  const profile = getIssueArchetypeProfile(archetype);
  if ((archetype === 'sceneIssue' || archetype === 'fieldGuideIssue') && facts.hasStrongImage) return 'photo-led' as const;
  if (archetype === 'imageIssue' && !facts.hasStrongImage) return 'type-led' as const;
  if (archetype === 'argumentIssue' && facts.hasStrongImage) return 'photo-led' as const;
  return profile.featureVisualMode;
}

function resolveEditorNoteMode(archetype: IssueArchetype, facts: IssueFacts) {
  if (facts.issueNumber === 1) return 'letter' as const;
  if (facts.thinness === 'thin') return 'one-line' as const;
  if (archetype === 'listeningIssue' && facts.clusters.sound.length >= 5) return 'playlist-note' as const;
  return getIssueArchetypeProfile(archetype).editorNoteMode;
}

export function scoreIssueArchetype(facts: IssueFacts): IssueScore {
  const archetype = selectArchetype(facts);
  const profile = getIssueArchetypeProfile(archetype);
  const reasons = [
    ...facts.factSummary,
    `archetype: ${profile.label}`,
    `interaction: ${profile.interactionPattern}`,
    `reader promise: ${profile.readerPromise}`,
    facts.readingDoor.article ? `reading door: ${facts.readingDoor.article.title}` : `reading door: ${facts.readingDoor.title}`,
    facts.topArticleReason ? `lead reason: ${facts.topArticleReason}` : 'no lead reason',
    `average score: ${facts.averageScore}`,
    `score spread: ${facts.scoreSpread}`,
  ];

  return {
    archetype,
    profile,
    mood: profile.mood,
    coverVariant: resolveCoverVariant(archetype, facts),
    editorNoteMode: resolveEditorNoteMode(archetype, facts),
    featureVisualMode: resolveFeatureVisualMode(archetype, facts),
    interactionPattern: profile.interactionPattern,
    reasons,
  };
}
