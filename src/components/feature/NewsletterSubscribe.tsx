import { useState, useRef } from "react";
import { trackEvent, getAnalyticsSessionId, getCanonicalPageUrl } from "@/services/analytics";
import {
  BRIEFING_SLUGS,
  isValidEmail,
  normalizeEmail,
  subscribeToBriefings,
} from "@/services/audienceSubscriptionService";
import type { AudienceInterestInput } from "@/services/briefingService";

interface NewsletterSubscribeProps {
  formId: string;
  headline: string;
  description: string;
  contextFields?: Record<string, string>;
  briefingSlugs?: readonly string[];
  sourceForm?: string;
  interests?: AudienceInterestInput[];
  successMessage?: string;
  analytics?: {
    pageType?: string;
    entitySlug?: string;
    entityType?: string;
    context?: Record<string, unknown>;
  };
}

export function NewsletterSubscribe({
  formId,
  headline,
  description,
  contextFields,
  briefingSlugs = BRIEFING_SLUGS.cultureDispatch,
  sourceForm = "newsletter_subscribe",
  interests = [],
  successMessage = "You're in. Check your inbox to confirm your subscription.",
  analytics,
}: NewsletterSubscribeProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const emailValue = normalizeEmail(emailInput.value);

    if (!isValidEmail(emailValue)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");

      trackEvent("newsletter_validation_error", {
        pageType: analytics?.pageType,
        entitySlug: analytics?.entitySlug,
        entityType: analytics?.entityType,
        context: {
          form_id: formId,
          source_form: sourceForm,
          briefing_slugs: briefingSlugs,
          ...analytics?.context,
          validation_reason: "invalid_email",
        },
      });

      return;
    }

    setStatus("submitting");
    setMessage("");

    trackEvent("newsletter_submit", {
      pageType: analytics?.pageType,
      entitySlug: analytics?.entitySlug,
      entityType: analytics?.entityType,
      context: {
        form_id: formId,
        source_form: sourceForm,
        briefing_slugs: briefingSlugs,
        audience_interest_count: interests.length,
        ...analytics?.context,
      },
    });

    try {
      const result = await subscribeToBriefings(emailValue, briefingSlugs, {
        sourceForm,
        pageType: analytics?.pageType ?? contextFields?.wk_page_type ?? "newsletter",
        pageUrl: getCanonicalPageUrl(),
        sessionId: getAnalyticsSessionId(),
        interests,
      });

      setStatus("success");
      setMessage(result.status === "already_confirmed" ? "You're already confirmed. Your preferences have been updated." : successMessage);
      form.reset();

      trackEvent("newsletter_success", {
        pageType: analytics?.pageType,
        entitySlug: analytics?.entitySlug,
        entityType: analytics?.entityType,
        context: {
          form_id: formId,
          source_form: sourceForm,
          briefing_slugs: briefingSlugs,
          audience_interest_count: result.audience_interests?.length ?? 0,
          subscribe_status: result.status,
          ...analytics?.context,
        },
      });
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");

      trackEvent("newsletter_error", {
        pageType: analytics?.pageType,
        entitySlug: analytics?.entitySlug,
        entityType: analytics?.entityType,
        context: {
          form_id: formId,
          source_form: sourceForm,
          briefing_slugs: briefingSlugs,
          ...analytics?.context,
          error_type: error instanceof Error ? error.message : "server_error",
        },
      });
    }
  };

  return (
    <div className="rounded-2xl bg-background-50 border border-background-200/70 px-6 py-14 md:px-12 md:py-20 lg:px-16 lg:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-[clamp(28px,4vw,52px)] font-black leading-[0.95] tracking-[-0.04em] text-foreground-950 mb-4">
          {headline}
        </h2>

        <p className="text-[15px] md:text-[17px] leading-relaxed text-foreground-600 mb-8 max-w-lg mx-auto">
          {description}
        </p>

        <form
          ref={formRef}
          id={formId}
          onSubmit={handleSubmit}
          className="mx-auto max-w-lg"
        >
          {contextFields && Object.entries(contextFields).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}

          <div className="flex flex-col sm:flex-row gap-3 sm:gap-2">
            <input
              type="email"
              name="email"
              placeholder="Your email address"
              required
              autoComplete="email"
              disabled={status === "submitting" || status === "success"}
              className="flex-1 h-14 sm:h-16 rounded-full border border-background-200/70 bg-background-50 px-6 text-[15px] font-medium text-foreground-950 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={status === "submitting" || status === "success"}
              className="h-14 sm:h-16 px-8 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] font-bold text-[15px] whitespace-nowrap hover:bg-[var(--wk-brand-2)] transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
            >
              {status === "submitting" ? "Subscribing..." : status === "success" ? "Subscribed" : "Subscribe"}
            </button>
          </div>

          {message && (
            <p className={`mt-4 text-[14px] font-medium ${status === "success" ? "text-primary-600" : "text-red-500"}`} aria-live="polite">
              {message}
            </p>
          )}
        </form>

        <p className="mt-6 text-[12px] text-foreground-400">
          No spam. One-click unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
