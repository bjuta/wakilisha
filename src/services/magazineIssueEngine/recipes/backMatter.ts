import type { MagazineIssueRecipeContext } from '../types';

export function buildBackMatterLine({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'Your people are here.';
  if (facts.thinness === 'thin') return 'A small record is still a record.';
  return `${score.profile.pathVerb}. ${score.profile.visualPromise}`;
}
