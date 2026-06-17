import type { MagazineIssueFeatureFrame, MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

function publicFeatureNote(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const thread = facts.tension ?? score.profile.publicName;

  if (score.archetype === 'thinIssue') {
    return `${lead} is the clearest doorway into this smaller issue.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `${lead} gives the issue its pulse. Follow the sound from there.`;
    case 'recordReviewIssue':
      return `${lead} is the record-side doorway. The rest of the issue listens around it.`;
    case 'sceneIssue':
      return `${lead} opens the room. The issue follows the people and places around it.`;
    case 'fieldGuideIssue':
      return `${lead} is the first stop. The issue is built to keep moving.`;
    case 'memoryIssue':
      return `${lead} carries the memory thread. The issue follows what refuses to disappear.`;
    case 'systemsIssue':
      return `${lead} opens the machinery. The issue traces the rules and pressure around the work.`;
    case 'imageIssue':
      return `${lead} sets the visual temperature. Look first, then follow the meaning.`;
    case 'argumentIssue':
      return `${lead} opens the argument. The issue follows the tension around ${thread}.`;
    case 'mixedCultureIssue':
    default:
      return `${lead} is the issue's main doorway. The thread is ${thread}.`;
  }
}

function adminFeatureNote(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const cluster = facts.primarySignal
    ? `${facts.primarySignal.label.toLowerCase()} with ${facts.primarySignal.count} linked stories`
    : facts.dominantSection ?? 'the strongest available issue thread';
  const secondary = facts.secondarySignal ? ` Secondary cluster: ${facts.secondarySignal.label.toLowerCase()}.` : '';
  const lead = facts.readingDoor.article?.title ?? facts.topArticle?.title ?? 'missing lead story';

  return `Admin: Use ${score.featureVisualMode} because archetype is ${score.archetype} and top stories cluster around ${cluster}.${secondary} Interaction pattern: ${score.interactionPattern}. Lead story: ${lead}.`;
}

export function buildFeatureFrame(context: MagazineIssueRecipeContext): MagazineIssueFeatureFrame {
  const { facts, score } = context;
  const feature = facts.readingDoor.article ?? facts.topArticle;
  const publicFieldNote = publicFeatureNote(context);

  if (facts.issueNumber === 1) {
    return {
      eyebrow: 'Feature · Sound migration',
      routeLabel: 'Johannesburg to Nairobi',
      titlePrefix: 'A route through sound',
      publicFieldNote,
      adminDesignNote: 'Admin: Use the launch route frame because Issue 001 introduces WAKILISHA as cultural infrastructure beginning with music.',
      fieldNote: publicFieldNote,
    };
  }

  const eyebrowByPattern: Record<string, string> = {
    listeningPath: 'Feature · Listening path',
    sceneRoute: 'Feature · Scene route',
    recordStack: 'Feature · Record stack',
    fieldGuide: 'Feature · Field guide',
    memoryFragments: 'Feature · Memory fragments',
    signalBoard: 'Feature · Systems file',
    imageGallery: 'Feature · Image lead',
    argumentStack: 'Feature · Argument stack',
    constellation: `Feature · ${facts.dominantSection ?? 'Issue lead'}`,
    singleThread: 'Feature · Small issue',
  };

  return {
    eyebrow: eyebrowByPattern[score.interactionPattern] ?? `Feature · ${facts.dominantSection ?? 'Issue lead'}`,
    titlePrefix: score.profile.openingVerb,
    imageCaption: feature?.heroUrl ? `${quoteTitle(feature.title)} carries the issue's first visual feeling.` : undefined,
    publicFieldNote,
    adminDesignNote: adminFeatureNote(context),
    fieldNote: publicFieldNote,
  };
}
