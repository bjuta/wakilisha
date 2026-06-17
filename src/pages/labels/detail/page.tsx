import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { MetaTags } from "@/components/seo/MetaTags";
import { ch19Background } from "@/utils/ch19";
import { getLabel, type RepairedLabelDetail } from "@/services/repaired/client";
import { buildLabelHeroIntro, buildLabelSeoDescription } from "@/services/cultureContext/labelAdapters";
import { releaseUrl } from "@/utils/releaseUrl";

function releaseTypeBadge(type: string) {
  const t = type.toLowerCase();
  if (t === "album") return "Album";
  if (t === "ep") return "EP";
  if (t === "single") return "Single";
  return t;
}

function formatYear(date: string): string {
  if (!date) return "";
  return date.split("-")[0] || date;
}

export default function LabelDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<RepairedLabelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"releases" | "roster">("releases");

  useEffect(() => {
    let alive = true;
    if (!slug) {
      setLoading(false);
      setError("No label slug provided");
      return;
    }
    setLoading(true);
    setError(null);
    getLabel(slug)
      .then((data) => {
        if (!alive) return;
        if (!data) {
          setError("Label not found.");
          setLoading(false);
          return;
        }
        setDetail(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Could not load label.");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[15px] font-semibold text-[var(--wk-text-muted)]">Loading label&hellip;</p>
        </div>
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="min-h-screen px-6 py-20 text-center">
        <WkIcon name="Building2" size={42} className="mx-auto mb-4 text-[var(--wk-text-faint)]" />
        <h1 className="mb-2 text-[28px] font-black text-[var(--wk-text)]">Label not found</h1>
        <p className="text-[var(--wk-text-muted)]">{error || "This label could not be found."}</p>
        <Link to="/labels" className="inline-block mt-6 rounded-xl bg-[var(--wk-brand)] px-6 py-3 text-[14px] font-bold text-[var(--wk-brand-on)]">Back to labels</Link>
      </main>
    );
  }

  const { label, roster, releases, relatedLabels } = detail;
  const heroBg = ch19Background({ slug: label.slug, name: label.name });
  const sortedReleases = [...releases].sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));
  const labelIntro = buildLabelHeroIntro(detail) || label.description || "";
  const seoDescription = buildLabelSeoDescription(detail);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <MetaTags
        title={`${label.name} on WAKILISHA`}
        description={seoDescription}
        type="website"
      />

      <section className="relative -mt-16 pt-16 flex min-h-[320px] items-end overflow-hidden md:min-h-[460px]">
        <div className="absolute inset-0" style={{ background: heroBg }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent" />
        <div className="absolute left-8 top-8 hidden opacity-10 md:block">
          <WkIcon name="Building2" size={180} style={{ color: "white" }} />
        </div>
        <div className="relative w-full px-4 pb-8 pt-20 md:px-8 md:pb-14 md:pt-28">
          <div className="mx-auto max-w-[1100px]">
            <Link to="/labels" className="mb-4 inline-flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/60 transition-colors hover:text-white">
              <span className="h-px w-5 bg-white/40" /> Labels
            </Link>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-6">
              <div className="min-w-0 flex-1">
                <h1 className="font-black leading-[0.88] tracking-[-0.04em] text-white" style={{ fontSize: "clamp(34px, 6vw, 76px)" }}>{label.name}</h1>
                {labelIntro && (
                  <p className="mt-3 max-w-[580px] text-[14px] leading-relaxed text-white/55 md:text-[16px] line-clamp-2 md:line-clamp-none">{labelIntro}</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 self-start md:self-end">
                {label.countryCode && (
                  <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold text-white/80 backdrop-blur-sm">
                    <WkIcon name="MapPin" size={13} /> {label.countryCode.toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-[12px] text-white/50 md:text-[13px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <WkIcon name="Disc" size={13} />
                <strong className="text-white/80">{releases.length}</strong> releases
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur-sm">
                <WkIcon name="Users" size={13} />
                <strong className="text-white/80">{roster.length}</strong> roster artists
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1100px] px-4 py-10 md:px-8 md:py-14">
        <div className="space-y-14">
          <div className="flex gap-0 overflow-x-auto border-b border-[var(--wk-divider)]">
            <button
              onClick={() => setActiveTab("releases")}
              className={`whitespace-nowrap px-5 py-3 text-[13px] font-bold transition-all ${activeTab === "releases" ? "border-b-[2px] border-[var(--wk-brand)] text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)] hover:text-[var(--wk-text-muted)]"}`}
            >
              Release catalog
              <span className="ml-2 rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px]">{releases.length}</span>
            </button>
            <button
              onClick={() => setActiveTab("roster")}
              className={`whitespace-nowrap px-5 py-3 text-[13px] font-bold transition-all ${activeTab === "roster" ? "border-b-[2px] border-[var(--wk-brand)] text-[var(--wk-brand)]" : "text-[var(--wk-text-faint)] hover:text-[var(--wk-text-muted)]"}`}
            >
              Roster
              <span className="ml-2 rounded-full bg-[var(--wk-surface-raised)] px-2 py-0.5 text-[10px]">{roster.length}</span>
            </button>
          </div>

          {activeTab === "releases" && (
            <section>
              {sortedReleases.length === 0 ? (
                <div className="py-12 text-center">
                  <WkIcon name="Disc" size={36} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
                  <p className="text-[14px] text-[var(--wk-text-muted)]">No releases here yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {sortedReleases.map((release) => (
                    <Link
                      key={release.slug}
                      to={releaseUrl({ slug: release.slug, artist: release.artistName || label.name })}
                      className="group overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
                    >
                      <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                        {release.artworkUrl ? (
                          <img src={release.artworkUrl} alt={release.title} className="h-full w-full object-cover" />
                        ) : (
                          <Chapter19FallbackImage slug={release.slug} name={release.title} className="h-full" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <span className="absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                          {releaseTypeBadge(release.releaseType)}
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{release.title}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--wk-text-muted)]">
                          <span>{formatYear(release.releaseDate)}</span>
                          {release.trackCount > 0 && (
                            <>
                              <span className="text-[var(--wk-divider)]">·</span>
                              <span>{release.trackCount} tracks</span>
                            </>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "roster" && (
            <section>
              {roster.length === 0 ? (
                <div className="py-12 text-center">
                  <WkIcon name="Users" size={36} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
                  <p className="text-[14px] text-[var(--wk-text-muted)]">No roster information available yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {roster.map((artist) => (
                    <Link
                      key={artist.slug}
                      to={`/artists/${artist.slug}`}
                      className="group overflow-hidden rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] transition-all hover:border-[var(--wk-brand)]"
                    >
                      <div className="relative aspect-square bg-[var(--wk-surface-raised)]">
                        {artist.artworkUrl ? (
                          <img src={artist.artworkUrl} alt={artist.name} className="h-full w-full object-cover" />
                        ) : (
                          <Chapter19FallbackImage slug={artist.slug} name={artist.name} className="h-full" />
                        )}
                      </div>
                      <div className="p-3">
                        <div className="truncate text-[13px] font-bold text-[var(--wk-text)]">{artist.name}</div>
                        <div className="text-[11px] text-[var(--wk-text-muted)]">Artist</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {label.countryCode && (
            <section>
              <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Country context</h2>
              <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-5 md:p-7">
                <div className="flex items-start gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--wk-brand-soft)] text-[22px] font-black text-[var(--wk-brand)]">
                    {label.countryCode.toUpperCase()}
                  </span>
                  <div>
                    <h3 className="text-[16px] font-bold text-[var(--wk-text)]">Based in {label.countryCode.toUpperCase()}</h3>
                    <p className="mt-1 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                      {label.name} operates from {label.countryCode.toUpperCase()}
                      {releases.length > 0 && ` with ${releases.length} release${releases.length === 1 ? "" : "s"}`}
                      {roster.length > 0 && ` across ${roster.length} artist${roster.length === 1 ? "" : "s"}`}.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {relatedLabels.length > 0 && (
            <section>
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--wk-text-muted)]">Related labels</h2>
                <span className="rounded-full bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]">{relatedLabels.length}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {relatedLabels.map((rl) => (
                  <Link
                    key={rl.slug}
                    to={`/labels/${rl.slug}`}
                    className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2.5 text-[13px] font-semibold text-[var(--wk-text-soft)] transition-all hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
                  >
                    {rl.name}
                  </Link>
                ))}
              </div>
            </section>
          )}

          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[16px] font-black text-[var(--wk-text)]">Explore the label directory</h3>
                <p className="mt-1 text-[13px] text-[var(--wk-text-muted)]">Browse all labels, their rosters and release catalogs across WAKILISHA.</p>
              </div>
              <div className="flex gap-2">
                <Link to="/labels" className="whitespace-nowrap rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)] transition-all hover:opacity-90">
                  All labels
                </Link>
                <Link to="/artists" className="whitespace-nowrap rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-text)] transition-all hover:bg-[var(--wk-surface-raised)]">
                  Artists
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
