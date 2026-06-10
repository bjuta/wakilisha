import { useState, useCallback } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getNavigationSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_NAVIGATION_SETTINGS,
  DEFAULT_SHARE_PLATFORMS,
  type NavigationSettings,
  type SharePlatform,
} from "@/services/adminSettings/settingsTypes";

const TEMPLATE_VARS = ["{title}", "{url}", "{excerpt}", "{artist}", "{release}"];

export default function AdminSettingsNavigation() {
  const [settings, setSettings] = useState<NavigationSettings>(() => {
    const stored = getNavigationSettings();
    // Migrate: if old format lacks sharePlatforms, use defaults
    if (!stored.shareConfig.sharePlatforms) {
      return {
        ...stored,
        shareConfig: {
          ...stored.shareConfig,
          sharePlatforms: DEFAULT_SHARE_PLATFORMS.map((p) => ({
            ...p,
            enabled: stored.shareConfig.platforms.includes(p.id),
          })),
        },
      };
    }
    return stored;
  });

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateErrors, setTemplateErrors] = useState<Record<string, string>>({});

  const sharePlatforms = settings.shareConfig.sharePlatforms ?? DEFAULT_SHARE_PLATFORMS;

  const updateNavItem = (
    index: number,
    updates: Partial<NavigationSettings["publicNavItems"][0]>,
  ) => {
    const next = settings.publicNavItems.map((item, i) =>
      i === index ? { ...item, ...updates } : item,
    );
    setSettings((prev) => ({ ...prev, publicNavItems: next }));
    setSaved(false);
  };

  const togglePlatform = useCallback((id: string) => {
    setSettings((prev) => {
      const updated = (prev.shareConfig.sharePlatforms ?? DEFAULT_SHARE_PLATFORMS).map((p) =>
        p.id === id ? { ...p, enabled: !p.enabled } : p,
      );
      const enabledIds = updated.filter((p) => p.enabled).map((p) => p.id);
      return {
        ...prev,
        shareConfig: {
          ...prev.shareConfig,
          platforms: enabledIds,
          sharePlatforms: updated,
        },
      };
    });
    setSaved(false);
  }, []);

  const updateTemplate = useCallback((id: string, template: string) => {
    // Validate template variables
    const unknownVars = (template.match(/\{[^}]+\}/g) ?? []).filter(
      (v) => !TEMPLATE_VARS.includes(v),
    );
    if (unknownVars.length > 0) {
      setTemplateErrors((prev) => ({
        ...prev,
        [id]: `Unknown variable(s): ${unknownVars.join(", ")}. Allowed: ${TEMPLATE_VARS.join(", ")}`,
      }));
    } else {
      setTemplateErrors((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }

    setSettings((prev) => ({
      ...prev,
      shareConfig: {
        ...prev.shareConfig,
        sharePlatforms: (prev.shareConfig.sharePlatforms ?? DEFAULT_SHARE_PLATFORMS).map((p) =>
          p.id === id ? { ...p, template } : p,
        ),
      },
    }));
    setSaved(false);
  }, []);

  const handleSave = () => {
    if (Object.keys(templateErrors).length > 0) return;
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("navigation", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_NAVIGATION_SETTINGS);
    setTemplateErrors({});
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Compass" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Navigation</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Admin and public nav structure. Feeds React navigation, not old WordPress navbar logic.
        </p>
      </div>

      {/* Public navigation items */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Public Navigation</h2>
        <div className="space-y-2">
          {settings.publicNavItems.map((item, index) => (
            <div
              key={item.path}
              className="flex items-center gap-3 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)] text-[12px] font-bold">
                {item.order}
              </div>
              <div className="flex-1 grid gap-2 sm:grid-cols-3">
                <input
                  type="text"
                  value={item.label}
                  onChange={(e) => updateNavItem(index, { label: e.target.value })}
                  className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
                />
                <input
                  type="text"
                  value={item.path}
                  onChange={(e) => updateNavItem(index, { path: e.target.value })}
                  className="rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] font-mono focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateNavItem(index, { visible: !item.visible })}
                    className={`relative h-5 w-9 rounded-full transition-colors ${item.visible ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--wk-surface)] transition-transform ${item.visible ? "translate-x-[18px]" : "translate-x-0.5"}`}
                    />
                  </button>
                  <span className="text-[12px] text-[var(--wk-text-muted)]">
                    {item.visible ? "Visible" : "Hidden"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </WkSurface>

      {/* Share config */}
      <WkSurface className="p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-[14px] font-bold text-[var(--wk-text)]">Share Platforms</h2>
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-0.5">
              Toggle platforms on/off. Optionally customize the share message template per platform.
            </p>
          </div>
          <button
            onClick={() =>
              setSettings((prev) => ({
                ...prev,
                shareConfig: { ...prev.shareConfig, enabled: !prev.shareConfig.enabled },
              }))
            }
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${settings.shareConfig.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.shareConfig.enabled ? "translate-x-[22px]" : "translate-x-0.5"}`}
            />
          </button>
        </div>

        {/* Template variable reference */}
        <div className="mb-4 rounded-lg bg-[var(--wk-bg)] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">
            Available template variables
          </p>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARS.map((v) => (
              <span
                key={v}
                className="inline-flex items-center rounded-md border border-[var(--wk-border)] bg-[var(--wk-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--wk-text-soft)]"
              >
                {v}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {sharePlatforms.map((platform) => (
            <PlatformCard
              key={platform.id}
              platform={platform}
              onToggle={() => togglePlatform(platform.id)}
              onTemplateChange={(t) => updateTemplate(platform.id, t)}
              templateError={templateErrors[platform.id]}
            />
          ))}
        </div>

        {/* Enabled platforms summary */}
        <div className="mt-4 rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--wk-text-faint)] mb-2">
            Currently enabled platforms
          </p>
          <div className="flex flex-wrap gap-1.5">
            {sharePlatforms
              .filter((p) => p.enabled)
              .map((p) => (
                <span
                  key={p.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)] px-2.5 py-0.5 text-[10px] font-bold text-[var(--wk-brand)]"
                >
                  <i className={`${p.icon} text-xs`} />
                  {p.label}
                </span>
              ))}
            {sharePlatforms.filter((p) => p.enabled).length === 0 && (
              <span className="text-[11px] text-[var(--wk-text-faint)]">No platforms enabled</span>
            )}
          </div>
        </div>
      </WkSurface>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || Object.keys(templateErrors).length > 0}
          className="wk-button wk-button-primary wk-button-sm flex items-center gap-2 whitespace-nowrap"
        >
          <WkIcon name={saving ? "Loader" : "Save"} size={14} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={handleReset} className="wk-button wk-button-ghost wk-button-sm whitespace-nowrap">
          Reset to Defaults
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]">
            <WkIcon name="Check" size={14} /> Saved
          </span>
        )}
        {Object.keys(templateErrors).length > 0 && (
          <span className="text-[12px] text-[var(--wk-danger)]">
            Fix template errors before saving
          </span>
        )}
      </div>
    </div>
  );
}

function PlatformCard({
  platform,
  onToggle,
  onTemplateChange,
  templateError,
}: {
  platform: SharePlatform;
  onToggle: () => void;
  onTemplateChange: (template: string) => void;
  templateError?: string;
}) {
  const [showTemplate, setShowTemplate] = useState(false);

  return (
    <div
      className={`rounded-xl border p-4 transition-colors ${
        platform.enabled
          ? "border-[var(--wk-brand)]/20 bg-[var(--wk-brand-soft)]"
          : "border-[var(--wk-border)] bg-[var(--wk-bg)]"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Platform icon */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[18px] ${
            platform.enabled
              ? "bg-[var(--wk-brand)] text-[var(--wk-brand-on)]"
              : "bg-[var(--wk-surface-raised)] text-[var(--wk-text-muted)]"
          }`}
        >
          <i className={platform.icon} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">{platform.label}</div>
          {platform.template && (
            <div className="text-[10px] text-[var(--wk-text-faint)] truncate mt-0.5">
              {platform.template.slice(0, 40)}{platform.template.length > 40 ? "…" : ""}
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={onToggle}
          className={`relative shrink-0 h-5 w-9 rounded-full transition-colors ${
            platform.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-[var(--wk-surface)] transition-transform ${
              platform.enabled ? "translate-x-[18px]" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {/* Template editor (expandable) */}
      {platform.template !== undefined && (
        <div className="mt-3">
          <button
            onClick={() => setShowTemplate(!showTemplate)}
            className="flex items-center gap-1 text-[10px] font-bold text-[var(--wk-text-faint)] hover:text-[var(--wk-text-soft)] transition-colors"
          >
            <i className={showTemplate ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} />
            {showTemplate ? "Hide" : "Edit"} template
          </button>
          {showTemplate && (
            <div className="mt-2">
              <input
                type="text"
                value={platform.template}
                onChange={(e) => onTemplateChange(e.target.value)}
                placeholder="Share message template…"
                className={`w-full rounded-lg border px-3 py-2 text-[12px] text-[var(--wk-text)] bg-[var(--wk-bg)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)] ${
                  templateError
                    ? "border-[var(--wk-danger)] focus:border-[var(--wk-danger)] focus:ring-[var(--wk-danger)]"
                    : "border-[var(--wk-border)] focus:border-[var(--wk-brand)]"
                }`}
              />
              {templateError && (
                <p className="mt-1 text-[10px] text-[var(--wk-danger)] font-semibold">{templateError}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}