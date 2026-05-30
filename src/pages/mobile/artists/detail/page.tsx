import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChartRow } from "@/components/design-system/music/ChartRow";
import { ARTIST_DETAILS } from "@/mocks/artistDetails";

const TABS = ["Tracks", "Releases", "Charts"];

export default function MobileArtistDetail() {
  const { slug } = useParams<{ slug: string }>();
  const artist = ARTIST_DETAILS.find((a) => a.slug === slug);
  const [activeTab, setActiveTab] = useState("Tracks");

  if (!artist) {
    return (
      <div className="px-5 py-20 text-center">
        <i className="ri-user-line mb-3 block text-4xl text-[var(--wk-text-faint)]" />
        <p className="text-[var(--wk-text-muted)]">Artist not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Artist Hero — same cinematic style as desktop */}
      <section className="relative min-h-[320px] flex items-end overflow-hidden">
        {artist.imageUrl && (
          <>
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${artist.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[var(--wk-bg)] via-[var(--wk-bg)]/70 to-[var(--wk-bg)]/30" />
          </>
        )}
        <div className="relative w-full px-5 pb-8 pt-20">
          <div className="mb-2 flex items-center gap-2">
            <div className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--wk-brand)] flex items-center gap-2">
              <span className="w-5 h-px bg-[var(--wk-brand)]" />
              Registry
            </div>
            {artist.isChartArtist && (
              <span className="rounded-full bg-[var(--wk-brand-soft)] px-2 py-0.5 text-[9px] font-bold text-[var(--wk-brand)] uppercase">Charts</span>
            )}
          </div>
          <h1 className="font-black leading-[0.92] tracking-[-0.04em] text-[var(--wk-text)]" style={{ fontSize: "clamp(32px, 10vw, 48px)" }}>
            {artist.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-[var(--wk-text-muted)]">
            {artist.genres.map((g) => (
              <span key={g} className="rounded-full border border-[var(--wk-border)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--wk-text-soft)]">
                {g}
              </span>
            ))}
            <span>·</span>
            <span>{artist.trackCount} tracks</span>
            <span>·</span>
            <span>{artist.releaseCount} releases</span>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="px-5 py-4 flex gap-3">
        <button className="flex-1 h-12 rounded-xl bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-bold text-[14px] flex items-center justify-center gap-2">
          <i className="ri-play-fill" />
          Play
        </button>
        <button className="flex-1 h-12 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] font-bold text-[14px] flex items-center justify-center gap-2">
          <i className="ri-user-add-line" />
          Follow
        </button>
      </div>

      {/* Bio */}
      {artist.bio && (
        <div className="px-5 py-4">
          <h2 className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">About</h2>
          <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)]">{artist.bio}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-px border-y border-[var(--wk-border)]" style={{ background: "var(--wk-border)" }}>
        {[
          { label: "Tracks", value: artist.trackCount },
          { label: "Releases", value: artist.releaseCount },
          { label: "Charts", value: artist.chartEntries?.length ?? 0 },
          { label: "Peak", value: `#${Math.min(...(artist.chartEntries?.map((e) => e.peakPosition ?? 999) ?? [999]))}` },
        ].map((stat) => (
          <div key={stat.label} className="bg-[var(--wk-surface)] px-2 py-3 text-center">
            <div className="text-[16px] font-black text-[var(--wk-brand)]">{stat.value}</div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--wk-divider)] px-5 gap-0 overflow-hidden">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3 pr-5 text-[13px] font-bold transition-all whitespace-nowrap ${
              activeTab === tab
                ? "text-[var(--wk-brand)] border-b-[1.5px] border-[var(--wk-brand)]"
                : "text-[var(--wk-text-faint)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pb-4">
        {activeTab === "Tracks" && (
          <div>
            {artist.chartEntries?.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-[var(--wk-divider)]">
                <div className="chart-row-art">
                  <img src={artist.releases?.[0]?.artworkUrl || ""} alt="" />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{entry.title}</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    {entry.artist} · {entry.weeksOnChart}w on chart
                  </div>
                </div>
                <button className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                  <i className="ri-play-fill" />
                </button>
              </div>
            ))}
            {(!artist.chartEntries || artist.chartEntries.length === 0) && (
              <p className="px-5 py-8 text-center text-[12px] text-[var(--wk-text-faint)]">No tracks available</p>
            )}
          </div>
        )}

        {activeTab === "Releases" && (
          <div>
            {artist.releases?.map((rel) => (
              <Link
                key={rel.slug}
                to={`/releases/${rel.slug}`}
                className="flex items-center gap-3 px-5 py-3 border-b border-[var(--wk-divider)]"
              >
                <div className="chart-row-art">
                  <img src={rel.artworkUrl || ""} alt={rel.title} />
                </div>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{rel.title}</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    {rel.releaseType} · {rel.year} · {rel.trackCount} tracks
                  </div>
                </div>
                <i className="ri-arrow-right-s-line text-[var(--wk-text-faint)]" />
              </Link>
            ))}
            {(!artist.releases || artist.releases.length === 0) && (
              <p className="px-5 py-8 text-center text-[12px] text-[var(--wk-text-faint)]">No releases available</p>
            )}
          </div>
        )}

        {activeTab === "Charts" && (
          <div>
            {artist.chartEntries?.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-[var(--wk-divider)]">
                <span className="chart-row-num w-6">{entry.rank}</span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">{entry.title}</div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    {entry.artist} · Peak #{entry.peakPosition}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {entry.movement === "up" && (
                    <span className="delta-up text-[10px] font-bold"><i className="ri-arrow-up-line" /> {entry.movementAmount}</span>
                  )}
                  {entry.movement === "down" && (
                    <span className="delta-dn text-[10px] font-bold"><i className="ri-arrow-down-line" /> {entry.movementAmount}</span>
                  )}
                  {entry.movement === "new" && (
                    <span className="delta-new text-[10px] font-bold uppercase tracking-wider text-[var(--wk-brand)]">NEW</span>
                  )}
                  {entry.movement === "same" && (
                    <span className="text-[10px] text-[var(--wk-text-faint)]">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Related artists */}
      {artist.relatedArtists && artist.relatedArtists.length > 0 && (
        <div className="px-5 py-6 border-t border-[var(--wk-border)]">
          <h3 className="mb-3 text-[11px] font-black uppercase tracking-wider text-[var(--wk-text-muted)]">Related artists</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {artist.relatedArtists.map((a) => (
              <Link
                key={a.slug}
                to={`/artists/${a.slug}`}
                className="flex items-center gap-2 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3 py-2 whitespace-nowrap"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--wk-surface-raised)]">
                  <i className="ri-user-line text-[var(--wk-text-muted)] text-xs" />
                </div>
                <span className="text-[12px] font-semibold text-[var(--wk-text)]">{a.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}