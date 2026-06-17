export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sentence(value: string): string {
  const clean = cleanText(value);
  if (!clean) return '';
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

export function humanList(items: Array<string | undefined>, fallback = 'the culture'): string {
  const clean = items.map(cleanText).filter(Boolean);
  if (!clean.length) return fallback;
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

export function issueNumberLabel(issueNumber: number): string {
  return `Issue ${String(issueNumber).padStart(3, '0')}`;
}

export function quoteTitle(title?: string): string {
  const clean = cleanText(title);
  return clean ? `"${clean}"` : 'the lead story';
}

export function trimToWords(value: string, maxWords: number): string {
  const clean = cleanText(value);
  const words = clean.split(' ').filter(Boolean);
  if (words.length <= maxWords) return clean;
  return `${words.slice(0, maxWords).join(' ')}...`;
}

export function distinctStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  values.map(cleanText).filter(Boolean).forEach((value) => {
    const key = value.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(value);
    }
  });
  return output;
}

export function articleSection(article: { canonicalSection?: string; section?: string }): string {
  return cleanText(article.canonicalSection || article.section || 'Field Notes') || 'Field Notes';
}

export function articleHaystack(article: { title?: string; dek?: string; section?: string; canonicalSection?: string; tags?: string[]; body?: string[] }): string {
  return [
    article.title,
    article.dek,
    article.section,
    article.canonicalSection,
    ...(article.tags ?? []),
    ...(article.body ?? []).slice(0, 2),
  ].map(cleanText).join(' ').toLowerCase();
}