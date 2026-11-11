/**
 * WAKILISHA 100 W5. Source-bound, read-only eligibility review.
 * Reuses the existing frozen-policy validator and full-filter predicates.
 * No inferred metadata, canonical Registry writes, candidate scoring,
 * Publication authority, or second rules engine.
 */
import {createIngestPolicySnapshot} from './chart-ingest-policy-snapshot.mjs';
import {evaluateFrozenChartIngestCandidate} from './chart-ingest-filter-evaluator.mjs';
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const fail=code=>{throw new Error('wk100_eligibility_'+code);};
const ensure=(v,code)=>{if(!v)fail(code);};
const isObj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const word=x=>typeof x==='string'&&x.trim()?x.trim():null;
const arr=x=>Array.isArray(x)?x:[];
const strings=x=>arr(x).filter(v=>typeof v==='string'&&v.trim().length).map(v=>v.trim());
/**
 * The canonical policy provider family is distinct from the provider's
 * Registry identity namespace. Never alter the saved policy allow-list.
 */
const POLICY_PROVIDERS=Object.freeze({
  apple_music:'apple_music',shazam_ke:'shazam',mdundo_ke:'mdundo',
  youtube_ke:'youtube',audiomack_ke:'audiomack',
});
export function wk100EligibilityPolicyProvider(registryProviderKey){
  const provider=POLICY_PROVIDERS[registryProviderKey];
  ensure(typeof provider==='string','unknown_policy_provider');
  return provider;
}
const stable=v=>JSON.stringify(v,(_key,item)=>
  item&&typeof item==='object'&&!Array.isArray(item)
    ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
async function digest(input){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(input)))).map(n=>n.toString(16).padStart(2,'0')).join('');
}
function creditRole(c){
  if(c.is_primary===true&&['primary_artist','primary'].includes(c.role))return 'primary';
  if(c.is_primary===false&&['featured_artist','featured'].includes(c.role))return 'featured';
  if(c.is_primary===false&&c.role==='other')return 'other';
  return null; // A mismatched or unknown role needs human review.
}
function findRelease(track,releases){
  if(!track?.release_id)return null;
  return releases.find(x=>x?.id===track.release_id&&x.status==='active')??null;
}
function factsFor(row,source,tracks,credits,artists,releases){
  const track=row.identityState==='resolved'?
    tracks.find(x=>x?.id===row.canonicalTrackId&&x.status==='active'):null;
  const release=findRelease(track,releases);
  const links=track?credits.filter(x=>x?.track_id===track.id&&x.status==='active'):[];
  const creditRows=links.map(link=>{
    const artist=artists.find(x=>x?.id===link.artist_id&&x.status==='active');
    const role=creditRole(link);
    return {artistId:artist?.id??null,role:role??'unverified',
      originIso2:artist?.origin_iso2??null,
      gender:artist?.gender??null,artistType:artist?.artist_type??null,
      regionIds:strings(artist?.metadata?.regionIds),
      verifiedDiasporaMarkets:strings(artist?.metadata?.verifiedDiasporaMarkets)};
  });
  const trackMeta=isObj(track?.metadata)?track.metadata:{};
  const releaseMeta=isObj(release?.metadata)?release.metadata:{};
  return {
    canonicalTrackId:track?.id??null,
    hasIdentityConflict:row.identityState==='conflicting',
    marketIso2:'KE', // Bound to the exact immutable Kenya contract in W4.
    source:{provider:wk100EligibilityPolicyProvider(source.registryProviderKey),
      providerTrackId:row.providerTrackId,providerReleaseId:null,
      availableMarkets:null,restrictedMarkets:null},
    credits:creditRows,
    track:{title:track?.title??row.observedTitle,
      isrc:track?.isrc??null,explicit:track?.explicit??null,
      durationMs:track?.duration_ms??null,previewUrl:track?.preview_url??null,
      genres:strings(trackMeta.genres),languages:strings(trackMeta.languages)},
    release:{type:release?.release_type??null,date:release?.release_date??null,
      versions:isObj(releaseMeta.versions)?releaseMeta.versions:{}},
  };
}

