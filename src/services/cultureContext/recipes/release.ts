import { humanList, pluralize, releaseTypeLabel, sentenceJoin } from "../formatters";
import { selectReleaseStory } from "../scoring";
import type { CultureRecipeContext, CultureRecipeResult, ReleaseFacts, ReleaseType } from "../types";

function releaseName(facts: ReleaseFacts): string {
  return facts.title || "This release";
}

function artistPhrase(facts: ReleaseFacts): string {
  const primaryArtists = Array.isArray(facts.artistNames) ? facts.artistNames : [];
  const featuredArtists = Array.isArray(facts.featuredArtistNames) ? facts.featuredArtistNames : [];
  const primary = humanList(primaryArtists, 4);
  const featured = humanList(featuredArtists, 4);

  const featuredCredit = featuredArtists.length === 1
    ? `with a featured appearance from ${featured}`
    : `with featured appearances from ${featured}`;

  if (primary && featured) return ` by ${primary}, ${featuredCredit}`;
  if (primary) return ` by ${primary}`;
  if (featured) return ` ${featuredCredit}`;
  return "";
}

function artistFromPhrase(facts: ReleaseFacts): string {
  const primaryArtists = Array.isArray(facts.artistNames) ? facts.artistNames : [];
  const featuredArtists = Array.isArray(facts.featuredArtistNames) ? facts.featuredArtistNames : [];
  const primary = humanList(primaryArtists, 2);
  const featured = humanList(featuredArtists, 3);

  if (primary && featured) return ` from ${primary}, featuring ${featured}`;
  if (primary) return ` from ${primary}`;
  if (featured) return ` featuring ${featured}`;
  return "";
}

