import type { MagazineIssueRecipeContext } from '../types';

export function buildAdminQualityNote({ facts, score }: MagazineIssueRecipeContext): string {
  const warnings: string[] = [];
  if (facts.thinness === 'thin') warnings.push('thin issue: add more usable articles before featuring heavily');
  if (!facts.topArticle) warnings.push('missing lead article');
  if (!facts.hasStrongImage && score.profile.interactionPattern === 'imageGallery') warnings.push('image issue selected with weak image pool');
  if (!facts.hasStrongImage) warnings.push('weak image pool');
  if (!facts.tension) warnings.push('weak issue tension');

  const status = warnings.length ? warnings.join('; ') : 'ready for public issue treatment';
  return `${score.profile.label} using ${score.interactionPattern}: ${status}.`;
}
