import type { MagazineIssueRecipeContext } from '../types';
import { trimToWords } from '../formatters';
import { buildSearchSnippet } from './search';

export function buildSeoDescription(context: MagazineIssueRecipeContext): string {
  const { facts } = context;
  const snippet = buildSearchSnippet(context);
  return trimToWords(`${facts.issueLabel}: ${snippet}`, 34);
}