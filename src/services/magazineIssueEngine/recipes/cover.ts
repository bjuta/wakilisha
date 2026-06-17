import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

export function buildCoverLine({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'Your people are here.';

  const lead = quoteTitle(facts.topArticle?.title);
  switch (score.archetype) {
    case 'listeningIssue':
      return `A listening issue led by ${lead}.`;
    case 'recordReviewIssue':
      return `Records on the table, with ${lead} at the center.`;
    case 'sceneIssue':
      return `Rooms, routes and scenes, beginning with ${lead}.`;
    case 'fieldGuideIssue':
      return `A guide issue built to move, starting at ${lead}.`;
    case 'memoryIssue':
      return `A memory issue about what refuses to disappear.`;
    case 'systemsIssue':
      return `A systems issue for the machinery around culture.`;
    case 'imageIssue':
      return `An image-led issue. Look first, then enter through ${lead}.`;
    case 'argumentIssue':
      return `A sharp issue for form, conflict and the pieces that talk back.`;
    case 'thinIssue':
      return `A smaller issue with one clear thread.`;
    default:
      return `A WAKILISHA issue led by ${lead}.`;
  }
}