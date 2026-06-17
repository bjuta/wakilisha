import type { MagazineIssue } from './magazineIssues';
import type { MagazineIssueExperience } from './magazineIssueEngine';
import { buildMagazineIssueExperience } from './magazineIssueEngine';
import { MAGAZINE_EDITORIAL_PATHS } from './magazineIssueEngine/editorialPaths';

export const WAKILISHA_MAGAZINE_EDITOR = {
  name: 'Muiruri Beautah',
  role: 'Founder & Editor-in-Chief',
} as const;

export type EditorNoteMode = MagazineIssueExperience['editorNote']['mode'];
export type FeatureVisualMode = MagazineIssueExperience['featureVisualMode'];

/**
 * @deprecated Use MagazineIssueExperience from src/services/magazineIssueEngine.
 * This compatibility type keeps the existing issue page stable while the new
 * engine becomes the only source for magazine issue copy.
 */
export type MagazineEditorialSystem = MagazineIssueExperience;

/**
 * @deprecated Use buildMagazineIssueExperience from src/services/magazineIssueEngine.
 * The old template-led magazine copy has been replaced with the Magazine Issue
 * Engine so public issue pages receive reader-facing copy and admin notes stay
 * separated from public field notes.
 */
export function buildIssueEditorialSystem(issue: MagazineIssue): MagazineEditorialSystem {
  const experience = buildMagazineIssueExperience(issue);
  if (issue.issueNumber !== 1 && issue.slug !== 'issue-001') return experience;

  return {
    ...experience,
    editorNote: {
      ...experience.editorNote,
      mdxPath: MAGAZINE_EDITORIAL_PATHS.editorNote,
      hasMdxOverride: true,
      generatedFallbackBody: experience.editorNote.body,
    },
  } as MagazineEditorialSystem;
}
