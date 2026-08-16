import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  WkIcon,
} from "@/components/design-system/Icon";
import {
  WkButton,
} from "@/components/design-system/primitives/Button";
import {
  PlaylistCoverPresentation,
} from "@/components/media/PlaylistCoverPresentation";
import {
  MetaTags,
} from "@/components/seo/MetaTags";
import {
  useAuthUser,
} from "@/hooks/useAuthUser";
import {
  getUserProfileWithStats,
} from "@/services/community";
import {
  listPublicPlaylists,
} from "@/services/playlists/playlistPublicService";
import type {
  PublicPlaylistListItem,
} from "@/services/playlists/playlistPublicModel";

const PAGE_SIZE = 20;

function PlaylistCard({
  playlist,
}: {
  playlist: PublicPlaylistListItem;
}) {
  return (
    <Link
      to={
        `/playlists/${playlist.slug}`
      }
      className="group block min-w-0"
    >
      <div className="aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
        <PlaylistCoverPresentation
          src={
            playlist.coverUrl
          }
          altText={
            playlist.coverAltText
          }
          slug={
            playlist.slug
          }
          title={
            playlist.title
          }
          loading="lazy"
          imageClassName="transition-transform duration-500 group-hover:scale-[1.02]"
        />
      </div>

      <div className="pt-3">
        <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--wk-brand)]">
          {
            playlist.curatorLabel ??
            "WAKILISHA"
          }
        </div>

        <h2 className="text-[15px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--wk-text)] transition-colors group-hover:text-[var(--wk-brand)]">
          {
            playlist.title
          }
        </h2>

        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)]">
          <span>
            {
              playlist.itemCount
            } tracks
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function PublicPlaylistsPage() {
  const authUser =
    useAuthUser();

  const [
    personalPlaylistUsername,
    setPersonalPlaylistUsername,
  ] = useState("");

  const [
    playlists,
    setPlaylists,
  ] = useState<
    PublicPlaylistListItem[]
  >(
    [],
  );

  const [
    loading,
    setLoading,
  ] = useState(
    true,
  );

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(
    false,
  );

  const [
    error,
    setError,
  ] = useState<
    string | null
  >(
    null,
  );

  const [
    hasMore,
    setHasMore,
  ] = useState(
    false,
  );

  const loadInitial =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        setError(
          null,
        );

        try {
          const result =
            await listPublicPlaylists(
              {
                limit:
                  PAGE_SIZE,
              },
            );

          setPlaylists(
            result,
          );

          setHasMore(
            result.length ===
              PAGE_SIZE,
          );
        } catch {
          setError(
            "Could not load Playlists.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadInitial();
    },
    [
      loadInitial,
    ],
  );

  useEffect(
    () => {
      let alive = true;

      if (!authUser.id) {
        setPersonalPlaylistUsername("");
        return () => {
          alive = false;
        };
      }

      getUserProfileWithStats(
        authUser.id,
      )
        .then((profile) => {
          if (alive) {
            setPersonalPlaylistUsername(
              profile?.username ?? "",
            );
          }
        })
        .catch(() => {
          if (alive) {
            setPersonalPlaylistUsername("");
          }
        });

      return () => {
        alive = false;
      };
    },
    [
      authUser.id,
    ],
  );

  const loadMore =
    useCallback(
      async () => {
        if (
          loadingMore
        ) {
          return;
        }

        const last =
          playlists[
            playlists.length -
              1
          ];

        if (
          !last
        ) {
          return;
        }

        setLoadingMore(
          true,
        );

        setError(
          null,
        );

        try {
          const result =
            await listPublicPlaylists(
              {
                limit:
                  PAGE_SIZE,
                cursor: {
                  publishedAt:
                    last.publishedAt,
                  snapshotId:
                    last.snapshotId,
                },
              },
            );

          setPlaylists(
            (
              current,
            ) => {
              const known =
                new Set(
                  current.map(
                    (
                      item,
                    ) =>
                      item.snapshotId,
                  ),
                );

              return [
                ...current,
                ...result.filter(
                  (
                    item,
                  ) =>
                    !known.has(
                      item.snapshotId,
                    ),
                ),
              ];
            },
          );

          setHasMore(
            result.length ===
              PAGE_SIZE,
          );
        } catch {
          setError(
            "Could not load more Playlists.",
          );
        } finally {
          setLoadingMore(
            false,
          );
        }
      },
      [
        loadingMore,
        playlists,
      ],
    );

  return (
    <>
      <MetaTags
        title="Playlists"
        description="Curated Playlists from WAKILISHA. New releases, deep cuts, scenes, moods, and moments worth hearing."
        url="https://wakilisha.africa/playlists"
      />

      <main className="min-h-screen bg-[var(--wk-bg)] pb-28">
        <section className="border-b border-[var(--wk-border)]">
          <div className="wk-container-wide px-5 py-12 md:px-6 md:py-16">
            <div className="wk-eyebrow">
              WAKILISHA
            </div>

            <h1 className="wk-h-page mt-4">
              Playlists
            </h1>

            <p className="wk-copy mt-5 max-w-2xl text-[16px]">
              Curated music from WAKILISHA. New releases, deep cuts, scenes, moods, and moments worth hearing.
            </p>

            {!authUser.loading && authUser.id && personalPlaylistUsername ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <Link
                  to={`/u/${personalPlaylistUsername}/playlists`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--wk-border)] px-3 text-xs font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                >
                  <WkIcon
                    name="ListMusic"
                    size={14}
                  />
                  Your Playlists
                </Link>

                <Link
                  to={`/u/${personalPlaylistUsername}/playlists?create=1`}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-3 text-xs font-black text-white"
                >
                  <WkIcon
                    name="Plus"
                    size={14}
                  />
                  Create Playlist
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        <div className="wk-container-wide px-5 py-10 md:px-6 md:py-14">
          {
            loading
              ? (
                  <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {
                      Array.from(
                        {
                          length:
                            8,
                        },
                      ).map(
                        (
                          _,
                          index,
                        ) => (
                          <div
                            key={
                              index
                            }
                            className="animate-pulse"
                          >
                            <div className="aspect-square rounded-xl bg-[var(--wk-surface-raised)]" />
                            <div className="mt-3 h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                            <div className="mt-2 h-3 w-1/3 rounded bg-[var(--wk-surface-raised)]" />
                          </div>
                        ),
                      )
                    }
                  </div>
                )
              : null
          }

          {
            !loading &&
            error &&
            playlists.length ===
              0
              ? (
                  <section className="wk-panel max-w-xl p-6 md:p-8">
                    <WkIcon
                      name="ListMusic"
                      size={
                        28
                      }
                      className="mb-4 text-[var(--wk-text-faint)]"
                    />

                    <h2 className="wk-h-section">
                      Could not load Playlists
                    </h2>

                    <p className="wk-copy mt-3">
                      {
                        error
                      }
                    </p>

                    <WkButton
                      onClick={
                        () => {
                          void loadInitial();
                        }
                      }
                      className="mt-6"
                    >
                      Try again
                    </WkButton>
                  </section>
                )
              : null
          }

          {
            !loading &&
            !error &&
            playlists.length ===
              0
              ? (
                  <section className="wk-panel max-w-xl p-6 md:p-8">
                    <WkIcon
                      name="ListMusic"
                      size={
                        28
                      }
                      className="mb-4 text-[var(--wk-text-faint)]"
                    />

                    <div className="wk-eyebrow">
                      Playlists
                    </div>

                    <h2 className="wk-h-section mt-4">
                      No Playlists yet.
                    </h2>

                    <p className="wk-copy mt-3">
                      Our first Playlists are on the way.
                    </p>
                  </section>
                )
              : null
          }

          {
            playlists.length >
            0
              ? (
                  <>
                    <section className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {
                        playlists.map(
                          (
                            playlist,
                          ) => (
                            <PlaylistCard
                              key={
                                playlist.snapshotId
                              }
                              playlist={
                                playlist
                              }
                            />
                          ),
                        )
                      }
                    </section>

                    {
                      error
                        ? (
                            <p className="mt-8 text-[13px] font-semibold text-[var(--wk-text-muted)]">
                              {
                                error
                              }
                            </p>
                          )
                        : null
                    }

                    {
                      hasMore
                        ? (
                            <div className="mt-10">
                              <WkButton
                                variant="soft"
                                disabled={
                                  loadingMore
                                }
                                onClick={
                                  () => {
                                    void loadMore();
                                  }
                                }
                              >
                                {
                                  loadingMore
                                    ? "Loading"
                                    : "Load more"
                                }
                              </WkButton>
                            </div>
                          )
                        : null
                    }
                  </>
                )
              : null
          }
        </div>
      </main>
    </>
  );
}
