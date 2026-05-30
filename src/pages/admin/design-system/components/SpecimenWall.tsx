import { useState } from "react";
import { WkButton } from "../../../../components/design-system/primitives/Button";
import { WkTag } from "../../../../components/design-system/primitives/Tag";
import { WkSurface } from "../../../../components/design-system/primitives/Surface";
import { allComponentNames, allTableNames } from "../../../../design-system/designSystemSpec";

export function SpecimenWall() {
  const [activeSpecimen, setActiveSpecimen] = useState<string>("components");

  const specimens = [
    { id: "components", label: "Component index" },
    { id: "buttons", label: "Buttons" },
    { id: "tags", label: "Tags" },
    { id: "surfaces", label: "Surfaces" },
    { id: "typography", label: "Typography" },
    { id: "rows", label: "Rows" },
    { id: "cards", label: "Cards" },
  ];

  const componentNames = allComponentNames();
  const tableNames = allTableNames();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {specimens.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSpecimen(s.id)}
            className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-all whitespace-nowrap ${
              activeSpecimen === s.id
                ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                : "border border-[var(--wk-border)] text-[var(--wk-text-soft)] hover:bg-[var(--wk-surface-raised)]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSpecimen === "components" && (
        <div className="space-y-6">
          <WkSurface className="p-5">
            <h3 className="mb-1 text-[13px] font-bold text-[var(--wk-text)]">
              Component inventory
            </h3>
            <p className="mb-4 text-[12px] text-[var(--wk-text-muted)]">
              {componentNames.length} components required across all 54 chapters.
            </p>
            <div className="flex flex-wrap gap-2">
              {componentNames.map((name) => (
                <code
                  key={name}
                  className="rounded border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-1 font-mono text-[12px] text-[var(--wk-brand)]"
                >
                  {name}
                </code>
              ))}
            </div>
          </WkSurface>

          <WkSurface className="p-5">
            <h3 className="mb-1 text-[13px] font-bold text-[var(--wk-text)]">
              Database tables
            </h3>
            <p className="mb-4 text-[12px] text-[var(--wk-text-muted)]">
              {tableNames.length} tables referenced across all chapters.
            </p>
            <div className="flex flex-wrap gap-2">
              {tableNames.map((name) => (
                <code
                  key={name}
                  className="rounded border border-[var(--wk-border)] bg-[var(--wk-surface-raised)] px-2 py-1 font-mono text-[12px] text-[var(--wk-text-soft)]"
                >
                  {name}
                </code>
              ))}
            </div>
          </WkSurface>
        </div>
      )}

      {activeSpecimen === "buttons" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Button variants
          </h3>
          <div className="flex flex-wrap gap-3">
            <WkButton variant="primary">Primary</WkButton>
            <WkButton variant="ghost">Ghost</WkButton>
            <WkButton variant="soft">Soft</WkButton>
          </div>
          <div className="flex flex-wrap gap-3">
            <WkButton variant="primary">
              <i className="ri-play-line" />
              Play track
            </WkButton>
            <WkButton variant="ghost">
              <i className="ri-share-line" />
              Share
            </WkButton>
            <WkButton variant="soft">
              <i className="ri-heart-line" />
              Save to collection
            </WkButton>
          </div>
        </div>
      )}

      {activeSpecimen === "tags" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Tag variants
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
            <WkTag>Afrobeats</WkTag>
            <WkTag>Amapiano</WkTag>
            <WkTag>Bongo Fleva</WkTag>
          </div>
        </div>
      )}

      {activeSpecimen === "surfaces" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Surface levels
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WkSurface className="p-4">
              <h4 className="text-[13px] font-bold text-[var(--wk-text)]">Default</h4>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Standard surface. Card backgrounds, panels, content groups.
              </p>
            </WkSurface>
            <WkSurface className="p-4 border-[var(--wk-border-2)]">
              <h4 className="text-[13px] font-bold text-[var(--wk-text)]">Stronger border</h4>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Surface with raised border contrast. Active states.
              </p>
            </WkSurface>
            <WkSurface className="p-4 bg-[var(--wk-surface-raised)]">
              <h4 className="text-[13px] font-bold text-[var(--wk-text)]">Raised</h4>
              <p className="text-[13px] text-[var(--wk-text-muted)]">
                Raised background for nested surfaces and code blocks.
              </p>
            </WkSurface>
          </div>
        </div>
      )}

      {activeSpecimen === "typography" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Typography scale
          </h3>
          <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-surface)] p-6 space-y-4">
            <div className="text-[11px] font-bold uppercase tracking-widest text-[var(--wk-text-muted)]">
              Eyebrow label
            </div>
            <div className="text-4xl font-black tracking-tight text-[var(--wk-text)]">
              Hero headline
            </div>
            <div className="text-2xl font-bold tracking-tight text-[var(--wk-text)]">
              Page title
            </div>
            <div className="text-xl font-bold text-[var(--wk-text)]">
              Section title
            </div>
            <p className="text-[14px] leading-relaxed text-[var(--wk-text-soft)]">
              Body copy at standard size. DM Sans for warmth and editorial credibility across the WAKILISHA platform.
              This text represents the reading body used in articles, descriptions, and editorial content.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="text-[13px] text-[var(--wk-text-muted)]">UI label 13px</div>
              <div className="text-[12px] text-[var(--wk-text-muted)]">Metadata 12px</div>
              <div className="text-[11px] text-[var(--wk-text-faint)]">Eyebrow 11px</div>
              <code className="font-mono text-[12px] text-[var(--wk-brand)]">mono-12px</code>
            </div>
          </div>
        </div>
      )}

      {activeSpecimen === "rows" && (
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Track row
            </h3>
            <WkSurface className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                  <i className="ri-music-2-line" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">
                    Monalisa
                  </div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    Lojay, Sarz
                  </div>
                </div>
                <div className="text-[12px] text-[var(--wk-text-muted)]">3:47</div>
                <button
                  aria-label="Play Monalisa"
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
                >
                  <i className="ri-play-mini-fill text-sm" />
                </button>
              </div>
            </WkSurface>
          </div>

          <div>
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
              Chart row
            </h3>
            <WkSurface className="p-3">
              <div className="flex items-center gap-3">
                <div className="text-lg font-black text-[var(--wk-brand)] w-8 text-center shrink-0">1</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] shrink-0">
                  <i className="ri-music-2-line" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold text-[var(--wk-text)] truncate">
                    Flowers
                  </div>
                  <div className="text-[11px] text-[var(--wk-text-muted)]">
                    Miley Cyrus
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[var(--wk-success)] shrink-0">
                  <i className="ri-arrow-up-line text-xs" />
                  <span className="text-[12px] font-bold">3</span>
                </div>
                <WkTag>8 wks</WkTag>
                <button
                  aria-label="Play Flowers"
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-[var(--wk-brand)] text-[var(--wk-brand-on)] shrink-0"
                >
                  <i className="ri-play-mini-fill text-sm" />
                </button>
              </div>
            </WkSurface>
          </div>
        </div>
      )}

      {activeSpecimen === "cards" && (
        <div className="space-y-4">
          <h3 className="text-[13px] font-bold uppercase tracking-wider text-[var(--wk-text-muted)]">
            Entity cards
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <WkSurface className="overflow-hidden">
              <div className="h-32 bg-[var(--wk-surface-raised)] flex items-center justify-center text-[var(--wk-text-faint)]">
                <i className="ri-user-3-line text-3xl" />
              </div>
              <div className="p-3">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">Burna Boy</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">24 tracks · 4 releases</div>
                <div className="mt-2 flex gap-1">
                  <WkTag variant="brand">Afrobeats</WkTag>
                  <WkTag>Dancehall</WkTag>
                </div>
              </div>
            </WkSurface>

            <WkSurface className="overflow-hidden">
              <div className="h-32 bg-[var(--wk-surface-raised)] flex items-center justify-center text-[var(--wk-text-faint)]">
                <i className="ri-album-line text-3xl" />
              </div>
              <div className="p-3">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">Love, Damini</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Album · 2022 · 19 tracks</div>
                <div className="mt-2 flex gap-1">
                  <WkTag>Afrobeats</WkTag>
                  <WkTag>Atlantic</WkTag>
                </div>
              </div>
            </WkSurface>

            <WkSurface className="overflow-hidden">
              <div className="h-32 bg-[var(--wk-surface-raised)] flex items-center justify-center text-[var(--wk-text-faint)]">
                <i className="ri-book-open-line text-3xl" />
              </div>
              <div className="p-3">
                <div className="text-[13px] font-bold text-[var(--wk-text)]">The rise of Amapiano</div>
                <div className="text-[11px] text-[var(--wk-text-muted)]">Culture · 6 min read</div>
                <div className="mt-2 flex gap-1">
                  <WkTag variant="brand">Magazine</WkTag>
                  <WkTag>Amapiano</WkTag>
                </div>
              </div>
            </WkSurface>
          </div>
        </div>
      )}
    </div>
  );
}