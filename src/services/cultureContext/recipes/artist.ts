import { humanList, pluralize } from "../formatters";
import { selectArtistStory } from "../scoring";
import type { ArtistFacts, CultureRecipeContext, CultureRecipeResult } from "../types";

function baseFactsUsed(facts: ArtistFacts): string[] {
  return [
    facts.name ? "name" : "missing:name",
    facts.country ? "country" : "missing:country",
    facts.genres.length > 0 ? "genres" : "missing:genres",
    facts.releaseCount ? "releaseCount" : "missing:releaseCount",
    facts.trackCount ? "trackCount" : "missing:trackCount",
    facts.topTracks.length > 0 ? "topTracks" : "missing:topTracks",
    facts.topReleases.length > 0 ? "topReleases" : "missing:topReleases",
    facts.chartEntryCount ? "chartEntryCount" : "missing:chartEntryCount",
  ];
}

function discographyLine(facts: ArtistFacts): string {
  const tracks = facts.topTracks.slice(0, 4);
  const releases = facts.topReleases.slice(0, 3);

  if (tracks.length >= 3) {
    return `Start with songs like ${humanList(tracks, 4)}.`;
  }

  if (tracks.length > 0 && releases.length > 0) {
    return `Start with ${humanList(tracks, 3)}, then follow releases like ${humanList(releases, 2)}.`;
  }

  if (releases.length > 0) {
    return `Start with releases like ${humanList(releases, 3)}.`;
  }

  return "";
}

function heroIntro(facts: ArtistFacts): string {
  const name = facts.name || "This artist";
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);
  const story = selectArtistStory(facts);
  const discography = discographyLine(facts);

  if (story === "chartActor") {
    const peak = facts.peakChartPosition ? `, reaching #${facts.peakChartPosition}` : "";
    return `${name}${scene ? ` moves around ${scene}` : ""}, with chart moments connected in WAKILISHA${peak}.${discography ? ` ${discography}` : ""}`;
  }

  if (story === "catalogBuilder") {
    const counts = humanList([
      facts.releaseCount ? pluralize(facts.releaseCount, "release") : "",
      facts.trackCount ? pluralize(facts.trackCount, "track") : "",
    ].filter(Boolean), 2);

    if (discography) {
      return `${name}${scene ? ` moves around ${scene}` : ""}, with ${counts || "music"} connected in WAKILISHA. ${discography}`;
    }

    return `${name}${scene ? ` moves around ${scene}` : ""}, with ${counts} connected in WAKILISHA.`;
  }

  if (story === "collaborator") {
    const collaborators = humanList(facts.collaborations.map((item) => item.name), 3);
    return `${name} shows up across WAKILISHA through solo work, collaborations, and links with names like ${collaborators}.${discography ? ` ${discography}` : ""}`;
  }

  if (story === "sceneVoice") {
    if (discography) return `${name}${scene ? ` moves around ${scene}` : ""}. ${discography} Keep going for songs, releases, and related context.`;
    return `${name}${scene ? ` moves around ${scene}` : ""}. Start here for the songs, releases, and context we have so far.`;
  }

  return `${name} has a WAKILISHA profile ready for more context. Add songs, releases, credits, and artwork to make this page stronger.`;
}

function cardBlurb(facts: ArtistFacts): string {
  const name = facts.name || "Artist";
  if (facts.topTracks.length >= 2) return `${name} connects through songs like ${humanList(facts.topTracks.slice(0, 3), 3)}.`;
  if (facts.peakChartPosition) return `${name} has chart moments reaching #${facts.peakChartPosition}.`;
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 2);
  if (scene) return `${name} moves around ${scene}.`;
  return `${name} has a WAKILISHA profile ready for more context.`;
}

function searchSnippet(facts: ArtistFacts): string {
  if (facts.topTracks.length >= 2) {
    return `Find ${facts.name || "this artist"} songs like ${humanList(facts.topTracks.slice(0, 3), 3)} on WAKILISHA.`;
  }

  const bits = [facts.country, facts.genres[0], facts.chartEntryCount ? "chart context" : undefined].filter(Boolean);
  return bits.length > 0 ? `Artist connected to ${humanList(bits as string[], 3)}.` : "Artist profile on WAKILISHA.";
}

function seoDescription(facts: ArtistFacts): string {
  const name = facts.name || "this artist";

  if (facts.topTracks.length >= 3) {
    return `Explore ${name} on WAKILISHA, including ${humanList(facts.topTracks.slice(0, 5), 5)}, releases, credits, and related music context.`;
  }

  if (facts.topReleases.length > 0) {
    return `Explore ${name} on WAKILISHA, including releases like ${humanList(facts.topReleases.slice(0, 4), 4)}, songs, credits, and related music context.`;
  }

  return `Explore ${name} on WAKILISHA, with songs, releases, chart moments, genres, and related artists.`;
}

export function buildArtistContext(context: CultureRecipeContext<ArtistFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: cardBlurb(facts),
    searchSnippet: searchSnippet(facts),
    seoDescription: seoDescription(facts),
    chartNote: facts.peakChartPosition ? `${facts.name || "This artist"} has reached #${facts.peakChartPosition} on WAKILISHA charts.` : "No chart moment is connected yet.",
    whyItMatters: facts.topTracks.length > 0 ? `This artist page keeps songs like ${humanList(facts.topTracks.slice(0, 3), 3)}, releases, chart moments, and related artists together in one place.` : "This artist page keeps the songs, releases, chart moments, and related artists together in one place.",
    startHere: facts.topTracks.length > 0 ? `Start with ${humanList(facts.topTracks.slice(0, 3), 3)}, then follow the releases and chart moments around the artist.` : "Start with the most connected songs, then follow the releases and chart moments around the artist.",
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Artist context has the core fields needed for public use." : `Artist context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.name && (facts.genres.length > 0 || facts.country || facts.trackCount || facts.releaseCount || facts.topTracks.length > 0 || facts.topReleases.length > 0) ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `artist.${surface}.${selectArtistStory(facts)}`,
  };
}
