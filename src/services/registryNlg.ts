/**
 * Registry NLG (Natural Language Generation)
 *
 * Deterministic, relationship-driven prose generation for registry entity
 * detail pages. No LLM calls — just intelligent string assembly based on
 * the available relationship graph data.
 *
 * The principle: if a track is #8 on an album released March 2024, by an
 * artist who has 3 other chart entries, we have enough data to generate
 * a meaningful, unique summary every time.
 *
 * Design goal: read like an archivist's catalogue note, not a CSV row
 * concatenated with periods. Editorial, authoritative, fluid.
 */

export type TrackArtistRole = {
  name: string;
  slug: string;
  isPrimary: boolean;
  isFeatured: boolean;
  creditOrder: number;
};

export type TrackReleaseContext = {
  title: string;
  slug: string;
  releaseDate: string;
  releaseType: string;
  trackCount: number;
  trackNumber: number;
  discNumber: number;
  labelName: string;
  labelSlug: string;
};

export type TrackChartContext = {
  peakRank: number;
  weeksOnChart: number;
  firstChartedDate: string;
  latestRank: number;
  appearances: number;
  editionLabels: string[];
};

export type TrackRelationshipData = {
  title: string;
  artists: TrackArtistRole[];
  release: TrackReleaseContext | null;
  genres: string[];
  isrc: string | null;
  durationMs: number;
  explicit: boolean;
  chartContext: TrackChartContext | null;
  previewAvailable: boolean;
  sourceProviders: string[];
};

export type ArtistRelationshipData = {
  name: string;
  genres: string[];
  originCountry: string;
  releaseCount: number;
  trackCount: number;
  chartEntryCount: number;
  peakChartPosition: number | null;
  topChartEditions: string[];
  collaborations: Array<{ name: string; count: number }>;
  labelAffiliations: string[];
  yearsActive: string;
};

export type ReleaseRelationshipData = {
  title: string;
  artistNames: string[];
  releaseType: string;
  releaseDate: string;
  trackCount: number;
  totalDurationMs: number;
  labelName: string;
  genres: string[];
  chartEntryCount: number;
  isCompilation: boolean;
};

export type LabelRelationshipData = {
  name: string;
  countryCode: string;
  artistCount: number;
  releaseCount: number;
  trackCount: number;
  chartEntryCount: number;
  genresRepresented: string[];
  topArtists: string[];
  yearsActive: string;
};

// ── helpers ──

function extractYear(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  return parts[0] || "";
}

function monthName(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "long" });
  } catch { return ""; }
}

function articleize(word: string): string {
  const first = word.charAt(0).toLowerCase();
  if ("aeiou".includes(first)) return `an ${word}`;
  return `a ${word}`;
}

function humanList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function ordinal(n: number): string {
  if (n <= 0) return `${n}`;
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

function pickVariant<T>(seed: string, variants: T[]): T {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length];
}

// ── Track summaries ──

/**
 * Build the opening clause. Title-centric, artist woven in naturally.
 * No more "Ywaya Tajiri released 'Chai ya saa kumi'." — instead:
 * "'Chai ya saa kumi' — a recording by Ywaya Tajiri" or
 * "The eighth track on Ywaya Tajiri's album 'Baraka Za Mtaa', 'Chai ya saa kumi'"
 */
function buildTrackOpening(data: TrackRelationshipData): { text: string; isCompound: boolean } {
  const primary = data.artists.find((a) => a.isPrimary);
  const featured = data.artists.filter((a) => a.isFeatured);
  const primaryName = primary?.name || "";
  const featPhrase = featured.length > 0
    ? ` featuring ${humanList(featured.map((a) => a.name))}`
    : "";

  if (data.release && data.release.trackNumber > 0 && data.release.trackCount > 1 && primaryName) {
    // Has album context — use it
    const releaseYear = extractYear(data.release.releaseDate);
    const yearPhrase = releaseYear ? ` (${releaseYear})` : "";

    const variants = [
      `The ${ordinal(data.release.trackNumber)} track on ${primaryName}'s ${data.release.releaseType.toLowerCase()} "${data.release.title}"${yearPhrase}, "${data.title}"${featPhrase}`,
      `"${data.title}"${featPhrase} appears as the ${ordinal(data.release.trackNumber)} track on "${data.release.title}"${yearPhrase} by ${primaryName}`,
      `Drawn from ${primaryName}'s ${data.release.releaseType.toLowerCase()} "${data.release.title}"${yearPhrase}, "${data.title}"${featPhrase} is its ${ordinal(data.release.trackNumber)} track`,
    ];
    return { text: pickVariant(data.title + "-compound", variants), isCompound: true };
  }

  // Standalone single or simple recording — title-first, more editorial
  if (primaryName) {
    const variants = [
      `"${data.title}"${featPhrase} — a recording by ${primaryName}`,
      `${primaryName}'s "${data.title}"${featPhrase}`,
      `"${data.title}"${featPhrase}, recorded by ${primaryName}`,
    ];
    return { text: pickVariant(data.title + "-simple", variants), isCompound: false };
  }

  // No known artist
  const variants = [
    `"${data.title}" — a recording in the WAKILISHA registry`,
    `The track "${data.title}", catalogued in the WAKILISHA registry`,
  ];
  return { text: pickVariant(data.title + "-anon", variants), isCompound: false };
}

