import { useCallback, useEffect, useMemo, useState } from "react";
import type { InquiryDraft } from "./types";
import {
  LEARNING_GROUP_LABELS,
  type LearningEntry,
  type LearningGroup,
  fetchLearningTimeline,
} from "@/services/institute/howThisLearnedService";

// How This Learned. Institutional memory made visible: the trail from raw
// question through evidence and decisions, readable, not a raw audit log.

const GROUP_ORDER: Array<LearningGroup | "all"> = ["all", "question", "evidence", "assistant", "review", "other"];

export default function HowThisLearnedScreen({ draft }: { draft: InquiryDraft | null }) {
  const [entries, setEntries] = useState<LearningEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [group, setGroup] = useState<LearningGroup | "all">("all");

  const refresh = useCallback(async () => {
    if (!draft) return;
    try {
      setEntries(await fetchLearningTimeline(draft.id));
      setNotice(null);
    } catch {
      setNotice("The learning trail could not load. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }, [draft?.id]);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh]);

  const visible = useMemo(
    () => (group === "all" ? entries : entries.filter((entry) => entry.group === group)),
    [entries, group],
  );

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => counts.set(entry.group, (counts.get(entry.group) ?? 0) + 1));
    return counts;
  }, [entries]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-[1040px]">
        <section className="rounded-[22px] border border-wk-border bg-wk-surface p-8 text-center shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">How this learned</div>
          <h1 className="mt-2 text-[26px] font-black tracking-[-0.04em] text-wk-text">No inquiry selected</h1>
          <p className="mt-2 text-[14px] text-wk-text-muted">Pick an inquiry first to see how it has learned.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1040px] space-y-5">
      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-wk-brand">
          Inquiry {draft.code.replace("Inquiry ", "")} · How this learned
        </div>
        <h1 className="mt-3 text-[30px] font-black leading-[1.05] tracking-[-0.06em] text-wk-text lg:text-[34px]">
          The trail from question to understanding
        </h1>
        <p className="mt-2 max-w-[70ch] text-[14px] leading-6 text-wk-text-muted">
          Every refinement, reading, and decision on this inquiry, in order. Corrections belong here too; changing
          our minds on the record is the method working.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {GROUP_ORDER.map((key) => {
            const count = key === "all" ? entries.length : groupCounts.get(key) ?? 0;
            if (key !== "all" && count === 0) return null;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setGroup(key)}
                className={`rounded-full px-4 py-2 text-[12px] font-bold ${
                  group === key
                    ? "bg-wk-brand text-wk-brand-on"
                    : "border border-wk-border bg-wk-bg text-wk-text-muted hover:text-wk-text"
                }`}
              >
                {key === "all" ? "Everything" : LEARNING_GROUP_LABELS[key]} ({count})
              </button>
            );
          })}
        </div>

        {notice && (
          <div className="mt-4 rounded-xl border border-wk-border bg-wk-bg px-4 py-3 text-[13px] text-wk-text">{notice}</div>
        )}
      </section>

      <section className="rounded-[22px] border border-wk-border bg-wk-surface p-6 shadow-sm lg:p-7">
        {loading ? (
          <p className="text-[13px] text-wk-text-muted">Loading the learning trail...</p>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-wk-border bg-wk-bg px-5 py-10 text-center">
            <p className="text-[15px] font-bold text-wk-text">Nothing on the record yet</p>
            <p className="mt-1 text-[13px] text-wk-text-muted">
              Refine the question, read some evidence, or decide a suggestion. The trail writes itself.
            </p>
          </div>
        ) : (
          <ol className="relative space-y-4 border-l border-wk-border pl-5">
            {visible.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full bg-wk-brand" />
                <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-wk-text-faint">
                  <span className="text-wk-brand">{LEARNING_GROUP_LABELS[entry.group]}</span>
                  <span>{new Date(entry.at).toLocaleString()}</span>
                </div>
                <h3 className="mt-1 text-[15px] font-black leading-snug text-wk-text">{entry.title}</h3>
                {entry.body && <p className="mt-1 text-[13px] leading-6 text-wk-text-muted">{entry.body}</p>}
                {entry.detail && (
                  <p className="mt-1 text-[12px] text-wk-text-faint">
                    <span className="font-bold">Why:</span> {entry.detail}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
