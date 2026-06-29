import type {
  PublicArtistDetail,
  RegistryAppearsOnRelease,
} from "@/services/publicContent/client";
import type {
  QuestionSpine,
  QuestionSpineConfidence,
  QuestionSpineEvidence,
  QuestionSpineNextQuestion,
  QuestionSpineOpenQuestion,
  QuestionSpineRelationship,
  QuestionSpineStatus,
} from "./questionTypes";
import {
  cleanText,
  clampText,
  hasText,
  humanCount,
  joinHumanList,
  sentenceFromParts,
  uniqueClean,
} from "./questionCopy";

export interface ArtistQuestionSpineInput {
  artist: PublicArtistDetail;
  appearsOn?: RegistryAppearsOnRelease[];
  registeredGenres?: string[];
}

function evidence(
  item: Omit<QuestionSpineEvidence, "confidence" | "source" | "weight"> & {
    confidence?: QuestionSpineConfidence;
    source?: QuestionSpineEvidence["source"];
    weight?: number;
  },
): QuestionSpineEvidence {
  return {
    confidence: item.confidence || "medium",
    source: item.source || "page-data",
    weight: item.weight || 1,
    ...item,
  };
}

function relationship(
  item: Omit<QuestionSpineRelationship, "strength"> & {
    strength?: QuestionSpineConfidence;
  },
): QuestionSpineRelationship {
  return {
    strength: item.strength || "medium",
    ...item,
  };
}

function resolveStatus(evidenceItems: QuestionSpineEvidence[]): QuestionSpineStatus {
  const totalWeight = evidenceItems.reduce((sum, item) => sum + item.weight, 0);
  const hasMissingContextOnly =
    evidenceItems.length > 0 && evidenceItems.every((item) => item.kind === "missing_context");

  if (hasMissingContextOnly) return "thin";
  if (totalWeight >= 7) return "clear";
  if (totalWeight >= 3) return "emerging";

  return "thin";
}

function resolveConfidence(status: QuestionSpineStatus): QuestionSpineConfidence {
  if (status === "clear") return "high";
  if (status === "emerging") return "medium";

  return "low";
}

function buildEvidence(input: ArtistQuestionSpineInput): QuestionSpineEvidence[] {
  const { artist } = input;
  const appearsOn = input.appearsOn || [];
  const genreNames = uniqueClean([...(input.registeredGenres || []), ...(artist.genres || [])]);
  const bio = cleanText(artist.fullBio || artist.bio);
  const releaseCount = artist.releases?.length || artist.releaseCount || 0;
  const trackCount = artist.trackCount || 0;
  const chartCount = artist.chartEntries?.length || 0;
  const topSongCount = artist.topSongs?.length || 0;
  const relatedCount = artist.relatedArtists?.length || 0;
  const videoCount = artist.videos?.length || 0;
  const output: QuestionSpineEvidence[] = [];

  if (hasText(bio)) {
    output.push(
      evidence({
        id: "artist-bio",
        kind: "bio",
        label: "Artist context",
        detail: clampText(bio, 180),
        confidence: "high",
        weight: 2,
      }),
    );
  }

  if (releaseCount > 0) {
    output.push(
      evidence({
        id: "artist-releases",
        kind: "release_count",
        label: "Catalog shape",
        detail: `${artist.name} has ${humanCount(releaseCount, "release")} on this page.`,
        value: releaseCount,
        confidence: "high",
        weight: 1.5,
      }),
    );
  }

  if (trackCount > 0) {
    output.push(
      evidence({
        id: "artist-tracks",
        kind: "track_count",
        label: "Track record",
        detail: `${artist.name} has ${humanCount(trackCount, "track")} connected to this page.`,
        value: trackCount,
        confidence: "medium",
        weight: 1,
      }),
    );
  }

  if (chartCount > 0) {
    output.push(
      evidence({
        id: "artist-chart",
        kind: "chart",
        label: "Chart signal",
        detail: `${artist.name} appears in ${humanCount(chartCount, "chart entry", "chart entries")}.`,
        value: chartCount,
        confidence: "high",
        weight: 1.5,
      }),
    );
  }

  if (topSongCount > 0) {
    output.push(
      evidence({
        id: "artist-top-songs",
        kind: "catalog",
        label: "Known songs",
        detail: `${artist.name} has ${humanCount(topSongCount, "top song")} surfaced here.`,
        value: topSongCount,
        confidence: "medium",
        weight: 1,
      }),
    );
  }

  if (genreNames.length > 0) {
    output.push(
      evidence({
        id: "artist-genres",
        kind: "genre",
        label: "Scene language",
        detail: `${artist.name} is connected to ${joinHumanList(genreNames)}.`,
        value: genreNames.length,
        confidence: "medium",
        weight: 1,
      }),
    );
  }

  if (hasText(artist.country)) {
    output.push(
      evidence({
        id: "artist-country",
        kind: "place",
        label: "Place signal",
        detail: `${artist.name} is connected to ${artist.country}.`,
        value: artist.country,
        confidence: "medium",
        weight: 0.75,
      }),
    );
  }

  if (appearsOn.length > 0) {
    output.push(
      evidence({
        id: "artist-appearances",
        kind: "collaboration",
        label: "Appearances",
        detail: `${artist.name} appears on ${humanCount(appearsOn.length, "release")} led by other artists.`,
        value: appearsOn.length,
        confidence: "medium",
        weight: 1,
      }),
    );
  }

  if (relatedCount > 0) {
    output.push(
      evidence({
        id: "artist-related",
        kind: "related_artist",
        label: "Adjacent artists",
        detail: `${artist.name} has ${humanCount(relatedCount, "related artist")} surfaced by WAKILISHA.`,
        value: relatedCount,
        confidence: "medium",
        source: "inference",
        weight: 1,
      }),
    );
  }

  if (videoCount > 0) {
    output.push(
      evidence({
        id: "artist-videos",
        kind: "media",
        label: "Visual record",
        detail: `${artist.name} has ${humanCount(videoCount, "video")} connected to this page.`,
        value: videoCount,
        confidence: "medium",
        weight: 0.75,
      }),
    );
  }

  if (output.length === 0) {
    output.push(
      evidence({
        id: "artist-thin-context",
        kind: "missing_context",
        label: "Thin context",
        detail: `WAKILISHA does not yet have enough public context to explain ${artist.name} clearly.`,
        confidence: "low",
        source: "inference",
        weight: 0.5,
      }),
    );
  }

  return output;
}

