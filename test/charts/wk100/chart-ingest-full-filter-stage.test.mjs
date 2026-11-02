import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngestPolicySnapshot} from '../../../supabase/functions/_shared/chart-ingest-policy-snapshot.mjs';
import {prepareFullFilterStage,executeFullFilterStage,FullFilterStageHold,STAGE_DECISION_VERSION} from '../../../supabase/functions/_shared/chart-ingest-full-filter-stage.mjs';

const RUN='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', CAND='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 TRACK='11111111-1111-4111-8111-111111111111',ARTIST='22222222-2222-4222-8222-222222222222',
 RAW='44444444-4444-4444-8444-444444444444', SOURCE='55555555-5555-4555-8555-555555555555',
 RELEASE='66666666-6666-4666-8666-666666666666';
const timestamp='2026-10-30T15:00:00.000Z';
const policy=()=>({eligibilityProfileId:'elig_kenyan',marketScopeId:'scope_kenya',
 eligibilityProfileSnapshot:{id:'elig_kenyan',name:'Kenya',slug:'kenya',visibility:'admin_only',
 artistOriginEligibility:{mode:'country_only',countries:['KE'],regions:[]},artistGenderEligibility:{mode:'any'},artistTypeEligibility:{mode:'any'},
 releaseEligibility:{releaseTypes:['single'],includeReissues:true,includeRemixes:true,includeAcousticVersions:true,includeInstrumentals:true},
 trackEligibility:{explicitAllowed:true,requireIsrc:false,requirePreview:false},
 collaborationRules:{allowFeaturedArtists:true,countFeaturedArtistNationality:false,primaryArtistMustMatchEligibility:true,allArtistsMustMatchEligibility:false},
 sourceRules:{allowedProviders:['mdundo','spotify'],requireAtLeastOneProviderId:true,requireProviderAvailabilityInMarket:false},
 reviewRules:{requireManualReviewForUnknownGender:false,requireManualReviewForUnknownNationality:true,requireManualReviewForUnknownArtistType:false,requireManualReviewForGroups:false,allowUnknownMetadataWithWarning:false}},
 marketScopeSnapshot:{id:'scope_kenya',slug:'kenya',primaryMarketSlug:'kenya',includedMarkets:[{marketSlug:'kenya',countryCode:'KE'}],aggregationMode:'combined',artistOriginCountries:['KE'],artistOriginUnknownMode:'exclude'}});
