import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  buildArtistSearchSnippet,
} from "@/services/cultureContext/artistAdapters";
import {
  buildTrackSearchSnippet,
} from "@/services/cultureContext/trackAdapters";
import {
  buildGenreSearchSnippet,
  buildLabelSearchSnippet,
} from "@/services/cultureContext/searchAdapters";
import {
  normalizeCountry,
} from "@/services/cultureContext/formatters";
import type {
  PublicRelease,
} from "@/services/publicContent/client";
import {
  PUBLIC_SEARCH_ENTITY_TYPES,
  searchPublicRegistry,
  type PublicSearchEntityType,
  type PublicSearchResponse,
  type PublicSearchResult,
} from "@/services/publicSearch/client";

export interface PublicSearchArtistItem {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  genres: string[];
  country?: string;
  contextText: string;
}

export interface PublicSearchTrackItem {
  id: string;
  slug: string;
  artistSlug: string;
  title: string;
  artist: string;
  genre: string;
  artworkUrl: string;
  isPlayable: boolean;
  source: string;
  label: string;
  contextText: string;
  previewUrl: string | null;
}

export interface PublicSearchGenreItem {
  slug: string;
  name: string;
  accentVar: string;
  artistCount: number;
  trackCount: number;
  representativeArtists: string[];
  contextText: string;
}

export interface PublicSearchLabelItem {
  slug: string;
  name: string;
  country: string;
  artistCount: number;
  releaseCount: number;
  contextText: string;
}

type PublicSearchLimits =
  Partial<
    Record<
      PublicSearchEntityType,
      number
    >
  >;

type SearchCollectionState = {
  artists:
    PublicSearchArtistItem[];
  tracks:
    PublicSearchTrackItem[];
  releases:
    PublicRelease[];
  genres:
    PublicSearchGenreItem[];
  labels:
    PublicSearchLabelItem[];
};

type SearchPageState = Record<
  PublicSearchEntityType,
  {
    total: number;
    hasMore: boolean;
    nextCursor: string | null;
  }
>;

const EMPTY_COLLECTIONS:
  SearchCollectionState = {
    artists: [],
    tracks: [],
    releases: [],
    genres: [],
    labels: [],
  };

const EMPTY_PAGE =
  {
    total: 0,
    hasMore: false,
    nextCursor: null,
  };

const EMPTY_PAGES:
  SearchPageState = {
    artist: {
      ...EMPTY_PAGE,
    },
    track: {
      ...EMPTY_PAGE,
    },
    release: {
      ...EMPTY_PAGE,
    },
    genre: {
      ...EMPTY_PAGE,
    },
    label: {
      ...EMPTY_PAGE,
    },
  };

const DEFAULT_LIMITS:
  Record<
    PublicSearchEntityType,
    number
  > = {
    artist: 50,
    track: 50,
    release: 50,
    genre: 50,
    label: 50,
  };

const WARM_GENRE_ACCENTS = [
  "#D4A574",
  "#C17E60",
  "#E8B44F",
  "#B8956A",
  "#CD853F",
  "#A0522D",
  "#D2691E",
  "#8B6914",
  "#9B7653",
  "#C4A35A",
  "#6B4226",
  "#8D6E4C",
  "#E6A070",
  "#BC8F6F",
  "#A67C52",
  "#CB7A4D",
  "#DEB887",
];

function hashSlug(
  slug: string,
): number {
  let hash = 0;

  for (
    let index = 0;
    index < slug.length;
    index += 1
  ) {
    hash =
      (
        hash * 31
        + slug.charCodeAt(
          index,
        )
      )
      & 0x7fffffff;
  }

  return hash;
}

function accentForGenre(
  slug: string,
): string {
  return WARM_GENRE_ACCENTS[
    hashSlug(slug)
    % WARM_GENRE_ACCENTS.length
  ];
}

function record(
  value: unknown,
): Record<
  string,
  unknown
> {
  return value
    && typeof value
      === "object"
    && !Array.isArray(value)
      ? value as Record<
          string,
          unknown
        >
      : {};
}

