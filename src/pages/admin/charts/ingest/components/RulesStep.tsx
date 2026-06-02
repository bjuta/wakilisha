import { useMemo, useState } from "react";
import { WkIcon } from "@/components/design-system/Icon";
import { WkSurface } from "@/components/design-system/primitives/Surface";
import type { ChartEligibilityProfile, ArtistGenderEligibilityMode, ArtistTypeEligibilityMode, ReleaseTypeEligibility } from "@/services/chartsEligibility/eligibilityTypes";
import { createEligibilityProfile, getEligibilityProfiles } from "@/services/chartsEligibility/eligibilityStore";

const INPUT_CLASS = "w-full rounded-md border border-wk-border bg-wk-surface px-3 py-2 text-[13px] text-wk-text outline-none focus:border-wk-border-strong focus:ring-1 focus:ring-wk-brand/20";
const LABEL_CLASS = "mb-1 block text-[12px] font-semibold text-wk-text-soft";
const COUNTRY_OPTIONS = ["KE", "UG", "TZ", "NG", "GH", "ZA", "RW", "BI", "ET", "SO"];
const RELEASE_TYPES: ReleaseTypeEligibility[] = ["single", "ep", "album", "mixtape", "compilation", "video", "live"];

type RulesStepProps = {
  profiles: ChartEligibilityProfile[];
  selectedEligibilityProfileId: string;
  onSelectEligibilityProfile: (profileId: string) => void;
  onBack: () => void;
  onContinue: () => void;
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function Toggle({ checked, onChange, label, help }: { checked: boolean; onChange: (checked: boolean) => void; label: string; help?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-wk-border bg-wk-surface px-3 py-3 hover:bg-wk-surface-raised transition-colors">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-wk-border accent-wk-brand" />
      <span>
        <span className="block text-[12px] font-semibold text-wk-text-soft">{label}</span>
        {help && <span className="mt-0.5 block text-[11px] text-wk-text-muted">{help}</span>}
      </span>
    </label>
  );
}

export function RulesStep({ profiles, selectedEligibilityProfileId, onSelectEligibilityProfile, onBack, onContinue }: RulesStepProps) {
  const [localProfiles, setLocalProfiles] = useState<ChartEligibilityProfile[]>(profiles.length ? profiles : getEligibilityProfiles());
  const [profileName, setProfileName] = useState("Custom chart eligibility");
  const [profileSlug, setProfileSlug] = useState("custom-chart-eligibility");
  const [visibility, setVisibility] = useState<"public" | "admin_only">("admin_only");
  const [originMode, setOriginMode] = useState<"any" | "country_only" | "multi_country">("any");
  const [originCountries, setOriginCountries] = useState<string[]>(["KE"]);
  const [genderMode, setGenderMode] = useState<ArtistGenderEligibilityMode>("any");
  const [artistTypeMode, setArtistTypeMode] = useState<ArtistTypeEligibilityMode>("any");
  const [releaseDateFrom, setReleaseDateFrom] = useState("");
  const [releaseDateTo, setReleaseDateTo] = useState("");
  const [releaseTypes, setReleaseTypes] = useState<ReleaseTypeEligibility[]>(["single", "ep", "album", "mixtape", "compilation"]);
  const [requireIsrc, setRequireIsrc] = useState(false);
  const [requirePreview, setRequirePreview] = useState(false);
  const [explicitAllowed, setExplicitAllowed] = useState(true);
  const [primaryArtistMustMatch, setPrimaryArtistMustMatch] = useState(true);
  const [allArtistsMustMatch, setAllArtistsMustMatch] = useState(false);
  const [allowFeaturedArtists, setAllowFeaturedArtists] = useState(true);
  const [unknownMetadataPolicy, setUnknownMetadataPolicy] = useState<"warning" | "review">("review");
  const [error, setError] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => localProfiles.find((profile) => profile.id === selectedEligibilityProfileId || profile.slug === selectedEligibilityProfileId),
    [localProfiles, selectedEligibilityProfileId]
  );

  function toggleCountry(country: string) {
    setOriginCountries((current) => current.includes(country) ? current.filter((item) => item !== country) : [...current, country]);
  }

  function toggleReleaseType(type: ReleaseTypeEligibility) {
    setReleaseTypes((current) => current.includes(type) ? current.filter((item) => item !== type) : [...current, type]);
  }

  function buildDescription() {
    const parts: string[] = [];
    if (originMode !== "any") parts.push(`artist origin ${originCountries.join(" + ")}`);
    if (genderMode !== "any") parts.push(genderMode.replace(/_/g, " "));
    if (artistTypeMode !== "any") parts.push(artistTypeMode.replace(/_/g, " "));
    if (releaseDateFrom || releaseDateTo) parts.push(`released ${releaseDateFrom || "…"} to ${releaseDateTo || "…"}`);
    if (releaseTypes.length) parts.push(`release types: ${releaseTypes.join(", ")}`);
    return parts.length ? `Custom eligibility profile: ${parts.join("; ")}.` : "Custom eligibility profile with no restrictive filters.";
  }

  function createRuleProfile() {
    const name = profileName.trim();
    const slug = slugify(profileSlug || name);
    if (!name) { setError("Profile name is required."); return; }
    if (!slug) { setError("Profile slug is required."); return; }
    if (originMode !== "any" && originCountries.length === 0) { setError("Select at least one eligible origin country."); return; }
    if (releaseTypes.length === 0) { setError("Select at least one eligible release type."); return; }

    try {
      const created = createEligibilityProfile({
        name,
        slug,
        description: buildDescription(),
        visibility,
        publicLabel: visibility === "public" ? name : undefined,
        artistGenderEligibility: { mode: genderMode },
        artistTypeEligibility: { mode: artistTypeMode },
        artistOriginEligibility: {
          mode: originMode,
          countries: originMode === "any" ? [] : originCountries,
          regions: [],
        },
        releaseEligibility: {
          releaseTypes,
          releaseDateFrom: releaseDateFrom || undefined,
          releaseDateTo: releaseDateTo || undefined,
          includeReissues: true,
          includeRemixes: true,
          includeAcousticVersions: true,
          includeInstrumentals: true,
        },
        trackEligibility: {
          explicitAllowed,
          requireIsrc,
          requirePreview,
        },
        collaborationRules: {
          allowFeaturedArtists,
          countFeaturedArtistNationality: allArtistsMustMatch,
          primaryArtistMustMatchEligibility: primaryArtistMustMatch,
          allArtistsMustMatchEligibility: allArtistsMustMatch,
        },
        sourceRules: {
          allowedProviders: ["spotify", "apple_music", "youtube", "airplay", "manual", "registry"],
          requireAtLeastOneProviderId: false,
          requireProviderAvailabilityInMarket: false,
        },
        reviewRules: {
          requireManualReviewForUnknownGender: genderMode !== "any" && unknownMetadataPolicy === "review",
          requireManualReviewForUnknownNationality: originMode !== "any" && unknownMetadataPolicy === "review",
          requireManualReviewForUnknownArtistType: artistTypeMode !== "any" && unknownMetadataPolicy === "review",
          requireManualReviewForGroups: artistTypeMode === "groups_collectives_only",
          allowUnknownMetadataWithWarning: unknownMetadataPolicy === "warning",
        },
      });
      setLocalProfiles(getEligibilityProfiles());
      onSelectEligibilityProfile(created.id);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create eligibility profile.");
    }
  }

  return (
    <WkSurface className="p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="mb-1 text-[16px] font-bold text-wk-text">Chart Rules</h2>
          <p className="text-[12px] text-wk-text-soft">
            Build eligibility like Jenga: choose origin, artist type, gender, release window, collaboration policy, and review rules. The result becomes a saved profile attached to this ingest run.
          </p>
        </div>
        <span className="rounded-full bg-wk-brand-soft px-2.5 py-1 text-[11px] font-bold text-wk-brand">Rule builder</span>
      </div>

      {error && <div className="mb-4 rounded-lg border border-wk-danger/20 bg-wk-danger-soft p-3 text-[12px] font-semibold text-wk-danger">{error}</div>}

      <div className="mb-5 rounded-xl border border-wk-border bg-wk-surface-raised p-4">
        <div className="mb-3 flex items-center gap-2 text-[12px] font-bold text-wk-text"><WkIcon name="SlidersHorizontal" size={14} className="text-wk-brand" /> Compose eligibility profile</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL_CLASS}>Profile name *</label>
            <input value={profileName} onChange={(event) => { setProfileName(event.target.value); setProfileSlug(slugify(event.target.value)); }} className={INPUT_CLASS} placeholder="Kenyan female tracks Q1 2026" />
          </div>
          <div>
            <label className={LABEL_CLASS}>Slug *</label>
            <input value={profileSlug} onChange={(event) => setProfileSlug(event.target.value)} className={INPUT_CLASS} placeholder="kenyan-female-tracks-q1-2026" />
          </div>
          <div>
            <label className={LABEL_CLASS}>Public visibility</label>
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as "public" | "admin_only")} className={INPUT_CLASS}>
              <option value="admin_only">Admin-only rules</option>
              <option value="public">Can be shown publicly</option>
            </select>
          </div>
          <div>
            <label className={LABEL_CLASS}>Unknown metadata policy</label>
            <select value={unknownMetadataPolicy} onChange={(event) => setUnknownMetadataPolicy(event.target.value as "warning" | "review")} className={INPUT_CLASS}>
              <option value="review">Send unknowns to review</option>
              <option value="warning">Allow unknowns with warning</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <h3 className="mb-3 text-[13px] font-bold text-wk-text">Artist origin</h3>
          <select value={originMode} onChange={(event) => setOriginMode(event.target.value as "any" | "country_only" | "multi_country")} className={INPUT_CLASS}>
            <option value="any">Any origin</option>
            <option value="country_only">One country only</option>
            <option value="multi_country">Selected countries</option>
          </select>
          {originMode !== "any" && <div className="mt-3 flex flex-wrap gap-2">{COUNTRY_OPTIONS.map((country) => <button key={country} type="button" onClick={() => toggleCountry(country)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${originCountries.includes(country) ? "border-wk-brand bg-wk-brand text-wk-brand-on" : "border-wk-border bg-wk-surface text-wk-text-soft"}`}>{country}</button>)}</div>}
        </div>

        <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <h3 className="mb-3 text-[13px] font-bold text-wk-text">Artist classification</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={LABEL_CLASS}>Gender</label><select value={genderMode} onChange={(event) => setGenderMode(event.target.value as ArtistGenderEligibilityMode)} className={INPUT_CLASS}><option value="any">Any</option><option value="female_only">Female artists only</option><option value="male_only">Male artists only</option><option value="mixed_gender_only">Mixed gender only</option><option value="non_binary_inclusive">Non-binary inclusive</option></select></div>
            <div><label className={LABEL_CLASS}>Artist type</label><select value={artistTypeMode} onChange={(event) => setArtistTypeMode(event.target.value as ArtistTypeEligibilityMode)} className={INPUT_CLASS}><option value="any">Any</option><option value="solo_artists_only">Solo artists only</option><option value="groups_collectives_only">Groups/collectives only</option><option value="bands_only">Bands only</option><option value="duos_only">Duos only</option></select></div>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <h3 className="mb-3 text-[13px] font-bold text-wk-text">Track/release eligibility</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={LABEL_CLASS}>Released from</label><input type="date" value={releaseDateFrom} onChange={(event) => setReleaseDateFrom(event.target.value)} className={INPUT_CLASS} /></div>
            <div><label className={LABEL_CLASS}>Released to</label><input type="date" value={releaseDateTo} onChange={(event) => setReleaseDateTo(event.target.value)} className={INPUT_CLASS} /></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">{RELEASE_TYPES.map((type) => <button key={type} type="button" onClick={() => toggleReleaseType(type)} className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${releaseTypes.includes(type) ? "border-wk-brand bg-wk-brand text-wk-brand-on" : "border-wk-border bg-wk-surface text-wk-text-soft"}`}>{type}</button>)}</div>
        </div>

        <div className="rounded-xl border border-wk-border bg-wk-surface-raised p-4">
          <h3 className="mb-3 text-[13px] font-bold text-wk-text">Evidence and collaboration policy</h3>
          <div className="grid gap-2">
            <Toggle checked={requireIsrc} onChange={setRequireIsrc} label="Require ISRC" help="Rows without ISRC should be blocked or sent to review." />
            <Toggle checked={requirePreview} onChange={setRequirePreview} label="Require preview" help="Use only for charts where playable preview is part of eligibility." />
            <Toggle checked={explicitAllowed} onChange={setExplicitAllowed} label="Allow explicit tracks" />
            <Toggle checked={allowFeaturedArtists} onChange={setAllowFeaturedArtists} label="Allow featured artists" />
            <Toggle checked={primaryArtistMustMatch} onChange={setPrimaryArtistMustMatch} label="Primary artist must match eligibility" />
            <Toggle checked={allArtistsMustMatch} onChange={setAllArtistsMustMatch} label="All credited artists must match eligibility" help="Use for strict country/gender/type charts." />
          </div>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-wk-border bg-wk-bg p-4">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-bold text-wk-text"><WkIcon name="ClipboardCheck" size={14} className="text-wk-brand" /> Built rule summary</div>
        <p className="text-[12px] text-wk-text-soft">{buildDescription()}</p>
        {selectedProfile && <p className="mt-2 text-[11px] text-wk-text-muted">Currently selected saved profile: <strong className="text-wk-text-soft">{selectedProfile.name}</strong></p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-wk-divider pt-4">
        <button onClick={createRuleProfile} className="inline-flex items-center gap-1.5 rounded-md bg-wk-brand px-5 py-2.5 text-[13px] font-semibold text-wk-brand-on transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap"><WkIcon name="Save" size={14} />Save eligibility profile</button>
        <button onClick={onContinue} className="inline-flex items-center gap-1.5 rounded-md bg-wk-success px-5 py-2.5 text-[13px] font-semibold text-wk-success-on transition-all hover:opacity-90 active:scale-[0.98] whitespace-nowrap"><WkIcon name="ArrowRight" size={14} />Continue to Dry Run</button>
        <button onClick={onBack} className="inline-flex items-center gap-1.5 rounded-md border border-wk-border bg-wk-surface px-4 py-2.5 text-[13px] font-semibold text-wk-text-soft transition-colors hover:bg-wk-surface-raised whitespace-nowrap"><WkIcon name="ArrowLeft" size={14} />Back to Program</button>
      </div>
    </WkSurface>
  );
}
