import type { ArtistFacts, LabelFacts, ReleaseFacts, TrackFacts } from "./types";

export type TrackStory = "chartHeat" | "releasePlacement" | "collaboration" | "sceneMarker" | "thinTrack";
export type ArtistStory = "chartActor" | "catalogBuilder" | "collaborator" | "sceneVoice" | "thinArtist";
export type ReleaseStory = "chartRelease" | "standoutTracks" | "fullProject" | "focusedProject" | "singleMoment" | "manyVoices" | "sceneRelease" | "thinRelease";
export type LabelStory = "chartHome" | "rosterHome" | "releaseEngine" | "sceneBuilder" | "thinLabel";

export function selectTrackStory(facts: TrackFacts): TrackStory {
  if ((facts.peakRank && facts.peakRank > 0) || (facts.weeksOnChart && facts.weeksOnChart > 0)) return "chartHeat";
  if (facts.releaseTitle && facts.trackNumber) return "releasePlacement";
  if (facts.primaryArtists.length + facts.featuredArtists.length > 1) return "collaboration";
  if (facts.genres.length > 0 || facts.country) return "sceneMarker";
  return "thinTrack";
}

export function selectArtistStory(facts: ArtistFacts): ArtistStory {
  if ((facts.peakChartPosition && facts.peakChartPosition > 0) || (facts.chartEntryCount && facts.chartEntryCount > 0)) return "chartActor";
  if ((facts.releaseCount && facts.releaseCount > 2) || (facts.trackCount && facts.trackCount > 5)) return "catalogBuilder";
  if (facts.collaborations.length > 0) return "collaborator";
  if (facts.genres.length > 0 || facts.country) return "sceneVoice";
  return "thinArtist";
}

export function selectReleaseStory(facts: ReleaseFacts): ReleaseStory {
  if ((facts.chartEntryCount && facts.chartEntryCount > 0) || (facts.topChartPeak && facts.topChartPeak > 0)) return "chartRelease";
  if (facts.standoutTracks.length > 0) return "standoutTracks";
  if (facts.isCompilation || facts.releaseType === "compilation" || facts.hasMultipleArtists) return "manyVoices";
  if (facts.releaseType === "album" && facts.trackCount && facts.trackCount > 1) return "fullProject";
  if (facts.releaseType === "ep" && facts.trackCount && facts.trackCount > 1) return "focusedProject";
  if (facts.releaseType === "single") return "singleMoment";
  if (facts.genres.length > 0 || facts.country || facts.labelName) return "sceneRelease";
  return "thinRelease";
}

export function selectLabelStory(facts: LabelFacts): LabelStory {
  if (facts.chartEntryCount && facts.chartEntryCount > 0) return "chartHome";
  if (facts.artistCount && facts.artistCount > 0) return "rosterHome";
  if (facts.releaseCount && facts.releaseCount > 0) return "releaseEngine";
  if (facts.genres.length > 0 || facts.country) return "sceneBuilder";
  return "thinLabel";
}
