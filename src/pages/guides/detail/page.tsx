import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { WkButton } from "@/components/design-system/primitives/Button";
import { fetchGuidePage } from "@/services/guidePages";
import type { GuidePageRecord } from "./sectionTypes";
import GuideSectionRenderer from "./sections/GuideSectionRenderer";

export default function GuideDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [guide, setGuide] = useState<GuidePageRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proseFontSize, setProseFontSize] = useState(19);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    setError(null);

    fetchGuidePage(slug)
      .then((data) => {
        if (!data) {
          setError("Guide not found");
        }
        setGuide(data);
      })
      .catch((err) => {
        console.error("Error loading guide:", err);
        setError("Failed to load guide");
      })
      .finally(() => setLoading(false));
  }, [slug]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--wk-bg)" }}>
        <div className="text-center">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-[var(--wk-border)] border-t-[var(--wk-brand)] animate-spin" />
          <p className="text-[14px] text-[var(--wk-text-muted)]">Loading guide...</p>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !guide) {
    return (
      <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6 py-20 text-center">
          <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-[var(--wk-danger-soft)]">
            <i className="ri-error-warning-line text-2xl text-[var(--wk-danger)]" />
          </div>
          <h2 className="text-[20px] font-black text-[var(--wk-text)] mb-2">{error || "Guide not found"}</h2>
          <p className="text-[14px] text-[var(--wk-text-muted)] mb-6 max-w-[400px] mx-auto">
            This guide may not be available yet.
          </p>
          <Link to="/guides">
            <WkButton variant="primary">
              <i className="ri-arrow-left-line" /> Back to Guides
            </WkButton>
          </Link>
        </div>
      </div>
    );
  }

  // ── Render guide from DB sections ──
  const sections = guide.sections || [];

  return (
    <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {sections.map((section, index) => (
        <GuideSectionRenderer
          key={`${section.key}-${index}`}
          section={section}
          proseFontSize={proseFontSize}
          onProseFontChange={setProseFontSize}
        />
      ))}

      {/* Back link */}
      <div className="py-12 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="wk-container-wide px-6 text-center">
          <Link to="/guides">
            <WkButton variant="ghost">
              <i className="ri-arrow-left-line" /> Back to All Guides
            </WkButton>
          </Link>
        </div>
      </div>
    </div>
  );
}