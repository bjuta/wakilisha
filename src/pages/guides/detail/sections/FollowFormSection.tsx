import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import { submitForm } from "@/services/formService";
import { BRIEFING_SLUGS, guideInterest, subscribeToBriefings } from "@/services/audienceSubscriptionService";
import type { FollowFormData } from "../sectionTypes";

export default function FollowFormSection({ data }: { data: FollowFormData }) {
  const { slug } = useParams<{ slug: string }>();
  const titleItalic = data.titleItalic || data.title_italic || "";
  const guideSlug = slug || "guide";
  const guideTitle = `${data.title}${titleItalic ? ` ${titleItalic}` : ""}`.trim();
  const [email, setEmail] = useState("");
  const [persona, setPersona] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!consent) {
      setError("Please agree to receive updates.");
      return;
    }

    setSubmitting(true);

    trackEvent("guide_follow_submit", {
      pageType: "guide_detail",
      entitySlug: guideSlug,
      entityType: "guide",
      context: {
        source_section: "follow_form",
        guide_title: guideTitle,
        guide_slug: guideSlug,
        briefing_slugs: BRIEFING_SLUGS.fieldGuides,
      },
    });

    try {
      const form = e.currentTarget as HTMLFormElement;
      const formData = new FormData(form);
      const submission: Record<string, string> = { form_type: "dakar_follow" };
      formData.forEach((value, key) => {
        submission[key] = String(value);
      });

      const result = await submitForm(submission);
      if (!result.success) throw new Error(result.error ?? "Something went wrong. Please try again.");

      await subscribeToBriefings(email, BRIEFING_SLUGS.fieldGuides, {
        sourceForm: "guide_follow",
        pageType: "guide_detail",
        pageUrl: getCanonicalPageUrl(),
        sessionId: getAnalyticsSessionId(),
        interests: [
          guideInterest({
            slug: guideSlug,
            title: guideTitle,
            sourceForm: "guide_follow",
            kind: "follow",
            strength: 70,
            sourceContext: {
              source_section: "follow_form",
              persona,
            },
          }),
        ],
      });

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }

    setSubmitting(false);
  }, [email, consent, persona, guideSlug, guideTitle]);

  return (
    <section id="updates" className="w-full py-16 md:py-24 border-t border-[var(--wk-divider)]" style={{ background: "var(--wk-bg-alt, var(--wk-bg))" }}>
      <div className="wk-container-wide px-6 md:px-10 lg:px-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
          <div className="space-y-6">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-2">{data.label}</div>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-[var(--wk-text)] leading-tight">
              {data.title}{" "}
              {titleItalic && <em className="not-italic italic">{titleItalic}</em>}
            </h2>
            <div className="space-y-4 text-[15px] leading-relaxed text-[var(--wk-text-soft)]">
              {data.copy.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--wk-divider)] p-6 md:p-8" style={{ background: "var(--wk-surface)" }}>
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-full bg-[var(--wk-success-soft)]">
                  <i className="ri-check-line text-xl text-[var(--wk-success)]" />
                </div>
                <h3 className="text-lg font-bold text-[var(--wk-text)] mb-2">You are on the list</h3>
                <p className="text-sm text-[var(--wk-text-soft)]">Check your inbox to confirm Field Guides updates.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-[var(--wk-text)] mb-1">{data.form.heading}</h3>
                  <p className="text-sm text-[var(--wk-text-soft)]">{data.form.description}</p>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1.5">{data.form.emailLabel}</span>
                    <input
                      type="email"
                      name="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={data.form.emailPlaceholder}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--wk-divider)] bg-[var(--wk-bg)] text-[var(--wk-text)] placeholder:text-[var(--wk-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--wk-v-fashion)]/30 focus:border-[var(--wk-v-fashion)] transition-all"
                      required
                    />
                  </label>

                  {data.form.personaLabel && data.form.personaOptions && (
                    <label className="block">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--wk-text-muted)] mb-1.5">{data.form.personaLabel}</span>
                      <select
                        name="persona"
                        value={persona}
                        onChange={(e) => setPersona(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[var(--wk-divider)] bg-[var(--wk-bg)] text-[var(--wk-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wk-v-fashion)]/30 focus:border-[var(--wk-v-fashion)] transition-all appearance-none cursor-pointer"
                        style={{ backgroundImage: "none" }}
                      >
                        {data.form.personaOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      name="consent"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 rounded border-[var(--wk-divider)] text-[var(--wk-v-fashion)] focus:ring-[var(--wk-v-fashion)]/30 cursor-pointer"
                      required
                    />
                    <span className="text-sm text-[var(--wk-text-soft)] leading-relaxed">{data.form.consentLabel}</span>
                  </label>
                </div>

                {error && (
                  <p className="text-sm text-[var(--wk-danger)] flex items-center gap-1.5">
                    <i className="ri-error-warning-line" />{error}
                  </p>
                )}

                <button type="submit" disabled={submitting} className="w-full inline-flex items-center justify-center px-5 py-3 text-sm font-semibold bg-[var(--wk-text)] text-white rounded-md hover:bg-[var(--wk-text)]/90 disabled:opacity-60 transition-colors whitespace-nowrap">
                  {submitting ? (
                    <>
                      <i className="ri-loader-4-line animate-spin mr-2" /> Sending...
                    </>
                  ) : data.form.submitLabel}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
