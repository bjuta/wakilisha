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
  variant?: "default" | "compact";
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
  successMessage = "You’re in. Check your inbox to confirm your subscription.",
  variant = "default",
  analytics,
}: NewsletterSubscribeProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const compact = variant === "compact";

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
      setMessage(result.status === "already_confirmed" ? "You’re already confirmed. Your preferences have been updated." : successMessage);
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
      setMessage("We couldn't sign you up. Try again in a moment.");

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
    <div
      className={
        compact
          ? "rounded-2xl border border-background-200/70 bg-background-50 px-5 py-6 md:px-7 md:py-7"
          : "rounded-2xl border border-background-200/70 bg-background-50 px-6 py-14 md:px-12 md:py-20 lg:px-16 lg:py-24"
      }
    >
      <div
        className={
          compact
            ? "mx-auto max-w-5xl text-left lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(320px,500px)] lg:items-center lg:gap-x-10"
            : "mx-auto max-w-2xl text-center"
        }
      >
        <h2
          className={
            compact
              ? "mb-2 text-[22px] font-black leading-tight tracking-[-0.03em] text-foreground-950 md:text-[24px] lg:col-start-1 lg:row-start-1"
              : "mb-4 text-[clamp(28px,4vw,52px)] font-black leading-[0.95] tracking-[-0.04em] text-foreground-950"
          }
        >
          {headline}
        </h2>

        <p
          className={
            compact
              ? "mb-5 max-w-xl text-[13px] leading-5 text-foreground-600 lg:col-start-1 lg:row-start-2 lg:mb-0"
              : "mx-auto mb-8 max-w-lg text-[15px] leading-relaxed text-foreground-600 md:text-[17px]"
          }
        >
          {description}
        </p>

        <form
          ref={formRef}
          id={formId}
          onSubmit={handleSubmit}
          className={
            compact
              ? "w-full lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center"
              : "mx-auto max-w-lg"
          }
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
              className={`flex-1 rounded-full border border-background-200/70 bg-background-50 px-6 font-medium text-foreground-950 placeholder:text-foreground-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent transition-all disabled:opacity-50 ${
                compact
                  ? "h-11 text-[13px] sm:h-12"
                  : "h-14 text-[15px] sm:h-16"
              }`}
            />
            <button
              type="submit"
              disabled={status === "submitting" || status === "success"}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-full bg-[var(--wk-brand)] font-bold text-[var(--wk-brand-on)] transition-colors hover:bg-[var(--wk-brand-2)] disabled:opacity-50 ${
                compact
                  ? "h-11 px-6 text-[13px] sm:h-12"
                  : "h-14 px-8 text-[15px] sm:h-16"
              }`}
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

        <p
          className={
            compact
              ? "mt-3 text-[10px] text-foreground-400 lg:col-start-2 lg:row-start-3"
              : "mt-6 text-[12px] text-foreground-400"
          }
        >
          No spam. One-click unsubscribe anytime.
        </p>
      </div>
    </div>
  );
}
