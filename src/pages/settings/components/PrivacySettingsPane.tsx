import { WakilishaToggle } from "@/components/design-system/primitives/WakilishaToggle";
import type { UserProfileFields, UserPrivacyPrefs } from "@/hooks/useUserSettings";

interface Props {
  privacy: UserPrivacyPrefs;
  profile: UserProfileFields;
  isSignedIn: boolean;
  updatePrivacy: (patch: Partial<UserPrivacyPrefs>) => void;
  updateProfile: (patch: Partial<UserProfileFields>) => void;
}

export function PrivacySettingsPane({ privacy, profile, isSignedIn, updatePrivacy, updateProfile }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Public profile</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Allow other WAKILISHA readers to view your public profile, saved items, and comments. When off, your profile is visible only to you.</div>
        </div>
        <WakilishaToggle value={profile.isPublic} onChange={(v) => updateProfile({ isPublic: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Private listening history</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Keep your listening activity private unless you explicitly share a track or chart.</div>
        </div>
        <WakilishaToggle value={privacy.privateListening} onChange={(v) => updatePrivacy({ privateListening: v })} />
      </div>
      <div className="flex items-center justify-between gap-4 py-4 border-b border-[var(--wk-divider)] last:border-b-0">
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold text-[var(--wk-text)]">Analytics consent</div>
          <div className="text-[11px] leading-relaxed text-[var(--wk-text-muted)] mt-0.5">Allow anonymized product analytics to improve recommendations, search quality, and interface design. No personal listening data is shared.</div>
        </div>
        <WakilishaToggle value={privacy.analyticsConsent} onChange={(v) => updatePrivacy({ analyticsConsent: v })} />
      </div>

      <div className="mt-6 p-4 rounded-xl border border-[var(--wk-border)] bg-[var(--wk-bg-subtle)]">
        <div className="flex items-center gap-2 mb-2">
          <i className="ri-shield-check-line text-base text-[var(--wk-text-muted)]" />
          <span className="text-[12px] font-black text-[var(--wk-text)]">Data transparency</span>
        </div>
        <p className="text-[11px] leading-relaxed text-[var(--wk-text-muted)]">
          WAKILISHA never sells personal data. Your profile information is only used to personalize your experience.
          Community contributions (comments, saves, reactions) are associated with your profile and visible based on
          your public profile setting above. You can request data export or deletion by contacting our team.
        </p>
        <div className="flex items-center gap-4 mt-3">
          <a href="/privacy" className="text-[11px] font-bold text-[var(--wk-brand)] hover:underline">
            Privacy policy
          </a>
          <a href="/terms" className="text-[11px] font-bold text-[var(--wk-text-muted)] hover:underline">
            Terms of service
          </a>
        </div>
      </div>
    </div>
  );
}