function text(
  value: unknown,
): string {
  return typeof value
    === "string"
      ? value.trim()
      : "";
}

function numberValue(
  value: unknown,
): number {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}

function strings(
  value: unknown,
): string[] {
  return Array.isArray(value)
    ? value
        .map(
          (item) =>
            text(item),
        )
        .filter(Boolean)
    : [];
}

function releaseType(
  value: unknown,
  trackCount: number,
): "Single" | "EP" | "Album" {
  if (
    value === "Single"
    || value === "EP"
    || value === "Album"
  ) {
    return value;
  }

  if (
    trackCount <= 1
  ) {
    return "Single";
  }

  if (
    trackCount <= 6
  ) {
    return "EP";
  }

  return "Album";
}

function mapArtist(
  result: PublicSearchResult,
): PublicSearchArtistItem {
  const payload =
    record(
      result.payload,
    );

  const genres =
    strings(
      payload.genres,
    );

  const country =
    normalizeCountry(
      text(
        payload.country,
      )
      || result.subtitle,
    )
    || undefined;

  const item = {
    id:
      result.id,
    slug:
      result.slug,
    name:
      text(
        payload.name,
      )
      || result.title,
    imageUrl:
      text(
        payload.imageUrl,
      )
      || result.imageUrl
      || undefined,
    genres,
    country,
  };

  return {
    ...item,
    contextText:
      buildArtistSearchSnippet(
        item,
      ),
  };
}

function mapTrack(
  result: PublicSearchResult,
): PublicSearchTrackItem {
  const payload =
    record(
      result.payload,
    );

  const artist =
    text(
      payload.artist,
    )
    || result.subtitle
    || "Unknown";

  const genre =
    text(
      payload.genre,
    );

  const label =
    text(
      payload.label,
    );

  const previewUrl =
    text(
      payload.previewUrl,
    )
    || null;

  const item = {
    id:
      result.id,
    slug:
      result.slug,
    artistSlug:
      text(
        payload.artistSlug,
      )
      || result.parentSlug
      || "",
    title:
      result.title,
    artist,
    genre,
    artworkUrl:
      text(
        payload.artworkUrl,
      )
      || result.imageUrl
      || "",
    isPlayable:
      payload.isPlayable
        === true
      || Boolean(
        previewUrl,
      ),
    source:
      text(
        payload.source,
      )
      || "apple_music",
    label,
    previewUrl,
  };

  return {
    ...item,
    contextText:
      buildTrackSearchSnippet(
        item,
      ),
  };
}

function mapRelease(
  result: PublicSearchResult,
): PublicRelease {
  const payload =
    record(
      result.payload,
    );

  const releaseDate =
    text(
      payload.releaseDate,
    );

  const trackCount =
    numberValue(
      payload.trackCount,
    );

  return {
    id:
      result.id,
    slug:
      result.slug,
    title:
      result.title,
    artist:
      text(
        payload.artistName,
      )
      || result.subtitle
      || "Unknown",
    artistSlug:
      text(
        payload.artistSlug,
      )
      || result.parentSlug
      || undefined,
    year:
      releaseDate
        .match(
          /^\d{4}/,
        )
        ?.[0]
      || "",
    releaseType:
      releaseType(
        payload.releaseType,
        trackCount,
      ),
    labelName:
      text(
        payload.labelName,
      )
      || "Independent",
    artworkUrl:
      text(
        payload.artworkUrl,
      )
      || result.imageUrl
      || "",
    trackCount,
    singleTrackSlug:
      text(
        payload.singleTrackSlug,
      )
      || null,
    singleTrackArtistSlug:
      text(
        payload.singleTrackArtistSlug,
      )
      || null,
  };
}

function mapGenre(
  result: PublicSearchResult,
): PublicSearchGenreItem {
  const payload =
    record(
      result.payload,
    );

  const item = {
    slug:
      result.slug,
    name:
      result.title,
    accentVar:
      accentForGenre(
        result.slug,
      ),
    artistCount:
      numberValue(
        payload.artistCount,
      ),
    trackCount:
      numberValue(
        payload.trackCount,
      ),
    representativeArtists:
      strings(
        payload.representativeArtists,
      ),
  };

  return {
    ...item,
    contextText:
      buildGenreSearchSnippet(
        item,
      ),
  };
}

