import { useEffect, useMemo, useState } from "react";
import { useTheme, type ThemeMode } from "@/components/design-system/theme/ThemeProvider";
import { WkIcon } from "@/components/design-system/Icon";

type SettingsTab = "Account" | "Appearance" | "Notifications" | "Privacy" | "Playback" | "Danger";

type SettingsState = {
  displayName: string;
  handle: string;
  bio: string;
  email: string;
  theme: ThemeMode;
  density: "Comfortable" | "Compact";
  accent: string;
  emailDigest: boolean;
  chartAlerts: boolean;
  artistDrops: boolean;
  privateListening: boolean;
  publicProfile: boolean;
  analyticsConsent: boolean;
  autoplay: boolean;
  explicitFilter: boolean;
  playbackQuality: "Auto" | "High" | "Data saver";
};

const STORAGE_KEY = "wk-user-settings-v1";
const tabs: { key: SettingsTab; icon: any }[] = [
  { key: "Account", icon: "UserRound" },
  { key: "Appearance", icon: "Palette" },
  { key: "Notifications", icon: "Bell" },
  { key: "Privacy", icon: "ShieldCheck" },
  { key: "Playback", icon: "Headphones" },
  { key: "Danger", icon: "TriangleAlert" },
];

const defaultSettings: SettingsState = {
  displayName: "Akinyi Odhiambo",
  handle: "akinyi",
  bio: "Music journalist based in Nairobi. Writing about East African music, culture, and the stories behind the sounds.",
  email: "akinyi@wakilisha.africa",
  theme: "dark",
  density: "Comfortable",
  accent: "#84C241",
  emailDigest: true,
  chartAlerts: true,
  artistDrops: true,
  privateListening: true,
  publicProfile: true,
  analyticsConsent: false,
  autoplay: false,
  explicitFilter: false,
  playbackQuality: "Auto",
};

const accentOptions = ["#84C241", "#D6766A", "#C7A06D", "#E8A23A", "#6BA8F5", "#9C8FF5"];

