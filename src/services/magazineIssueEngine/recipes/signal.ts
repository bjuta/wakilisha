import type { MagazineIssueRecipeContext } from '../types';
import { humanList } from '../formatters';

export function buildSignalTitle({ facts, score }: MagazineIssueRecipeContext): string {
  if (score.archetype === 'thinIssue') return 'What is already visible.';
  if (score.archetype === 'mixedCultureIssue') {
    return facts.dominantSection ? `What ${facts.dominantSection.toLowerCase()} is saying.` : 'What the issue is quietly telling us.';
  }
  return score.profile.pathVerb.endsWith('.') ? score.profile.pathVerb : `${score.profile.pathVerb}.`;
}

export function buildSignalDeck({ facts, score }: MagazineIssueRecipeContext): string {
  const sections = humanList(facts.sectionMix.slice(0, 3).map((item) => item.section.toLowerCase()));
  if (facts.thinness === 'thin') return 'A small reading of the clearest thread in this issue.';
  if (score.archetype === 'mixedCultureIssue') return `A cultural reading of ${sections} and the thread connecting them.`;
  return `${score.profile.readerPromise} The issue moves with a ${score.profile.surfaceTone} shape.`;
}

export function buildSignalReading(context: MagazineIssueRecipeContext): string {
  return buildSignalDeck(context);
}
