import { humanList, pluralize, releaseTypeLabel, sentenceJoin } from "../formatters";
import { selectReleaseStory } from "../scoring";
import type { CultureRecipeContext, CultureRecipeResult, ReleaseFacts } from "../types";

function releaseName(facts: ReleaseFacts): string {
  return facts.title || "This release";
}

function artistPhrase(facts: ReleaseFacts): string {
  const names = humanList(facts.artistNames, 4);
  return names ? ` by ${names}` : "";
}

function yearPhrase(facts: ReleaseFacts): string {
  return facts.releaseYear ? `, released in ${facts.releaseYear}` : "";
}

function trackPhrase(facts: ReleaseFacts): string {
  return facts.trackCount ? pluralize(facts.trackCount, "track") : "tracks";
}

function baseFactsUsed(facts: ReleaseFacts): string[] {
  return [
    facts.title ? "title" : "missing:title",
    facts.artistNames.length > 0 ? "artists" : "missing:artists",
    facts.releaseType !== "unknown" ? "releaseType" : "missing:releaseType",
    facts.releaseYear ? "releaseYear" : "missing:releaseYear",
    facts.trackCount ? "trackCount" : "missing:trackCount",
  ];
}

function heroIntro(facts: ReleaseFacts): string {
  const title = releaseName(facts);
  const artists = artistPhrase(facts);
  const year = yearPhrase(facts);
  const story = selectReleaseStory(facts);

  if (story === "chartRelease") {
    const peak = facts.topChartPeak ? `, with a chart peak at #${facts.topChartPeak}` : "";
    return sentenceJoin([
      `${title} is ${releaseTypeLabel(facts.releaseType) === "EP" ? "an EP" : `a ${releaseTypeLabel(facts.releaseType)}`}${artists}${year}${peak}.`,
      "Start here for the songs, chart moments, and release context around it.",
    ]);
  }

  if (story === "standoutTracks") {
    const tracks = humanList(facts.standoutTracks.map((track) => track.title), 3);
    return `${title}${artists}${year} has ${trackPhrase(facts)} connected in WAKILISHA. Start with ${tracks}, then follow the rest of the release.`;
  }

  if (story === "fullProject") {
    return `${title} is a ${trackPhrase(facts)} album${artists}${year}. Start here for the songs, chart moments, and release context around this era.`;
  }

  if (story === "focusedProject") {
    return `${title} is a focused ${trackPhrase(facts)} EP${artists}${year}. Short, direct, and a good place to hear where the sound is heading.`;
  }

  if (story === "singleMoment") {
    return `${title} is a single${artists}${year}. One song, one moment, and enough context to follow where it landed.`;
  }

  if (story === "manyVoices") {
    return `${title} brings multiple voices into one release${year}. Start here for the artists, tracks, and connections around it.`;
  }

  if (story === "sceneRelease") {
    const scene = humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);
    return `${title}${artists}${year} sits around ${scene || "this sound"}. Start here for the release context WAKILISHA has so far.`;
  }

  return `${title}${artists} is in WAKILISHA with the release details we have so far. More songs, credits, and context will be added as the archive grows.`;
}

function cardBlurb(facts: ReleaseFacts): string {
  const title = releaseName(facts);
  const artists = humanList(facts.artistNames, 2);
  const type = releaseTypeLabel(facts.releaseType);
  const trackText = facts.trackCount ? `${facts.trackCount}-track ` : "";
  const byText = artists ? ` from ${artists}` : "";

  if (facts.releaseType === "single") return `A single${byText} with release context in WAKILISHA.`;
  if (facts.releaseType === "ep") return `A focused ${trackText}EP${byText}.`;
  if (facts.releaseType === "album") return `A ${trackText}album${byText}, with songs and context in one place.`;
  if (facts.isCompilation) return `A multi-artist release with several voices in one place.`;
  return `${title} is a ${type}${byText}.`;
}

function searchSnippet(facts: ReleaseFacts): string {
  const artists = humanList(facts.artistNames, 3);
  const type = releaseTypeLabel(facts.releaseType);
  const prefix = artists ? `${type} by ${artists}` : type;
  const details = [facts.trackCount ? pluralize(facts.trackCount, "track") : undefined, facts.releaseYear, facts.chartEntryCount ? "chart context" : undefined].filter(Boolean);
  return details.length > 0 ? `${prefix}. Includes ${humanList(details as string[], 3)}.` : `${prefix}.`;
}

function seoDescription(facts: ReleaseFacts): string {
  const artists = humanList(facts.artistNames, 3);
  const byText = artists ? ` by ${artists}` : "";
  return `Explore ${releaseName(facts)}${byText} on WAKILISHA, with tracks, release details, chart moments, genres, and related artists.`;
}

function whyItMatters(facts: ReleaseFacts): string {
  if (facts.releaseType === "single") return "Singles move fast. This page keeps the song connected to the artist, the release moment, and the charts around it.";
  if (facts.releaseType === "ep") return "EPs are often where artists test a sound, sharpen a mood, or give fans a quick chapter.";
  if (facts.releaseType === "album") return "Albums give the artist more room to build a world. This page keeps the songs, credits, and chart context together.";
  if (facts.isCompilation) return "Compilations show scenes, networks, and shared moments, not just one artist.";
  return "This page brings the release, tracks, artists, and context into one place so the moment is easier to follow.";
}

function startHere(facts: ReleaseFacts): string {
  if (facts.standoutTracks.length > 0) {
    return `Start with ${humanList(facts.standoutTracks.map((track) => track.title), 3)}, then follow the related artists and chart moments.`;
  }
  if (facts.releaseType === "single") return "Start with the song, then follow the artist page and chart links around it.";
  return "Start with the tracklist, then follow the chart moments, artists, and label links around the release.";
}

function adminQualityNote(facts: ReleaseFacts): string {
  const missing = baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", ""));
  if (missing.length === 0) return "Release context has the core fields needed for public use.";
  return `Release context is missing ${humanList(missing, 5)}. Add these before featuring it heavily.`;
}

export function buildReleaseContext(context: CultureRecipeContext<ReleaseFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: cardBlurb(facts),
    searchSnippet: searchSnippet(facts),
    seoDescription: seoDescription(facts),
    chartNote: facts.chartEntryCount ? `${releaseName(facts)} has ${pluralize(facts.chartEntryCount, "chart moment")} connected in WAKILISHA.` : "No chart moments are connected yet.",
    whyItMatters: whyItMatters(facts),
    startHere: startHere(facts),
    adminQualityNote: adminQualityNote(facts),
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.title && facts.artistNames.length > 0 ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `release.${surface}.${selectReleaseStory(facts)}`,
  };
}
