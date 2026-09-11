// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  MessagesOperationsShell,
  type MessagesOperationsWorkspace,
} from "@/pages/admin/messages/MessagesOperationsShell";
import { MessagesSystemActorsWorkspace } from "@/pages/admin/messages/MessagesSystemActorsWorkspace";
import type {
  MessagesControlCenterStatus,
  MessagesSystemActor,
} from "@/services/messages";

function Harness() {
  const [workspace, setWorkspace] =
    useState<MessagesOperationsWorkspace>("overview");

  return (
    <MessagesOperationsShell active={workspace} onChange={setWorkspace}>
      <div>Selected workspace: {workspace}</div>
    </MessagesOperationsShell>
  );
}

const status: MessagesControlCenterStatus = {
  audience_mode: "controlled",
  policy_revision: 1,
  active_conversations: 0,
  messages: 0,
  pending_requests: 0,
  spam_conversations: 0,
  active_human_participants: 0,
  registered_system_actors: 2,
  messages_enabled_system_actors: 2,
};

const mizizi: MessagesSystemActor = {
  actor_key: "mizizi",
  label: "MIZIZI",
  actor_kind: "system",
  actor_status: "active",
  messaging_enabled: true,
  permitted_purposes: ["registry_review"],
  recipient_scope: "assigned_people",
  allow_links: false,
  allow_resource_references: true,
  allow_human_reply: true,
  revision: 1,
  latest_message_at: null,
};

const archiveAgent: MessagesSystemActor = {
  actor_key: "archive_agent",
  label: "Archive Agent",
  actor_kind: "automation",
  actor_status: "active",
  messaging_enabled: true,
  permitted_purposes: ["archive_notice"],
  recipient_scope: "assigned_people",
  allow_links: false,
  allow_resource_references: true,
  allow_human_reply: false,
  revision: 1,
  latest_message_at: null,
};

describe("Messages Operations workspace tab interaction contract", () => {
  it("supports React Aria Arrow, Home, and End automatic activation", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const overview = screen.getByRole("tab", { name: "Overview" });
    const conversations = screen.getByRole("tab", {
      name: "Conversations",
    });
    const controls = screen.getByRole("tab", { name: "Controls" });

    await user.click(overview);
    expect(overview).toHaveFocus();

    await user.keyboard("{ArrowRight}");
    expect(conversations).toHaveFocus();
    expect(conversations).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{End}");
    expect(controls).toHaveFocus();
    expect(controls).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{Home}");
    expect(overview).toHaveFocus();
    expect(overview).toHaveAttribute("aria-selected", "true");
  });

  it("sends the exact selected System Actor through the keyboard-operable Messages switch", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <MessagesSystemActorsWorkspace
        status={status}
        actors={[archiveAgent, mizizi]}
        changingActor={null}
        onToggle={onToggle}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^MIZIZI.*mizizi/i }),
    );

    const toggle = screen.getByRole("switch", {
      name: "Disable Messages for MIZIZI",
    });

    toggle.focus();
    expect(toggle).toHaveFocus();

    await user.keyboard(" ");

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(mizizi);
    expect(screen.getByText("Domain authority is unchanged")).toBeVisible();
  });

  it("locks the exact in-flight System Actor switch and restores it for retry", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const view = render(
      <MessagesSystemActorsWorkspace
        status={status}
        actors={[mizizi, archiveAgent]}
        changingActor="mizizi"
        onToggle={onToggle}
      />,
    );

    const busyToggle = screen.getByRole("switch", {
      name: "Disable Messages for MIZIZI",
    });
    expect(busyToggle).toBeDisabled();

    await user.click(busyToggle);
    expect(onToggle).not.toHaveBeenCalled();

    view.rerender(
      <MessagesSystemActorsWorkspace
        status={status}
        actors={[mizizi, archiveAgent]}
        changingActor={null}
        onToggle={onToggle}
      />,
    );

    const retryToggle = screen.getByRole("switch", {
      name: "Disable Messages for MIZIZI",
    });
    expect(retryToggle).toBeEnabled();

    await user.click(retryToggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(mizizi);
  });

  it("keeps the selected System Actor stable across refreshed authority state", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const view = render(
      <MessagesSystemActorsWorkspace
        status={status}
        actors={[archiveAgent, mizizi]}
        changingActor={null}
        onToggle={onToggle}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /^MIZIZI.*mizizi/i }),
    );
    expect(
      screen.getByRole("switch", { name: "Disable Messages for MIZIZI" }),
    ).toBeEnabled();

    const refreshedMizizi: MessagesSystemActor = {
      ...mizizi,
      messaging_enabled: false,
      revision: 2,
    };

    view.rerender(
      <MessagesSystemActorsWorkspace
        status={{ ...status, messages_enabled_system_actors: 1 }}
        actors={[archiveAgent, refreshedMizizi]}
        changingActor={null}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByText("Messages off")).toBeVisible();
    expect(
      screen.getByRole("switch", { name: "Enable Messages for MIZIZI" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("registry_review")).toBeVisible();
  });
});
