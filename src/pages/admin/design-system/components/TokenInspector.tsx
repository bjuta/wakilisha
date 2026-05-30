import { useState } from "react";

const TOKEN_CATEGORIES = [
  {
    id: "colors",
    label: "Colors",
    tokens: [
      "--wk-bg",
      "--wk-bg-subtle",
      "--wk-surface",
      "--wk-surface-raised",
      "--wk-surface-strong",
      "--wk-overlay",
      "--wk-text",
      "--wk-text-soft",
      "--wk-text-muted",
      "--wk-text-faint",
      "--wk-text-on-brand",
      "--wk-text-inverse",
      "--wk-border",
      "--wk-border-2",
      "--wk-border-strong",
      "--wk-divider",
      "--wk-brand",
      "--wk-brand-2",
      "--wk-brand-soft",
      "--wk-brand-on",
      "--wk-success",
      "--wk-warning",
      "--wk-danger",
      "--wk-info",
      "--wk-v-music",
      "--wk-v-film",
      "--wk-v-fashion",
      "--wk-v-food",
      "--wk-v-language",
      "--wk-v-dance",
      "--wk-v-places",
      "--wk-v-intel",
    ],
  },
  {
    id: "spacing",
    label: "Spacing",
    tokens: [
      "--wk-s-1",
      "--wk-s-2",
      "--wk-s-3",
      "--wk-s-4",
      "--wk-s-5",
      "--wk-s-6",
      "--wk-s-8",
      "--wk-s-10",
      "--wk-s-12",
      "--wk-s-16",
      "--wk-s-20",
      "--wk-s-24",
      "--wk-s-32",
    ],
  },
  {
    id: "radius",
    label: "Radius",
    tokens: [
      "--wk-r-1",
      "--wk-r-2",
      "--wk-r-3",
      "--wk-r-4",
      "--wk-r-5",
      "--wk-r-6",
      "--wk-r-7",
      "--wk-r-pill",
    ],
  },
  {
    id: "typography",
    label: "Typography",
    tokens: [
      "--wk-font-display",
      "--wk-font-ui",
      "--wk-font-body",
      "--wk-font-mono",
    ],
  },
  {
    id: "motion",
    label: "Motion",
    tokens: [
      "--wk-d-instant",
      "--wk-d-fast",
      "--wk-d-standard",
      "--wk-d-slow",
      "--wk-d-deliberate",
      "--wk-ease-standard",
      "--wk-ease-snap",
      "--wk-ease-in",
      "--wk-ease-out",
    ],
  },
  {
    id: "layout",
    label: "Layout",
    tokens: [
      "--wk-w-narrow",
      "--wk-w-text",
      "--wk-w-content",
      "--wk-w-wide",
      "--wk-w-max",
      "--wk-player-dock-h",
      "--wk-player-dock-h-mobile",
      "--wk-z-nav",
      "--wk-z-modal",
      "--wk-z-toast",
    ],
  },
  {
    id: "shadows",
    label: "Shadows",
    tokens: [
      "--wk-shadow-sm",
      "--wk-shadow",
      "--wk-shadow-lg",
    ],
  },
];

export function TokenInspector() {
  const [activeCategory, setActiveCategory] = useState("colors");
  const category = TOKEN_CATEGORIES.find((c) => c.id === activeCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TOKEN_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
              activeCategory === cat.id
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {category && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {category.tokens.map((token) => {
            const value = getComputedStyle(document.documentElement)
              .getPropertyValue(token)
              .trim();
            const isColor =
              value.startsWith("#") ||
              value.startsWith("rgb") ||
              value.startsWith("rgba") ||
              value.startsWith("hsl");

            return (
              <div
                key={token}
                className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4"
              >
                <div className="mb-2 font-mono text-[11px] text-[var(--wk-text-muted)]">
                  {token}
                </div>
                {isColor && (
                  <div
                    className="mb-2 h-10 w-full rounded-lg border border-[var(--wk-border-2)]"
                    style={{ background: `var(${token})` }}
                  />
                )}
                <div className="text-[13px] font-mono text-[var(--wk-text)]">
                  {value || "var(--wk-*)"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}