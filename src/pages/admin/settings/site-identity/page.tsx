import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getSiteIdentitySettings, saveDomainSettings } from "@/services/adminSettings/settingsStore";
import { DEFAULT_SITE_IDENTITY_SETTINGS, type SiteIdentitySettings } from "@/services/adminSettings/settingsTypes";
import { MediaPickerButton } from "@/components/admin/MediaPickerButton";

function logoFor(settings: SiteIdentitySettings, mode: "light" | "dark") {
  return mode === "dark" ? settings.darkLogoUrl || settings.logoUrl : settings.lightLogoUrl || settings.logoUrl;
}

export default function AdminSettingsSiteIdentity() {
  const [settings, setSettings] = useState<SiteIdentitySettings>(getSiteIdentitySettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState<Record<string, boolean>>({});
  const [faviconError, setFaviconError] = useState(false);

  const update = <K extends keyof SiteIdentitySettings>(key: K, value: SiteIdentitySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    if (["logoUrl", "lightLogoUrl", "darkLogoUrl"].includes(String(key))) setLogoError({});
    if (key === "faviconUrl") setFaviconError(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("siteIdentity", settings);
      setSaved(true);
      setSaving(false);
    }, 350);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SITE_IDENTITY_SETTINGS);
    setLogoError({});
    setFaviconError(false);
    setSaved(false);
  };

  const displayName = settings.siteName.trim() || "WAKILISHA";
  const lightLogo = logoFor(settings, "light");
  const darkLogo = logoFor(settings, "dark");

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Fingerprint" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Site Identity</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Your logo, site name, tagline, and favicon — the face of {displayName} across every page.
        </p>
      </div>

      <WkSurface className="p-0 overflow-hidden">
        <div className="border-b border-[var(--wk-border)] px-4 py-2.5 flex items-center justify-between bg-[var(--wk-surface-raised)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wider">
            <i className="ri-eye-line text-[var(--wk-brand)]" /> Live Navbar Preview
          </div>
          <span className="text-[11px] text-[var(--wk-text-faint)]">Logo colors are never recolored by the app</span>
        </div>
        <div className="grid gap-0 md:grid-cols-2">
          <PreviewBar mode="light" displayName={displayName} logoUrl={lightLogo} onLogoError={() => setLogoError((p) => ({ ...p, light: true }))} logoError={Boolean(logoError.light)} />
          <PreviewBar mode="dark" displayName={displayName} logoUrl={darkLogo} onLogoError={() => setLogoError((p) => ({ ...p, dark: true }))} logoError={Boolean(logoError.dark)} />
        </div>
        {settings.tagline.trim() && (
          <div className="px-6 py-2 bg-[var(--wk-bg)] text-[12px] text-[var(--wk-text-faint)] italic border-t border-[var(--wk-border)]">
            &ldquo;{settings.tagline}&rdquo;
          </div>
        )}
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="Image" size={16} /> Logos
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">
          Add a base logo, then optionally override it per theme. The frontend renders the exact image file and does not invert, tint, or recolor uploaded logos.
        </p>
        <div className="grid gap-4 lg:grid-cols-3">
          <LogoField
            label="Base logo URL"
            description="Fallback used when a light/dark logo is not provided."
            value={settings.logoUrl}
            onChange={(value) => update("logoUrl", value)}
            onSelect={(url) => update("logoUrl", url)}
            error={Boolean(logoError.base)}
            onError={() => setLogoError((p) => ({ ...p, base: true }))}
          />
          <LogoField
            label="Light mode logo URL"
            description="Used when the app is in light mode."
            value={settings.lightLogoUrl}
            fallbackValue={settings.logoUrl}
            onChange={(value) => update("lightLogoUrl", value)}
            onSelect={(url) => update("lightLogoUrl", url)}
            error={Boolean(logoError.lightField)}
            onError={() => setLogoError((p) => ({ ...p, lightField: true }))}
          />
          <LogoField
            label="Dark mode logo URL"
            description="Used when the app is in dark mode."
            value={settings.darkLogoUrl}
            fallbackValue={settings.logoUrl}
            onChange={(value) => update("darkLogoUrl", value)}
            onSelect={(url) => update("darkLogoUrl", url)}
            error={Boolean(logoError.darkField)}
            onError={() => setLogoError((p) => ({ ...p, darkField: true }))}
          />
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="Type" size={16} /> Name & Tagline
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">
          The site name appears in the navbar fallback, browser tab title, and SEO metadata.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Site Name <span className="text-[var(--wk-danger)]">*</span></label>
            <input type="text" value={settings.siteName} onChange={(e) => update("siteName", e.target.value)} placeholder="WAKILISHA" maxLength={60} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] font-bold focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--wk-text-faint)]"><span>Fallback only when no logo is set</span><span>{settings.siteName.length}/60</span></div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Tagline</label>
            <input type="text" value={settings.tagline} onChange={(e) => update("tagline", e.target.value)} placeholder="Documenting and shaping contemporary African culture" maxLength={160} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--wk-text-faint)]"><span>Used in SEO meta description and footer copy</span><span>{settings.tagline.length}/160</span></div>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="Globe" size={16} /> Site Icon (Favicon)
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">The tiny icon that appears in browser tabs and bookmarks. Should be a square image, at least 512&times;512px.</p>
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex h-[56px] w-[56px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] overflow-hidden">
            {settings.faviconUrl && !faviconError ? <img src={settings.faviconUrl} alt="Favicon preview" onError={() => setFaviconError(true)} className="h-8 w-8 object-contain" /> : <span className="text-base font-black text-[var(--wk-text)]">{displayName.charAt(0)}</span>}
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Favicon URL</label>
            <div className="flex gap-2">
              <input type="text" value={settings.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)} placeholder="https://your-cdn.com/favicon-512.png" className={`flex-1 rounded-lg border px-3 py-2.5 text-[13px] font-mono text-[var(--wk-text)] bg-[var(--wk-bg)] focus:outline-none focus:ring-1 ${faviconError ? "border-[var(--wk-danger)] focus:ring-[var(--wk-danger)]" : "border-[var(--wk-border)] focus:border-[var(--wk-brand)] focus:ring-[var(--wk-brand)]"}`} />
              <MediaPickerButton onSelect={(_assetId, url) => update("faviconUrl", url)} title="Select Favicon" label="Library" />
            </div>
            {faviconError && <p className="mt-1.5 text-[11px] text-[var(--wk-danger)] flex items-center gap-1"><i className="ri-error-warning-line" /> Could not load favicon from this URL</p>}
          </div>
        </div>
      </WkSurface>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving || !settings.siteName.trim()} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2 disabled:opacity-50">
          <WkIcon name={saving ? "Loader" : "Save"} size={14} /> {saving ? "Saving..." : "Save Identity"}
        </button>
        <button onClick={handleReset} className="wk-button wk-button-ghost wk-button-sm">Reset to Defaults</button>
        {saved && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]"><WkIcon name="Check" size={14} /> Saved — navbar will update immediately</span>}
      </div>
    </div>
  );
}

