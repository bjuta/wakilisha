import { Link } from "react-router-dom";
import { Ch19GradientImage } from "@/components/media/Ch19GradientImage";
import { usePlayer } from "@/context/PlayerContext";
import type { ChartEditionEntry } from "@/services/chartsPublic/client";
import { trackUrl } from "@/utils/trackUrl";

const FALLBACK_IMGS = [
  "https://readdy.ai/api/search-image?query=Close%20up%20detail%20of%20African%20djembe%20drum%20with%20intricate%20carved%20wooden%20body%20and%20leather%20drumhead%20warm%20amber%20lighting%20showcasing%20craft%20and%20texture%20cultural%20musical%20instrument%20photography%20editorial%20quality%20dark%20background%20product%20style%20with%20artistic%20shadows%20beautiful%20depth&width=600&height=600&seq=feat1-wk26&orientation=squarish",
  "https://readdy.ai/api/search-image?query=Vinyl%20record%20album%20spinning%20on%20turntable%20with%20colorful%20abstract%20label%20design%20warm%20amber%20studio%20lighting%20music%20photography%20editorial%20quality%20close%20up%20showing%20grooves%20and%20reflections%20dark%20moody%20atmosphere%20audiophile%20aesthetic%20analog%20music%20culture%20documentary%20style&width=600&height=600&seq=feat2-wk26&orientation=squarish",
  "https://readdy.ai/api/search-image?query=Energetic%20African%20music%20concert%20crowd%20audience%20with%20hands%20raised%20in%20celebration%20colorful%20stage%20lighting%20illuminating%20faces%20collective%20joy%20and%20musical%20community%20experience%20editorial%20concert%20photography%20dynamic%20composition%20warm%20tones%20authentic%20live%20music%20atmosphere%20powerful%20image&width=600&height=600&seq=feat3-wk26&orientation=squarish",
  "https://readdy.ai/api/search-image?query=African%20music%20producer%20in%20recording%20studio%20with%20mixing%20board%20equipment%20warm%20amber%20studio%20lighting%20creative%20workspace%20headphones%20and%20monitors%20professional%20music%20production%20photography%20editorial%20quality%20authentic%20atmosphere%20focused%20creative%20expression&width=600&height=600&seq=feat4-wk26&orientation=squarish",
];

const TYPES = ["Release", "Artist", "Chart", "Scene"] as const;

interface Props {
  chartEntries: ChartEditionEntry[];
  loading: boolean;
}

export function HomeFeatured({ chartEntries, loading }: Props) {
  const { playTrack } = usePlayer();

  const featured = chartEntries.slice(0, 4);
  const chartTracks = chartEntries.map((e) => ({
    id: e.trackSlug || `${e.trackTitle}-${e.artistNames?.[0] || ""}`.toLowerCase().replace(/\s+/g, "-"),
    title: e.trackTitle,
    artist: e.artistNames?.[0] || "Unknown",
    artworkUrl: e.artworkUrl || undefined,
    isPlayable: e.isPlayable ?? true,
  }));

  return (
    <section style={{ maxWidth: 1180, margin: "0 auto", padding: "56px clamp(20px,4vw,40px) 72px" }}>
      {/* Header */}
      <div className="flex items-end justify-between gap-5 flex-wrap mb-8">
        <div>
          <div
            className="mb-3 text-[var(--wk-brand)]"
            style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".72rem", letterSpacing: ".14em", textTransform: "uppercase", fontWeight: 600 }}
          >
            What's charting
          </div>
          <h2
            className="font-bold tracking-[-0.02em] text-[var(--wk-text)]"
            style={{ fontSize: "clamp(1.5rem,2.8vw,2.1rem)", lineHeight: 1.05 }}
          >
            What&apos;s charting now
          </h2>
        </div>
        <Link
          to="/charts"
          className="text-[var(--wk-brand)] font-semibold text-[13px] hover:opacity-75 transition-opacity whitespace-nowrap cursor-pointer"
        >
          View all charts →
        </Link>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl overflow-hidden"
                style={{ background: "var(--wk-surface)" }}
              >
                <div className="aspect-square bg-[var(--wk-surface-raised)]" />
                <div className="p-4 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                  <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                </div>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => {
              const entry = featured[i] as ChartEditionEntry | undefined;
              const hasEntry = !!(entry?.trackTitle);
              const rank = String(i + 1).padStart(2, "0");
              const type = TYPES[i % TYPES.length];

              return (
                <Link
                  key={entry?.trackSlug ?? i}
                  to={hasEntry ? trackUrl(entry!.trackSlug, entry!.artistSlugs) : "/charts"}
                  className="group relative rounded-2xl overflow-hidden border border-[var(--wk-border)] block cursor-pointer"
                  style={{
                    background: "var(--wk-surface)",
                    transition: "transform .35s ease, border-color .35s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-5px)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--wk-border-2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "none"; (e.currentTarget as HTMLElement).style.borderColor = "var(--wk-border)"; }}
                >
                  {/* Image area */}
                  <div className="relative aspect-square overflow-hidden">
                    {hasEntry && entry!.artworkUrl ? (
                      <img
                        src={entry!.artworkUrl}
                        alt={entry!.trackTitle}
                        className="w-full h-full object-cover object-top transition-transform duration-600 group-hover:scale-[1.06]"
                        loading="lazy"
                      />
                    ) : hasEntry ? (
                      <Ch19GradientImage slug={entry!.trackSlug} name={entry!.trackTitle} />
                    ) : (
                      <img
                        src={FALLBACK_IMGS[i]}
                        alt=""
                        className="w-full h-full object-cover object-top transition-transform duration-600 group-hover:scale-[1.06]"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(8,9,8,0) 55%, rgba(8,9,8,0.65) 100%)" }} />

                    {/* Type badge — top-left */}
                    <span
                      className="absolute top-3 left-3 text-[9px] font-bold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full"
                      style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)" }}
                    >
                      {type}
                    </span>

                    {/* Rank — top-right */}
                    <span
                      className="absolute top-3 right-3 font-bold text-white/85 tabular-nums"
                      style={{ fontSize: "1.4rem", lineHeight: 1 }}
                    >
                      {rank}
                    </span>

                    {/* Play button */}
                    {hasEntry && (
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          playTrack(chartTracks[i], chartTracks);
                        }}
                        className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full opacity-0 scale-75 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100 cursor-pointer"
                        style={{ background: "var(--wk-brand)", color: "var(--wk-brand-on)" }}
                        aria-label={`Play ${entry!.trackTitle}`}
                      >
                        <i className="ri-play-fill text-base" />
                      </button>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4 pb-5">
                    <div className="font-bold text-[15px] tracking-[-0.01em] text-[var(--wk-text)] mb-1 leading-snug truncate">
                      {hasEntry ? entry!.trackTitle : `Chart Entry ${i + 1}`}
                    </div>
                    <div className="text-[12px] text-[var(--wk-text-faint)] truncate">
                      {hasEntry ? (entry!.artistNames?.[0] || "Unknown") : "—"}
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}