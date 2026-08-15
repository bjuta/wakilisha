import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import {
  useArtistSearchData,
  type ArtistSearchItem,
} from "@/hooks/useArtistSearchData";
import { getPublicArtistRelationships } from "@/services/publicArtistRelationships";
import {
  getRegistryArtistStructuralProximity,
  getRegistryOnboardingArtists,
} from "@/services/community/registryOnboarding";
import {
  buildGuestFollowSignupUrl,
  createGuestFollowIntent,
  readGuestFollowingDraft,
  writeGuestFollowingDraft,
} from "@/services/community/guestFollowIntent";

type GuestArtist = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  canonicalPath: string;
};


const DESKTOP_SLOTS = [
  { left: 12, top: 16, size: 108 },
  { left: 31, top: 8, size: 136 },
  { left: 51, top: 20, size: 96 },
  { left: 70, top: 9, size: 124 },
  { left: 88, top: 19, size: 104 },
  { left: 18, top: 48, size: 132 },
  { left: 38, top: 42, size: 98 },
  { left: 58, top: 52, size: 144 },
  { left: 78, top: 43, size: 104 },
  { left: 91, top: 55, size: 118 },
  { left: 10, top: 82, size: 94 },
  { left: 28, top: 75, size: 118 },
  { left: 47, top: 84, size: 100 },
  { left: 67, top: 76, size: 128 },
  { left: 86, top: 84, size: 102 },
  { left: 42, top: 7, size: 78 },
] as const;

const MOBILE_VISIBLE_LIMIT = 14;

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
  148,
  102,
  132,
  92,
  116,
  98,
  138,
  106,
  124,
  90,
  112,
  100,
] as const;

const RELATIONSHIP_VERTICAL_OFFSETS = [
  0,
  22,
  -14,
  30,
  -20,
  12,
  28,
  -8,
  18,
  -24,
  8,
  26,
] as const;

const RELATIONSHIP_MOBILE_SIZES = [
  122,
  82,
  104,
  88,
  98,
  78,
  108,
  86,
] as const;

function fromSearch(
  artist: ArtistSearchItem,
): GuestArtist {
  return {
    id: artist.id,
    slug: artist.slug,
    name: artist.name,
    imageUrl: artist.imageUrl || null,
    canonicalPath:
      `/artists/${artist.slug}`,
  };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) =>
      word[0]?.toUpperCase() || "",
    )
    .join("");
}

async function relatedArtistsFor(
  artist: GuestArtist,
): Promise<GuestArtist[]> {
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

  const byId =
    new Map<string, GuestArtist>();

  structuralRelationships.forEach(
    (relationship) => {
      if (
        relationship.relatedArtistId === artist.id
        || !relationship.relatedArtistSlug.trim()
      ) {
        return;
      }

      byId.set(
        relationship.relatedArtistId,
        {
          id:
            relationship.relatedArtistId,
          slug:
            relationship.relatedArtistSlug,
          name:
            relationship.relatedArtistName,
          imageUrl:
            relationship.relatedArtistImageUrl,
          canonicalPath:
            `/artists/${relationship.relatedArtistSlug}`,
        },
      );
    },
  );

  reviewedRelationships
    .filter(
      (relationship) =>
        relationship.relatedEntityType === "artist",
    )
    .forEach(
      (relationship) => {
        if (
          relationship.relatedEntityId === artist.id
          || !relationship.relatedEntitySlug.trim()
        ) {
          return;
        }

        const existing =
          byId.get(
            relationship.relatedEntityId,
          );

        byId.set(
          relationship.relatedEntityId,
          {
            id:
              relationship.relatedEntityId,
            slug:
              relationship.relatedEntitySlug,
            name:
              relationship.relatedEntityName,
            imageUrl:
              existing?.imageUrl
              || relationship.relatedEntityImageUrl,
            canonicalPath:
              relationship.relatedEntityUrl
              || existing?.canonicalPath
              || `/artists/${relationship.relatedEntitySlug}`,
          },
        );
      },
    );

  return Array.from(
    byId.values(),
  );
}

