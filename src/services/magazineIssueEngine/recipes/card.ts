import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

function thread(context: MagazineIssueRecipeContext): string {
  return context.facts.tension ?? context.score.profile.publicName;
}

export function buildCardBlurb(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const issueThread = thread(context);

  if (facts.thinness === 'thin') {
    return `A smaller WAKILISHA issue led by ${lead}. One clear thread, no grandstanding.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `A listening issue led by ${lead}. Start with the sound, then follow the room around it.`;
    case 'recordReviewIssue':
      return `A record-led issue anchored by ${lead}. Close listening, sharp context, no filler.`;
    case 'sceneIssue':
      return `A scene issue led by ${lead}. Rooms, routes, people and the heat around them.`;
    case 'fieldGuideIssue':
      return `A guide issue led by ${lead}. Built to move through ${issueThread}.`;
    case 'memoryIssue':
      return `A memory issue led by ${lead}. Names, language and stories that keep speaking.`;
    case 'systemsIssue':
      return `A systems issue led by ${lead}. The rules, platforms and pressure behind the culture.`;
    case 'imageIssue':
      return `An image-led issue anchored by ${lead}. Look first, then read what the image is doing.`;
    case 'argumentIssue':
      return `An argument issue led by ${lead}. Taste, form, conflict and the parts that talk back.`;
    case 'mixedCultureIssue':
    default:
      return `A mixed culture issue led by ${lead}. The thread is ${issueThread}.`;
  }
}

export function buildArchiveBlurb(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  if (score.archetype === 'thinIssue') return buildCardBlurb(context);

  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  return `${buildCardBlurb(context)} Start with ${lead}.`;
}
