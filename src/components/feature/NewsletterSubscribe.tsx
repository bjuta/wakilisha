import { useState, useRef } from "react";
import { trackEvent } from "@/services/analytics";

interface NewsletterSubscribeProps {
  formAction: string;
  formId: string;
  headline: string;
  description: string;
  contextFields?: Record<string, string>;
  /** Analytics context — passed through to trackEvent for all newsletter events */
  analytics?: {
    pageType?: string;
    entitySlug?: string;
    entityType?: string;
    context?: Record<string, unknown>;
  };
}

export function NewsletterSubscribe({
  formAction,
  formId,
  headline,
  description,
  contextFields,
  analytics,
}: NewsletterSubscribeProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const emailInput = form.elements.namedItem("email") as HTMLInputElement;
    const emailValue = emailInput.value.trim();

    if (!emailValue || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setStatus("error");
      setMessage("Please enter a valid email address.");

      trackEvent("newsletter_validation_error", {
        pageType: analytics?.pageType,
        entitySlug: analytics?.entitySlug,
        entityType: analytics?.entityType,
        context: {
          form_id: formId,
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
        ...analytics?.context,
      },
    });

    const formData = new FormData(form);
    const params = new URLSearchParams();
    formData.forEach((value, key) => {
      params.append(key, String(value));
    });

    try {
      const response = await fetch(formAction, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (response.ok) {
        setStatus("success");
        setMessage("You're in. Watch your inbox for updates.");
        form.reset();

        trackEvent("newsletter_success", {
          pageType: analytics?.pageType,
          entitySlug: analytics?.entitySlug,
          entityType: analytics?.entityType,
          context: {
            form_id: formId,
            ...analytics?.context,
          },
        });
      } else {
        setStatus("error");
        setMessage("Something went wrong. Please try again.");

        trackEvent("newsletter_error", {
          pageType: analytics?.pageType,
          entitySlug: analytics?.entitySlug,
          entityType: analytics?.entityType,
          context: {
            form_id: formId,
            ...analytics?.context,
            error_type: "server_error",
          },
        });
      }
    } catch {
      setStatus("error");
      setMessage("Something went wrong. Please try again.");

      trackEvent("newsletter_error", {
        pageType: analytics?.pageType,
        entitySlug: analytics?.entitySlug,
        entityType: analytics?.entityType,
        context: {
          form_id: formId,
          ...analytics?.context,
          error_type: "network_error",
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
          data-readdy-form
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
            <p className={`mt-4 text-[14px] font-medium ${status === "success" ? "text-primary-600" : "text-red-500"}`}>
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