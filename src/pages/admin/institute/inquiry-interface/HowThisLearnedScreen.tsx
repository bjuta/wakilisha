import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { InquiryDraft } from "./types";
import {
  type LearningEntry,
  type LearningGroup,
  fetchLearningTimeline,
} from "@/services/institute/howThisLearnedService";

type HistoryFilter = LearningGroup | "all";

const FILTER_ORDER: HistoryFilter[] = [
  "all",
  "question",
  "evidence",
  "relationships",
  "review",
  "assistant",
  "other",
];

const FILTER_LABELS: Record<HistoryFilter, string> = {
  all: "Everything",
  question: "Question",
  evidence: "Material",
  relationships: "Relationships",
  review: "Review",
  assistant: "Suggestions",
  other: "Other",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "brand" | "success" | "warning" | "neutral";
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black",
        tone === "brand" &&
          "border-wk-brand/30 bg-wk-brand-soft text-wk-brand",
        tone === "success" &&
          "border-wk-success/30 bg-wk-success-soft text-wk-success",
        tone === "warning" &&
          "border-wk-warning/30 bg-wk-warning-soft text-wk-warning",
        tone === "neutral" &&
          "border-wk-border bg-wk-surface text-wk-text-muted",
      )}
    >
      {children}
    </span>
  );
}

function historyTone(
  entry: LearningEntry,
): "brand" | "success" | "warning" | "neutral" {
  const text = `${entry.title} ${entry.body}`.toLowerCase();

  if (
    text.includes("accepted") ||
    text.includes("approved") ||
    text.includes("published")
  ) {
    return "success";
  }

  if (
    text.includes("rejected") ||
    text.includes("withdrawn") ||
    text.includes("changes requested") ||
    text.includes("contradict")
  ) {
    return "warning";
  }

  if (entry.group === "question" || entry.group === "review") {
    return "brand";
  }

  return "neutral";
}

function cleanTitle(entry: LearningEntry) {
  const title = entry.title.trim();
  const lower = title.toLowerCase();

  if (lower === "the question arrived") {
    return "Inquiry started";
  }

  if (lower.startsWith("the question moved to v")) {
    return "Question updated";
  }

  if (lower.includes("evidence review")) {
    return "Material reviewed";
  }

  if (lower.includes("relationship accepted")) {
    return "Relationship accepted";
  }

  if (lower.includes("relationship status changed")) {
    return "Relationship updated";
  }

  if (lower.startsWith("a suggestion was accepted")) {
    return "Suggestion accepted";
  }

  if (lower.startsWith("a suggestion was edited and accepted")) {
    return "Suggestion edited and accepted";
  }

  if (lower.startsWith("a suggestion was rejected")) {
    return "Suggestion rejected";
  }

  if (lower.startsWith("a suggestion was kept as doubt")) {
    return "Suggestion kept as doubt";
  }

  if (lower.startsWith("review packet") && lower.includes("submitted")) {
    return "Work sent for review";
  }

  if (lower.startsWith("review packet") && lower.includes("changes requested")) {
    return "Changes requested";
  }

  if (
    lower.startsWith("review packet") &&
    (lower.includes("approved") || lower.includes("accepted"))
  ) {
    return "Work accepted";
  }

  return title
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entryDescription(entry: LearningEntry) {
  const body = entry.body.trim();
  const detail = entry.detail?.trim();

  if (body && detail && body !== detail) {
    return { body, detail };
  }

  return {
    body: body || detail || "",
    detail: null,
  };
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-wk-border bg-wk-bg p-6 text-center">
      <p className="text-[14px] font-black text-wk-text">{title}</p>
      <p className="mt-2 text-[12px] leading-5 text-wk-text-muted">{body}</p>
    </div>
  );
}

export default function HowThisLearnedScreen({
  draft,
}: {
  draft: InquiryDraft | null;
}) {
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<HistoryFilter>("all");

  const refresh = useCallback(async () => {
    if (!draft) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setEntries(await fetchLearningTimeline(draft.id));
      setNotice("");
    } catch {
      setNotice("History could not be loaded. Try again later.");
    } finally {
      setLoading(false);
    }
  }, [draft?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleEntries = useMemo(
    () =>
      filter === "all"
        ? entries
        : entries.filter((entry) => entry.group === filter),
    [entries, filter],
  );

  const counts = useMemo(() => {
    const next = new Map<HistoryFilter, number>();
    next.set("all", entries.length);

    entries.forEach((entry) => {
      next.set(entry.group, (next.get(entry.group) ?? 0) + 1);
    });

    return next;
  }, [entries]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
            History
          </div>
          <h1 className="mt-3 text-[26px] font-black tracking-[-0.05em] text-wk-text">
            Choose an Inquiry
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-wk-text-muted">
            Return to Inquiries and choose the question whose history you want
            to read.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
          History
        </div>

        <h1 className="mt-3 text-[30px] font-black leading-[1.05] tracking-[-0.06em] text-wk-text lg:text-[36px]">
          The story of this Inquiry
        </h1>

        <p className="mt-3 max-w-[68ch] text-[14px] leading-6 text-wk-text-muted">
          See how the question changed, what was reviewed, which decisions were
          made, and when the work moved forward.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTER_ORDER.map((key) => {
            const count = counts.get(key) ?? 0;

            if (key !== "all" && count === 0) return null;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cx(
                  "rounded-full border px-4 py-2 text-[12px] font-black transition",
                  filter === key
                    ? "border-wk-brand bg-wk-brand text-wk-brand-on"
                    : "border-wk-border bg-wk-bg text-wk-text-muted hover:border-wk-brand/40 hover:text-wk-text",
                )}
              >
                {FILTER_LABELS[key]} ({count})
              </button>
            );
          })}
        </div>
      </section>

      {notice ? (
        <div className="rounded-xl border border-wk-warning/30 bg-wk-warning-soft px-4 py-3 text-[12px] font-bold text-wk-text-muted">
          {notice}
        </div>
      ) : null}

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-5 shadow-sm lg:p-6">
        {loading ? (
          <p className="text-[13px] text-wk-text-muted">Loading history...</p>
        ) : visibleEntries.length === 0 ? (
          <EmptyState
            title="Nothing has changed yet"
            body="Question updates, material decisions, review activity, and other important changes will appear here."
          />
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((entry) => {
              const description = entryDescription(entry);

              return (
                <article
                  key={entry.id}
                  className="rounded-xl border border-wk-border bg-wk-bg p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={historyTone(entry)}>
                        {FILTER_LABELS[entry.group]}
                      </Pill>

                      <span className="text-[11px] text-wk-text-faint">
                        {new Date(entry.at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <h2 className="mt-3 text-[16px] font-black leading-6 text-wk-text">
                    {cleanTitle(entry)}
                  </h2>

                  {description.body ? (
                    <p className="mt-2 text-[13px] leading-6 text-wk-text-muted">
                      {description.body}
                    </p>
                  ) : null}

                  {description.detail ? (
                    <div className="mt-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-2">
                      <div className="text-[10px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                        Reason or note
                      </div>
                      <p className="mt-1 text-[12px] leading-5 text-wk-text-muted">
                        {description.detail}
                      </p>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
