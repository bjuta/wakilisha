import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { briefingService } from "@/services/briefingService";
import { trackEvent } from "@/services/analytics";

type PageState =
  | { stage: "loading" }
  | { stage: "error"; message: string }
  | { stage: "expired" }
  | { stage: "confirmed"; email: string }
  | { stage: "already_confirmed"; email: string };

export default function BriefingConfirmPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<PageState>({ stage: "loading" });

  useEffect(() => {
    if (!token) {
      setState({ stage: "error", message: "This link is missing something. Check your email for the confirmation link." });
      trackEvent("briefing_confirm_error", { pageType: "briefing_confirm", context: { reason: "missing_token" } });
      return;
    }
    let cancelled = false;
    briefingService.confirm(token).then((data) => {
      if (cancelled) return;
      if (data.email) {
        const isAlready = data.message?.includes("already");
        setState({ stage: isAlready ? "already_confirmed" : "confirmed", email: data.email });
        trackEvent(isAlready ? "briefing_confirm_already" : "briefing_confirm_success", {
          pageType: "briefing_confirm",
          context: { email: data.email }
        });
      } else {
        setState({ stage: "confirmed", email: "" });
        trackEvent("briefing_confirm_success", { pageType: "briefing_confirm" });
      }
    }).catch((err: Error) => {
      if (cancelled) return;
      const rawMessage = err.message || "";
      if (/expired/i.test(rawMessage)) {
        setState({ stage: "expired" });
        trackEvent("briefing_confirm_expired", { pageType: "briefing_confirm" });
      } else {
        const msg = "We couldn't confirm this. Try the link again.";
        setState({ stage: "error", message: msg });
        trackEvent("briefing_confirm_error", { pageType: "briefing_confirm", context: { reason: rawMessage || msg } });
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[480px]">
        {/* Loading */}
        {state.stage === "loading" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-loader-4-line animate-spin text-[22px] text-[var(--wk-text-faint)]" />
            </div>
            <p className="text-[14px] text-[var(--wk-text-muted)]">Verifying your subscription...</p>
          </div>
        )}

        {/* Error */}
        {state.stage === "error" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-danger-soft)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-error-warning-line text-[26px] text-[var(--wk-danger)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Couldn't confirm</h2>
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
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Confirmation link expired</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              This confirmation link has expired. Subscribe again to receive a fresh confirmation email. Links are valid for 7 days.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </Link>
          </div>
        )}

        {/* Confirmed — new subscriber */}
        {state.stage === "confirmed" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[var(--wk-brand)] to-[var(--wk-brand-2)] flex items-center justify-center mx-auto mb-6">
              <i className="ri-check-line text-[36px] font-bold text-[var(--wk-brand-on)]" />
              <style>{`.confetti{position:absolute;width:8px;height:8px;border-radius:2px;animation:confetti-fall 1.8s var(--wk-ease-out) forwards;opacity:0}@keyframes confetti-fall{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(60px) rotate(360deg);opacity:0}}`}</style>
            </div>
            <h2 className="text-[22px] lg:text-[26px] font-black tracking-[-0.035em] text-[var(--wk-text)] mb-2">You’re in</h2>
            {state.email && (
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-1">
                <strong>{state.email}</strong> is now confirmed.
              </p>
            )}
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-8">
              You’ll start receiving WAKILISHA briefings on their scheduled days. Look out for the first one in your inbox.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                to="/"
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
              >
                Explore WAKILISHA <i className="ri-arrow-right-line" />
              </Link>
              <Link
                to={`/briefing/preferences?token=${token}`}
                className="inline-flex items-center gap-1 h-11 px-6 rounded-full text-[13px] font-semibold text-[var(--wk-text-soft)] hover:text-[var(--wk-text)] transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-settings-3-line" /> Manage preferences
              </Link>
            </div>
          </div>
        )}

        {/* Already confirmed */}
        {state.stage === "already_confirmed" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-brand-soft)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-check-double-line text-[26px] text-[var(--wk-brand)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Already confirmed</h2>
            {state.email && (
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)] mb-1">
                <strong>{state.email}</strong> was already confirmed.
              </p>
            )}
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              Your briefings have been updated with your latest selections. You’re all set.
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