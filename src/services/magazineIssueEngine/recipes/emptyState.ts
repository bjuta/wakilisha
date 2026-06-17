import type { IssueArchetype, MagazineIssueRecipeContext } from '../types';

export function buildIssueEmptyState(context: MagazineIssueRecipeContext): string {
  const { facts, score } = context;
  if (facts.articleCount === 0) {
    return 'This issue has not found its first story yet. Come back when the room has something to say.';
  }

  if (facts.thinness === 'thin') {
    return 'This issue is still a short thread. Start with the strongest story, then move back to the magazine for more doors.';
  }

  const byArchetype: Record<IssueArchetype, string> = {
    listeningIssue: 'No listening path is ready here yet. Step back to the magazine and choose another sound to follow.',
    recordReviewIssue: 'No record stack is ready here yet. Try another issue with more releases on the table.',
    sceneIssue: 'No room is open here yet. Head back to the magazine and enter another scene.',
    fieldGuideIssue: 'No route is ready here yet. Try another issue with clearer places to move through.',
    memoryIssue: 'No fragment is ready here yet. Return to the magazine and follow another memory thread.',
    systemsIssue: 'No signal board is ready here yet. Try another issue with more machinery to open.',
    imageIssue: 'No image room is ready here yet. Return to the magazine and look for another visual thread.',
    argumentIssue: 'No argument stack is ready here yet. Try another issue with sharper counterpoints.',
    mixedCultureIssue: 'No constellation is ready here yet. Go back to the magazine and choose another door.',
    thinIssue: 'This issue is still too light to hold the room. Start from the magazine and follow a stronger thread.',
  };

  return byArchetype[score.archetype];
}