/**
 * Build the chart narrative. This is the most important sentence for authority.
 * No more "Chart history: 26 weeks on the rankings on..." — instead:
 * "has spent 26 weeks across the Top 100 Songs in Kenya and Top Kenyan R&B Songs charts, reaching #1"
 */
function buildChartNarrative(data: TrackRelationshipData): string {
  const ctx = data.chartContext;
  if (!ctx) return "";
  if (ctx.peakRank <= 0 && ctx.weeksOnChart <= 0) return "";

  const editionPhrase = ctx.editionLabels.length > 0
    ? humanList(ctx.editionLabels.slice(0, 2))
    : "the WAKILISHA charts";

  const firstYear = extractYear(ctx.firstChartedDate);
  const debutPhrase = firstYear ? ` since ${firstYear}` : "";

  // Strong chart presence (multiple weeks, known peak)
  if (ctx.peakRank > 0 && ctx.weeksOnChart > 0) {
    const peakPhrase = ctx.peakRank === 1
      ? "reaching the #1 position"
      : `peaking at #${ctx.peakRank}`;
    const weeksPhrase = ctx.weeksOnChart === 1
      ? "one week"
      : `${ctx.weeksOnChart} weeks`;

    const variants = [
      `has spent ${weeksPhrase} across ${editionPhrase}${debutPhrase}, ${peakPhrase}`,
      `has charted for ${weeksPhrase} on ${editionPhrase}${debutPhrase}, ${peakPhrase}`,
      `has accumulated ${weeksPhrase} on ${editionPhrase}${debutPhrase}, ${peakPhrase}`,
    ];
    return pickVariant(data.title + "-chart-strong", variants);
  }

  // Moderate chart presence
  if (ctx.appearances > 0) {
    const countPhrase = ctx.appearances === 1
      ? "has appeared once"
      : `has appeared ${ctx.appearances} times`;
    const peakBit = ctx.peakRank > 0 ? `, peaking at #${ctx.peakRank}` : "";

    const variants = [
      `${countPhrase} on ${editionPhrase}${debutPhrase}${peakBit}`,
      `${countPhrase} across ${editionPhrase}${peakBit}`,
    ];
    return pickVariant(data.title + "-chart-moderate", variants);
  }

  return "";
}

/**
 * Build context details: genre, label info. These are supporting sentences.
 */
function buildContextDetails(data: TrackRelationshipData): string {
  const parts: string[] = [];

  if (data.genres.length > 0) {
    const genrePhrase = humanList(data.genres.slice(0, 3));
    const variants = [
      `Classified under ${genrePhrase}.`,
      `The recording is tagged as ${genrePhrase}.`,
      `Listed under ${genrePhrase} in the registry.`,
    ];
    parts.push(pickVariant(data.title + "-genre", variants));
  }

  if (data.release) {
    const rel = data.release;
    const year = extractYear(rel.releaseDate);
    const month = monthName(rel.releaseDate);
    const datePhrase = month && year ? `${month} ${year}` : year;

    if (rel.labelName && rel.labelName !== "Independent" && rel.labelName !== "Unknown" && datePhrase) {
      const variants = [
        `Released through ${rel.labelName} in ${datePhrase}.`,
        `${rel.labelName} issued the ${rel.releaseType.toLowerCase()} in ${datePhrase}.`,
      ];
      parts.push(pickVariant(data.title + "-label-date", variants));
    } else if (rel.labelName && rel.labelName !== "Independent" && rel.labelName !== "Unknown") {
      parts.push(`Released through ${rel.labelName}.`);
    } else if (datePhrase) {
      parts.push(`Released in ${datePhrase}.`);
    }
  }

  return parts.join(" ");
}

/**
 * Build the registry access note. Brief, natural.
 * No more "Audio preview available." as a standalone robot sentence.
 */
