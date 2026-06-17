import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

export function buildBackMatterLine({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'Your people are here.';

  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const thread = facts.tension ?? score.profile.publicName;

  if (facts.thinness === 'thin') {
    return `A small record is still a record. Leave through ${lead}.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return 'Leave with the sound still moving.';
    case 'recordReviewIssue':
      return 'Leave with the records still asking for another listen.';
    case 'sceneIssue':
      return 'Leave with the room, the route and the people still close.';
    case 'fieldGuideIssue':
      return 'Leave with somewhere to go next.';
    case 'memoryIssue':
      return 'Leave with what refused to disappear.';
    case 'systemsIssue':
      return 'Leave seeing the machinery a little more clearly.';
    case 'imageIssue':
      return 'Leave with the image still doing work.';
    case 'argumentIssue':
      return 'Leave with a position, or at least a sharper question.';
    case 'mixedCultureIssue':
    default:
      return `Leave through ${thread}. The pieces keep talking after the issue closes.`;
  }
}
