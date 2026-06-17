import { humanList, releaseTypeLabel } from "../formatters";
import type { CultureRecipeContext, CultureRecipeResult, SearchResultFacts } from "../types";

function baseFactsUsed(facts: SearchResultFacts): string[] {
  return [
    facts.title ? "title" : "missing:title",
    facts.entityType ? "entityType" : "missing:entityType",
    facts.artists && facts.artists.length > 0 ? "artists" : "missing:artists",
    facts.genres.length > 0 ? "genres" : "missing:genres",
  ];
}

export function buildSearchContext(context: CultureRecipeContext<SearchResultFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const title = facts.title || "This result";
  const artists = humanList(facts.artists || [], 3);
  const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);
  const typeLabel = facts.releaseType ? releaseTypeLabel(facts.releaseType) : facts.entityType;

  const snippet = (() => {
    if (facts.entityType === "track" && artists) return `Track by ${artists}${facts.hasChartContext ? ", with chart context" : ""}.`;
    if (facts.entityType === "release") return `${typeLabel} ${artists ? `by ${artists}` : "on WAKILISHA"}.`;
    if (facts.entityType === "artist") return scene ? `Artist connected to ${scene}.` : "Artist profile on WAKILISHA.";
    if (facts.entityType === "label") return scene ? `Label connected to ${scene}.` : "Label profile on WAKILISHA.";
    if (facts.entityType === "genre") return `${title} is a sound path in WAKILISHA.`;
    return facts.subtitle || `${title} on WAKILISHA.`;
  })();

  const textBySurface = {
    heroIntro: snippet,
    cardBlurb: snippet,
    searchSnippet: snippet,
    seoDescription: `Find ${title} on WAKILISHA, with related artists, sounds, stories, releases, and chart context.`,
    chartNote: facts.hasChartContext ? `${title} has chart context connected in WAKILISHA.` : "No chart moment is connected yet.",
    whyItMatters: "Search context helps users understand why a result matched and where to go next.",
    startHere: `Open ${title}, then follow the related links around it.`,
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Search result context has the core fields needed for public use." : `Search result context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.title ? "medium" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `search.${surface}.${facts.entityType}`,
  };
}
