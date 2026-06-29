import { InstituteSectionCard } from "./InstituteSectionCard";

function renderList(title: string, items: string[]) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-text-muted">{title}</div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[13px] leading-5 text-wk-text-soft">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InstituteUnderstandingPanel({
  currentUnderstanding,
  safeToSay = [],
  cannotSayYet = [],
  confidenceLabel,
}: {
  currentUnderstanding?: string | null;
  safeToSay?: string[];
  cannotSayYet?: string[];
  confidenceLabel?: string | null;
}) {
  return (
    <InstituteSectionCard
      eyebrow="Understanding"
      title="What do we currently believe?"
      description="Separate what can be said today from what still needs care."
    >
      <div className="rounded-2xl border border-wk-border bg-wk-bg p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em] text-wk-brand">Best answer today</div>
            <p className="mt-2 text-[14px] leading-6 text-wk-text-soft">
              {currentUnderstanding || "No current understanding has been written yet."}
            </p>
          </div>
          {confidenceLabel ? (
            <span className="rounded-full border border-wk-border px-3 py-1.5 text-[11px] font-bold text-wk-text-muted">{confidenceLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {renderList("What we can safely say", safeToSay)}
        {renderList("What we cannot say yet", cannotSayYet)}
      </div>
    </InstituteSectionCard>
  );
}
