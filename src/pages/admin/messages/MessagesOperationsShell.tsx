import type { ReactNode } from "react";

export type MessagesOperationsWorkspace =
  | "overview"
  | "conversations"
  | "safety"
  | "legal"
  | "agents"
  | "system-actors"
  | "controls";

export const messagesOperationsWorkspaces: Array<{
  id: MessagesOperationsWorkspace;
  label: string;
  description: string;
}> = [
  {
    id: "overview",
    label: "Overview",
    description: "Operational health and queues that need attention.",
  },
  {
    id: "conversations",
    label: "Conversations",
    description: "Mailbox, routing, requests, spam, and delivery operations.",
  },
  {
    id: "safety",
    label: "Safety",
    description: "Safety cases, quarantine, enforcement, and recovery.",
  },
  {
    id: "legal",
    label: "Legal",
    description: "Governed preservation and exact disclosure casework.",
  },
  {
    id: "agents",
    label: "Agents",
    description: "Agent reviews, proposed updates, escalations, and accountability.",
  },
  {
    id: "system-actors",
    label: "System Actors",
    description: "Accountable machine actors and their Messages participation.",
  },
  {
    id: "controls",
    label: "Controls",
    description: "Audience, privacy boundary, and privileged runtime controls.",
  },
];

interface MessagesOperationsShellProps {
  active: MessagesOperationsWorkspace;
  onChange: (workspace: MessagesOperationsWorkspace) => void;
  children: ReactNode;
}

export function MessagesOperationsShell({
  active,
  onChange,
  children,
}: MessagesOperationsShellProps) {
  const current =
    messagesOperationsWorkspaces.find((workspace) => workspace.id === active) ??
    messagesOperationsWorkspaces[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-wk-border bg-wk-surface">
      <div className="border-b border-wk-divider bg-wk-bg-subtle/70 px-2 pt-2 sm:px-3">
        <nav
          aria-label="Messages Operations workspaces"
          className="overflow-x-auto"
        >
          <div
            role="tablist"
            aria-label="Messages Operations"
            className="flex min-w-max gap-1"
          >
            {messagesOperationsWorkspaces.map((workspace) => {
              const selected = workspace.id === active;
              return (
                <button
                  key={workspace.id}
                  id={`messages-workspace-tab-${workspace.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`messages-workspace-panel-${workspace.id}`}
                  onClick={() => onChange(workspace.id)}
                  className={`rounded-t-xl px-3.5 py-3 text-[11px] font-black transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-wk-brand/20 ${
                    selected
                      ? "bg-wk-surface text-wk-brand shadow-[0_-1px_0_var(--wk-border),1px_0_0_var(--wk-border),-1px_0_0_var(--wk-border)]"
                      : "text-wk-text-muted hover:bg-wk-surface-raised hover:text-wk-text"
                  }`}
                >
                  {workspace.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      <div className="border-b border-wk-divider px-5 py-4">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-wk-text-faint">
          Messages Operations
        </div>
        <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-[20px] font-black tracking-[-0.025em] text-wk-text">
            {current.label}
          </h2>
          <p className="max-w-[640px] text-[11px] leading-relaxed text-wk-text-muted sm:text-right">
            {current.description}
          </p>
        </div>
      </div>

      <section
        id={`messages-workspace-panel-${active}`}
        role="tabpanel"
        aria-labelledby={`messages-workspace-tab-${active}`}
        className="p-4 sm:p-5"
      >
        {children}
      </section>
    </div>
  );
}
