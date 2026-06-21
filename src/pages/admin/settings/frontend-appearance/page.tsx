import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getFrontendAppearanceSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_FRONTEND_APPEARANCE_SETTINGS,
  type FrontendAppearanceSettings,
} from "@/services/adminSettings/settingsTypes";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";

/* ──── Hero density helpers ──── */
function getColumnCount(imageCount: number): number {
  if (imageCount <= 1) return 1;
  if (imageCount <= 3) return 2;
  if (imageCount <= 8) return 3;
  if (imageCount <= 20) return 4;
  if (imageCount <= 40) return 5;
  if (imageCount <= 60) return 7;
  if (imageCount <= 90) return 9;
  if (imageCount <= 120) return 11;
  if (imageCount <= 160) return 14;
  return Math.min(20, Math.round(imageCount / 9));
}

function getDensityLabel(count: number): { label: string; description: string; color: string } {
  if (count <= 1) return { label: "Full-width portrait", description: "One single artist, completely filling the hero — maximum impact, minimum crowd", color: "var(--wk-brand)" };
  if (count <= 3) return { label: "Duet", description: "2 columns — two faces side by side, intimate and editorial", color: "var(--wk-v-music)" };
  if (count <= 8) return { label: "Sparse mosaic", description: "3 columns — breathing room, each face gets space and weight", color: "var(--wk-v-intel)" };
  if (count <= 20) return { label: "Light grid", description: "4 columns — a curated shortlist, feels like a gallery lineup", color: "var(--wk-v-film)" };
  if (count <= 40) return { label: "Standard collage", description: "5 columns — the default. Rich, visual, immersive without being overwhelming", color: "var(--wk-success)" };
  if (count <= 60) return { label: "Dense mosaic", description: "7 columns — starts to feel like a living wall of faces", color: "var(--wk-v-fashion)" };
  if (count <= 90) return { label: "Magazine wall", description: "9 columns — editorial density, every face is still distinct", color: "var(--wk-warning)" };
  if (count <= 120) return { label: "Editorial tapestry", description: "11 columns — near-cinematic. Faces begin to weave together", color: "var(--wk-v-food)" };
  if (count <= 160) return { label: "Gallery canvas", description: "14 columns — a true canvas. Individual faces become part of a larger texture", color: "var(--wk-v-places)" };
  return { label: "Maximum density", description: `${getColumnCount(count)} columns — extreme density. The continent's faces become a single living mural`, color: "var(--wk-danger)" };
}

