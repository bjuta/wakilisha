import { humanList, pluralize } from "../formatters";
import { selectTrackStory } from "../scoring";
import type { CultureRecipeContext, CultureRecipeResult, TrackFacts } from "../types";

function title(facts: TrackFacts): string {
  return facts.title || "This track";
}

function artistLine(facts: TrackFacts): string {
  const primary = humanList(facts.primaryArtists, 4);
  const featured = humanList(facts.featuredArtists, 3);
  if (primary && featured) return `${primary} featuring ${featured}`;
  return primary || featured;
}

function baseFactsUsed(facts: TrackFacts): string[] {
  return [
    facts.title ? "title" : "missing:title",
    facts.primaryArtists.length > 0 ? "primaryArtists" : "missing:primaryArtists",
    facts.releaseTitle ? "releaseTitle" : "missing:releaseTitle",
    facts.peakRank ? "peakRank" : "missing:peakRank",
    facts.genres.length > 0 ? "genres" : "missing:genres",
  ];
}

function heroIntro(facts: TrackFacts): string {
  const trackTitle = title(facts);
  const artists = artistLine(facts);
  const byText = artists ? ` by ${artists}` : "";
  const story = selectTrackStory(facts);

  if (story === "chartHeat") {
    const peak = facts.peakRank ? `peaking at #${facts.peakRank}` : "moving on the charts";
    const weeks = facts.weeksOnChart ? ` after ${pluralize(facts.weeksOnChart, "week")} in the mix` : "";
    return `${trackTitle}${byText} has been moving on the WAKILISHA charts, ${peak}${weeks}.`;
  }

  if (story === "releasePlacement") {
    const position = facts.trackNumber ? `track ${facts.trackNumber}` : "a track";
    return `${trackTitle}${byText} sits as ${position} on ${facts.releaseTitle}. Start here for the song, the release, and the artist links around it.`;
  }

  if (story === "collaboration") {
    return `${trackTitle} brings ${artists || "these artists"} onto one track, with release and chart context connected in WAKILISHA.`;
  }

  if (story === "sceneMarker") {
    const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);
    return `${trackTitle}${byText} sits around ${scene}. Start here for the sound, artist links, and context we have so far.`;
  }

  return `${trackTitle}${byText} is in WAKILISHA with the artist details we have so far. More release and chart context will be added as the archive grows.`;
}

function cardBlurb(facts: TrackFacts): string {
  const artists = artistLine(facts);
  if (facts.peakRank) return `Peaked at #${facts.peakRank}${facts.weeksOnChart ? ` after ${pluralize(facts.weeksOnChart, "week")}` : ""}.`;
  if (facts.releaseTitle) return `${artists ? `${artists}. ` : ""}Appears on ${facts.releaseTitle}.`;
  if (artists) return `Track by ${artists}.`;
  return "Track context is still growing.";
}

function searchSnippet(facts: TrackFacts): string {
  const artists = artistLine(facts);
  const bits = [artists ? `Track by ${artists}` : "Track", facts.releaseTitle ? `from ${facts.releaseTitle}` : undefined, facts.peakRank ? `peaked at #${facts.peakRank}` : undefined].filter(Boolean);
  return `${humanList(bits as string[], 3)}.`;
}

function seoDescription(facts: TrackFacts): string {
  const artists = artistLine(facts);
  const byText = artists ? ` by ${artists}` : "";
  return `Explore ${title(facts)}${byText} on WAKILISHA, with artist links, release context, chart moments, genres, and related music.`;
}

export function buildTrackContext(context: CultureRecipeContext<TrackFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: cardBlurb(facts),
    searchSnippet: searchSnippet(facts),
    seoDescription: seoDescription(facts),
    chartNote: facts.peakRank ? `${title(facts)} peaked at #${facts.peakRank}${facts.weeksOnChart ? ` after ${pluralize(facts.weeksOnChart, "week")}` : ""}.` : "No chart moment is connected yet.",
    whyItMatters: "This track page keeps the song, artists, release context, and chart links together so the moment is easier to follow.",
    startHere: facts.releaseTitle ? `Start with the song, then follow ${facts.releaseTitle} and the artist links around it.` : "Start with the song, then follow the artists and related music around it.",
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Track context has the core fields needed for public use." : `Track context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.title && facts.primaryArtists.length > 0 ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `track.${surface}.${selectTrackStory(facts)}`,
  };
}
