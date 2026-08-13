import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { useAdminUser } from "@/hooks/useAdminUser";
import {
  useArtistSearchData,
  type ArtistSearchItem,
} from "@/hooks/useArtistSearchData";
import {
  getAdminRegistryOnboardingConfig,
  setAdminRegistryOnboardingConfig,
  type AdminRegistryOnboardingArtist,
} from "@/services/community";

const OPENING_LIMIT = 16;

function fromSearch(
  artist: ArtistSearchItem,
  order: number,
): AdminRegistryOnboardingArtist {
  return {
    artistId: artist.id,
    artistSlug: artist.slug,
    artistName: artist.name,
    artistImage:
      artist.imageUrl || null,
    artistStatus: "active",
    displayOrder: order,
  };
}

export default function AdminSettingsOnboardingPage() {
  const admin = useAdminUser();
  const {
    data: allArtists,
    loading: artistsLoading,
  } = useArtistSearchData();

  const [artists, setArtists] =
    useState<
      AdminRegistryOnboardingArtist[]
    >([]);
  const [
    fallbackEnabled,
    setFallbackEnabled,
  ] = useState(true);
  const [search, setSearch] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);
  const [error, setError] =
    useState<string | null>(null);

  const isAdministrator =
    admin.role
    === "administrator";

  useEffect(() => {
    if (admin.loading) {
      return;
    }

    if (!isAdministrator) {
      setLoading(false);
      return;
    }

    let alive = true;

    getAdminRegistryOnboardingConfig()
      .then((config) => {
        if (!alive) {
          return;
        }

        setArtists(
          config.artists,
        );
        setFallbackEnabled(
          config.fallbackEnabled,
        );
      })
      .catch((nextError) => {
        console.error(
          "Could not load onboarding settings:",
          nextError,
        );

        if (alive) {
          setError(
            "Could not load onboarding settings.",
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
  }, [
    admin.loading,
    isAdministrator,
  ]);

  const selectedSlugs =
    useMemo(
      () =>
        new Set(
          artists.map(
            (artist) =>
              artist.artistSlug,
          ),
        ),
      [artists],
    );

  const searchResults =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return [];
      }

      return allArtists
        .filter(
          (artist) =>
            Boolean(
              artist.imageUrl,
            ),
        )
        .filter(
          (artist) =>
            !selectedSlugs.has(
              artist.slug,
            ),
        )
        .filter(
          (artist) =>
            artist.name
              .toLowerCase()
              .includes(query),
        )
        .slice(
          0,
          8,
        );
    }, [
      allArtists,
      search,
      selectedSlugs,
    ]);

  const normalizeOrder =
    (
      next:
        AdminRegistryOnboardingArtist[],
    ) =>
      next.map(
        (
          artist,
          index,
        ) => ({
          ...artist,
          displayOrder:
            index,
        }),
      );

  const addArtist =
    (
      artist: ArtistSearchItem,
    ) => {
      if (
        artists.length
        >= OPENING_LIMIT
      ) {
        return;
      }

      setArtists(
        normalizeOrder([
          ...artists,
          fromSearch(
            artist,
            artists.length,
          ),
        ]),
      );
      setSearch("");
      setMessage(null);
    };

  const removeArtist =
    (
      artistId: string,
    ) => {
      setArtists(
        normalizeOrder(
          artists.filter(
            (artist) =>
              artist.artistId
              !== artistId,
          ),
        ),
      );
      setMessage(null);
    };

  const moveArtist =
    (
      index: number,
      direction:
        "up" | "down",
    ) => {
      const target =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        target < 0
        || target
        >= artists.length
      ) {
        return;
      }

      const next =
        [...artists];
      [
        next[index],
        next[target],
      ] = [
        next[target],
        next[index],
      ];

      setArtists(
        normalizeOrder(
          next,
        ),
      );
      setMessage(null);
    };

  const save =
    async () => {
      setSaving(true);
      setError(null);
      setMessage(null);

      try {
        await setAdminRegistryOnboardingConfig(
          artists.map(
            (artist) =>
              artist.artistSlug,
          ),
          fallbackEnabled,
        );
        setMessage(
          "Onboarding opening field saved.",
        );
      } catch (nextError) {
        console.error(
          "Could not save onboarding settings:",
          nextError,
        );
        setError(
          "Could not save the onboarding opening field.",
        );
      } finally {
        setSaving(false);
      }
    };

  if (
    admin.loading
    || loading
  ) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--wk-surface-raised)]" />
        <div className="h-36 animate-pulse rounded-xl bg-[var(--wk-surface-raised)]" />
      </div>
    );
  }

  if (!isAdministrator) {
    return (
      <WkSurface className="p-6">
        <h1 className="text-[20px] font-black text-[var(--wk-text)]">
          Onboarding
        </h1>
        <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
          Only administrators can change who appears when people first enter WAKILISHA.
        </p>
      </WkSurface>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 text-[11px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
          Your people are here
        </div>
        <h1 className="text-[24px] font-black tracking-[-0.03em] text-[var(--wk-text)]">
          Onboarding
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
          Choose the Artists who welcome people into WAKILISHA. Their order becomes the opening field.
        </p>
      </div>

      <WkSurface className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex-1">
            <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
              Find an Artist
            </label>

            <div className="relative max-w-xl">
              <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3">
                <WkIcon
                  name="Search"
                  size={15}
                  className="text-[var(--wk-text-faint)]"
                />
                <input
                  value={search}
                  onChange={
                    (event) =>
                      setSearch(
                        event.target.value,
                      )
                  }
                  placeholder="Search the Registry by Artist name"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
                />
              </div>

              {search.trim() && (
                <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-1 shadow-xl">
                  {artistsLoading ? (
                    <div className="px-3 py-3 text-[12px] text-[var(--wk-text-muted)]">
                      Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-3 py-3 text-[12px] text-[var(--wk-text-muted)]">
                      {artists.length >= OPENING_LIMIT
                        ? "The opening field is full."
                        : "No Artist found by that name."}
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
                            addArtist(
                              artist,
                            )
                          }
                          disabled={
                            artists.length
                            >= OPENING_LIMIT
                          }
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-[var(--wk-surface-raised)] disabled:opacity-40"
                        >
                          <img
                            src={
                              artist.imageUrl
                            }
                            alt=""
                            className="h-9 w-9 rounded-full object-cover"
                          />
                          <span className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--wk-text)]">
                            {artist.name}
                          </span>
                          <WkIcon
                            name="Plus"
                            size={14}
                            className="text-[var(--wk-brand)]"
                          />
                        </button>
                      ),
                    )
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="text-[12px] font-bold text-[var(--wk-text-muted)]">
            {artists.length}
            {" "}
            of
            {" "}
            {OPENING_LIMIT}
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[14px] font-black text-[var(--wk-text)]">
              Opening Field
            </h2>
            <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
              The first Artists people see. Use the arrows to set the order.
            </p>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <input
              type="checkbox"
              checked={
                fallbackEnabled
              }
              onChange={
                (event) => {
                  setFallbackEnabled(
                    event.target.checked,
                  );
                  setMessage(null);
                }
              }
              className="h-4 w-4 accent-[var(--wk-brand)]"
            />
            <span>
              <span className="block text-[12px] font-black text-[var(--wk-text)]">
                Fill open spaces
              </span>
              <span className="mt-0.5 block text-[10px] text-[var(--wk-text-muted)]">
                WAKILISHA fills the rest when fewer than 16 are chosen.
              </span>
            </span>
          </label>
        </div>

        {artists.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--wk-border)] px-5 py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]">
              <WkIcon
                name="Users"
                size={20}
              />
            </div>
            <p className="mt-3 text-[13px] font-black text-[var(--wk-text)]">
              No editorial Artists yet
            </p>
            <p className="mt-1 text-[11px] text-[var(--wk-text-muted)]">
              {fallbackEnabled
                ? "WAKILISHA will use its governed fallback until you choose them."
                : "Turn on Fill open spaces or add Artists above."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {artists.map(
              (
                artist,
                index,
              ) => (
                <div
                  key={
                    artist.artistId
                  }
                  className="flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--wk-brand)] text-[10px] font-black text-[var(--wk-brand-on)]">
                    {index + 1}
                  </span>

                  {artist.artistImage ? (
                    <img
                      src={
                        artist.artistImage
                      }
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-full bg-[var(--wk-surface-raised)]" />
                  )}

                  <span className="min-w-0 flex-1 truncate text-[13px] font-black text-[var(--wk-text)]">
                    {artist.artistName}
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        moveArtist(
                          index,
                          "up",
                        )
                      }
                      disabled={
                        index === 0
                      }
                      aria-label={`Move ${artist.artistName} up`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] disabled:opacity-25"
                    >
                      <WkIcon
                        name="ChevronUp"
                        size={14}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        moveArtist(
                          index,
                          "down",
                        )
                      }
                      disabled={
                        index
                        === artists.length
                          - 1
                      }
                      aria-label={`Move ${artist.artistName} down`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--wk-border)] text-[var(--wk-text-muted)] disabled:opacity-25"
                    >
                      <WkIcon
                        name="ChevronDown"
                        size={14}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        removeArtist(
                          artist.artistId,
                        )
                      }
                      aria-label={`Remove ${artist.artistName}`}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--wk-text-faint)] hover:bg-[var(--wk-danger-soft)] hover:text-[var(--wk-danger)]"
                    >
                      <WkIcon
                        name="X"
                        size={14}
                      />
                    </button>
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </WkSurface>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3">
        <div className="min-w-0">
          {error ? (
            <p className="text-[12px] font-bold text-[var(--wk-danger)]">
              {error}
            </p>
          ) : message ? (
            <p className="text-[12px] font-bold text-[var(--wk-success)]">
              {message}
            </p>
          ) : (
            <p className="text-[11px] text-[var(--wk-text-muted)]">
              Changes go live the next time onboarding opens.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={
            save
          }
          disabled={
            saving
          }
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wk-brand)] px-4 text-[12px] font-black text-[var(--wk-brand-on)] disabled:opacity-50"
        >
          {saving
            ? "Saving..."
            : "Save Onboarding"}
        </button>
      </div>
    </div>
  );
}
