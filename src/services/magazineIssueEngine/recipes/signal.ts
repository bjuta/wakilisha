import type { MagazineIssueRecipeContext } from '../types';
import { humanList } from '../formatters';

export function buildSignalTitle({ facts, score }: MagazineIssueRecipeContext): string {
  switch (score.archetype) {
    case 'systemsIssue':
      return 'What the machinery reveals.';
    case 'listeningIssue':
      return 'What the sound is telling us.';
    case 'sceneIssue':
      return 'What the room remembers.';
    case 'memoryIssue':
      return 'What refuses to disappear.';
    case 'fieldGuideIssue':
      return 'What to carry with you.';
    case 'argumentIssue':
      return 'What talks back.';
    case 'imageIssue':
      return 'What the image is doing.';
    case 'thinIssue':
      return 'What is already visible.';
    default:
      return facts.dominantSection ? `What ${facts.dominantSection.toLowerCase()} is saying.` : 'What the issue is quietly telling us.';
  }
}

export function buildSignalDeck({ facts, score }: MagazineIssueRecipeContext): string {
  const sections = humanList(facts.sectionMix.slice(0, 3).map((item) => item.section.toLowerCase()));
  if (facts.thinness === 'thin') return 'A small reading of the clearest thread in this issue.';

  switch (score.archetype) {
    case 'systemsIssue':
      return 'A reading of rights, platforms, ownership and the systems sitting close to the work.';
    case 'listeningIssue':
      return 'A listening map of the records, rooms and music signals inside this issue.';
    case 'sceneIssue':
      return 'A scene map of rooms, routes, stages and the people carrying the moment.';
    case 'memoryIssue':
      return 'A memory note on language, archive and the pieces that keep speaking.';
    case 'fieldGuideIssue':
      return 'A guide note for the routes, places and details worth carrying forward.';
    case 'argumentIssue':
      return 'A sharp reading of form, conflict and culture that refuses to sit quietly.';
    case 'imageIssue':
      return 'A visual reading of the image, the frame and the story underneath.';
    default:
      return `A cultural reading of ${sections} and the thread connecting them.`;
  }
}

export function buildSignalReading(context: MagazineIssueRecipeContext): string {
  return buildSignalDeck(context);
}