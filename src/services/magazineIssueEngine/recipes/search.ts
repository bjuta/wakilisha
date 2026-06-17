import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle, trimToWords } from '../formatters';
import { buildCardBlurb } from './card';

export function buildSearchSnippet(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  if (facts.thinness === 'thin') return trimToWords(`Small issue led by ${quoteTitle(facts.topArticle?.title)}.`, 22);

  const base = buildCardBlurb(context);
  const suffix = score.archetype === 'systemsIssue'
    ? ' Useful for readers following rights, platforms and ownership.'
    : score.archetype === 'listeningIssue'
      ? ' Useful for readers following music, records and scenes.'
      : '';

  return trimToWords(`${base}${suffix}`, 34);
}