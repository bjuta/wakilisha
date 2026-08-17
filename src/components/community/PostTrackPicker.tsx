import { useMemo, useState } from "react";
import { Portal } from "@/components/base/Portal";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useTrackSearchData } from "@/hooks/useTrackSearchData";
import type { PostTrack } from "@/services/community/posts";

function toPostTrack(track: {
  id: string;
  slug: string;
  artistSlug: string;
  title: string;
  artist: string;
  artworkUrl: string;
}): PostTrack {
  return {
    id: track.id,
    title: track.title,
    artistName: track.artist || null,
    artistSlug: track.artistSlug || null,
    artworkUrl: track.artworkUrl || null,
    previewUrl: null,
    durationMs: null,
    trackSlug: track.slug || null,
    releaseId: null,
    releaseTitle: null,
    releaseSlug: null,
    canonicalPath:
      track.artistSlug && track.slug
        ? `/tracks/${track.artistSlug}/${track.slug}`
        : null,
  };
}

export function PostTrackPicker({
  selectedTrackId,
  onSelect,
  onClose,
}: {
  selectedTrackId?: string | null;
  onSelect: (track: PostTrack) => void;
  onClose: () => void;
}) {
  const { data, loading, error } = useTrackSearchData();
  const [query, setQuery] = useState("");

  useScrollLock(true);

  const results = useMemo(() => {
    const clean = query.trim().toLowerCase();
    const candidates = clean
      ? data.filter((track) =>
          `${track.title} ${track.artist}`.toLowerCase().includes(clean),
        )
      : data;

    return candidates.slice(0, 30);
  }, [data, query]);

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[190] flex items-end justify-center bg-black/50 sm:items-center sm:p-5"
        role="presentation"
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) onClose();
        }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Choose a Track"
          className="flex max-h-[86dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] shadow-2xl sm:max-w-[620px] sm:rounded-3xl"
        >
          <header className="flex items-center gap-3 border-b border-[var(--wk-divider)] px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-black text-[var(--wk-text)]">Add Track</h3>
              <p className="mt-0.5 text-[10px] font-semibold text-[var(--wk-text-muted)]">
                Choose a Track from WAKILISHA.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--wk-text-muted)] hover:bg-[var(--wk-bg)]"
              aria-label="Close Track picker"
            >
              <i className="ri-close-line text-[18px]" aria-hidden="true" />
            </button>
          </header>

          <div className="border-b border-[var(--wk-divider)] p-3 sm:p-4">
            <label className="relative block">
              <i
                className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-[var(--wk-text-faint)]"
                aria-hidden="true"
              />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search Tracks or Artists"
                className="h-11 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] pl-10 pr-3 text-[13px] font-semibold text-[var(--wk-text)] outline-none focus:border-[var(--wk-brand)]"
              />
            </label>
          </div>

          <div data-scroll-lock="container" className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
            {loading ? (
              <div className="px-3 py-10 text-center text-[11px] font-semibold text-[var(--wk-text-muted)]">
                Loading Tracks...
              </div>
            ) : error ? (
              <div className="px-3 py-10 text-center text-[11px] font-semibold text-red-600">
                Tracks could not be loaded.
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-10 text-center text-[11px] font-semibold text-[var(--wk-text-muted)]">
                No Tracks match this search.
              </div>
            ) : (
              results.map((track) => {
                const selected = track.id === selectedTrackId;
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => onSelect(toPostTrack(track))}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      selected
                        ? "bg-[var(--wk-brand-soft)]"
                        : "hover:bg-[var(--wk-bg)]"
                    }`}
                  >
                    <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[var(--wk-surface-raised)]">
                      {track.artworkUrl ? (
                        <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Ch19GradientImage slug={track.slug || track.id} name={track.title} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-black text-[var(--wk-text)]">
                        {track.title}
                      </div>
                      <div className="mt-0.5 truncate text-[10px] font-semibold text-[var(--wk-text-muted)]">
                        {track.artist}
                      </div>
                    </div>
                    {selected ? (
                      <i className="ri-check-line text-[17px] text-[var(--wk-brand)]" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </Portal>
  );
}
