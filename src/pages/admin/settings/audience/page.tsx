import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getAudienceSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_AUDIENCE_SETTINGS,
  type AudienceSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsAudience() {
  const [settings, setSettings] = useState<AudienceSettings>(getAudienceSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof AudienceSettings>(key: K, value: AudienceSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("audience", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Users" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Audience</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Subscriber defaults, opt-ins, and follow notifications.</p>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Subscriber Defaults</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Default Opt-In</span>
            <button onClick={() => update("subscriberDefaults", { ...settings.subscriberDefaults, defaultOptIn: !settings.subscriberDefaults.defaultOptIn })} className={`relative h-6 w-11 rounded-full transition-colors ${settings.subscriberDefaults.defaultOptIn ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.subscriberDefaults.defaultOptIn ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Default Briefing Frequency</label>
            <select value={settings.subscriberDefaults.defaultBriefingFrequency} onChange={(e) => update("subscriberDefaults", { ...settings.subscriberDefaults, defaultBriefingFrequency: e.target.value as "weekly" | "biweekly" | "monthly" })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Opt-In Settings</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Require Double Opt-In</span>
            <button onClick={() => update("optInSettings", { ...settings.optInSettings, requireDoubleOptIn: !settings.optInSettings.requireDoubleOptIn })} className={`relative h-6 w-11 rounded-full transition-colors ${settings.optInSettings.requireDoubleOptIn ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.optInSettings.requireDoubleOptIn ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Show Opt-In on Signup</span>
            <button onClick={() => update("optInSettings", { ...settings.optInSettings, showOptInOnSignup: !settings.optInSettings.showOptInOnSignup })} className={`relative h-6 w-11 rounded-full transition-colors ${settings.optInSettings.showOptInOnSignup ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.optInSettings.showOptInOnSignup ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Follow Notifications</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Enabled</span>
            <button onClick={() => update("followNotificationDefaults", { ...settings.followNotificationDefaults, enabled: !settings.followNotificationDefaults.enabled })} className={`relative h-6 w-11 rounded-full transition-colors ${settings.followNotificationDefaults.enabled ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.followNotificationDefaults.enabled ? "translate-x-5.5" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Frequency</label>
            <select value={settings.followNotificationDefaults.frequency} onChange={(e) => update("followNotificationDefaults", { ...settings.followNotificationDefaults, frequency: e.target.value as "immediate" | "daily_digest" | "weekly_digest" })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="immediate">Immediate</option>
              <option value="daily_digest">Daily Digest</option>
              <option value="weekly_digest">Weekly Digest</option>
            </select>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Newsletter Defaults</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Send Day</label>
            <select value={settings.newsletterIssueDefaults.defaultSendDay} onChange={(e) => update("newsletterIssueDefaults", { ...settings.newsletterIssueDefaults, defaultSendDay: e.target.value as "monday" | "friday" })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="monday">Monday</option>
              <option value="friday">Friday</option>
            </select>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Send Time</label>
            <input type="time" value={settings.newsletterIssueDefaults.defaultSendTime} onChange={(e) => update("newsletterIssueDefaults", { ...settings.newsletterIssueDefaults, defaultSendTime: e.target.value })} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
        </div>
      </WkSurface>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
          <WkIcon name={saving ? "Loader" : "Save"} size={14} /> {saving ? "Saving..." : "Save Changes"}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--wk-success)]"><WkIcon name="Check" size={14} /> Saved</span>}
      </div>
    </div>
  );
}