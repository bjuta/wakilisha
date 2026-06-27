import { useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { submitForm } from "@/services/formService";
import { BRIEFING_SLUGS, guideInterest, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import { inMinorKeysData } from "@/pages/guides/detail/data";
import { MobileShareButton } from "@/components/design-system/share/ShareSheet";

export default function MobileVeniceGuide() {
  const { heroImage, issueBadge, title, curatorName, eventDate, locations, stats, quote, context, preview, curator, pavilions, focus, sample, download } = inMinorKeysData;
  const [showPavilion, setShowPavilion] = useState<number | null>(null);

  const sessionId = getAnalyticsSessionId();
  const pageUrl = getCanonicalPageUrl();
  const guideSlug = "in-minor-keys";
  const guideTitle = `${download.title} ${download.titleItalic}`;

  const [downloadStatus, setDownloadStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const handleDownloadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    trackEvent("guide_subscribe_submit", {
      pageType: "guide_detail",
      entitySlug: guideSlug,
      recordType: "guide",
      context: {
        source_section: "download_form_mobile",
        guide_title: guideTitle,
        guide_slug: guideSlug,
      },
    });

    setDownloadStatus("submitting");
    const form = e.currentTarget;
    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "guide_download" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    try {
      const result = await submitForm(submission);
      if (!result.success) throw new Error(result.error ?? "Could not save subscription.");

      await subscribeToBriefings(String(submission.email || ""), BRIEFING_SLUGS.fieldGuides, {
        sourceForm: "mobile_venice_download",
        pageType: "guide_detail",
        pageUrl,
        sessionId,
        interests: [
          guideInterest({
            slug: guideSlug,
            title: guideTitle,
            sourceForm: "mobile_venice_download",
            kind: "download",
            strength: 70,
            sourceContext: { source_section: "download_form_mobile", mobile: true },
          }),
        ],
      });

      setDownloadStatus("success");
    } catch (error) {
      console.warn("[mobile guide] subscription failed:", error);
      setDownloadStatus("error");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--wk-bg)" }}>
      {/* Hero */}
      <section className="relative min-h-[75dvh] flex flex-col justify-between overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src={heroImage} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/35 to-black/70" />
        </div>
        <div className="relative z-10 flex items-center justify-between px-4 pt-6">
          <Link to="/guides" className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 backdrop-blur-sm px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white/85 whitespace-nowrap">
            <i className="ri-arrow-left-line text-[12px]" /> Guides
          </Link>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--wk-v-intel)] px-3 py-1 text-[9px] font-black uppercase tracking-wider text-white">{issueBadge}</span>
            <MobileShareButton
              item={{
                title: "In Minor Keys",
                subtitle: "Venice Biennale Arte 2026 Guide",
                description: "WAKILISHA guide to the 2026 Venice Biennale Arte, curated by Koyo Kouoh.",
                type: "page",
              }}
            />
          </div>
        </div>
        <div className="relative z-10 px-4 py-8">
          <h1 className="text-[clamp(40px,11vw,72px)] font-black leading-[0.94] tracking-[-0.04em] text-white">
            <span className="block">In Minor</span>
            <span className="block italic font-light">Keys</span>
          </h1>
        </div>
        <div className="relative z-10 px-4 pb-6 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/60">Curator · Venice Biennale Arte 2026</p>
          <p className="text-[15px] font-semibold text-white">{curatorName}</p>
          <p className="text-[12px] text-white/70 leading-relaxed">{eventDate}<br />{locations}</p>
          <div className="flex gap-2 pt-2 flex-wrap">
            <a href="#download-mobile" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--wk-v-intel)] px-4 py-2.5 text-[12px] font-bold text-white whitespace-nowrap">
              <i className="ri-download-line" /> Get free guide
            </a>
            <a href="#preview-mobile" className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 px-4 py-2.5 text-[12px] font-bold text-white whitespace-nowrap">
              <i className="ri-compass-3-line" /> Preview
            </a>
          </div>
        </div>
        <div className="relative z-10 border-t border-white/10 bg-black/40 backdrop-blur-sm">
          <div className="px-4 py-5 grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-[26px] font-black leading-none text-white">{s.number}</div>
                <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.1em] text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="border-l-[3px] border-[var(--wk-brand)] pl-4">
          <p className="text-[15px] leading-relaxed italic text-[var(--wk-text-soft)]">{quote.text}</p>
          <cite className="mt-3 block text-[11px] font-semibold text-[var(--wk-text-muted)] not-italic">{quote.attribution}</cite>
        </div>
      </section>

      {/* Context */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{context.eyebrow}</span>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {context.title}<br /><em className="italic font-light">{context.titleItalic}</em>
          </h2>
        </div>
        <div className="space-y-5">
          {context.columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-[14px] font-bold text-[var(--wk-text)] mb-1">{col.title}</h3>
              <p className="text-[13px] leading-relaxed text-[var(--wk-text-soft)]">{col.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Preview - 6 card mosaic */}
      <section id="preview-mobile" className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{preview.eyebrow}</span>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {preview.title}<br /><em className="italic font-light">{preview.titleItalic}</em>
          </h2>
          <span className="inline-block mt-2 text-[11px] text-[var(--wk-text-muted)]">{preview.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {preview.cards.map((card) => (
            <div key={card.number} className={`rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)] ${card.size === "large" ? "col-span-2" : ""}`}>
              <div className="aspect-[4/3] overflow-hidden">
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black text-[var(--wk-brand)]">{card.number}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--wk-text-muted)]">{card.label}</span>
                </div>
                <h3 className="text-[13px] font-bold text-[var(--wk-text)]">{card.title}</h3>
                <p className="text-[11px] text-[var(--wk-text-soft)] mt-0.5 line-clamp-2">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Curator */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{curator.eyebrow}</span>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {curator.title}<br /><em className="italic font-light">{curator.titleItalic}</em>
          </h2>
        </div>
        <div className="rounded-xl overflow-hidden mb-5">
          <img src={curator.image} alt="Koyo Kouoh" className="w-full aspect-[4/3] object-cover" />
        </div>
        <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-6">{curator.bio}</p>
        <div className="space-y-4 relative pl-6 border-l-2 border-[var(--wk-brand)]/30">
          {curator.timeline.map((t) => (
            <div key={t.year} className="relative">
              <div className="absolute -left-[25px] top-1 w-2 h-2 rounded-full bg-[var(--wk-brand)]" />
              <span className="text-[11px] font-black text-[var(--wk-brand)]">{t.year}</span>
              <p className="text-[13px] text-[var(--wk-text-soft)] mt-0.5">{t.event}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 13 Pavilions */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{pavilions.eyebrow}</span>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {pavilions.title}<br /><em className="italic font-light">{pavilions.titleItalic}</em>
          </h2>
          <span className="inline-block mt-2 text-[11px] text-[var(--wk-text-muted)]">{pavilions.label}</span>
        </div>
        <p className="text-[12px] italic leading-relaxed text-[var(--wk-text-muted)] mb-6 px-3 py-3 rounded-lg bg-[var(--wk-surface)] border border-[var(--wk-border)]">
          {pavilions.fieldNote}
        </p>
        <div className="space-y-3">
          {pavilions.pavilions.map((p) => (
            <div key={p.number}>
              <button
                onClick={() => setShowPavilion(showPavilion === Number(p.number) ? null : Number(p.number))}
                className="w-full flex items-center gap-3 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 text-left active:scale-[0.98] transition-transform cursor-pointer"
              >
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-[var(--wk-brand)]/10 flex items-center justify-center text-[13px] font-black text-[var(--wk-brand)]">{p.number}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-[var(--wk-text)]">{p.country}</span>
                    {p.type === "Debut" && <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--wk-v-intel)]/10 text-[var(--wk-v-intel)]">Debut</span>}
                  </div>
                  <p className="text-[12px] text-[var(--wk-text-muted)] truncate">{p.title}</p>
                </div>
                {showPavilion === Number(p.number) ? <i className="ri-arrow-up-s-line text-[var(--wk-text-muted)] text-lg" /> : <i className="ri-arrow-down-s-line text-[var(--wk-text-muted)] text-lg" />}
              </button>

              {showPavilion === Number(p.number) && (
                <div className="mt-2 mx-1 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4 space-y-3">
                  <h4 className="text-[14px] font-bold text-[var(--wk-text)]">{p.title}</h4>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--wk-brand)]/5 text-[var(--wk-brand)] font-semibold">{p.venue}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--wk-brand)]/5 text-[var(--wk-brand)] font-semibold">{p.route}</span>
                  </div>
                  <div className="text-[12px] leading-relaxed text-[var(--wk-text-soft)] space-y-2">
                    <p><strong className="text-[var(--wk-text)]">Commissioner:</strong> {p.commissioner}</p>
                    <p><strong className="text-[var(--wk-text)]">Curator:</strong> {p.curator}</p>
                    {p.exhibitors && <p><strong className="text-[var(--wk-text)]">Exhibitors:</strong> {p.exhibitors}</p>}
                  </div>
                  <div className="pt-2 border-t border-[var(--wk-divider)]">
                    <p className="text-[12px] leading-relaxed text-[var(--wk-text-soft)]">{p.context}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-[10px] px-2 py-1 rounded-md bg-[var(--wk-v-intel)]/5 text-[var(--wk-v-intel)] font-semibold"><i className="ri-eye-line mr-1" />{p.why}</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Kenya focus */}
      <section className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{focus.eyebrow}</span>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {focus.title}<br /><em className="italic font-light">{focus.titleItalic}</em>
          </h2>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-soft)]">{focus.description}</p>
        </div>
        <div className="space-y-4">
          {focus.cards.map((card) => (
            <div key={card.number} className="rounded-xl overflow-hidden border border-[var(--wk-border)] bg-[var(--wk-surface)]">
              <div className="aspect-[16/9] overflow-hidden">
                <img src={card.image} alt={card.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black text-[var(--wk-brand)]">{card.number}</span>
                  <span className="text-[9px] uppercase tracking-wider text-[var(--wk-text-muted)]">{card.label}</span>
                </div>
                <h3 className="text-[15px] font-bold text-[var(--wk-text)]">{card.title}</h3>
                <p className="text-[12px] text-[var(--wk-text-soft)] mt-1">{card.description}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] italic text-[var(--wk-text-muted)]">{focus.note}</p>
      </section>

      {/* Sample pages */}
      <section className="py-12" style={{ background: "var(--wk-bg-subtle)" }}>
        <div className="px-5 mb-6">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{sample.eyebrow}</span>
          <h2 className="text-[24px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
            {sample.title}<br /><em className="italic font-light">{sample.titleItalic}</em>
          </h2>
          <span className="inline-block mt-2 text-[11px] text-[var(--wk-text-muted)]">{sample.label}</span>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-2 -mr-5 snap-x snap-mandatory scrollbar-hide">
          {sample.pages.map((page, i) => (
            <div key={i} className="flex-shrink-0 w-[160px] snap-center rounded-lg overflow-hidden border border-[var(--wk-border)] shadow-sm">
              <img src={page.image} alt={page.alt} className="w-full aspect-[3/4] object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* Download */}
      <section id="download-mobile" className="py-12 px-5" style={{ background: "var(--wk-bg)" }}>
        <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6">
          <div className="mb-4">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">{download.eyebrow}</span>
            <h2 className="text-[22px] font-black leading-tight tracking-[-0.03em] text-[var(--wk-text)] mt-1">
              {download.title}<br /><em className="italic font-light">{download.titleItalic}</em>
            </h2>
            <p className="mt-2 text-[13px] text-[var(--wk-text-soft)]">{download.description}</p>
          </div>
          <ul className="space-y-2 mb-5">
            {download.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--wk-text-soft)]">
                <i className="ri-check-line text-[var(--wk-brand)] mt-0.5 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <form
            onSubmit={handleDownloadSubmit}
            className="space-y-3"
          >
            <input type="hidden" name="wk_session_id" value={sessionId} />
            <input type="hidden" name="wk_page_url" value={pageUrl} />
            <input type="hidden" name="wk_page_type" value="guide_detail" />
            <input type="hidden" name="wk_source_section" value="download_form_mobile" />
            <input
              type="email"
              name="email"
              placeholder="Your email address"
              required
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 py-3 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)]/40"
            />
            <button type="submit" disabled={downloadStatus === "submitting" || downloadStatus === "success"} className="w-full rounded-lg bg-[var(--wk-v-intel)] px-4 py-3 text-[13px] font-bold text-white active:scale-[0.98] transition-transform whitespace-nowrap cursor-pointer disabled:opacity-60">
              {downloadStatus === "submitting" ? "Sending..." : downloadStatus === "success" ? "Guide sent!" : <><i className="ri-download-line mr-1.5" /> Download Free Guide</>}
            </button>
          </form>
        </div>
      </section>

      {/* Back footer */}
      <div className="py-10 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg)" }}>
        <div className="px-5 text-center">
          <Link to="/guides" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-5 py-3 text-[13px] font-bold text-[var(--wk-text)] active:scale-[0.97] transition-transform whitespace-nowrap">
            <i className="ri-arrow-left-line" /> Back to All Guides
          </Link>
        </div>
      </div>
    </div>
  );
}