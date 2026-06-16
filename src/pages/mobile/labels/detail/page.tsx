import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkIcon } from "@/components/design-system/Icon";
import { Chapter19FallbackImage } from "@/components/media/Chapter19FallbackImage";
import { ch19Background } from "@/utils/ch19";
import { getLabel, type RepairedLabelDetail } from "@/services/repaired/client";

export default function MobileLabelDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [detail, setDetail] = useState<RepairedLabelDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"releases" | "roster">("releases");

  useEffect(() => {
    let alive = true;
    if (!slug) { setLoading(false); setError("No label slug"); return; }
    setLoading(true);
    getLabel(slug)
      .then((data) => { if (!alive) return; if (!data) { setError("Label not found"); setLoading(false); return; } setDetail(data); setLoading(false); })
      .catch((err) => { if (!alive) return; setError(err instanceof Error ? err.message : "Error"); setLoading(false); });
    return () => { alive = false; };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-14 w-14 rounded-xl bg-[var(--wk-surface-raised)] animate-pulse" />
          <p className="text-[14px] font-semibold text-[var(--wk-text-muted)]">Loading label...</p>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen px-6 py-16 text-center">
        <WkIcon name="Building2" size={36} className="mx-auto mb-3 text-[var(--wk-text-faint)]" />
        <h1 className="mb-2 text-[22px] font-black text-[var(--wk-text)]">Label not found</h1>
        <p className="text-[var(--wk-text-muted)]">{error || "Not found"}</p>
        <Link to="/labels" className="mt-5 inline-block rounded-xl bg-[var(--wk-brand)] px-5 py-2.5 text-[13px] font-bold text-[var(--wk-brand-on)]">Back to labels</Link>
      </div>
    );
  }

  const { label, roster, releases, relatedLabels } = detail;
  const heroBg = ch19Background({ slug: label.slug, name: label.name });
  const sortedReleases = [...releases].sort((a, b) => (b.releaseDate || "").localeCompare(a.releaseDate || ""));

  return (
    <div className="min-h-screen bg-[var(--wk-bg)]">

      {/* Hero */}
      <section className="relative flex min-h-[240px] items-end overflow-hidden">
        <div className="absolute inset-0" style={{ background: heroBg }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="relative w-full px-5 pb-6 pt-16">
          <Link to="/labels" className="mb-3 inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/50">
            <i className="ri-arrow-left-line text-[11px]" /> Labels
          </Link>
          <h1 className="text-[30px] font-black leading-[0.92] tracking-[-0.03em] text-white">{label.name}</h1>
          {label.description && <p className="mt-2 text-[13px] leading-relaxed text-white/55 line-clamp-2">{label.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-white/50">
            {label.countryCode && <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1"><strong className="text-white/80">{label.countryCode.toUpperCase()}</strong></span>}
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1"><strong className="text-white/80">{releases.length}</strong> releases</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1"><strong className="text-white/80">{roster.length}</strong> artists</span>
          </div>
        </div>
      </section>

      <div className="px-5 py-8 space-y-6">

        {/* Tabs */}
        <div className="flex rounded-xl bg-[var(--wk-surface)] p-1">
          <button onClick={() => setTab("releases")} className={`flex-1 rounded-lg py-2.5 text-[13px] font-bold transition-all ${tab === "releases" ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "text-[var(--wk-text-muted)]"}`}>Releases · {releases.length}</button>
          <button onClick={() => setTab("roster")} className={`flex-1 rounded-lg py-2.5 text-[13px] font-bold transition-all ${tab === "roster" ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]" : "text-[var(--wk-text-muted)]"}`}>Roster · {roster.length}</button>
        </div>

        {/* Releases */}
        {tab === "releases" && (
          sortedReleases.length === 0 ? (
            <div className="py-12 text-center text-[var(--wk-text-muted)]"><WkIcon name="Disc" size={30} className="mx-auto mb-2" />No releases yet</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {sortedReleases.map((r) => (
                <Link key={r.slug} to={`/releases/${label.slug}--${r.slug}`} className="overflow-hidden rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                  <div className="aspect-square bg-[var(--wk-surface-raised)]">
                    {r.artworkUrl ? <img src={r.artworkUrl} alt={r.title} className="h-full w-full object-cover" /> : <Chapter19FallbackImage slug={r.slug} name={r.title} className="h-full" />}
                  </div>
                  <div className="p-2">
                    <div className="truncate text-[11px] font-bold text-[var(--wk-text)]">{r.title}</div>
                    <div className="text-[10px] text-[var(--wk-text-muted)]">{r.releaseDate ? r.releaseDate.split("-")[0] : ""}{r.trackCount > 0 ? ` · ${r.trackCount} tr.` : ""}</div>
                  </div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Roster */}
        {tab === "roster" && (
          roster.length === 0 ? (
            <div className="py-12 text-center text-[var(--wk-text-muted)]"><WkIcon name="Users" size={30} className="mx-auto mb-2" />No roster info</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {roster.map((a) => (
                <Link key={a.slug} to={`/artists/${a.slug}`} className="overflow-hidden rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)]">
                  <div className="aspect-square bg-[var(--wk-surface-raised)]">
                    {a.artworkUrl ? <img src={a.artworkUrl} alt={a.name} className="h-full w-full object-cover" /> : <Chapter19FallbackImage slug={a.slug} name={a.name} className="h-full" />}
                  </div>
                  <div className="p-2"><div className="truncate text-[12px] font-bold text-[var(--wk-text)]">{a.name}</div></div>
                </Link>
              ))}
            </div>
          )
        )}

        {/* Related labels */}
        {relatedLabels.length > 0 && (
          <section>
            <h2 className="mb-3 text-[11px] font-black uppercase tracking-[0.15em] text-[var(--wk-text-muted)]">Related labels</h2>
            <div className="flex flex-wrap gap-2">
              {relatedLabels.map((rl) => (
                <Link key={rl.slug} to={`/labels/${rl.slug}`} className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--wk-text-soft)]">{rl.name}</Link>
              ))}
            </div>
          </section>
        )}

        <Link to="/labels" className="flex items-center justify-center gap-1.5 rounded-xl bg-[var(--wk-brand)] py-3 text-[14px] font-bold text-[var(--wk-brand-on)]">
          <i className="ri-building-2-line text-[15px]" /> Browse all labels
        </Link>
      </div>
    </div>
  );
}