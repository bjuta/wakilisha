import type { MagazineIssueRecipeContext } from '../types';

export function buildBackMatterLine({ facts, score }: MagazineIssueRecipeContext): string {
  if (facts.issueNumber === 1) return 'Your people are here.';
  if (facts.thinness === 'thin') return 'A small record is still a record.';

  switch (score.archetype) {
    case 'listeningIssue':
      return 'Replay the issue from the first sound.';
    case 'recordReviewIssue':
      return 'The records stay on the table.';
    case 'sceneIssue':
      return 'The room closes, but the trace stays.';
    case 'fieldGuideIssue':
      return 'Carry the route forward.';
    case 'memoryIssue':
      return 'What stays keeps speaking.';
    case 'systemsIssue':
      return 'The machinery remains visible.';
    case 'imageIssue':
      return 'The image keeps working after the page ends.';
    case 'argumentIssue':
      return 'The argument remains open.';
    default:
      return 'The record remains open.';
  }
}