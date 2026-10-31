/**
 * WAKILISHA Chart Ingest, Phase 2 isolated Registry/source fact adapter.
 * STRICTLY NON-PUBLISHING research prototype. No SQL, network, or mutations.
 * This adapter transforms only explicitly linked canonical records into facts.
 * It is NOT an authorized DB reader or a source-period attestation.
 */
import {evaluateFrozenChartIngestCandidate} from './chart-ingest-filter-evaluator.mjs';

const uuid = x => typeof x === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const str = x => typeof x === 'string' && x.trim() ? x.trim() : null;
const iso = x => typeof x === 'string' && /^[A-Z]{2}$/.test(x.toUpperCase()) ? x.toUpperCase() : null;
const arr = x => Array.isArray(x) ? x : [];
const norm = x => str(x)?.toLowerCase() ?? null;
// Accepted provider-identity aliases are not the same as raw provider IDs.
const providerAlias={applemusic:'apple_music',youtube_music:'youtube',youtubemusic:'youtube',yt_music:'youtube',amazonmusic:'amazon_music',tiktok_music:'tiktok'};
const providerKey=x=>{const k=str(x)?.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')??null;return k?(providerAlias[k]||k):null;};
// Existing ingest candidate bags store compactProviderIdentityPart(), not raw object IDs.
const compactProviderId=x=>str(x)?.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')??null;
function get(x,...keys) {for(const key of keys) if(x?.[key] !== undefined && x[key]!==null) return x[key];return null;}
function unique(items) {return [...new Set(items)];}
function normalizedList(x) {return arr(x).map(str).filter(Boolean);}

/**
 * Expected shape: acceptedMatches rows with candidate_id/canonical_entity_id,
 * registryTrack from registry_tracks, credits from registry_track_artists,
 * artists from registry_artists, sourceObservation joined by an independently
 * verified raw-row <-> candidate linkage. Completeness evidence stays separate.
 * Caller MUST enforce least-privilege DB access and correct run isolation.
 */
export function buildRegistryChartCandidateFacts(input) {
  if(!obj(input)) throw new TypeError('input must be an object');
  const candidate = obj(input.candidate) ? input.candidate : {};
  const blockers = [];
  const add=(severity,code,detail)=>blockers.push({severity,code,detail});
  const cid=str(candidate.id),runId=str(candidate.run_id);
  if(!uuid(cid)||!uuid(runId)) add('CONFLICTED','candidate_key_invalid','candidate.id/run_id');
  const accepted=arr(input.acceptedMatches).filter(m=>m?.candidate_id===cid && m?.entity_type==='track' && m?.status==='accepted');
  const acceptedTracks=unique(accepted.map(m=>str(m?.canonical_entity_id)).filter(Boolean));
  if(accepted.length===0) add('REVIEW_REQUIRED','accepted_track_match_missing','chart_ingest_matches');
  else if(acceptedTracks.length!==1 || accepted.some(m=>!uuid(m.canonical_entity_id))) add('CONFLICTED','accepted_track_match_ambiguous','chart_ingest_matches');
  if(arr(input.acceptedMatches).some(m=>m?.candidate_id===cid && m?.run_id!=null && m.run_id!==runId)) add('CONFLICTED','cross_run_match','chart_ingest_matches');
  const canonicalTrackId=acceptedTracks.length===1 && uuid(acceptedTracks[0]) ? acceptedTracks[0] : null;
  const registryTrack=obj(input.registryTrack)?input.registryTrack:null;
  if(canonicalTrackId && !registryTrack) add('REVIEW_REQUIRED','registry_track_not_found','registry_tracks');
  if(canonicalTrackId && registryTrack && registryTrack.id!==canonicalTrackId) add('CONFLICTED','registry_track_identity_mismatch','registry_tracks.id');
  if(registryTrack?.status==='archived') add('CONFLICTED','archived_registry_track','registry_tracks.status');
  else if(registryTrack && registryTrack.status!=='active') add('REVIEW_REQUIRED','registry_track_not_active','registry_tracks.status');

  const registryArtists=arr(input.registryArtists);
  const artistMap=new Map();
  for(const a of registryArtists){
    if(!uuid(a?.id)) {add('CONFLICTED','malformed_registry_artist','registry_artists.id');continue;}
    if(artistMap.has(a.id)) add('CONFLICTED','duplicate_registry_artist_row','registry_artists.id');
    artistMap.set(a.id,a);
  }
  const credits=[];
  if(!canonicalTrackId && arr(input.credits).length) add('REVIEW_REQUIRED','credits_unlinked_without_track_match','registry_track_artists');
  for(const raw of (canonicalTrackId ? arr(input.credits) : [])) {
    if(raw?.status==='archived') continue;
    if(!uuid(raw?.track_id) || raw.track_id!==canonicalTrackId){add('CONFLICTED','credit_track_mismatch','registry_track_artists.track_id');continue;}
    if(raw.status !== 'active') {add('REVIEW_REQUIRED','credit_status_unverified','registry_track_artists.status');continue;}
    const artistId=str(raw.artist_id);
    if(!uuid(artistId)) {add('REVIEW_REQUIRED','credit_artist_missing','registry_track_artists.artist_id');continue;}
    let role=null;
    if(raw.is_primary===true) role='primary';
    else if(raw.is_primary===false) {
      const declared=norm(get(raw,'credit_role','role'));
      if(declared==='featured'||declared==='other') role=declared;
    }
    if(!role) {add('REVIEW_REQUIRED','credited_artist_role_unknown','registry_track_artists.is_primary/credit_role');continue;}
    const a=artistMap.get(artistId);
    if(!a) add('REVIEW_REQUIRED','credited_artist_not_resolved','registry_artists.id');
    if(a && a.status!=='active') add('REVIEW_REQUIRED','credited_artist_not_active','registry_artists.status');
    credits.push({artistId,role,originIso2:a?.status==='active'?iso(a.origin_iso2):null,
      gender:a?.status==='active'?str(a.gender):null,artistType:a?.status==='active'?str(get(a,'artist_type','type')):null,
      regionIds:a?.status==='active'?normalizedList(a.region_ids):[],
      verifiedDiasporaMarkets:a?.status==='active'?normalizedList(a.verified_diaspora_markets):[]});
    if(a?.origin_iso2!=null && !iso(a.origin_iso2))add('CONFLICTED','invalid_registry_origin','registry_artists.origin_iso2');
  }
  if(canonicalTrackId && credits.length===0)add('REVIEW_REQUIRED','no_active_verified_credits','registry_track_artists');
  if(credits.filter(c=>c.role==='primary').length!==1 && credits.length>0) add('CONFLICTED','primary_credit_cardinality','registry_track_artists.is_primary');
  if(new Set(credits.map(c=>c.artistId)).size!==credits.length)add('CONFLICTED','duplicate_track_artist_credit','registry_track_artists.artist_id');

  const source = obj(input.sourceObservation)?input.sourceObservation:{};
  const provider=providerKey(source.provider),providerId=str(source.provider_track_id);
  if(source.run_id!=null && source.run_id!==runId) add('CONFLICTED','source_different_run','chart_ingest_raw_rows.run_id');
  if(source.candidate_id!==cid || !uuid(source.id)) add('REVIEW_REQUIRED','source_candidate_join_unverified','chart_ingest_raw_rows + accepted association');
  // Never infer raw-row linkage from normalized titles; require exact candidate/provider ID evidence.
  const providerIds = obj(candidate.provider_ids_json)?candidate.provider_ids_json:{};
  const registeredIds = arr(providerIds[provider]).length?arr(providerIds[provider]):[providerIds[provider]];
  if(!provider || !providerId || !registeredIds.map(compactProviderId).includes(compactProviderId(providerId)))
    add('REVIEW_REQUIRED','source_provider_id_link_unverified','chart_ingest_candidates.provider_ids_json');
  for(const key of ['available_markets','restricted_markets']) {
    if(source[key]!=null && (!Array.isArray(source[key]) || source[key].some(v=>!iso(v))))
      add('CONFLICTED','source_market_fact_invalid',`chart_ingest_raw_rows.${key}`);
  }
  // Provider source native period is a separate WK100 gate; no period inferred here.
  const verifiedMarket=iso(input.marketIso2);
  if(!verifiedMarket)add('REVIEW_REQUIRED','market_scope_not_resolved','chart_ingest_runs.market_scope_snapshot_json');
  const track=obj(input.trackMetadata)?input.trackMetadata:{};
  const release=obj(input.releaseMetadata)?input.releaseMetadata:{};
  if(canonicalTrackId && track.id!=null && track.id!==canonicalTrackId)add('CONFLICTED','track_metadata_identity_mismatch','trackMetadata.id');
  if(str(registryTrack?.isrc) && str(track.isrc) && str(registryTrack.isrc).toUpperCase()!==str(track.isrc).toUpperCase())
    add('CONFLICTED','contradictory_track_isrc','registry_tracks.isrc/trackMetadata.isrc');
  if(canonicalTrackId && release.track_id!=null && release.track_id!==canonicalTrackId)add('CONFLICTED','release_metadata_identity_mismatch','releaseMetadata.track_id');
  const facts={
    canonicalTrackId,
    hasIdentityConflict:blockers.some(b=>b.severity==='CONFLICTED'),
    marketIso2:verifiedMarket,
    source:{provider,providerTrackId:providerId,providerReleaseId:str(source.provider_release_id),
      availableMarkets:source.available_markets??null,restrictedMarkets:source.restricted_markets??null},
    credits,
    track:{title:str(registryTrack?.title)||str(track.title),isrc:str(registryTrack?.isrc)||str(track.isrc),
      explicit:typeof track.explicit==='boolean'?track.explicit:null,
      durationMs:Number.isFinite(track.duration_ms)?track.duration_ms:null,
      previewUrl:str(track.preview_url),genres:normalizedList(track.genres),languages:normalizedList(track.languages)},
    release:{type:str(release.release_type),date:str(release.release_date),versions:obj(release.versions)?release.versions:{}},
  };
  const provenance={candidateId:cid,runId,canonicalTrackId,
    rawSourceId:uuid(source.id)?source.id:null,
    acceptedMatchCount:accepted.length,activeCreditCount:credits.length,
    trackRegistryRead:!!registryTrack, artistRegistryReadCount:artistMap.size};
  return {facts,blockers,provenance,mayScore:false,mayPublish:false};
}

/** The bridge cannot authorize a scored row even if the filter kernel is green. */
export async function evaluateRegistryChartCandidate(frozen,input) {
  const assembled=buildRegistryChartCandidateFacts(input);
  const filter=await evaluateFrozenChartIngestCandidate(frozen,assembled.facts);
  const blocking=assembled.blockers.some(b=>b.severity==='CONFLICTED');
  const pending=assembled.blockers.some(b=>b.severity==='REVIEW_REQUIRED');
  const outcome=blocking?'CONFLICTED':pending?'REVIEW_REQUIRED':filter.status;
  return {...assembled,filter,outcome,mayScore:false,mayPublish:false};
}