function PreviewBar({ mode, displayName, logoUrl, logoError, onLogoError }: { mode: "light" | "dark"; displayName: string; logoUrl: string; logoError: boolean; onLogoError: () => void }) {
  const dark = mode === "dark";
  return (
    <div className={`${dark ? "bg-[#111]" : "bg-white"} border-b border-[var(--wk-border)] px-6 py-3.5 flex items-center gap-6`}>
      <div className="flex items-center gap-2.5 shrink-0 min-w-[150px]">
        {logoUrl && !logoError ? <img src={logoUrl} alt={`${displayName} ${mode} logo`} onError={onLogoError} className="h-8 max-w-[140px] object-contain" /> : <span className={`text-base font-black tracking-tight ${dark ? "text-white" : "text-black"}`}>{displayName}</span>}
      </div>
      <div className="hidden md:flex items-center gap-1 flex-1">
        {["Charts", "Guides", "Artists", "Magazine"].map((l) => <span key={l} className={`px-3.5 py-1.5 text-[13px] font-semibold rounded-full ${dark ? "text-white/70" : "text-black/60"}`}>{l}</span>)}
      </div>
      <div className={`flex items-center gap-2 ${dark ? "text-white/70" : "text-black/60"}`}><i className="ri-search-line" /><i className={dark ? "ri-sun-line" : "ri-moon-line"} /></div>
    </div>
  );
}

function LogoField({ label, description, value, fallbackValue = "", onChange, onSelect, error, onError }: { label: string; description: string; value: string; fallbackValue?: string; onChange: (value: string) => void; onSelect: (url: string) => void; error: boolean; onError: () => void }) {
  const preview = value || fallbackValue;
  return (
    <div className="rounded-xl border border-[var(--wk-border)] p-4">
      <div className="mb-3 flex h-[72px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] overflow-hidden">
        {preview && !error ? <img src={preview} alt={`${label} preview`} onError={onError} className="max-h-12 max-w-[160px] object-contain" /> : <span className="text-[11px] text-[var(--wk-text-faint)]">No logo</span>}
      </div>
      <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">{label}</label>
      <p className="mb-2 text-[11px] leading-5 text-[var(--wk-text-faint)]">{description}</p>
      <div className="flex gap-2">
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://your-cdn.com/logo.svg" className={`min-w-0 flex-1 rounded-lg border px-3 py-2.5 text-[12px] font-mono text-[var(--wk-text)] bg-[var(--wk-bg)] focus:outline-none focus:ring-1 ${error ? "border-[var(--wk-danger)] focus:ring-[var(--wk-danger)]" : "border-[var(--wk-border)] focus:border-[var(--wk-brand)] focus:ring-[var(--wk-brand)]"}`} />
        <MediaPickerButton onSelect={(_assetId, url) => onSelect(url)} title={`Select ${label}`} label="Library" />
      </div>
      {error && <p className="mt-1.5 text-[11px] text-[var(--wk-danger)] flex items-center gap-1"><i className="ri-error-warning-line" /> Could not load this logo</p>}
    </div>
  );
}