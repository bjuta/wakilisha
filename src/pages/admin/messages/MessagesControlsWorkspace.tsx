import { WkStateBadge } from "@/components/design-system/primitives/StateBadge";
import type { MessagesControlCenterStatus } from "@/services/messages";

interface MessagesControlsWorkspaceProps {
  status: MessagesControlCenterStatus;
}

export function MessagesControlsWorkspace({
  status,
}: MessagesControlsWorkspaceProps) {
  return (
    <div className="space-y-4">
      <section>
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Runtime authority
        </div>
        <h3 className="mt-1 text-[17px] font-black tracking-[-0.02em] text-wk-text">
          Messages Controls
        </h3>
        <p className="mt-1 max-w-[780px] text-[11px] leading-relaxed text-wk-text-muted">
          Platform-wide authority lives here deliberately. Current state,
          effect, and revision are visible without turning control concepts into
          permanent Overview decoration.
        </p>
      </section>

      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rounded-xl border border-wk-border bg-wk-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Runtime Audience
              </div>
              <div className="mt-1 text-[17px] font-black capitalize text-wk-text">
                {status.audience_mode}
              </div>
            </div>
            <WkStateBadge tone="info">
              Revision {status.policy_revision}
            </WkStateBadge>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-wk-text-muted">
            Server-enforced audience mode defines the platform ceiling for
            Messages participation. User privacy can narrow delivery further
            but cannot widen this authority.
          </p>

          <div className="mt-4 rounded-lg bg-wk-bg-subtle px-3 py-3">
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
              Control status
            </div>
            <div className="mt-1 text-[10px] font-bold text-wk-text">
              Read authority is active. Gate B does not invent a new audience writer.
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-wk-border bg-wk-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
                Private Content Boundary
              </div>
              <div className="mt-1 text-[17px] font-black text-wk-text">
                Deliberate inspection only
              </div>
            </div>
            <WkStateBadge tone="success">Server enforced</WkStateBadge>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-wk-text-muted">
            Normal administrative views expose safe metadata only. Private
            Message bodies, restricted Media, and Legal evidence remain behind
            governed purpose-audited inspection.
          </p>

          <div className="mt-4 rounded-lg bg-wk-bg-subtle px-3 py-3">
            <div className="text-[9px] font-black uppercase tracking-[0.1em] text-wk-text-faint">
              Boundary effect
            </div>
            <div className="mt-1 text-[10px] font-bold text-wk-text">
              Super Admin access does not create ambient Conversation content access.
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-wk-border bg-wk-bg-subtle p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.12em] text-wk-text-faint">
              Super Administration
            </div>
            <h4 className="mt-1 text-[15px] font-black text-wk-text">
              Privileged tools require explicit authority
            </h4>
            <p className="mt-2 max-w-[760px] text-[11px] leading-relaxed text-wk-text-muted">
              Platform-wide destructive or authority-changing commands belong
              in this control area with stronger confirmation, impact context,
              human reason, and immutable audit. No new privileged mutation is
              created merely to fill the surface.
            </p>
          </div>
          <WkStateBadge>Governed only</WkStateBadge>
        </div>
      </section>
    </div>
  );
}
