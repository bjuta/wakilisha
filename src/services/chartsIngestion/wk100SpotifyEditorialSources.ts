/**
 * WK100 selected Spotify editorial research sources.
 *
 * Required supplementary provenance inputs for the later governed scoring
 * methodology, NOT objective Kenya stream counts or approved collection paths.
 * Four playlist observations belong to ONE Spotify provider family.
 */
export const WK100_SPOTIFY_EDITORIAL_SOURCES = [
  {
    sourceKey:'spotify_editorial_hot_hits_ke',
    playlistId:'37i9dQZF1DWWWXigQZAD8B',
    label:'Hot Hits Kenya',
    role:'Kenya-facing contemporary editorial hits',
  },
  {
    sourceKey:'spotify_editorial_nmf_ke',
    playlistId:'37i9dQZF1DX5lbl7P6kJFp',
    label:'New Music Friday Kenya',
    role:'Editor-selected new releases',
  },
  {
    sourceKey:'spotify_editorial_made_in_ke',
    playlistId:'37i9dQZF1DX7z7RLIui5KP',
    label:'Made In Kenya',
    role:'Kenyan artist and regional discovery',
  },
  {
    sourceKey:'spotify_editorial_gengetone_fire',
    playlistId:'37i9dQZF1DX80fLED6RkGS',
    label:'Gengetone Fire',
    role:'Kenyan Gengetone and local-scene editorial selection',
  },
] as const;

export const WK100_SPOTIFY_EDITORIAL_METHOD_CONTRACT = {
  providerKey:'spotify_ke',
  signalClass:'editorial_playlist_placement',
  requiredSupplementaryEvidence:true,
  observedFacts:['inclusion','displayed_ordinal_position','observation_utc','source_identity'] as const,
  providerFamiliesCount:1,
  consumptionStreamsKnown:false,
  providerNativeMeasurementWindowKnown:false,
  lowerWeightThanQualifiedPrimarySignals:true,
  combinedProviderFamilyCapRequired:true,
  numericWeightStatus:'requires_phase_3_methodology_approval',
  sourceMethodStatus:'research_method_review_required',
  collectorAdmission:false,
  canScore:false,
  canPublish:false,
} as const;

export function spotifyEditorialSourceUrl(id:string):string {
  // The ids are fixed, first-party Spotify playlist references, not a
  // generic user-supplied outbound URL.
  const found=WK100_SPOTIFY_EDITORIAL_SOURCES.find(p=>p.playlistId===id);
  if(!found)throw new Error('spotify_editorial_source_unqualified');
  return 'https://open.spotify.com/playlist/'+found.playlistId;
}
