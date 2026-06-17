import type { MagazineIssueRecipeContext, ReadingPathStep } from '../types';
import { articleSection, humanList, quoteTitle } from '../formatters';

export function buildContentsIntro({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.thinness === 'thin') return 'A short issue. Start with the strongest piece, then follow the thread that is already visible.';

  switch (score.archetype) {
    case 'listeningIssue':
      return 'Read it like a listening session. Start with the pulse, then follow the room it opens.';
    case 'sceneIssue':
      return 'Enter through the room, then follow the route through people, places and scenes.';
    case 'systemsIssue':
      return 'Start with the cleanest argument, then follow the receipts around it.';
    case 'memoryIssue':
      return 'Move slowly here. The issue is built from words, memory and what keeps returning.';
    case 'fieldGuideIssue':
      return 'Use this like a route. Start here, then carry the next piece with you.';
    case 'argumentIssue':
      return 'Open the argument first. The rest of the issue shows what talks back.';
    case 'imageIssue':
      return 'Look first. The path begins with the image, then moves into the story behind it.';
    default:
      return `Start with ${quoteTitle(facts.topArticle?.title)}, then follow ${humanList(facts.sectionMix.slice(0, 3).map((item) => item.section.toLowerCase()))}.`;
  }
}

export function buildContentsTitle({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'The culture, on record.';
  switch (score.archetype) {
    case 'listeningIssue':
      return 'Start with the sound.';
    case 'sceneIssue':
      return 'Enter the room.';
    case 'systemsIssue':
      return 'Open the machinery.';
    case 'memoryIssue':
      return 'Follow what stays.';
    case 'fieldGuideIssue':
      return 'Carry this with you.';
    case 'argumentIssue':
      return 'Open the argument.';
    case 'imageIssue':
      return 'Look first.';
    default:
      return `What ${facts.dominantSection?.toLowerCase() ?? 'the culture'} left behind.`;
  }
}

export function buildReadingPath(context: MagazineIssueRecipeContext): ReadingPathStep[] {
  const { facts, score } = context;
  const lead = facts.topArticle;
  const sectionSteps = facts.leadArticles.slice(0, 4).map((article, index) => ({
    id: `${facts.issue.slug}-path-${index + 1}`,
    label: index === 0 ? 'Start here' : index === 1 ? 'Then follow' : 'Keep going',
    title: article.title,
    description: index === 0
      ? `This is the issue’s cleanest doorway into ${score.archetype.replace(/Issue$/, '').replace(/([A-Z])/g, ' $1').toLowerCase()}.`
      : `A ${articleSection(article).toLowerCase()} piece that keeps the thread moving.`,
    articleSlug: article.slug,
  }));

  if (!sectionSteps.length && lead) {
    return [{
      id: `${facts.issue.slug}-path-start`,
      label: 'Start here',
      title: lead.title,
      description: 'The clearest piece in a small issue.',
      articleSlug: lead.slug,
    }];
  }

  return sectionSteps;
}