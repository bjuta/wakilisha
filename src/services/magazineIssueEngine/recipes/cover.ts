import type { MagazineIssueRecipeContext } from '../types';
import { quoteTitle } from '../formatters';

export function buildCoverLine({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'Your people are here.';

  const lead = quoteTitle(facts.topArticle?.title);
  const profile = score.profile;

  if (score.archetype === 'thinIssue') {
    return 'A smaller issue with one clear thread.';
  }

  if (score.archetype === 'mixedCultureIssue') {
    return `A WAKILISHA issue led by ${lead}, where different signals start talking to each other.`;
  }

  return `${profile.label}. ${profile.openingVerb} through ${lead}.`;
}
