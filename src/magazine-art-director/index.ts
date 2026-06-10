/**
 * Magazine Art Director — Public API
 * Export everything needed by the magazine pages.
 */

export { DESIGN_SCHOOLS, getSchool, getAllSchools, getCompatibleHybrids } from './schools';
export { generateIssueTokens, getSchoolFontUrl, SCHOOL_GOOGLE_FONTS } from './engine';
export { getIssueBrief, getAllIssueBriefs, getIssueSchoolClass, getIssueModeClass } from './briefs';
export { useArtDirector } from './useArtDirector';
export type {
  DesignSchoolName,
  DesignSchool,
  IssueBrief,
  GeneratedTokens,
  SpreadType,
  DeviceAtom,
  MotionBehavior,
  Density,
} from './types';