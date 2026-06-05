import type { MagazineArticle } from './magazineArticles';

export type MagazineIssueStatus = 'draft' | 'published';
export type MagazineContentRole = 'core' | 'support' | 'backup' | 'excluded' | 'stale' | 'needs_review';
export type MagazineSpreadType =
  | 'cover'
  | 'editors-note'
  | 'contents'
  | 'feature'
  | 'signal'
  | 'section-opener'
  | 'guide'
  | 'review'
  | 'partner'
  | 'back-matter'
  | 'article-list';

export type MagazineIssueArticle = MagazineArticle & {
  sourceDate: Date;
  score: number;
  role: MagazineContentRole;
  canonicalSection: string;
  staleReason?: string;
};

export type MagazineSpread = {
  id: string;
  type: MagazineSpreadType;
  title: string;
  eyebrow?: string;
  deck?: string;
  section?: string;
  articles?: MagazineIssueArticle[];
  variant?: string;
  accent?: string;
  metadata?: Record<string, string | number | boolean>;
};

export type MagazineIssue = {
  id: string;
  issueNumber: number;
  issueLabel: string;
  slug: string;
  title: string;
  subtitle: string;
  deck: string;
  sourceStartDate: Date;
  sourceEndDate: Date;
  sourceWindowLabel: string;
  status: MagazineIssueStatus;
  coverTheme: string;
  primaryVerticals: string[];
  articles: MagazineIssueArticle[];
  excludedArticles: MagazineIssueArticle[];
  spreads: MagazineSpread[];
  generatedFromRange: boolean;
};

const STALE_PATTERNS = [
  /covid|coronavirus|lockdown|pandemic restrictions/i,
  /apply now|applications? open|deadline|call for entries|opportunit(y|ies)/i,
  /tonight|tomorrow|this weekend|tickets? now|rsvp|save the date/i,
  /2020|2021/i,
];

const SECTION_RULES: Array<[string, RegExp]> = [
  ['The Sound of Now', /music|song|album|ep|artist|afrohouse|gengetone|benga|rhumba|playlist|sound|dj|track/i],
  ['Sound, Conflict, Form', /beef|rival|criticism|video|visuali[sz]er|translation|form|language|vernacular/i],
  ['The Scene Is a Place', /event|festival|blankets|theatre|venue|place|city|nairobi|stage|scene|public culture/i],
  ['Field Notes', /guide|field guide|biennale|dakar|venice|travel|route|where to|places/i],
  ['On Record', /review|album|ep|single|record|release/i],
  ['Books, Language, Memory', /book|reading|language|memory|archive|oral|poem|literature|library/i],
  ['Systems & Futures', /copyright|bill|policy|rights|algorithm|ai|platform|system|future|funding|climate/i],
];

function parseArticleDate(value: string): Date | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
}

function formatIssueNumber(num: number): string {
  return String(num).padStart(3, '0');
}

