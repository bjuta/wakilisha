import { useState } from "react";

interface Props {
  onReset: () => void;
}

export function DangerSettingsPane({ onReset }: Props) {
  const [confirming, setConfirming] = useState(false);

  const handleReset = () => {
    onReset();
    setConfirming(false);
  };

  return (
    <div className="p-5 rounded-xl border border-[var(--wk-danger)]/30 bg-[var(--wk-danger-soft)]">
      <div className="flex items-center gap-2 mb-2">
        <i className="ri-error-warning-fill text-base text-[var(--wk-danger)]" />
        <h3 className="text-sm font-black text-[var(--wk-danger)]">Reset all settings</h3>
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--wk-text-muted)] mb-4">
        This clears all locally stored settings across Profile, Appearance, Notifications, Playback, and Privacy.
        It resets everything to WAKILISHA defaults. Supabase-synced data (profile, notification preferences) will be
        restored on next sign-in from the database. This does not delete your account or community content.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="inline-flex items-center gap-2 h-[38px] px-5 rounded-lg text-xs font-bold border border-[var(--wk-danger)]/50 text-[var(--wk-danger)] hover:bg-[var(--wk-danger)]/10 cursor-pointer transition-colors"
        >
          <i className="ri-restart-line" /> Reset local settings
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 h-[38px] px-5 rounded-lg text-xs font-bold bg-[var(--wk-danger)] text-white cursor-pointer hover:opacity-90 transition-opacity"
          >
            <i className="ri-check-line" /> Confirm reset
          </button>
          <button
            onClick={() => setConfirming(false)}
            className="text-[12px] font-bold text-[var(--wk-text-muted)] hover:text-[var(--wk-text)] cursor-pointer transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}