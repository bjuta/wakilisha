import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getPlayerPlaybackSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_PLAYER_PLAYBACK_SETTINGS,
  type PlayerPlaybackSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsPlayerPlayback() {
  const [settings, setSettings] = useState<PlayerPlaybackSettings>(getPlayerPlaybackSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof PlayerPlaybackSettings>(key: K, value: PlayerPlaybackSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("playerPlayback", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleReset = () => {
    setSettings(DEFAULT_PLAYER_PLAYBACK_SETTINGS);
    setSaved(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Play" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Player & Playback</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">
          Preview source defaults and player behavior across charts, tracks, releases, and artists.
        </p>
      </div>

      {/* Preview Sources */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="Music" size={16} />
          Preview Sources
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Preview Source Mode</label>
            <select
              value={settings.previewSourceMode}
              onChange={(e) => update("previewSourceMode", e.target.value as "auto" | "spotify" | "apple" | "youtube" | "acrcloud")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="auto">Auto (fallback chain)</option>
              <option value="spotify">Spotify</option>
              <option value="apple">Apple Music</option>
              <option value="youtube">YouTube</option>
              <option value="acrcloud">ACRCloud</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Desktop Player Variant</label>
            <select
              value={settings.desktopPlayerVariant}
              onChange={(e) => update("desktopPlayerVariant", e.target.value as "compact" | "full" | "minimal")}
              className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]"
            >
              <option value="compact">Compact</option>
              <option value="full">Full</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>
        </div>
      </WkSurface>

      {/* Preferences */}
      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4 flex items-center gap-2">
          <WkIcon name="SlidersHorizontal" size={16} />
          Preferences
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ToggleField label="Prefer Spotify Previews" value={settings.preferSpotifyPreviews} onChange={(v) => update("preferSpotifyPreviews", v)} />
          <ToggleField label="Prefer Apple Previews" value={settings.preferApplePreviews} onChange={(v) => update("preferApplePreviews", v)} />
          <ToggleField label="Fallback to YouTube Embeds" value={settings.fallbackToYouTubeEmbeds} onChange={(v) => update("fallbackToYouTubeEmbeds", v)} />
          <ToggleField label="Fallback to ACRCloud Preview" value={settings.fallbackToAcrcloudPreview} onChange={(v) => update("fallbackToAcrcloudPreview", v)} />
          <ToggleField label="Apple Playback Connected" value={settings.applePlaybackConnected} onChange={(v) => update("applePlaybackConnected", v)} />
          <ToggleField label="Enable Visual Motion by Default" value={settings.enableVisualMotionByDefault} onChange={(v) => update("enableVisualMotionByDefault", v)} />
          <ToggleField label="Audible UI Mode Default" value={settings.audibleUiModeDefault} onChange={(v) => update("audibleUiModeDefault", v)} />
          <ToggleField label="Enable Hover Sounds" value={settings.enableHoverSounds} onChange={(v) => update("enableHoverSounds", v)} />
        </div>
      </WkSurface>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
          <WkIcon name={saving ? "Loader" : "Save"} size={14} />
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button onClick={handleReset} className="wk-button wk-button-ghost wk-button-sm">Reset to Defaults</button>
        {saved && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]"><WkIcon name="Check" size={14} /> Saved</span>}
      </div>

      {/* Note */}
      <WkSurface className="p-4 border-l-4 border-[var(--wk-info)]">
        <div className="flex items-start gap-3">
          <WkIcon name="Info" size={18} className="text-[var(--wk-info)] mt-0.5" />
          <div>
            <h3 className="text-[13px] font-bold text-[var(--wk-text)]">Note</h3>
            <p className="text-[12px] text-[var(--wk-text-muted)] mt-1">
              Player settings power real playback/preview behavior across charts, tracks, releases, artists, and other WAKILISHA domains.
              <strong> /play is not coming back.</strong> Player settings feed the real platform player.
            </p>
          </div>
        </div>
      </WkSurface>
    </div>
  );
}

function ToggleField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
      <span className="text-[13px] font-semibold text-[var(--wk-text)]">{label}</span>
      <button onClick={() => onChange(!value)} className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${value ? "translate-x-[22px]" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}