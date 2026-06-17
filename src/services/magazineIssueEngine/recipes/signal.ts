import type { MagazineIssueRecipeContext } from '../types';
import { humanList, quoteTitle } from '../formatters';

function thread(context: MagazineIssueRecipeContext): string {
  return context.facts.tension ?? humanList(context.facts.sectionMix.slice(0, 3).map((item) => item.section.toLowerCase()), 'the issue');
}

export function buildSignalTitle({ facts, score }: MagazineIssueRecipeContext): string {
  if (score.archetype === 'thinIssue') return 'What is already clear.';

  switch (score.archetype) {
    case 'listeningIssue':
      return 'What the sound is telling us.';
    case 'recordReviewIssue':
      return 'What the records reveal.';
    case 'sceneIssue':
      return 'What the room is telling us.';
    case 'fieldGuideIssue':
      return 'What the route opens.';
    case 'memoryIssue':
      return 'What refuses to disappear.';
    case 'systemsIssue':
      return 'What sits under the culture.';
    case 'imageIssue':
      return 'What the image carries.';
    case 'argumentIssue':
      return 'What the argument exposes.';
    case 'mixedCultureIssue':
    default:
      return facts.dominantSection ? `What ${facts.dominantSection.toLowerCase()} opens up.` : 'What the issue is telling us.';
  }
}

export function buildSignalDeck(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const issueThread = thread(context);

  if (facts.thinness === 'thin') {
    return `A small reading of ${lead} and the thread it makes visible.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `Start with ${lead}, then follow how songs, artists and rooms speak to each other.`;
    case 'recordReviewIssue':
      return `Start with ${lead}, then listen for what the records say about the moment around them.`;
    case 'sceneIssue':
      return `Start with ${lead}, then follow the people, places and movement around ${issueThread}.`;
    case 'fieldGuideIssue':
      return `Start with ${lead}, then use the issue as a route through ${issueThread}.`;
    case 'memoryIssue':
      return `Start with ${lead}, then follow the names, language and fragments that keep speaking.`;
    case 'systemsIssue':
      return `Start with ${lead}, then trace the rules, money, platforms and pressure around the work.`;
    case 'imageIssue':
      return `Start with ${lead}, then let the image trail show what the issue feels before it explains.`;
    case 'argumentIssue':
      return `Start with ${lead}, then follow the disagreement, taste and form around ${issueThread}.`;
    case 'mixedCultureIssue':
    default:
      return `Start with ${lead}, then follow ${issueThread}. The issue works through the conversation between its pieces.`;
  }
}

export function buildSignalReading(context: MagazineIssueRecipeContext): string {
  return buildSignalDeck(context);
}
