import type {
  ChartEligibilityProfile,
  CreateChartEligibilityProfileRequest,
  UpdateChartEligibilityProfileRequest,
} from "./eligibilityTypes";

const STORAGE_KEY = "wakilisha_chart_eligibility_profiles_v1";

function now() {
  return new Date().toISOString();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function baseProfile(overrides: Partial<ChartEligibilityProfile>): ChartEligibilityProfile {
  const timestamp = now();
  const name = overrides.name ?? "All artists";
  return {
    id: overrides.id ?? `elig_${slugify(name)}`,
    name,
    slug: overrides.slug ?? slugify(name),
    description: overrides.description ?? "Default chart eligibility profile.",
    visibility: overrides.visibility ?? "admin_only",
    publicLabel: overrides.publicLabel,
    internalNotes: overrides.internalNotes,
    artistGenderEligibility: overrides.artistGenderEligibility ?? { mode: "any" },
    artistTypeEligibility: overrides.artistTypeEligibility ?? { mode: "any" },
    artistOriginEligibility: overrides.artistOriginEligibility ?? { mode: "any", countries: [], regions: [] },
    releaseEligibility: overrides.releaseEligibility ?? {
      releaseTypes: ["single", "ep", "album", "mixtape", "compilation", "video", "live"],
      includeReissues: true,
      includeRemixes: true,
      includeAcousticVersions: true,
      includeInstrumentals: true,
    },
    trackEligibility: overrides.trackEligibility ?? {
      explicitAllowed: true,
      requireIsrc: false,
      requirePreview: false,
    },
    collaborationRules: overrides.collaborationRules ?? {
      allowFeaturedArtists: true,
      countFeaturedArtistNationality: false,
      primaryArtistMustMatchEligibility: true,
      allArtistsMustMatchEligibility: false,
    },
    sourceRules: overrides.sourceRules ?? {
      allowedProviders: ["spotify", "apple_music", "youtube", "airplay", "manual", "registry"],
      requireAtLeastOneProviderId: false,
      requireProviderAvailabilityInMarket: false,
    },
    reviewRules: overrides.reviewRules ?? {
      requireManualReviewForUnknownGender: false,
      requireManualReviewForUnknownNationality: false,
      requireManualReviewForUnknownArtistType: false,
      requireManualReviewForGroups: false,
      allowUnknownMetadataWithWarning: true,
    },
    createdAt: overrides.createdAt ?? timestamp,
    updatedAt: overrides.updatedAt ?? timestamp,
  };
}

export const DEFAULT_ELIGIBILITY_PROFILES: ChartEligibilityProfile[] = [
  baseProfile({
    id: "elig_all_artists",
    name: "All artists",
    slug: "all-artists",
    description: "No artist origin, gender, or artist-type restrictions. Use for general public charts.",
    visibility: "public",
    publicLabel: "All artists",
  }),
  baseProfile({
    id: "elig_kenyan_artists_only",
    name: "Kenyan artists only",
    slug: "kenyan-artists-only",
    description: "Primary artist must resolve to WAKILISHA proprietary origin ISO2 KE.",
    visibility: "admin_only",
    publicLabel: "Kenyan artists only",
    artistOriginEligibility: { mode: "country_only", countries: ["KE"], regions: [] },
    collaborationRules: {
      allowFeaturedArtists: true,
      countFeaturedArtistNationality: false,
      primaryArtistMustMatchEligibility: true,
      allArtistsMustMatchEligibility: false,
    },
    reviewRules: {
      requireManualReviewForUnknownGender: false,
      requireManualReviewForUnknownNationality: true,
      requireManualReviewForUnknownArtistType: false,
      requireManualReviewForGroups: false,
      allowUnknownMetadataWithWarning: false,
    },
  }),
  baseProfile({
    id: "elig_east_africa_selected_markets",
    name: "Kenya + Uganda + Tanzania artists",
    slug: "kenya-uganda-tanzania-artists",
    description: "Eligible artists must resolve to KE, UG, or TZ. Countries are preserved separately for analytics.",
    visibility: "admin_only",
    publicLabel: "East African artists",
    artistOriginEligibility: { mode: "multi_country", countries: ["KE", "UG", "TZ"], regions: ["east-africa"] },
    collaborationRules: {
      allowFeaturedArtists: true,
      countFeaturedArtistNationality: true,
      primaryArtistMustMatchEligibility: true,
      allArtistsMustMatchEligibility: false,
    },
    reviewRules: {
      requireManualReviewForUnknownGender: false,
      requireManualReviewForUnknownNationality: true,
      requireManualReviewForUnknownArtistType: false,
      requireManualReviewForGroups: false,
      allowUnknownMetadataWithWarning: false,
    },
  }),
  baseProfile({
    id: "elig_female_artists_only",
    name: "Female artists only",
    slug: "female-artists-only",
    description: "Primary artist must be classified as female in private WAKILISHA intelligence or sent to review.",
    visibility: "admin_only",
    publicLabel: "Female artists only",
    artistGenderEligibility: { mode: "female_only", publicLabel: "Female artists" },
    reviewRules: {
      requireManualReviewForUnknownGender: true,
      requireManualReviewForUnknownNationality: false,
      requireManualReviewForUnknownArtistType: false,
      requireManualReviewForGroups: false,
      allowUnknownMetadataWithWarning: false,
    },
  }),
  baseProfile({
    id: "elig_groups_collectives_only",
    name: "Groups and collectives only",
    slug: "groups-and-collectives-only",
    description: "Only artists classified as groups, collectives, bands, or duos are eligible.",
    visibility: "public",
    publicLabel: "Groups and collectives only",
    artistTypeEligibility: { mode: "groups_collectives_only" },
    reviewRules: {
      requireManualReviewForUnknownGender: false,
      requireManualReviewForUnknownNationality: false,
      requireManualReviewForUnknownArtistType: true,
      requireManualReviewForGroups: true,
      allowUnknownMetadataWithWarning: false,
    },
  }),
];

function readStoredProfiles(): ChartEligibilityProfile[] {
  if (typeof window === "undefined") return DEFAULT_ELIGIBILITY_PROFILES;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_ELIGIBILITY_PROFILES;
  try {
    const parsed = JSON.parse(raw) as ChartEligibilityProfile[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ELIGIBILITY_PROFILES;
  } catch {
    return DEFAULT_ELIGIBILITY_PROFILES;
  }
}

function writeStoredProfiles(profiles: ChartEligibilityProfile[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

export function getEligibilityProfiles(): ChartEligibilityProfile[] {
  return readStoredProfiles();
}

export function getEligibilityProfile(idOrSlug: string): ChartEligibilityProfile | null {
  return getEligibilityProfiles().find((profile) => profile.id === idOrSlug || profile.slug === idOrSlug) ?? null;
}

export function createEligibilityProfile(request: CreateChartEligibilityProfileRequest): ChartEligibilityProfile {
  const profiles = getEligibilityProfiles();
  const profile = baseProfile({ ...request, id: request.id ?? `elig_${slugify(request.slug || request.name)}` });
  if (profiles.some((existing) => existing.slug === profile.slug || existing.id === profile.id)) {
    throw new Error(`Eligibility profile already exists for ${profile.slug}.`);
  }
  const next = [...profiles, profile];
  writeStoredProfiles(next);
  return profile;
}

export function updateEligibilityProfile(request: UpdateChartEligibilityProfileRequest): ChartEligibilityProfile {
  const profiles = getEligibilityProfiles();
  const existing = profiles.find((profile) => profile.id === request.id);
  if (!existing) throw new Error(`Eligibility profile not found: ${request.id}.`);
  const updated: ChartEligibilityProfile = {
    ...existing,
    ...request,
    slug: request.slug ?? existing.slug,
    updatedAt: now(),
  };
  writeStoredProfiles(profiles.map((profile) => (profile.id === request.id ? updated : profile)));
  return updated;
}

export function resetEligibilityProfiles(): ChartEligibilityProfile[] {
  writeStoredProfiles(DEFAULT_ELIGIBILITY_PROFILES);
  return DEFAULT_ELIGIBILITY_PROFILES;
}
