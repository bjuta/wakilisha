import { Link } from "react-router-dom";
import type { ChartEditionEntry } from "@/services/chartsPublic/types";
import type { PublicStory } from "@/services/publicContent/client";
import { trackUrl } from "@/utils/trackUrl";

interface Props {
  chartEntries: ChartEditionEntry[];
  stories: PublicStory[];
  loading: boolean;
}

function MovementIcon({ movement }: { movement: ChartEditionEntry["movement"] }) {
  if (movement === "up") return <i className="ri-arrow-up-line text-[11px]" style={{ color: "var(--wk-success)" }} />;
  if (movement === "down") return <i className="ri-arrow-down-line text-[11px]" style={{ color: "var(--wk-danger)" }} />;
  if (movement === "new") return <span className="text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full text-[var(--wk-brand)] bg-[var(--wk-brand-soft)]">NEW</span>;
  if (movement === "re_entry") return <span className="text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full text-[var(--wk-info)] bg-[var(--wk-info-soft)]">RE</span>;
  return <span className="w-3.5 h-0.5 rounded-full inline-block bg-[var(--wk-text-faint)]" />;
}

export function HomeRightNow({ chartEntries, stories, loading }: Props) {
  const topChart = chartEntries.slice(0, 8);
  const featuredStory = stories[0];
  const sideStories = stories.slice(1, 4);

  return (
    <section className="py-16 md:py-24" style={{ background: "var(--wk-bg)" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 clamp(20px,4vw,40px)" }}>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 lg:gap-12">

          {/* ── LEFT: Chart Leaderboard ── */}
          <div>
            <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
              <div>
                <div
                  className="mb-3 text-[var(--wk-brand)]"
                  style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".7rem", letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 600 }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-brand)] animate-pulse" />
                    Live from the charts
                  </span>
                </div>
                <h2
                  className="font-black tracking-[-0.03em] text-[var(--wk-text)]"
                  style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", lineHeight: 1.05 }}
                >
                  Charting right now
                </h2>
              </div>
              <Link
                to="/charts"
                className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--wk-brand)] hover:opacity-75 transition-opacity whitespace-nowrap cursor-pointer"
              >
                View all charts <i className="ri-arrow-right-line text-xs" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-[var(--wk-surface)] border border-[var(--wk-border)] animate-pulse">
                    <div className="w-7 text-center">
                      <div className="h-4 w-5 rounded bg-[var(--wk-surface-raised)] mx-auto" />
                    </div>
                    <div className="w-12 h-12 rounded-lg bg-[var(--wk-surface-raised)] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-2/3 rounded bg-[var(--wk-surface-raised)]" />
                      <div className="h-3 w-1/3 rounded bg-[var(--wk-surface-raised)]" />
                    </div>
                    <div className="w-10 h-3 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="w-8 h-3 rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {topChart.map((entry, i) => (
                  <Link
                    key={entry.trackSlug || i}
                    to={trackUrl(entry.trackSlug, entry.artistSlugs)}
                    className="group flex items-center gap-4 p-3 rounded-xl transition-all duration-200 hover:bg-[var(--wk-surface)] cursor-pointer border border-transparent hover:border-[var(--wk-border)]"
                  >
                    {/* Rank */}
                    <div className="w-7 text-center shrink-0">
                      <span
                        className={`tabular-nums font-bold ${i < 3 ? "text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)]"}`}
                        style={{ fontSize: i < 3 ? "1.1rem" : "0.85rem" }}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                    </div>

                    {/* Artwork */}
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] shrink-0">
                      {entry.artworkUrl ? (
                        <img src={entry.artworkUrl} alt="" className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <i className="ri-music-line text-[var(--wk-text-faint)] text-lg" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-bold text-[var(--wk-text)] truncate group-hover:text-[var(--wk-brand)] transition-colors leading-snug">
                        {entry.trackTitle}
                      </div>
                      <div className="text-[12px] text-[var(--wk-text-muted)] truncate">
                        {entry.artistNames?.[0] || "Unknown artist"}
                      </div>
                    </div>

                    {/* Movement */}
                    <div className="shrink-0 flex items-center justify-center w-8">
                      <MovementIcon movement={entry.movement} />
                    </div>

                    {/* Weeks */}
                    <div className="shrink-0 w-9 text-right">
                      <span className="text-[11px] text-[var(--wk-text-faint)] tabular-nums">
                        {entry.weeksOnChart != null ? `${entry.weeksOnChart}w` : "—"}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Link
              to="/charts"
              className="sm:hidden inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold text-[var(--wk-brand)] cursor-pointer"
            >
              View all charts <i className="ri-arrow-right-line text-xs" />
            </Link>
          </div>

          {/* ── RIGHT: Magazine Stories ── */}
          <div>
            <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
              <div>
                <div
                  className="mb-3 text-[var(--wk-v-film)]"
                  style={{ fontFamily: "var(--wk-font-mono, monospace)", fontSize: ".7rem", letterSpacing: ".15em", textTransform: "uppercase", fontWeight: 600 }}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--wk-v-film)]" />
                    From the magazine
                  </span>
                </div>
                <h2
                  className="font-black tracking-[-0.03em] text-[var(--wk-text)]"
                  style={{ fontSize: "clamp(1.6rem,3vw,2.2rem)", lineHeight: 1.05 }}
                >
                  Editorial
                </h2>
              </div>
              <Link
                to="/magazine"
                className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--wk-v-film)] hover:opacity-75 transition-opacity whitespace-nowrap cursor-pointer"
              >
                Open magazine <i className="ri-arrow-right-line text-xs" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse">
                  <div className="aspect-[16/10] bg-[var(--wk-surface-raised)] rounded-t-xl" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                    <div className="h-3 w-full rounded bg-[var(--wk-surface-raised)]" />
                  </div>
                </div>
                {[1, 2].map((i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] animate-pulse">
                    <div className="w-16 h-16 rounded-lg bg-[var(--wk-surface-raised)] shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 rounded bg-[var(--wk-surface-raised)]" />
                      <div className="h-3 w-1/2 rounded bg-[var(--wk-surface-raised)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Featured story */}
                {featuredStory && (
                  <Link
                    to={`/magazine/${featuredStory.slug}`}
                    className="group block rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden transition-all duration-300 hover:border-[var(--wk-border-2)] cursor-pointer"
                  >
                    {featuredStory.heroUrl && (
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img
                          src={featuredStory.heroUrl}
                          alt={featuredStory.title}
                          className="w-full h-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                        {featuredStory.section && (
                          <span className="absolute top-3 left-3 text-[9px] font-black uppercase tracking-[0.14em] px-2.5 py-1 rounded-full bg-[var(--wk-v-film)]/85 text-white">
                            {featuredStory.section}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="text-[15px] font-bold text-[var(--wk-text)] line-clamp-2 mb-2 group-hover:text-[var(--wk-v-film)] transition-colors leading-snug">
                        {featuredStory.title}
                      </h3>
                      {featuredStory.dek && (
                        <p className="text-[12px] text-[var(--wk-text-muted)] line-clamp-2 leading-relaxed mb-3">
                          {featuredStory.dek}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-[var(--wk-text-faint)]">
                        {featuredStory.author && <span className="font-semibold">{featuredStory.author}</span>}
                        {featuredStory.readingTime && (
                          <>
                            {featuredStory.author && <span>·</span>}
                            <span>{featuredStory.readingTime} min read</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                )}

                {/* Side stories */}
                {sideStories.map((story) => (
                  <Link
                    key={story.slug}
                    to={`/magazine/${story.slug}`}
                    className="group flex gap-3 p-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all duration-200 hover:border-[var(--wk-border-2)] cursor-pointer"
                  >
                    {story.heroUrl && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-[var(--wk-surface-raised)] shrink-0">
                        <img
                          src={story.heroUrl}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-400 group-hover:scale-110"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      {story.section && (
                        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--wk-v-film)] mb-1 block">
                          {story.section}
                        </span>
                      )}
                      <h4 className="text-[13px] font-bold text-[var(--wk-text)] line-clamp-2 group-hover:text-[var(--wk-v-film)] transition-colors leading-snug">
                        {story.title}
                      </h4>
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[var(--wk-text-faint)]">
                        {story.author && <span className="font-semibold">{story.author}</span>}
                        {story.readingTime && <span>{story.author ? "·" : ""} {story.readingTime} min</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <Link
              to="/magazine"
              className="sm:hidden inline-flex items-center gap-1.5 mt-5 text-[13px] font-semibold text-[var(--wk-v-film)] cursor-pointer"
            >
              Open magazine <i className="ri-arrow-right-line text-xs" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}