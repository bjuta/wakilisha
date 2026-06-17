import { Link } from "react-router-dom";
import { trackUrl } from "@/utils/trackUrl";
import { slugify } from "@/services/repairedContent/client";
import { ArtistCard } from "@/components/design-system/registry/ArtistCard";
import { ReleaseCard } from "@/components/design-system/registry/ReleaseCard";
import type { MagazineSiteArtist, MagazineSiteRelease, MagazineSiteChartEntry } from "@/services/magazineSiteContent";

/* ── Section accent map ── */
const SECTION_ACCENT: Record<string, string> = {
  Music: "#84C241",
  Film: "#D6766A",
  Fashion: "#C7A06D",
  Food: "#E8A23A",
  Language: "#6BA8F5",
  Places: "#4FD9C2",
};

/* ═══════════════════════ ARTIST SPOTLIGHT ═══════════════════════ */
export function ArtistSpotlightSpread({ artists, mood, sectionColor }: { artists: MagazineSiteArtist[]; mood: string; sectionColor?: string }) {
  const accent = sectionColor ?? SECTION_ACCENT["Music"] ?? "#84C241";
  const display = artists.slice(0, 4);

  if (!display.length) return null;

  return (
    <section className="magazine-spread mag-reveal" style={{ background: "var(--mag-surface)" }}>
      <div className="mag-registry-spotlight">
        <div className="mag-registry-spotlight-rail">
          <div className="magazine-meta" style={{ color: accent }}>Registry · Artists on record</div>
          <div className="mag-registry-spotlight-title">
            <span>Voices in the archive</span>
          </div>
          <p style={{ color: "var(--mag-text-muted)", fontSize: 13, maxWidth: 360 }}>
            The artists linked to this issue's cultural moment — pulled from the WAKILISHA registry.
          </p>
          <Link
            to="/artists"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold mt-3 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: accent }}
          >
            All artists <i className="ri-arrow-right-line text-[13px]" />
          </Link>
        </div>
        <div className="mag-registry-spotlight-grid">
          {display.map((artist) => (
            <ArtistCard
              key={artist.slug}
              slug={artist.slug}
              name={artist.title}
              imageUrl={artist.heroUrl || undefined}
              country={artist.originIso2 || undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ RELEASE SPOTLIGHT ═══════════════════════ */
export function ReleaseSpotlightSpread({ releases, mood, sectionColor }: { releases: MagazineSiteRelease[]; mood: string; sectionColor?: string }) {
  const accent = sectionColor ?? SECTION_ACCENT["Music"] ?? "#84C241";
  const display = releases.slice(0, 4);

  if (!display.length) return null;

  return (
    <section className="magazine-spread mag-reveal" style={{ background: "var(--mag-surface)" }}>
      <div className="mag-registry-spotlight">
        <div className="mag-registry-spotlight-rail">
          <div className="magazine-meta" style={{ color: accent }}>Registry · Releases filed</div>
          <div className="mag-registry-spotlight-title">
            <span>Records that shaped the window</span>
          </div>
          <p style={{ color: "var(--mag-text-muted)", fontSize: 13, maxWidth: 360 }}>
            Releases connected to this issue's timeframe — pulled from the WAKILISHA registry.
          </p>
          <Link
            to="/releases"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold mt-3 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: accent }}
          >
            All releases <i className="ri-arrow-right-line text-[13px]" />
          </Link>
        </div>
        <div className="mag-registry-spotlight-grid">
          {display.map((release) => (
            <ReleaseCard
              key={release.slug}
              slug={release.slug}
              title={release.title}
              artist="Registry artist"
              artworkUrl={release.heroUrl || undefined}
              releaseType={release.releaseType as "Album" | "EP" | "Single" | "Compilation" | undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════ CHART HIGHLIGHT SPOTLIGHT ═══════════════════════ */
export function ChartHighlightSpread({ highlights, mood, sectionColor }: { highlights: MagazineSiteChartEntry[]; mood: string; sectionColor?: string }) {
  const accent = sectionColor ?? SECTION_ACCENT["Music"] ?? "#84C241";
  const display = highlights.slice(0, 6);

  if (!display.length) return null;

  return (
    <section className="magazine-spread mag-reveal" style={{ background: "var(--mag-surface)" }}>
      <div className="mag-registry-spotlight" style={{ flexDirection: "column" }}>
        <div className="mag-registry-spotlight-rail" style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 28 }}>
          <div>
            <div className="magazine-meta" style={{ color: accent }}>Charts · Top entries</div>
            <div className="mag-registry-spotlight-title" style={{ marginBottom: 0 }}>
              <span>What the charts captured</span>
            </div>
          </div>
          <Link
            to="/charts"
            className="inline-flex items-center gap-1.5 text-[12px] font-bold whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
            style={{ color: accent }}
          >
            All charts <i className="ri-arrow-right-line text-[13px]" />
          </Link>
        </div>
        <div className="mag-chart-highlight-list">
          {display.map((entry, idx) => (
            <Link
              key={entry.slug}
              to={trackUrl(entry.slug, [slugify(entry.artistName)])}
              className="mag-chart-highlight-row group cursor-pointer"
            >
              <span className="mag-chart-highlight-rank">{String(idx + 1).padStart(2, "0")}</span>
              <span className="mag-chart-highlight-info">
                <span className="mag-chart-highlight-title">{entry.title}</span>
                <span className="mag-chart-highlight-artist">{entry.artistName}</span>
              </span>
              <span className="mag-chart-highlight-accent" style={{ color: accent }}>
                #{entry.rank}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}