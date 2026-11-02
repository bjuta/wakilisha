import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestPolicySnapshot} from '../../../supabase/functions/_shared/chart-ingest-policy-snapshot.mjs';
import {reconcileRunRawEvidence as reconcile,inspectProductionShapedRunCandidate as inspect} from '../../../supabase/functions/_shared/chart-ingest-run-provenance.mjs';
const RUN='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CAND='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const TRACK='11111111-1111-4111-8111-111111111111';
const ARTIST='22222222-2222-4222-8222-222222222222';
const FEATURE='33333333-3333-4333-8333-333333333333';
const RAW='44444444-4444-4444-8444-444444444444';
const SOURCE='55555555-5555-4555-8555-555555555555';
const SOURCE2='66666666-6666-4666-8666-666666666666';
const CAND2='77777777-7777-4777-8777-777777777777';
const RAW2='88888888-8888-4888-8888-888888888888';
const MARKET='KE';
function policy(){return {
 eligibilityProfileId:'elig_kenyan_artists_only',marketScopeId:'scope_kenya',
 eligibilityProfileSnapshot:{
  id:'elig_kenyan_artists_only',name:'Kenyan artists only',slug:'kenyan-artists-only',visibility:'admin_only',
  artistOriginEligibility:{mode:'country_only',countries:['KE'],regions:[]},artistGenderEligibility:{mode:'any'},artistTypeEligibility:{mode:'any'},
  releaseEligibility:{releaseTypes:['single'],includeReissues:true,includeRemixes:true,includeAcousticVersions:true,includeInstrumentals:true},
  trackEligibility:{explicitAllowed:true,requireIsrc:false,requirePreview:false},
  collaborationRules:{allowFeaturedArtists:true,countFeaturedArtistNationality:false,primaryArtistMustMatchEligibility:true,allArtistsMustMatchEligibility:false},
  sourceRules:{allowedProviders:['mdundo','spotify'],requireAtLeastOneProviderId:true,requireProviderAvailabilityInMarket:false},
  reviewRules:{requireManualReviewForUnknownGender:false,requireManualReviewForUnknownNationality:true,requireManualReviewForUnknownArtistType:false,requireManualReviewForGroups:false,allowUnknownMetadataWithWarning:false}},
 marketScopeSnapshot:{id:'scope_kenya',slug:'kenya',primaryMarketSlug:'kenya',includedMarkets:[{marketSlug:'kenya',countryCode:'KE'}],aggregationMode:'combined',artistOriginCountries:['KE'],artistOriginUnknownMode:'exclude'}
}}
function fixture(){return {
 runId:RUN,marketIso2:MARKET,
 candidates:[{id:CAND,run_id:RUN,title:'A song',artist_display:'Kenyan singer',provider_ids_json:{mdundo:['mdundo-123']},source_count:1}],
 runSources:[{id:SOURCE,run_id:RUN,provider:'mdundo',enabled:true,source_url:'https://play.mdundo.com/top-charts/ke'}],
 rawRows:[{id:RAW,run_id:RUN,source_id:SOURCE,provider:'mdundo',provider_track_id:'mdundo-123',source_position:7,title_raw:'A song',artist_raw:'Kenyan singer',raw_payload_json:{}}],
 acceptedMatches:[{id:'99999999-9999-4999-8999-999999999999',run_id:RUN,candidate_id:CAND,entity_type:'track',status:'accepted',canonical_entity_id:TRACK}],
 registryTracks:[{id:TRACK,title:'A song',status:'active',isrc:'KEABC2600001'}],
 registryCredits:[{id:'aaaa2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa',track_id:TRACK,artist_id:ARTIST,status:'active',is_primary:true}],
 registryArtists:[{id:ARTIST,status:'active',origin_iso2:'KE'}],
 verifiedTrackMetadata:[{id:TRACK,explicit:false,duration_ms:185000,genres:['genge'],languages:['sw']}],
 registryProviderLinks:[],
 verifiedReleaseMetadata:[{track_id:TRACK,release_type:'single',release_date:'2026-10-12',versions:{}}]
}}
const freeze=()=>createIngestPolicySnapshot(policy(),'local-isolated-test','2026-10-30T16:00:00.000Z');
const run=async(x=fixture())=>inspect(await freeze(),x,CAND);
test('production raw row does not store candidate_id',()=>{let x=fixture();assert.equal('candidate_id' in x.rawRows[0],false)});
test('certifies exact unique source->raw->candidate link',()=>{let a=reconcile(fixture());assert.equal(a.perCandidate[0].certificates[0].method,'NORMALIZED_UNIQUE_PROVIDER_TRACK_ID_IN_RUN');assert.equal(a.perCandidate[0].operatorKeys[0],'mdundo');assert.equal(a.perCandidate[0].problems.length,0)});
test('a clean KE case is predicate eligible, never scoreable',async()=>{let z=await run();assert.equal(z.outcome,'ELIGIBLE');assert.equal(z.mayScore,false);assert.equal(z.mayPublish,false);assert.equal(z.associationCertificate.rawRowId,RAW)});
test('not a source-native time attestation or chart publication',async()=>{let z=await run();assert.equal(z.associationCertificate.method,'NORMALIZED_UNIQUE_PROVIDER_TRACK_ID_IN_RUN');assert.equal(z.mayPublish,false);assert.equal(z.mayScore,false)});
test('foreign artist excluded from KE even though source is Kenya',async()=>{let x=fixture();x.registryArtists[0].origin_iso2='NG';let z=await run(x);assert.equal(z.outcome,'EXCLUDED')});
test('missing artist origin held in review, not discarded',async()=>{let x=fixture();x.registryArtists[0].origin_iso2=null;let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED')});
test('KE lead with NG featured artist subject to separate policy',async()=>{let x=fixture();x.registryCredits.push({track_id:TRACK,artist_id:FEATURE,status:'active',is_primary:false,credit_role:'featured'});x.registryArtists.push({id:FEATURE,status:'active',origin_iso2:'NG'});let z=await run(x);assert.equal(z.outcome,'ELIGIBLE')});
test('no raw provider identity -> not text-matched',()=>{let x=fixture();x.rawRows[0].provider_track_id=null;let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_strong_identity_missing'));assert.equal(y.perCandidate[0].certificates.length,0)});
test('no candidate provider bag -> review',()=>{let x=fixture();x.candidates[0].provider_ids_json=null;let y=reconcile(x);assert(y.perCandidate[0].problems.length>0)});
test('raw provider ID not present in candidate bag -> orphan',()=>{let x=fixture();x.rawRows[0].provider_track_id='other';let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_candidate_owner_missing'))});
test('ambiguous provider ID claims -> conflict, never choose first candidate',()=>{let x=fixture();x.candidates.push({...x.candidates[0],id:CAND2});let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_candidate_ownership_ambiguous'));assert.equal(y.perCandidate[0].certificates.length,0);assert.equal(y.perCandidate[1].certificates.length,0)});
test('cross-run raw ID quarantined',()=>{let x=fixture();x.rawRows[0].run_id=FEATURE;let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_wrong_run_or_key'))});
test('source provider must match raw provider',()=>{let x=fixture();x.runSources[0].provider='spotify';let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_source_contract_conflict'))});
test('source disabled -> cannot use its facts',()=>{let x=fixture();x.runSources[0].enabled=false;let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_source_contract_conflict'))});
test('unknown source ID remains orphaned',()=>{let x=fixture();x.rawRows[0].source_id=SOURCE2;let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_source_missing'))});
test('cross-run source cannot certify the raw observation',()=>{let x=fixture();x.runSources[0].run_id=FEATURE;let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_source_contract_conflict'))});
test('source lacking UUID is rejected',()=>{let x=fixture();x.runSources[0].id='no';let y=reconcile(x);assert(y.events.some(e=>e.code==='source_row_key_conflict'))});
test('raw row asserting a fabricated candidate_id is rejected',()=>{let x=fixture();x.rawRows[0].candidate_id=CAND;let y=reconcile(x);assert(y.events.some(e=>e.code==='untrusted_raw_candidate_id'))});
test('normalizer compaction is honored when raw provider ID casing differs',()=>{let x=fixture();x.rawRows[0].provider_track_id='MDUNDO_123';let y=reconcile(x);assert.equal(y.perCandidate[0].certificates.length,1);assert.equal(y.runIntegrityComplete,true)});
test('two distinct raw IDs collapsing to same compact alias force review',()=>{let x=fixture();x.rawRows.push({...x.rawRows[0],id:RAW2,provider_track_id:'MDUNDO_123'});let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_provider_identity_compaction_collision'));assert.equal(y.runIntegrityComplete,false)});
test('multi-operator raw rows require aggregation review, not silently counted',()=>{let x=fixture();x.runSources.push({id:SOURCE2,run_id:RUN,provider:'spotify',enabled:true});x.rawRows.push({id:RAW2,run_id:RUN,source_id:SOURCE2,provider:'spotify',provider_track_id:'sp-3'});x.candidates[0].provider_ids_json.spotify=['sp-3'];let y=reconcile(x);assert.equal(y.perCandidate[0].operatorKeys.length,2);assert(y.perCandidate[0].problems.some(e=>e.code==='multi_operator_aggregation_unverified'))});
test('many Spotify UGC playlists still one operator, held for deduplication',()=>{let x=fixture();x.runSources=[{id:SOURCE,run_id:RUN,provider:'spotify',enabled:true},{id:SOURCE2,run_id:RUN,provider:'spotify',enabled:true}];x.rawRows=[{id:RAW,run_id:RUN,source_id:SOURCE,provider:'spotify',provider_track_id:'sp-3'},{id:RAW2,run_id:RUN,source_id:SOURCE2,provider:'spotify',provider_track_id:'sp-3'}];x.candidates[0].provider_ids_json={spotify:['sp-3']};let y=reconcile(x);assert.deepEqual(y.perCandidate[0].operatorKeys,['spotify']);assert(y.perCandidate[0].problems.some(e=>e.code==='duplicate_provider_observations_need_reconciliation'))});
test('all outcomes remain non-authorizing when run has more than one operator',async()=>{let x=fixture();x.runSources.push({id:SOURCE2,run_id:RUN,provider:'spotify',enabled:true});x.rawRows.push({id:RAW2,run_id:RUN,source_id:SOURCE2,provider:'spotify',provider_track_id:'sp-3'});x.candidates[0].provider_ids_json.spotify=['sp-3'];let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED');assert.equal(z.mayScore,false)});
test('source count mismatches are a pending gate, not a license to score',()=>{let x=fixture();x.candidates[0].source_count=20;let y=reconcile(x);assert.equal(y.perCandidate[0].operatorKeys.length,1);assert(y.perCandidate[0].problems.some(e=>e.code==='candidate_source_count_mismatch'));assert.equal(y.mayScore,false)});
test('no release-type metadata from Registry remains review',async()=>{let x=fixture();x.verifiedReleaseMetadata=[];let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED');assert(z.filter.reasons.some(r=>r.code==='release_type_unknown'))});
test('unknown role for additional artist remains review',async()=>{let x=fixture();x.registryCredits.push({track_id:TRACK,artist_id:FEATURE,status:'active',is_primary:false});x.registryArtists.push({id:FEATURE,status:'active',origin_iso2:'KE'});let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED')});
test('canonical Track ID not matched -> review',async()=>{let x=fixture();x.acceptedMatches=[];let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED')});
test('cross-run accepted match -> conflict',async()=>{let x=fixture();x.acceptedMatches[0].run_id=FEATURE;let z=await run(x);assert.equal(z.outcome,'CONFLICTED')});
test('raw source payload text is not metadata authority',async()=>{let x=fixture();x.rawRows[0].raw_payload_json={origin_iso2:'KE',release_type:'single',gender:'female'};x.registryArtists[0].origin_iso2=null;x.verifiedReleaseMetadata=[];let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED')});
test('unverified source market does not establish artist country',async()=>{let x=fixture();x.registryArtists[0].origin_iso2=null;let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED')});
test('does not change input arrays or data',async()=>{let x=fixture();let before=JSON.stringify(x);await run(x);assert.equal(JSON.stringify(x),before)});
test('missing complete source arrays fail closed',()=>assert.throws(()=>reconcile({runId:RUN,candidates:[],rawRows:[]}),/complete arrays/));
test('missing run ID is not silently accepted',()=>assert.throws(()=>reconcile({runId:null,candidates:[],rawRows:[],runSources:[]}),/UUID/));
test('duplicate candidate IDs fail',()=>{let x=fixture();x.candidates.push({...x.candidates[0]});let y=reconcile(x);assert(y.events.some(e=>e.code==='candidate_row_key_conflict'))});
test('source ownership is independent of cosmetic title and artist',()=>{let x=fixture();x.rawRows[0].title_raw='Totally unrelated';x.rawRows[0].artist_raw='Unknown';let y=reconcile(x);assert.equal(y.perCandidate[0].certificates.length,1)});
test('invalid standalone raw UUID cannot create candidate proof',()=>{let x=fixture();x.rawRows[0].id='abc';let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_wrong_run_or_key'))});
test('absent provider selection still requires raw evidence',()=>{let x=fixture();x.candidates[0].provider_ids_json={};let y=reconcile(x);assert.equal(y.perCandidate[0].certificates.length,0)});

test('duplicate raw row IDs are quarantined even with distinct source references',()=>{let x=fixture();x.rawRows.push({...x.rawRows[0]});let y=reconcile(x);assert(y.events.some(e=>e.code==='raw_row_duplicate_id'));assert.equal(y.runIntegrityComplete,false)});
test('unknown source count does not become zero by default',()=>{let x=fixture();delete x.candidates[0].source_count;let y=reconcile(x);assert(y.perCandidate[0].problems.some(e=>e.code==='candidate_source_count_invalid'))});
test('run-wide malformed raw evidence prevents clean candidate readiness',async()=>{let x=fixture();x.rawRows.push({id:RAW2,run_id:FEATURE,source_id:SOURCE,provider:'mdundo',provider_track_id:'other'});let z=await run(x);assert.equal(z.outcome,'REVIEW_REQUIRED');assert.equal(z.mayScore,false)});

import {projectSameRunMetadataReview as project} from '../../../supabase/functions/_shared/chart-ingest-run-provenance.mjs';
test('same-run workbench receives review-required origin gaps',async()=>{let x=fixture();x.registryArtists[0].origin_iso2=null;let z=await run(x);let r=project([{candidateId:CAND,evaluation:z}]);assert.equal(r.reviewRowCount,1);assert.equal(r.counts.REVIEW_REQUIRED,1);assert.equal(r.rows[0].originalProviderEvidence[0].sourcePosition,7);assert.equal(r.canAdvanceToScoring,false)});
test('known foreign-origin exclusion is distinct from missing origin review',async()=>{let x=fixture();x.registryArtists[0].origin_iso2='NG';let z=await run(x);let r=project([{candidateId:CAND,evaluation:z}]);assert.equal(r.counts.EXCLUDED,1);assert.equal(r.reviewRowCount,0);assert.equal(r.canAdvanceToScoring,false)});
test('predicates ELIGIBLE cannot authorize a scoring stage',async()=>{let z=await run();let r=project([{candidateId:CAND,evaluation:z}]);assert.equal(r.counts.ELIGIBLE,1);assert.equal(r.canAdvanceToScoring,false);assert.equal(r.mayPublish,false)});
test('missing source-to-candidate association remains in combined review',async()=>{let x=fixture();x.rawRows[0].provider_track_id=null;let z=await run(x);let r=project([{candidateId:CAND,evaluation:z}]);assert.equal(r.counts.REVIEW_REQUIRED,1);assert(r.rows[0].reasons.some(v=>v.code==='candidate_no_certified_raw_evidence'))});
test('conflicted identity retains all provenance reasons',async()=>{let x=fixture();x.registryArtists[0].origin_iso2='KEN';let z=await run(x);let r=project([{candidateId:CAND,evaluation:z}]);assert.equal(r.counts.CONFLICTED,1);assert(r.rows[0].reasons.some(v=>v.code==='invalid_registry_origin'))});
test('empty review projection still cannot authorize chart publication',()=>{let z=project([]);assert.equal(z.noBlockingReviewRows,true);assert.equal(z.canAdvanceToScoring,false);assert.equal(z.mayPublish,false)});
test('duplicate candidate UUID rejects merged review information',async()=>{let z=await run();assert.throws(()=>project([{candidateId:CAND,evaluation:z},{candidateId:CAND,evaluation:z}]),/unique candidate/)});
test('unverified scoring authorization in projection throws',()=>{assert.throws(()=>project([{candidateId:CAND,evaluation:{outcome:'ELIGIBLE',mayScore:true,mayPublish:false}}]),/unexpectedly authorizes/)});
test('unknown result status rejects instead of green review row',()=>{assert.throws(()=>project([{candidateId:CAND,evaluation:{outcome:'OK',mayScore:false,mayPublish:false}}]),/invalid\/unverified/)});
test('project does not edit raw evaluations',async()=>{let z=await run();let input=[{candidateId:CAND,evaluation:z}];let before=JSON.stringify(input);project(input);assert.equal(JSON.stringify(input),before)});

test('review UI cannot inject an arbitrary provider rank',async()=>{let z=await run();let r=project([{candidateId:CAND,evaluation:z,originalProviderEvidence:[{rawRowId:RAW,sourcePosition:1,provider:'mdundo'}]}]);assert.equal(r.rows[0].originalProviderEvidence[0].sourcePosition,7)});
test('raw source rank unverified leaves null, never invented',async()=>{let x=fixture();delete x.rawRows[0].source_position;let z=await run(x);assert.equal(z.originalProviderEvidence[0].sourcePosition,null)});