function loadSettings(theme: ThemeMode): SettingsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw), theme };
  } catch {
    /* storage unavailable */
  }
  return { ...defaultSettings, theme };
}

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [active, setActive] = useState<SettingsTab>("Account");
  const [settings, setSettings] = useState<SettingsState>(() => loadSettings(theme));
  const [savedSettings, setSavedSettings] = useState<SettingsState>(() => loadSettings(theme));

  useEffect(() => {
    setSettings((current) => ({ ...current, theme }));
    setSavedSettings((current) => ({ ...current, theme }));
  }, [theme]);

  const dirty = useMemo(() => JSON.stringify(settings) !== JSON.stringify(savedSettings), [settings, savedSettings]);

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
    if (key === "theme") setTheme(value as ThemeMode);
  };

  const save = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
    setSavedSettings(settings);
  };

  const reset = () => {
    const next = { ...defaultSettings, theme };
    setSettings(next);
    setSavedSettings(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  return (
    <main className="settings49-shell">
      <div className="settings49-wrap">
        <section className="settings49-hero">
          <div className="settings49-kicker"><WkIcon name="Settings" size={14} /> Account controls</div>
          <h1 className="settings49-title">Settings</h1>
          <p className="settings49-sub">Manage profile identity, appearance, notifications, privacy, playback, and account actions from one place. Changes persist locally now and can be wired to authenticated user preferences later.</p>
        </section>

        <div className="settings49-layout">
          <nav className="settings49-nav" aria-label="Settings sections">
            {tabs.map((tab) => (
              <button key={tab.key} className={`settings49-nav-item ${active === tab.key ? "active" : ""}`} onClick={() => setActive(tab.key)}>
                <span className="settings49-nav-icon"><WkIcon name={tab.icon} size={16} /></span>
                {tab.key}
              </button>
            ))}
          </nav>

          <section className="settings49-pane">
            <PaneHead active={active} />
            {active === "Account" && <AccountPane settings={settings} update={update} />}
            {active === "Appearance" && <AppearancePane settings={settings} update={update} />}
            {active === "Notifications" && <NotificationsPane settings={settings} update={update} />}
            {active === "Privacy" && <PrivacyPane settings={settings} update={update} />}
            {active === "Playback" && <PlaybackPane settings={settings} update={update} />}
            {active === "Danger" && <DangerPane reset={reset} />}

            <div className="settings49-savebar">
              <div className={dirty ? "settings49-unsaved" : "settings49-saved"}>
                <WkIcon name={dirty ? "CircleAlert" : "CircleCheck"} size={14} /> {dirty ? "Unsaved changes" : "Saved"}
              </div>
              <div className="flex gap-2">
                <button className="wk-button wk-button-sm wk-button-ghost" onClick={() => setSettings(savedSettings)} disabled={!dirty}>Discard</button>
                <button className="wk-button wk-button-sm wk-button-primary" onClick={save} disabled={!dirty}>Save changes</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function PaneHead({ active }: { active: SettingsTab }) {
  const desc: Record<SettingsTab, string> = {
    Account: "Public identity and profile information shown around WAKILISHA.",
    Appearance: "Theme, density, and color preferences for the product interface.",
    Notifications: "Decide which cultural signals deserve to interrupt you.",
    Privacy: "Control profile visibility, listening history, and analytics consent.",
    Playback: "Tune the player behavior for chart listening and source playback.",
    Danger: "Account reset and destructive actions live here, away from everyday settings.",
  };
  return <div className="settings49-pane-head"><div><h2 className="settings49-pane-title">{active}</h2><p className="settings49-pane-desc">{desc[active]}</p></div></div>;
}

function AccountPane({ settings, update }: { settings: SettingsState; update: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void }) {
  return <div><div className="settings49-profile-card"><div className="settings49-profile-avatar"><img src="https://picsum.photos/seed/profile-ava-1/160/160" alt="" /></div><div><div className="settings49-profile-name">{settings.displayName}</div><div className="settings49-profile-sub">@{settings.handle} · {settings.email}</div></div></div><div className="settings49-input-grid"><Field label="Display name" value={settings.displayName} onChange={(v) => update("displayName", v)} /><Field label="Handle" value={settings.handle} onChange={(v) => update("handle", v.replace(/^@/, ""))} /><Field label="Email" value={settings.email} onChange={(v) => update("email", v)} /><div className="settings49-field full"><label className="settings49-label">Bio</label><textarea className="settings49-textarea" value={settings.bio} onChange={(e) => update("bio", e.target.value)} /></div></div></div>;
}

function AppearancePane({ settings, update }: { settings: SettingsState; update: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void }) {
  return <div><div className="settings49-section"><div className="settings49-section-title">Theme</div><p className="settings49-section-desc">Theme updates the actual app theme immediately through the existing ThemeProvider.</p><div className="settings49-option-grid"><button className={`settings49-option ${settings.theme === "dark" ? "active" : ""}`} onClick={() => update("theme", "dark")}><div className="settings49-option-title">Dark</div><div className="settings49-option-desc">Default cinematic WAKILISHA interface.</div></button><button className={`settings49-option ${settings.theme === "light" ? "active" : ""}`} onClick={() => update("theme", "light")}><div className="settings49-option-title">Light</div><div className="settings49-option-desc">Readable daytime surface using light tokens.</div></button></div></div><div className="settings49-section"><div className="settings49-section-title">Accent color</div><p className="settings49-section-desc">Stored preference for future sub-brand personalization.</p><div className="settings49-color-row">{accentOptions.map((color) => <button key={color} className={`settings49-color ${settings.accent === color ? "active" : ""}`} style={{ background: color }} onClick={() => update("accent", color)} aria-label={`Use accent ${color}`} />)}</div></div><Row label="Interface density" desc="Choose how tightly content rows and editorial cards should render."><select className="settings49-select" value={settings.density} onChange={(e) => update("density", e.target.value as SettingsState["density"])}><option>Comfortable</option><option>Compact</option></select></Row></div>;
}

function NotificationsPane({ settings, update }: { settings: SettingsState; update: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void }) {
  return <div><ToggleRow label="Weekly email digest" desc="A calm weekly summary of charts, essays, releases, and artist movements." checked={settings.emailDigest} onChange={(v) => update("emailDigest", v)} /><ToggleRow label="Chart movement alerts" desc="Notify when followed artists enter, climb, or top a WAKILISHA chart." checked={settings.chartAlerts} onChange={(v) => update("chartAlerts", v)} /><ToggleRow label="Artist release alerts" desc="Notify when followed artists or labels publish new tracks/releases." checked={settings.artistDrops} onChange={(v) => update("artistDrops", v)} /></div>;
}

function PrivacyPane({ settings, update }: { settings: SettingsState; update: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void }) {
  return <div><ToggleRow label="Private listening history" desc="Keep listening activity hidden unless explicitly shared." checked={settings.privateListening} onChange={(v) => update("privateListening", v)} /><ToggleRow label="Public profile" desc="Allow people to view public articles, playlists, and followed artists." checked={settings.publicProfile} onChange={(v) => update("publicProfile", v)} /><ToggleRow label="Analytics consent" desc="Allow anonymized product analytics to improve recommendations and interface quality." checked={settings.analyticsConsent} onChange={(v) => update("analyticsConsent", v)} /></div>;
}

function PlaybackPane({ settings, update }: { settings: SettingsState; update: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void }) {
  return <div><ToggleRow label="Autoplay next track" desc="Continue through chart editions and playlist queues automatically." checked={settings.autoplay} onChange={(v) => update("autoplay", v)} /><ToggleRow label="Explicit content filter" desc="Hide tracks marked explicit from public or family-safe modes." checked={settings.explicitFilter} onChange={(v) => update("explicitFilter", v)} /><Row label="Playback quality" desc="Choose the default stream quality for embedded/source playback."><select className="settings49-select" value={settings.playbackQuality} onChange={(e) => update("playbackQuality", e.target.value as SettingsState["playbackQuality"])}><option>Auto</option><option>High</option><option>Data saver</option></select></Row></div>;
}

function DangerPane({ reset }: { reset: () => void }) {
  return <div className="settings49-danger"><div className="settings49-danger-title">Reset local settings</div><p className="settings49-danger-copy">This clears the settings stored in this browser and returns everything to the default WAKILISHA state. It does not delete an account.</p><button className="wk-button wk-button-sm wk-button-danger" onClick={reset}><WkIcon name="RotateCcw" size={14} /> Reset local settings</button></div>;
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <div className="settings49-field"><label className="settings49-label">{label}</label><input className="settings49-input" value={value} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return <div className="settings49-row"><div className="settings49-row-left"><div className="settings49-row-label">{label}</div><div className="settings49-row-desc">{desc}</div></div>{children}</div>;
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <Row label={label} desc={desc}><button className={`settings49-toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)} aria-pressed={checked} /></Row>;
}