function buildRelationships(input: ArtistQuestionSpineInput): QuestionSpineRelationship[] {
  const { artist } = input;
  const appearsOn = input.appearsOn || [];
  const genreNames = uniqueClean([...(input.registeredGenres || []), ...(artist.genres || [])]);
  const relatedArtists = artist.relatedArtists || [];
  const relationships: QuestionSpineRelationship[] = [];

  genreNames.slice(0, 4).forEach((genre) => {
    relationships.push(
      relationship({
        id: `scene-${genre.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        kind: "scene",
        label: genre,
        detail: `${genre} helps explain one of the scenes around ${artist.name}.`,
      }),
    );
  });

  if (hasText(artist.country)) {
    relationships.push(
      relationship({
        id: "place-country",
        kind: "place",
        label: artist.country,
        detail: `${artist.country} is one of the place signals attached to ${artist.name}.`,
      }),
    );
  }

  if ((artist.releases?.length || artist.releaseCount || 0) > 0) {
    relationships.push(
      relationship({
        id: "catalog-releases",
        kind: "catalog",
        label: "Catalog",
        detail: `${artist.name}'s releases give WAKILISHA a path into the work, not just the profile.`,
        strength: "high",
      }),
    );
  }

  if ((artist.chartEntries || []).length > 0) {
    relationships.push(
      relationship({
        id: "chart-signal",
        kind: "chart",
        label: "Charts",
        detail: `The chart data shows where ${artist.name} has been visible in ranked music moments.`,
        strength: "high",
      }),
    );
  }

  if (appearsOn.length > 0) {
    relationships.push(
      relationship({
        id: "collaboration-appearances",
        kind: "collaboration",
        label: "Features and appearances",
        detail: `${artist.name}'s appearances show how the artist moves through other catalogs.`,
      }),
    );
  }

  relatedArtists.slice(0, 5).forEach((relatedArtist) => {
    relationships.push(
      relationship({
        id: `adjacent-${relatedArtist.slug}`,
        kind: "adjacent_artist",
        label: relatedArtist.name,
        detail: `${relatedArtist.name} appears close to ${artist.name} in the WAKILISHA relationship graph.`,
        entitySlug: relatedArtist.slug,
        strength: relatedArtist.score && relatedArtist.score >= 0.75 ? "high" : "medium",
      }),
    );
  });

  return relationships;
}

function buildShortAnswer(
  artist: PublicArtistDetail,
  evidenceItems: QuestionSpineEvidence[],
): string {
  const hasChartSignal = evidenceItems.some((item) => item.kind === "chart");
  const hasCatalogSignal = evidenceItems.some(
    (item) => item.kind === "release_count" || item.kind === "track_count" || item.kind === "catalog",
  );
  const hasSceneSignal = evidenceItems.some((item) => item.kind === "genre");
  const hasPlaceSignal = evidenceItems.some((item) => item.kind === "place");

  if (!hasCatalogSignal && !hasChartSignal && !hasSceneSignal && !hasPlaceSignal) {
    return `WAKILISHA does not yet have enough public context to explain ${artist.name} properly. The useful answer begins by saying what is still missing.`;
  }

  return sentenceFromParts([
    `${artist.name} is best read through`,
    hasCatalogSignal ? "the work already connected to the page," : null,
    hasChartSignal ? "the chart moments that show public movement," : null,
    hasSceneSignal ? "the scene language attached to the artist," : null,
    hasPlaceSignal ? "and the place signal in the record" : null,
  ]).replace(", and and", ", and");
}

function buildNextQuestions(input: ArtistQuestionSpineInput): QuestionSpineNextQuestion[] {
  const { artist } = input;
  const hasRelatedArtists = (artist.relatedArtists || []).length > 0;
  const hasChartEntries = (artist.chartEntries || []).length > 0;
  const hasReleases = (artist.releases || []).length > 0;
  const questions: QuestionSpineNextQuestion[] = [
    {
      id: "songs-that-explain",
      question: `Which songs best explain ${artist.name}?`,
      reason: "The next useful path is usually through the work itself.",
      priority: "primary",
    },
  ];

  if (hasRelatedArtists) {
    questions.push({
      id: "people-around-artist",
      question: `Who keeps appearing around ${artist.name}?`,
      reason: "Relationships turn a profile into cultural context.",
      priority: "primary",
    });
  }

  if (hasChartEntries) {
    questions.push({
      id: "chart-moments",
      question: `What made ${artist.name}'s chart moments travel?`,
      reason: "Charts are useful when they help explain movement, not just rank.",
      priority: "secondary",
    });
  }

  if (hasReleases) {
    questions.push({
      id: "catalog-path",
      question: `Where should a new listener start with ${artist.name}?`,
      reason: "A clear entry point turns catalog data into understanding.",
      priority: "secondary",
    });
  }

  questions.push({
    id: "missing-context",
    question: `What context is still missing around ${artist.name}?`,
    reason: "Good cultural records name their gaps instead of hiding them.",
    priority: "secondary",
  });

  return questions;
}

function buildOpenQuestions(input: ArtistQuestionSpineInput): QuestionSpineOpenQuestion[] {
  const { artist } = input;
  const openQuestions: QuestionSpineOpenQuestion[] = [];

  if (!hasText(artist.fullBio || artist.bio)) {
    openQuestions.push({
      id: "missing-bio",
      question: `What is the clearest human context for ${artist.name}?`,
      whyItMatters: "A profile without context can become a database row.",
    });
  }

  if (!hasText(artist.country)) {
    openQuestions.push({
      id: "missing-place",
      question: `Which places should be attached to ${artist.name}?`,
      whyItMatters: "Place can clarify scenes, language, audience, and movement.",
    });
  }

  if ((artist.releases || []).length === 0 && artist.releaseCount === 0) {
    openQuestions.push({
      id: "missing-catalog",
      question: `Which releases belong in ${artist.name}'s public record?`,
      whyItMatters: "The work should carry the explanation whenever possible.",
    });
  }

  if ((artist.relatedArtists || []).length === 0) {
    openQuestions.push({
      id: "missing-relationships",
      question: `Who helps explain ${artist.name}'s creative world?`,
      whyItMatters: "Culture becomes legible through relationships.",
    });
  }

  return openQuestions;
}

export function resolveArtistQuestionSpine(input: ArtistQuestionSpineInput): QuestionSpine {
  const { artist } = input;
  const evidenceItems = buildEvidence(input);
  const relationships = buildRelationships(input);
  const status = resolveStatus(evidenceItems);

  return {
    entityType: "artist",
    entityId: artist.id,
    entitySlug: artist.slug,
    entityTitle: artist.name,
    primaryQuestion: `What does ${artist.name} help us understand about African culture right now?`,
    shortAnswer: buildShortAnswer(artist, evidenceItems),
    status,
    confidence: resolveConfidence(status),
    evidence: evidenceItems,
    relationships,
    nextQuestions: buildNextQuestions(input),
    openQuestions: buildOpenQuestions(input),
  };
}
