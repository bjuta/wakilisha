import type { IssueArchetype, IssueCoverVariant, IssueFacts, IssueMood, IssueScore, EditorNoteMode, FeatureVisualMode, IssueSignalName } from './types';

function moodForArchetype(archetype: IssueArchetype): IssueMood {
  switch (archetype) {
    case 'sceneIssue':
    case 'fieldGuideIssue':
      return 'travel';
    case 'memoryIssue':
    case 'recordReviewIssue':
      return 'paper';
    case 'systemsIssue':
      return 'signal';
    case 'imageIssue':
      return 'image';
    case 'argumentIssue':
      return 'archive';
    default:
      return 'night';
  }
}

function coverVariantFor(archetype: IssueArchetype, facts: IssueFacts): IssueCoverVariant {
  if (facts.hasBalancedMix && archetype === 'mixedCultureIssue') return 'seal-key-visual';
  switch (archetype) {
    case 'systemsIssue':
      return 'signal-grid';
    case 'memoryIssue':
    case 'recordReviewIssue':
      return 'paper-cover';
    case 'sceneIssue':
    case 'fieldGuideIssue':
    case 'imageIssue':
      return facts.hasStrongImage ? 'image-trace' : 'type-cover';
    case 'argumentIssue':
      return 'type-cover';
    default:
      return facts.hasStrongImage ? 'image-trace' : 'seal-key-visual';
  }
}

function featureVisualModeFor(archetype: IssueArchetype, facts: IssueFacts): FeatureVisualMode {
  if (facts.issueNumber === 1) return 'issue-one-route';
  switch (archetype) {
    case 'systemsIssue':
      return 'signal-board';
    case 'memoryIssue':
    case 'recordReviewIssue':
      return 'paper-file';
    case 'imageIssue':
      return facts.hasStrongImage ? 'photo-led' : 'type-led';
    case 'argumentIssue':
      return facts.hasStrongImage ? 'photo-led' : 'type-led';
    case 'sceneIssue':
    case 'fieldGuideIssue':
      return facts.hasStrongImage ? 'photo-led' : 'archive-board';
    default:
      return facts.hasStrongImage ? 'photo-led' : 'archive-board';
  }
}

function editorNoteModeFor(archetype: IssueArchetype, facts: IssueFacts): EditorNoteMode {
  if (facts.issueNumber === 1) return 'letter';
  if (facts.thinness === 'thin') return 'one-line';
  if (archetype === 'listeningIssue' && facts.clusters.sound.length >= 5) return 'playlist-note';
  if (archetype === 'listeningIssue' || archetype === 'recordReviewIssue') return 'song-note';
  if (archetype === 'imageIssue') return 'image-note';
  return 'letter';
}

function signalScore(facts: IssueFacts, signal: IssueSignalName): number {
  return facts.signalScores.find((item) => item.signal === signal)?.score ?? 0;
}

function signalCount(facts: IssueFacts, signal: IssueSignalName): number {
  return facts.signalScores.find((item) => item.signal === signal)?.count ?? 0;
}

export function scoreIssueArchetype(facts: IssueFacts): IssueScore {
  const scores: Record<IssueArchetype, number> = {
    listeningIssue: signalScore(facts, 'sound') + (facts.hasStrongSound ? 12 : 0),
    sceneIssue: signalScore(facts, 'scene') + (facts.hasStrongPlace ? 12 : 0),
    recordReviewIssue: signalScore(facts, 'review') + (facts.hasStrongReview ? 10 : 0),
    fieldGuideIssue: signalScore(facts, 'guide') + (facts.hasStrongGuide ? 12 : 0),
    memoryIssue: signalScore(facts, 'memory') + (facts.hasStrongMemory ? 12 : 0),
    systemsIssue: signalScore(facts, 'systems') + (facts.hasStrongSystems ? 14 : 0),
    imageIssue: signalScore(facts, 'image') + (facts.hasStrongImage ? 8 : 0),
    argumentIssue: signalScore(facts, 'argument') + (facts.hasStrongArgument ? 12 : 0),
    mixedCultureIssue: Math.max(2, facts.sectionEntropy * 12 + facts.sectionMix.length * 3 + (facts.hasBalancedMix ? 18 : 0)),
    thinIssue: facts.thinness === 'thin' ? 999 : 0,
  };

  if (facts.issueNumber === 1) {
    scores.mixedCultureIssue += 80;
  }

  if (facts.hasSingleDominantSection) {
    scores.mixedCultureIssue -= 8;
  }

  if (facts.primarySignal?.signal === 'image' && facts.secondarySignal) {
    scores.imageIssue += 6;
  }

  if (signalCount(facts, 'review') >= 2 && signalScore(facts, 'review') >= signalScore(facts, 'sound') * 0.7) {
    scores.recordReviewIssue += 14;
  }

  const archetype = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as IssueArchetype;
  const reasons = [
    ...facts.factSummary,
    facts.readingDoor.article ? `reading door: ${facts.readingDoor.article.title}` : `reading door: ${facts.readingDoor.title}`,
    facts.topArticleReason ? `lead reason: ${facts.topArticleReason}` : 'no lead reason',
    `average score: ${facts.averageScore}`,
    `score spread: ${facts.scoreSpread}`,
  ];

  return {
    archetype,
    mood: moodForArchetype(archetype),
    coverVariant: facts.issueNumber === 1 ? 'seal-key-visual' : coverVariantFor(archetype, facts),
    editorNoteMode: editorNoteModeFor(archetype, facts),
    featureVisualMode: featureVisualModeFor(archetype, facts),
    reasons,
  };
}
