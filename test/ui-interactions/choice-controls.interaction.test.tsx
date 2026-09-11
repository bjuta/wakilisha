// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { WkRadio, WkRadioGroup } from "@/components/design-system/primitives/Radio";
import { WkSelect } from "@/components/design-system/primitives/Select";

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("WAKILISHA choice-control interaction contract", () => {
  it("selects a finite option without native select chrome and respects disabled options", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("alpha");
      return (
        <WkSelect
          ariaLabel="Finite policy"
          options={[
            { value: "alpha", label: "Alpha" },
            { value: "beta", label: "Beta" },
            { value: "gamma", label: "Gamma", disabled: true },
          ]}
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Finite policy" });
    expect(trigger).toHaveTextContent("Alpha");

    await user.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    const disabledOption = screen.getByRole("option", { name: "Gamma" });
    expect(disabledOption).toHaveAttribute("aria-disabled", "true");

    await user.click(screen.getByRole("option", { name: "Beta" }));

    await waitFor(() => expect(trigger).toHaveTextContent("Beta"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("preserves grouped option children and raw HTML form values", async () => {
    const user = userEvent.setup();

    render(
      <form data-testid="choice-form">
        <WkSelect
          ariaLabel="Grouped policy"
          name="policy"
          required
        >
          <option value="">Choose policy</option>
          <optgroup label="Governed">
            <option value="alpha">Alpha</option>
            <option value="beta">Beta</option>
          </optgroup>
        </WkSelect>
        <WkCheckbox name="consent" value="1" required>
          Consent
        </WkCheckbox>
      </form>,
    );

    const trigger = screen.getByRole("button", { name: "Grouped policy" });
    expect(trigger).toHaveTextContent("Choose policy");

    await user.click(trigger);
    await user.click(screen.getByRole("option", { name: "Beta" }));
    await waitFor(() => expect(trigger).toHaveTextContent("Beta"));

    await user.click(screen.getByRole("checkbox", { name: "Consent" }));

    const form = screen.getByTestId("choice-form") as HTMLFormElement;
    const data = new FormData(form);
    expect(data.get("policy")).toBe("beta");
    expect(data.get("consent")).toBe("1");
  });

  it("toggles a checkbox with Space and exposes indeterminate state", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <div>
          <WkCheckbox checked={checked} onChange={setChecked}>
            Include archived items
          </WkCheckbox>
          <WkCheckbox
            checked={false}
            indeterminate
            onChange={() => {}}
            ariaLabel="Partial table selection"
          />
        </div>
      );
    }

    render(<Harness />);

    const checkbox = screen.getByRole("checkbox", {
      name: "Include archived items",
    });
    await user.click(checkbox);
    await user.keyboard(" ");
    expect(checkbox).not.toBeChecked();

    expect(
      screen.getByRole("checkbox", { name: "Partial table selection" }),
    ).toBePartiallyChecked();
  });

  it("moves radio selection with arrow keys inside one governed group", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("person");
      return (
        <WkRadioGroup
          ariaLabel="Credited party"
          value={value}
          onChange={setValue}
        >
          <WkRadio value="person">Person</WkRadio>
          <WkRadio value="organization">Organization</WkRadio>
        </WkRadioGroup>
      );
    }

    render(<Harness />);

    const person = screen.getByRole("radio", { name: "Person" });
    const organization = screen.getByRole("radio", { name: "Organization" });

    expect(person).toBeChecked();
    await user.click(person);
    await user.keyboard("{ArrowRight}");

    await waitFor(() => expect(organization).toBeChecked());
    expect(organization).toHaveFocus();
  });
});
