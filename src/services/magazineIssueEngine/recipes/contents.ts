import type { MagazineIssueRecipeContext, ReadingPathStep } from '../types';
import { articleSection, humanList, quoteTitle } from '../formatters';

function threadLine(context: MagazineIssueRecipeContext): string {
  const { facts } = context;
  return facts.tension ?? humanList(facts.sectionMix.slice(0, 3).map((item) => item.section.toLowerCase()), 'the issue');
}

export function buildContentsIntro(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  const lead = quoteTitle(facts.readingDoor.article?.title ?? facts.topArticle?.title);
  const thread = threadLine(context);

  if (facts.thinness === 'thin') {
    return `Start with ${lead}. This is a short issue, so the path stays simple and honest.`;
  }

  switch (score.archetype) {
    case 'listeningIssue':
      return `Read this like a listening session. Start with ${lead}, then follow ${thread}.`;
    case 'recordReviewIssue':
      return `Start with ${lead}. Then move record by record through ${thread}.`;
    case 'sceneIssue':
      return `Enter through ${lead}. Then follow the people, places and routes around ${thread}.`;
    case 'fieldGuideIssue':
      return `Use ${lead} as your first stop. The rest of the path follows ${thread}.`;
    case 'memoryIssue':
      return `Begin with ${lead}. Then follow what the issue keeps returning to: ${thread}.`;
    case 'systemsIssue':
      return `Start with ${lead}. Then trace the rules, platforms and pressure points behind ${thread}.`;
    case 'imageIssue':
      return `Look first at ${lead}. Then follow the visual thread through ${thread}.`;
    case 'argumentIssue':
      return `Open the argument with ${lead}. Then follow the tension around ${thread}.`;
    case 'mixedCultureIssue':
    default:
      return `Start with ${lead}. The path moves across ${thread}, and the meaning sits between the pieces.`;
  }
}

export function buildContentsTitle({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'The culture, on record.';

  switch (score.archetype) {
    case 'listeningIssue':
      return 'Start with the sound.';
    case 'recordReviewIssue':
      return 'Start with the records.';
    case 'sceneIssue':
      return 'Enter the room.';
    case 'fieldGuideIssue':
      return 'Follow the route.';
    case 'memoryIssue':
      return 'Follow what stays.';
    case 'systemsIssue':
      return 'Look under the hood.';
    case 'imageIssue':
      return 'Look first.';
    case 'argumentIssue':
      return 'Open the argument.';
    case 'thinIssue':
      return 'One clear thread.';
    case 'mixedCultureIssue':
    default:
      return 'Start where the issue speaks loudest.';
  }
}

export function buildReadingPath(context: MagazineIssueRecipeContext): ReadingPathStep[] {
  const { facts, score } = context;
  const lead = facts.readingDoor.article ?? facts.topArticle;
  const signalArticles = score.profile.signal
    ? facts.clusters[score.profile.signal].filter((article) => article.slug !== lead?.slug)
    : [];
  const mixedArticles = facts.leadArticles.filter((article) => article.slug !== lead?.slug);
  const pathArticles = [lead, ...signalArticles, ...mixedArticles]
    .filter(Boolean)
    .filter((article, index, items) => items.findIndex((item) => item?.slug === article?.slug) === index)
    .slice(0, 4);

  const secondLabel = (() => {
    switch (score.archetype) {
      case 'listeningIssue':
        return 'Follow the sound';
      case 'recordReviewIssue':
        return 'Stay with the records';
      case 'sceneIssue':
        return 'Follow the room';
      case 'fieldGuideIssue':
        return 'Take the next stop';
      case 'memoryIssue':
        return 'Follow the memory';
      case 'systemsIssue':
        return 'Trace the machinery';
      case 'imageIssue':
        return 'Follow the image';
      case 'argumentIssue':
        return 'Open the counterpoint';
      default:
        return 'Follow the thread';
    }
  })();

  const steps = pathArticles.map((article, index) => ({
    id: `${facts.issue.slug}-path-${index + 1}`,
    label: index === 0 ? 'Start here' : index === 1 ? secondLabel : 'Keep going',
    title: article!.title,
    description: index === 0
      ? facts.readingDoor.reason
      : `${quoteTitle(article!.title)} keeps the ${articleSection(article!).toLowerCase()} side of the issue moving.`,
    articleSlug: article!.slug,
  }));

  if (!steps.length && lead) {
    return [{
      id: `${facts.issue.slug}-path-start`,
      label: 'Start here',
      title: lead.title,
      description: 'The clearest piece in a small issue.',
      articleSlug: lead.slug,
    }];
  }

  return steps;
}
