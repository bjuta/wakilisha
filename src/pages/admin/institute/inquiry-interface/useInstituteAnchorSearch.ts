import { useMemo } from "react";
import { useArtistSearchData } from "@/hooks/useArtistSearchData";
import { useGenreSearchData } from "@/hooks/useGenreSearchData";
import { useLabelSearchData } from "@/hooks/useLabelSearchData";
import { useReleaseSearchData } from "@/hooks/useReleaseSearchData";
import { useTrackSearchData } from "@/hooks/useTrackSearchData";
import type { AnchorCategory, RegistryAnchor, RegistryAnchorType } from "./types";

export const anchorCategoryOptions: Array<{
  key: AnchorCategory;
  label: string;
  note: string;
}> = [
  { key: "artist", label: "Artist", note: "Anchor to a musician, performer, or creator." },
  { key: "track", label: "Track", note: "Anchor to a specific song or recording." },
  { key: "release", label: "Release", note: "Anchor to an album, EP, single, or project." },
  { key: "label", label: "Label", note: "Anchor to a record label or music company." },
  { key: "genre", label: "Genre", note: "Anchor to a sound, style, or category." },
  { key: "none", label: "No anchor", note: "Start from a question without a registry entity." },
];

function hrefFor(type: RegistryAnchorType, slug: string) {
  if (type === "artist") return `/artists/${slug}`;
  if (type === "track") return `/tracks/${slug}`;
  if (type === "release") return `/releases/${slug}`;
  if (type === "label") return `/labels/${slug}`;
  if (type === "genre") return `/genres/${slug}`;
  return "";
}

function matches(anchor: RegistryAnchor, query: string) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;

  return [
    anchor.label,
    anchor.subtitle,
    anchor.contextText,
    anchor.slug,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function useInstituteAnchorSearch(category: AnchorCategory | null, query: string) {
  const artists = useArtistSearchData();
  const tracks = useTrackSearchData();
  const releases = useReleaseSearchData();
  const labels = useLabelSearchData();
  const genres = useGenreSearchData();

  const anchorsByCategory = useMemo<Record<RegistryAnchorType, RegistryAnchor[]>>(
    () => ({
      artist: artists.data.map((artist) => ({
        type: "artist",
        slug: artist.slug,
        label: artist.name,
        subtitle: artist.country || artist.genres.slice(0, 2).join(", ") || "Artist",
        imageUrl: artist.imageUrl ?? null,
        contextText: artist.contextText,
        href: hrefFor("artist", artist.slug),
        metadata: {
          country: artist.country,
          genres: artist.genres,
        },
      })),
      track: tracks.data.map((track) => ({
        type: "track",
        slug: track.slug,
        label: track.title,
        subtitle: [track.artist, track.genre, track.label].filter(Boolean).join(" · ") || "Track",
        imageUrl: track.artworkUrl || null,
        contextText: track.contextText,
        href: hrefFor("track", track.slug),
        metadata: {
          artist: track.artist,
          genre: track.genre,
          label: track.label,
          isPlayable: track.isPlayable,
        },
      })),
      release: releases.data.map((release) => ({
        type: "release",
        slug: release.slug,
        label: release.title,
        subtitle: [
          release.artistName,
          release.releaseType,
          release.releaseDate,
          release.trackCount ? `${release.trackCount} track(s)` : "",
        ].filter(Boolean).join(" · ") || "Release",
        imageUrl: release.artworkUrl || null,
        href: hrefFor("release", release.slug),
        metadata: {
          artistName: release.artistName,
          artistSlug: release.artistSlug,
          releaseType: release.releaseType,
          releaseDate: release.releaseDate,
          trackCount: release.trackCount,
        },
      })),
      label: labels.data.map((label) => ({
        type: "label",
        slug: label.slug,
        label: label.name,
        subtitle: [label.country, label.releaseCount ? `${label.releaseCount} release(s)` : ""].filter(Boolean).join(" · ") || "Label",
        imageUrl: null,
        contextText: label.contextText,
        href: hrefFor("label", label.slug),
        metadata: {
          country: label.country,
          artistCount: label.artistCount,
          releaseCount: label.releaseCount,
        },
      })),
      genre: genres.data.map((genre) => ({
        type: "genre",
        slug: genre.slug,
        label: genre.name,
        subtitle: [
          genre.artistCount ? `${genre.artistCount} artist(s)` : "",
          genre.representativeArtists.length ? `Includes ${genre.representativeArtists.slice(0, 2).join(", ")}` : "",
        ].filter(Boolean).join(" · ") || "Genre",
        imageUrl: null,
        contextText: genre.contextText,
        href: hrefFor("genre", genre.slug),
        metadata: {
          artistCount: genre.artistCount,
          trackCount: genre.trackCount,
          representativeArtists: genre.representativeArtists,
          accentVar: genre.accentVar,
        },
      })),
    }),
    [artists.data, tracks.data, releases.data, labels.data, genres.data],
  );

  const loading =
    category === "artist" ? artists.loading :
    category === "track" ? tracks.loading :
    category === "release" ? releases.loading :
    category === "label" ? labels.loading :
    category === "genre" ? genres.loading :
    false;

  const error =
    category === "artist" ? artists.error :
    category === "track" ? tracks.error :
    category === "release" ? releases.error :
    category === "label" ? labels.error :
    category === "genre" ? genres.error :
    null;

  const anchors = useMemo(() => {
    if (!category || category === "none") return [];
    return anchorsByCategory[category].filter((anchor) => matches(anchor, query)).slice(0, 12);
  }, [anchorsByCategory, category, query]);

  return {
    anchors,
    loading,
    error: error ?? "",
  };
}
