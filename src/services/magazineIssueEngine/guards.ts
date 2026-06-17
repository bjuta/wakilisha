import { cleanText } from './formatters';

const BANNED_PUBLIC_PATTERNS: Array<[RegExp, string]> = [
  [/\bgenerated\b/i, 'public issue copy must not say generated'],
  [/\bsource window\b/i, 'public issue copy must not say source window'],
  [/\bsource range\b/i, 'public issue copy must not say source range'],
  [/\bmagazine engine\b/i, 'public issue copy must not say magazine engine'],
  [/\barchive gathered\b/i, 'public issue copy must not say archive gathered'],
  [/\bcanonical section\b/i, 'public issue copy must not say canonical section'],
  [/\bstale editorial signal\b/i, 'public issue copy must not say stale editorial signal'],
  [/\bstale\b/i, 'public issue copy must not say stale'],
  [/\breview-flagged\b/i, 'public issue copy must not say review-flagged'],
  [/\bcover variant\b/i, 'public issue copy must not say cover variant'],
  [/\bfield evidence\b/i, 'public issue copy must not say field evidence'],
  [/\broute treatment\b/i, 'public issue copy must not say route treatment'],
  [/\blayout treatment\b/i, 'public issue copy must not say layout treatment'],
  [/\u2013|\u2014/, 'public issue copy must not use em or en dashes'],
];

export function sanitizePublicIssueCopy(value: string): string {
  return cleanText(value)
    .replace(/\bsource window\b/gi, 'issue period')
    .replace(/\bsource range\b/gi, 'issue period')
    .replace(/\bmagazine engine\b/gi, 'editorial system')
    .replace(/\barchive gathered\b/gi, 'the issue gathers')
    .replace(/\bgenerated\b/gi, 'built')
    .replace(/\bstale editorial signal\b/gi, 'held story')
    .replace(/\bstale\b/gi, 'held back')
    .replace(/\breview-flagged\b/gi, 'held back')
    .replace(/\bcover variant\b/gi, 'cover direction')
    .replace(/\bfield evidence\b/gi, 'field note')
    .replace(/\broute treatment\b/gi, 'route frame')
    .replace(/\blayout treatment\b/gi, 'layout direction')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validatePublicIssueCopy(values: Array<string | undefined>): string[] {
  const warnings: string[] = [];
  values.filter(Boolean).forEach((value) => {
    const text = String(value);
    BANNED_PUBLIC_PATTERNS.forEach(([pattern, warning]) => {
      if (pattern.test(text) && !warnings.includes(warning)) {
        warnings.push(warning);
      }
    });
  });
  return warnings;
}

export function sanitizePublicIssueCopyList(values: string[]): string[] {
  return values.map(sanitizePublicIssueCopy).filter(Boolean);
}
