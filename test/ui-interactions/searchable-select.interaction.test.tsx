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
  it("moves active option with arrows, commits with Enter, and keeps focus", async () => {
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
    const combobox = screen.getByRole("combobox", {
      name: "Gate E test picker",
    });

    await user.click(combobox);
    expect(combobox).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      const activeId = combobox.getAttribute("aria-activedescendant");
      expect(activeId).toBeTruthy();
      const activeOption = document.getElementById(activeId!);
      expect(activeOption).toHaveTextContent("Alpha");
      expect(activeOption).toHaveAttribute("aria-selected", "true");
    });

    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      const activeId = combobox.getAttribute("aria-activedescendant");
      expect(activeId).toBeTruthy();
      const activeOption = document.getElementById(activeId!);
      expect(activeOption).toHaveTextContent("Beta");
      expect(activeOption).toHaveAttribute("aria-selected", "false");
    });

    await user.keyboard("{Enter}");
    expect(current).toBe("beta");

    rerender(<Harness />);

    await waitFor(() => expect(combobox).toHaveFocus());
    expect(combobox).toHaveValue("Beta");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape and keeps focus on the WAKILISHA combobox", async () => {
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

    const combobox = screen.getByRole("combobox", { name: "Policy" });
    await user.click(combobox);
    expect(combobox).toHaveFocus();
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await waitFor(() => expect(combobox).toHaveFocus());
  });
});
