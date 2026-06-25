import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { briefingService, type BriefingCatalogItem } from "@/services/briefingService";
import { trackEvent } from "@/services/analytics";

type LoadState = "loading" | "ready" | "error";
type SubmitState = "idle" | "submitting" | "success" | "error";

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function cadenceLabel(item: BriefingCatalogItem) {
  if (item.is_manual) return "Special drops";
  const cadence = item.cadence ? item.cadence.replace(/_/g, " ") : "Briefing";
  const pretty = cadence.charAt(0).toUpperCase() + cadence.slice(1);
  return item.send_day ? `${pretty} / ${item.send_day}` : pretty;
}

function briefingAccent(item: BriefingCatalogItem) {
  const accent = item.visual_config?.accent_color;
  return typeof accent === "string" && accent.trim() ? accent.trim() : "#5C8E25";
}

function sortCatalog(items: BriefingCatalogItem[]) {
  return [...items].sort((a, b) => {
    const order = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (order !== 0) return order;
    return a.title.localeCompare(b.title);
  });
}

export default function PublicBriefingsPage() {
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = useState<BriefingCatalogItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      setLoadState("loading");
      setMessage("");

      try {
        const items = sortCatalog(await briefingService.listCatalog());
        if (cancelled) return;

        const active = items.filter((item) => item.is_active);
        const requested = (searchParams.get("briefings") || searchParams.get("briefing") || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

        const requestedSet = new Set(requested);
        const initial = requestedSet.size > 0
          ? active.filter((item) => requestedSet.has(item.slug)).map((item) => item.slug)
          : active.map((item) => item.slug);

        setCatalog(items);
        setSelected(new Set(initial));
        setLoadState("ready");

        trackEvent("briefings_public_catalog_view", {
          pageType: "briefings",
          context: {
            active_briefing_count: active.length,
            requested_briefings: requested,
            default_selected_count: initial.length,
          },
        });
      } catch (error) {
        if (cancelled) return;
        setLoadState("error");
        setMessage(error instanceof Error ? error.message : "Could not load briefings.");
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const activeCatalog = useMemo(
    () => catalog.filter((item) => item.is_active),
    [catalog],
  );

  const selectedCount = selected.size;
  const allSelected = activeCatalog.length > 0 && selectedCount === activeCatalog.length;

  const toggleBriefing = (slug: string) => {
    setSubmitState("idle");
    setMessage("");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const selectAll = () => {
    setSubmitState("idle");
    setMessage("");
    setSelected(new Set(activeCatalog.map((item) => item.slug)));
  };

  const clearAll = () => {
    setSubmitState("idle");
    setMessage("");
    setSelected(new Set());
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = cleanEmail(email);
    const briefingSlugs = Array.from(selected);

    if (!isValidEmail(normalizedEmail)) {
      setSubmitState("error");
      setMessage("Enter a valid email address.");
      return;
    }

    if (!consent) {
      setSubmitState("error");
      setMessage("Confirm that you want to receive WAKILISHA briefings.");
      return;
    }

    if (briefingSlugs.length === 0) {
      setSubmitState("error");
      setMessage("Choose at least one briefing.");
      return;
    }

    setSubmitState("submitting");
    setMessage("");

    trackEvent("briefings_public_subscribe_submit", {
      pageType: "briefings",
      context: {
        briefing_count: briefingSlugs.length,
        briefings: briefingSlugs,
        subscribed_to_all: briefingSlugs.length === activeCatalog.length,
      },
    });

    try {
      const result = await briefingService.subscribe(
        normalizedEmail,
        briefingSlugs,
        window.location.origin,
        {
          source_form: "public_briefings_hub",
          page_url: window.location.href,
          page_type: "briefings",
        },
      );

      setSubmitState("success");
      setMessage(
        result.status === "already_confirmed"
          ? "You are already confirmed. Your briefing preferences have been updated."
          : "You are in. Check your inbox to confirm your briefing subscriptions.",
      );

      trackEvent("briefings_public_subscribe_success", {
        pageType: "briefings",
        context: {
          briefing_count: briefingSlugs.length,
          briefings: briefingSlugs,
          subscribed_to_all: briefingSlugs.length === activeCatalog.length,
          result_status: result.status,
        },
      });
    } catch (error) {
      setSubmitState("error");
      setMessage(error instanceof Error ? error.message : "Could not subscribe. Try again.");

      trackEvent("briefings_public_subscribe_error", {
        pageType: "briefings",
        context: {
          briefing_count: briefingSlugs.length,
          briefings: briefingSlugs,
          error: error instanceof Error ? error.message : "unknown_error",
        },
      });
    }
  };

  return (
    <main className="min-h-screen bg-[var(--wk-bg)]">
      <section className="relative overflow-hidden border-b border-[var(--wk-divider)] bg-[var(--wk-bg-subtle)]">
        <div className="pointer-events-none absolute -right-32 top-0 h-80 w-80 rounded-full bg-[var(--wk-brand)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-[var(--wk-brand-2)]/10 blur-3xl" />

        <div className="relative mx-auto max-w-[1180px] px-5 py-20 md:px-8 md:py-28">
          <div className="max-w-3xl">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-8 bg-[var(--wk-brand)]" />
              <span className="text-[11px] font-black uppercase tracking-[0.22em] text-[var(--wk-brand)]">
                WAKILISHA briefings
              </span>
            </div>

            <h1 className="text-[clamp(44px,7vw,88px)] font-black leading-[0.9] tracking-[-0.06em] text-[var(--wk-text)]">
              Choose what lands in your inbox.
            </h1>

            <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[var(--wk-text-muted)] md:text-[18px]">
              Follow charts, artists, scenes, field guides, labels, language, memory, diaspora signals, and the wider culture dispatch from one clean subscription center.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 text-[12px] font-bold text-[var(--wk-text-muted)]">
              <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2">
                One email address
              </span>
              <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2">
                Pick individual briefings
              </span>
              <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2">
                Subscribe to all
              </span>
              <span className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2">
                Unsubscribe anytime
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-8 px-5 py-12 md:px-8 lg:grid-cols-[1fr_380px] lg:py-16">
        <div className="min-w-0">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                Available briefings
              </p>
              <h2 className="mt-2 text-[28px] font-black tracking-[-0.04em] text-[var(--wk-text)]">
                {loadState === "ready" ? `${activeCatalog.length} live briefing${activeCatalog.length === 1 ? "" : "s"}` : "Loading briefings"}
              </h2>
            </div>

            {loadState === "ready" && activeCatalog.length > 0 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={selectAll}
                  disabled={allSelected}
                  className="rounded-full border border-[var(--wk-border)] bg-[var(--wk-surface)] px-4 py-2 text-[12px] font-bold text-[var(--wk-text)] transition hover:border-[var(--wk-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={selectedCount === 0}
                  className="rounded-full border border-[var(--wk-border)] bg-transparent px-4 py-2 text-[12px] font-bold text-[var(--wk-text-muted)] transition hover:text-[var(--wk-text)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {loadState === "loading" && (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)]" />
              ))}
            </div>
          )}

          {loadState === "error" && (
            <div className="rounded-2xl border border-[var(--wk-danger)]/25 bg-[var(--wk-danger-soft)] p-6">
              <h3 className="text-[18px] font-black text-[var(--wk-text)]">Could not load the briefing catalog</h3>
              <p className="mt-2 text-[14px] text-[var(--wk-danger)]">{message}</p>
            </div>
          )}

          {loadState === "ready" && activeCatalog.length === 0 && (
            <div className="rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-8 text-center">
              <h3 className="text-[20px] font-black text-[var(--wk-text)]">No active briefings yet</h3>
              <p className="mt-2 text-[14px] text-[var(--wk-text-muted)]">
                Come back soon. We are still setting up the public briefing catalog.
              </p>
            </div>
          )}

          {loadState === "ready" && activeCatalog.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {activeCatalog.map((briefing) => {
                const isSelected = selected.has(briefing.slug);
                const accent = briefingAccent(briefing);

                return (
                  <button
                    key={briefing.slug}
                    type="button"
                    onClick={() => toggleBriefing(briefing.slug)}
                    className={`group flex min-h-[180px] flex-col rounded-2xl border bg-[var(--wk-surface)] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--wk-border-strong)] ${
                      isSelected ? "shadow-[0_18px_50px_rgba(12,13,10,0.08)]" : ""
                    }`}
                    style={{ borderColor: isSelected ? accent : undefined }}
                    aria-pressed={isSelected}
                  >
                    <div className="mb-5 flex items-start justify-between gap-4">
                      <span
                        className="inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {cadenceLabel(briefing)}
                      </span>

                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                          isSelected ? "text-white" : "border-[var(--wk-border-strong)] text-transparent group-hover:text-[var(--wk-text-faint)]"
                        }`}
                        style={{
                          backgroundColor: isSelected ? accent : "transparent",
                          borderColor: isSelected ? accent : undefined,
                        }}
                      >
                        <i className="ri-check-line text-[13px] font-black" />
                      </span>
                    </div>

                    <h3 className="text-[20px] font-black leading-tight tracking-[-0.035em] text-[var(--wk-text)]">
                      {briefing.title}
                    </h3>

                    <p className="mt-3 line-clamp-3 text-[14px] leading-relaxed text-[var(--wk-text-muted)]">
                      {briefing.description || "A WAKILISHA briefing for people following African creative life closely."}
                    </p>

                    <p className="mt-auto pt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--wk-text-faint)]">
                      {isSelected ? "Selected" : "Tap to select"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 shadow-[0_24px_70px_rgba(12,13,10,0.08)]"
          >
            <div className="mb-5">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[var(--wk-brand)]">
                Subscribe
              </p>
              <h2 className="mt-2 text-[28px] font-black leading-none tracking-[-0.04em] text-[var(--wk-text)]">
                {allSelected ? "All briefings selected" : `${selectedCount} selected`}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-[var(--wk-text-muted)]">
                Use one email to subscribe to every WAKILISHA briefing you care about. Confirmation keeps the list clean.
              </p>
            </div>

            <label className="block">
              <span className="mb-2 block text-[12px] font-bold text-[var(--wk-text-soft)]">
                Email address
              </span>
              <input
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (submitState !== "submitting") setSubmitState("idle");
                }}
                placeholder="you@example.com"
                required
                disabled={submitState === "submitting" || submitState === "success"}
                className="h-12 w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] px-4 text-[14px] text-[var(--wk-text)] outline-none transition focus:border-[var(--wk-brand)] disabled:opacity-50"
              />
            </label>

            <label className="mt-4 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => {
                  setConsent(event.target.checked);
                  if (submitState !== "submitting") setSubmitState("idle");
                }}
                disabled={submitState === "submitting" || submitState === "success"}
                className="mt-1 h-4 w-4 rounded border-[var(--wk-border)] accent-[var(--wk-brand)]"
                required
              />
              <span className="text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
                I want to receive the selected WAKILISHA briefings. I can unsubscribe or update preferences from any briefing email.
              </span>
            </label>

            {message && (
              <div
                className={`mt-5 rounded-xl p-4 text-[13px] leading-relaxed ${
                  submitState === "success"
                    ? "bg-[var(--wk-success-soft)] text-[var(--wk-success)]"
                    : "bg-[var(--wk-danger-soft)] text-[var(--wk-danger)]"
                }`}
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={submitState === "submitting" || submitState === "success" || selectedCount === 0 || loadState !== "ready"}
              className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-[var(--wk-brand)] px-6 text-[14px] font-black text-[var(--wk-brand-on)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitState === "submitting" ? "Subscribing..." : submitState === "success" ? "Check your inbox" : "Subscribe to selected"}
            </button>

            <button
              type="button"
              onClick={selectAll}
              disabled={allSelected || loadState !== "ready" || submitState === "submitting"}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full border border-[var(--wk-border)] bg-transparent px-6 text-[13px] font-bold text-[var(--wk-text)] transition hover:border-[var(--wk-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Subscribe to all WAKILISHA briefings
            </button>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-[var(--wk-text-faint)]">
              Already subscribed? Use the preferences link inside any WAKILISHA briefing email.
            </p>
          </form>

          <div className="mt-5 rounded-2xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] p-5">
            <h3 className="text-[14px] font-black text-[var(--wk-text)]">Why this page exists</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--wk-text-muted)]">
              Instead of asking you ten times across the site, this is the clean home for every WAKILISHA email briefing and newsletter.
            </p>
            <Link
              to="/privacy"
              className="mt-3 inline-flex text-[12px] font-bold text-[var(--wk-brand)] hover:underline"
            >
              Read our privacy policy
            </Link>
          </div>
        </aside>
      </section>
    </main>
  );
}