/** The draft is a signed-in Admin-authored Edition revision, not a frozen
 * ranking methodology or a publication grant. Every rule evaluation is
 * directly bound to its SHA-256 policy config and exact source receipt.
 */
export async function projectWk100EligibilityPreview({
  weekStartEat,sourceReview,draft,registryTracks=[],registryCredits=[],
  registryArtists=[],registryReleases=[],
}){
  ensure(sourceReview?.schemaVersion==='wk100-admin-identify-observations-v1'&&
    sourceReview.weekStartEat===weekStartEat&&
    sourceReview.identityStatus==='exact_provider_links_only'&&
    sourceReview.canWriteRegistry===false&&sourceReview.canScore===false&&
    sourceReview.canPublish===false&&Array.isArray(sourceReview.rows)&&
    sourceReview.rows.length>=1&&sourceReview.rows.length<=200&&
    sourceReview.rows.length===sourceReview.totals?.observed&&
    SHA.test(sourceReview.payloadSha256),'source_evidence_invalid');
  ensure(isObj(draft)&&draft.week_start_eat===weekStartEat&&
    Number.isSafeInteger(Number(draft.revision))&&Number(draft.revision)>0&&
    UUID.test(draft.updated_by)&&typeof draft.updated_at==='string'&&
    Number.isFinite(Date.parse(draft.updated_at)),'draft_revision_invalid');
  const config=draft.config_json;
  ensure(isObj(config)&&config.schemaVersion==='wk100-admin-edition-config/v1'&&
    config.programId==='top100'&&config.weekStartEat===weekStartEat&&
    config.market==='KE'&&config.chartSize===100&&
    word(config.eligibilityProfileId)&&word(config.marketScopeId)&&
    isObj(config.eligibilityProfileSnapshot)&&isObj(config.marketScopeSnapshot)&&
    SHA.test(config.ingestPolicySha256),'draft_policy_invalid');
  const expectedPolicyHash=await digest(stable({
    profileId:config.eligibilityProfileId,marketScopeId:config.marketScopeId,
    eligibilityProfileSnapshot:config.eligibilityProfileSnapshot,
    marketScopeSnapshot:config.marketScopeSnapshot,
  }));
  ensure(expectedPolicyHash===config.ingestPolicySha256,'draft_policy_digest_mismatch');
  const frozen=await createIngestPolicySnapshot({
    eligibilityProfileId:config.eligibilityProfileId,
    marketScopeId:config.marketScopeId,
    eligibilityProfileSnapshot:config.eligibilityProfileSnapshot,
    marketScopeSnapshot:config.marketScopeSnapshot,
  },draft.updated_by,new Date(draft.updated_at).toISOString());
  for(const v of [registryTracks,registryCredits,registryArtists,registryReleases])
    ensure(Array.isArray(v)&&v.length<=400,'registry_read_incomplete');
  const seen=new Set(),rows=[];
  for(const observation of sourceReview.rows){
    ensure(isObj(observation)&&UUID.test(observation.captureRowId)&&
      Number.isInteger(observation.rank)&&observation.rank>=1&&
      !seen.has(observation.captureRowId)&&
      ['resolved','needs_review','conflicting','inactive'].includes(observation.identityState),
      'source_row_invalid');
    seen.add(observation.captureRowId);
    const facts=factsFor(observation,sourceReview,registryTracks,registryCredits,
      registryArtists,registryReleases);
    const registryFactsSha256=await digest(stable(facts));
    const linkedTrack=facts.canonicalTrackId?registryTracks.find(x=>
      x?.id===facts.canonicalTrackId&&x.status==='active'):null;
    const registryTrackSlug=typeof linkedTrack?.slug==='string'&&
      /^[a-z0-9][a-z0-9_-]{0,127}$/.test(linkedTrack.slug)
      ?linkedTrack.slug:null;
    const cleanSlug=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9_-]{0,127}$/.test(x)?x:null;
    const linkedRelease=linkedTrack?.release_id?registryReleases.find(x=>
      x?.id===linkedTrack.release_id&&x.status==='active'):null;
    const registryReleaseSlug=cleanSlug(linkedRelease?.slug);
    // These are existing active credits for investigation, not an assertion
    // that an observed song automatically has correct performer attribution.
    const registryArtistSlugs=[...new Set(registryCredits
      .filter(x=>linkedTrack&&x?.track_id===linkedTrack.id&&x.status==='active')
      .map(x=>registryArtists.find(a=>a?.id===x.artist_id&&a.status==='active'))
      .map(a=>cleanSlug(a?.slug)).filter(Boolean))];
    const evaluated=await evaluateFrozenChartIngestCandidate(frozen,facts);
    ensure(['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED'].includes(evaluated.status)&&
      evaluated.mayScore===false&&evaluated.mayMutateRegistry===false&&
      Array.isArray(evaluated.reasons),'predicate_contract_invalid');
    // A mismatched / missing Registry link can never become predicate eligible.
    let outcome=evaluated.status;
    const reasonCodes=evaluated.reasons.map(r=>r.code);
    if(observation.identityState==='conflicting')outcome='CONFLICTED';
    else if(observation.identityState!=='resolved'&&outcome==='ELIGIBLE')
      outcome='REVIEW_REQUIRED';
    if(observation.identityState!=='resolved')
      reasonCodes.unshift('canonical_identity_'+observation.identityState);
    if(observation.identityState==='resolved'&&!facts.canonicalTrackId){
      outcome='REVIEW_REQUIRED';reasonCodes.unshift('registry_track_not_verifiable');
    }
    rows.push({
      captureRowId:observation.captureRowId,rank:observation.rank,
      observedTitle:observation.observedTitle,observedArtist:observation.observedArtist,
      providerTrackId:observation.providerTrackId,
      identityState:observation.identityState,canonicalTrackId:facts.canonicalTrackId,
      reviewReason:observation.reviewReason,provisionalRef:observation.provisionalRef,
      registryTrackSlug,registryReleaseSlug,registryArtistSlugs,registryFactsSha256,
      registryTrackId:linkedTrack?.id??null,
      registryReleaseId:linkedRelease?.id??null,
      registryTrackUpdatedAt:linkedTrack?.updated_at??null,
      registryReleaseUpdatedAt:linkedRelease?.updated_at??null,
      registryTrackProfile:linkedTrack?{
        title:linkedTrack.title??null,isrc:linkedTrack.isrc??null,
        explicit:linkedTrack.explicit??null,duration_ms:linkedTrack.duration_ms??null,
      }:null,
      registryReleaseProfile:linkedRelease?{
        release_type:linkedRelease.release_type??null,
        release_date:linkedRelease.release_date??null,
      }:null,
      outcome,reasonCodes:[...new Set(reasonCodes)],
      canScore:false,canPublish:false,
    });
  }
  rows.sort((a,b)=>a.rank-b.rank);
  ensure(rows.every((r,i)=>r.rank===i+1),'rank_noncontiguous');
  const counts=Object.fromEntries(['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED']
    .map(key=>[key,rows.filter(r=>r.outcome===key).length]));
  return {
    schemaVersion:'wk100-admin-eligibility-preview-v1',weekStartEat,
    contractId:sourceReview.contractId,receiptId:sourceReview.receiptId,
    sourceKey:sourceReview.sourceKey,payloadSha256:sourceReview.payloadSha256,
    configRevision:Number(draft.revision),policySha256:config.ingestPolicySha256,
    eligibilityProfileName:config.eligibilityProfileSnapshot.name,
    marketScopeName:config.marketScopeSnapshot.name,
    receiptStatus:sourceReview.receiptStatus,
    expectedDepth:sourceReview.expectedDepth,observedDepth:rows.length,
    counts,rows,reviewMode:'all_predicates_no_admission',
    canScore:false,canPublish:false,canWriteRegistry:false,
  };
}
