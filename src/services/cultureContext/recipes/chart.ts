import { humanList, pluralize } from "../formatters";
import type { ChartFacts, CultureRecipeContext, CultureRecipeResult } from "../types";

function baseFactsUsed(facts: ChartFacts): string[] {
  return [
    facts.title ? "title" : "missing:title",
    facts.numberOne ? "numberOne" : "missing:numberOne",
    facts.totalEntries ? "totalEntries" : "missing:totalEntries",
    facts.newEntries ? "newEntries" : "missing:newEntries",
  ];
}

export function buildChartContext(context: CultureRecipeContext<ChartFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const title = facts.title || "This chart";
  const numberOneArtists = humanList(facts.numberOneArtists, 3);
  const climbers = humanList(facts.biggestClimbers, 3);
  const runners = humanList(facts.longestRunners, 3);
  const leader = facts.numberOne ? `${facts.numberOne}${numberOneArtists ? ` by ${numberOneArtists}` : ""}` : "the song at #1";

  const recap = facts.newEntries
    ? `${title} has ${pluralize(facts.newEntries, "new entry")} this period, with ${leader} leading the way.`
    : `${title} is led by ${leader}.`;

  const textBySurface = {
    heroIntro: facts.periodLabel ? `${recap} This view covers ${facts.periodLabel}.` : recap,
    cardBlurb: `${leader} leads ${title}.`,
    searchSnippet: facts.totalEntries ? `${title} with ${pluralize(facts.totalEntries, "ranked song")}.` : `${title} chart on WAKILISHA.`,
    seoDescription: `Explore ${title} on WAKILISHA, with rankings, new entries, chart movement, artists, and related tracks.`,
    chartNote: climbers ? `Watch the movers this time: ${climbers}.` : recap,
    whyItMatters: runners ? `The long runners matter too. ${runners} are still holding space.` : "Charts help show what is moving, what is holding, and what just entered the conversation.",
    startHere: `Start at #1 with ${leader}, then check the new entries and biggest climbers.`,
    adminQualityNote: baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).length === 0 ? "Chart context has the core fields needed for public use." : `Chart context is missing ${humanList(baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.title && facts.numberOne ? "high" : "medium",
    factsUsed: baseFactsUsed(facts),
    recipe: `chart.${surface}`,
  };
}
