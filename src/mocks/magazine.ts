import { getArticles } from '@/data/registry/registry';

const sectionPalette = [
  { name: 'All', color: '#1a1a1a', accentBg: '#F8F7F4', accentText: '#1a1a1a' },
  { name: 'Analysis', color: '#C44A3B', accentBg: '#FDF5F3', accentText: '#C44A3B', tone: 'authoritative', layout: 'editorial' },
  { name: 'Focus', color: '#D97706', accentBg: '#FEF7ED', accentText: '#D97706', tone: 'regional', layout: 'immersive' },
  { name: 'Industry', color: '#78716C', accentBg: '#F8F7F4', accentText: '#78716C', tone: 'structured', layout: 'report' },
  { name: 'Culture', color: '#BE185D', accentBg: '#FDF2F7', accentText: '#BE185D', tone: 'expressive', layout: 'visual' },
  { name: 'Interview', color: '#256B5A', accentBg: '#F0F7F4', accentText: '#256B5A', tone: 'intimate', layout: 'portrait' },
  { name: 'Article', color: '#334155', accentBg: '#F1F5F9', accentText: '#334155', tone: 'editorial', layout: 'article' },
  { name: 'Guide', color: '#4F46E5', accentBg: '#EEF2FF', accentText: '#4F46E5', tone: 'practical', layout: 'guide' },
];

const neutralHero = (seed: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720">
      <rect width="1200" height="720" fill="#111111"/>
      <circle cx="180" cy="140" r="220" fill="#85C441" opacity="0.35"/>
      <circle cx="980" cy="620" r="260" fill="#E37400" opacity="0.25"/>
      <text x="72" y="600" fill="#F4F1E8" font-family="Arial, sans-serif" font-size="52" font-weight="800" letter-spacing="-2">${seed.replace(/&/g, '&amp;').slice(0, 42)}</text>
      <text x="72" y="650" fill="#85C441" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">WAKILISHA</text>
    </svg>
  `)}`;

const normalizeDate = (value?: string | null) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
};

const importedStories = getArticles().map((article, index) => ({
  slug: article.slug,
  title: article.title,
  section: article.section || 'Article',
  date: normalizeDate(article.date),
  readingTime: article.readingTime || 1,
  heroUrl: article.heroUrl ?? neutralHero(article.title),
  dek: article.excerpt ?? article.body[0] ?? '',
  isFeatured: article.isFeatured || index === 0,
  author: article.author || 'WAKILISHA Editorial',
  authorPhoto: undefined,
  readCount: article.readCount || 0,
  body: article.body.length ? article.body : article.excerpt ? [article.excerpt] : [],
  contentHtml: article.contentHtml,
  relatedEntities: article.relatedEntities ?? [],
  tags: article.tags ?? [],
}));

const storySections = Array.from(new Set(importedStories.map((story) => story.section).filter(Boolean)));
const paletteByName = new Map(sectionPalette.map((section) => [section.name.toLowerCase(), section]));

export const SECTIONS = [
  sectionPalette[0],
  ...storySections.map((name, index) => {
    const match = paletteByName.get(name.toLowerCase());
    if (match) return match;
    const fallback = sectionPalette[(index % (sectionPalette.length - 1)) + 1];
    return { ...fallback, name };
  }),
];

export const STORIES = importedStories;

export const EDITOR_PICKS = STORIES.filter((story) => story.isFeatured).length
  ? STORIES.filter((story) => story.isFeatured).slice(0, 5)
  : STORIES.slice(0, 5);

export const TRENDING_STORIES = STORIES.slice()
  .sort((a, b) => (b.readCount ?? 0) - (a.readCount ?? 0) || a.title.localeCompare(b.title))
  .slice(0, 5);

const contributors = new Map<string, { name: string; role: string; photo?: string; bio: string }>();
for (const story of STORIES) {
  if (!contributors.has(story.author)) {
    contributors.set(story.author, {
      name: story.author,
      role: story.section === 'Guide' ? 'Guide Author' : 'Contributor',
      photo: story.authorPhoto,
      bio: `Published ${STORIES.filter((item) => item.author === story.author).length} WAKILISHA piece${STORIES.filter((item) => item.author === story.author).length === 1 ? '' : 's'}.`,
    });
  }
}

export const CONTRIBUTORS = Array.from(contributors.values()).slice(0, 8);
