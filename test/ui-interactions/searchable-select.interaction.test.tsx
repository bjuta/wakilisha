// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/design-system/primitives/SearchableSelect";

const OPTIONS: SearchableSelectOption[] = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
  { value: "gamma", label: "Gamma" },
];

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("WAKILISHA SearchableSelect interaction contract", () => {
  it("moves active option with arrows, commits with Enter, and restores trigger focus", async () => {
    const user = userEvent.setup();
    let current = "alpha";

    function Harness() {
      return (
        <SearchableSelect
          ariaLabel="Gate E test picker"
          searchPlaceholder="Find option"
          options={OPTIONS}
          value={current}
          onChange={(next) => {
            current = next;
          }}
        />
      );
    }

    const { rerender } = render(<Harness />);
    const trigger = screen.getByRole("combobox", {
      name: "Gate E test picker",
    });

    await user.click(trigger);

    const input = screen.getByRole("textbox", { name: "Find option" });
    expect(input).toHaveFocus();

    await user.keyboard("{ArrowDown}");

    const activeId = input.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)).toHaveTextContent("Beta");

    await user.keyboard("{Enter}");
    expect(current).toBe("beta");

    rerender(<Harness />);

    await waitFor(() => expect(trigger).toHaveFocus());
    expect(trigger).toHaveTextContent("Beta");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape and restores focus to the WAKILISHA trigger", async () => {
    const user = userEvent.setup();

    render(
      <SearchableSelect
        ariaLabel="Policy"
        searchPlaceholder="Find policy"
        options={OPTIONS}
        value="alpha"
        onChange={() => {}}
      />,
    );

    const trigger = screen.getByRole("combobox", { name: "Policy" });
    await user.click(trigger);
    expect(screen.getByRole("textbox", { name: "Find policy" })).toHaveFocus();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
