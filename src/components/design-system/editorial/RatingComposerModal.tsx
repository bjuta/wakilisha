import { useEffect, useState } from "react";
import { Modal } from "@/components/design-system/primitives/Modal";
import {
  canonicalRating, WK_STAR_PATH, type RatingAttrs,
  type RatingRole, type RatingDisplay, type RatingPart,
} from "./RatingNode";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: (value: RatingAttrs) => void;
  initial: RatingAttrs | null;
}

export function RatingComposerModal({ open, onClose, onApply, initial }: Props) {
  const [value, setValue] = useState(3.5);
  const [role, setRole] = useState<RatingRole>("inline");
  const [display, setDisplay] = useState<RatingDisplay>("both");
  const [label, setLabel] = useState("");
  const [subject, setSubject] = useState("");
  const [breakdown, setBreakdown] = useState<RatingPart[]>([]);

  useEffect(() => {
    if (!open) return;
    setValue(canonicalRating(initial?.value) ?? 3.5);
    setRole(initial?.role ?? "inline");
    setDisplay(initial?.display ?? "both");
    setLabel(initial?.label ?? "");
    setSubject(initial?.subject ?? "");
    setBreakdown(initial?.breakdown ?? []);
  }, [open, initial]);

  function changeValue(candidate: number) {
    setValue(Math.max(1, Math.min(5, Math.round(candidate * 2) / 2)));
  }
  function keyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      event.preventDefault(); changeValue(value + 0.5);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      event.preventDefault(); changeValue(value - 0.5);
    } else if (event.key === "Home") {
      event.preventDefault(); changeValue(1);
    } else if (event.key === "End") {
      event.preventDefault(); changeValue(5);
    } else if (/^[1-5]$/.test(event.key)) {
      event.preventDefault(); changeValue(Number(event.key));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial ? "Edit Rating" : "Insert Rating"}>
      <div className="space-y-5 p-1 text-[var(--wk-text)]">
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Score · 1.0–5.0</p>
          <div
            role="group"
            aria-label="Choose a rating from 1 to 5 in half-star steps"
            onKeyDown={keyDown}
            className="flex items-center gap-2"
          >
            {Array.from({ length: 5 }, (_, star) => (
              <div key={star} className="relative h-11 w-11 shrink-0 text-[var(--wk-text)]">
                <svg viewBox="0 0 24 24" className="absolute inset-0 h-11 w-11 opacity-20" aria-hidden="true">
                  <path d={WK_STAR_PATH} fill="currentColor" />
                </svg>
                <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: String(Math.max(0, Math.min(1, value - star)) * 100) + "%" }}>
                  <svg viewBox="0 0 24 24" className="h-11 w-11 max-w-none" aria-hidden="true">
                    <path d={WK_STAR_PATH} fill="currentColor" />
                  </svg>
                </span>
                <div className="absolute inset-0 flex">
                  {[0.5, 1].map((half) => {
                    const score = star + half;
                    return <button
                      key={half} type="button"
                      title={"Set rating to " + score.toFixed(1) + " out of 5"}
                      aria-label={"Set rating to " + score.toFixed(1) + " out of 5"}
                      aria-pressed={score === value}
                      onClick={() => changeValue(score)}
                      className="h-11 w-[22px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--wk-brand)]"
                    />;
                  })}
                </div>
              </div>
            ))}
            <output aria-live="polite" className="ml-auto whitespace-nowrap text-lg font-black tabular-nums">{value.toFixed(1)} / 5</output>
          </div>
        </div>
        <fieldset>
          <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Placement</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["inline", "block", "breakdown", "verdict"] as RatingRole[]).map((option) => (
              <button key={option} type="button" aria-pressed={role === option}
                onClick={() => setRole(option)}
                className={"min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold capitalize " +
                  (role === option ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)]" : "border-[var(--wk-border)]")}>
                {option}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-[var(--wk-text-muted)]">
            Inline stays in the sentence. Block sits between paragraphs. Breakdown scores parts. Verdict appears once at the end and can travel to cards.
          </p>
        </fieldset>
        <div>
          <label htmlFor="wk-rating-display" className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Display</label>
          <div className="flex flex-wrap gap-2" id="wk-rating-display">
            {(["both", "stars", "number"] as RatingDisplay[]).map((option) => (
              <button key={option} type="button" onClick={() => setDisplay(option)} aria-pressed={display === option}
                className={"min-h-11 rounded-full border px-4 text-xs font-bold capitalize " +
                  (display === option ? "border-[var(--wk-brand)]" : "border-[var(--wk-border)]")}>
                {option === "both" ? "Stars + number" : option}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="wk-rating-caption" className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Label · optional</label>
          <input id="wk-rating-caption" value={label} maxLength={160} onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Production or A confident closing track"
            className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-3 text-base outline-none focus:border-[var(--wk-brand)]" />
        </div>
        {(role === "verdict" || role === "breakdown") && (
          <div>
            <label htmlFor="wk-rating-subject" className="mb-2 block text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Work being reviewed</label>
            <input id="wk-rating-subject" value={subject} maxLength={160} onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g. Forever to Never by Charisma"
              className="w-full rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-3 py-3 text-base outline-none focus:border-[var(--wk-brand)]" />
            <p className="mt-1 text-xs text-[var(--wk-text-muted)]">Required before the verdict can be shared as structured review data.</p>
          </div>
        )}
        {role === "breakdown" && (
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">Scored parts</p>
            {breakdown.map((part, index) => (
              <div key={index} className="mb-2 grid grid-cols-[1fr_auto_auto] gap-2">
                <input aria-label={"Category " + (index + 1)} value={part.label}
                  onChange={(event) => setBreakdown((items) => items.map((item, i) => i === index ? {...item,label:event.target.value} : item))}
                  className="min-w-0 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)] px-2 text-base" />
                <div role="group" aria-label={"Score for " + part.label} className="flex items-center gap-1">
                  <button type="button" aria-label={"Decrease score for " + part.label}
                    disabled={part.value <= 1}
                    onClick={() => setBreakdown((items) => items.map((item, i) => i === index ? {...item,value:Math.max(1,item.value - 0.5)} : item))}
                    className="h-11 w-9 rounded-full border border-[var(--wk-border)] disabled:opacity-40">−</button>
                  <output className="w-8 text-center text-sm font-bold tabular-nums">{part.value.toFixed(1)}</output>
                  <button type="button" aria-label={"Increase score for " + part.label}
                    disabled={part.value >= 5}
                    onClick={() => setBreakdown((items) => items.map((item, i) => i === index ? {...item,value:Math.min(5,item.value + 0.5)} : item))}
                    className="h-11 w-9 rounded-full border border-[var(--wk-border)] disabled:opacity-40">+</button>
                </div>
                <button type="button" aria-label={"Remove " + part.label} onClick={() => setBreakdown((items) => items.filter((_, i) => i !== index))} className="min-h-11 px-2 text-sm">Remove</button>
              </div>
            ))}
            {breakdown.length < 8 && <button type="button" onClick={() => setBreakdown((items) => [...items, {label:"",value:3.5}])}
              className="min-h-11 rounded-full border border-[var(--wk-border)] px-4 text-sm font-bold">Add scored part</button>}
          </div>
        )}
        <div className="flex justify-end gap-2 border-t border-[var(--wk-border)] pt-4">
          <button type="button" onClick={onClose} className="min-h-11 rounded-full px-4 text-sm">Cancel</button>
          <button type="button"
            onClick={() => onApply({value,role,display,label:label.trim(),subject:subject.trim(),breakdown:role === "breakdown" ? breakdown : []})}
            className="min-h-11 rounded-full bg-[var(--wk-text)] px-5 font-bold text-[var(--wk-bg)]">
            {initial ? "Update Rating" : "Insert Rating"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