function buildRegistryNote(data: TrackRelationshipData): string {
  const notes: string[] = [];

  if (data.previewAvailable) {
    notes.push("An audio preview is available in the registry.");
  }

  if (data.sourceProviders.length > 0) {
    const providers = humanList(data.sourceProviders);
    const variants = [
      `Sourced from ${providers}.`,
      `Data drawn from ${providers}.`,
    ];
    notes.push(pickVariant(data.title + "-sources", variants));
  }

  return notes.join(" ");
}

/**
 * Build the full track summary — a single flowing paragraph.
 * The structure:
 *   [Opening with artist + title] [chart narrative], [context details] [registry note]
 *
 * Examples:
 *   "'Chai ya saa kumi' — a recording by Ywaya Tajiri — has spent 26 weeks across
 *    the Top 100 Songs in Kenya and Top Kenyan R&B Songs charts, reaching #1.
 *    Classified under Kenyan R&B. An audio preview is available in the registry."
 *
 *   "The 8th track on Bien's album 'Alusa Why Are You Topless' (2026), 'Wahala'
 *    featuring Ayra Starr has charted for 14 weeks on the Top 100 Songs in Kenya,
 *    peaking at #3. Released through Afrobeats District in March 2026. An audio
 *    preview is available in the registry."
 */
export function buildTrackSummary(data: TrackRelationshipData): string {
  const opening = buildTrackOpening(data);
  const chart = buildChartNarrative(data);
  const context = buildContextDetails(data);
  const note = buildRegistryNote(data);

  // Build the paragraph
  const sentence1 = chart
    ? `${opening.text} ${chart}`
    : opening.text;

  const parts = [sentence1];
  if (context) parts.push(context);
  if (note) parts.push(note);

  return parts.join(" ").trim();
}

// ── Artist summaries ──

export function buildArtistSummary(data: ArtistRelationshipData): string {
  const parts: string[] = [];
  const { name } = data;

  // Opening
  const originPhrase = data.originCountry ? ` from ${data.originCountry}` : "";
  const genrePhrase = data.genres.length > 0 ? ` working in ${humanList(data.genres.slice(0, 3))}` : "";

  const openings = [
    `${name}${originPhrase} is${genrePhrase} an artist in the WAKILISHA registry.`,
    `${name}${originPhrase}${genrePhrase} — recorded in the WAKILISHA registry.`,
    `An artist${originPhrase}${genrePhrase}: ${name}.`,
  ];
  parts.push(pickVariant(name + "-opening", openings));

  // Catalog
  if (data.releaseCount > 0 || data.trackCount > 0) {
    const catalogParts: string[] = [];
    if (data.releaseCount > 0) catalogParts.push(`${data.releaseCount} release${data.releaseCount === 1 ? "" : "s"}`);
    if (data.trackCount > 0) catalogParts.push(`${data.trackCount} track${data.trackCount === 1 ? "" : "s"}`);
    parts.push(` The registry holds ${humanList(catalogParts)} by ${name}.`);
  }

  // Chart performance
  if (data.peakChartPosition && data.peakChartPosition > 0) {
    const editionPhrase = data.topChartEditions.length > 0
      ? ` on ${humanList(data.topChartEditions.slice(0, 2))}`
      : "";
    parts.push(
      ` Chart peak: #${data.peakChartPosition}${editionPhrase}.`,
    );
  }

  // Collaborations
  if (data.collaborations.length > 0) {
    const topCollabs = data.collaborations
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const collabNames = humanList(topCollabs.map((c) => `${c.name} (${c.count})`));
    parts.push(` Notable collaborations: ${collabNames}.`);
  }

  // Labels
  if (data.labelAffiliations.length > 0) {
    parts.push(` Label history: ${humanList(data.labelAffiliations.slice(0, 3))}.`);
  }

  // Years active
  if (data.yearsActive) {
    parts.push(` Active period: ${data.yearsActive}.`);
  }

  return parts.join("").trim();
}

// ── Release summaries ──

export function buildReleaseSummary(data: ReleaseRelationshipData): string {
  const parts: string[] = [];
  const { title } = data;

  // Opening
  const artistPhrase = data.artistNames.length > 0
    ? ` by ${humanList(data.artistNames)}`
    : "";
  const typePhrase = data.releaseType.toLowerCase();
  const year = extractYear(data.releaseDate);

  const openings = [
    `"${title}"${artistPhrase} is ${articleize(typePhrase)} released in ${year}.`,
    `Released in ${year}, "${title}"${artistPhrase} is ${articleize(typePhrase)}.`,
    `${articleize(typePhrase.charAt(0).toUpperCase() + typePhrase.slice(1))} release: "${title}"${artistPhrase}.`,
  ];
  parts.push(pickVariant(title + "-opening", openings));

  // Track count
  if (data.trackCount > 0) {
    const dur = data.totalDurationMs > 0 ? `, runtime ${formatDuration(data.totalDurationMs)}` : "";
    parts.push(` It contains ${data.trackCount} track${data.trackCount === 1 ? "" : "s"}${dur}.`);
  }

  // Label
  if (data.labelName && data.labelName !== "Independent" && data.labelName !== "Unknown") {
    parts.push(` Released through ${data.labelName}.`);
  }

  // Genres
  if (data.genres.length > 0) {
    parts.push(` Tagged: ${humanList(data.genres.slice(0, 3))}.`);
  }

  // Chart
  if (data.chartEntryCount > 0) {
    parts.push(` ${data.chartEntryCount} chart appearance${data.chartEntryCount === 1 ? "" : "s"} recorded.`);
  }

  // Compilation
  if (data.isCompilation) {
    parts.push(" This is a compilation release.");
  }

  return parts.join("").trim();
}

