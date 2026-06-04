import { useEffect, useRef, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import { getSiteIdentitySettings, saveDomainSettings } from "@/services/adminSettings/settingsStore";
import { DEFAULT_SITE_IDENTITY_SETTINGS, type SiteIdentitySettings } from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsSiteIdentity() {
  const [settings, setSettings] = useState<SiteIdentitySettings>(getSiteIdentitySettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof SiteIdentitySettings>(key: K, value: SiteIdentitySettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    if (key === "logoUrl") setLogoError(false);
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
    setLogoError(false);
    setFaviconError(false);
    setSaved(false);
  };

  // Derive display values for live preview
  const displayName = settings.siteName.trim() || "WAKILISHA";
  const showLogo = settings.logoUrl.trim().length > 0 && !logoError;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Fingerprint" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Site Identity</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Your logo, site name, tagline, and favicon — the face of {displayName} across every page.
        </p>
      </div>

      {/* Live Navbar Preview */}
      <WkSurface className="p-0 overflow-hidden">
        <div className="border-b border-[var(--wk-border)] px-4 py-2.5 flex items-center justify-between bg-[var(--wk-surface-raised)]">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--wk-text-muted)] uppercase tracking-wider">
            <i className="ri-eye-line text-[var(--wk-brand)]" />
            Live Navbar Preview
          </div>
          <span className="text-[11px] text-[var(--wk-text-faint)]">Updates as you type</span>
        </div>
        {/* Simulated navbar */}
        <div className="bg-[var(--wk-surface)] border-b border-[var(--wk-border)] px-6 py-3.5 flex items-center gap-6">
          {/* Logo mark */}
          <div className="flex items-center gap-2.5 shrink-0">
            {showLogo ? (
              <img
                src={settings.logoUrl}
                alt={displayName}
                onError={() => setLogoError(true)}
                className="h-8 max-w-[120px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-md bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-sm font-black leading-none">
                  {displayName.charAt(0)}
                </span>
                <span className="hidden sm:block text-base font-black tracking-tight text-[var(--wk-text)]">
                  {displayName}
                </span>
              </div>
            )}
          </div>
          {/* Fake nav links */}
          <div className="hidden md:flex items-center gap-1 flex-1">
            {["Charts", "Guides", "Artists", "Magazine"].map((l) => (
              <span key={l} className="px-3.5 py-1.5 text-[13px] font-semibold text-[var(--wk-text-muted)] rounded-full">
                {l}
              </span>
            ))}
          </div>
          {/* Admin button fake */}
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-[var(--wk-border-2)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--wk-text-muted)]">
            Admin <i className="ri-arrow-right-up-line text-[10px]" />
          </span>
        </div>
        {/* Tagline preview strip */}
        {settings.tagline.trim() && (
          <div className="px-6 py-2 bg-[var(--wk-bg)] text-[12px] text-[var(--wk-text-faint)] italic border-t border-[var(--wk-border)]">
            &ldquo;{settings.tagline}&rdquo;
          </div>
        )}
      </WkSurface>

      {/* Logo */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="Image" size={16} />
          Logo
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">
          Provide a URL to your logo image. SVG or PNG with transparent background recommended.
          If left empty, the letter-mark fallback is used.
        </p>
        <div className="flex items-start gap-4">
          {/* Logo preview box */}
          <div className="shrink-0 flex h-[72px] w-[160px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] overflow-hidden">
            {showLogo ? (
              <img
                src={settings.logoUrl}
                alt="Logo preview"
                onError={() => setLogoError(true)}
                className="max-h-12 max-w-[130px] object-contain"
              />
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-base font-black">
                  {displayName.charAt(0)}
                </span>
                <span className="text-[13px] font-black text-[var(--wk-text-muted)]">
                  {displayName.slice(0, 8)}
                </span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Logo URL</label>
            <input
              ref={logoInputRef}
              type="text"
              value={settings.logoUrl}
              onChange={(e) => update("logoUrl", e.target.value)}
              placeholder="https://your-cdn.com/wakilisha-logo.svg"
              className={`w-full rounded-lg border px-3 py-2.5 text-[13px] font-mono text-[var(--wk-text)] bg-[var(--wk-bg)] focus:outline-none focus:ring-1 ${
                logoError
                  ? "border-[var(--wk-danger)] focus:ring-[var(--wk-danger)]"
                  : "border-[var(--wk-border)] focus:border-[var(--wk-brand)] focus:ring-[var(--wk-brand)]"
              }`}
            />
            {logoError && (
              <p className="mt-1.5 text-[11px] text-[var(--wk-danger)] flex items-center gap-1">
                <i className="ri-error-warning-line" /> Could not load image from this URL
              </p>
            )}
            {settings.logoUrl && !logoError && (
              <p className="mt-1.5 text-[11px] text-[var(--wk-success)] flex items-center gap-1">
                <i className="ri-check-line" /> Logo loaded successfully
              </p>
            )}
            <p className="mt-2 text-[11px] text-[var(--wk-text-faint)]">
              Tip: Use a horizontal lockup at ~160&times;40px or smaller. SVG scales perfectly at any size.
            </p>
          </div>
        </div>
      </WkSurface>

      {/* Site Name + Tagline */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="Type" size={16} />
          Name &amp; Tagline
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">
          The site name appears in the navbar fallback, browser tab title, and SEO metadata.
          The tagline is used in meta descriptions and footer.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">
              Site Name <span className="text-[var(--wk-danger)]">*</span>
            </label>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => update("siteName", e.target.value)}
              placeholder="WAKILISHA"
              maxLength={60}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] font-bold focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--wk-text-faint)]">
              <span>Used in navbar fallback when no logo set</span>
              <span>{settings.siteName.length}/60</span>
            </div>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Tagline</label>
            <input
              type="text"
              value={settings.tagline}
              onChange={(e) => update("tagline", e.target.value)}
              placeholder="Documenting and shaping contemporary African culture"
              maxLength={160}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            />
            <div className="mt-1 flex justify-between text-[10px] text-[var(--wk-text-faint)]">
              <span>Used in SEO meta description and footer copy</span>
              <span>{settings.tagline.length}/160</span>
            </div>
          </div>
        </div>
      </WkSurface>

      {/* Favicon */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-1 flex items-center gap-2">
          <WkIcon name="Globe" size={16} />
          Site Icon (Favicon)
        </h2>
        <p className="text-[12px] text-[var(--wk-text-muted)] mb-4">
          The tiny icon that appears in browser tabs and bookmarks. Should be a square image, at least 512&times;512px.
        </p>
        <div className="flex items-start gap-4">
          <div className="shrink-0 flex h-[56px] w-[56px] items-center justify-center rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg)] overflow-hidden">
            {settings.faviconUrl && !faviconError ? (
              <img
                src={settings.faviconUrl}
                alt="Favicon preview"
                onError={() => setFaviconError(true)}
                className="h-8 w-8 object-contain"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--wk-brand)] text-[var(--wk-brand-on)] text-base font-black">
                {displayName.charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Favicon URL</label>
            <input
              type="text"
              value={settings.faviconUrl}
              onChange={(e) => update("faviconUrl", e.target.value)}
              placeholder="https://your-cdn.com/favicon-512.png"
              className={`w-full rounded-lg border px-3 py-2.5 text-[13px] font-mono text-[var(--wk-text)] bg-[var(--wk-bg)] focus:outline-none focus:ring-1 ${
                faviconError
                  ? "border-[var(--wk-danger)] focus:ring-[var(--wk-danger)]"
                  : "border-[var(--wk-border)] focus:border-[var(--wk-brand)] focus:ring-[var(--wk-brand)]"
              }`}
            />
            {faviconError && (
              <p className="mt-1.5 text-[11px] text-[var(--wk-danger)] flex items-center gap-1">
                <i className="ri-error-warning-line" /> Could not load favicon from this URL
              </p>
            )}
            <p className="mt-2 text-[11px] text-[var(--wk-text-faint)]">
              The favicon is set in <code className="rounded bg-[var(--wk-surface-raised)] px-1 py-0.5 font-mono text-[10px]">index.html</code>.
              Once you have the URL, a developer can add it as <code className="rounded bg-[var(--wk-surface-raised)] px-1 py-0.5 font-mono text-[10px]">&lt;link rel=&ldquo;icon&rdquo;&gt;</code>.
            </p>
          </div>
        </div>
      </WkSurface>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !settings.siteName.trim()}
          className="wk-button wk-button-primary wk-button-sm flex items-center gap-2 disabled:opacity-50"
        >
          <WkIcon name={saving ? "Loader" : "Save"} size={14} />
          {saving ? "Saving..." : "Save Identity"}
        </button>
        <button
          onClick={handleReset}
          className="wk-button wk-button-ghost wk-button-sm"
        >
          Reset to Defaults
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]">
            <WkIcon name="Check" size={14} /> Saved — navbar will update immediately
          </span>
        )}
      </div>
    </div>
  );
}