import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

export function buildCardBlurb({ facts, score }: MagazineIssueRecipeContext): string {
  const lead = quoteTitle(facts.topArticle?.title);
  if (facts.thinness === 'thin') return `A smaller issue led by ${lead}. Start there and follow the clearest thread.`;

  switch (score.archetype) {
    case 'listeningIssue':
      return `A listening issue led by ${lead}. Start with the sound, then follow the stories around it.`;
    case 'sceneIssue':
      return `A scene issue with rooms, routes and people in motion, beginning at ${lead}.`;
    case 'systemsIssue':
      return `A systems issue about the machinery around culture, with ${lead} as the doorway.`;
    case 'memoryIssue':
      return `A memory issue about language, archive and what refuses to disappear.`;
    case 'fieldGuideIssue':
      return `A guide issue built for movement. Open ${lead}, then carry the route forward.`;
    case 'argumentIssue':
      return `A sharp issue about form, conflict and the pieces that talk back.`;
    case 'imageIssue':
      return `An image-led issue. Look first, then read through ${lead}.`;
    case 'recordReviewIssue':
      return `A record-led issue with listening, review and texture at the center.`;
    default:
      return `A WAKILISHA issue led by ${lead}, with ${facts.articleCount} pieces in the mix.`;
  }
}

export function buildArchiveBlurb(context: MagazineIssueRecipeContext): string {
  return buildCardBlurb(context);
}