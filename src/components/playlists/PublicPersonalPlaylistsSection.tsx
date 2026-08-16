import {
  useEffect,
  useState,
} from "react";
import {
  Link,
} from "react-router-dom";
import {
  PlaylistCoverPresentation,
} from "@/components/media/PlaylistCoverPresentation";
import {
  listPublicPersonalPlaylistsForUsername,
  type PersonalPlaylistSummary,
} from "@/services/playlists/personalPlaylistService";

export function PublicPersonalPlaylistsSection({
  username,
}: {
  username: string;
}) {
  const [playlists, setPlaylists] =
    useState<PersonalPlaylistSummary[]>([]);
  const [loading, setLoading] =
    useState(true);

  useEffect(
    () => {
      let alive = true;

      setLoading(true);

      listPublicPersonalPlaylistsForUsername(
        username,
        8,
      )
        .then((rows) => {
          if (alive) {
            setPlaylists(rows);
          }
        })
        .catch(() => {
          if (alive) {
            setPlaylists([]);
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
    },
    [username],
  );

  if (
    loading ||
    playlists.length === 0
  ) {
    return null;
  }

  return (
    <section className="border-b border-[var(--wk-border)] py-7">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--wk-brand)]">
            Playlists
          </div>
          <h2 className="mt-1 text-lg font-black tracking-[-0.02em] text-[var(--wk-text)]">
            Made by @{username}
          </h2>
        </div>

        <Link
          to={`/u/${username}/playlists`}
          className="text-[11px] font-black text-[var(--wk-brand)] hover:underline"
        >
          View all
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {playlists.map(
          (playlist) => (
            <Link
              key={playlist.playlistId}
              to={`/u/${username}/playlists/${playlist.slug}`}
              className="group min-w-0"
            >
              <div className="aspect-square overflow-hidden rounded-xl bg-[var(--wk-surface-raised)]">
                <PlaylistCoverPresentation
                  src={null}
                  altText={null}
                  slug={playlist.slug}
                  title={playlist.title}
                  loading="lazy"
                  imageClassName="transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>

              <h3 className="mt-2 truncate text-[13px] font-black text-[var(--wk-text)] group-hover:text-[var(--wk-brand)]">
                {playlist.title}
              </h3>

              <p className="mt-1 text-[10px] font-bold text-[var(--wk-text-muted)]">
                {playlist.itemCount}{" "}
                {playlist.itemCount === 1
                  ? "Track"
                  : "Tracks"}
              </p>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}
