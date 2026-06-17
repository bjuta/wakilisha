import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

export function buildCoverLine({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'Your people are here.';

  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const thread = facts.tension ?? score.profile.publicName;

  if (score.archetype === 'thinIssue') {
    return `One clear thread, led by ${lead}.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `Start with the sound. ${lead} carries the pulse.`;
    case 'recordReviewIssue':
      return `Records in focus, with ${lead} at the center.`;
    case 'sceneIssue':
      return `Rooms, routes and people, entered through ${lead}.`;
    case 'fieldGuideIssue':
      return `A guide for movement. Begin with ${lead}.`;
    case 'memoryIssue':
      return `What stays, what speaks back, and ${lead}.`;
    case 'systemsIssue':
      return `The machinery around culture, opened by ${lead}.`;
    case 'imageIssue':
      return `Look first. ${lead} sets the visual charge.`;
    case 'argumentIssue':
      return `A raised eyebrow issue, led by ${lead}.`;
    case 'mixedCultureIssue':
    default:
      return `A WAKILISHA issue about ${thread}, led by ${lead}.`;
  }
}
