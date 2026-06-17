import type { MagazineIssueFeatureFrame, MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

function publicFeatureNote(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.topArticle?.title);

  if (score.archetype === 'thinIssue') {
    return `${lead} is the clearest piece in this smaller issue.`;
  }

  return `${lead} is the issue’s main doorway. ${score.profile.readerPromise}`;
}

function adminFeatureNote(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  return `Use ${score.featureVisualMode} because archetype is ${score.archetype}, interaction pattern is ${score.interactionPattern}, dominant section is ${facts.dominantSection ?? 'unknown'}, and top article is ${facts.topArticle?.title ?? 'missing'}.`;
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
    imageCaption: feature?.heroUrl ? `Image from ${quoteTitle(feature.title)}.` : undefined,
    publicFieldNote,
    adminDesignNote: adminFeatureNote(context),
    fieldNote: publicFieldNote,
  };
}
