import type { MagazineArticle } from '@/services/magazineArticles';
import { supabase } from '@/lib/supabase';

/* ─── Types ─── */

export type AuthorProfile = {
  slug: string;
  displayName: string;
  role: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  articleCount: number;
  location: string;
  areas: string[];
  socialLinks: { label: string; url: string; icon: string }[];
  joinedDate: string;
};

/* ─── Real author data from Supabase ─── */

export type AuthorRow = {
  id: string;
  slug: string;
  name: string;
  email: string | null;
  url: string | null;
  source_kind: string | null;
};

let cachedAuthors: AuthorRow[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function fetchAllAuthors(): Promise<AuthorRow[]> {
  if (cachedAuthors && Date.now() - cacheTimestamp < CACHE_TTL) return cachedAuthors;

  const { data, error } = await supabase
    .from("wk_authors")
    .select("id, slug, name, email, url, source_kind");

  if (error || !data) {
    console.warn("Failed to fetch authors from wk_authors:", error?.message);
    return cachedAuthors ?? [];
  }

  cachedAuthors = data as AuthorRow[];
  cacheTimestamp = Date.now();
  return cachedAuthors;
}

export async function fetchAuthorBySlug(slug: string): Promise<AuthorRow | null> {
  const authors = await fetchAllAuthors();
  return authors.find((a) => a.slug === slug) ?? null;
}

/** Build a display name from the wk_authors name field */
function authorDisplayName(row: AuthorRow): string {
  const raw = row.name.trim();
  // If the name contains underscores or looks like a slug, prettify it
  if (raw.includes("_") || raw === raw.toLowerCase() && !raw.includes(" ")) {
    return raw
      .split(/[_\s]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return raw;
}

/** Build a bio from available fields */
function authorBio(row: AuthorRow): string {
  if (row.source_kind === "wordpress_database") {
    return `${authorDisplayName(row)} is a contributor to WAKILISHA Magazine, covering East African music and culture.`;
  }
  return `${authorDisplayName(row)} is a WAKILISHA contributor.`;
}

/** Resolve author metadata: first check wk_authors, then fall back to hardcoded map */
export async function resolveAuthorMeta(rawSlug: string): Promise<{
  slug: string;
  displayName: string;
  role: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  location: string;
  areas: string[];
  socialLinks: { label: string; url: string; icon: string }[];
  joinedDate: string;
  source: "database" | "hardcoded";
}> {
  const slug = rawSlug.trim().toLowerCase().replace(/\s+/g, "-");
  const dbAuthor = await fetchAuthorBySlug(slug);
  const hardcoded = AUTHOR_META[slug];

  if (dbAuthor) {
    // Merge DB data with hardcoded fallbacks
    const meta = hardcoded ?? {
      displayName: authorDisplayName(dbAuthor),
      role: "Contributor",
      bio: authorBio(dbAuthor),
      avatarSeq: 99,
      coverSeq: 199,
      location: "",
      areas: [],
      socialLinks: [],
      joinedDate: "",
    };

    return {
      slug,
      displayName: dbAuthor.name !== meta.displayName ? authorDisplayName(dbAuthor) : meta.displayName,
      role: meta.role,
      bio: meta.bio,
      avatarUrl: `https://readdy.ai/api/search-image?query=Professional%20portrait%20photograph%20of%20African%20music%20journalist%2C%20editorial%20style%2C%20warm%20natural%20lighting%2C%20Nairobi%20creative%20scene%2C%20clean%20simple%20background%20with%20earth%20tones%2C%20confident%20expression%2C%20professional%20headshot%20composition&width=480&height=480&seq=author-av-${meta.avatarSeq}&orientation=squarish`,
      coverUrl: `https://readdy.ai/api/search-image?query=Abstract%20African%20music%20culture%20landscape%2C%20artistic%20gradient%20with%20warm%20amber%20and%20deep%20green%20tones%2C%20Nairobi%20skyline%20silhouette%20at%20dusk%2C%20editorial%20atmosphere%2C%20modern%20minimal%20banner%20composition%2C%20no%20text%20no%20logos%2C%20cinematic%20wide%20aspect&width=1600&height=400&seq=author-cv-${meta.coverSeq}&orientation=landscape`,
      location: meta.location,
      areas: meta.areas,
      socialLinks: meta.socialLinks,
      joinedDate: meta.joinedDate,
      source: "database" as const,
    };
  }

  // Fall back to hardcoded
  return {
    ...getAuthorMeta(slug),
    source: "hardcoded" as const,
  };
}

/* ─── Author display-name map ─── */

const AUTHOR_META: Record<string, {
  displayName: string;
  role: string;
  bio: string;
  avatarSeq: number;
  coverSeq: number;
  location: string;
  areas: string[];
  socialLinks: { label: string; url: string; icon: string }[];
  joinedDate: string;
}> = {
  // ── Real WordPress author names (from WP users table via wk_import_staging_records) ──
  "wakilisha-staff": {
    displayName: 'Wakilisha Staff',
    role: 'Editorial Team',
    bio: 'The WAKILISHA editorial team. Covering East African music, charts, and the culture that moves the sound since day one.',
    avatarSeq: 1,
    coverSeq: 101,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides', 'Essays'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
  "muiruri-beautah": {
    displayName: 'Muiruri Beautah',
    role: 'Senior Editor',
    bio: 'Music journalist and editor with over a decade covering East African hip-hop, gengetone, and R&B. Believes the best stories are told by the people who live them.',
    avatarSeq: 2,
    coverSeq: 102,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Film', 'Places'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
  "hafare-segelan": {
    displayName: 'Hafare Segelan',
    role: 'Staff Writer',
    bio: 'Nairobi-based culture writer focused on the intersection of music, fashion, and youth identity. Always chasing the next sound before it breaks.',
    avatarSeq: 3,
    coverSeq: 103,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Fashion', 'Style'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
      { label: 'Instagram', url: '#', icon: 'ri-instagram-line' },
    ],
    joinedDate: '2023-06',
  },
  "frank-njugi": {
    displayName: 'Frank Njugi',
    role: 'Contributing Writer',
    bio: 'Long-form features and investigative music journalism. Frank digs deep into the business of East African entertainment, from label deals to streaming economics.',
    avatarSeq: 4,
    coverSeq: 104,
    location: 'Kisumu, Kenya',
    areas: ['Music', 'Essays'],
    socialLinks: [],
    joinedDate: '2023-08',
  },
  "shalom-kendi-mbae": {
    displayName: 'Shalom Kendi Mbae',
    role: 'Culture Editor',
    bio: 'Curating the cultural conversation around East African music. Kendi writes about identity, diaspora, and the evolving sound of the region with sharp insight.',
    avatarSeq: 5,
    coverSeq: 105,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Language', 'Places'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
  "kambura-matiri": {
    displayName: 'Kambura Matiri',
    role: 'Charts Analyst',
    bio: 'The numbers person. Kambura breaks down chart data, streaming trends, and airplay analytics to reveal what the industry is actually listening to.',
    avatarSeq: 6,
    coverSeq: 106,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides'],
    socialLinks: [],
    joinedDate: '2024-01',
  },
  "victor-muia": {
    displayName: 'Victor Muia',
    role: 'Staff Writer',
    bio: 'Covering breaking music news, album releases, and the pulse of Nairobi nightlife. Victor brings the immediacy of the moment to every story.',
    avatarSeq: 7,
    coverSeq: 107,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Places', 'Food'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2024-03',
  },
  "michael-mburu": {
    displayName: 'Michael Mburu',
    role: 'Contributing Writer',
    bio: 'Essayist and critic exploring the deeper currents in East African music. Michael writes with a literary edge, connecting songs to society.',
    avatarSeq: 8,
    coverSeq: 108,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Essays', 'Film'],
    socialLinks: [],
    joinedDate: '2024-02',
  },
  "wangari-karume": {
    displayName: 'Wangari Karume',
    role: 'Features Writer',
    bio: 'Profile writer and storyteller. Wangari captures the human stories behind the artists — their struggles, triumphs, and what drives them to create.',
    avatarSeq: 9,
    coverSeq: 109,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Style'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2024-05',
  },
  "kiuta-faith": {
    displayName: 'Kiuta Faith',
    role: 'Contributor',
    bio: 'Independent music writer with an ear for the underground. Kiuta covers emerging scenes and sounds before they hit the mainstream.',
    avatarSeq: 10,
    coverSeq: 110,
    location: 'Dar es Salaam, Tanzania',
    areas: ['Music'],
    socialLinks: [],
    joinedDate: '2024-06',
  },
  "timothy-muiruri": {
    displayName: 'Timothy Muiruri',
    role: 'Contributor',
    bio: 'DJ, producer, and writer. Timo brings an insider perspective on production culture, beat-making, and the studio side of East African music.',
    avatarSeq: 11,
    coverSeq: 111,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides'],
    socialLinks: [],
    joinedDate: '2024-08',
  },
  "sarah-wambi": {
    displayName: 'Sarah Wambi',
    role: 'Contributor',
    bio: 'Multidisciplinary creative writing at the crossroads of music, visual art, and design. Sarah brings a distinctive voice to every piece.',
    avatarSeq: 12,
    coverSeq: 112,
    location: 'Kampala, Uganda',
    areas: ['Music', 'Fashion', 'Style'],
    socialLinks: [],
    joinedDate: '2024-09',
  },
  "mary-gathoni": {
    displayName: 'Mary Gathoni',
    role: 'Contributor',
    bio: 'Radio veteran turned digital writer. Mary bridges the gap between traditional broadcast and online music journalism with warmth and authority.',
    avatarSeq: 13,
    coverSeq: 113,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Film'],
    socialLinks: [],
    joinedDate: '2025-01',
  },
  "gatwiri-c": {
    displayName: 'Gatwiri C.',
    role: 'Contributor',
    bio: 'Emerging voice in music journalism. Gatwiri brings fresh perspective and Gen-Z energy to the WAKILISHA editorial roster.',
    avatarSeq: 14,
    coverSeq: 114,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Style'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2025-04',
  },

  // ── Legacy WordPress login slugs (for backward compatibility) ──
  wakilishaji: {
    displayName: 'Wakilisha Staff',
    role: 'Editorial Team',
    bio: 'The WAKILISHA editorial team. Covering East African music, charts, and the culture that moves the sound since day one.',
    avatarSeq: 1,
    coverSeq: 101,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides', 'Essays'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
  james: {
    displayName: 'Muiruri Beautah',
    role: 'Senior Editor',
    bio: 'Music journalist and editor with over a decade covering East African hip-hop, gengetone, and R&B. Believes the best stories are told by the people who live them.',
    avatarSeq: 2,
    coverSeq: 102,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Film', 'Places'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
  hafare: {
    displayName: 'Hafare Segelan',
    role: 'Staff Writer',
    bio: 'Nairobi-based culture writer focused on the intersection of music, fashion, and youth identity. Always chasing the next sound before it breaks.',
    avatarSeq: 3,
    coverSeq: 103,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Fashion', 'Style'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
      { label: 'Instagram', url: '#', icon: 'ri-instagram-line' },
    ],
    joinedDate: '2023-06',
  },
  frank: {
    displayName: 'Frank Njugi',
    role: 'Contributing Writer',
    bio: 'Long-form features and investigative music journalism. Frank digs deep into the business of East African entertainment, from label deals to streaming economics.',
    avatarSeq: 4,
    coverSeq: 104,
    location: 'Kisumu, Kenya',
    areas: ['Music', 'Essays'],
    socialLinks: [],
    joinedDate: '2023-08',
  },
  kendi: {
    displayName: 'Shalom Kendi Mbae',
    role: 'Culture Editor',
    bio: 'Curating the cultural conversation around East African music. Kendi writes about identity, diaspora, and the evolving sound of the region with sharp insight.',
    avatarSeq: 5,
    coverSeq: 105,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Language', 'Places'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
  k_matiri: {
    displayName: 'Kambura Matiri',
    role: 'Charts Analyst',
    bio: 'The numbers person. Kambura breaks down chart data, streaming trends, and airplay analytics to reveal what the industry is actually listening to.',
    avatarSeq: 6,
    coverSeq: 106,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides'],
    socialLinks: [],
    joinedDate: '2024-01',
  },
  vicmuia: {
    displayName: 'Victor Muia',
    role: 'Staff Writer',
    bio: 'Covering breaking music news, album releases, and the pulse of Nairobi nightlife. Victor brings the immediacy of the moment to every story.',
    avatarSeq: 7,
    coverSeq: 107,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Places', 'Food'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2024-03',
  },
  michael: {
    displayName: 'Michael Mburu',
    role: 'Contributing Writer',
    bio: 'Essayist and critic exploring the deeper currents in East African music. Michael writes with a literary edge, connecting songs to society.',
    avatarSeq: 8,
    coverSeq: 108,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Essays', 'Film'],
    socialLinks: [],
    joinedDate: '2024-02',
  },
  wangari: {
    displayName: 'Wangari Karume',
    role: 'Features Writer',
    bio: 'Profile writer and storyteller. Wangari captures the human stories behind the artists — their struggles, triumphs, and what drives them to create.',
    avatarSeq: 9,
    coverSeq: 109,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Style'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2024-05',
  },
  kiuta: {
    displayName: 'Kiuta Faith',
    role: 'Contributor',
    bio: 'Independent music writer with an ear for the underground. Kiuta covers emerging scenes and sounds before they hit the mainstream.',
    avatarSeq: 10,
    coverSeq: 110,
    location: 'Dar es Salaam, Tanzania',
    areas: ['Music'],
    socialLinks: [],
    joinedDate: '2024-06',
  },
  timo: {
    displayName: 'Timothy Muiruri',
    role: 'Contributor',
    bio: 'DJ, producer, and writer. Timo brings an insider perspective on production culture, beat-making, and the studio side of East African music.',
    avatarSeq: 11,
    coverSeq: 111,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides'],
    socialLinks: [],
    joinedDate: '2024-08',
  },
  swambi: {
    displayName: 'Sarah Wambi',
    role: 'Contributor',
    bio: 'Multidisciplinary creative writing at the crossroads of music, visual art, and design. Sarah brings a distinctive voice to every piece.',
    avatarSeq: 12,
    coverSeq: 112,
    location: 'Kampala, Uganda',
    areas: ['Music', 'Fashion', 'Style'],
    socialLinks: [],
    joinedDate: '2024-09',
  },
  mary: {
    displayName: 'Mary Gathoni',
    role: 'Contributor',
    bio: 'Radio veteran turned digital writer. Mary bridges the gap between traditional broadcast and online music journalism with warmth and authority.',
    avatarSeq: 13,
    coverSeq: 113,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Film'],
    socialLinks: [],
    joinedDate: '2025-01',
  },
  gatwiri_c: {
    displayName: 'Gatwiri C.',
    role: 'Contributor',
    bio: 'Emerging voice in music journalism. Gatwiri brings fresh perspective and Gen-Z energy to the WAKILISHA editorial roster.',
    avatarSeq: 14,
    coverSeq: 114,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Style'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2025-04',
  },

  // ── Catch-all: generic "Wakilisha" default (for cached/browser-stale responses) ──
  wakilisha: {
    displayName: 'Wakilisha Staff',
    role: 'Editorial Team',
    bio: 'The WAKILISHA editorial team. Covering East African music, charts, and the culture that moves the sound since day one.',
    avatarSeq: 1,
    coverSeq: 101,
    location: 'Nairobi, Kenya',
    areas: ['Music', 'Guides', 'Essays'],
    socialLinks: [
      { label: 'X', url: '#', icon: 'ri-twitter-x-line' },
    ],
    joinedDate: '2023-01',
  },
};

/* ─── Section → vertical color mapping ─── */
const SECTION_VERTICAL_MAP: Record<string, string> = {
  'Music': 'var(--wk-v-music)',
  'Film': 'var(--wk-v-film)',
  'Fashion': 'var(--wk-v-fashion)',
  'Food': 'var(--wk-v-food)',
  'Language': 'var(--wk-v-language)',
  'Style': 'var(--wk-v-fashion)',
  'Places': 'var(--wk-v-places)',
  'Guides': 'var(--wk-v-intel)',
  'Essays': 'var(--wk-v-intel)',
  'Chart Notes': 'var(--wk-v-music)',
  'Reviews': 'var(--wk-v-music)',
  'Interviews': 'var(--wk-v-music)',
};

export function getVerticalColor(sectionName: string): string {
  return SECTION_VERTICAL_MAP[sectionName] || 'var(--wk-brand)';
}

function normalizeAuthorSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, '-');
}

export function getAuthorMeta(rawAuthor: string): {
  slug: string;
  displayName: string;
  role: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  location: string;
  areas: string[];
  socialLinks: { label: string; url: string; icon: string }[];
  joinedDate: string;
} {
  const slug = normalizeAuthorSlug(rawAuthor);
  const meta = AUTHOR_META[slug];

  if (meta) {
    return {
      slug,
      displayName: meta.displayName,
      role: meta.role,
      bio: meta.bio,
      avatarUrl: `https://readdy.ai/api/search-image?query=Professional%20portrait%20photograph%20of%20African%20music%20journalist%2C%20editorial%20style%2C%20warm%20natural%20lighting%2C%20Nairobi%20creative%20scene%2C%20clean%20simple%20background%20with%20earth%20tones%2C%20confident%20expression%2C%20professional%20headshot%20composition&width=480&height=480&seq=author-av-${meta.avatarSeq}&orientation=squarish`,
      coverUrl: `https://readdy.ai/api/search-image?query=Abstract%20African%20music%20culture%20landscape%2C%20artistic%20gradient%20with%20warm%20amber%20and%20deep%20green%20tones%2C%20Nairobi%20skyline%20silhouette%20at%20dusk%2C%20editorial%20atmosphere%2C%20modern%20minimal%20banner%20composition%2C%20no%20text%20no%20logos%2C%20cinematic%20wide%20aspect&width=1600&height=400&seq=author-cv-${meta.coverSeq}&orientation=landscape`,
      location: meta.location,
      areas: meta.areas,
      socialLinks: meta.socialLinks,
      joinedDate: meta.joinedDate,
    };
  }

  const displayName = rawAuthor
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

  return {
    slug,
    displayName,
    role: 'Contributor',
    bio: `${displayName} is a contributor to WAKILISHA Magazine, covering East African music and culture.`,
    avatarUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">
        <rect width="240" height="240" fill="#1A1F16"/>
        <text x="120" y="132" text-anchor="middle" fill="#85C441" font-family="system-ui,sans-serif" font-size="72" font-weight="900">${displayName.split(' ').map((n) => n[0]).join('').slice(0, 2)}</text>
      </svg>`
    )}`,
    coverUrl: `data:image/svg+xml;utf8,${encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400" viewBox="0 0 1600 400">
        <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#1a3a0a"/><stop offset="100%" stop-color="#2a5a1a"/></linearGradient></defs>
        <rect width="1600" height="400" fill="url(#g)"/>
        <circle cx="300" cy="120" r="200" fill="#85C441" fill-opacity="0.08"/>
        <circle cx="1300" cy="300" r="250" fill="#85C441" fill-opacity="0.05"/>
      </svg>`
    )}`,
    location: '',
    areas: [],
    socialLinks: [],
    joinedDate: '',
  };
}

export function getAuthorProfile(authorSlug: string, articles: MagazineArticle[]): AuthorProfile | null {
  const matching = articles.filter(
    (a) => normalizeAuthorSlug(a.author) === authorSlug
  );

  if (matching.length === 0 && !AUTHOR_META[authorSlug]) return null;

  const meta = getAuthorMeta(matching.length > 0 ? matching[0].author : authorSlug);

  return {
    ...meta,
    articleCount: matching.length,
  };
}

export function getAllAuthorSlugs(articles: MagazineArticle[]): string[] {
  const slugs = new Set<string>();
  for (const a of articles) {
    slugs.add(normalizeAuthorSlug(a.author));
  }
  for (const slug of Object.keys(AUTHOR_META)) {
    slugs.add(slug);
  }
  return Array.from(slugs).sort();
}