function releaseDatePhrase(facts: ReleaseFacts): string {
  if (facts.releaseDate) {
    const parsed = new Date(facts.releaseDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
    return facts.releaseDate;
  }

  if (facts.releaseMonth && facts.releaseYear) return `${facts.releaseMonth} ${facts.releaseYear}`;
  return facts.releaseYear || "";
}

function releaseDatePreposition(facts: ReleaseFacts): "on" | "in" {
  return facts.releaseDate ? "on" : "in";
}

function releasedBit(facts: ReleaseFacts): string {
  const date = releaseDatePhrase(facts);
  return date ? `, released ${releaseDatePreposition(facts)} ${date}` : "";
}

function trackPhrase(facts: ReleaseFacts): string {
  return facts.trackCount ? pluralize(facts.trackCount, "track") : "tracks";
}

function trackPrefix(facts: ReleaseFacts): string {
  return facts.trackCount ? `${facts.trackCount}-track ` : "";
}

function indefiniteType(type: ReleaseType): string {
  if (type === "ep") return "an EP";
  if (type === "album") return "an album";
  if (type === "single") return "a single";
  if (type === "mixtape") return "a mixtape";
  if (type === "compilation") return "a compilation";
  if (type === "soundtrack") return "a soundtrack";
  if (type === "live") return "a live release";
  if (type === "deluxe") return "a deluxe edition";
  return "a release";
}

function standoutTrackPhrase(facts: ReleaseFacts): string {
  return humanList(facts.standoutTracks.map((track) => track.title), 3);
}

function chartSentence(facts: ReleaseFacts): string | undefined {
  if (!facts.chartEntryCount && !facts.topChartPeak) return undefined;

  const count = facts.chartEntryCount ? ` across ${pluralize(facts.chartEntryCount, "chart moment")}` : "";
  const peak = facts.topChartPeak ? `, peaking at #${facts.topChartPeak}` : "";
  return `It is connected to WAKILISHA chart movement${count}${peak}.`;
}

function standoutSentence(facts: ReleaseFacts): string | undefined {
  const tracks = standoutTrackPhrase(facts);
  if (!tracks) return undefined;
  return `Start with ${tracks}, then follow the rest of the release.`;
}

function typeHeroIntro(facts: ReleaseFacts): string {
  const title = releaseName(facts);
  const artists = artistPhrase(facts);
  const type = releaseTypeLabel(facts.releaseType);
  const trackText = facts.trackCount ? `${facts.trackCount}-track ` : "";
  const released = releasedBit(facts);
  const label = facts.labelName ? ` under ${facts.labelName}` : "";

  if (facts.releaseType === "unknown") {
    return `${title}${artists} is a release on WAKILISHA${released}${label}.`;
  }

  return `${title} is a ${trackText}${type}${artists}${released}${label}.`;
}

function baseFactsUsed(facts: ReleaseFacts): string[] {
  return [
    facts.title ? "title" : "missing:title",
    (Array.isArray(facts.artistNames) && facts.artistNames.length > 0) ? "primaryArtists" : "missing:primaryArtists",
    (Array.isArray(facts.featuredArtistNames) && facts.featuredArtistNames.length > 0) ? "featuredArtists" : "",
    (Array.isArray(facts.artistNames) && facts.artistNames.length > 1) ? "multiPrimaryArtists" : "",
    facts.releaseType !== "unknown" ? "releaseType" : "missing:releaseType",
    facts.releaseYear ? "releaseYear" : "missing:releaseYear",
    facts.trackCount ? "trackCount" : "missing:trackCount",
    facts.releaseType === "mixtape" ? "releaseType:mixtape" : "",
    facts.releaseType === "live" ? "releaseType:live" : "",
    facts.releaseType === "soundtrack" ? "releaseType:soundtrack" : "",
    facts.releaseType === "deluxe" ? "releaseType:deluxe" : "",
  ].filter(Boolean);
}

function heroIntro(facts: ReleaseFacts): string {
  return typeHeroIntro(facts);
}

function cardBlurb(facts: ReleaseFacts): string {
  const byText = artistFromPhrase(facts);
  const trackText = trackPrefix(facts);

  if (facts.releaseType === "album") return `A ${trackText}album${byText}, with songs and context in one place.`;
  if (facts.releaseType === "ep") return `A focused ${trackText}EP${byText}${facts.labelName ? ` on ${facts.labelName}` : ""}.`;
  if (facts.releaseType === "single") {
    const date = releaseDatePhrase(facts);
    const dateBit = date ? ` (${date})` : "";
    return `A single${byText}${dateBit}. One song, one moment, and a trail you can follow.`;
  }
  if (facts.releaseType === "compilation" || facts.isCompilation || facts.hasMultipleArtists) return "A multi-artist release with several voices in one place.";
  if (facts.releaseType === "mixtape") return `A mixtape${byText} with loose cuts, scene energy, and tracks to follow.`;
  if (facts.releaseType === "live") return `A live release${byText}, built around performance, crowd, and moment.`;
  if (facts.releaseType === "soundtrack") return `A soundtrack${byText}, connecting songs to a screen story or visual moment.`;
  if (facts.releaseType === "deluxe") return `A deluxe edition${byText}, with extra tracks and more room inside the era.`;

  return `${releaseName(facts)} is ${indefiniteType(facts.releaseType)}${byText}.`;
}

function searchSnippet(facts: ReleaseFacts): string {
  const artists = humanList(facts.artistNames, 3);
  const type = releaseTypeLabel(facts.releaseType);
  const prefix = artists ? `${type} by ${artists}` : type;
  const details = [
    facts.trackCount ? pluralize(facts.trackCount, "track") : undefined,
    releaseDatePhrase(facts),
    facts.chartEntryCount ? "chart context" : undefined,
  ].filter(Boolean);
  return details.length > 0 ? `${prefix}. Includes ${humanList(details as string[], 3)}.` : `${prefix}.`;
}

function seoDescription(facts: ReleaseFacts): string {
  const artists = humanList(facts.artistNames, 3);
  const byText = artists ? ` by ${artists}` : "";
  const type = releaseTypeLabel(facts.releaseType);
  return `Explore ${releaseName(facts)}${byText} on WAKILISHA, with ${type} details, tracks, chart moments, genres, and related artists.`;
}

function releaseNounPhrase(facts: ReleaseFacts): string {
  const type = releaseTypeLabel(facts.releaseType);
  if (facts.trackCount) return `a ${facts.trackCount}-track ${type}`;
  return indefiniteType(facts.releaseType);
}

function releaseFactSentence(facts: ReleaseFacts): string | undefined {
  const date = releaseDatePhrase(facts);
  const label = facts.labelName ? ` under ${facts.labelName}` : "";

  if (date) return `It was released ${releaseDatePreposition(facts)} ${date}${label}.`;
  if (label) return `It was released${label}.`;
  return undefined;
}

function tracklistFactSentence(facts: ReleaseFacts): string | undefined {
  if (facts.releaseType === "single") return undefined;

  const tracks = standoutTrackPhrase(facts);
  if (!tracks) return undefined;

  return `The tracklist includes ${tracks}.`;
}

function whyItMatters(facts: ReleaseFacts): string {
  const title = releaseName(facts);
  const artists = artistPhrase(facts);
  const base = `${title} is ${releaseNounPhrase(facts)}${artists}.`;

  return sentenceJoin([
    base,
    releaseFactSentence(facts),
    chartSentence(facts),
    tracklistFactSentence(facts),
  ]);
}


function startHere(facts: ReleaseFacts): string {
  const tracks = standoutTrackPhrase(facts);
  if (tracks) return `The tracklist includes ${tracks}.`;

  if (facts.releaseType === "single") return "This release is centered on its title track.";
  if (facts.trackCount) return `This release has ${pluralize(facts.trackCount, "track")}.`;

  return "Tracklist, artist, label, and chart details are collected on this page.";
}


function chartNote(facts: ReleaseFacts): string {
  if (!facts.chartEntryCount && !facts.topChartPeak) return "No chart moments are connected yet.";
  const title = releaseName(facts);
  const peak = facts.topChartPeak ? ` Its highest connected peak is #${facts.topChartPeak}.` : "";
  return `${title} has ${facts.chartEntryCount ? pluralize(facts.chartEntryCount, "chart moment") : "chart movement"} connected in WAKILISHA.${peak}`;
}

function adminQualityNote(facts: ReleaseFacts): string {
  const missing = baseFactsUsed(facts).filter((fact) => fact.startsWith("missing:")).map((fact) => fact.replace("missing:", ""));
  if (missing.length === 0) return `Release context has the core fields needed for public ${releaseTypeLabel(facts.releaseType)} copy.`;
  return `Release context is missing ${humanList(missing, 5)}. Add these before featuring it heavily.`;
}

export function buildReleaseContext(context: CultureRecipeContext<ReleaseFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: cardBlurb(facts),
    searchSnippet: searchSnippet(facts),
    seoDescription: seoDescription(facts),
    chartNote: chartNote(facts),
    whyItMatters: whyItMatters(facts),
    startHere: startHere(facts),
    adminQualityNote: adminQualityNote(facts),
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.title && (
      (Array.isArray(facts.artistNames) && facts.artistNames.length > 0) ||
      (Array.isArray(facts.featuredArtistNames) && facts.featuredArtistNames.length > 0)
    ) ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `release.${surface}.${selectReleaseStory(facts)}`,
  };
}
