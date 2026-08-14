import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  useArtistSearchData,
  type ArtistSearchItem,
} from "@/hooks/useArtistSearchData";
import {
  getPublicArtistRelationships,
} from "@/services/publicArtistRelationships";
import {
  getRegistryArtistStructuralProximity,
  getRegistryOnboardingArtists,
  getRegistryOnboardingState,
  getUserFollowing,
  setFollowState,
  setRegistryOnboardingState,
  type RegistryOnboardingState,
} from "@/services/community";

type CanvasSource =
  | "opening"
  | "related"
  | "search"
  | "followed";

type CanvasArtist = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  canonicalPath: string;
  source: CanvasSource;
};

const DESKTOP_SLOTS = [
  { left: 7, top: 18, size: 108 },
  { left: 21, top: 11, size: 136 },
  { left: 38, top: 20, size: 96 },
  { left: 56, top: 11, size: 124 },
  { left: 74, top: 19, size: 110 },
  { left: 91, top: 14, size: 94 },
  { left: 12, top: 49, size: 132 },
  { left: 29, top: 43, size: 98 },
  { left: 47, top: 51, size: 144 },
  { left: 66, top: 43, size: 104 },
  { left: 84, top: 50, size: 136 },
  { left: 6, top: 80, size: 94 },
  { left: 23, top: 75, size: 118 },
  { left: 40, top: 82, size: 100 },
  { left: 58, top: 76, size: 128 },
  { left: 76, top: 82, size: 102 },
  { left: 93, top: 75, size: 116 },
  { left: 34, top: 7, size: 78 },
  { left: 64, top: 89, size: 82 },
  { left: 50, top: 91, size: 78 },
] as const;

const MOBILE_VISIBLE_LIMIT = 12;

const MOBILE_SIZES = [
  98,
  80,
  108,
  86,
  96,
  78,
  104,
  84,
] as const;

const RELATIONSHIP_DESKTOP_SIZES = [
  118,
  96,
  132,
  104,
  112,
  90,
  124,
  100,
] as const;

const RELATIONSHIP_MOBILE_SIZES = [
  96,
  78,
  106,
  84,
  94,
  80,
] as const;

function initials(
  name: string,
): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (word) =>
        word[0]?.toUpperCase() || "",
    )
    .join("");
}

function fromSearch(
  artist: ArtistSearchItem,
): CanvasArtist {
  return {
    id: artist.id,
    slug: artist.slug,
    name: artist.name,
    imageUrl: artist.imageUrl || null,
    canonicalPath:
      `/artists/${artist.slug}`,
    source: "search",
  };
}

async function relatedArtistsFor(
  artist: CanvasArtist,
): Promise<CanvasArtist[]> {
  const [
    structuralRelationships,
    reviewedRelationships,
  ] = await Promise.all([
    getRegistryArtistStructuralProximity(
      artist.id,
    ).catch(() => []),
    getPublicArtistRelationships(
      artist.id,
    ).catch(() => []),
  ]);

  type Candidate = {
    id: string;
    slug: string;
    name: string;
    imageUrl: string | null;
    canonicalPath: string;
    reviewed: boolean;
    strength: number;
  };

  const bySlug = new Map<string, Candidate>();

  structuralRelationships.forEach(
    (relationship) => {
      const slug = relationship.relatedArtistSlug.trim();
      if (
        !slug
        || slug === artist.slug
        || relationship.relatedArtistId === artist.id
      ) {
        return;
      }
      bySlug.set(slug, {
        id: relationship.relatedArtistId,
        slug,
        name: relationship.relatedArtistName,
        imageUrl: relationship.relatedArtistImageUrl,
        canonicalPath: `/artists/${slug}`,
        reviewed: false,
        strength: relationship.proximityScore,
      });
    },
  );

  reviewedRelationships
    .filter(
      (relationship) => relationship.relatedEntityType === "artist",
    )
    .forEach(
      (relationship) => {
        const slug = relationship.relatedEntitySlug.trim();
        if (
          !slug
          || slug === artist.slug
          || relationship.relatedEntityId === artist.id
        ) {
          return;
        }
        const existing = bySlug.get(slug);
        bySlug.set(slug, {
          id: relationship.relatedEntityId,
          slug,
          name: relationship.relatedEntityName,
          imageUrl: existing?.imageUrl || relationship.relatedEntityImageUrl,
          canonicalPath:
            relationship.relatedEntityUrl
            || existing?.canonicalPath
            || `/artists/${slug}`,
          reviewed: true,
          strength: existing?.strength || 0,
        });
      },
    );

  return Array.from(bySlug.values())
    .sort(
      (left, right) =>
        Number(right.reviewed) - Number(left.reviewed)
        || right.strength - left.strength
        || left.name.localeCompare(right.name),
    )
    .map(
      (candidate) => ({
        id: candidate.id,
        slug: candidate.slug,
        name: candidate.name,
        imageUrl: candidate.imageUrl,
        canonicalPath: candidate.canonicalPath,
        source: "related" as const,
        anchorId: artist.id,
      }),
    );
}

