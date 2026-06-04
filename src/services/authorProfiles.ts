import type { MagazineArticle } from '@/services/magazineArticles';

/* ─── Types ─── */

export type AuthorProfile = {
  slug: string;
  displayName: string;
  role: string;
  bio: string;
  avatarUrl: string;
  coverUrl: string;
  articleCount: number;
};

/* ─── Author display-name map ───
   Maps the raw author string from wk_articles.author → display name + metadata.
   Falls back to capitalizing the slug for any author not listed. */

const AUTHOR_META: Record<string, { displayName: string; role: string; bio: string; avatarSeq: number; coverSeq: number }> = {
  wakilishaji: {
    displayName: 'Wakilisha Ji',
    role: 'Founder & Editor-in-Chief',
    bio: 'Founder of WAKILISHA. Covering East African music, charts, and the culture that moves the sound. Building the definitive archive of African popular music since day one.',
    avatarSeq: 1,
    coverSeq: 101,
  },
  james: {
    displayName: 'James Gichuru',
    role: 'Senior Editor',
    bio: 'Music journalist and editor with over a decade covering East African hip-hop, gengetone, and R&B. Believes the best stories are told by the people who live them.',
    avatarSeq: 2,
    coverSeq: 102,
  },
  hafare: {
    displayName: 'Hafare Mwangi',
    role: 'Staff Writer',
    bio: 'Nairobi-based culture writer focused on the intersection of music, fashion, and youth identity. Always chasing the next sound before it breaks.',
    avatarSeq: 3,
    coverSeq: 103,
  },
  frank: {
    displayName: 'Frank Odhiambo',
    role: 'Contributing Writer',
    bio: 'Long-form features and investigative music journalism. Frank digs deep into the business of East African entertainment, from label deals to streaming economics.',
    avatarSeq: 4,
    coverSeq: 104,
  },
  kendi: {
    displayName: 'Kendi Muthoni',
    role: 'Culture Editor',
    bio: 'Curating the cultural conversation around East African music. Kendi writes about identity, diaspora, and the evolving sound of the region with sharp insight.',
    avatarSeq: 5,
    coverSeq: 105,
  },
  k_matiri: {
    displayName: 'K. Matiri',
    role: 'Charts Analyst',
    bio: 'The numbers person. K. Matiri breaks down chart data, streaming trends, and airplay analytics to reveal what the industry is actually listening to.',
    avatarSeq: 6,
    coverSeq: 106,
  },
  vicmuia: {
    displayName: 'Victor Muia',
    role: 'Staff Writer',
    bio: 'Covering breaking music news, album releases, and the pulse of Nairobi nightlife. Victor brings the immediacy of the moment to every story.',
    avatarSeq: 7,
    coverSeq: 107,
  },
  michael: {
    displayName: 'Michael Otieno',
    role: 'Contributing Writer',
    bio: 'Essayist and critic exploring the deeper currents in East African music. Michael writes with a literary edge, connecting songs to society.',
    avatarSeq: 8,
    coverSeq: 108,
  },
  wangari: {
    displayName: 'Wangari Kamau',
    role: 'Features Writer',
    bio: 'Profile writer and storyteller. Wangari captures the human stories behind the artists — their struggles, triumphs, and what drives them to create.',
    avatarSeq: 9,
    coverSeq: 109,
  },
  kiuta: {
    displayName: 'Kiuta M.',
    role: 'Contributor',
    bio: 'Independent music writer with an ear for the underground. Kiuta covers emerging scenes and sounds before they hit the mainstream.',
    avatarSeq: 10,
    coverSeq: 110,
  },
  timo: {
    displayName: 'Timo K.',
    role: 'Contributor',
    bio: 'DJ, producer, and writer. Timo brings an insider perspective on production culture, beat-making, and the studio side of East African music.',
    avatarSeq: 11,
    coverSeq: 111,
  },
  swambi: {
    displayName: 'Swambi A.',
    role: 'Contributor',
    bio: 'Multidisciplinary creative writing at the crossroads of music, visual art, and design. Swambi brings a distinctive voice to every piece.',
    avatarSeq: 12,
    coverSeq: 112,
  },
  mary: {
    displayName: 'Mary Wanjiku',
    role: 'Contributor',
    bio: 'Radio veteran turned digital writer. Mary bridges the gap between traditional broadcast and online music journalism with warmth and authority.',
    avatarSeq: 13,
    coverSeq: 113,
  },
  gatwiri_c: {
    displayName: 'Gatwiri C.',
    role: 'Contributor',
    bio: 'Emerging voice in music journalism. Gatwiri brings fresh perspective and Gen-Z energy to the WAKILISHA editorial roster.',
    avatarSeq: 14,
    coverSeq: 114,
  },
};

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
  // Also include known authors who might not have published articles yet
  for (const slug of Object.keys(AUTHOR_META)) {
    slugs.add(slug);
  }
  return Array.from(slugs).sort();
}