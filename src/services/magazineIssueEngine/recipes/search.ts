import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle, trimToWords } from '../formatters';
import { buildCardBlurb } from './card';

export function buildSearchSnippet(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  if (facts.thinness === 'thin') return trimToWords(`Small issue led by ${quoteTitle(facts.topArticle?.title)}.`, 22);

  const base = buildCardBlurb(context);
  const suffix = score.archetype === 'mixedCultureIssue'
    ? ' Useful for readers following the wider culture map.'
    : ` Useful for readers looking for ${score.profile.publicName}.`;

  return trimToWords(`${base}${suffix}`, 34);
}
