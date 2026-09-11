import type { ReactNode } from "react";
import { WkTabs } from "@/components/design-system/primitives/Tabs";

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
    description:
      "Agent reviews, proposed updates, escalations, and accountability.",
  },
  {
    id: "system-actors",
    label: "System Actors",
    description:
      "Accountable machine actors and their Messages participation.",
  },
  {
    id: "controls",
    label: "Controls",
    description:
      "Audience, privacy boundary, and privileged runtime controls.",
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
    messagesOperationsWorkspaces.find(
      (workspace) => workspace.id === active,
    ) ?? messagesOperationsWorkspaces[0];

  return (
    <div className="overflow-hidden rounded-2xl border border-wk-border bg-wk-surface">
      <WkTabs
        items={messagesOperationsWorkspaces}
        value={active}
        onChange={onChange}
        ariaLabel="Messages Operations"
        tabListClassName="overflow-x-auto border-b border-wk-divider bg-wk-bg-subtle/70 px-2 pt-2 sm:px-3"
      >
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

        <div className="p-4 sm:p-5">{children}</div>
      </WkTabs>
    </div>
  );
}