export default function AdminSettingsFrontendAppearance() {
  const [settings, setSettings] = useState<FrontendAppearanceSettings>(getFrontendAppearanceSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof FrontendAppearanceSettings>(key: K, value: FrontendAppearanceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("frontendAppearance", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_FRONTEND_APPEARANCE_SETTINGS);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Palette" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Frontend Appearance</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Platform-wide accent colors, theme defaults, and hero fallbacks. Not chart-specific.
        </p>
      </div>

      {/* Colors */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Palette" size={16} />
          Accent Colors
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Light Mode Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.lightModeAccent}
                onChange={(e) => update("lightModeAccent", e.target.value)}
                className="h-10 w-10 rounded-lg border border-[var(--wk-border)] cursor-pointer"
              />
              <input
                type="text"
                value={settings.lightModeAccent}
                onChange={(e) => update("lightModeAccent", e.target.value)}
                className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Dark Mode Accent</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={settings.darkModeAccent}
                onChange={(e) => update("darkModeAccent", e.target.value)}
                className="h-10 w-10 rounded-lg border border-[var(--wk-border)] cursor-pointer"
              />
              <input
                type="text"
                value={settings.darkModeAccent}
                onChange={(e) => update("darkModeAccent", e.target.value)}
                className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
              />
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Theme Default</label>
            <select
              value={settings.themeDefault}
              onChange={(e) => update("themeDefault", e.target.value as "system" | "light" | "dark")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </WkSurface>

      {/* Hero Fallbacks */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Image" size={16} />
          Hero Fallbacks
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {([
            { key: "defaultChartHeroImage",    label: "Default Chart Hero Image" },
            { key: "defaultArtistHeroFallback", label: "Default Artist Hero Fallback" },
            { key: "defaultGenreHeroFallback",  label: "Default Genre Hero Fallback" },
            { key: "defaultLabelHeroFallback",  label: "Default Label Hero Fallback" },
            { key: "defaultLoginBackground",    label: "Default Login Background" },
          ] as { key: keyof FrontendAppearanceSettings; label: string }[]).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">{label}</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={String(settings[key] ?? "")}
                  onChange={(e) => update(key, e.target.value as FrontendAppearanceSettings[typeof key])}
                  placeholder="https://..."
                  className="flex-1 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
                />
                <MediaPickerButton
                  onSelect={(assetId, url) => update(key, url as FrontendAppearanceSettings[typeof key])}
                  title={`Select ${label}`}
                  iconOnly
                />
              </div>
            </div>
          ))}
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Archive Filter Behavior</label>
            <select
              value={settings.archiveFilterBehavior}
              onChange={(e) => update("archiveFilterBehavior", e.target.value as "show_all" | "collapse_by_year")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="show_all">Show All</option>
              <option value="collapse_by_year">Collapse by Year</option>
            </select>
          </div>
        </div>
      </WkSurface>

      {/* Artist Hero Image Count */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="LayoutGrid" size={16} />
          Artists Hero — Image Canvas Density
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-5">
          Controls how many artist images appear in the full-bleed masonry collage on the Artists page hero.
          At 1, it's a fullwidth single portrait. At 200, it's a 20-column mural.
        </p>

        {/* Slider */}
        <div className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <label className="text-[12px] font-semibold text-[var(--wk-text-muted)]">Image count</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={200}
                value={settings.artistHeroImageCount}
                onChange={(e) => {
                  const v = Math.max(1, Math.min(200, Number(e.target.value)));
                  update("artistHeroImageCount", v);
                }}
                className="w-16 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-2 py-1 text-[13px] font-bold text-center text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none"
              />
              <span className="text-[12px] text-[var(--wk-text-faint)]">/200</span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={200}
            value={settings.artistHeroImageCount}
            onChange={(e) => update("artistHeroImageCount", Number(e.target.value))}
            className="w-full h-2 rounded-full cursor-pointer accent-[var(--wk-brand)]"
          />
          <div className="mt-1.5 flex justify-between text-[10px] text-[var(--wk-text-faint)]">
            <span>1 — Fullwidth portrait</span>
            <span>200 — 20-col mural</span>
          </div>
        </div>

        {/* Density indicator */}
        {(() => {
          const density = getDensityLabel(settings.artistHeroImageCount);
          const cols = getColumnCount(settings.artistHeroImageCount);
          return (
            <div className="rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] p-4">
              <div className="flex items-start gap-4">
                {/* Visual column preview */}
                <div className="shrink-0 flex items-end gap-[3px] h-12">
                  {Array.from({ length: Math.min(cols, 20) }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-sm flex-1"
                      style={{
                        width: `${Math.max(3, Math.floor(80 / Math.min(cols, 20)))}px`,
                        height: `${48 - (i % 3) * 8}px`,
                        background: density.color,
                        opacity: 0.7 + (i % 2) * 0.2,
                      }}
                    />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-bold text-[var(--wk-text)]" style={{ color: density.color }}>
                      {density.label}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                      {cols} col{cols !== 1 ? "s" : ""}
                    </span>
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]">
                      {settings.artistHeroImageCount} images
                    </span>
                  </div>
                  <p className="text-[12px] text-[var(--wk-text-muted)] leading-relaxed">{density.description}</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Quick preset buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--wk-text-faint)] mr-1">Quick presets</span>
          {[
            { label: "1 (portrait)", value: 1 },
            { label: "12 (light)", value: 12 },
            { label: "40 (default)", value: 40 },
            { label: "80 (dense)", value: 80 },
            { label: "150 (tapestry)", value: 150 },
            { label: "200 (mural)", value: 200 },
          ].map((p) => (
            <button
              key={p.value}
              onClick={() => update("artistHeroImageCount", p.value)}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
                settings.artistHeroImageCount === p.value
                  ? "border-[var(--wk-brand)] bg-[var(--wk-brand-soft)] text-[var(--wk-brand)]"
                  : "border-[var(--wk-border)] text-[var(--wk-text-muted)] hover:border-[var(--wk-brand)] hover:text-[var(--wk-brand)]"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </WkSurface>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="wk-button wk-button-primary wk-button-sm flex items-center gap-2"
        >
          <WkIcon name={saving ? "Loader" : "Save"} size={14} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={handleReset}
          className="wk-button wk-button-ghost wk-button-sm"
        >
          Reset to Defaults
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]">
            <WkIcon name="Check" size={14} /> Saved
          </span>
        )}
      </div>
    </div>
  );
}