function makeIssueSlug(issueNumber: number): string {
  return `issue-${formatIssueNumber(issueNumber)}`;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function sourceWindowKey(start: Date, end: Date): string {
  return `${monthKey(start)}__${monthKey(end)}`;
}

function canonicalSection(article: MagazineArticle): string {
  const haystack = `${article.title} ${article.section} ${(article.tags ?? []).join(' ')} ${article.dek}`;
  for (const [section, pattern] of SECTION_RULES) {
    if (pattern.test(haystack)) return section;
  }
  return article.section || 'Field Notes';
}

function staleReason(article: MagazineArticle): string | undefined {
  const haystack = `${article.title} ${article.section} ${(article.tags ?? []).join(' ')} ${article.dek}`;
  for (const pattern of STALE_PATTERNS) {
    if (pattern.test(haystack)) return 'time-sensitive or stale editorial signal';
  }
  return undefined;
}

function scoreArticle(article: MagazineArticle): number {
  const text = `${article.title} ${article.dek} ${article.section} ${(article.tags ?? []).join(' ')}`.toLowerCase();
  let score = 0;
  score += Math.min(article.readingTime || 1, 12) * 4;
  if (article.heroUrl) score += 10;
  if (article.dek && article.dek.length > 80) score += 8;
  if (/guide|review|copyright|afrohouse|beef|blankets|biennale|language|theatre|algorithm|music|artist/.test(text)) score += 12;
  if (/announcement|tickets|apply|deadline|covid|2020|2021/.test(text)) score -= 28;
  return score;
}

function classifyArticle(article: MagazineArticle): MagazineContentRole {
  const reason = staleReason(article);
  if (reason) return 'stale';
  const score = scoreArticle(article);
  if (score >= 50) return 'core';
  if (score >= 34) return 'support';
  if (score >= 20) return 'backup';
  return 'needs_review';
}

function makeIssueArticle(article: MagazineArticle): MagazineIssueArticle | null {
  const sourceDate = parseArticleDate(article.date);
  if (!sourceDate) return null;
  const role = classifyArticle(article);
  return {
    ...article,
    sourceDate,
    score: scoreArticle(article),
    role,
    canonicalSection: canonicalSection(article),
    staleReason: role === 'stale' ? staleReason(article) : undefined,
  };
}

function sectionCounts(articles: MagazineIssueArticle[]) {
  return Array.from(
    articles.reduce((map, article) => {
      map.set(article.canonicalSection, (map.get(article.canonicalSection) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  ).sort((a, b) => b[1] - a[1]);
}

function topArticlePhrase(articles: MagazineIssueArticle[]): string | null {
  const title = [...articles].sort((a, b) => b.score - a.score)[0]?.title ?? '';
  const clean = title
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return null;
  if (clean.length <= 34) return clean;
  const words = clean.split(' ').filter((word) => word.length > 2);
  return words.slice(0, 4).join(' ');
}

function titleForDominantSection(section: string, issueNumber: number, articles: MagazineIssueArticle[]): string {
  const phrase = topArticlePhrase(articles);
  const rotations: Record<string, string[]> = {
    'The Sound of Now': [
      'The Room Remembers',
      'Signals From the Floor',
      'The Night Has Notes',
      'Songs With a Long Tail',
      'The Sound Finds a Room',
      'After the Speakers Cool',
    ],
    'Sound, Conflict, Form': [
      'The Shape of the Argument',
      'When the Form Fights Back',
      'The Image Talks Back',
      'Notes From the Faultline',
    ],
    'The Scene Is a Place': [
      'Where the Culture Gathered',
      'The Scene Had an Address',
      'Rooms That Carried the Work',
      'The City Kept Receipts',
    ],
    'Field Notes': [
      'Carry This With You',
      'A Map for the Feeling',
      'What to Notice First',
      'The Guide Becomes Memory',
    ],
    'On Record': [
      'The Year on the Table',
      'The Records That Stayed',
      'A Listening Note Survives',
      'The Verdict Has Texture',
    ],
    'Books, Language, Memory': [
      'What Refuses to Disappear',
      'The Archive Speaks Back',
      'Words That Carried Home',
      'Memory Had a Language',
    ],
    'Systems & Futures': [
      'The System Under the Song',
      'Who Owns the Future',
      'The Machinery Beneath Culture',
      'Rights, Platforms, Memory',
    ],
  };
  const options = rotations[section] ?? ['The Culture on Record', 'A Field Record Survives', 'The Archive Has a Pulse'];
  const rotated = options[(issueNumber - 2) % options.length];

  // Every fourth back-issue borrows a short phrase from its strongest piece so the archive does not feel templated.
  if (phrase && issueNumber % 4 === 0) return phrase;
  return rotated;
}

function deriveIssueTheme(issueNumber: number, articles: MagazineIssueArticle[]): Pick<MagazineIssue, 'title' | 'subtitle' | 'deck' | 'coverTheme'> {
  if (issueNumber === 1) {
    return {
      title: 'Your People Are Here',
      subtitle: 'African creative life, on the record',
      deck: 'A field record of African creative life — the sound, the scenes, the language, the people carrying it.',
      coverTheme: 'field-record-seal',
    };
  }

  const counts = sectionCounts(articles);
  const dominant = counts[0]?.[0] ?? 'Field Notes';
  const secondary = counts[1]?.[0];
  const title = titleForDominantSection(dominant, issueNumber, articles);
  const subtitle = secondary ? `${dominant} / ${secondary}` : dominant;
  const focus = secondary ? `${dominant.toLowerCase()}, ${secondary.toLowerCase()}` : dominant.toLowerCase();

  return {
    title,
    subtitle,
    deck: `A WAKILISHA field record drawn from ${focus}, and the cultural signals around them.`,
    coverTheme: `${dominant}-${secondary ?? 'solo'}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  };
}

function groupBySection(articles: MagazineIssueArticle[]) {
  return articles.reduce((map, article) => {
    const key = article.canonicalSection;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(article);
    return map;
  }, new Map<string, MagazineIssueArticle[]>());
}

function buildIssueSpreads(issueNumber: number, articles: MagazineIssueArticle[], excluded: MagazineIssueArticle[]): MagazineSpread[] {
  const usable = articles.filter((article) => article.role !== 'stale' && article.role !== 'excluded');
  const core = usable.filter((article) => article.role === 'core').sort((a, b) => b.score - a.score);
  const coverFeature = core[0] ?? usable[0];
  const theme = deriveIssueTheme(issueNumber, usable);
  const grouped = Array.from(groupBySection(usable).entries()).sort((a, b) => b[1].length - a[1].length);
  const spreads: MagazineSpread[] = [
    {
      id: `issue-${issueNumber}-cover`,
      type: 'cover',
      title: theme.title,
      eyebrow: 'African creative life, on the record',
      deck: theme.deck,
      articles: coverFeature ? [coverFeature] : [],
      variant: 'field-record-cover',
    },
    {
      id: `issue-${issueNumber}-editors-note`,
      type: 'editors-note',
      title: 'We did not set out to build a music site.',
      deck: 'We set out to make sure the good nights got remembered.',
      variant: 'paper-note',
    },
    {
      id: `issue-${issueNumber}-contents`,
      type: 'contents',
      title: issueNumber === 1 ? 'The whole night, on the record.' : 'In this issue, the culture leaves a trace.',
      articles: usable,
      variant: 'expressive-index',
    },
  ];

  if (coverFeature) {
    spreads.push({
      id: `issue-${issueNumber}-feature`,
      type: 'feature',
      title: coverFeature.title,
      eyebrow: 'Feature',
      deck: coverFeature.dek,
      section: coverFeature.canonicalSection,
      articles: [coverFeature],
      variant: coverFeature.canonicalSection === 'The Sound of Now' ? 'sound-migration' : 'editorial-feature',
    });
  }

  const soundArticles = usable.filter((article) => article.canonicalSection === 'The Sound of Now' || article.canonicalSection === 'On Record');
  if (soundArticles.length >= 3) {
    spreads.push({
      id: `issue-${issueNumber}-signal`,
      type: 'signal',
      title: 'What the issue is quietly telling us.',
      eyebrow: 'The Signal',
      deck: 'A cultural-intelligence reading of the strongest music and scene signals in this issue.',
      articles: soundArticles.slice(0, 12),
      variant: 'ownership-strip',
      accent: '#9C8FF5',
    });
  }

  grouped.slice(0, 5).forEach(([section, sectionArticles], idx) => {
    spreads.push({
      id: `issue-${issueNumber}-section-${idx}`,
      type: 'section-opener',
      title: section,
      eyebrow: `Section ${String(idx + 1).padStart(2, '0')}`,
      deck: sectionDeck(section),
      section,
      articles: sectionArticles.slice(0, 4),
      variant: idx % 2 === 0 ? 'cinematic' : 'paper-cut',
      accent: sectionAccent(section),
    });

    const first = sectionArticles[0];
    if (!first) return;
    if (section === 'Field Notes') {
      spreads.push({ id: `issue-${issueNumber}-guide-${idx}`, type: 'guide', title: first.title, deck: first.dek, section, articles: sectionArticles.slice(0, 3), variant: 'travel-field-guide', accent: sectionAccent(section) });
    } else if (section === 'On Record') {
      spreads.push({ id: `issue-${issueNumber}-review-${idx}`, type: 'review', title: 'On Record', deck: 'The releases, weighed and filed.', section, articles: sectionArticles.slice(0, 4), variant: 'taste-making', accent: sectionAccent(section) });
    } else {
      spreads.push({ id: `issue-${issueNumber}-articles-${idx}`, type: 'article-list', title: section, deck: sectionDeck(section), section, articles: sectionArticles.slice(0, 6), variant: idx % 2 === 0 ? 'feature-row' : 'editorial-list', accent: sectionAccent(section) });
    }
  });

  spreads.push({
    id: `issue-${issueNumber}-partner`,
    type: 'partner',
    title: 'Cultural Partner',
    deck: 'Patronage, not interruption.',
    variant: 'patronage-surface',
  });
  spreads.push({
    id: `issue-${issueNumber}-back`,
    type: 'back-matter',
    title: 'Your people are here.',
    deck: 'Partner with WAKILISHA, or put your scene on the record.',
    articles: usable,
    metadata: { excluded: excluded.length },
  });

  return spreads;
}

function sectionDeck(section: string): string {
  const decks: Record<string, string> = {
    'The Sound of Now': 'Music as the loudest signal a culture sends about itself.',
    'Sound, Conflict, Form': 'Where rivalry, language, image and criticism shape the work.',
    'The Scene Is a Place': 'Before a sound can travel, it needs a room to start in.',
    'Field Notes': 'Guides built to be carried through cities, festivals, rooms and arguments.',
    'On Record': 'Reviews as taste-making, not catalogue cards.',
    'Books, Language, Memory': 'What is preserved, translated, remembered and passed on.',
    'Systems & Futures': 'Rights, platforms, money and the machinery underneath culture.',
  };
  return decks[section] ?? 'A section of the cultural record.';
}

function sectionAccent(section: string): string {
  const accents: Record<string, string> = {
    'The Sound of Now': '#84C241',
    'Sound, Conflict, Form': '#F2645A',
    'The Scene Is a Place': '#4FD9C2',
    'Field Notes': '#6BA8F5',
    'On Record': '#A4DC60',
    'Books, Language, Memory': '#E6A85C',
    'Systems & Futures': '#9C8FF5',
  };
  return accents[section] ?? '#84C241';
}

function buildWindows(maxDate: Date): Array<{ start: Date; end: Date }> {
  const windows: Array<{ start: Date; end: Date }> = [];
  let end = endOfMonth(maxDate);
  let start = startOfMonth(addMonths(maxDate, -3));
  windows.push({ start, end });

  end = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
  while (windows.length < 80) {
    start = startOfMonth(addMonths(end, -2));
    windows.push({ start, end: endOfMonth(end) });
    end = new Date(start.getFullYear(), start.getMonth(), 0, 23, 59, 59, 999);
    if (end.getFullYear() < 2010) break;
  }
  return windows;
}

export function buildMagazineIssues(articles: MagazineArticle[]): MagazineIssue[] {
  const mapped = articles
    .map(makeIssueArticle)
    .filter((article): article is MagazineIssueArticle => Boolean(article))
    .sort((a, b) => b.sourceDate.getTime() - a.sourceDate.getTime());

  if (!mapped.length) return [];

  const maxDate = mapped[0].sourceDate;
  const windows = buildWindows(maxDate);
  const issues: MagazineIssue[] = [];

  windows.forEach((window) => {
    const inWindow = mapped.filter((article) => article.sourceDate >= window.start && article.sourceDate <= window.end);
    if (!inWindow.length) return;
    const issueNumber = issues.length + 1;
    const excluded = inWindow.filter((article) => article.role === 'stale' || article.role === 'excluded');
    const usable = inWindow.filter((article) => article.role !== 'stale' && article.role !== 'excluded');
    const theme = deriveIssueTheme(issueNumber, usable);
    const primaryVerticals = Array.from(groupBySection(usable).keys()).slice(0, 4);
    issues.push({
      id: sourceWindowKey(window.start, window.end),
      issueNumber,
      issueLabel: `Issue ${formatIssueNumber(issueNumber)}`,
      slug: makeIssueSlug(issueNumber),
      title: theme.title,
      subtitle: theme.subtitle,
      deck: theme.deck,
      sourceStartDate: window.start,
      sourceEndDate: window.end,
      sourceWindowLabel: `${formatMonthYear(window.start)} – ${formatMonthYear(window.end)}`,
      status: 'draft',
      coverTheme: theme.coverTheme,
      primaryVerticals,
      articles: usable,
      excludedArticles: excluded,
      spreads: buildIssueSpreads(issueNumber, usable, excluded),
      generatedFromRange: true,
    });
  });

  return issues;
}

export function resolveIssueByKey(issues: MagazineIssue[], issueKey: string | undefined): MagazineIssue | null {
  if (!issueKey) return issues[0] ?? null;
  const direct = issues.find((issue) => issue.slug === issueKey || issue.id === issueKey || String(issue.issueNumber) === issueKey);
  if (direct) return direct;

  const legacyMonth = /^\d{4}-\d{2}$/.test(issueKey) ? new Date(`${issueKey}-01T00:00:00`) : null;
  if (legacyMonth && !Number.isNaN(legacyMonth.getTime())) {
    return issues.find((issue) => legacyMonth >= issue.sourceStartDate && legacyMonth <= issue.sourceEndDate) ?? null;
  }

  return null;
}

export function getAdjacentIssues(issues: MagazineIssue[], issue: MagazineIssue | null) {
  if (!issue) return { previousIssue: null, nextIssue: null };
  const index = issues.findIndex((item) => item.slug === issue.slug);
  return {
    previousIssue: index >= 0 && index < issues.length - 1 ? issues[index + 1] : null,
    nextIssue: index > 0 ? issues[index - 1] : null,
  };
}

export function issueUrl(issue: MagazineIssue): string {
  return `/magazine/issues/${issue.slug}`;
}
