import { Link } from "react-router-dom";

import type {
  PublicTrackAliasResolution,
} from "@/services/publicApi/types";

export default function TrackAliasDisambiguation({
  resolution,
}: {
  resolution: PublicTrackAliasResolution;
}) {
  return (
    <main className="min-h-screen bg-[var(--wk-bg)] px-5 py-20 md:px-8">
      <section className="mx-auto max-w-3xl">
        <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[var(--wk-brand)]">
          Track identity
        </div>
        <h1 className="max-w-2xl text-[32px] font-black tracking-[-0.03em] text-[var(--wk-text)] md:text-[44px]">
          More than one Track matches this old link.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-7 text-[var(--wk-text-muted)]">
          These are distinct Registry Tracks that historically shared the same
          Artist and Track slug. Choose the recording you meant. WAKILISHA will
          keep its canonical Track identity stable from there.
        </p>

        <div className="mt-8 space-y-3">
          {resolution.candidates.map((candidate) => (
            <Link
              key={candidate.id}
              to={candidate.canonicalPath}
              replace
              className="block rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 transition-colors hover:bg-[var(--wk-surface-raised)]"
            >
              <div className="flex items-start gap-4">
                {candidate.artworkUrl ? (
                  <img
                    src={candidate.artworkUrl}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 shrink-0 rounded-xl bg-[var(--wk-surface-raised)]" />
                )}

                <div className="min-w-0 flex-1">
                  <div className="text-[16px] font-black text-[var(--wk-text)]">
                    {candidate.title}
                  </div>

                  {candidate.releases.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {candidate.releases.slice(0, 3).map((release) => (
                        <div
                          key={candidate.id + ":" + release.id}
                          className="text-[12px] font-semibold text-[var(--wk-text-muted)]"
                        >
                          {release.title}
                          {release.releaseDate
                            ? " · " + String(release.releaseDate).slice(0, 4)
                            : ""}
                          {release.releaseType
                            ? " · " + release.releaseType
                            : ""}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-[12px] font-semibold text-[var(--wk-text-muted)]">
                      No active Release membership
                    </div>
                  )}

                  {candidate.isrc ? (
                    <div className="mt-3 font-mono text-[10px] text-[var(--wk-text-faint)]">
                      ISRC {candidate.isrc}
                    </div>
                  ) : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
