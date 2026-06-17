import type { MagazineIssueRecipeContext } from '../types';

export function buildAdminQualityNote({ facts, score }: MagazineIssueRecipeContext): string {
  const warnings: string[] = [];

  if (facts.thinness === 'thin') warnings.push('thin issue: add more usable stories before heavy promotion');
  if (!facts.topArticle) warnings.push('missing lead story');
  if (!facts.hasStrongImage && score.profile.interactionPattern === 'imageGallery') warnings.push('image-led experience selected with weak image pool');
  if (!facts.hasStrongImage) warnings.push('weak image pool');
  if (!facts.tension) warnings.push('weak editorial tension');
  if (facts.hasBalancedMix && score.archetype !== 'mixedCultureIssue') warnings.push('balanced mix: confirm selected archetype is intentional');

  const status = warnings.length ? warnings.join('; ') : 'ready for public issue experience';
  return `Admin: ${score.profile.label} using ${score.interactionPattern}. ${status}.`;
}
