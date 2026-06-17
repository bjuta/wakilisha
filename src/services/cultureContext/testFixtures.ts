import type { ArtistFacts, LabelFacts, ReleaseFacts, TrackFacts } from "./types";

export const trackFixture: TrackFacts = {
  title: "Siaka",
  primaryArtists: ["Mejja", "Fik Fameica"],
  featuredArtists: [],
  releaseTitle: "Mtoto wa Khadija",
  releaseType: "album",
  releaseYear: "2026",
  trackNumber: 3,
  trackCount: 12,
  genres: ["Gengetone", "Afropop"],
  country: "Kenya",
  peakRank: 8,
  weeksOnChart: 6,
};

export const albumFixture: ReleaseFacts = {
  title: "Mtoto wa Khadija",
  releaseType: "album",
  artistNames: ["Mejja"],
  releaseYear: "2026",
  trackCount: 12,
  genres: ["Gengetone", "Afropop"],
  chartEntryCount: 3,
  topChartPeak: 8,
  hasMultipleArtists: false,
  isCompilation: false,
  country: "Kenya",
  standoutTracks: [{ title: "Siaka", artistNames: ["Mejja", "Fik Fameica"], peakRank: 8 }],
};

export const epFixture: ReleaseFacts = {
  title: "Soft Launch",
  releaseType: "ep",
  artistNames: ["Njerae"],
  releaseYear: "2026",
  trackCount: 5,
  genres: ["R&B", "Soul"],
  hasMultipleArtists: false,
  isCompilation: false,
  country: "Kenya",
  standoutTracks: [],
};

export const singleFixture: ReleaseFacts = {
  title: "One Time",
  releaseType: "single",
  artistNames: ["Artist Name"],
  releaseYear: "2026",
  trackCount: 1,
  genres: ["Afropop"],
  hasMultipleArtists: false,
  isCompilation: false,
  standoutTracks: [],
};

export const artistFixture: ArtistFacts = {
  name: "Njerae",
  country: "Kenya",
  genres: ["R&B", "Soul"],
  releaseCount: 4,
  trackCount: 16,
  chartEntryCount: 2,
  peakChartPosition: 12,
  collaborations: [{ name: "Xenia Manasseh", count: 1 }],
  labels: [],
};

export const labelFixture: LabelFacts = {
  name: "Sol Generation",
  country: "Kenya",
  artistCount: 6,
  releaseCount: 24,
  trackCount: 80,
  chartEntryCount: 12,
  genres: ["Afropop", "R&B"],
  topArtists: ["Sauti Sol", "Bensoul", "Nviiri"],
};
