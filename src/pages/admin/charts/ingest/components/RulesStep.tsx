import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ChartEligibilityProfile } from "@/services/chartsEligibility/eligibilityTypes";

const INPUT_CLASS = "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong focus:ring-1 focus:ring-wk-brand/20";
const LABEL_CLASS = "mb-1 block text-[12px] font-semibold text-wk-text-soft";

type RulesStepProps = {
  profiles: ChartEligibilityProfile[];
  selectedEligibilityProfileId: string;
  onSelectEligibilityProfile: (profileId: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

function summarizeProfile(profile: ChartEligibilityProfile): string[] {
  const out: string[] = [];
  const origin = profile.artistOriginEligibility;
  const gender = profile.artistGenderEligibility;
  const type = profile.artistTypeEligibility;
  const track = profile.trackEligibility;
  const collab = profile.collaborationRules;

  if (origin && origin.mode !== "any") out.push(`Origin: ${origin.mode.replace(/_/g, " ")} ${origin.countries.join(", ")}`.trim());
  if (gender && gender.mode !== "any") out.push(`Gender: ${gender.mode.replace(/_/g, " ")}`);
  if (type && type.mode !== "any") out.push(`Artist type: ${type.mode.replace(/_/g, " ")}`);
  if (track?.requireIsrc) out.push("Requires ISRC");
  if (track?.requirePreview) out.push("Requires preview");
  if (collab?.primaryArtistMustMatchEligibility) out.push("Primary artist must match");
  if (collab?.allArtistsMustMatchEligibility) out.push("All credited artists must match");
  if (out.length === 0) out.push("No restrictive eligibility filters");
  return out;
}

export function RulesStep({ profiles, selectedEligibilityProfileId, onSelectEligibilityProfile, onBack, onContinue }: RulesStepProps) {
  const selectedProfile = profiles.find((profile) => profile.id === selectedEligibilityProfileId || profile.slug === selectedEligibilityProfileId) ?? profiles[0];

  return (
    <WkSurface className="p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-[16px] font-bold text-wk-text">Chart Rules</h2>
          <p className="text-[12px] text-wk-text-soft">
            Select the eligibility profile that defines who can appear in this chart. These rules are stored with the run so future eligibility filtering can use WAKILISHA proprietary artist intelligence.
          </p>
        </div>
        <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">Eligibility</span>
      </div>

      <div className="mb-5">
        <label className={LABEL_CLASS}>Eligibility Profile *</label>
        <select value={selectedEligibilityProfileId} onChange={(event) => onSelectEligibilityProfile(event.target.value)} className={INPUT_CLASS}>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>{profile.name} ({profile.slug})</option>
          ))}
        </select>
      </div>

      {selectedProfile && (
        <div className="mb-5 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-[14px] font-bold text-wk-text">{selectedProfile.name}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${selectedProfile.visibility === "public" ? "bg-wk-success-soft text-wk-success" : "bg-wk-warning-soft text-wk-warning"}`}>
              {selectedProfile.visibility === "public" ? "Public label allowed" : "Admin-only rules"}
            </span>
            {selectedProfile.publicLabel && <span className="rounded-full bg-wk-bg px-2 py-0.5 text-[10px] font-semibold text-wk-text-soft">{selectedProfile.publicLabel}</span>}
          </div>
          <p className="mb-3 text-[12px] text-wk-text-soft">{selectedProfile.description}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {summarizeProfile(selectedProfile).map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-lg border border-wk-border bg-wk-surface px-3 py-2 text-[12px] text-wk-text-soft">
                <WkIcon name="CheckCircle2" size={13} className="text-wk-brand" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-wk-bg p-3 text-[11px] text-wk-text-muted">
            <strong className="text-wk-text-soft">Important:</strong> this pass only captures the rule selection. Actual eligibility decisions will activate when the proprietary artist registry and origin ISO2 data are connected.
          </div>
        </div>
      )}

      <div className="mb-5 rounded-xl border border-wk-border bg-wk-bg p-4">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-wk-text">
          <WkIcon name="Database" size={14} className="text-wk-brand" />
          Future rule diagnostics this selection enables
        </div>
        <div className="grid gap-2 text-[11px] text-wk-text-muted sm:grid-cols-2">
          <span>Eligible rows vs excluded rows</span>
          <span>Unknown origin/gender/type review workload</span>
          <span>Foreign collaborator warnings</span>
          <span>Public vs internal-only presentation rules</span>
          <span>Market scope analytics</span>
          <span>Commercial readiness checks</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-wk-divider pt-4">
        <button onClick={onContinue} className="inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-5 py-2.5 text-[13px] font-semibold text-wk-brand-on transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap">
          <WkIcon name="ArrowRight" size={14} />Continue to Sources & Dry Run
        </button>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap">
          <WkIcon name="ArrowLeft" size={14} />Back to Program
        </button>
      </div>
    </WkSurface>
  );
}
