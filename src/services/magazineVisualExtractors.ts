import type { MagazineIssueArticle } from './magazineIssues';

export type MagazineVisualEntity = {
  label: string;
  kind: 'place' | 'person' | 'organization' | 'song' | 'release' | 'genre' | 'policy' | 'date' | 'unknown';
  confidence: number;
  source: 'title' | 'dek' | 'tags' | 'body' | 'section' | 'known-list';
};

export type MagazineVisualContext = {
  text: string;
  words: string[];
  titleWords: string[];
  places: MagazineVisualEntity[];
  dates: MagazineVisualEntity[];
  entities: MagazineVisualEntity[];
  keywords: string[];
  pullQuotes: string[];
  signals: {
    hasImage: boolean;
    hasMultiplePlaces: boolean;
    hasTimeline: boolean;
    hasMusic: boolean;
    hasPolicy: boolean;
    hasLanguage: boolean;
    hasMemory: boolean;
    hasFood: boolean;
    hasFashion: boolean;
    hasFilm: boolean;
    hasGuide: boolean;
    hasEvent: boolean;
    hasQuoteCandidate: boolean;
  };
};

const KNOWN_PLACES = [
  'Nairobi', 'Johannesburg', 'Lagos', 'Accra', 'Dakar', 'Kampala', 'Dar es Salaam', 'Addis Ababa', 'Cape Town', 'Mombasa', 'Kigali', 'Abidjan', 'Kinshasa', 'Cairo', 'London', 'New York', 'Paris', 'Venice', 'Dubai', 'Gedi', 'Kenya', 'South Africa', 'Ghana', 'Nigeria', 'Senegal', 'Uganda', 'Tanzania', 'Ethiopia', 'Rwanda'
];

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'into', 'onto', 'your', 'their', 'there', 'were', 'will', 'what', 'when', 'where', 'which', 'about', 'after', 'before', 'because', 'through', 'within', 'without', 'under', 'over', 'between', 'issue', 'wakilisha', 'magazine'
]);

function cleanText(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function splitWords(text: string): string[] {
  return cleanText(text)
    .toLowerCase()
    .split(/[^a-z0-9’'-]+/i)
    .map((word) => word.replace(/^[-']+|[-']+$/g, ''))
    .filter((word) => word.length > 2 && !STOPWORDS.has(word));
}

function sourceText(article?: MagazineIssueArticle) {
  if (!article) return { title: '', dek: '', tags: '', body: '', section: '' };
  return {
    title: article.title ?? '',
    dek: article.dek ?? '',
    tags: (article.tags ?? []).join(' '),
    body: (article.body ?? []).slice(0, 10).join(' '),
    section: [article.section, article.canonicalSection].filter(Boolean).join(' '),
  };
}

function matchKnownPlaces(parts: ReturnType<typeof sourceText>): MagazineVisualEntity[] {
  const haystacks: Array<[keyof typeof parts, string]> = Object.entries(parts) as Array<[keyof typeof parts, string]>;
  const results = new Map<string, MagazineVisualEntity>();
  for (const place of KNOWN_PLACES) {
    const escaped = place.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    for (const [source, value] of haystacks) {
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(value)) {
        const score = source === 'title' ? 0.95 : source === 'dek' ? 0.86 : source === 'tags' ? 0.78 : 0.64;
        const existing = results.get(place);
        if (!existing || score > existing.confidence) {
          results.set(place, { label: place, kind: 'place', confidence: score, source: source === 'section' ? 'section' : source });
        }
      }
    }
  }
  return Array.from(results.values()).sort((a, b) => b.confidence - a.confidence);
}

function extractYears(parts: ReturnType<typeof sourceText>): MagazineVisualEntity[] {
  const results = new Map<string, MagazineVisualEntity>();
  for (const [source, value] of Object.entries(parts)) {
    const years = value.match(/\b(19|20)\d{2}\b/g) ?? [];
    for (const year of years) {
      const score = source === 'title' ? 0.9 : source === 'dek' ? 0.78 : 0.58;
      const existing = results.get(year);
      if (!existing || score > existing.confidence) {
        results.set(year, { label: year, kind: 'date', confidence: score, source: source as MagazineVisualEntity['source'] });
      }
    }
  }
  return Array.from(results.values()).sort((a, b) => a.label.localeCompare(b.label)).slice(0, 10);
}

function extractCapitalizedEntities(text: string): MagazineVisualEntity[] {
  const candidates = cleanText(text).match(/\b[A-Z][A-Za-z’'-]+(?:\s+[A-Z][A-Za-z’'-]+){0,3}\b/g) ?? [];
  const blocked = new Set([...KNOWN_PLACES, 'WAKILISHA', 'Magazine', 'Issue']);
  const results = new Map<string, MagazineVisualEntity>();
  for (const candidate of candidates) {
    if (blocked.has(candidate)) continue;
    if (candidate.length < 4) continue;
    if (/^(The|This|That|When|Where|What|How|Why|After|Before|From|With)\b/.test(candidate)) continue;
    const existing = results.get(candidate);
    if (!existing) results.set(candidate, { label: candidate, kind: 'unknown', confidence: 0.46, source: 'body' });
  }
  return Array.from(results.values()).slice(0, 16);
}

function topKeywords(words: string[]): string[] {
  const counts = new Map<string, number>();
  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 14)
    .map(([word]) => word);
}

