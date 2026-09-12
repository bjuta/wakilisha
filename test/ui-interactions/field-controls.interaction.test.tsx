// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WkNumberField } from "@/components/design-system/primitives/NumberField";
import { WkSlider } from "@/components/design-system/primitives/Slider";
import {
  WkPasswordField,
  WkSearchField,
} from "@/components/design-system/primitives/Field";
import {
  WkDatePicker,
  WkTimePicker,
} from "@/components/design-system/primitives/DateTimePicker";

beforeAll(() => {
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

describe("WAKILISHA field-control interaction contract", () => {
  it("preserves numeric min, max, step, and keyboard behavior", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState(2);
      return (
        <WkNumberField
          ariaLabel="Confidence threshold"
          value={value}
          onChange={setValue}
          min={0}
          max={3}
          step={0.5}
        />
      );
    }

    render(<Harness />);

    const field = screen.getByRole("spinbutton", {
      name: "Confidence threshold",
    });
    await user.click(field);
    await user.keyboard("{ArrowUp}");
    await waitFor(() => expect(field).toHaveValue("2.5"));

    await user.click(
      screen.getByRole("button", { name: "Increase Confidence threshold" }),
    );
    expect(field).toHaveValue("3");
  });

  it("moves a governed slider with keyboard step semantics", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState(20);
      return (
        <WkSlider
          ariaLabel="Playback volume"
          value={value}
          onChange={setValue}
          min={0}
          max={100}
          step={10}
        />
      );
    }

    render(<Harness />);
    const slider = screen.getByRole("slider", { name: "Playback volume" });
    await user.click(slider);
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "30"));
  });

  it("keeps password semantics while WAKILISHA owns reveal interaction", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("secret");
      return (
        <WkPasswordField
          ariaLabel="Account password"
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);
    const field = screen.getByLabelText("Account password");
    expect(field).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(field).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toBeVisible();
  });

  it("provides search semantics without native search chrome", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("nairobi");
      return (
        <WkSearchField
          ariaLabel="Find artist"
          value={value}
          onChange={setValue}
        />
      );
    }

    render(<Harness />);
    const field = screen.getByRole("searchbox", { name: "Find artist" });
    expect(field).toHaveValue("nairobi");

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(field).toHaveValue("");
  });

  it("preserves ISO date and time value contracts through governed pickers", async () => {
    const user = userEvent.setup();
    const dateChange = vi.fn();
    const timeChange = vi.fn();

    render(
      <div>
        <WkDatePicker
          label="Publication date"
          value="2026-09-12"
          onChange={dateChange}
        />
        <WkTimePicker
          label="Briefing time"
          value="08:30"
          onChange={timeChange}
        />
      </div>,
    );

    await user.click(
      screen.getByRole("button", { name: /Publication date/i }),
    );
    await user.click(screen.getByRole("button", { name: "Use date" }));
    expect(dateChange).toHaveBeenCalledWith("2026-09-12");

    await user.click(
      screen.getByRole("button", { name: /Briefing time/i }),
    );
    await user.click(screen.getByRole("button", { name: "Use time" }));
    expect(timeChange).toHaveBeenCalledWith("08:30");
  });
});