function ArtistPortrait({
  artist,
  selected,
  active,
  pending,
  muted,
  size,
  onChoose,
  onUnfollow,
}: {
  artist: CanvasArtist;
  selected: boolean;
  active: boolean;
  pending: boolean;
  muted: boolean;
  size: number;
  onChoose: () => void;
  onUnfollow: () => void;
}) {
  return (
    <div
      className="relative flex flex-col items-center text-center"
      style={{
        opacity:
          active || selected
            ? 1
            : muted
              ? 0.72
              : 1,
      }}
    >
      <button
        type="button"
        onClick={onChoose}
        disabled={pending}
        aria-pressed={active}
        aria-label={`Explore ${artist.name}`}
        className={`group ${
          pending
            ? "cursor-wait"
            : "cursor-pointer"
        }`}
      >
        <span
          className={`relative block overflow-hidden rounded-full bg-[var(--wk-surface-raised)] shadow-[0_14px_48px_rgba(0,0,0,0.16)] transition-all duration-500 ${
            active
              ? "ring-[4px] ring-[var(--wk-brand)] ring-offset-[5px] ring-offset-[var(--wk-bg)]"
              : selected
                ? "ring-2 ring-[var(--wk-brand)] ring-offset-[3px] ring-offset-[var(--wk-bg)]"
                : "ring-1 ring-[var(--wk-border)]"
          }`}
          style={{
            width: size,
            height: size,
            transform:
              active
                ? "scale(1.07)"
                : "scale(1)",
          }}
        >
          {artist.imageUrl ? (
            <img
              src={artist.imageUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-[var(--wk-brand-soft)] text-[20px] font-black text-[var(--wk-brand)]">
              {initials(artist.name)}
            </span>
          )}
        </span>
      </button>

      {selected && (
        <button
          type="button"
          onClick={onUnfollow}
          disabled={pending}
          aria-label={`Unfollow ${artist.name}`}
          title={`Unfollow ${artist.name}`}
          className="absolute right-[4px] flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] shadow-lg transition-transform hover:scale-105 disabled:opacity-50"
          style={{
            top:
              Math.max(
                0,
                size - 26,
              ),
          }}
        >
          <WkIcon
            name="Check"
            size={15}
          />
        </button>
      )}

      <span
        className={`mt-3 max-w-[150px] text-[12px] font-black leading-tight tracking-[-0.015em] ${
          active || selected
            ? "text-[var(--wk-text)]"
            : "text-[var(--wk-text-soft)]"
        }`}
      >
        {artist.name}
      </span>
    </div>
  );
}

export default function RegistryOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] =
    useSearchParams();
  const authUser = useAuthUser();
  const {
    data: allArtists,
    loading: searchLoading,
  } = useArtistSearchData();

  const [opening, setOpening] =
    useState<CanvasArtist[]>([]);
  const [activeAnchor, setActiveAnchor] =
    useState<CanvasArtist | null>(
      null,
    );
  const [activeRelated, setActiveRelated] =
    useState<CanvasArtist[]>([]);
  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(
      () => new Set(),
    );
  const [pendingIds, setPendingIds] =
    useState<Set<string>>(
      () => new Set(),
    );
  const [onboardingState, setOnboardingState] =
    useState<RegistryOnboardingState | null>(
      null,
    );
  const [loading, setLoading] =
    useState(true);
  const [relationshipLoading, setRelationshipLoading] =
    useState(false);
  const [query, setQuery] =
    useState("");
  const [error, setError] =
    useState<string | null>(null);
  const [finishing, setFinishing] =
    useState(false);
  const relationshipRequestId =
    useRef(0);

  const editingRequested =
    searchParams.get("edit") === "1";

  useEffect(() => {
    if (
      authUser.loading
      || !authUser.id
    ) {
      return;
    }

    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [
          openingResponse,
          state,
          following,
        ] = await Promise.all([
          getRegistryOnboardingArtists(
            16,
          ),
          getRegistryOnboardingState(),
          getUserFollowing(
            authUser.id,
          ),
        ]);

        if (!alive) {
          return;
        }

        const openingArtists =
          openingResponse.artists.map(
            (artist) => ({
              id: artist.targetId,
              slug: artist.targetSlug,
              name: artist.displayName,
              imageUrl: artist.imageUrl,
              canonicalPath:
                artist.canonicalPath,
              source:
                "opening" as const,
            }),
          );

        const followedArtistIds =
          following
            .filter(
              (item) =>
                item.targetType
                === "artist",
            )
            .map(
              (item) =>
                item.targetId,
            );

        setOpening(
          openingArtists,
        );
        setOnboardingState(
          state,
        );
        setSelectedIds(
          new Set(
            followedArtistIds,
          ),
        );
        setActiveAnchor(
          null,
        );
        setActiveRelated(
          [],
        );
      } catch (nextError) {
        console.error(
          "Could not load onboarding:",
          nextError,
        );

        if (alive) {
          setError(
            "We could not open your people right now.",
          );
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [
    authUser.id,
    authUser.loading,
  ]);

  const isEditing =
    editingRequested
    || (
      onboardingState !== null
      && onboardingState.status
      !== "not_started"
    );

  const clearActiveAnchor =
    useCallback(
      () => {
        relationshipRequestId.current +=
          1;
        setActiveAnchor(
          null,
        );
        setActiveRelated(
          [],
        );
        setRelationshipLoading(
          false,
        );
        setError(
          null,
        );
      },
      [],
    );

  const relationshipFieldArtists =
    useMemo(() => {
      if (!activeAnchor) {
        return [];
      }

      const map =
        new Map<
          string,
          CanvasArtist
        >();

      map.set(
        activeAnchor.id,
        activeAnchor,
      );

      activeRelated.forEach(
        (artist) => {
          if (!map.has(artist.id)) {
            map.set(
              artist.id,
              artist,
            );
          }
        },
      );

      return Array.from(
        map.values(),
      );
    }, [
      activeAnchor,
      activeRelated,
    ]);

  const visibleArtists =
    activeAnchor
      ? relationshipFieldArtists
      : opening;

  const mobileArtists =
    activeAnchor
      ? visibleArtists
      : visibleArtists.slice(
          0,
          MOBILE_VISIBLE_LIMIT,
        );

  const searchResults =
    useMemo(() => {
      const clean =
        query
          .trim()
          .toLowerCase();

      if (!clean) {
        return [];
      }

      return allArtists
        .filter(
          (artist) =>
            artist.name
              .toLowerCase()
              .includes(clean),
        )
        .slice(
          0,
          5,
        );
    }, [
      allArtists,
      query,
    ]);

  const yourPeople =
    useMemo(
      () =>
        allArtists
          .filter(
            (artist) =>
              selectedIds.has(
                artist.id,
              ),
          )
          .map(
            fromSearch,
          ),
      [
        allArtists,
        selectedIds,
      ],
    );

  const selectedCount =
    selectedIds.size;

  const activateAnchor =
    useCallback(
      async (
        artist: CanvasArtist,
      ) => {
        const requestId =
          relationshipRequestId.current
          + 1;

        relationshipRequestId.current =
          requestId;

        setActiveAnchor(
          artist,
        );
        setActiveRelated(
          [],
        );
        setRelationshipLoading(
          true,
        );
        setError(null);

        try {
          const related =
            await relatedArtistsFor(
              artist,
            );

          if (
            relationshipRequestId.current
            !== requestId
          ) {
            return;
          }

          setActiveRelated(
            related,
          );
        } catch (nextError) {
          console.error(
            "Could not load Artist connections:",
            nextError,
          );

          if (
            relationshipRequestId.current
            === requestId
          ) {
            setError(
              `We could not open the Artists around ${artist.name} right now.`,
            );
          }
        } finally {
          if (
            relationshipRequestId.current
            === requestId
          ) {
            setRelationshipLoading(
              false,
            );
          }
        }
      },
      [],
    );

  const chooseArtist =
    useCallback(
      async (
        artist: CanvasArtist,
      ) => {
        if (
          !authUser.id
          || pendingIds.has(
            artist.id,
          )
        ) {
          return;
        }

        const alreadyFollowed =
          selectedIds.has(
            artist.id,
          );

        if (!alreadyFollowed) {
          setPendingIds(
            (current) => {
              const next =
                new Set(current);
              next.add(
                artist.id,
              );
              return next;
            },
          );

          setSelectedIds(
            (current) => {
              const next =
                new Set(current);
              next.add(
                artist.id,
              );
              return next;
            },
          );

          try {
            await setFollowState({
              targetType:
                "artist",
              targetId:
                artist.id,
              targetSlug:
                artist.slug,
              followed:
                true,
            });
          } catch (nextError) {
            console.error(
              "Could not follow Artist:",
              nextError,
            );

            setSelectedIds(
              (current) => {
                const next =
                  new Set(current);
                next.delete(
                  artist.id,
                );
                return next;
              },
            );
            setPendingIds(
              (current) => {
                const next =
                  new Set(current);
                next.delete(
                  artist.id,
                );
                return next;
              },
            );
            setError(
              "That Follow did not save. Try it again.",
            );
            return;
          }

          setPendingIds(
            (current) => {
              const next =
                new Set(current);
              next.delete(
                artist.id,
              );
              return next;
            },
          );
        }

        await activateAnchor(
          artist,
        );
      },
      [
        activateAnchor,
        authUser.id,
        pendingIds,
        selectedIds,
      ],
    );

  const unfollowArtist =
    useCallback(
      async (
        artist: CanvasArtist,
      ) => {
        if (
          !authUser.id
          || pendingIds.has(
            artist.id,
          )
          || !selectedIds.has(
            artist.id,
          )
        ) {
          return;
        }

        setPendingIds(
          (current) => {
            const next =
              new Set(current);
            next.add(
              artist.id,
            );
            return next;
          },
        );

        setSelectedIds(
          (current) => {
            const next =
              new Set(current);
            next.delete(
              artist.id,
            );
            return next;
          },
        );

        try {
          await setFollowState({
            targetType:
              "artist",
            targetId:
              artist.id,
            targetSlug:
              artist.slug,
            followed:
              false,
          });

          if (
            activeAnchor?.id
            === artist.id
          ) {
            clearActiveAnchor();
          }
        } catch (nextError) {
          console.error(
            "Could not unfollow Artist:",
            nextError,
          );

          setSelectedIds(
            (current) => {
              const next =
                new Set(current);
              next.add(
                artist.id,
              );
              return next;
            },
          );
          setError(
            "That change did not save. Try it again.",
          );
        } finally {
          setPendingIds(
            (current) => {
              const next =
                new Set(current);
              next.delete(
                artist.id,
              );
              return next;
            },
          );
        }
      },
      [
        activeAnchor?.id,
        authUser.id,
        clearActiveAnchor,
        pendingIds,
        selectedIds,
      ],
    );

  const handleSearchChoice =
    (
      artist: ArtistSearchItem,
    ) => {
      setQuery("");
      void chooseArtist(
        fromSearch(
          artist,
        ),
      );
    };

  const handleSkip =
    async () => {
      if (isEditing) {
        navigate(
          "/settings",
        );
        return;
      }

      setFinishing(true);
      setError(null);

      try {
        await setRegistryOnboardingState(
          "skipped",
        );
        navigate(
          "/",
          {
            replace: true,
          },
        );
      } catch (nextError) {
        console.error(
          "Could not skip onboarding:",
          nextError,
        );
        setError(
          "We could not save that yet. Try once more.",
        );
      } finally {
        setFinishing(false);
      }
    };

  const handleEnter =
    async () => {
      if (
        !isEditing
        && selectedCount === 0
      ) {
        return;
      }

      setFinishing(true);
      setError(null);

      try {
        if (!isEditing) {
          await setRegistryOnboardingState(
            "completed",
          );
        }

        navigate(
          isEditing
            ? "/settings"
            : "/following",
          {
            replace:
              !isEditing,
          },
        );
      } catch (nextError) {
        console.error(
          "Could not complete onboarding:",
          nextError,
        );
        setError(
          "We could not finish that yet. Try once more.",
        );
      } finally {
        setFinishing(false);
      }
    };

  if (authUser.loading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-[var(--wk-bg)]">
        <div className="text-[18px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
          WAKILISHA
          <span className="text-[var(--wk-brand)]">
            .
          </span>
        </div>
      </main>
    );
  }

  if (
    !authUser.id
    || !authUser.isEmailVerified
  ) {
    return (
      <Navigate
        to={
          authUser.id
            ? "/auth?mode=verify&returnTo=/start"
            : "/auth?mode=signin&returnTo=/start"
        }
        replace
      />
    );
  }

  const canEnter =
    isEditing
    || selectedCount > 0;

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[var(--wk-bg)] text-[var(--wk-text)]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--wk-border)]/70 bg-[var(--wk-bg)]/92 px-4 py-3 backdrop-blur-xl md:h-[76px] md:px-8 md:py-0">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 md:h-full">
          <div className="text-[16px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
            WAKILISHA
            <span className="text-[var(--wk-brand)]">
              .
            </span>
          </div>

          <button
            type="button"
            onClick={
              handleSkip
            }
            disabled={
              finishing
            }
            className="text-[12px] font-bold text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)] disabled:opacity-50"
          >
            {isEditing
              ? "Back"
              : "Skip for now"}
          </button>
        </div>

        <div className="relative mx-auto mt-3 w-full max-w-[520px] md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:-translate-x-1/2 md:-translate-y-1/2">
          <div className="flex h-11 items-center gap-2.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 shadow-sm">
            <WkIcon
              name="Search"
              size={16}
              className="shrink-0 text-[var(--wk-text-faint)]"
            />
            <input
              value={query}
              onChange={
                (event) =>
                  setQuery(
                    event.target.value,
                  )
              }
              placeholder="Find your people"
              className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() =>
                  setQuery("")
                }
                aria-label="Clear search"
                className="text-[var(--wk-text-faint)] hover:text-[var(--wk-text)]"
              >
                <WkIcon
                  name="X"
                  size={15}
                />
              </button>
            )}
          </div>

          {query.trim() && (
            <div className="absolute left-0 right-0 top-full z-[70] mt-2 max-h-[300px] overflow-y-auto rounded-[20px] border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1.5 shadow-2xl md:left-1/2 md:right-auto md:w-[460px] md:-translate-x-1/2">
              {searchLoading ? (
                <div className="px-4 py-3 text-[12px] text-[var(--wk-text-muted)]">
                  Looking through WAKILISHA...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="px-4 py-3 text-[12px] text-[var(--wk-text-muted)]">
                  No Artist found by that name.
                </div>
              ) : (
                searchResults.map(
                  (artist) => (
                    <button
                      key={
                        artist.id
                      }
                      type="button"
                      onClick={() =>
                        handleSearchChoice(
                          artist,
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-[16px] px-3 py-2.5 text-left transition-colors hover:bg-[var(--wk-surface-raised)]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--wk-brand-soft)] text-[11px] font-black text-[var(--wk-brand)]">
                        {artist.imageUrl ? (
                          <img
                            src={
                              artist.imageUrl
                            }
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          initials(
                            artist.name,
                          )
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] font-black text-[var(--wk-text)]">
                        {artist.name}
                      </span>
                      {selectedIds.has(
                        artist.id,
                      ) && (
                        <WkIcon
                          name="Check"
                          size={15}
                          className="text-[var(--wk-brand)]"
                        />
                      )}
                    </button>
                  ),
                )
              )}
            </div>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-[1600px] px-5 pb-36 pt-[148px] md:px-10 md:pb-28 md:pt-[118px]">
        <div className="max-w-[720px]">
          <p className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-brand)]">
            {activeAnchor
              ? `Around ${activeAnchor.name}`
              : isEditing
                ? "Keep them close"
                : "Welcome to WAKILISHA"}
          </p>
          <h1 className="max-w-[680px] font-black tracking-[-0.055em] text-[42px] leading-[0.94] text-[var(--wk-text)] sm:text-[54px] md:text-[72px]">
            Your people are here.
          </h1>
          <p className="mt-5 max-w-[560px] text-[14px] leading-relaxed text-[var(--wk-text-muted)] md:text-[16px]">
            {activeAnchor
              ? `These are the Artists connected to ${activeAnchor.name}. Choose anyone to keep moving through the world around them.`
              : isEditing
                ? "Keep choosing the Artists you want around you. Every choice stays with you in Following."
                : "Find the Artists you listen to. Each choice opens another door into the culture around them."}
          </p>

          {activeAnchor && (
            <button
              type="button"
              onClick={
                clearActiveAnchor
              }
              className="mt-4 inline-flex items-center gap-2 text-[11px] font-black text-[var(--wk-text-muted)] transition-colors hover:text-[var(--wk-text)]"
            >
              <WkIcon
                name="ArrowLeft"
                size={14}
              />
              Back to your starting people
            </button>
          )}
        </div>

        {yourPeople.length > 0 && (
          <div className="mt-8 max-w-[980px]">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h2 className="text-[13px] font-black tracking-[-0.02em] text-[var(--wk-text)]">
                Your People
              </h2>
              <span className="text-[11px] font-bold tabular-nums text-[var(--wk-text-faint)]">
                {yourPeople.length}
              </span>
            </div>

            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 pt-1">
              {yourPeople.map(
                (artist) => (
                  <div
                    key={artist.id}
                    className="group relative flex w-[76px] shrink-0 flex-col items-center"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        void activateAnchor(artist);
                      }}
                      className="flex w-full flex-col items-center text-center"
                      aria-label={`Explore around ${artist.name}`}
                    >
                      <span className="block h-14 w-14 overflow-hidden rounded-full bg-[var(--wk-surface-raised)] ring-2 ring-[var(--wk-brand)] ring-offset-2 ring-offset-[var(--wk-bg)]">
                        {artist.imageUrl ? (
                          <img
                            src={artist.imageUrl}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center bg-[var(--wk-brand-soft)] text-[13px] font-black text-[var(--wk-brand)]">
                            {initials(artist.name)}
                          </span>
                        )}
                      </span>
                      <span className="mt-2 w-full truncate text-[10px] font-black text-[var(--wk-text)]">
                        {artist.name}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void unfollowArtist(artist);
                      }}
                      disabled={pendingIds.has(artist.id)}
                      aria-label={`Unfollow ${artist.name}`}
                      className="absolute right-1 top-0 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] text-[var(--wk-text-muted)] shadow-sm transition-colors hover:text-[var(--wk-text)] disabled:opacity-40"
                    >
                      <WkIcon name="X" size={10} />
                    </button>
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="mt-16 flex min-h-[420px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-[var(--wk-brand-soft)]" />
              <p className="mt-4 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                Finding your people...
              </p>
            </div>
          </div>
        ) : (
          <>
            {activeAnchor ? (
              <div className="mx-auto mt-10 flex min-h-[430px] w-full flex-wrap items-start justify-center gap-x-10 gap-y-10 md:gap-x-14 md:gap-y-12">
                {visibleArtists.map(
                  (
                    artist,
                    index,
                  ) => (
                    <ArtistPortrait
                      key={
                        artist.id
                      }
                      artist={
                        artist
                      }
                      selected={
                        selectedIds.has(
                          artist.id,
                        )
                      }
                      active={
                        activeAnchor.id
                        === artist.id
                      }
                      pending={
                        pendingIds.has(
                          artist.id,
                        )
                      }
                      muted={
                        false
                      }
                      size={
                        index === 0
                          ? 148
                          : RELATIONSHIP_DESKTOP_SIZES[
                              index
                              % RELATIONSHIP_DESKTOP_SIZES.length
                            ]
                      }
                      onChoose={() => {
                        if (
                          activeAnchor.id
                          === artist.id
                        ) {
                          void unfollowArtist(
                            artist,
                          );
                          return;
                        }

                        void chooseArtist(
                          artist,
                        );
                      }}
                      onUnfollow={() =>
                        void unfollowArtist(
                          artist,
                        )
                      }
                    />
                  ),
                )}

                {relationshipLoading && (
                  <div className="flex w-full items-center justify-center pt-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    Opening the Artists around {activeAnchor.name}...
                  </div>
                )}

                {!relationshipLoading
                  && activeRelated.length === 0
                  && (
                    <div className="w-full text-center text-[11px] text-[var(--wk-text-muted)]">
                      No other Artists are connected here yet. Search above or go back to your starting people.
                    </div>
                  )}
              </div>
            ) : (
              <div className="relative mx-auto mt-8 hidden h-[min(64vh,690px)] min-h-[570px] w-full md:block">
                {visibleArtists.map(
                  (
                    artist,
                    index,
                  ) => {
                    const slot =
                      DESKTOP_SLOTS[
                        index
                        % DESKTOP_SLOTS.length
                      ];

                    return (
                      <div
                        key={
                          artist.id
                        }
                        className="absolute transition-all duration-500"
                        style={{
                          left:
                            `${slot.left}%`,
                          top:
                            `${slot.top}%`,
                          transform:
                            "translate(-50%, -50%)",
                        }}
                      >
                        <ArtistPortrait
                          artist={
                            artist
                          }
                          selected={
                            selectedIds.has(
                              artist.id,
                            )
                          }
                          active={
                            false
                          }
                          pending={
                            pendingIds.has(
                              artist.id,
                            )
                          }
                          muted={
                            selectedCount
                            > 0
                          }
                          size={
                            slot.size
                          }
                          onChoose={() =>
                            void chooseArtist(
                              artist,
                            )
                          }
                          onUnfollow={() =>
                            void unfollowArtist(
                              artist,
                            )
                          }
                        />
                      </div>
                    );
                  },
                )}
              </div>
            )}

            <div className="mt-12 flex flex-wrap items-start justify-center gap-x-5 gap-y-8 md:hidden">
              {mobileArtists.map(
                (
                  artist,
                  index,
                ) => (
                  <ArtistPortrait
                    key={
                      artist.id
                    }
                    artist={
                      artist
                    }
                    selected={
                      selectedIds.has(
                        artist.id,
                      )
                    }
                    active={
                      activeAnchor?.id
                      === artist.id
                    }
                    pending={
                      pendingIds.has(
                        artist.id,
                      )
                    }
                    muted={
                      false
                    }
                    size={
                      activeAnchor
                        ? index === 0
                          ? 122
                          : RELATIONSHIP_MOBILE_SIZES[
                              index
                              % RELATIONSHIP_MOBILE_SIZES.length
                            ]
                        : MOBILE_SIZES[
                            index
                            % MOBILE_SIZES.length
                          ]
                    }
                    onChoose={() => {
                      if (
                        activeAnchor?.id
                        === artist.id
                      ) {
                        void unfollowArtist(
                          artist,
                        );
                        return;
                      }

                      void chooseArtist(
                        artist,
                      );
                    }}
                    onUnfollow={() =>
                      void unfollowArtist(
                        artist,
                      )
                    }
                  />
                ),
              )}

              {activeAnchor
                && relationshipLoading
                && (
                  <div className="w-full text-center text-[11px] font-semibold text-[var(--wk-text-muted)]">
                    Opening the Artists around {activeAnchor.name}...
                  </div>
                )}

              {activeAnchor
                && !relationshipLoading
                && activeRelated.length === 0
                && (
                  <div className="w-full text-center text-[11px] text-[var(--wk-text-muted)]">
                    No other Artists are connected here yet. Search above or go back to your starting people.
                  </div>
                )}
            </div>
          </>
        )}
      </section>

      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--wk-border)] bg-[var(--wk-bg)]/94 px-4 py-3 backdrop-blur-xl md:px-8">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[12px] font-black text-[var(--wk-text)]">
              {selectedCount}
              {" chosen"}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-[var(--wk-text-muted)]">
              {activeAnchor
                ? `${activeRelated.length} Artists around ${activeAnchor.name}.`
                : isEditing
                  ? "Your changes save as you make them."
                  : selectedCount > 0
                    ? "Saved to Following. Choose someone to explore."
                    : "Choose someone to start."}
            </div>
          </div>

          <button
            type="button"
            onClick={
              handleEnter
            }
            disabled={
              !canEnter
              || finishing
            }
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 text-[12px] font-black text-[var(--wk-brand-on)] shadow-[0_10px_30px_rgba(var(--wk-brand-rgb),0.22)] transition-all hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0"
          >
            {finishing
              ? "Saving..."
              : isEditing
                ? "Done"
                : "Enter WAKILISHA"}
            {!finishing && (
              <WkIcon
                name="ArrowRight"
                size={15}
              />
            )}
          </button>
        </div>

        {error && (
          <div className="mx-auto mt-2 max-w-[1600px] text-right text-[11px] font-bold text-[var(--wk-danger)]">
            {error}
          </div>
        )}
      </footer>
    </main>
  );
}
