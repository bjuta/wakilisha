import { humanList, pluralize } from "../formatters";
import { selectLabelStory } from "../scoring";
import type { CultureRecipeContext, CultureRecipeResult, LabelFacts } from "../types";

function baseFactsUsed(facts: LabelFacts): string[] {
  return [
    facts.name ? "name" : "missing:name",
    facts.country ? "country" : "missing:country",
    facts.artistCount ? "artistCount" : "missing:artistCount",
    facts.releaseCount ? "releaseCount" : "missing:releaseCount",
    facts.chartEntryCount ? "chartEntryCount" : "missing:chartEntryCount",
  ];
}

function heroIntro(facts: LabelFacts): string {
  const name = facts.name || "This label";
  const story = selectLabelStory(facts);
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);

  if (story === "chartHome") return `${name}${scene ? ` sits around ${scene}` : ""}, with artists, releases, and chart moments connected in WAKILISHA.`;
  if (story === "rosterHome") return `${name} is one of the homes behind the sound, with ${pluralize(facts.artistCount || 0, "artist")} connected in WAKILISHA.`;
  if (story === "releaseEngine") return `${name} carries ${pluralize(facts.releaseCount || 0, "release")} in WAKILISHA, with artists and tracks to follow from there.`;
  if (story === "sceneBuilder") return `${name}${scene ? ` connects to ${scene}` : ""}. Start here for the artists, releases, and sound around it.`;
  return `${name} has a growing WAKILISHA profile. More artists, releases, and context will be added as the archive grows.`;
}

function searchSnippet(facts: LabelFacts): string {
  const name = facts.name || "This label";
  const topArtists = humanList(facts.topArtists, 3);
  const counts = humanList([
    facts.artistCount ? pluralize(facts.artistCount, "artist") : "",
    facts.releaseCount ? pluralize(facts.releaseCount, "release") : "",
    facts.chartEntryCount ? pluralize(facts.chartEntryCount, "chart moment") : "",
  ].filter(Boolean), 3);
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);

  if (topArtists) return `${name} connects to artists like ${topArtists}.`;
  if (counts && scene) return `${name} connects ${counts} around ${scene}.`;
  if (counts) return `${name} connects ${counts} in WAKILISHA.`;
  if (scene) return `${name} is connected to ${scene}.`;
  return `${name} has a growing WAKILISHA profile.`;
}

export function buildLabelContext(context: CultureRecipeContext<LabelFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const topArtists = humanList(facts.topArtists, 3);
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: facts.artistCount ? `${facts.name || "This label"} connects ${pluralize(facts.artistCount, "artist")} in WAKILISHA.` : `${facts.name || "This label"} has a growing WAKILISHA profile.`,
    searchSnippet: searchSnippet(facts),
    seoDescription: `Explore ${facts.name || "this label"} on WAKILISHA, with artists, releases, chart moments, genres, and related music.`,
    chartNote: facts.chartEntryCount ? `${facts.name || "This label"} has ${pluralize(facts.chartEntryCount, "chart moment")} connected in WAKILISHA.` : "No chart moment is connected yet.",
    whyItMatters: "Label pages help show the teams, collectives, and companies behind the sound.",
    startHere: topArtists ? `Start with ${topArtists}, then follow the releases around them.` : "Start with the artists, then follow the releases and songs around the label.",
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Label context has the core fields needed for public use." : `Label context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.name && (facts.artistCount || facts.releaseCount || facts.genres.length > 0) ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `label.${surface}.${selectLabelStory(facts)}`,
  };
}
