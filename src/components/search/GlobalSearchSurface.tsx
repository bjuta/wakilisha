import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { usePlayer } from "@/context/PlayerContext";
import { useArtistSearchData } from "@/hooks/useArtistSearchData";
import { useTrackSearchData } from "@/hooks/useTrackSearchData";

export function GlobalSearchSurface({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const { playTrack } = usePlayer();
  const { data: artists } = useArtistSearchData();
  const { data: tracks } = useTrackSearchData();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const frame = window.requestAnimationFrame(
      () => inputRef.current?.focus(),
    );
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const normalized = query.trim().toLowerCase();

  const artistResults = useMemo(
    () =>
      normalized
        ? artists
            .filter(
              (artist) =>
                artist.name.toLowerCase().includes(normalized) ||
                artist.contextText.toLowerCase().includes(normalized),
            )
            .slice(0, 5)
        : [],
    [artists, normalized],
  );

  const trackResults = useMemo(
    () =>
      normalized
        ? tracks
            .filter(
              (track) =>
                track.title.toLowerCase().includes(normalized) ||
                track.artist.toLowerCase().includes(normalized) ||
                track.contextText.toLowerCase().includes(normalized),
            )
            .slice(0, 6)
        : [],
    [normalized, tracks],
  );

  if (!open) return null;

  const openAllResults = () => {
    const q = query.trim();
    onClose();
    navigate(
      q
        ? `/search?q=${encodeURIComponent(q)}`
        : "/search",
    );
  };

  return (
    <div
      className="fixed inset-0 z-[150] bg-black/55 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search WAKILISHA"
        className="mx-auto mt-[7vh] w-full max-w-[760px] overflow-hidden rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            openAllResults();
          }}
          className="flex items-center gap-3 border-b border-[var(--wk-border)] px-4 py-3"
        >
          <WkIcon
            name="Search"
            size={18}
            className="text-[var(--wk-text-faint)]"
          />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search artists, tracks, releases, scenes…"
            className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-[var(--wk-text)] outline-none placeholder:text-[var(--wk-text-faint)]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Search"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--wk-text-faint)] hover:bg-[var(--wk-surface-raised)] hover:text-[var(--wk-text)]"
          >
            <WkIcon name="X" size={16} />
          </button>
        </form>

        <div className="max-h-[68vh] overflow-y-auto p-3">
          {!normalized ? (
            <div className="px-4 py-10 text-center text-[12px] font-semibold text-[var(--wk-text-muted)]">
              Search WAKILISHA without leaving what you are listening to.
            </div>
          ) : null}

          {artistResults.length ? (
            <section className="p-2">
              <h2 className="px-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                Artists
              </h2>
              <div className="mt-2 space-y-1">
                {artistResults.map((artist) => (
                  <Link
                    key={artist.id}
                    to={`/artists/${artist.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-[var(--wk-surface-raised)]"
                  >
                    <div className="h-9 w-9 overflow-hidden rounded-full bg-[var(--wk-bg-subtle)]">
                      {artist.imageUrl ? (
                        <img
                          src={artist.imageUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--wk-text)]">
                      {artist.name}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {trackResults.length ? (
            <section className="p-2">
              <h2 className="px-2 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                Tracks
              </h2>
              <div className="mt-2 space-y-1">
                {trackResults.map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    disabled={!track.previewUrl}
                    onClick={() => {
                      const playable = {
                        id: track.slug,
                        registryTrackId: track.id,
                        title: track.title,
                        artist: track.artist,
                        artworkUrl: track.artworkUrl,
                        isPlayable: Boolean(track.previewUrl),
                        previewUrl: track.previewUrl ?? undefined,
                        playbackEngine: "audio" as const,
                        source: "WAKILISHA",
                        artistSlug: track.artistSlug || undefined,
                        trackSlug: track.slug,
                      };

                      playTrack(
                        playable,
                        [playable],
                        {
                          pageType: "search",
                          entityType: "track",
                          entitySlug: track.slug,
                          sourceSection: "global_search",
                        },
                      );
                      onClose();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--wk-surface-raised)] disabled:opacity-45"
                  >
                    <div className="h-10 w-10 overflow-hidden rounded-lg bg-[var(--wk-bg-subtle)]">
                      {track.artworkUrl ? (
                        <img
                          src={track.artworkUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--wk-text)]">
                        {track.title}
                      </span>
                      <span className="block truncate text-xs text-[var(--wk-text-muted)]">
                        {track.artist}
                      </span>
                    </span>
                    <WkIcon
                      name="Play"
                      size={15}
                      className="text-[var(--wk-brand)]"
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {normalized &&
          !artistResults.length &&
          !trackResults.length ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--wk-text-muted)]">
              No quick matches. Open full Search for every WAKILISHA surface.
            </div>
          ) : null}
        </div>

        <div className="border-t border-[var(--wk-border)] p-3">
          <button
            type="button"
            onClick={openAllResults}
            className="wk-button wk-button-primary wk-button-sm w-full justify-center"
          >
            See all results
          </button>
        </div>
      </div>
    </div>
  );
}
