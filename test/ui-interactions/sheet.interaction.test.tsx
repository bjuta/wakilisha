// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { SearchableSelect } from "@/components/design-system/primitives/SearchableSelect";
import {
  WakilishaDialogProvider,
  wakilishaDialog,
} from "@/components/design-system/primitives/DialogProvider";
import { WkDisclosure } from "@/components/design-system/primitives/Disclosure";

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
});

function Harness() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open sheet
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Interaction sheet"
        side="right"
      >
        <SearchableSelect
          ariaLabel="Nested picker"
          searchPlaceholder="Find nested option"
          options={[
            { value: "alpha", label: "Alpha" },
            { value: "beta", label: "Beta" },
          ]}
          value="alpha"
          onChange={() => {}}
        />
        <button type="button">Last sheet action</button>
      </Sheet>
    </>
  );
}

function GovernedDialogHarness() {
  const [result, setResult] = useState("idle");

  return (
    <WakilishaDialogProvider>
      <button
        type="button"
        onClick={() => {
          void wakilishaDialog.confirm({
            title: "Archive item",
            message: "Archive this item?",
            confirmLabel: "Archive",
            destructive: true,
          }).then((confirmed) => setResult(confirmed ? "confirmed" : "cancelled"));
        }}
      >
        Open confirm
      </button>
      <button
        type="button"
        onClick={() => {
          void wakilishaDialog.prompt({
            title: "Add reason",
            label: "Reason",
            initialValue: "Initial",
            required: true,
          }).then((value) => setResult(value ?? "cancelled"));
        }}
      >
        Open prompt
      </button>
      <output aria-label="Dialog result">{result}</output>
    </WakilishaDialogProvider>
  );
}

describe("WAKILISHA Sheet interaction contract", () => {
  it("closes the nested picker before the sheet and restores invoker focus", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole("button", { name: "Open sheet" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", {
      name: "Interaction sheet",
    });
    const picker = screen.getByRole("combobox", {
      name: "Nested picker",
    });

    await user.click(picker);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Interaction sheet" }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("keeps repeated Tab and Shift+Tab focus inside the open sheet", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Open sheet" }));
    const dialog = screen.getByRole("dialog", {
      name: "Interaction sheet",
    });

    for (let index = 0; index < 12; index += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    for (let index = 0; index < 12; index += 1) {
      await user.tab({ shift: true });
      expect(dialog.contains(document.activeElement)).toBe(true);
    }
  });
});

describe("WAKILISHA governed dialog interaction contract", () => {
  it("resolves confirmation, traps focus, and restores the invoker", async () => {
    const user = userEvent.setup();
    render(<GovernedDialogHarness />);

    const opener = screen.getByRole("button", { name: "Open confirm" });
    await user.click(opener);

    const dialog = screen.getByRole("dialog", { name: "Archive item" });
    expect(dialog).toBeInTheDocument();

    for (let index = 0; index < 8; index += 1) {
      await user.tab();
      expect(dialog.contains(document.activeElement)).toBe(true);
    }

    await user.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() => expect(screen.getByLabelText("Dialog result")).toHaveTextContent("confirmed"));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it("preserves prompt initial value and resolves edited text", async () => {
    const user = userEvent.setup();
    render(<GovernedDialogHarness />);

    await user.click(screen.getByRole("button", { name: "Open prompt" }));
    const field = screen.getByRole("textbox", { name: "Reason" });
    expect(field).toHaveValue("Initial");

    await user.clear(field);
    await user.type(field, "Editorial correction");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(screen.getByLabelText("Dialog result")).toHaveTextContent("Editorial correction"),
    );
  });
});

describe("WAKILISHA disclosure interaction contract", () => {
  it("preserves keyboard semantics, screen-reader state, and nested state while collapsed", async () => {
    const user = userEvent.setup();
    render(
      <WkDisclosure summary="Publication record">
        <div>
          <p>Recorded source</p>
          <input data-testid="disclosure-note" aria-label="Retained note" />
        </div>
      </WkDisclosure>,
    );

    const trigger = screen.getByRole("button", { name: "Publication record" });
    const content = screen.getByText("Recorded source").closest("[role='region']");
    const note = screen.getByTestId("disclosure-note");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(content).not.toBeVisible();

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(content).toBeVisible();

    await user.type(note, "Retained state");
    expect(note).toHaveValue("Retained state");

    trigger.focus();
    await user.keyboard(" ");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(content).not.toBeVisible();
    expect(note).toHaveValue("Retained state");

    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(content).toBeVisible();
    expect(note).toHaveValue("Retained state");
  });
});
