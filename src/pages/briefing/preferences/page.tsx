import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { briefingService, type PreferencesResult } from "@/services/briefingService";
import { trackEvent } from "@/services/analytics";

type PageState =
  | { stage: "loading" }
  | { stage: "error"; message: string }
  | { stage: "expired" }
  | { stage: "ready"; data: PreferencesResult; saving: boolean };

export default function BriefingPreferencesPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [state, setState] = useState<PageState>({ stage: "loading" });
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!token) {
      setState({ stage: "error", message: "No preferences token found. Use the link from your briefing email." });
      return;
    }
    let cancelled = false;
    briefingService.preferences(token).then((data) => {
      if (cancelled) return;
      const subscribed = new Set(data.briefings.filter((b) => b.subscribed).map((b) => b.slug));
      setToggled(subscribed);
      setState({ stage: "ready", data, saving: false });
      trackEvent("briefing_preferences_view", {
        pageType: "briefing_preferences",
        context: { email: data.email, briefing_count: data.briefings.length, subscribed_count: subscribed.size }
      });
    }).catch((err: Error) => {
      if (cancelled) return;
      const msg = err.message;
      if (/expired/i.test(msg)) setState({ stage: "expired" });
      else setState({ stage: "error", message: msg });
    });
    return () => { cancelled = true; };
  }, [token]);

  const toggle = (slug: string) => {
    setToggled((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const handleSave = async () => {
    if (state.stage !== "ready") return;
    const email = state.data.email;
    const slugs = Array.from(toggled);
    if (slugs.length === 0) {
      setSaveError("Select at least one briefing to stay subscribed.");
      return;
    }
    setState({ ...state, saving: true });
    setSaveError("");
    try {
      await briefingService.subscribe(email, slugs, window.location.origin);
      setSaved(true);
      trackEvent("briefing_preferences_save", {
        pageType: "briefing_preferences",
        context: { email, briefing_count: slugs.length, briefings: slugs }
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Could not save preferences. Try again.");
      setState((s) => (s.stage === "ready" ? { ...s, saving: false } : s));
    }
  };

  const handleUnsubscribeAll = async () => {
    if (state.stage !== "ready") return;
    setState({ ...state, saving: true });
    try {
      await briefingService.unsubscribe(token, undefined, undefined, true);
      trackEvent("briefing_preferences_unsubscribe_all", {
        pageType: "briefing_preferences",
        context: { email: state.stage === "ready" ? state.data.email : "" }
      });
      window.location.href = `/briefing/unsubscribe?token=${token}`;
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
      setState((s) => (s.stage === "ready" ? { ...s, saving: false } : s));
    }
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[520px]">
        {/* Loading */}
        {state.stage === "loading" && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--wk-bg-subtle)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-loader-4-line animate-spin text-[22px] text-[var(--wk-text-faint)]" />
            </div>
            <p className="text-[14px] text-[var(--wk-text-muted)]">Loading your preferences...</p>
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
              This preferences link has expired. Subscribe again to receive a fresh link in your confirmation email.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[13px] font-extrabold hover:-translate-y-0.5 transition-transform whitespace-nowrap cursor-pointer"
            >
              <i className="ri-arrow-left-line" /> Back to WAKILISHA
            </Link>
          </div>
        )}

        {/* Preferences form */}
        {state.stage === "ready" && !saved && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] overflow-hidden">
            {/* Header */}
            <div className="px-6 lg:px-8 pt-8 pb-4">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-6 h-px bg-[var(--wk-brand)]" />
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">Manage preferences</span>
              </div>
              <h1 className="text-[24px] font-black tracking-[-0.035em] text-[var(--wk-text)] mb-2">Your briefings</h1>
              <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                Choose which WAKILISHA briefings you want to receive as <strong className="text-[var(--wk-text-soft)]">{state.data.email}</strong>.
              </p>
            </div>

            {/* Briefing list */}
            <div className="px-2 lg:px-4 pb-2 max-h-[420px] overflow-y-auto">
              {state.data.briefings.map((b) => {
                const isOn = toggled.has(b.slug);
                const cadenceLabel =
                  b.cadence === "weekly" ? "Weekly" :
                  b.cadence === "biweekly" ? "Biweekly" :
                  b.cadence === "monthly" ? "Monthly" : "On demand";
                const sendDay = b.send_day ? ` · ${b.send_day}` : "";

                return (
                  <button
                    key={b.slug}
                    type="button"
                    onClick={() => toggle(b.slug)}
                    disabled={state.saving}
                    className="w-full flex items-start gap-4 px-4 py-4 rounded-xl text-left cursor-pointer hover:bg-[var(--wk-bg-subtle)] transition-colors disabled:opacity-50 group"
                  >
                    <div className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded border-2 transition-all ${isOn ? "border-[var(--wk-brand)] bg-[var(--wk-brand)]" : "border-[var(--wk-border-strong)] group-hover:border-[var(--wk-text-faint)]"}`}>
                      {isOn && <i className="ri-check-line text-[10px] font-bold text-[var(--wk-brand-on)]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[14px] font-bold leading-snug transition-colors ${isOn ? "text-[var(--wk-text)]" : "text-[var(--wk-text-muted)]"}`}>
                        {b.title}
                      </p>
                      <p className="text-[12px] text-[var(--wk-text-faint)] mt-0.5">
                        {cadenceLabel}{sendDay}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="px-6 lg:px-8 py-5 border-t border-[var(--wk-divider)] space-y-3">
              {saveError && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--wk-danger)] bg-[var(--wk-danger-soft)] rounded-xl px-4 py-3">
                  <i className="ri-error-warning-line shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSave}
                disabled={state.saving || toggled.size === 0}
                className="w-full h-12 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-[14px] font-extrabold hover:-translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap cursor-pointer"
              >
                {state.saving ? "Saving..." : "Save preferences"}
              </button>

              <button
                type="button"
                onClick={handleUnsubscribeAll}
                disabled={state.saving}
                className="w-full h-10 rounded-full text-[13px] font-semibold text-[var(--wk-text-muted)] hover:text-[var(--wk-danger)] hover:bg-[var(--wk-danger-soft)] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                Unsubscribe from all briefings
              </button>
            </div>
          </div>
        )}

        {/* Saved */}
        {state.stage === "ready" && saved && (
          <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--wk-brand)] flex items-center justify-center mx-auto mb-5">
              <i className="ri-check-line text-[28px] font-bold text-[var(--wk-brand-on)]" />
            </div>
            <h2 className="text-[22px] font-black tracking-[-0.03em] text-[var(--wk-text)] mb-2">Preferences saved</h2>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-muted)] max-w-[360px] mx-auto mb-6">
              You're now subscribed to {toggled.size} briefing{toggled.size > 1 ? "s" : ""}. You can update these anytime from the link in any briefing email.
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