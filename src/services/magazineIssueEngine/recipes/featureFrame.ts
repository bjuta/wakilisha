import type { MagazineIssueFeatureFrame, MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

function publicFeatureNote(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.topArticle?.title);
  switch (score.archetype) {
    case 'systemsIssue':
      return `${lead} carries the main argument. Read it as the receipt, not just the headline.`;
    case 'memoryIssue':
      return `${lead} carries the memory thread. It gives the issue its quiet center.`;
    case 'sceneIssue':
      return `${lead} opens the room. The rest of the issue moves around that scene.`;
    case 'listeningIssue':
      return `${lead} sets the pulse. Start there, then follow the sound outward.`;
    case 'fieldGuideIssue':
      return `${lead} is the route marker. Use it to enter the issue in motion.`;
    case 'argumentIssue':
      return `${lead} starts the argument. The other pieces sharpen it.`;
    case 'imageIssue':
      return `${lead} sets the visual temperature. Look at it before you explain it.`;
    case 'thinIssue':
      return `${lead} is the clearest piece in this smaller issue.`;
    default:
      return `${lead} is the issue’s main doorway.`;
  }
}

function adminFeatureNote(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  return `Use ${score.featureVisualMode} because archetype is ${score.archetype}, dominant section is ${facts.dominantSection ?? 'unknown'}, and top article is ${facts.topArticle?.title ?? 'missing'}.`;
}

export function buildFeatureFrame(context: MagazineIssueRecipeContext): MagazineIssueFeatureFrame {
  const { facts, score } = context;
  const feature = facts.topArticle;
  const publicFieldNote = publicFeatureNote(context);

  if (facts.issueNumber === 1) {
    return {
      eyebrow: 'Feature · Sound migration',
      routeLabel: 'Johannesburg → Nairobi',
      titlePrefix: 'A route through sound',
      publicFieldNote,
      adminDesignNote: 'Keep Issue 001 route treatment because this launch issue introduces WAKILISHA as cultural infrastructure beginning with music.',
      fieldNote: publicFieldNote,
    };
  }

  const eyebrowByMode: Record<string, string> = {
    'signal-board': 'Feature · Systems file',
    'paper-file': 'Feature · Paper trail',
    'photo-led': `Feature · ${facts.dominantSection ?? 'Issue lead'}`,
    'type-led': `Feature · ${facts.dominantSection ?? 'Issue lead'}`,
    'archive-board': `Feature · ${facts.dominantSection ?? 'Issue lead'}`,
  };

  const prefixByMode: Record<string, string> = {
    'signal-board': 'Open the machinery',
    'paper-file': 'A reading note',
    'photo-led': 'Look first',
    'type-led': 'The argument opens here',
    'archive-board': 'The thread starts here',
  };

  return {
    eyebrow: eyebrowByMode[score.featureVisualMode] ?? `Feature · ${facts.dominantSection ?? 'Issue lead'}`,
    titlePrefix: prefixByMode[score.featureVisualMode] ?? 'Start here',
    imageCaption: feature?.heroUrl ? `Image from ${quoteTitle(feature.title)}.` : undefined,
    publicFieldNote,
    adminDesignNote: adminFeatureNote(context),
    fieldNote: publicFieldNote,
  };
}