import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { PlaylistCoverPresentation } from "@/components/media/PlaylistCoverPresentation";
import { MetaTags } from "@/components/seo/MetaTags";
import { useAuthUser } from "@/hooks/useAuthUser";
import { getUserProfileWithStats } from "@/services/community";
import {
  createPersonalPlaylist,
  listMyPersonalPlaylists,
  listPublicPersonalPlaylistsForUsername,
  type PersonalPlaylistSummary,
} from "@/services/playlists/personalPlaylistService";

export default function PersonPlaylistsPage() {
  const { username = "" } =
    useParams<{ username: string }>();
  const authUser = useAuthUser();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] =
    useSearchParams();

  const [viewerUsername, setViewerUsername] =
    useState("");
  const [viewerResolved, setViewerResolved] =
    useState(false);
  const [playlists, setPlaylists] =
    useState<PersonalPlaylistSummary[]>([]);
  const [loading, setLoading] =
    useState(true);
  const [creating, setCreating] =
    useState(false);
  const [showCreate, setShowCreate] =
    useState(
      searchParams.get("create") === "1",
    );
  const [title, setTitle] =
    useState("");
  const [description, setDescription] =
    useState("");
  const [visibility, setVisibility] =
    useState<"private" | "public">(
      "private",
    );
  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    if (authUser.loading) {
      return () => {
        alive = false;
      };
    }

    if (!authUser.id) {
      setViewerUsername("");
      setViewerResolved(true);
      return () => {
        alive = false;
      };
    }

    setViewerResolved(false);

    getUserProfileWithStats(
      authUser.id,
    )
      .then((profile) => {
        if (!alive) return;
        setViewerUsername(
          profile?.username ?? "",
        );
      })
      .catch(() => {
        if (!alive) return;
        setViewerUsername("");
      })
      .finally(() => {
        if (alive) {
          setViewerResolved(true);
        }
      });

    return () => {
      alive = false;
    };
  }, [
    authUser.id,
    authUser.loading,
  ]);

  const isOwner = useMemo(
    () =>
      Boolean(
        authUser.id &&
          viewerUsername &&
          viewerUsername.toLowerCase() ===
            username.toLowerCase(),
      ),
    [
      authUser.id,
      username,
      viewerUsername,
    ],
  );

  useEffect(() => {
    let alive = true;

    if (
      !username ||
      authUser.loading ||
      !viewerResolved
    ) {
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    setError(null);

    const request =
      isOwner
        ? listMyPersonalPlaylists({
            includeArchived: true,
          })
        : listPublicPersonalPlaylistsForUsername(
            username,
            50,
          );

    request
      .then((rows) => {
        if (alive) {
          setPlaylists(rows);
        }
      })
      .catch((loadError) => {
        if (alive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load Playlists.",
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
    authUser.loading,
    isOwner,
    username,
    viewerResolved,
  ]);

  const handleCreate = async (
    event:
      FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !isOwner ||
      !title.trim()
    ) {
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const result =
        await createPersonalPlaylist({
          title,
          description,
          visibility,
        });

      if (!result.slug) {
        throw new Error(
          "The Playlist was created, but its address could not be resolved.",
        );
      }

      navigate(
        `/u/${encodeURIComponent(username)}/playlists/${encodeURIComponent(result.slug)}`,
      );
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create this Playlist.",
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <MetaTags
        title={
          isOwner
            ? "Your Playlists"
            : `@${username} Playlists`
        }
        description={
          isOwner
            ? "Build and manage your WAKILISHA Playlists."
            : `Public Playlists by @${username} on WAKILISHA.`
        }
        url={`https://wakilisha.africa/u/${username}/playlists`}
      />

      <main className="min-h-screen bg-[var(--wk-bg)] pb-28">
        <section className="border-b border-[var(--wk-border)]">
          <div className="wk-container-wide px-5 py-10 md:px-6 md:py-14">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="wk-eyebrow">
                  {isOwner
                    ? "Your music"
                    : `@${username}`}
                </div>

                <h1 className="wk-h-page mt-3">
                  {isOwner
                    ? "Your Playlists"
                    : "Playlists"}
                </h1>

                <p className="wk-copy mt-4 max-w-2xl">
                  {isOwner
                    ? "Keep Tracks together your way. Make a Playlist private while you shape it, then share it when it feels ready."
                    : `Public Playlists made by @${username}.`}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/u/${username}`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--wk-border)] px-4 text-xs font-black text-[var(--wk-text)] hover:bg-[var(--wk-surface-raised)]"
                >
                  Profile
                </Link>

                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(true);
                      setSearchParams({
                        create: "1",
                      });
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-4 text-xs font-black text-white"
                  >
                    <WkIcon
                      name="Plus"
                      size={15}
                    />
                    Create Playlist
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <div className="wk-container-wide px-5 py-8 md:px-6 md:py-10">
          {isOwner &&
          showCreate ? (
            <section className="mb-8 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-[var(--wk-text)]">
                    New Playlist
                  </h2>
                  <p className="mt-1 text-[12px] text-[var(--wk-text-muted)]">
                    Start with a name. You can change it later.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setSearchParams({});
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-surface-raised)]"
                  aria-label="Close"
                >
                  <WkIcon
                    name="X"
                    size={16}
                  />
                </button>
              </div>

              <form
                onSubmit={handleCreate}
                className="mt-5 grid gap-4"
              >
                <label className="grid gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
                    Name
                  </span>
                  <input
                    value={title}
                    onChange={(event) =>
                      setTitle(
                        event.target.value,
                      )}
                    maxLength={300}
                    autoFocus
                    className="h-11 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 text-sm font-bold text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
                    placeholder="Sunday drive"
                  />
                </label>

                <label className="grid gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
                    Description
                  </span>
                  <textarea
                    value={description}
                    onChange={(event) =>
                      setDescription(
                        event.target.value,
                      )}
                    rows={3}
                    className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-sm text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
                    placeholder="What belongs here?"
                  />
                </label>

                <div className="grid gap-2">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--wk-text-muted)]">
                    Visibility
                  </span>

                  <div className="flex gap-2">
                    {(
                      [
                        "private",
                        "public",
                      ] as const
                    ).map(
                      (option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() =>
                            setVisibility(
                              option,
                            )}
                          className={[
                            "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black capitalize",
                            visibility ===
                            option
                              ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                              : "border-[var(--wk-border)] text-[var(--wk-text-muted)]",
                          ].join(" ")}
                        >
                          <WkIcon
                            name={
                              option ===
                              "public"
                                ? "Globe"
                                : "Lock"
                            }
                            size={14}
                          />
                          {option}
                        </button>
                      ),
                    )}
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={
                      creating ||
                      !title.trim()
                    }
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--wk-brand)] px-4 text-xs font-black text-white disabled:opacity-50"
                  >
                    <WkIcon
                      name={
                        creating
                          ? "Loader2"
                          : "Plus"
                      }
                      size={15}
                      className={
                        creating
                          ? "animate-spin"
                          : ""
                      }
                    />
                    {creating
                      ? "Creating..."
                      : "Create Playlist"}
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          {error ? (
            <div className="mb-6 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-3 text-[12px] font-bold text-red-500">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({
                length: 8,
              }).map(
                (_, index) => (
                  <div
                    key={index}
                    className="animate-pulse"
                  >
                    <div className="aspect-square rounded-xl bg-[var(--wk-surface-raised)]" />
                    <div className="mt-3 h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ),
              )}
            </div>
          ) : playlists.length ===
            0 ? (
            <section className="rounded-2xl border border-dashed border-[var(--wk-border)] py-14 text-center">
              <WkIcon
                name="ListMusic"
                size={32}
                className="mx-auto text-[var(--wk-text-faint)]"
              />
              <h2 className="mt-4 text-lg font-black text-[var(--wk-text)]">
                {isOwner
                  ? "No Playlists yet"
                  : "No public Playlists yet"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--wk-text-muted)]">
                {isOwner
                  ? "Start one here, or use Add to Playlist when you find a Track you want to keep with others."
                  : `@${username} has not shared a Playlist yet.`}
              </p>
            </section>
          ) : (
            <section className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
              {playlists.map(
                (playlist) => (
                  <Link
                    key={
                      playlist.playlistId
                    }
                    to={`/u/${encodeURIComponent(username)}/playlists/${encodeURIComponent(playlist.slug)}`}
                    className="group min-w-0"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                      <PlaylistCoverPresentation
                        src={null}
                        altText={null}
                        slug={
                          playlist.slug
                        }
                        title={
                          playlist.title
                        }
                        loading="lazy"
                        imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
                      />

                      {isOwner ? (
                        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-white">
                          <WkIcon
                            name={
                              playlist.lifecycleStatus ===
                              "archived"
                                ? "Archive"
                                : playlist.visibility ===
                                    "public"
                                  ? "Globe"
                                  : "Lock"
                            }
                            size={11}
                          />
                          {playlist.lifecycleStatus ===
                          "archived"
                            ? "Archived"
                            : playlist.visibility}
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-3 truncate text-[14px] font-black text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
                      {playlist.title}
                    </h2>

                    <p className="mt-1 text-[11px] font-bold text-[var(--wk-text-muted)]">
                      {playlist.itemCount}{" "}
                      {playlist.itemCount ===
                      1
                        ? "Track"
                        : "Tracks"}
                    </p>
                  </Link>
                ),
              )}
            </section>
          )}
        </div>
      </main>
    </>
  );
}
