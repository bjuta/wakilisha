import { humanList, pluralize, releaseTypeLabel } from "../formatters";
import { selectTrackStory } from "../scoring";
import type { CultureRecipeContext, CultureRecipeResult, TrackFacts } from "../types";

function title(facts: TrackFacts): string {
  const rawTitle = facts.title || "This track";
  if (facts.featuredArtists.length === 0) return rawTitle;

  return rawTitle
    .replace(/\s*[\(\[]\s*(feat\.?|ft\.?|featuring)\s+[^\)\]]+[\)\]]\s*$/i, "")
    .trim() || rawTitle;
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
    facts.country ? "country" : undefined,
    facts.labelName ? "labelName" : undefined,
  ].filter(Boolean) as string[];
}

function ordinal(value: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = value % 100;
  return `${value}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
}

function releaseDatePhrase(facts: TrackFacts): string {
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

function releaseDescriptionSentence(facts: TrackFacts): string {
  if (!facts.releaseTitle) return "";

  const type = facts.releaseType && facts.releaseType !== "unknown"
    ? releaseTypeLabel(facts.releaseType)
    : "release";
  const date = releaseDatePhrase(facts);
  const dateBit = date ? `, released ${facts.releaseDate ? "on" : "in"} ${date}` : "";
  const labelBit = facts.labelName ? ` under ${facts.labelName}` : "";

  if (facts.trackNumber && facts.trackCount) {
    return `It appears as track ${facts.trackNumber} of ${facts.trackCount} on the ${type}${dateBit}${labelBit}.`;
  }

  if (facts.trackNumber) {
    return `It appears as track ${facts.trackNumber} on the ${type}${dateBit}${labelBit}.`;
  }

  if (facts.trackCount) {
    return `It appears on the ${facts.trackCount}-track ${type}${dateBit}${labelBit}.`;
  }

  return `It appears on the ${type}${dateBit}${labelBit}.`;
}

function formatReleaseContext(facts: TrackFacts): string {
  if (!facts.releaseTitle) return "";
  const typeLabel = facts.releaseType && facts.releaseType !== "unknown"
    ? `${releaseTypeLabel(facts.releaseType)} `
    : "";
  const yearPart = facts.releaseYear ? ` (${facts.releaseYear})` : "";
  const trackNum = facts.trackNumber ? `, track ${facts.trackNumber}` : "";
  const countPart = facts.trackCount && !facts.trackNumber
    ? `, ${pluralize(facts.trackCount, "track")}`
    : "";
  return `from ${typeLabel}${facts.releaseTitle}${yearPart}${trackNum}${countPart}`;
}

function factualReleaseTrackIntro(facts: TrackFacts): string {
  if (!facts.releaseTitle) return "";

  const trackTitle = title(facts);
  const artists = artistLine(facts);
  const byText = artists ? ` by ${artists}` : "";
  return `${trackTitle} is a track${byText} on ${facts.releaseTitle}. ${releaseDescriptionSentence(facts)}`;
}

function heroIntro(facts: TrackFacts): string {
  const trackTitle = title(facts);
  const artists = artistLine(facts);
  const byText = artists ? ` by ${artists}` : "";

  const hasChart = !!(facts.peakRank || facts.weeksOnChart);
  const hasRelease = !!facts.releaseTitle;
  const hasGenre = facts.genres.length > 0;
  const hasCollaboration = facts.primaryArtists.length + facts.featuredArtists.length > 1;
  const hasLabel = !!facts.labelName;

  // Release-linked tracks: structured release data is the context.
  if (hasRelease) {
    const factualIntro = factualReleaseTrackIntro(facts);
    if (factualIntro) return factualIntro;
  }

  // Rich: chart + genre, no release relationship
  if (hasChart && hasGenre) {
    const chartPart = facts.peakRank
      ? `peaked at #${facts.peakRank}`
      : `spent ${pluralize(facts.weeksOnChart!, "week")} charting`;
    const weeksPart = facts.peakRank && facts.weeksOnChart
      ? `, spending ${pluralize(facts.weeksOnChart, "week")} on the charts`
      : "";
    return `${trackTitle}${byText} ${chartPart}${weeksPart}. A ${humanList(facts.genres, 2)} track.`;
  }

  // Chart only
  if (hasChart) {
    const peak = facts.peakRank ? `peaked at #${facts.peakRank}` : "";
    const weeks = facts.weeksOnChart ? `, staying on the charts for ${pluralize(facts.weeksOnChart, "week")}` : "";
    const genreBit = hasGenre ? `${facts.peakRank || facts.weeksOnChart ? " —" : ""} a ${humanList(facts.genres, 2)} track` : "";
    return `${trackTitle}${byText} ${peak}${weeks}${genreBit}.`;
  }

  // Release context is handled first through factualReleaseTrackIntro.

  // Collaboration (no release, no chart)
  if (hasCollaboration) {
    if (facts.featuredArtists.length > 0) {
      return `${trackTitle} brings together ${humanList(facts.primaryArtists, 2)} and ${humanList(facts.featuredArtists, 3)}.`;
    }
    return `${trackTitle} is a collaboration between ${humanList([...facts.primaryArtists, ...facts.featuredArtists], 4)}.`;
  }

  // Genre context (no release, no chart, no collab)
  if (hasGenre) {
    const labelBit = hasLabel ? `, released on ${facts.labelName}` : "";
    return `${trackTitle}${byText} is a ${humanList(facts.genres, 2)} track${labelBit}.`;
  }

  // Thin — honest but useful
  const labelBit = hasLabel ? `, released on ${facts.labelName}` : "";
  return `${trackTitle}${byText} is in the WAKILISHA archive${labelBit}. We're still building out the full picture for this one.`;
}

