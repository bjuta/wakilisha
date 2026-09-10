import { WkStateBadge } from "@/components/design-system/primitives/StateBadge";

const lanes = [
  {
    label: "Reviews & approvals",
    description: "Agent proposals that require an accountable human decision.",
  },
  {
    label: "Updates",
    description: "Accepted, returned, or superseded agent-originated changes.",
  },
  {
    label: "Escalations",
    description: "Cases where an agent explicitly hands authority back to a human.",
  },
  {
    label: "Failures",
    description: "Failed agent operations that require intervention or recovery.",
  },
];

export function MessagesAgentsWorkspace() {
  return (
    <div className="space-y-4">
      <section>
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Agent Reviews &amp; Updates
        </div>
        <h3 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-wk-text">
          Human accountability workspace
        </h3>
        <p className="mt-1 max-w-[780px] text-[11px] leading-relaxed text-wk-text-muted">
          Agent-originated work belongs in a dedicated operational queue, not
          inside System Actor identity management and not inside broad Messages counts.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {lanes.map((lane) => (
          <section
            key={lane.label}
            className="rounded-xl border border-wk-border bg-wk-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-[12px] font-black text-wk-text">
                {lane.label}
              </h4>
              <WkStateBadge>Bounded</WkStateBadge>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-wk-text-muted">
              {lane.description}
            </p>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-4">
        <div className="text-[10px] font-black text-wk-text">
          Read-authority boundary
        </div>
        <p className="mt-1 text-[10px] leading-relaxed text-wk-text-muted">
          There is not yet one accepted cross-domain read projection for every
          WAKILISHA agent review/update source. Gate B establishes the
          operational home without fabricating queue counts or querying private
          tables directly. Existing domain-specific review authorities remain canonical.
        </p>
      </section>
    </div>
  );
}
