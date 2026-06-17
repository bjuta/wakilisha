import { humanList, pluralize, releaseTypeLabel, sentenceJoin } from "../formatters";
import { selectReleaseStory } from "../scoring";
import type { CultureRecipeContext, CultureRecipeResult, ReleaseFacts, ReleaseType } from "../types";

function releaseName(facts: ReleaseFacts): string {
  return facts.title || "This release";
}

function artistPhrase(facts: ReleaseFacts): string {
  const names = humanList(facts.artistNames, 4);
  return names ? ` by ${names}` : "";
}

function artistFromPhrase(facts: ReleaseFacts): string {
  const names = humanList(facts.artistNames, 2);
  return names ? ` from ${names}` : "";
}

function releaseDatePhrase(facts: ReleaseFacts): string {
  if (facts.releaseMonth && facts.releaseYear) return `${facts.releaseMonth} ${facts.releaseYear}`;
  return facts.releaseYear || "";
}

function releasedBit(facts: ReleaseFacts): string {
  const date = releaseDatePhrase(facts);
  return date ? `, released in ${date}` : "";
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

function scenePhrase(facts: ReleaseFacts): string {
  return humanList([facts.country, ...facts.genres].filter(Boolean) as string[], 3);
}

function standoutTrackPhrase(facts: ReleaseFacts): string {
  return humanList(facts.standoutTracks.map((track) => track.title), 3);
}

function chartSentence(facts: ReleaseFacts): string | undefined {
  if (!facts.chartEntryCount && !facts.topChartPeak) return undefined;
  const peak = facts.topChartPeak ? `peaking at #${facts.topChartPeak}` : "showing up on the charts";
  const count = facts.chartEntryCount ? `across ${pluralize(facts.chartEntryCount, "chart moment")}` : "";
  return sentenceJoin([`It is connected to WAKILISHA chart movement`, count || undefined, peak ? `, ${peak}.` : "."]);
}

function standoutSentence(facts: ReleaseFacts): string | undefined {
  const tracks = standoutTrackPhrase(facts);
  if (!tracks) return undefined;
  return `Start with ${tracks}, then follow the rest of the release.`;
}

function typeHeroIntro(facts: ReleaseFacts): string {
  const title = releaseName(facts);
  const artists = artistPhrase(facts);
  const released = releasedBit(facts);

  if (facts.releaseType === "album") {
    return `${title} is a ${trackPrefix(facts)}album${artists}${released}. Start here for the full world around this era.`;
  }

  if (facts.releaseType === "ep") {
    return `${title} is a focused ${trackPrefix(facts)}EP${artists}${released}. Short enough to enter quickly, strong enough to leave a trail.`;
  }

  if (facts.releaseType === "single") {
    return `${title} is a single${artists}${released}. One song, one moment, and a trail you can follow.`;
  }

  if (facts.releaseType === "compilation" || facts.isCompilation || facts.hasMultipleArtists) {
    return `${title} brings multiple voices into one release${released}. Use it to follow the artists, tracks, and scene links gathered here.`;
  }

  if (facts.releaseType === "mixtape") {
    return `${title} is a mixtape${artists}${released}. Looser, sharper, and built for the side of the sound that does not always wait for permission.`;
  }

  if (facts.releaseType === "live") {
    return `${title} is a live release${artists}${released}. Start here for the songs as they moved from studio version to room, stage, crowd, and moment.`;
  }

  if (facts.releaseType === "soundtrack") {
    return `${title} is a soundtrack${artists}${released}. It gathers music around a screen story, scene, or visual moment.`;
  }

  if (facts.releaseType === "deluxe") {
    return `${title} is a deluxe edition${artists}${released}. Same era, more room, extra tracks, and more ways into the project.`;
  }

  return `${title}${artists} is in WAKILISHA with the release details we have so far. More songs, credits, and context will be added as the archive grows.`;
}

function baseFactsUsed(facts: ReleaseFacts): string[] {
  return [
    facts.title ? "title" : "missing:title",
    facts.artistNames.length > 0 ? "artists" : "missing:artists",
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
  return sentenceJoin([
    typeHeroIntro(facts),
    chartSentence(facts),
    standoutSentence(facts),
  ]);
}

function cardBlurb(facts: ReleaseFacts): string {
  const byText = artistFromPhrase(facts);
  const trackText = trackPrefix(facts);

  if (facts.releaseType === "album") return `A ${trackText}album${byText}, with songs and context in one place.`;
  if (facts.releaseType === "ep") return `A focused ${trackText}EP${byText}.`;
  if (facts.releaseType === "single") return `A single${byText} with release context in WAKILISHA.`;
  if (facts.releaseType === "compilation" || facts.isCompilation || facts.hasMultipleArtists) return "A multi-artist release with several voices in one place.";
  if (facts.releaseType === "mixtape") return `A mixtape${byText} with loose cuts, scene energy, and tracks to follow.`;
  if (facts.releaseType === "live") return `A live release${byText}, built around performance, crowd, and moment.`;
  if (facts.releaseType === "soundtrack") return `A soundtrack${byText}, connecting songs to a screen story or visual moment.`;
  if (facts.releaseType === "deluxe") return `A deluxe edition${byText}, with extra tracks and more room inside the era.`;

  const type = releaseTypeLabel(facts.releaseType);
  return `${releaseName(facts)} is ${indefiniteType(type === "unknown" ? "unknown" : facts.releaseType)}${byText}.`;
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

function whyItMatters(facts: ReleaseFacts): string {
  if (facts.releaseType === "album") return "Albums give the artist more room to build a world. This page keeps the songs, credits, and chart context together.";
  if (facts.releaseType === "ep") return "EPs are often where artists test a sound, sharpen a mood, or give fans a quick chapter.";
  if (facts.releaseType === "single") return "Singles move fast. This page keeps the song connected to the artist, the release moment, and the charts around it.";
  if (facts.releaseType === "compilation" || facts.isCompilation || facts.hasMultipleArtists) return "Compilations show scenes, networks, and shared moments, not just one artist.";
  if (facts.releaseType === "mixtape") return "Mixtapes often catch the loose, raw, and experimental side of a sound before it gets polished.";
  if (facts.releaseType === "live") return "Live releases matter because they keep the room in the music. The crowd, the performance, and the moment all count.";
  if (facts.releaseType === "soundtrack") return "Soundtracks connect music to film, TV, and visual storytelling. They show how a song can carry a scene.";
  if (facts.releaseType === "deluxe") return "Deluxe editions stretch an era. They add extra tracks, new context, and more ways into the same project.";
  return "This page brings the release, tracks, artists, and context into one place so the moment is easier to follow.";
}

function startHere(facts: ReleaseFacts): string {
  const tracks = standoutTrackPhrase(facts);
  if (tracks) return `Start with ${tracks}, then follow the related artists and chart moments.`;

  if (facts.releaseType === "album") return "Start with the tracklist, then follow the chart moments and related artists around the era.";
  if (facts.releaseType === "ep") return "Start from track one. EPs are short enough to take in properly.";
  if (facts.releaseType === "single") return "Start with the song, then follow the artist page and chart links around it.";
  if (facts.releaseType === "compilation" || facts.isCompilation || facts.hasMultipleArtists) return "Start with the artists you know, then jump to the voices you do not.";
  if (facts.releaseType === "mixtape") return "Start with the loudest track, then follow the deeper cuts.";
  if (facts.releaseType === "live") return "Start with the performance moments, then compare them with the studio versions where available.";
  if (facts.releaseType === "soundtrack") return "Start with the songs you recognize, then follow the scenes and artists around them.";
  if (facts.releaseType === "deluxe") return "Start with the new or extra tracks, then loop back to the original project.";

  return "Start with the tracklist, then follow the chart moments, artists, and label links around the release.";
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
    confidence: facts.title && facts.artistNames.length > 0 ? "high" : "low",
    factsUsed: baseFactsUsed(facts),
    recipe: `release.${surface}.${selectReleaseStory(facts)}`,
  };
}
