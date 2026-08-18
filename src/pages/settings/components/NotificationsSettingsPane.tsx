import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import type { UserNotificationPrefs } from "@/hooks/useUserSettings";

interface Props {
  notifications: UserNotificationPrefs;
  isSignedIn: boolean;
  updateNotifications: (patch: Partial<UserNotificationPrefs>) => void;
}

export function NotificationsSettingsPane({ notifications, isSignedIn, updateNotifications }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Weekly email digest</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">A calm weekly summary of charts, essays, releases, and artist movements.</div>
        </div>
        <WakilishaToggle value={notifications.emailDigest} onChange={(v) => updateNotifications({ emailDigest: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Chart movement alerts</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Notify when followed artists enter, climb, or top a WAKILISHA chart.</div>
        </div>
        <WakilishaToggle value={notifications.chartAlerts} onChange={(v) => updateNotifications({ chartAlerts: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Artist release alerts</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Notify when followed artists or labels publish new tracks and releases.</div>
        </div>
        <WakilishaToggle value={notifications.artistDrops} onChange={(v) => updateNotifications({ artistDrops: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Reply notifications</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Get notified when someone replies to your comments or threads.</div>
        </div>
        <WakilishaToggle value={notifications.replyNotifications} onChange={(v) => updateNotifications({ replyNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Mention notifications</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Get notified when someone @mentions you in a Post or comment.</div>
        </div>
        <WakilishaToggle value={notifications.mentionNotifications} onChange={(v) => updateNotifications({ mentionNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Follow notifications</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Get notified when someone follows your WAKILISHA profile.</div>
        </div>
        <WakilishaToggle value={notifications.followNotifications} onChange={(v) => updateNotifications({ followNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Contribution alerts</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Get notified when your community contributions get approved or reviewed.</div>
        </div>
        <WakilishaToggle value={notifications.contributionNotifications} onChange={(v) => updateNotifications({ contributionNotifications: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Marketing emails</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Occasional news about WAKILISHA features, events, and partnerships.</div>
        </div>
        <WakilishaToggle value={notifications.marketingEmails} onChange={(v) => updateNotifications({ marketingEmails: v })} />
      </div>
      {!isSignedIn && (
        <div className="mt-4 p-3 rounded-lg bg-[var(--wk-warning-soft)] border border-[var(--wk-warning)]/20 text-[11px] text-[var(--wk-text-muted)]">
          <i className="ri-information-line mr-1.5" />
          Sign in to sync notification preferences across devices via your WAKILISHA account.
        </div>
      )}
    </div>
  );
}