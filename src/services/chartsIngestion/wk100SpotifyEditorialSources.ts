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

/**
 * Exact, nonpublishing contract for a researcher's own observed Spotify
 * playlist notes. Verifies note SHAPE, not whether the platform served these
 * positions at a claimed instant. Never manufactures streams or chart weeks.
 */
export type Wk100SpotifyEditorialNote = {
  sourceKey:string;
  playlistUrl:string;
  curatorBylineObserved:'Spotify';
  researcherObservedAtUtc:string;
  acquisitionMode:'researcher_directed_public_observation';
  placements:readonly {
    displayedPosition:number;
    titleObserved:string;
    artistDisplayObserved:string;
    spotifyTrackId:string|null;
  }[];
};

const NOTE_KEYS=['acquisitionMode','curatorBylineObserved','placements',
  'playlistUrl','researcherObservedAtUtc','sourceKey'];
const PLACEMENT_KEYS=['artistDisplayObserved','displayedPosition',
  'spotifyTrackId','titleObserved'];
const noteShape=(x:unknown,keys:readonly string[]):x is Record<string,unknown>=>
  x!==null&&typeof x==='object'&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&
  Object.keys(x).length===keys.length&&keys.every(key=>Object.hasOwn(x,key));
const noteText=(x:unknown,max:number):x is string=>
  typeof x==='string'&&x.trim()===x&&x.length>=1&&x.length<=max&&
  !/[\u0000-\u001f\u007f<>]/u.test(x);
const rejectNote=():never=>{throw Error('wk100_spotify_editorial_note_invalid');};

export function validateWk100SpotifyEditorialNote(input:unknown){
  if(!noteShape(input,NOTE_KEYS))rejectNote();
  // Narrow only after the fail-closed shape check; unrecognized fields,
  // including invented stream counts and score flags, must be rejected.
  const note=input as Record<string,unknown>;
  const source=WK100_SPOTIFY_EDITORIAL_SOURCES.find(x=>x.sourceKey===note.sourceKey);
  if(!source||note.playlistUrl!==spotifyEditorialSourceUrl(source.playlistId)||
    note.curatorBylineObserved!=='Spotify'||
    note.acquisitionMode!=='researcher_directed_public_observation')rejectNote();
  const at=note.researcherObservedAtUtc;
  if(typeof at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(at)||
    !Number.isFinite(Date.parse(at))||new Date(at).toISOString()!==at)
    rejectNote();
  const placements=note.placements;
  if(!Array.isArray(placements)||placements.length===0||placements.length>200)
    throw Error('wk100_spotify_editorial_note_invalid');
  const ranks=new Set<number>(),ids=new Set<string>();
  const rows=placements.map((row:unknown)=>{
    if(!noteShape(row,PLACEMENT_KEYS))rejectNote();
    const p=row as Record<string,unknown>;
    if(!Number.isInteger(p.displayedPosition)||
      (p.displayedPosition as number)<1||(p.displayedPosition as number)>200||
      ranks.has(p.displayedPosition as number)||
      !noteText(p.titleObserved,300)||!noteText(p.artistDisplayObserved,300)||
      !(p.spotifyTrackId===null||
        (typeof p.spotifyTrackId==='string'&&/^[A-Za-z0-9]{22}$/.test(p.spotifyTrackId)))||
      (typeof p.spotifyTrackId==='string'&&ids.has(p.spotifyTrackId)))
      rejectNote();
    ranks.add(p.displayedPosition as number);
    if(typeof p.spotifyTrackId==='string')ids.add(p.spotifyTrackId);
    return Object.freeze({
      displayedPosition:p.displayedPosition as number,
      titleObserved:p.titleObserved as string,
      artistDisplayObserved:p.artistDisplayObserved as string,
      spotifyTrackId:p.spotifyTrackId as string|null,
    });
  }).sort((a,b)=>a.displayedPosition-b.displayedPosition);
  return Object.freeze({
    schemaVersion:'wk100-spotify-editorial-research-note-v1',
    sourceKey:source.sourceKey,providerKey:'spotify_ke',
    providerFamily:'spotify_editorial',playlistId:source.playlistId,
    playlistUrl:note.playlistUrl as string,
    researcherObservedAtUtc:at,curatorBylineObserved:'Spotify',
    curatorVerifiedIndependently:false,signalClass:'editorial_playlist_placement',
    observationStatus:'research_only',
    nativePeriodAuthority:'unknown',
    nativePeriodStartsAt:null,nativePeriodEndsAt:null,
    originalProviderBytesVerified:false,collectorReceiptVerified:false,
    observedPositionsAreComplete:false,observedDepth:rows.length,
    placements:Object.freeze(rows),
    providerFamilyContributionCap:1,
    canCollect:false,canScore:false,canPublish:false,
  });
}
