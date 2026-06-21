import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { briefingService } from "@/services/briefingService";
import { trackEvent } from "@/services/analytics";

type PageState =
  | { stage: "loading" }
  | { stage: "confirm"; token: string }
  | { stage: "unsubscribing" }
  | { stage: "done"; all: boolean; briefing?: string; message: string }
  | { stage: "error"; message: string }
  | { stage: "expired" };

export default function BriefingUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<PageState>(() => {
    if (!token) return { stage: "error", message: "No unsubscribe token found. Use the link from your briefing email." };
    return { stage: "confirm", token };
  });

  const handleUnsubscribe = async () => {
    if (state.stage !== "confirm") return;
    setState({ stage: "unsubscribing" });
    try {
      const data = await briefingService.unsubscribe(token);
      setState({ stage: "done", all: data.all ?? false, briefing: data.briefing, message: data.message });
      trackEvent("briefing_unsubscribe", {
        pageType: "briefing_unsubscribe",
        context: { all: data.all ?? false, briefing: data.briefing ?? null }
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      if (/expired/i.test(msg)) {
        setState({ stage: "expired" });
        trackEvent("briefing_unsubscribe_expired", { pageType: "briefing_unsubscribe" });
      } else {
        setState({ stage: "error", message: msg });
        trackEvent("briefing_unsubscribe_error", { pageType: "briefing_unsubscribe", context: { reason: msg } });
      }
    }
  };

  const handleResubscribe = () => {
    trackEvent("briefing_resubscribe_click", { pageType: "briefing_unsubscribe" });
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px]">
        {/* Confirm step */}
        {state.stage === "confirm" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-mail-unread-line text-[26px] text-[var(--wk-text-faint)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Unsubscribe?</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-8">
              You'll stop receiving WAKILISHA briefings. You can always subscribe again from the homepage.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleUnsubscribe}
                className="h-11 px-6 rounded-full bg-[var(--wk-danger)] text-white text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
              >
                Unsubscribe
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-1 h-11 px-6 rounded-full text-[13px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-left-line" /> No, keep me subscribed
              </Link>
            </div>
          </div>
        )}

        {/* Unsubscribing */}
        {state.stage === "unsubscribing" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-loader-4-line animate-spin text-[22px] text-[var(--wk-text-faint)]" />
            </div>
            <p className="text-[14px] text-[var(--wk-text-muted)]">Processing your request...</p>
          </div>
        )}

        {/* Done */}
        {state.stage === "done" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-check-line text-[26px] text-[var(--wk-text-faint)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You've been unsubscribed</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              {state.message}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleResubscribe}
                className="h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
              >
                Subscribe again
              </button>
              <Link
                to="/"
                className="inline-flex items-center gap-1 h-11 px-6 rounded-full text-[13px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-left-line" /> Back to WAKILISHA
              </Link>
            </div>
          </div>
        )}

        {/* Error */}
        {state.stage === "error" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-danger-soft)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-error-warning-line text-[26px] text-[var(--wk-danger)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Something went wrong</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">{state.message}</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </Link>
          </div>
        )}

        {/* Expired */}
        {state.stage === "expired" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-timer-line text-[26px] text-[var(--wk-text-faint)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Link expired</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              This unsubscribe link has expired. If you still wish to unsubscribe, use the link in a more recent briefing email.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </Link>
          </div>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-[var(--wk-text-faint)]">
          WAKILISHA · African Cultural Intelligence
        </p>
      </div>
    </main>
  );
}