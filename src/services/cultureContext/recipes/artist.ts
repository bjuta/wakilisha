import { humanList, pluralize } from "../formatters";
import { selectArtistStory } from "../scoring";
import type { ArtistFacts, CultureRecipeContext, CultureRecipeResult } from "../types";

function baseFactsUsed(facts: ArtistFacts): string[] {
  return [
    facts.name ? "name" : "missing:name",
    facts.country ? "country" : "missing:country",
    facts.genres.length > 0 ? "genres" : "missing:genres",
    facts.releaseCount ? "releaseCount" : "missing:releaseCount",
    facts.chartEntryCount ? "chartEntryCount" : "missing:chartEntryCount",
  ];
}

function heroIntro(facts: ArtistFacts): string {
  const name = facts.name || "This artist";
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);
  const story = selectArtistStory(facts);

  if (story === "chartActor") {
    const peak = facts.peakChartPosition ? `, reaching #${facts.peakChartPosition}` : "";
    return `${name}${scene ? ` moves around ${scene}` : ""}, with chart moments connected in WAKILISHA${peak}.`;
  }

  if (story === "catalogBuilder") {
    const counts = humanList([
      facts.releaseCount ? pluralize(facts.releaseCount, "release") : "",
      facts.trackCount ? pluralize(facts.trackCount, "track") : "",
    ].filter(Boolean), 2);
    return `${name}${scene ? ` moves around ${scene}` : ""}, with ${counts} connected in WAKILISHA.`;
  }

  if (story === "collaborator") {
    const collaborators = humanList(facts.collaborations.map((item) => item.name), 3);
    return `${name} shows up across WAKILISHA through solo work, collaborations, and links with names like ${collaborators}.`;
  }

  if (story === "sceneVoice") {
    return `${name}${scene ? ` moves around ${scene}` : ""}. Start here for the songs, releases, and context we have so far.`;
  }

  return `${name} has a growing WAKILISHA profile. We have the basics now, with more songs, releases, and context still being added.`;
}

function cardBlurb(facts: ArtistFacts): string {
  const name = facts.name || "Artist";
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 2);
  if (facts.peakChartPosition) return `${name} has chart moments reaching #${facts.peakChartPosition}.`;
  if (scene) return `${name} moves around ${scene}.`;
  return `${name} has a growing WAKILISHA profile.`;
}

function searchSnippet(facts: ArtistFacts): string {
  const bits = [facts.country, facts.genres[0], facts.chartEntryCount ? "chart context" : undefined].filter(Boolean);
  return bits.length > 0 ? `Artist connected to ${humanList(bits as string[], 3)}.` : "Artist profile on WAKILISHA.";
}

export function buildArtistContext(context: CultureRecipeContext<ArtistFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: cardBlurb(facts),
    searchSnippet: searchSnippet(facts),
    seoDescription: `Explore ${facts.name || "this artist"} on WAKILISHA, with songs, releases, chart moments, genres, and related artists.`,
    chartNote: facts.peakChartPosition ? `${facts.name || "This artist"} has reached #${facts.peakChartPosition} on WAKILISHA charts.` : "No chart moment is connected yet.",
    whyItMatters: "This artist page keeps the songs, releases, chart moments, and related artists together in one place.",
    startHere: "Start with the most connected songs, then follow the releases and chart moments around the artist.",
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Artist context has the core fields needed for public use." : `Artist context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.name && (facts.genres.length > 0 || facts.country || facts.trackCount || facts.releaseCount) ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `artist.${surface}.${selectArtistStory(facts)}`,
  };
}
