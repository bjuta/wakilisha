import { useState } from "react";
import { WkButton } from "../../../../components/design-system/primitives/Button";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";

export function SpecimenWall() {
  const [activeSpecimen, setActiveSpecimen] = useState<string>("buttons");

  const specimens = [
    { id: "buttons", label: "Buttons" },
    { id: "tags", label: "Tags" },
    { id: "surfaces", label: "Surfaces" },
    { id: "typography", label: "Typography" },
    { id: "rows", label: "Rows" },
    { id: "cards", label: "Cards" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {specimens.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSpecimen(s.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all ${
              activeSpecimen === s.id
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSpecimen === "buttons" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Button Variants
          </h3>
          <div className="flex flex-wrap gap-3">
            <WkButton variant="primary">Primary</WkButton>
            <WkButton variant="ghost">Ghost</WkButton>
            <WkButton variant="soft">Soft</WkButton>
          </div>
          <div className="flex flex-wrap gap-3">
            <WkButton variant="primary">
              <i className="ri-play-line" />
              Play
            </WkButton>
            <WkButton variant="ghost">
              <i className="ri-share-line" />
              Share
            </WkButton>
            <WkButton variant="soft">
              <i className="ri-heart-line" />
              Save
            </WkButton>
          </div>
        </div>
      )}

      {activeSpecimen === "tags" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Tag Variants
          </h3>
          <div className="flex flex-wrap gap-2">
            <WkTag>Default</WkTag>
            <WkTag variant="brand">Brand</WkTag>
            <WkTag>
              <i className="ri-music-line" />
              Music
            </WkTag>
            <WkTag variant="brand">
              <i className="ri-film-line" />
              Film
            </WkTag>
            <WkTag>
              <i className="ri-map-pin-line" />
              Places
            </WkTag>
            <WkTag variant="brand">Active</WkTag>
          </div>
        </div>
      )}

      {activeSpecimen === "surfaces" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Surface Levels
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WkSurface className="p-4">
              <h4 className="text-[13px] font-bold text-[var(--wk-text)]">Default</h4>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Standard surface with border and subtle shadow.
              </p>
            </WkSurface>
            <WkSurface className="p-4 border-[var(--wk-border-2)]">
              <h4 className="text-[13px] font-bold text-[var(--wk-text)]">Stronger border</h4>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Surface with raised border contrast.
              </p>
            </WkSurface>
            <WkSurface className="p-4 bg-[var(--wk-surface-raised)]">
              <h4 className="text-[13px] font-bold text-[var(--wk-text)]">Raised</h4>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Raised background for nested surfaces.
              </p>
            </WkSurface>
          </div>
        </div>
      )}

      {activeSpecimen === "typography" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Typography Scale
          </h3>
          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-4">
              <div className="wk-eyebrow mb-2">Eyebrow</div>
              <div className="wk-h-hero mb-2">Hero Headline</div>
              <div className="wk-h-page mb-2">Page Title</div>
              <div className="wk-h-section mb-2">Section Title</div>
              <div className="wk-copy">
                Body copy at standard size. This text uses DM Sans for warmth and
                editorial credibility across the WAKILISHA platform.
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSpecimen === "rows" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Track Row
          </h3>
          <WkSurface className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                <i className="ri-music-2-line" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">
                  Track Name
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  Artist Name
                </div>
              </div>
              <WkTag variant="brand">#1</WkTag>
              <button className="h-8 w-8 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] flex items-center justify-center">
                <i className="ri-play-mini-fill text-sm" />
              </button>
            </div>
          </WkSurface>

          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Chart Row
          </h3>
          <WkSurface className="p-3">
            <div className="flex items-center gap-3">
              <div className="text-lg font-bold text-[var(--wk-brand)] w-8 text-center">1</div>
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                <i className="ri-music-2-line" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">
                  Charting Track
                </div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">
                  Artist Name
                </div>
              </div>
              <div className="flex items-center gap-1 text-[var(--wk-success)]">
                <i className="ri-arrow-up-line text-xs" />
                <span className="text-xs font-bold">2</span>
              </div>
              <WkTag>3 wks</WkTag>
              <button className="h-8 w-8 rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] flex items-center justify-center">
                <i className="ri-play-mini-fill text-sm" />
              </button>
            </div>
          </WkSurface>
        </div>
      )}

      {activeSpecimen === "cards" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Entity Cards
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WkSurface className="overflow-hidden">
              <div className="h-32 bg-[var(--wk-surface-raised)] flex items-center justify-center text-[var(--wk-text-faint)]">
                <i className="ri-user-3-line text-3xl" />
              </div>
              <div className="p-3">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">Artist Name</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">12 tracks · 2 releases</div>
                <div className="mt-2 flex gap-1">
                  <WkTag variant="brand">Afrobeats</WkTag>
                </div>
              </div>
            </WkSurface>

            <WkSurface className="overflow-hidden">
              <div className="h-32 bg-[var(--wk-surface-raised)] flex items-center justify-center text-[var(--wk-text-faint)]">
                <i className="ri-album-line text-3xl" />
              </div>
              <div className="p-3">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">Release Title</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Album · 2024</div>
                <div className="mt-2 flex gap-1">
                  <WkTag>8 tracks</WkTag>
                </div>
              </div>
            </WkSurface>

            <WkSurface className="overflow-hidden">
              <div className="h-32 bg-[var(--wk-surface-raised)] flex items-center justify-center text-[var(--wk-text-faint)]">
                <i className="ri-book-open-line text-3xl" />
              </div>
              <div className="p-3">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">Story Title</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Culture · 5 min read</div>
                <div className="mt-2 flex gap-1">
                  <WkTag variant="brand">Magazine</WkTag>
                </div>
              </div>
            </WkSurface>
          </div>
        </div>
      )}
    </div>
  );
}