import { useState } from "react";
import { createRoot } from "react-dom/client";
import "@/index.css";
import "@/design-system/wakilisha.tokens.css";
import "@/design-system/wakilisha.elements.foundation.css";
import "@/design-system/wakilisha.elements.product.css";
import "@/design-system/wakilisha.elements.content.css";
import { Sheet } from "@/components/design-system/primitives/Sheet";
import { SearchableSelect } from "@/components/design-system/primitives/SearchableSelect";

function InteractionFixture() {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("alpha");

  return (
    <main className="min-h-screen bg-wk-bg p-6 text-wk-text">
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

          <button type="button" className="wk-button wk-button-ghost">
            Final sheet action
          </button>
        </div>
      </Sheet>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <InteractionFixture />,
);
