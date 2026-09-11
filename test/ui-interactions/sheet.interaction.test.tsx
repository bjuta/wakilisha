// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { SearchableSelect } from "@/components/design-system/primitives/SearchableSelect";

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