const client=(fn)=>({from(){throw Error('Unexpected live DB access in injected read fixture');},rpc:fn??(()=>{throw Error('unexpected rpc');})});
async function fixture(){
 const frozen=await createIngestPolicySnapshot(policy(),'admin','2026-10-30T12:00:00.000Z');
 return {runId:RUN,run:{id:RUN,status:'draft',market_slug:'kenya',updated_at:timestamp,rule_snapshot_json:{ingestPolicy:frozen},market_scope_snapshot_json:frozen.marketScopeSnapshot},
 runSources:[{id:SOURCE,run_id:RUN,provider:'mdundo',enabled:true}],
 rawRows:[{id:RAW,run_id:RUN,source_id:SOURCE,provider:'mdundo',provider_track_id:'MDUNDO_123',source_position:7}],
 candidates:[{id:CAND,run_id:RUN,updated_at:timestamp,source_count:1,status:'pending',provider_ids_json:{mdundo:['mdundo-123']}}],
 acceptedMatches:[{id:'77777777-7777-4777-8777-777777777777',run_id:RUN,candidate_id:CAND,entity_type:'track',canonical_entity_id:TRACK,status:'accepted'}],
 registryTracks:[{id:TRACK,title:'A track',isrc:'KEABC2600001',release_id:RELEASE,status:'active',explicit:false,duration_ms:180000}],
 registryCredits:[{id:'88888888-8888-4888-8888-888888888888',track_id:TRACK,artist_id:ARTIST,is_primary:true,status:'active'}],
 registryArtists:[{id:ARTIST,origin_iso2:'KE',status:'active'}],
 registryReleases:[{id:RELEASE,release_type:'single',release_date:'2026-10-05',status:'active'}],
 registryProviderLinks:[],exclusions:[],reviewIssues:[],readCompleteness:true,sourceNativePeriodVerified:false,callerAuthorizationVerified:false};
}
const prepare=async data=>prepareFullFilterStage(client(),RUN,{read:async()=>data});
test('real snapshot + source + Registry + full evaluator => persisted REVIEW, not eligible; correct digest',async()=>{
 const x=await fixture(), r=await prepare(x);
 assert.equal(r.decisions.length,1);assert.equal(r.decisions[0].status,'needs_review');
 assert.equal(r.decisions[0].decision.outcome,'ELIGIBLE');
 assert.equal(r.decisions[0].decision.contract,STAGE_DECISION_VERSION);
 assert.equal(r.decisions[0].decision.policyDigest,x.run.rule_snapshot_json.ingestPolicy.sha256);
 assert(r.decisions[0].decision.reasonCodes.includes('external_acceptance_not_verified'));
 assert.equal(r.summary.canScore,false);assert.equal(r.summary.canCommit,false);
 assert.equal(r.expectedRunUpdatedAt,timestamp);
});
test('verified foreign primary is excluded by country filter without scoring',async()=>{
 const x=await fixture();x.registryArtists[0].origin_iso2='NG';
 const r=await prepare(x);
 assert.equal(r.decisions[0].decision.outcome,'EXCLUDED');assert.equal(r.decisions[0].status,'excluded');
});
test('missing origin remains needs_review with reason',async()=>{
 const x=await fixture();x.registryArtists[0].origin_iso2=null;
 const r=await prepare(x);
 assert.equal(r.decisions[0].decision.outcome,'REVIEW_REQUIRED');assert.equal(r.decisions[0].status,'needs_review');
});
test('tampered frozen profile rejects BEFORE any RPC',async()=>{
 const x=await fixture();x.run.rule_snapshot_json.ingestPolicy.eligibilityProfileSnapshot.artistOriginEligibility.countries=['US'];
 await assert.rejects(()=>prepare(x),e=>e instanceof FullFilterStageHold&&e.code==='policy_integrity_unverified');
});
test('disconnected market rejects before any write',async()=>{
 const x=await fixture();x.run.market_slug='uganda';
 await assert.rejects(()=>prepare(x),e=>e.code==='market_scope_ambiguous');
});
test('missing candidate version blocks atomic stage',async()=>{
 const x=await fixture();delete x.candidates[0].updated_at;
 await assert.rejects(()=>prepare(x),e=>e.code==='candidate_version_missing');
});
test('run mutation or missing run version blocks stage',async()=>{
 const x=await fixture();delete x.run.updated_at;
 await assert.rejects(()=>prepare(x),e=>e.code==='run_version_missing');
});
test('incomplete caller read refuses any persistence',async()=>{
 await assert.rejects(()=>prepareFullFilterStage(client(),RUN,{read:async()=>{throw Error('private connection detail')}}),
 e=>e.code==='caller_scoped_read_failed'&&!e.message.includes('private'));
});
test('valid draft passes to exactly one caller-JWT RPC, remains nonauthorizing',async()=>{
 const x=await fixture();let calls=[];
 const db=client(async(name,params)=>{calls.push({name,params});return {data:{ok:true,decisionCount:1},error:null};});
 const r=await executeFullFilterStage(db,RUN,{prepare:()=>prepare(x)});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'chart_apply_full_filter_decisions_v1');
 assert.equal(calls[0].params.p_expected_run_updated_at,timestamp);
 assert.equal(calls[0].params.p_decisions[0].status,'needs_review');
 assert.equal(r.persisted,true);assert.equal(r.canScore,false);assert.equal(r.canCommit,false);
});
test('transactional function absent or RLS denied fails closed',async()=>{
 const x=await fixture();const db=client(async()=>({data:null,error:{code:'42501',message:'RLS private'}}));
 await assert.rejects(()=>executeFullFilterStage(db,RUN,{prepare:()=>prepare(x)}),e=>e.code==='transactional_decision_write_failed'&&!e.message.includes('private'));
});
test('transaction receipt must verify complete count',async()=>{
 const x=await fixture();const db=client(async()=>({data:{ok:true,decisionCount:0},error:null}));
 await assert.rejects(()=>executeFullFilterStage(db,RUN,{prepare:()=>prepare(x)}),e=>e.code==='transactional_receipt_not_verified');
});
test('caller cannot forge a scoreable decision through stage handoff',async()=>{
 const db=client(async()=>{throw Error('must not be called')});
 await assert.rejects(()=>executeFullFilterStage(db,RUN,{prepare:async()=>({runId:RUN,decisions:[{candidateId:CAND,status:'eligible'}]})}),
 e=>e.code==='unsafe_eligible_write');
});
test('malformed and duplicate candidate set prevents stage execution',async()=>{
 const x=await fixture();x.candidates.push({...x.candidates[0]});
 await assert.rejects(()=>prepare(x),e=>e.code==='candidate_ids_not_unique');
});
test('empty candidate set is a non-authorizing hold',async()=>{
 const x=await fixture();x.candidates=[];
 await assert.rejects(()=>prepare(x),e=>e.code==='candidate_batch_not_accepted');
});
test('server read cannot lift historic period status in Stage v1',async()=>{
 const x=await fixture();x.sourceNativePeriodVerified=true;x.callerAuthorizationVerified=true;
 const r=await prepare(x);assert.equal(r.decisions[0].status,'needs_review');
});

