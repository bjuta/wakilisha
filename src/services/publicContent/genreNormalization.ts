const GENRE_ALIASES: Record<string, string> = {
  "3 step": "3-Step",
  "3-step": "3-Step",
  "a mapiano": "Amapiano",
  amapiano: "Amapiano",
  "african gospel": "African Gospel",
  "afro adura": "Afro Adura",
  afrobeat: "Afrobeats",
  afrobeats: "Afrobeats",
  "afro beats": "Afrobeats",
  afrohouse: "Afro-house",
  "afro house": "Afro-house",
  "afro-house": "Afro-house",
  "afro pop": "Afro-pop",
  "afro-pop": "Afro-pop",
  afropop: "Afro-pop",
  "afro r&b": "Afro R&B",
  afrornb: "Afro R&B",
  "afro rnb": "Afro R&B",
  "afro soul": "Afro-soul",
  "afro-soul": "Afro-soul",
  afrosoul: "Afro-soul",
  "afro urban": "Afro-urban",
  "afro-urban": "Afro-urban",
  afrofusion: "Afro-fusion",
  "afro fusion": "Afro-fusion",
  "afro-fusion": "Afro-fusion",
  afropiano: "Afropiano",
  alte: "Alté",
  alté: "Alté",
  alternative: "Alternative",
  arbantone: "Arbantone",
  azonto: "Azonto",
  bacardi: "Bacardi",
  "bongo flava": "Bongo Flava",
  bongoflava: "Bongo Flava",
  christian: "Christian",
  dancehall: "Dancehall",
  drill: "Drill",
  genge: "Genge",
  gengetone: "Gengetone",
  gospel: "Gospel",
  gqom: "Gqom",
  hiplife: "Hiplife",
  "hip hop": "Hip-hop",
  "hip-hop": "Hip-hop",
  hiphop: "Hip-hop",
  kizomba: "Kizomba",
  "private school piano": "Private School Piano",
  "r&b": "R&B",
  rb: "R&B",
  rnb: "R&B",
  "r n b": "R&B",
  "rumba congolaise": "Rumba Congolaise",
  singeli: "Singeli",
  "tribal house": "Tribal House",
};

const COUNTRY_CODES = new Set([
  "ao", "bf", "bi", "bj", "bw", "cd", "cf", "cg", "ci", "cm", "cv", "dj", "dz", "eg", "er", "et",
  "ga", "gh", "gm", "gn", "gq", "gw", "ke", "km", "lr", "ls", "ly", "ma", "mg", "ml", "mr", "mu",
  "mw", "mz", "na", "ne", "ng", "rw", "sc", "sd", "sl", "sn", "so", "ss", "st", "sz", "td", "tg",
  "tn", "tz", "ug", "za", "zm", "zw",
]);

function cleanGenreKey(value: string): string {
  return value
    .trim()
    .replace(/&amp;/gi, "&")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function titleCaseGenre(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (/^r&b$/i.test(word)) return "R&B";
      if (/^dj$/i.test(word)) return "DJ";
      if (/^edm$/i.test(word)) return "EDM";
      if (/^hip-hop$/i.test(word)) return "Hip-hop";
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export const DISCOVERY_GENRE_ORDER = [
  "Afrobeats",
  "Amapiano",
  "Hip-hop",
  "Bongo Flava",
  "Gengetone",
  "R&B",
  "Afro R&B",
  "Afro-soul",
  "Afro-pop",
  "Afro-fusion",
  "Dancehall",
  "Genge",
  "Arbantone",
  "Gospel",
  "Alté",
  "3-Step",
  "Gqom",
  "Hiplife",
  "Rumba Congolaise",
  "Singeli",
] as const;

const DISCOVERY_GENRE_RANK = new Map<string, number>(
  DISCOVERY_GENRE_ORDER.map((genre, index) => [cleanGenreKey(genre), index])
);

export function getGenreDiscoveryRank(genre: string): number {
  const normalized = normalizeGenre(genre) || genre;
  return DISCOVERY_GENRE_RANK.get(cleanGenreKey(normalized)) ?? 999;
}

export function sortGenresByDiscoveryPriority(
  genres: string[],
  counts = new Map<string, number>()
): string[] {
  return normalizeGenres(genres).sort((a, b) => {
    const rankDelta = getGenreDiscoveryRank(a) - getGenreDiscoveryRank(b);
    if (rankDelta !== 0) return rankDelta;

    const countDelta = (counts.get(b) || 0) - (counts.get(a) || 0);
    if (countDelta !== 0) return countDelta;

    return a.localeCompare(b);
  });
}

export function normalizeGenre(value: unknown): string {
  if (typeof value !== "string") return "";

  const raw = value.trim();
  if (!raw) return "";

  const key = cleanGenreKey(raw);

  if (!key || key === "unknown" || key === "n/a" || key === "none") return "";
  if (COUNTRY_CODES.has(key)) return "";

  return GENRE_ALIASES[key] || titleCaseGenre(raw);
}

export function normalizeGenres(values: unknown, limit?: number): string[] {
  const source = Array.isArray(values)
    ? values
    : typeof values === "string"
      ? values.split(",")
      : [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of source) {
    const genre = normalizeGenre(value);
    if (!genre) continue;

    const key = cleanGenreKey(genre);
    if (seen.has(key)) continue;

    seen.add(key);
    normalized.push(genre);

    if (limit && normalized.length >= limit) break;
  }

  return normalized;
}
