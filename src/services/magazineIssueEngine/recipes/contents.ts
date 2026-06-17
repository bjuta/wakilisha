import type { MagazineIssueRecipeContext, ReadingPathStep } from '../types';
import { articleSection, humanList, quoteTitle } from '../formatters';

export function buildContentsIntro({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.thinness === 'thin') return 'A short issue. Start with the strongest piece, then follow the thread that is already visible.';

  if (score.archetype === 'mixedCultureIssue') {
    return `Start with ${quoteTitle(facts.topArticle?.title)}, then follow ${humanList(facts.sectionMix.slice(0, 3).map((item) => item.section.toLowerCase()))}.`;
  }

  return score.profile.readerPromise;
}

export function buildContentsTitle({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'The culture, on record.';
  return score.profile.cta;
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

  const steps = pathArticles.map((article, index) => ({
    id: `${facts.issue.slug}-path-${index + 1}`,
    label: index === 0 ? 'Start here' : index === 1 ? score.profile.pathVerb : 'Keep going',
    title: article!.title,
    description: index === 0
      ? `${score.profile.openingVerb}. ${facts.readingDoor.reason}`
      : `A ${articleSection(article!).toLowerCase()} piece that keeps ${score.profile.publicName} moving.`,
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