function extractPullQuotes(article?: MagazineIssueArticle): string[] {
  const paragraphs = [article?.dek, ...(article?.body ?? [])].filter(Boolean) as string[];
  return paragraphs
    .map(cleanText)
    .filter((paragraph) => paragraph.length >= 70 && paragraph.length <= 230)
    .filter((paragraph) => !/subscribe|read more|click|http|www\./i.test(paragraph))
    .slice(0, 5);
}

export function extractMagazineVisualContext(article?: MagazineIssueArticle): MagazineVisualContext {
  const parts = sourceText(article);
  const text = cleanText(Object.values(parts).join(' '));
  const words = splitWords(text);
  const titleWords = splitWords(parts.title);
  const places = matchKnownPlaces(parts);
  const dates = extractYears(parts);
  const capitalized = extractCapitalizedEntities([parts.title, parts.dek, parts.body].join(' '));
  const pullQuotes = extractPullQuotes(article);
  const lower = text.toLowerCase();

  const context: MagazineVisualContext = {
    text,
    words,
    titleWords,
    places,
    dates,
    entities: [...places, ...dates, ...capitalized],
    keywords: topKeywords(words),
    pullQuotes,
    signals: {
      hasImage: Boolean(article?.heroUrl),
      hasMultiplePlaces: places.length >= 2,
      hasTimeline: dates.length >= 2,
      hasMusic: /song|album|ep|track|playlist|chart|release|artist|label|genre|music|afrohouse|benga|rhumba|gengetone|amapiano/i.test(text),
      hasPolicy: /copyright|bill|policy|rights|law|platform|algorithm|funding|system|future|surveillance|privacy/i.test(text),
      hasLanguage: /language|translation|lyric|vernacular|word|phrase|poem|oral/i.test(text),
      hasMemory: /book|archive|memory|oral|library|history|remember|heritage/i.test(text),
      hasFood: /food|ingredient|source|eat|drink|restaurant|chef|recipe|market/i.test(text),
      hasFashion: /fashion|textile|garment|material|fabric|design|runway|collection/i.test(text),
      hasFilm: /film|cinema|movie|screen|shot|scene|director|documentary/i.test(text),
      hasGuide: /guide|field guide|travel|where to|route|itinerary|biennale|pavilion/i.test(text),
      hasEvent: /festival|event|stage|venue|room|show|concert|theatre|exhibition/i.test(text),
      hasQuoteCandidate: pullQuotes.length > 0,
    },
  };

  // Preserve linter visibility for lower while keeping future-proof extraction hook.
  void lower;
  return context;
}
