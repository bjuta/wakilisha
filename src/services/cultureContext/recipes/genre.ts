import { humanList, pluralize } from "../formatters";
import type { CultureRecipeContext, CultureRecipeResult, GenreFacts } from "../types";

function baseFactsUsed(facts: GenreFacts): string[] {
  return [
    facts.name ? "name" : "missing:name",
    facts.artistCount ? "artistCount" : "missing:artistCount",
    facts.trackCount ? "trackCount" : "missing:trackCount",
    facts.topArtists.length > 0 ? "topArtists" : "missing:topArtists",
  ];
}

export function buildGenreContext(context: CultureRecipeContext<GenreFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const name = facts.name || "This sound";
  const topArtists = humanList(facts.topArtists, 3);
  const topTracks = humanList(facts.topTracks, 3);
  const counts = humanList([
    facts.artistCount ? pluralize(facts.artistCount, "artist") : "",
    facts.trackCount ? pluralize(facts.trackCount, "track") : "",
    facts.releaseCount ? pluralize(facts.releaseCount, "release") : "",
  ].filter(Boolean), 3);

  const textBySurface = {
    heroIntro: `${name} is a way into the sound. Start with the artists, songs, and releases connected here${counts ? `, including ${counts}` : ""}.`,
    cardBlurb: counts ? `${name} connects ${counts} in WAKILISHA.` : `${name} is a sound path in WAKILISHA.`,
    searchSnippet: topArtists ? `${name} connects to artists like ${topArtists}.` : `${name} genre page on WAKILISHA.`,
    seoDescription: `Explore ${name} on WAKILISHA, with artists, tracks, releases, chart moments, and related sounds.`,
    chartNote: topTracks ? `Start with ${topTracks}, then follow the artists around the sound.` : "No chart moment is connected yet.",
    whyItMatters: "Genres are doors into the culture. They help users move from a sound to the artists, songs, and scenes around it.",
    startHere: topArtists ? `Start with ${topArtists}, then follow the songs and releases around them.` : "Start with the songs, then follow the artists and related sounds.",
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Genre context has the core fields needed for public use." : `Genre context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.name && (facts.artistCount || facts.trackCount || facts.topArtists.length > 0) ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `genre.${surface}`,
  };
}
