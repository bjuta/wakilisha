import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle, trimToWords } from '../formatters';

export function buildSearchSnippet(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const thread = facts.tension ?? score.profile.publicName;

  if (facts.thinness === 'thin') {
    return trimToWords(`Small issue. Start with ${lead} and follow the clearest thread.`, 24);
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return trimToWords(`Listening issue. Start with ${lead}, then follow the sound through the rest of the issue.`, 30);
    case 'recordReviewIssue':
      return trimToWords(`Record-led issue. Start with ${lead}, then stay close to the records and what they reveal.`, 30);
    case 'sceneIssue':
      return trimToWords(`Scene issue. Start with ${lead}, then follow the rooms, routes and people around it.`, 30);
    case 'fieldGuideIssue':
      return trimToWords(`Guide issue. Start with ${lead}, then use the issue as a route through ${thread}.`, 30);
    case 'memoryIssue':
      return trimToWords(`Memory issue. Start with ${lead}, then follow what keeps speaking through ${thread}.`, 30);
    case 'systemsIssue':
      return trimToWords(`Systems issue. Start with ${lead}, then trace the machinery around the work.`, 30);
    case 'imageIssue':
      return trimToWords(`Image-led issue. Start with ${lead}, then follow the visual thread.`, 30);
    case 'argumentIssue':
      return trimToWords(`Argument issue. Start with ${lead}, then follow the tension around ${thread}.`, 30);
    case 'mixedCultureIssue':
    default:
      return trimToWords(`Mixed culture issue. Start with ${lead}, then follow ${thread}.`, 30);
  }
}
