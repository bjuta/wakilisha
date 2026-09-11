import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import "@/design-system/wakilisha.tokens.css";
import "@/design-system/wakilisha.elements.foundation.css";
import "@/design-system/wakilisha.elements.product.css";
import "@/design-system/wakilisha.elements.content.css";
import "@/design-system/wakilisha.viewport-integrity.css";
import { WkCheckbox } from "@/components/design-system/primitives/Checkbox";
import { WkRadio, WkRadioGroup } from "@/components/design-system/primitives/Radio";
import { SearchableSelect } from "@/components/design-system/primitives/SearchableSelect";
import { WkSelect } from "@/components/design-system/primitives/Select";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { initializeViewportIntegrityObserver } from "@/lib/viewport/viewportIntegrity";

function InteractionFixture() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("alpha");
  const [finiteChoice, setFiniteChoice] = useState("alpha");
  const [checked, setChecked] = useState(false);
  const [radioChoice, setRadioChoice] = useState("person");

  return (
    <main className="min-h-screen bg-wk-bg p-6 text-wk-text">
      <div className="grid grid-cols-[minmax(0,1fr)]">
        <div className="min-w-0">
          <div
            data-viewport-long-identity
            className="wk-identity-wrap w-full rounded-xl border border-wk-border bg-wk-surface p-3 text-[16px] font-black text-wk-text"
          >
            WK-C-PROD-CANARY-20260909T195845Z-caf744e1-EXTREMELY-LONG-IDENTITY-REGRESSION-PROBE
          </div>
        </div>
      </div>

      <div
        data-viewport-disclosure-grid
        className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
      >
        <div className="min-w-0 space-y-2">
          <button
            data-viewport-disclosure-package
            type="button"
            className="min-w-0 w-full rounded-xl border border-wk-border bg-wk-surface p-3 text-left"
          >
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div
                  data-viewport-disclosure-reference
                  className="wk-identity-wrap text-[11px] font-black text-wk-text"
                >
                  WK-C-PROD-CANARY-20260909T195845Z-caf744e1-PKG-1-EXTREMELY-LONG-DISCLOSURE-PACKAGE-REFERENCE
                </div>
                <div className="mt-1 text-[9px] font-bold text-wk-text-faint">
                  Sep 9, 2026 at 11:42 PM
                </div>
              </div>
              <div
                data-viewport-disclosure-status
                className="shrink-0 self-start"
              >
                <span className="wk-badge">Released</span>
              </div>
            </div>
          </button>
        </div>

        <div
          data-viewport-disclosure-detail
          className="min-h-[220px] min-w-0 rounded-xl border border-wk-border bg-wk-surface p-3"
        >
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="wk-identity-wrap text-[11px] font-black text-wk-text">
                WK-C-PROD-CANARY-20260909T195845Z-caf744e1-PKG-1-EXTREMELY-LONG-DISCLOSURE-PACKAGE-REFERENCE
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wk-button wk-button-primary"
      >
        Open interaction sheet
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Interaction acceptance"
        side="right"
      >
        <div className="space-y-5">
          <WkSelect
            ariaLabel="Finite acceptance choice"
            options={[
              { value: "alpha", label: "Alpha" },
              { value: "beta", label: "Beta" },
              { value: "gamma", label: "Gamma", disabled: true },
            ]}
            value={finiteChoice}
            onChange={setFiniteChoice}
          />

          <WkCheckbox checked={checked} onChange={setChecked}>
            Acceptance checkbox
          </WkCheckbox>

          <WkRadioGroup
            ariaLabel="Acceptance radio group"
            value={radioChoice}
            onChange={setRadioChoice}
            className="flex flex-wrap gap-3 space-y-0"
          >
            <WkRadio value="person">Person</WkRadio>
            <WkRadio value="organization">Organization</WkRadio>
          </WkRadioGroup>

          <SearchableSelect
            ariaLabel="Acceptance picker"
            searchPlaceholder="Find option"
            options={[
              { value: "alpha", label: "Alpha" },
              { value: "beta", label: "Beta" },
              { value: "gamma", label: "Gamma" },
            ]}
            value={value}
            onChange={setValue}
          />

          <input
            aria-label="Following field"
            type="text"
            className="wk-input w-full"
          />

          <textarea
            aria-label="Legacy compact field"
            className="w-full rounded-lg border border-wk-border bg-wk-surface p-3 text-[12px] text-wk-text"
          />

          <div
            aria-label="Editable note"
            role="textbox"
            contentEditable
            suppressContentEditableWarning
            className="min-h-12 w-full rounded-lg border border-wk-border bg-wk-surface p-3 text-[12px] text-wk-text"
          >
            Editable note
          </div>

          <button type="button" className="wk-button wk-button-ghost">
            Final sheet action
          </button>
        </div>
      </Sheet>
    </main>
  );
}

initializeViewportIntegrityObserver();

createRoot(document.getElementById("root")!).render(
  <InteractionFixture />,
);
