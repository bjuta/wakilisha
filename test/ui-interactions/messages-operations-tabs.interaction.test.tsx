// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  MessagesOperationsShell,
  type MessagesOperationsWorkspace,
} from "@/pages/admin/messages/MessagesOperationsShell";

function Harness() {
  const [workspace, setWorkspace] =
    useState<MessagesOperationsWorkspace>("overview");

  return (
    <MessagesOperationsShell active={workspace} onChange={setWorkspace}>
      <div>Selected workspace: {workspace}</div>
    </MessagesOperationsShell>
  );
}

describe("Messages Operations workspace tab interaction contract", () => {
  it("supports Arrow, Home, and End roving focus with activation", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const overview = screen.getByRole("tab", { name: "Overview" });
    const conversations = screen.getByRole("tab", {
      name: "Conversations",
    });
    const controls = screen.getByRole("tab", { name: "Controls" });

    overview.focus();
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
});