function cardBlurb(facts: TrackFacts): string {
  if (facts.peakRank && facts.weeksOnChart) {
    return `Peaked at #${facts.peakRank} · ${pluralize(facts.weeksOnChart, "week")} charted`;
  }
  if (facts.peakRank) return `Peaked at #${facts.peakRank}`;
  if (facts.releaseTitle) {
    const typeLabel = facts.releaseType && facts.releaseType !== "unknown"
      ? `${releaseTypeLabel(facts.releaseType)} · `
      : "";
    return `${typeLabel}${facts.releaseTitle}`;
  }
  if (facts.genres.length > 0) return humanList(facts.genres, 2);
  return "";
}

function searchSnippet(facts: TrackFacts): string {
  const artists = artistLine(facts);
  const parts: string[] = [];
  if (artists) parts.push(artists);
  if (facts.releaseTitle) parts.push(facts.releaseTitle);
  if (facts.peakRank) parts.push(`#${facts.peakRank}`);
  if (facts.genres.length > 0) parts.push(humanList(facts.genres, 2));
  return parts.join(" · ");
}

function seoDescription(facts: TrackFacts): string {
  const artists = artistLine(facts);
  const byText = artists ? ` by ${artists}` : "";
  const genreBit = facts.genres.length > 0 ? `, a ${humanList(facts.genres, 2)} track` : "";
  const chartBit = facts.peakRank ? ` that peaked at #${facts.peakRank}` : "";
  const releaseBit = facts.releaseTitle
    ? facts.releaseYear
      ? ` from ${facts.releaseTitle} (${facts.releaseYear})`
      : ` from ${facts.releaseTitle}`
    : "";
  return `Explore ${title(facts)}${byText}${genreBit}${chartBit}${releaseBit} on WAKILISHA. Artist links, chart history, and related music.`;
}

function whyItMatters(facts: TrackFacts): string {
  const trackTitle = title(facts);
  const artists = artistLine(facts);
  const byText = artists ? ` by ${artists}` : "";
  const parts: string[] = [];

  if (facts.releaseTitle) {
    const typeLabel = facts.releaseType && facts.releaseType !== "unknown"
      ? releaseTypeLabel(facts.releaseType) + " "
      : "";
    const yearBit = facts.releaseYear ? ` (${facts.releaseYear})` : "";
    parts.push(`appears on ${typeLabel}${facts.releaseTitle}${yearBit}`);
  }

  if (facts.peakRank) {
    const weeksBit = facts.weeksOnChart
      ? ` over ${pluralize(facts.weeksOnChart, "week")}`
      : "";
    parts.push(`peaked at #${facts.peakRank}${weeksBit}`);
  } else if (facts.weeksOnChart) {
    parts.push(`spent ${pluralize(facts.weeksOnChart, "week")} charting`);
  }

  if (facts.genres.length > 0 && !facts.releaseTitle && !facts.peakRank) {
    parts.push(`sits in the ${humanList(facts.genres, 2)} space`);
  }

  if (facts.labelName && !facts.releaseTitle) {
    parts.push(`released on ${facts.labelName}`);
  }

  if (parts.length === 0) {
    return `${trackTitle}${byText} is in the WAKILISHA archive — we're connecting chart data, release links, and artist context as the platform grows.`;
  }

  return `${trackTitle}${byText} ${parts.join(", ")}.`;
}

export function buildTrackContext(context: CultureRecipeContext<TrackFacts>): CultureRecipeResult {
  const { facts, surface } = context;
  const textBySurface = {
    heroIntro: heroIntro(facts),
    cardBlurb: cardBlurb(facts),
    searchSnippet: searchSnippet(facts),
    seoDescription: seoDescription(facts),
    chartNote: facts.peakRank
      ? `${title(facts)} peaked at #${facts.peakRank}${facts.weeksOnChart ? `, spending ${pluralize(facts.weeksOnChart, "week")} on the charts` : ""}.`
      : facts.weeksOnChart
        ? `${title(facts)} has charted for ${pluralize(facts.weeksOnChart, "week")}.`
        : "No chart moment is connected yet.",
    whyItMatters: whyItMatters(facts),
    startHere: facts.releaseTitle
      ? `Start with ${title(facts)}, then explore ${facts.releaseTitle} and the artists behind it.`
      : `Start with ${title(facts)}, then explore the artists and related music.`,
    adminQualityNote: baseFactsUsed(facts).filter((f) => f.startsWith("missing:")).length === 0
      ? "Track context has the core fields needed for public use."
      : `Track context is missing ${humanList(baseFactsUsed(facts).filter((f) => f.startsWith("missing:")).map((f) => f.replace("missing:", "")), 5)}.`,
  } satisfies Record<typeof surface, string>;

  return {
    text: textBySurface[surface],
    confidence: facts.title && facts.primaryArtists.length > 0 ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `track.${surface}.${selectTrackStory(facts)}`,
  };
}