function mapLabel(
  result: PublicSearchResult,
): PublicSearchLabelItem {
  const payload =
    record(
      result.payload,
    );

  const item = {
    slug:
      result.slug,
    name:
      result.title,
    country:
      normalizeCountry(
        text(
          payload.country,
        )
        || result.subtitle,
      )
      || "",
    artistCount:
      numberValue(
        payload.artistCount,
      ),
    releaseCount:
      numberValue(
        payload.releaseCount,
      ),
  };

  return {
    ...item,
    contextText:
      buildLabelSearchSnippet(
        item,
      ),
  };
}

function mappedResults(
  type: PublicSearchEntityType,
  response: PublicSearchResponse,
): SearchCollectionState[
  keyof SearchCollectionState
] {
  switch (type) {
    case "artist":
      return response.results.map(
        mapArtist,
      );
    case "track":
      return response.results.map(
        mapTrack,
      );
    case "release":
      return response.results.map(
        mapRelease,
      );
    case "genre":
      return response.results.map(
        mapGenre,
      );
    case "label":
      return response.results.map(
        mapLabel,
      );
  }
}

function collectionKey(
  type: PublicSearchEntityType,
): keyof SearchCollectionState {
  switch (type) {
    case "artist":
      return "artists";
    case "track":
      return "tracks";
    case "release":
      return "releases";
    case "genre":
      return "genres";
    case "label":
      return "labels";
  }
}

