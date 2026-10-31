import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestPolicySnapshot} from '../../../supabase/functions/_shared/chart-ingest-policy-snapshot.mjs';
import {previewFullIngestFilters, ChartIngestPreviewHold} from '../../../supabase/functions/_shared/chart-ingest-full-filter-preview.mjs';

const RUN='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  CAND='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  TRACK='11111111-1111-4111-8111-111111111111',
  ARTIST='22222222-2222-4222-8222-222222222222',
  RAW='44444444-4444-4444-8444-444444444444',
  SOURCE='55555555-5555-4555-8555-555555555555',
  RELEASE='66666666-6666-4666-8666-666666666666';
const policy=()=>({
 eligibilityProfileId:'elig_kenyan',marketScopeId:'scope_kenya',
 eligibilityProfileSnapshot:{id:'elig_kenyan',name:'Kenya',slug:'kenya',visibility:'admin_only',
 artistOriginEligibility:{mode:'country_only',countries:['KE'],regions:[]},artistGenderEligibility:{mode:'any'},artistTypeEligibility:{mode:'any'},
 releaseEligibility:{releaseTypes:['single'],includeReissues:true,includeRemixes:true,includeAcousticVersions:true,includeInstrumentals:true},
 trackEligibility:{explicitAllowed:true,requireIsrc:false,requirePreview:false},
 collaborationRules:{allowFeaturedArtists:true,countFeaturedArtistNationality:false,primaryArtistMustMatchEligibility:true,allArtistsMustMatchEligibility:false},
 sourceRules:{allowedProviders:['mdundo','spotify'],requireAtLeastOneProviderId:true,requireProviderAvailabilityInMarket:false},
 reviewRules:{requireManualReviewForUnknownGender:false,requireManualReviewForUnknownNationality:true,requireManualReviewForUnknownArtistType:false,requireManualReviewForGroups:false,allowUnknownMetadataWithWarning:false}},
 marketScopeSnapshot:{id:'scope_kenya',slug:'kenya',primaryMarketSlug:'kenya',includedMarkets:[{marketSlug:'kenya',countryCode:'KE'}],aggregationMode:'combined',artistOriginCountries:['KE'],artistOriginUnknownMode:'exclude'}
});
const db={from() { throw Error('An injected read-only fixture should never query'); }};
async function fixture(){
 const frozen=await createIngestPolicySnapshot(policy(),'test-admin','2026-10-30T12:00:00.000Z');
 return {runId:RUN,
 run:{id:RUN,status:'draft',market_slug:'kenya',rule_snapshot_json:{ingestPolicy:frozen},market_scope_snapshot_json:frozen.marketScopeSnapshot},
 runSources:[{id:SOURCE,run_id:RUN,provider:'mdundo',enabled:true}],
 rawRows:[{id:RAW,run_id:RUN,source_id:SOURCE,provider:'mdundo',provider_track_id:'MDUNDO_123',source_position:7}],
 candidates:[{id:CAND,run_id:RUN,source_count:1,provider_ids_json:{mdundo:['mdundo-123']}}],
 acceptedMatches:[{id:'77777777-7777-4777-8777-777777777777',run_id:RUN,candidate_id:CAND,entity_type:'track',canonical_entity_id:TRACK,status:'accepted'}],
 registryTracks:[{id:TRACK,title:'A track',isrc:'KEABC2600001',release_id:RELEASE,status:'active',explicit:false,duration_ms:180000}],
 registryCredits:[{id:'88888888-8888-4888-8888-888888888888',track_id:TRACK,artist_id:ARTIST,is_primary:true,status:'active'}],
 registryArtists:[{id:ARTIST,origin_iso2:'KE',status:'active'}],
 registryReleases:[{id:RELEASE,release_type:'single',release_date:'2026-10-05',status:'active'}],
 registryProviderLinks:[],exclusions:[],reviewIssues:[],readCompleteness:true,callerAuthorizationVerified:false,sourceNativePeriodVerified:false};
}
const view=async data=>previewFullIngestFilters(db,RUN,{read:async()=>data});
test('real module chain: provider compaction, market slug, canonical KE primary and release type evaluate as predicate-eligible, still held',async()=>{
 const r=await view(await fixture());
 assert.equal(r.counts.ELIGIBLE,1);
 assert.equal(r.frozenPolicyVerified,true);
 assert.equal(r.mayScore,false);assert.equal(r.canCommit,false);
 assert(r.holdReasons.includes('source_native_period_unverified'));
});
test('real module chain: known NG primary stays EXCLUDED and cannot publish',async()=>{
 const x=await fixture();x.registryArtists[0].origin_iso2='NG';
 const r=await view(x);assert.equal(r.counts.EXCLUDED,1);assert.equal(r.mayPublish,false);
});
test('real module chain: missing Registry origin stays REVIEW_REQUIRED, not false empty queue',async()=>{
 const x=await fixture();x.registryArtists[0].origin_iso2=null;
 const r=await view(x);assert.equal(r.counts.REVIEW_REQUIRED,1);assert.equal(r.reviewRowCount,1);
});
test('real module chain: alias collision stays a review hold',async()=>{
 const x=await fixture();x.rawRows.push({...x.rawRows[0],id:'99999999-9999-4999-8999-999999999999',provider_track_id:'mdundo-123'});
 const r=await view(x);assert.equal(r.counts.REVIEW_REQUIRED,1);assert(r.holdReasons.includes('source_association_unverified'));
});
test('real module chain: changed frozen profile or market scope blocks preview',async()=>{
 const x=await fixture();x.run.rule_snapshot_json.ingestPolicy.eligibilityProfileSnapshot.artistOriginEligibility.countries=['US'];
 await assert.rejects(()=>view(x),e=>e instanceof ChartIngestPreviewHold&&e.code==='invalid_frozen_policy');
});
test('real module chain: verified matching run market never licenses an unconfigured country',async()=>{
 const x=await fixture();x.run.market_slug='uganda';
 await assert.rejects(()=>view(x),e=>e instanceof ChartIngestPreviewHold&&e.code==='target_market_scope_ambiguous');
});
