// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { WkColorField } from "@/components/design-system/primitives/ColorField";
import {
  WkDatePicker,
  WkTimePicker,
} from "@/components/design-system/primitives/DateTimePicker";
import {
  WkPasswordField,
  WkSearchField,
} from "@/components/design-system/primitives/Field";
import { WkNumberField } from "@/components/design-system/primitives/NumberField";
import { WkSlider } from "@/components/design-system/primitives/Slider";
import { WkSuggestionField } from "@/components/design-system/primitives/SuggestionField";
import { WkUploadField } from "@/components/design-system/primitives/UploadField";

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

    const field = screen.getByRole("textbox", {
      name: "Confidence threshold",
    });
    expect(field).toHaveAttribute("aria-roledescription", "Number field");
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
    expect(slider).toHaveAttribute("aria-valuenow", "20");
    await user.click(slider);
    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "30"));
    expect(screen.getByText("30")).toBeVisible();
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

  it("blocks temporal values outside the governed range and closes on Escape", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <WkDatePicker
        label="Embargo date"
        value="2026-09-12"
        min="2026-09-13"
        max="2026-09-30"
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Embargo date/i }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a value inside the allowed range.",
    );
    expect(screen.getByRole("button", { name: "Use date" })).toBeDisabled();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Embargo date" })).not.toBeInTheDocument();
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("preserves freeform datalist replacement behavior", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("Broadcast");
      return (
        <div>
          <WkSuggestionField
            ariaLabel="Source form"
            value={value}
            onChange={setValue}
            options={["Broadcast", "Streaming", "Print"]}
          />
          <output aria-label="Current source form">{value}</output>
        </div>
      );
    }

    render(<Harness />);
    const field = screen.getByRole("combobox", { name: "Source form" });
    await user.clear(field);
    await user.type(field, "Community tip");

    expect(screen.getByLabelText("Current source form")).toHaveTextContent(
      "Community tip",
    );
  });

  it("preserves color value selection without native color chrome", async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState("#111827");
      return (
        <div>
          <WkColorField
            compact
            ariaLabel="Theme accent"
            value={value}
            onChange={setValue}
          />
          <output aria-label="Current theme accent">{value}</output>
        </div>
      );
    }

    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Theme accent" }));
    await user.click(screen.getByRole("button", { name: "Use #3b82f6" }));

    expect(screen.getByLabelText("Current theme accent")).toHaveTextContent(
      "#3b82f6",
    );
  });

  it("preserves upload accept, multiple, disabled, and FileList semantics", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <WkUploadField
        ariaLabel="Upload evidence"
        label="Upload evidence"
        accept="image/png,image/jpeg"
        multiple
        onSelect={onSelect}
      />,
    );

    const nativeInput = container.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement | null;
    expect(nativeInput).not.toBeNull();
    expect(nativeInput).toHaveAttribute("accept", "image/png,image/jpeg");
    expect(nativeInput).toHaveAttribute("multiple");

    const first = new File(["first"], "first.png", { type: "image/png" });
    const second = new File(["second"], "second.jpg", { type: "image/jpeg" });
    await user.upload(nativeInput!, [first, second]);

    expect(onSelect).toHaveBeenCalledTimes(1);
    const delivered = onSelect.mock.calls[0]?.[0] as FileList;
    expect(Array.from(delivered, (file) => file.name)).toEqual([
      "first.png",
      "second.jpg",
    ]);

    rerender(
      <WkUploadField
        ariaLabel="Upload evidence"
        label="Upload evidence"
        accept="image/png,image/jpeg"
        multiple
        disabled
        onSelect={onSelect}
      />,
    );
    expect(screen.getByRole("button", { name: "Upload evidence" })).toBeDisabled();
  });
});