function GuestPortrait({
  artist,
  selected,
  active,
  size,
  onChoose,
  onRemove,
}: {
  artist: GuestArtist;
  selected: boolean;
  active: boolean;
  size: number;
  onChoose: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      <button
        type="button"
        onClick={onChoose}
        aria-pressed={active}
        aria-label={`Explore ${artist.name}`}
        className="group cursor-pointer"
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
            <span className="flex h-full w-full items-center justify-center bg-[var(--wk-brand-soft)] text-[18px] font-black text-[var(--wk-brand)]">
              {initials(artist.name)}
            </span>
          )}
        </span>
      </button>

      {selected && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${artist.name}`}
          className="absolute right-[4px] flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] shadow-lg transition-transform hover:scale-105"
          style={{
            top: Math.max(0, size - 26),
          }}
        >
          <WkIcon
            name="Check"
            size={14}
          />
        </button>
      )}

      <span
        className={`mt-3 max-w-[150px] text-[11px] font-black leading-tight tracking-[-0.015em] sm:text-[12px] ${
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

export function GuestFollowingPicker() {
  const {
    data: allArtists,
    loading: searchLoading,
  } = useArtistSearchData();

  const [opening, setOpening] =
    useState<GuestArtist[]>([]);
  const [selectedIds, setSelectedIds] =
    useState<Set<string>>(
      () =>
        new Set(
          readGuestFollowingDraft(),
        ),
    );
  const [activeAnchor, setActiveAnchor] =
    useState<GuestArtist | null>(null);
  const [activeRelated, setActiveRelated] =
    useState<GuestArtist[]>([]);
  const [query, setQuery] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [relationshipLoading, setRelationshipLoading] =
    useState(false);
  const [finishing, setFinishing] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    let alive = true;

    getRegistryOnboardingArtists(16)
      .then((response) => {
        if (!alive) {
          return;
        }

        setOpening(
          response.artists.map(
            (artist) => ({
              id: artist.targetId,
              slug: artist.targetSlug,
              name: artist.displayName,
              imageUrl: artist.imageUrl,
              canonicalPath:
                artist.canonicalPath,
            }),
          ),
        );
      })
      .catch((nextError) => {
        console.error(
          "Could not load guest Following Artists:",
          nextError,
        );

        if (alive) {
          setError(
            "We could not open your people right now.",
          );
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    writeGuestFollowingDraft(
      Array.from(selectedIds),
    );
  }, [selectedIds]);

  const searchResults =
    useMemo(() => {
      const clean =
        query.trim().toLowerCase();

      if (!clean) {
        return [];
      }

      return allArtists
        .filter((artist) =>
          artist.name
            .toLowerCase()
            .includes(clean),
        )
        .slice(0, 5);
    }, [
      allArtists,
      query,
    ]);

  const selectedArtists =
    useMemo(
      () =>
        allArtists
          .filter((artist) =>
            selectedIds.has(artist.id),
          )
          .map(fromSearch),
      [
        allArtists,
        selectedIds,
      ],
    );

  const visibleArtists =
    useMemo(() => {
      if (!activeAnchor) {
        return opening;
      }

      const byId =
        new Map<string, GuestArtist>();
      byId.set(
        activeAnchor.id,
        activeAnchor,
      );
      activeRelated.forEach((artist) =>
        byId.set(artist.id, artist),
      );
      return Array.from(byId.values());
    }, [
      activeAnchor,
      activeRelated,
      opening,
    ]);

  const openArtist =
    useCallback(
      async (artist: GuestArtist) => {
        setSelectedIds((current) => {
          const next = new Set(current);
          next.add(artist.id);
          return next;
        });
        setActiveAnchor(artist);
        setActiveRelated([]);
        setRelationshipLoading(true);
        setError(null);

        const nextRequestId =
          requestId.current + 1;
        requestId.current =
          nextRequestId;

        try {
          const related =
            await relatedArtistsFor(artist);

          if (
            requestId.current
            === nextRequestId
          ) {
            setActiveRelated(related);
          }
        } catch (nextError) {
          console.error(
            "Could not load Artists around this Artist:",
            nextError,
          );

          if (
            requestId.current
            === nextRequestId
          ) {
            setError(
              `We could not open the Artists around ${artist.name} right now.`,
            );
          }
        } finally {
          if (
            requestId.current
            === nextRequestId
          ) {
            setRelationshipLoading(false);
          }
        }
      },
      [],
    );

  const removeArtist =
    useCallback(
      (artist: GuestArtist) => {
        setSelectedIds((current) => {
          const next = new Set(current);
          next.delete(artist.id);
          return next;
        });

        if (
          activeAnchor?.id === artist.id
        ) {
          requestId.current += 1;
          setActiveAnchor(null);
          setActiveRelated([]);
          setRelationshipLoading(false);
        }
      },
      [activeAnchor?.id],
    );

  const finish = async () => {
    if (
      selectedIds.size === 0
      || finishing
    ) {
      return;
    }

    setFinishing(true);
    setError(null);

    try {
      const intent =
        await createGuestFollowIntent(
          Array.from(selectedIds),
        );

      window.location.assign(
        buildGuestFollowSignupUrl(
          intent.token,
        ),
      );
    } catch (nextError) {
      console.error(
        "Could not keep guest Following choices:",
        nextError,
      );
      setError(
        "We could not keep those Artists yet. Try once more.",
      );
      setFinishing(false);
    }
  };

  return (
    <section
      data-guest-following-picker
      className="border-y border-[var(--wk-divider)] py-7 md:rounded-[28px] md:border md:bg-[var(--wk-surface)] md:px-7 md:py-8"
    >
      <div className="px-4 md:px-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[26px] font-black tracking-[-0.04em] md:text-[32px]">
              Your People Are Here
            </h2>
            <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
              Pick a few Artists you want to keep up with. We’ll keep them when you create your account.
            </p>
          </div>

          {selectedIds.size > 0 && (
            <span className="shrink-0 rounded-full bg-[var(--wk-brand-soft)] px-3 py-1.5 text-[11px] font-black text-[var(--wk-brand)]">
              {selectedIds.size} Chosen
            </span>
          )}
        </div>

        <div className="relative mt-5">
          <WkIcon
            name="Search"
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--wk-text-faint)]"
          />
          <input
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search Artists"
            className="h-12 w-full rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-11 pr-4 text-[13px] font-semibold text-[var(--wk-text)] outline-none transition-colors placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-brand)]"
          />

          {query.trim() && (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg)] shadow-xl">
              {searchLoading ? (
                <div className="px-4 py-4 text-[12px] text-[var(--wk-text-muted)]">
                  Looking through the Registry...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((artist) => (
                  <button
                    key={artist.id}
                    type="button"
                    onClick={() => {
                      setQuery("");
                      void openArtist(
                        fromSearch(artist),
                      );
                    }}
                    className="flex w-full items-center gap-3 border-b border-[var(--wk-divider)] px-4 py-3 text-left last:border-b-0 hover:bg-[var(--wk-surface-raised)]"
                  >
                    {artist.imageUrl ? (
                      <img
                        src={artist.imageUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[11px] font-black text-[var(--wk-brand)]">
                        {initials(artist.name)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[13px] font-black">
                      {artist.name}
                    </span>
                    {selectedIds.has(artist.id) && (
                      <WkIcon
                        name="Check"
                        size={16}
                        className="text-[var(--wk-brand)]"
                      />
                    )}
                  </button>
                ))
              ) : (
                <div className="px-4 py-4 text-[12px] text-[var(--wk-text-muted)]">
                  No matching Artist yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedArtists.length > 0 && (
        <div className="mt-6">
          <div className="px-4 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-faint)] md:px-0">
            Your People
          </div>
          <div className="mt-3 overflow-x-auto px-4 pb-2 pt-1 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="flex w-max gap-3 pr-2">
              {selectedArtists.map((artist) => (
                <button
                  key={artist.id}
                  type="button"
                  onClick={() =>
                    void openArtist(artist)
                  }
                  className="flex w-[58px] shrink-0 flex-col items-center gap-1.5"
                >
                  {artist.imageUrl ? (
                    <img
                      src={artist.imageUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover ring-2 ring-[var(--wk-brand)] ring-offset-2 ring-offset-[var(--wk-bg)]"
                    />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[10px] font-black text-[var(--wk-brand)] ring-2 ring-[var(--wk-brand)] ring-offset-2 ring-offset-[var(--wk-bg)]">
                      {initials(artist.name)}
                    </span>
                  )}
                  <span className="w-full truncate text-[9px] font-bold text-[var(--wk-text-muted)]">
                    {artist.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-7 px-4 md:px-0">
        {activeAnchor && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black text-[var(--wk-text)]">
                Artists Around {activeAnchor.name}
              </p>
              <p className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
                {relationshipLoading
                  ? "Opening this part of the Registry..."
                  : activeRelated.length > 0
                    ? `${activeRelated.length} Artists connected through the music.`
                    : "We don’t have more Artists around this person yet."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                requestId.current += 1;
                setActiveAnchor(null);
                setActiveRelated([]);
                setRelationshipLoading(false);
              }}
              className="shrink-0 text-[11px] font-black text-[var(--wk-brand)] hover:underline"
            >
              Back to Your People
            </button>
          </div>
        )}

        {loading ? (
          <>
            <div className="relative mx-auto hidden h-[min(64vh,690px)] min-h-[570px] w-full md:block">
              {DESKTOP_SLOTS.slice(0, 12).map(
                (slot, index) => (
                  <div
                    key={index}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{
                      left: `${slot.left}%`,
                      top: `${slot.top}%`,
                    }}
                  >
                    <div
                      className="animate-pulse rounded-full bg-[var(--wk-surface-raised)]"
                      style={{
                        width: slot.size,
                        height: slot.size,
                      }}
                    />
                  </div>
                ),
              )}
            </div>

            <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-8 md:hidden">
              {MOBILE_SIZES.map(
                (size, index) => (
                  <div
                    key={index}
                    className="animate-pulse rounded-full bg-[var(--wk-surface-raised)]"
                    style={{
                      width: size,
                      height: size,
                    }}
                  />
                ),
              )}
            </div>
          </>
        ) : (
          <>
            {activeAnchor ? (
              <div className="mx-auto hidden min-h-[520px] w-full flex-wrap items-start justify-center gap-x-10 gap-y-14 overflow-visible pb-14 pt-8 md:flex md:gap-x-14">
                {visibleArtists.map(
                  (artist, index) => (
                    <div
                      key={artist.id}
                      className="transition-transform duration-500"
                      style={{
                        transform: `translateY(${
                          RELATIONSHIP_VERTICAL_OFFSETS[
                            index
                            % RELATIONSHIP_VERTICAL_OFFSETS.length
                          ]
                        }px)`,
                      }}
                    >
                      <GuestPortrait
                        artist={artist}
                        selected={
                          selectedIds.has(artist.id)
                        }
                        active={
                          activeAnchor.id
                          === artist.id
                        }
                        size={
                          RELATIONSHIP_DESKTOP_SIZES[
                            index
                            % RELATIONSHIP_DESKTOP_SIZES.length
                          ]
                        }
                        onChoose={() =>
                          void openArtist(artist)
                        }
                        onRemove={() =>
                          removeArtist(artist)
                        }
                      />
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div className="relative mx-auto hidden h-[min(64vh,690px)] min-h-[570px] w-full md:block">
                {visibleArtists.map(
                  (artist, index) => {
                    const slot =
                      DESKTOP_SLOTS[
                        index
                        % DESKTOP_SLOTS.length
                      ];

                    return (
                      <div
                        key={artist.id}
                        className="absolute transition-all duration-500"
                        style={{
                          left: `${slot.left}%`,
                          top: `${slot.top}%`,
                          transform:
                            "translate(-50%, -50%)",
                        }}
                      >
                        <GuestPortrait
                          artist={artist}
                          selected={
                            selectedIds.has(artist.id)
                          }
                          active={false}
                          size={slot.size}
                          onChoose={() =>
                            void openArtist(artist)
                          }
                          onRemove={() =>
                            removeArtist(artist)
                          }
                        />
                      </div>
                    );
                  },
                )}
              </div>
            )}

            <div className="flex flex-wrap items-start justify-center gap-x-5 gap-y-8 md:hidden">
              {visibleArtists
                .slice(
                  0,
                  activeAnchor
                    ? visibleArtists.length
                    : MOBILE_VISIBLE_LIMIT,
                )
                .map(
                  (artist, index) => (
                    <div
                      key={artist.id}
                      style={{
                        transform: `translateY(${
                          activeAnchor
                            ? RELATIONSHIP_VERTICAL_OFFSETS[
                                index
                                % RELATIONSHIP_VERTICAL_OFFSETS.length
                              ] / 2
                            : 0
                        }px)`,
                      }}
                    >
                      <GuestPortrait
                        artist={artist}
                        selected={
                          selectedIds.has(artist.id)
                        }
                        active={
                          activeAnchor?.id
                          === artist.id
                        }
                        size={
                          activeAnchor
                            ? RELATIONSHIP_MOBILE_SIZES[
                                index
                                % RELATIONSHIP_MOBILE_SIZES.length
                              ]
                            : MOBILE_SIZES[
                                index
                                % MOBILE_SIZES.length
                              ]
                        }
                        onChoose={() =>
                          void openArtist(artist)
                        }
                        onRemove={() =>
                          removeArtist(artist)
                        }
                      />
                    </div>
                  ),
                )}
            </div>
          </>
        )}

        {error && (
          <div className="mt-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[12px] text-[var(--wk-text-muted)]">
            {error}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-[var(--wk-divider)] pt-5">
          <p className="max-w-sm text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
            Your choices become real Follows after you create your account.
          </p>
          <button
            type="button"
            onClick={finish}
            disabled={
              selectedIds.size === 0
              || finishing
            }
            className="shrink-0 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[12px] font-black text-[var(--wk-brand-on)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {finishing
              ? "Keeping Your People..."
              : "Done"}
          </button>
        </div>
      </div>
    </section>
  );
}