export function usePublicRegistrySearch(
  query: string,
  options: {
    enabled?: boolean;
    debounceMs?: number;
    limits?: PublicSearchLimits;
  } = {},
) {
  const enabled =
    options.enabled
    ?? true;

  const debounceMs =
    Math.max(
      0,
      options.debounceMs
      ?? 180,
    );

  const artistLimit =
    options.limits?.artist
    ?? DEFAULT_LIMITS.artist;
  const trackLimit =
    options.limits?.track
    ?? DEFAULT_LIMITS.track;
  const releaseLimit =
    options.limits?.release
    ?? DEFAULT_LIMITS.release;
  const genreLimit =
    options.limits?.genre
    ?? DEFAULT_LIMITS.genre;
  const labelLimit =
    options.limits?.label
    ?? DEFAULT_LIMITS.label;

  const limits =
    useMemo(
      () => ({
        artist:
          artistLimit,
        track:
          trackLimit,
        release:
          releaseLimit,
        genre:
          genreLimit,
        label:
          labelLimit,
      }),
      [
        artistLimit,
        genreLimit,
        labelLimit,
        releaseLimit,
        trackLimit,
      ],
    );

  const [
    collections,
    setCollections,
  ] =
    useState<SearchCollectionState>(
      EMPTY_COLLECTIONS,
    );

  const [
    pages,
    setPages,
  ] =
    useState<SearchPageState>(
      EMPTY_PAGES,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    loadingMore,
    setLoadingMore,
  ] =
    useState<PublicSearchEntityType | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const normalizedQuery =
    query
      .trim()
      .slice(
        0,
        128,
      );

  useEffect(
    () => {
      if (
        !enabled
        || !normalizedQuery
      ) {
        setCollections(
          EMPTY_COLLECTIONS,
        );
        setPages(
          EMPTY_PAGES,
        );
        setLoading(false);
        setLoadingMore(null);
        setError(null);
        return;
      }

      const controller =
        new AbortController();

      let alive = true;

      const timer =
        window.setTimeout(
          async () => {
            setLoading(true);
            setError(null);

            const types =
              PUBLIC_SEARCH_ENTITY_TYPES
                .filter(
                  (type) =>
                    limits[type]
                    > 0,
                );

            try {
              const responses =
                await Promise.all(
                  types.map(
                    async (
                      type,
                    ) => ({
                      type,
                      response:
                        await searchPublicRegistry({
                          query:
                            normalizedQuery,
                          types: [
                            type,
                          ],
                          limit:
                            limits[type],
                          signal:
                            controller.signal,
                        }),
                    }),
                  ),
                );

              if (!alive) {
                return;
              }

              const nextCollections: SearchCollectionState = {
                ...EMPTY_COLLECTIONS,
              };

              const nextPages: SearchPageState = {
                artist: {
                  ...EMPTY_PAGE,
                },
                track: {
                  ...EMPTY_PAGE,
                },
                release: {
                  ...EMPTY_PAGE,
                },
                genre: {
                  ...EMPTY_PAGE,
                },
                label: {
                  ...EMPTY_PAGE,
                },
              };

              for (
                const {
                  type,
                  response,
                }
                of responses
              ) {
                const key =
                  collectionKey(
                    type,
                  );

                (
                  nextCollections[
                    key
                  ] as unknown[]
                ) =
                  mappedResults(
                    type,
                    response,
                  );

                nextPages[
                  type
                ] = {
                  total:
                    response
                      .page
                      .total,
                  hasMore:
                    response
                      .page
                      .hasMore,
                  nextCursor:
                    response
                      .page
                      .nextCursor,
                };
              }

              setCollections(
                nextCollections,
              );
              setPages(
                nextPages,
              );
            } catch (
              caught
            ) {
              if (
                !alive
                || controller
                  .signal
                  .aborted
              ) {
                return;
              }

              console.error(
                "Failed to search the public Registry:",
                caught,
              );

              setCollections(
                EMPTY_COLLECTIONS,
              );
              setPages(
                EMPTY_PAGES,
              );
              setError(
                "Search is temporarily unavailable.",
              );
            } finally {
              if (alive) {
                setLoading(false);
              }
            }
          },
          debounceMs,
        );

      return () => {
        alive = false;
        window.clearTimeout(
          timer,
        );
        controller.abort();
      };
    },
    [
      debounceMs,
      enabled,
      limits,
      normalizedQuery,
    ],
  );

  const loadMore =
    useCallback(
      async (
        type: PublicSearchEntityType,
      ) => {
        const cursor =
          pages[
            type
          ].nextCursor;

        if (
          !enabled
          || !normalizedQuery
          || !cursor
          || loadingMore
        ) {
          return;
        }

        setLoadingMore(
          type,
        );

        try {
          const response =
            await searchPublicRegistry({
              query:
                normalizedQuery,
              types: [
                type,
              ],
              limit:
                limits[
                  type
                ],
              cursor,
            });

          const key =
            collectionKey(
              type,
            );

          const more =
            mappedResults(
              type,
              response,
            ) as unknown[];

          setCollections(
            (
              current,
            ) => ({
              ...current,
              [key]: [
                ...(
                  current[
                    key
                  ] as unknown[]
                ),
                ...more,
              ],
            }) as SearchCollectionState,
          );

          setPages(
            (
              current,
            ) => ({
              ...current,
              [type]: {
                total:
                  response
                    .page
                    .total,
                hasMore:
                  response
                    .page
                    .hasMore,
                nextCursor:
                  response
                    .page
                    .nextCursor,
              },
            }),
          );
        } catch (
          caught
        ) {
          console.error(
            "Failed to load more public Registry Search results:",
            caught,
          );
          setError(
            "More Search results could not be loaded.",
          );
        } finally {
          setLoadingMore(
            null,
          );
        }
      },
      [
        enabled,
        limits,
        loadingMore,
        normalizedQuery,
        pages,
      ],
    );

  return {
    ...collections,
    totals: {
      artist:
        pages.artist.total,
      track:
        pages.track.total,
      release:
        pages.release.total,
      genre:
        pages.genre.total,
      label:
        pages.label.total,
    },
    hasMore: {
      artist:
        pages.artist.hasMore,
      track:
        pages.track.hasMore,
      release:
        pages.release.hasMore,
      genre:
        pages.genre.hasMore,
      label:
        pages.label.hasMore,
    },
    loading,
    loadingMore,
    error,
    loadMore,
  };
}
