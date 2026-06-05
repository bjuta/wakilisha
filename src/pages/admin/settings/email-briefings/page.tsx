import { useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import {
  getEmailBriefingsSettings,
  saveDomainSettings,
} from "@/services/adminSettings/settingsStore";
import {
  DEFAULT_EMAIL_BRIEFINGS_SETTINGS,
  type EmailBriefingsSettings,
} from "@/services/adminSettings/settingsTypes";

export default function AdminSettingsEmailBriefings() {
  const [settings, setSettings] = useState<EmailBriefingsSettings>(getEmailBriefingsSettings());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const update = <K extends keyof EmailBriefingsSettings>(key: K, value: EmailBriefingsSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      saveDomainSettings("emailBriefings", settings);
      setSaved(true);
      setSaving(false);
    }, 400);
  };

  const handleSendTest = () => {
    setSendingTest(true);
    setTestResult(null);
    setTimeout(() => {
      setSendingTest(false);
      setTestResult(`Test email sent to ${settings.testRecipientEmail || "no recipient configured"}. Check your inbox.`);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <WkIcon name="Mail" size={20} className="text-[var(--wk-brand)]" />
          <h1 className="text-[20px] font-black tracking-tight text-[var(--wk-text)]">Email & Briefings</h1>
        </div>
        <p className="text-[13px] text-[var(--wk-text-muted)]">Email sender settings and briefing configuration.</p>
      </div>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Sender</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">From Name</label>
            <input type="text" value={settings.fromName} onChange={(e) => update("fromName", e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">From Address</label>
            <input type="email" value={settings.fromAddress} onChange={(e) => update("fromAddress", e.target.value)} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Email Types</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Artist Opt-In Weekly Emails</span>
            <button onClick={() => update("enableArtistOptInEmails", !settings.enableArtistOptInEmails)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.enableArtistOptInEmails ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enableArtistOptInEmails ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Follow Notifications</span>
            <button onClick={() => update("enableFollowNotifications", !settings.enableFollowNotifications)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.enableFollowNotifications ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enableFollowNotifications ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2.5">
            <span className="text-[13px] font-semibold text-[var(--wk-text)]">Briefing Issues</span>
            <button onClick={() => update("enableBriefingIssues", !settings.enableBriefingIssues)} className={`relative h-6 w-11 rounded-full transition-colors ${settings.enableBriefingIssues ? "bg-[var(--wk-brand)]" : "bg-[var(--wk-border-2)]"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[var(--wk-surface)] transition-transform ${settings.enableBriefingIssues ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Briefing Cadence</label>
            <select value={settings.briefingSendCadence} onChange={(e) => update("briefingSendCadence", e.target.value as "weekly" | "biweekly" | "monthly")} className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]">
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
      </WkSurface>

      <WkSurface className="p-5">
        <h2 className="text-[14px] font-bold text-[var(--wk-text)] mb-4">Testing</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[12px] font-semibold text-[var(--wk-text-muted)] mb-1.5">Test Recipient Email</label>
            <input type="email" value={settings.testRecipientEmail} onChange={(e) => update("testRecipientEmail", e.target.value)} placeholder="admin@wakilisha.com" className="w-full rounded-lg border border-[var(--wk-border)] bg-[var(--wk-bg)] px-3 py-2 text-[13px] text-[var(--wk-text)] focus:border-[var(--wk-brand)] focus:outline-none focus:ring-1 focus:ring-[var(--wk-brand)]" />
          </div>
          <button onClick={handleSendTest} disabled={sendingTest} className="wk-button wk-button-primary wk-button-sm flex items-center gap-2">
            <WkIcon name={sendingTest ? "Loader" : "Send"} size={14} /> {sendingTest ? "Sending..." : "Send Test"}
          </button>
        </div>
        {testResult && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--wk-success)]/30 bg-[var(--wk-success)]/8 px-3 py-2.5 text-[12px] text-[var(--wk-success)]">
            <WkIcon name="Check" size={14} />
            {testResult}
            <button onClick={() => setTestResult(null)} className="ml-auto text-[var(--wk-success)]/60 hover:text-[var(--wk-success)]">
              <WkIcon name="X" size={13} />
            </button>
          </div>
        )}
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