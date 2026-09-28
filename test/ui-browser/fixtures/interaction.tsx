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
import { Modal } from "@/components/design-system/primitives/Modal";
import { WkDatePicker } from "@/components/design-system/primitives/DateTimePicker";
import { WkIcon } from "@/components/design-system/Icon";
import { initializeViewportIntegrityObserver } from "@/lib/viewport/viewportIntegrity";

function InteractionFixture() {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [fixtureDate, setFixtureDate] = useState("2026-09-28");
  const [value, setValue] = useState("alpha");
  const [finiteChoice, setFiniteChoice] = useState("alpha");
  const [checked, setChecked] = useState(false);
  const [radioChoice, setRadioChoice] = useState("person");

  return (
    <main className="min-h-screen bg-wk-bg p-6 text-wk-text">
      <div
        data-wk-icon-sprite-probe
        className="mb-4 inline-flex h-10 w-10 items-center justify-center text-wk-brand"
      >
        <WkIcon name="Home" size={24} />
      </div>

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

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="wk-button wk-button-secondary ml-2"
      >
        Open tall interaction modal
      </button>

      <div className="h-[1050px]" aria-hidden="true" />

      <section data-temporal-picker-probe className="mb-8 max-w-sm">
        <WkDatePicker
          label="Fixture date"
          value={fixtureDate}
          onChange={setFixtureDate}
          min="2020-01-01"
          max="2030-12-31"
        />
      </section>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Tall interaction acceptance"
        maxWidth="4xl"
        footer={
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="wk-button wk-button-primary"
            >
              Pinned modal action
            </button>
          </div>
        }
      >
        <div data-tall-modal-content className="space-y-3">
          {Array.from({ length: 24 }, (_, index) => (
            <div
              key={index}
              className="rounded-lg border border-wk-border bg-wk-surface-raised p-3"
            >
              Modal row {index + 1}
            </div>
          ))}
        </div>
      </Modal>

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
