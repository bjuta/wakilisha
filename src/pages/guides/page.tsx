import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { WkButton } from "@/components/design-system/primitives/Button";

interface Guide {
  slug: string;
  title: string | null;
  excerpt: string | null;
  wp_status: string | null;
  created_at: string;
}

export default function GuidesPage() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data, error: queryError } = await supabase
          .from("wk_guides")
          .select("slug, title, excerpt, wp_status, created_at")
          .eq("wp_status", "publish")
          .order("created_at", { ascending: false })
          .limit(50);

        if (queryError) throw queryError;
        setGuides(data ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load guides");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <section className="py-12 md:py-20 border-b border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6">
          <div className="wk-eyebrow mb-4">Recently Launched</div>
          <h1 className="font-black text-[clamp(32px,5vw,60px)] leading-[0.94] tracking-[-0.04em] text-[var(--wk-text)] mb-4">
            WAKILISHA Guides
          </h1>
          <p className="text-[clamp(15px,1.6vw,18px)] leading-relaxed text-[var(--wk-text-soft)] max-w-[640px]">
            Your practical discovery layer for African creative life. Where to go,
            what to experience, what to listen to, what to watch, who to know, and
            how to navigate the culture.
          </p>
        </div>
      </section>

      {/* Guide cards */}
      <section className="py-12 md:py-20" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="wk-container-wide px-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] h-[200px]" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-[var(--wk-danger-soft)]">
                <i className="ri-error-warning-line text-2xl text-[var(--wk-danger)]" />
              </div>
              <p className="text-[15px] text-[var(--wk-text-muted)] mb-4">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="wk-button wk-button-primary text-[13px] cursor-pointer"
              >
                <i className="ri-refresh-line" /> Retry
              </button>
            </div>
          ) : guides.length === 0 ? (
            <div className="text-center py-20">
              <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-[var(--wk-surface-raised)]">
                <i className="ri-compass-3-line text-2xl text-[var(--wk-text-faint)]" />
              </div>
              <h2 className="text-[18px] font-bold text-[var(--wk-text)] mb-2">Guides are being curated</h2>
              <p className="text-[14px] text-[var(--wk-text-muted)] max-w-[400px] mx-auto">
                Our editorial team is preparing the first collection of guides. Check back soon — or subscribe to be notified when they launch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {guides.map((guide) => (
                <Link
                  key={guide.slug}
                  to={`/guides/${guide.slug}`}
                  className="group rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 transition-all hover:border-[var(--wk-border-2)] cursor-pointer"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--wk-v-intel)", color: "#fff" }}>
                      <i className="ri-compass-3-line text-lg" />
                    </div>
                    <h2 className="text-[16px] font-black text-[var(--wk-text)] leading-snug tracking-[-0.02em] group-hover:text-[var(--wk-v-intel)] transition-colors">
                      {guide.title || "(Untitled)"}
                    </h2>
                  </div>
                  {guide.excerpt && (
                    <p className="text-[13px] leading-relaxed text-[var(--wk-text-muted)] line-clamp-3">
                      {guide.excerpt}
                    </p>
                  )}
                  <div className="mt-4 flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-text-faint)] group-hover:text-[var(--wk-v-intel)] transition-colors group-hover:gap-2">
                    Read guide
                    <i className="ri-arrow-right-line text-[11px]" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Back to WAKILISHA */}
      <section className="py-12" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6 text-center">
          <Link to="/">
            <WkButton variant="ghost">
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </WkButton>
          </Link>
        </div>
      </section>
    </div>
  );
}