test('manual editorial exclusion is never revived by full-filter execution',async()=>{
 const x=await fixture();x.candidates[0].status='excluded';
 x.exclusions=[{id:'88888888-0000-4000-8000-000000000001',run_id:RUN,candidate_id:CAND,
   reason_code:'manual_exclude',source_stage:'manual',severity:'hard'}];
 const r=await prepare(x);assert.equal(r.decisions[0].status,'excluded');
 assert.equal(r.decisions[0].decision.outcome,'EXCLUDED');
 assert(r.decisions[0].decision.reasonCodes.includes('manual_exclude'));
});
test('ignored candidate remains ignored and not scored',async()=>{
 const x=await fixture();x.candidates[0].status='ignored';
 const r=await prepare(x);assert.equal(r.decisions[0].status,'ignored');
 assert.equal(r.decisions[0].decision.canScore,false);
 assert(r.decisions[0].decision.reasonCodes.includes('preexisting_ignored_preserved'));
});
test('normalization exclusions are preserved independently of country filter',async()=>{
 const x=await fixture();x.exclusions=[{id:'88888888-0000-4000-8000-000000000001',run_id:RUN,candidate_id:CAND,
   reason_code:'invalid_normalized_key',source_stage:'normalize',severity:'hard'}];
 const r=await prepare(x);assert.equal(r.decisions[0].status,'excluded');
 assert(r.decisions[0].decision.reasonCodes.includes('invalid_normalized_key'));
});
test('unresolved manual issue remains an explicit review reason',async()=>{
 const x=await fixture();x.reviewIssues=[{id:'88888888-0000-4000-8000-000000000001',run_id:RUN,candidate_id:CAND,
   issue_type:'metadata',status:'open',blocking:true}];
 const r=await prepare(x);
 assert.equal(r.decisions[0].status,'needs_review');
 assert(r.decisions[0].decision.reasonCodes.includes('open_blocking_review_issue'));
});
test('cross-run exclusion cannot contaminate this chart run',async()=>{
 const x=await fixture();x.exclusions=[{run_id:RAW,candidate_id:CAND,source_stage:'manual',reason_code:'manual_exclude'}];
 await assert.rejects(()=>prepare(x),e=>e.code==='cross_run_exclusion');
});
test('cross-run issue cannot contaminate review',async()=>{
 const x=await fixture();x.reviewIssues=[{run_id:RAW,candidate_id:CAND,status:'open',blocking:true}];
 await assert.rejects(()=>prepare(x),e=>e.code==='cross_run_review_issue');
});
test('exclusion referring to missing candidate fails closed',async()=>{
 const x=await fixture();x.exclusions=[{run_id:RUN,candidate_id:RAW,reason_code:'manual_exclude',source_stage:'manual'}];
 await assert.rejects(()=>prepare(x),e=>e.code==='exclusion_candidate_mismatch');
});
test('a run-wide blocking issue holds the entire run',async()=>{
 const x=await fixture();x.reviewIssues=[{run_id:RUN,candidate_id:null,status:'open',blocking:true}];
 const r=await prepare(x);
 assert(r.decisions[0].decision.reasonCodes.includes('open_blocking_review_issue'));
 assert.equal(r.summary.openBlockingReviewIssues,1);
});

test('retired and in-commit runs are never reopened by frozen-stage re-evaluation',async()=>{
  for(const status of ['retired','committed','published','cancelled','publishing','commit_pending','ready_to_commit','committing','unknown']){
    const x=await fixture();x.run.status=status;
    await assert.rejects(()=>prepare(x),e=>e instanceof FullFilterStageHold&&e.code==='run_terminal_or_unknown_status',status);
  }
});
test('materialized committed candidate cannot be downgraded, even in otherwise draft run',async()=>{
  const x=await fixture();x.candidates[0].status='committed';
  await assert.rejects(()=>prepare(x),e=>e instanceof FullFilterStageHold&&e.code==='committed_candidate_not_reprocessable');
});
test('missing run status refuses a complete-looking read rather than guessing eligibility',async()=>{
  const x=await fixture();delete x.run.status;
  await assert.rejects(()=>prepare(x),e=>e instanceof FullFilterStageHold&&e.code==='run_terminal_or_unknown_status');
});

test('full stage persists review-only disposition when canonical provider link is still under Registry review',async()=>{
 const x=await fixture();x.registryProviderLinks=[{id:'99999999-9999-4999-8999-999999999999',track_id:TRACK,provider_key:'mdundo',provider_track_id:'MDUNDO_123',match_status:'needs_review'}];
 const result=await prepare(x);
 assert.equal(result.decisions[0].status,'needs_review');
 assert.equal(result.decisions[0].decision.outcome,'REVIEW_REQUIRED');
 assert(result.decisions[0].decision.reasonCodes.includes('provider_link_not_accepted'));
 assert.equal(result.decisions[0].decision.canScore,false);
});
test('full stage preserves hard Registry provider-link rejection as conflicted review, not eligibility',async()=>{
 const x=await fixture();x.registryProviderLinks=[{id:'99999999-9999-4999-8999-999999999999',track_id:TRACK,provider_key:'mdundo',provider_track_id:'MDUNDO_123',match_status:'rejected'}];
 const result=await prepare(x);
 assert.equal(result.decisions[0].decision.outcome,'CONFLICTED');
 assert.equal(result.decisions[0].status,'needs_review');
 assert.equal(result.summary.canCommit,false);
});
