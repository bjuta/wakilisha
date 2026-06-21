import { useParams, Link } from "react-router-dom";
import MobileVeniceGuide from "./components/MobileVeniceGuide";
import MobileDakarGuide from "./components/MobileDakarGuide";
import MobileReadingGuide from "./components/MobileReadingGuide";
import { useScrollDepthTracking } from "@/hooks/useScrollDepthTracking";

const SUPPORTED_SLUGS = ["in-minor-keys", "dakar-biennale-2026", "the-day-reading-changed"];

export default function MobileGuideDetail() {
  const { slug } = useParams<{ slug: string }>();

  useScrollDepthTracking({
    pageType: "guide_detail",
    entitySlug: slug,
    entityType: "guide",
  });

  if (!slug || !SUPPORTED_SLUGS.includes(slug)) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="text-center">
          <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-[var(--wk-danger-soft)]">
            <i className="ri-error-warning-line text-2xl" style={{ color: "var(--wk-danger)" }} />
          </div>
          <h2 className="text-[18px] font-black text-[var(--wk-text)] mb-2">Guide not found</h2>
          <p className="text-[13px] text-[var(--wk-text-muted)] mb-6">This guide may not be available yet.</p>
          <Link to="/guides" className="inline-flex items-center gap-2 rounded-full bg-[var(--wk-brand)] px-5 py-3 text-[13px] font-bold text-[var(--wk-brand-on)] active:scale-[0.97] transition-transform whitespace-nowrap">
            <i className="ri-arrow-left-line" /> Back to Guides
          </Link>
        </div>
      </div>
    );
  }

  if (slug === "in-minor-keys") return <MobileVeniceGuide />;
  if (slug === "dakar-biennale-2026") return <MobileDakarGuide />;
  return <MobileReadingGuide />;
}