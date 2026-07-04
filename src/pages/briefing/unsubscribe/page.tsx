import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { briefingService } from "@/services/briefingService";
import { trackEvent } from "@/services/analytics";

type PageState =
  | { stage: "loading" }
  | { stage: "no_token" }
  | { stage: "confirm"; token: string }
  | { stage: "unsubscribing" }
  | { stage: "done"; all: boolean; briefing?: string; message: string }
  | { stage: "error"; message: string }
  | { stage: "expired" }
  | { stage: "manual_unsubscribing" }
  | { stage: "manual_done"; message: string }
  | { stage: "manual_error"; message: string };

export default function BriefingUnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<PageState>(() => {
    if (!token) return { stage: "no_token" };
    return { stage: "confirm", token };
  });
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

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
      const rawMessage = err instanceof Error ? err.message : "";
      if (/expired/i.test(rawMessage)) {
        setState({ stage: "expired" });
        trackEvent("briefing_unsubscribe_expired", { pageType: "briefing_unsubscribe" });
      } else {
        const msg = "We couldn't unsubscribe you. Try again in a moment.";
        setState({ stage: "error", message: msg });
        trackEvent("briefing_unsubscribe_error", { pageType: "briefing_unsubscribe", context: { reason: rawMessage || msg } });
      }
    }
  };

  const handleManualUnsubscribe = async () => {
    setEmailError("");
    if (!email.trim()) {
      setEmailError("Please enter your email address.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setState({ stage: "manual_unsubscribing" });
    try {
      const { error } = await supabase
        .from("briefing_opt_ins")
        .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
        .eq("email", email.trim().toLowerCase())
        .neq("status", "unsubscribed");
      if (error) throw error;
      setState({ stage: "manual_done", message: "You have been unsubscribed from all WAKILISHA briefings." });
      trackEvent("briefing_manual_unsubscribe", { pageType: "briefing_unsubscribe", context: { email_domain: email.trim().split("@")[1] } });
    } catch (err: unknown) {
      const msg = "Could not process your request.";
      setState({ stage: "manual_error", message: msg });
      trackEvent("briefing_manual_unsubscribe_error", { pageType: "briefing_unsubscribe", context: { reason: msg } });
    }
  };

  const handleResubscribe = () => {
    trackEvent("briefing_resubscribe_click", { pageType: "briefing_unsubscribe" });
    window.location.href = "/";
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px]">
        {/* No token — friendly fallback */}
        {state.stage === "no_token" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-mail-line text-[26px] text-[var(--wk-text-faint)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Unsubscribe from briefings</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              It looks like you arrived here without an unsubscribe link. Enter the email address that receives briefings, and we’ll unsubscribe it.
            </p>
            <div className="flex flex-col gap-3 max-w-[320px] mx-auto">
              <div className="flex flex-col gap-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  onKeyDown={(e) => { if (e.key === "Enter") handleManualUnsubscribe(); }}
                  placeholder="your@email.com"
                  className="h-11 w-full rounded-full border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[13px] text-[var(--wk-text)] placeholder:text-[var(--wk-text-faint)] outline-none focus:border-[var(--wk-brand)] transition-colors"
                />
                {emailError && (
                  <p className="text-[11px] text-[var(--wk-danger)] text-left pl-1">{emailError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleManualUnsubscribe}
                className="h-11 w-full rounded-full bg-[var(--wk-danger)] text-white text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
              >
                Unsubscribe me
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-1 h-11 px-6 rounded-full text-[13px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-arrow-left-line" /> Back to WAKILISHA
              </Link>
            </div>
          </div>
        )}

        {/* Confirm step */}
        {state.stage === "confirm" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-mail-unread-line text-[26px] text-[var(--wk-text-faint)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Unsubscribe?</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-8">
              You’ll stop receiving WAKILISHA briefings. You can subscribe again from the homepage anytime.
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

        {/* Manual unsubscribing */}
        {state.stage === "manual_unsubscribing" && (
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
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You’ve been unsubscribed</h2>
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

        {/* Manual done */}
        {state.stage === "manual_done" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-check-line text-[26px] text-[var(--wk-text-faint)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">You’ve been unsubscribed</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              {state.message}
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </Link>
          </div>
        )}

        {/* Error */}
        {state.stage === "error" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-danger-soft)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-error-warning-line text-[26px] text-[var(--wk-danger)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">We couldn't do that</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">{state.message}</p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </Link>
          </div>
        )}

        {/* Manual error */}
        {state.stage === "manual_error" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-danger-soft)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-error-warning-line text-[26px] text-[var(--wk-danger)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">We couldn't do that</h2>
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