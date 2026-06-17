import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

export function buildCardBlurb({ facts, score }: MagazineIssueRecipeContext): string {
  const lead = quoteTitle(facts.topArticle?.title);

  if (facts.thinness === 'thin') {
    return `A smaller issue led by ${lead}. Start there and follow the clearest thread.`;
  }

  if (score.archetype === 'mixedCultureIssue') {
    return `A WAKILISHA issue led by ${lead}, with ${facts.articleCount} pieces in the mix.`;
  }

  return `${score.profile.label} led by ${lead}. ${score.profile.readerPromise}`;
}

export function buildArchiveBlurb(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  if (score.archetype === 'thinIssue') return buildCardBlurb(context);
  return `${buildCardBlurb(context)} ${score.profile.cta}.`;
}