// ── Label summaries ──

export function buildLabelSummary(data: LabelRelationshipData): string {
  const parts: string[] = [];
  const { name } = data;

  const countryPhrase = data.countryCode ? ` (${data.countryCode})` : "";
  const openings = [
    `${name}${countryPhrase} is a label in the WAKILISHA registry.`,
    `${name}${countryPhrase} — label profile.`,
    `Label: ${name}${countryPhrase}.`,
  ];
  parts.push(pickVariant(name + "-opening", openings));

  if (data.artistCount > 0 || data.releaseCount > 0) {
    const catalogParts: string[] = [];
    if (data.artistCount > 0) catalogParts.push(`${data.artistCount} artist${data.artistCount === 1 ? "" : "s"}`);
    if (data.releaseCount > 0) catalogParts.push(`${data.releaseCount} release${data.releaseCount === 1 ? "" : "s"}`);
    if (data.trackCount > 0) catalogParts.push(`${data.trackCount} track${data.trackCount === 1 ? "" : "s"}`);
    parts.push(` The catalog includes ${humanList(catalogParts)}.`);
  }

  if (data.chartEntryCount > 0) {
    parts.push(` ${data.chartEntryCount} chart entries across the WAKILISHA rankings.`);
  }

  if (data.genresRepresented.length > 0) {
    parts.push(` Genres represented: ${humanList(data.genresRepresented.slice(0, 4))}.`);
  }

  if (data.topArtists.length > 0) {
    parts.push(` Key artists: ${humanList(data.topArtists.slice(0, 4))}.`);
  }

  if (data.yearsActive) {
    parts.push(` Active: ${data.yearsActive}.`);
  }

  return parts.join("").trim();
}

// ── Convenience builders from raw API data ──

export function buildTrackSummaryFromApi(
  track: {
    title: string;
    durationMs: number;
    isrc: string | null;
    explicit: boolean;
    trackNumber: number;
    previewUrl?: string | null;
  },
  artists: Array<{ name: string; slug: string; isPrimary?: boolean; isFeatured?: boolean; creditOrder?: number }>,
  release: {
    title: string;
    slug: string;
    releaseDate: string;
    releaseType: string;
    trackCount?: number;
    labelName?: string;
    labelSlug?: string;
  } | null,
  genres: string[],
  chartContext: {
    peakRank: number;
    weeksOnChart: number;
    firstChartedDate?: string;
    latestRank?: number;
    appearances: number;
    editionLabels?: string[];
  } | null,
  sourceProviders: string[] = [],
): string {
  const data: TrackRelationshipData = {
    title: track.title,
    artists: artists.map((a) => ({
      name: a.name,
      slug: a.slug,
      isPrimary: a.isPrimary ?? a.creditOrder === 0,
      isFeatured: a.isFeatured ?? false,
      creditOrder: a.creditOrder ?? 0,
    })),
    release: release
      ? {
          title: release.title,
          slug: release.slug,
          releaseDate: release.releaseDate,
          releaseType: release.releaseType,
          trackCount: release.trackCount ?? 0,
          trackNumber: track.trackNumber,
          discNumber: 1,
          labelName: release.labelName ?? "",
          labelSlug: release.labelSlug ?? "",
        }
      : null,
    genres,
    isrc: track.isrc,
    durationMs: track.durationMs,
    explicit: track.explicit,
    chartContext: chartContext
      ? {
          peakRank: chartContext.peakRank,
          weeksOnChart: chartContext.weeksOnChart,
          firstChartedDate: chartContext.firstChartedDate ?? "",
          latestRank: chartContext.latestRank ?? 0,
          appearances: chartContext.appearances,
          editionLabels: chartContext.editionLabels ?? [],
        }
      : null,
    previewAvailable: !!track.previewUrl,
    sourceProviders,
  };

  return buildTrackSummary(data);
}

// Keep formatDuration for backward compat with release/label builders
function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}