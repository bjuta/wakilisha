import { useState } from "react";
import { Link } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { submitForm } from "@/services/formService";
import { BRIEFING_SLUGS, guideInterest, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import { inMinorKeysData } from "../data";

export default function GuideDownloadSection() {
  const { download } = inMinorKeysData;
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");

  const sessionId = getAnalyticsSessionId();
  const pageUrl = getCanonicalPageUrl();
  const guideSlug = "in-minor-keys";
  const guideTitle = `${download.title} ${download.titleItalic}`;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("submitting");

    trackEvent("guide_download_submit", {
      pageType: "guide_detail",
      entitySlug: guideSlug,
      entityType: "guide",
      context: {
        source_section: "download_form",
        guide_title: guideTitle,
        guide_slug: guideSlug,
      },
    });

    const form = e.currentTarget;
    const formData = new FormData(form);
    const submission: Record<string, string> = { form_type: "guide_download" };
    formData.forEach((value, key) => {
      submission[key] = String(value);
    });

    try {
      const result = await submitForm(submission);
      if (!result.success) throw new Error(result.error ?? "Could not send the guide.");

      await subscribeToBriefings(String(submission.email || ""), BRIEFING_SLUGS.fieldGuides, {
        sourceForm: "guide_download",
        pageType: "guide_detail",
        pageUrl,
        sessionId,
        interests: [
          guideInterest({
            slug: guideSlug,
            title: guideTitle,
            sourceForm: "guide_download",
            kind: "download",
            strength: 75,
            sourceContext: {
              source_section: "download_form",
              role: submission.wk_role || "",
              use_case: submission.wk_use_case || "",
            },
          }),
        ],
      });

      setStatus("success");
      form.reset();
    } catch (error) {
      console.warn("[guide] subscription or delivery failed:", error);
      setStatus("error");
    }
  };

  return (
    <section id="download" className="py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-subtle)" }}>
      <div className="wk-container-wide px-6">
        <div className="flex flex-col lg:flex-row gap-12 lg:gap-16">
          {/* Copy */}
          <div className="lg:w-[48%]">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--wk-v-intel)] mb-3">
              {download.eyebrow}
            </p>
            <h2 className="text-[clamp(28px,3.5vw,44px)] font-black leading-[1.05] tracking-[-0.03em] text-[var(--wk-text)] mb-4">
              {download.title}{" "}
              <span className="italic font-light">{download.titleItalic}</span>
            </h2>
            <p className="text-[15px] leading-relaxed text-[var(--wk-text-soft)] mb-6">
              {download.description}
            </p>
            <ul className="space-y-3">
              {download.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="flex h-5 w-5 shrink-0 mt-0.5 items-center justify-center rounded-full bg-[var(--wk-v-intel)]/15">
                    <i className="ri-check-line text-[10px] text-[var(--wk-v-intel)]" />
                  </div>
                  <span className="text-[14px] leading-snug text-[var(--wk-text-soft)]">{feature}</span>
                </li>
              ))}
            </ul>

            {/* Field Guide Link */}
            <div className="mt-8 pt-6 border-t border-[var(--wk-divider)]">
              <p className="text-[12px] font-semibold text-[var(--wk-text)] mb-2">Prefer to read online?</p>
              <p className="text-[13px] text-[var(--wk-text-soft)] mb-3">
                View the full field guide as a beautiful, scrollable page. You can also print it to PDF.
              </p>
              <Link
                to={`/guides/${guideSlug}/field-guide`}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-surface)] text-[var(--wk-text)] text-[13px] font-semibold hover:bg-[var(--wk-surface-raised)] transition-colors"
              >
                <i className="ri-book-open-line" /> Open the field guide
              </Link>
            </div>
          </div>

          {/* Form */}
          <div className="lg:w-[52%]">
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 md:p-8">
              {status === "success" ? (
                <div className="py-12 text-center">
                  <div className="flex h-16 w-16 mx-auto mb-4 items-center justify-center rounded-2xl bg-[var(--wk-success-soft)]">
                    <i className="ri-check-line text-2xl text-[var(--wk-success)]" />
                  </div>
                  <h3 className="text-[18px] font-bold text-[var(--wk-text)] mb-2">Guide on its way</h3>
                  <p className="text-[14px] text-[var(--wk-text-muted)]">
                    Check your inbox. The PDF will arrive shortly.
                  </p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <p className="text-[13px] font-bold text-[var(--wk-text)] mb-1">Send the PDF</p>
                    <p className="text-[12px] text-[var(--wk-text-muted)]">
                      Tell us where to send it and what brought you here.
                    </p>
                  </div>

                  <form
                    onSubmit={handleSubmit}
                    className="space-y-4"
                  >
                    <input type="hidden" name="wk_session_id" value={sessionId} />
                    <input type="hidden" name="wk_page_url" value={pageUrl} />
                    <input type="hidden" name="wk_page_type" value="guide_detail" />
                    <input type="hidden" name="wk_source_section" value="download_form" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-[var(--wk-text)] mb-1.5">
                          What should we call you?
                        </label>
                        <input
                          type="text"
                          name="wk_first_name"
                          placeholder="Your name"
                          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-sm text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-v-intel)] focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-[var(--wk-text)] mb-1.5">
                          Where should we send it? <span className="text-[var(--wk-danger)]">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          placeholder="you@example.com"
                          required
                          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-sm text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-v-intel)] focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[12px] font-semibold text-[var(--wk-text)] mb-1.5">
                          Where are you reading from?
                        </label>
                        <input
                          type="text"
                          name="wk_city"
                          placeholder="City, country"
                          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-sm text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] focus:border-[var(--wk-v-intel)] focus:outline-none transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-semibold text-[var(--wk-text)] mb-1.5">
                          Which best describes you?
                        </label>
                        <select
                          name="wk_role"
                          className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-sm text-[var(--wk-text)] focus:border-[var(--wk-v-intel)] focus:outline-none transition-colors cursor-pointer"
                        >
                          <option value="">Choose one</option>
                          <option>Artist or creative</option>
                          <option>Curator, gallery or museum</option>
                          <option>Cultural institution</option>
                          <option>Writer, editor or journalist</option>
                          <option>Researcher, student or educator</option>
                          <option>Collector or patron</option>
                          <option>Traveller or culture lover</option>
                          <option>Brand, funder or partner</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[12px] font-semibold text-[var(--wk-text)] mb-1.5">
                        What brought you to this guide?
                      </label>
                      <select
                        name="wk_use_case"
                        className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-sm text-[var(--wk-text)] focus:border-[var(--wk-v-intel)] focus:outline-none transition-colors cursor-pointer"
                      >
                        <option value="">Choose the closest reason</option>
                        <option>Planning a Venice visit</option>
                        <option>Following African pavilions</option>
                        <option>Researching artists or institutions</option>
                        <option>Writing, teaching or programming culture</option>
                        <option>Collecting or supporting African art</option>
                        <option>Exploring WAKILISHA field guides</option>
                      </select>
                    </div>

                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        name="wk_consent"
                        value="1"
                        required
                        className="mt-1 h-4 w-4 rounded border-[var(--wk-border)] accent-[var(--wk-v-intel)] cursor-pointer"
                      />
                      <span className="text-[12px] text-[var(--wk-text-muted)] leading-relaxed">
                        Send me this guide and occasional WAKILISHA notes. I can unsubscribe anytime.
                      </span>
                    </label>

                    {status === "error" && (
                      <div className="rounded-lg bg-[var(--wk-danger-soft)] p-3">
                        <p className="text-[13px] text-[var(--wk-danger)]">Something went wrong. Please try again.</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="w-full rounded-lg bg-[var(--wk-v-intel)] py-3.5 text-[14px] font-bold text-white hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {status === "submitting" ? "Sending..." : "Send the guide →"}
                    </button>

                    <p className="text-center text-[11px] text-[var(--wk-text-faint)]">PDF to your inbox.</p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}