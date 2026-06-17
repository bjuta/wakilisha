import type { MagazineIssue, MagazineIssueArticle } from '../magazineIssues';
import { MAGAZINE_EDITORIAL_PATHS } from './editorialPaths';

const baseDate = new Date('2026-01-15T12:00:00Z');

function article(overrides: Partial<MagazineIssueArticle> & Pick<MagazineIssueArticle, 'title' | 'canonicalSection'>): MagazineIssueArticle {
  const slug = overrides.slug ?? overrides.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id: overrides.id ?? slug,
    slug,
    title: overrides.title,
    section: overrides.section ?? overrides.canonicalSection,
    author: overrides.author ?? 'WAKILISHA Editorial',
    date: overrides.date ?? '2026-01-15',
    readingTime: overrides.readingTime ?? 4,
    heroUrl: overrides.heroUrl ?? '',
    dek: overrides.dek ?? `${overrides.title} opens a thread inside the issue.`,
    body: overrides.body ?? [],
    contentHtml: overrides.contentHtml ?? '',
    tags: overrides.tags ?? [],
    relatedEntities: overrides.relatedEntities ?? [],
    isFeatured: overrides.isFeatured ?? false,
    readCount: overrides.readCount ?? 0,
    mediaAssets: overrides.mediaAssets ?? [],
    sourceDate: overrides.sourceDate ?? baseDate,
    score: overrides.score ?? 48,
    role: overrides.role ?? 'core',
    canonicalSection: overrides.canonicalSection,
    staleReason: overrides.staleReason,
  };
}

function issue(issueNumber: number, title: string, articles: MagazineIssueArticle[]): MagazineIssue {
  return {
    id: `issue-${issueNumber}`,
    issueNumber,
    issueLabel: `Issue ${String(issueNumber).padStart(3, '0')}`,
    slug: `issue-${String(issueNumber).padStart(3, '0')}`,
    title,
    subtitle: articles[0]?.canonicalSection ?? 'Field Notes',
    deck: `${title} gathers the strongest thread in this issue.`,
    sourceStartDate: baseDate,
    sourceEndDate: baseDate,
    sourceWindowLabel: 'Jan 2026',
    status: 'published',
    coverTheme: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    primaryVerticals: Array.from(new Set(articles.map((item) => item.canonicalSection))).slice(0, 3),
    articles,
    excludedArticles: [],
    spreads: [],
    generatedFromRange: true,
  };
}

