import type { IssueArchetype, IssueCoverVariant, IssueFacts, IssueMood, IssueScore, EditorNoteMode, FeatureVisualMode } from './types';

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

function coverVariantFor(archetype: IssueArchetype): IssueCoverVariant {
  switch (archetype) {
    case 'systemsIssue':
      return 'signal-grid';
    case 'memoryIssue':
    case 'recordReviewIssue':
      return 'paper-cover';
    case 'sceneIssue':
    case 'fieldGuideIssue':
    case 'imageIssue':
      return 'image-trace';
    case 'argumentIssue':
      return 'type-cover';
    default:
      return 'seal-key-visual';
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
      return 'type-led';
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

export function scoreIssueArchetype(facts: IssueFacts): IssueScore {
  const scores: Record<IssueArchetype, number> = {
    listeningIssue: facts.clusters.sound.length * 4 + (facts.hasStrongSound ? 5 : 0),
    sceneIssue: facts.clusters.scene.length * 5 + (facts.hasStrongPlace ? 4 : 0),
    recordReviewIssue: facts.clusters.review.length * 5 + (facts.hasStrongReview ? 4 : 0),
    fieldGuideIssue: facts.clusters.guide.length * 5 + (facts.hasStrongGuide ? 4 : 0),
    memoryIssue: facts.clusters.memory.length * 6 + (facts.hasStrongMemory ? 4 : 0),
    systemsIssue: facts.clusters.systems.length * 6 + (facts.hasStrongSystems ? 5 : 0),
    imageIssue: facts.clusters.image.length * 3 + (facts.hasStrongImage ? 4 : 0),
    argumentIssue: facts.clusters.argument.length * 6 + (facts.hasStrongArgument ? 4 : 0),
    mixedCultureIssue: Math.max(2, facts.sectionMix.length * 2),
    thinIssue: facts.thinness === 'thin' ? 99 : 0,
  };

  if (facts.issueNumber === 1) {
    scores.mixedCultureIssue += 30;
  }

  const archetype = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as IssueArchetype;
  const reasons = [
    `${facts.articleCount} public articles`,
    facts.dominantSection ? `dominant section: ${facts.dominantSection}` : 'no dominant section',
    facts.tension ? `tension: ${facts.tension}` : 'no clear tension yet',
  ];

  return {
    archetype,
    mood: moodForArchetype(archetype),
    coverVariant: facts.issueNumber === 1 ? 'seal-key-visual' : coverVariantFor(archetype),
    editorNoteMode: editorNoteModeFor(archetype, facts),
    featureVisualMode: featureVisualModeFor(archetype, facts),
    reasons,
  };
}