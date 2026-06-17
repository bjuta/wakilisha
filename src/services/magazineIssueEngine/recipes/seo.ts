import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle, trimToWords } from '../formatters';

export function buildSeoDescription(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const thread = facts.tension ?? score.profile.publicName;

  if (facts.thinness === 'thin') {
    return trimToWords(`${facts.issueLabel} is a smaller WAKILISHA issue led by ${lead}, with one clear cultural thread to follow.`, 32);
  }

  const typeLine = (() => {
    switch (score.archetype) {
      case 'listeningIssue':
        return `a listening issue led by ${lead}`;
      case 'recordReviewIssue':
        return `a record-led issue anchored by ${lead}`;
      case 'sceneIssue':
        return `a scene issue led by ${lead}`;
      case 'fieldGuideIssue':
        return `a guide issue led by ${lead}`;
      case 'memoryIssue':
        return `a memory issue led by ${lead}`;
      case 'systemsIssue':
        return `a systems issue led by ${lead}`;
      case 'imageIssue':
        return `an image-led issue anchored by ${lead}`;
      case 'argumentIssue':
        return `an argument issue led by ${lead}`;
      case 'mixedCultureIssue':
      default:
        return `a mixed culture issue led by ${lead}`;
    }
  })();

  return trimToWords(`${facts.issueLabel} is ${typeLine}, following ${thread} across WAKILISHA stories.`, 34);
}