export const magazineIssueEngineFixtures = {
  issueOneWithMdxOverrides: {
    ...issue(1, 'Your People Are Here', [
      article({ title: 'The Door Into WAKILISHA', canonicalSection: 'The Sound of Now', tags: ['music', 'scene', 'memory'], score: 70, heroUrl: '/fixture/issue-one.jpg' }),
      article({ title: 'The People Who Carried the Room', canonicalSection: 'The Scene Is a Place', tags: ['scene', 'room'], score: 64 }),
      article({ title: 'The Language That Stayed With Us', canonicalSection: 'Books, Language, Memory', tags: ['language', 'memory'], score: 58 }),
    ]),
    editorialOverrides: {
      editorNoteMdxPath: MAGAZINE_EDITORIAL_PATHS.editorNote,
      coverStatementMdxPath: MAGAZINE_EDITORIAL_PATHS.coverStatement,
      backMatterMdxPath: MAGAZINE_EDITORIAL_PATHS.backMatter,
    },
  } as MagazineIssue & { editorialOverrides: Record<string, string> },
  listeningIssue: issue(2, 'After the Speakers Cool', [
    article({ title: 'The Song That Held the Room', canonicalSection: 'The Sound of Now', tags: ['music', 'song'], score: 64, heroUrl: '/fixture/song.jpg' }),
    article({ title: 'A DJ Set Became the Map', canonicalSection: 'The Sound of Now', tags: ['dj', 'playlist'], score: 58 }),
    article({ title: 'The Producer Who Bent the Chorus', canonicalSection: 'The Sound of Now', tags: ['producer', 'sound'], score: 54 }),
  ]),
  sceneIssue: issue(3, 'The Scene Had an Address', [
    article({ title: 'The Room That Changed the Weekend', canonicalSection: 'The Scene Is a Place', tags: ['venue', 'city'], score: 66, heroUrl: '/fixture/room.jpg' }),
    article({ title: 'A Festival Found Its People', canonicalSection: 'The Scene Is a Place', tags: ['festival'], score: 57 }),
    article({ title: 'Nairobi Kept the Receipts', canonicalSection: 'The Scene Is a Place', tags: ['nairobi', 'scene'], score: 50 }),
  ]),
  recordReviewIssue: issue(4, 'Records on the Table', [
    article({ title: 'The Album Everyone Returned To', canonicalSection: 'On Record', tags: ['album', 'review', 'record'], score: 68, heroUrl: '/fixture/album.jpg' }),
    article({ title: 'A Mixtape With Teeth', canonicalSection: 'On Record', tags: ['mixtape', 'review'], score: 60 }),
    article({ title: 'The EP That Refused to Behave', canonicalSection: 'On Record', tags: ['ep', 'review'], score: 56 }),
  ]),
  fieldGuideIssue: issue(5, 'Carry This Route', [
    article({ title: 'A Guide to the Night Before the Show', canonicalSection: 'Field Notes', tags: ['guide', 'route', 'where to go'], score: 67, heroUrl: '/fixture/guide.jpg' }),
    article({ title: 'What to Notice When the Set Opens', canonicalSection: 'Field Notes', tags: ['guide', 'checklist'], score: 58 }),
    article({ title: 'The Small Stops That Made the Weekend', canonicalSection: 'The Scene Is a Place', tags: ['route', 'city'], score: 52 }),
  ]),
  memoryIssue: issue(6, 'What Refuses to Disappear', [
    article({ title: 'The Language That Carried Home', canonicalSection: 'Books, Language, Memory', tags: ['language', 'memory'], score: 63 }),
    article({ title: 'A Book Kept the Door Open', canonicalSection: 'Books, Language, Memory', tags: ['book', 'archive'], score: 56 }),
    article({ title: 'The Name Everyone Still Says', canonicalSection: 'Books, Language, Memory', tags: ['memory', 'oral culture'], score: 54 }),
  ]),
  systemsIssue: issue(7, 'The Machinery Beneath Culture', [
    article({ title: 'Who Owns the Platform Now', canonicalSection: 'Systems & Futures', tags: ['platform', 'rights'], score: 68 }),
    article({ title: 'Copyright Came for the Chorus', canonicalSection: 'Systems & Futures', tags: ['copyright', 'policy'], score: 62 }),
    article({ title: 'The Money Around the Moment', canonicalSection: 'Systems & Futures', tags: ['money', 'ownership'], score: 57 }),
  ]),
  imageIssue: issue(8, 'Look First', [
    article({ title: 'The Photo That Held the Whole Night', canonicalSection: 'Field Notes', tags: ['photo', 'image', 'visual'], score: 65, heroUrl: '/fixture/photo-1.jpg' }),
    article({ title: 'A Frame Became the Argument', canonicalSection: 'Sound, Conflict, Form', tags: ['visual', 'frame'], score: 59, heroUrl: '/fixture/photo-2.jpg' }),
    article({ title: 'The Poster Everyone Copied', canonicalSection: 'Field Notes', tags: ['image', 'poster'], score: 54, heroUrl: '/fixture/photo-3.jpg' }),
  ]),
  argumentIssue: issue(9, 'This One Talks Back', [
    article({ title: 'The Visualizer Started an Argument', canonicalSection: 'Sound, Conflict, Form', tags: ['argument', 'criticism', 'form'], score: 66 }),
    article({ title: 'A Beef Became a Mirror', canonicalSection: 'Sound, Conflict, Form', tags: ['conflict', 'debate'], score: 61 }),
    article({ title: 'The Chorus Refused to Sit Quietly', canonicalSection: 'Sound, Conflict, Form', tags: ['criticism', 'form'], score: 54 }),
  ]),
  mixedCultureIssue: issue(10, 'Signals in the Same Room', [
    article({ title: 'The Song That Opened the Door', canonicalSection: 'The Sound of Now', tags: ['song'], score: 61, heroUrl: '/fixture/mixed-song.jpg' }),
    article({ title: 'The Room That Held the Scene', canonicalSection: 'The Scene Is a Place', tags: ['venue'], score: 59 }),
    article({ title: 'The Platform Question Nobody Dodged', canonicalSection: 'Systems & Futures', tags: ['platform'], score: 58 }),
    article({ title: 'The Language That Stayed', canonicalSection: 'Books, Language, Memory', tags: ['memory'], score: 57 }),
  ]),
  thinIssue: issue(11, 'A Small Record Survives', [
    article({ title: 'One Story Worth Holding', canonicalSection: 'Field Notes', score: 42 }),
  ]),
};