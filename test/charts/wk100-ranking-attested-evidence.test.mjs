import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareWk100AttestedPrivateRanking as prepare}
  from '../../supabase/functions/_shared/wk100-ranking-attested-evidence.mjs';
import {readWk100AttestedRankingPrivate as readServer}
  from '../../supabase/functions/_shared/wk100-ranking-attested-reader.mjs';
import {inspectWk100RankWeek} from '../../supabase/functions/_shared/wk100-ranking-evidence-review.mjs';
import {readFile} from 'node:fs/promises';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sha=x=>createHash('sha256').update(x).digest('hex');
const plusDay=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const families=['apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke'];
const W='2026-11-09';
const AUTH_EXPIRES=new Date(Date.now()+30*86_400_000).toISOString();
// This is a valid synthetic saved policy, not a bypassed W5 verdict.
const PROFILE={
  id:'wk100-test',name:'WK100 test',slug:'wk100-test',
  artistOriginEligibility:{mode:'any',countries:[],regions:[]},
  artistGenderEligibility:{mode:'any'},
  artistTypeEligibility:{mode:'any'},
  releaseEligibility:{releaseTypes:['single'],includeReissues:true,includeRemixes:true,
    includeAcousticVersions:true,includeInstrumentals:true},
  trackEligibility:{explicitAllowed:true,requireIsrc:false,requirePreview:false},
  collaborationRules:{allowFeaturedArtists:true,countFeaturedArtistNationality:false,
    primaryArtistMustMatchEligibility:false,allArtistsMustMatchEligibility:false},
  sourceRules:{allowedProviders:['apple_music','shazam','mdundo','youtube','audiomack'],
    requireAtLeastOneProviderId:false,requireProviderAvailabilityInMarket:false},
  reviewRules:{requireManualReviewForUnknownGender:false,
    requireManualReviewForUnknownNationality:false,requireManualReviewForUnknownArtistType:false,
    requireManualReviewForGroups:false,allowUnknownMetadataWithWarning:true},
};
const SCOPE={id:'ke',name:'Kenya',slug:'ke',primaryMarketSlug:'KE',
  includedMarkets:[{marketSlug:'KE',countryCode:'KE'}],
  aggregationMode:'combined',artistOriginCountries:[],artistOriginUnknownMode:'warn'};
const canonical=v=>JSON.stringify(v,(_key,value)=>
  value&&typeof value==='object'&&!Array.isArray(value)
    ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b))):value);
const POLICY=sha(canonical({profileId:PROFILE.id,marketScopeId:SCOPE.id,
  eligibilityProfileSnapshot:PROFILE,marketScopeSnapshot:SCOPE}));
const draft=()=>({week_start_eat:W,revision:1,updated_by:id(999),
  updated_at:'2026-11-11T11:00:00Z',config_json:{
    schemaVersion:'wk100-admin-edition-config/v1',programId:'top100',
    weekStartEat:W,market:'KE',chartSize:100,
    eligibilityProfileId:PROFILE.id,marketScopeId:SCOPE.id,
    eligibilityProfileSnapshot:PROFILE,marketScopeSnapshot:SCOPE,
    ingestPolicySha256:POLICY}});
function factsForRows(rows){
  const ids=[...new Set(rows.map(r=>Number(r.provider_track_id?.slice(7)))
    .filter(Number.isInteger))];
  return {
    registryTracks:ids.map(n=>({id:id(n),status:'active',title:'Song '+n,
      release_id:id(50000+n),explicit:false,metadata:{},updated_at:'2026-11-11T10:00:00Z'})),
    registryCredits:ids.map(n=>({track_id:id(n),artist_id:id(20000+n),
      status:'active',role:'primary_artist',is_primary:true})),
    registryArtists:ids.map(n=>({id:id(20000+n),status:'active',origin_iso2:'KE'})),
    registryReleases:ids.map(n=>({id:id(50000+n),status:'active',
      release_type:'single',release_date:'2026-09-01',metadata:{}})),
  };
}
function fixture(week=W){
  const panels=new Map(),originals=new Map();let receiptSeq=10000,rowSeq=40000,contractSeq=9000;
  for(const family of families){
    const days=family==='apple_ke'?7:1,depth=family==='shazam_ke'?200:100;
    const contract={id:id(contractSeq++),source_key:family+'_kenya',provider_key:family,
      market:'KE',native_metric:family==='youtube_ke'?'rank_and_count':'rank',
      admission_state:'candidate',adapter_version:'v1',adapter_sha256:'c'.repeat(64),
      contract_version:'v1',expected_depth:depth};
    for(let day=0;day<days;day++){
      const receiptId=id(receiptSeq++);
      const native=Array.from({length:depth},(_,k)=>({rank:k+1,
        provider_track_id:'native-'+(k+1),title:'Song '+(k+1),artist:'Artist '+(k+1),
        ...(family==='youtube_ke'?{view_count:100000-k*3}:{})}));
      const raw=new TextEncoder().encode(JSON.stringify(native));
      const digest=sha(raw);
      const rows=native.map(n=>({id:id(rowSeq++),attempt_id:receiptId,
        source_rank:n.rank,provider_track_id:n.provider_track_id,
        title_observed:n.title,artist_observed:n.artist,
        source_native_count:family==='youtube_ke'?String(n.view_count):null}));
      const t=family==='apple_ke'?day:family==='youtube_ke'?5:3;
      const at=plusDay(week,t)+'T12:00:00Z';
      const attempt={id:receiptId,contract_id:contract.id,week_start_eat:week,
        status:'succeeded',observed_market:'KE',observed_depth:depth,record_count:depth,
        fetched_at:at,payload_sha256:digest,
        raw_object_key:'v1/'+week+'/'+contract.source_key+'/20261114T120000Z-1/'+digest+'.json',
        native_period_authority:family==='youtube_ke'?'provider_defined':'observed_as_of',
        native_period_start:family==='youtube_ke'?plusDay(week,-2)+'T10:00:00Z':null,
        native_period_end:family==='youtube_ke'?plusDay(week,5)+'T10:00:00Z':null,
        native_period_evidence_ref:family==='youtube_ke'?'verified_period_key':null};
      panels.set(receiptId,{contract,attempt,rows,
        parserAccess:family==='youtube_ke'?{native_period_key:'verified_period_key'}:{}});
      originals.set(receiptId,raw);
    }
  }
  const ids=[...panels.keys()];
  return {ids,panels,originals};
}
function adapters(f){return {weekStartEat:W,selectedReceiptIds:f.ids,
  eligibilityPolicySha256:POLICY,
  loadCapture:async id=>f.panels.get(id),
  readPrivateBytes:async attempt=>f.originals.get(attempt.id),
  loadRegistry:async ({contract,rows})=>({
    typedLinks:rows.filter(row=>row.provider_track_id).map(row=>({
      provider_key:contract.provider_key==='apple_ke'?'apple_music':contract.provider_key,
      provider_track_id:row.provider_track_id,track_id:id(Number(row.provider_track_id.slice(7))),
      match_status:'matched'})),legacyLinks:[],
    activeTracks:rows.filter(row=>row.provider_track_id).map(row=>({
      id:id(Number(row.provider_track_id.slice(7))),status:'active'})),
    ...factsForRows(rows),
  }),
  loadW5Draft:async()=>draft(),
  // The repository's real native parser is selected in production. Test input
  // deliberately uses a synthetic JSON parser; it does not attest providers.
  parseNativeRows:async bytes=>JSON.parse(new TextDecoder().decode(bytes)),
};}
test('server-only handoff binds 11 exact receipts, originals, Registry and W5',async()=>{
  const f=fixture();const config=adapters(f);
  const result=await prepare(config);
  assert.equal(result.status,'private_research_handoff');
  assert.equal(result.canPublish,false);assert.equal(result.canStage,false);
  assert.equal(result.sourceReceiptCount,11);
  assert.equal(result.privateRanking.ranked.length,100);
  assert.equal(result.privateRanking.ranked[0].score,100);
  assert.equal(result.privateRanking.ranked[0].recordingId,id(1));
  assert.match(result.registrySnapshotSha256,/^[a-f0-9]{64}$/);
  const ordered=await prepare({...config,selectedReceiptIds:[...f.ids].reverse()});
  assert.equal(result.rankingDigest,ordered.rankingDigest);
  assert.equal(result.registrySnapshotSha256,ordered.registrySnapshotSha256);
  const changed=await prepare({...config,loadRegistry:async arg=>{
    const original=await config.loadRegistry(arg);
    return {...original,registryTracks:original.registryTracks.map((track,i)=>
      i===0?{...track,title:'Accepted corrected title'}:track)};
  }});
  assert.notEqual(result.registrySnapshotSha256,changed.registrySnapshotSha256);
  assert.notEqual(result.rankingDigest,changed.rankingDigest);
});

test('original excluded and unresolved ranks remain non-scoring without renumbering',async()=>{
  const f=fixture(),a=adapters(f),load=a.loadRegistry;
  a.loadRegistry=async arg=>{
    const base=await load(arg);
    const first=arg.rows[0].provider_track_id;
    return {...base,
      typedLinks:base.typedLinks.filter(link=>link.provider_track_id!==first),
      registryReleases:base.registryReleases.map((release,i)=>i===1
        ?{...release,release_type:'album'}:release)};
  };
  const result=await prepare(a);
  assert.equal(result.canPublish,false);
  assert.equal(result.privateRanking.ranked.length,100);
  assert(result.heldPositions.REVIEW_REQUIRED>=11);
  assert(result.heldPositions.EXCLUDED>=11);
  assert.equal(result.privateRanking.ranked.find(x=>x.recordingId===id(1)),undefined);
  // Original positions 1 and 2 are retained; rank 3 is not promoted to rank 1.
  const originalFirstScore=result.privateRanking.ranked.find(x=>x.recordingId===id(3));
  assert(originalFirstScore&&originalFirstScore.score<100);
  const reordered=await prepare({...a,selectedReceiptIds:[...f.ids].reverse()});
  assert.equal(result.rankingDigest,reordered.rankingDigest);
});
async function deny(change,expected){
  const f=fixture(),a=adapters(f);change(f,a);
  await assert.rejects(()=>prepare(a),expected);
}
test('private handoff fails closed on provenance, native bytes and policy',async()=>{
  await deny((f,a)=>{a.selectedReceiptIds.pop()},/selection_invalid/);
  await deny((f,a)=>{a.selectedReceiptIds[1]=a.selectedReceiptIds[0]},/selection_invalid/);
  await deny((f,a)=>{f.originals.set(f.ids[0],new TextEncoder().encode('tampered'))},/original_digest_mismatch/);
  await deny((f,a)=>{f.panels.get(f.ids[0]).rows[0].title_observed='forged'},
    /native_original_does_not_match_database/);
  await deny((f,a)=>{f.panels.get(f.ids[0]).attempt.status='partial_depth'},/receipt_incomplete_or_unbound/);
  await deny((f,a)=>{f.panels.get(f.ids[0]).attempt.fetched_at='2026-11-01T12:00:00Z'},/observation_outside_week/);
  await deny((f,a)=>{f.panels.get(f.ids[0]).attempt.raw_object_key='../../public.json'},/receipt_incomplete_or_unbound/);
  await deny((f,a)=>{f.panels.get(f.ids[0]).attempt.raw_object_key=f.panels.get(f.ids[0]).attempt.raw_object_key.replace('apple_ke_kenya','mdundo_ke_kenya')},/receipt_incomplete_or_unbound/);
  await deny((f,a)=>{f.panels.get(f.ids[0]).contract.provider_key='spotify_ke'},/capture_contract_invalid/);
  await deny((f,a)=>{a.loadRegistry=async()=>({typedLinks:[],legacyLinks:[],
    activeTracks:[],registryTracks:[],registryCredits:[],registryArtists:[],registryReleases:[]})},
    /fewer_than_100_recordings/);
  await deny((f,a)=>{a.eligibilityPolicySha256='f'.repeat(64)},
    /saved_w5_policy_missing_or_stale/);
  await deny((f,a)=>{a.loadW5Draft=null},/restricted_server_dependencies_missing/);
  await deny((f,a)=>{f.panels.get(f.ids[9]).attempt.native_period_evidence_ref='different'},/youtube_period_original_unbound/);
  await deny((f,a)=>{f.panels.get(f.ids[9]).rows[0].source_native_count='9000000000000000000000'},
    /native_original_does_not_match_database/);
});

function fakeServiceBackend(f){
  const panels=[...f.panels.values()];
  const tables={
    wk_chart_capture_attempts_v1:panels.map(x=>x.attempt),
    wk_chart_capture_contracts_v1:[...new Map(panels.map(x=>[x.contract.id,x.contract])).values()],
    wk_chart_capture_rows_v1:panels.flatMap(x=>x.rows),
    registry_track_provider_links:families.flatMap(family=>
      Array.from({length:family==='shazam_ke'?200:100},(_,i)=>({
        provider_key:family==='apple_ke'?'apple_music':family,
        provider_track_id:'native-'+(i+1),track_id:id(i+1),match_status:'matched'}))),
    provider_entity_links:[],
    registry_tracks:Array.from({length:200},(_,i)=>({
      id:id(i+1),status:'active',title:'Song '+(i+1),release_id:id(50001+i),
      explicit:false,metadata:{},updated_at:'2026-11-11T10:00:00Z'})),
    registry_track_artists:Array.from({length:200},(_,i)=>({
      track_id:id(i+1),artist_id:id(20001+i),status:'active',
      role:'primary_artist',is_primary:true})),
    registry_artists:Array.from({length:200},(_,i)=>({
      id:id(20001+i),status:'active',origin_iso2:'KE'})),
    registry_releases:Array.from({length:200},(_,i)=>({
      id:id(50001+i),status:'active',release_type:'single',
      release_date:'2026-09-01',metadata:{}})),
  };
  const methodRows=tables.wk_chart_capture_contracts_v1.map(contract=>({
    source_key:contract.source_key,provider_key:contract.provider_key,
    decision_state:'collector_admitted',proposal_revision:1,decision_revision:1,
    contract_version:contract.contract_version,parser_class:contract.adapter_version,
    method_class:contract.provider_key==='youtube_ke'?'provider_api':
      contract.provider_key==='audiomack_ke'?'reviewed_page_adapter':'provider_api',
    native_period_state:contract.provider_key==='youtube_ke'?'provider_defined':'observed_as_of',
    native_period_evidence_ref:contract.provider_key==='youtube_ke'
      ?'weekly:20261109:20261115:ke':'observed_as_of/kenya_research',
    endpoint_sha256:'d'.repeat(64),evidence_sha256:'e'.repeat(64),
    authorization_ref:'reviewed_source_method',authorization_expires_at:AUTH_EXPIRES,
    constitution_version:'wk100-fixed-v1',
  }));
  const db={async rpc(name){
    assert.equal(name,'wk100_service_admitted_methods_v1');
    return {data:methodRows,error:null};
  },from(table){
    assert(table in tables,table);
    let values=tables[table];
    const q={select(){return q;},eq(k,v){values=values.filter(x=>x[k]===v);return q;},
      in(k,vs){values=values.filter(x=>vs.includes(x[k]));return q;},
      async limit(n){return {data:values.slice(0,n),error:null}}};return q;
  }};
  const storage={from(bucket){assert.equal(bucket,'wk-chart-raw-evidence-v1');
    return {async download(key){const pair=panels.find(x=>x.attempt.raw_object_key===key);
      const raw=f.originals.get(pair?.attempt.id);
      if(!raw)return {data:null,error:new Error('not found')};
      return {data:{size:raw.byteLength,arrayBuffer:async()=>raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)},error:null};
    }};
  }};
  return {db,storage,weekStartEat:W,selectedReceiptIds:f.ids,
    eligibilityPolicySha256:POLICY,sourceConstitutionVersion:'wk100-fixed-v1',
    methodRows,
    caller:{auth:{getUser:async()=>({data:{user:{id:id(999)}},error:null})},
      rpc:async (method,args)=>{
        if(method==='current_user_has_capability')
          return {data:['manage_ingest','manage_charts','view_registry']
            .includes(args.required_capability),error:null};
        if(method==='wk100_get_admin_draft_v1')
          return {data:{weekStartEat:W,revision:1,updatedAt:'2026-11-11T11:00:00Z',
            config:draft().config_json},error:null};
        throw Error('Unexpected RPC '+method);
      }},
    parserAccessBySource:async (contract,attempt)=>
      f.panels.get(attempt.id).parserAccess,
    parseNativeRows:async bytes=>JSON.parse(new TextDecoder().decode(bytes))};
}
test('restricted Supabase/Storage shaped reader uses exact receipts, not a latest-source lookup',async()=>{
  const fixtureData=fixture();const deps=fakeServiceBackend(fixtureData);
  const read=await readServer(deps);
  const direct=await prepare(adapters(fixtureData));
  assert.equal(read.rankingDigest,direct.rankingDigest);
  assert.equal(read.registrySnapshotSha256,direct.registrySnapshotSha256);
  assert.equal(read.canPublish,false);
  assert.match(read.sourceAdmissionSnapshotSha256,/^[a-f0-9]{64}$/);
  const reordered=await readServer({...deps,selectedReceiptIds:[...deps.selectedReceiptIds].reverse()});
  assert.equal(read.sourceAdmissionSnapshotSha256,
    reordered.sourceAdmissionSnapshotSha256);
  const sourceChanged=fakeServiceBackend(fixtureData);
  sourceChanged.methodRows[0].evidence_sha256='f'.repeat(64);
  const changed=await readServer(sourceChanged);
  assert.notEqual(read.sourceAdmissionSnapshotSha256,
    changed.sourceAdmissionSnapshotSha256);
  // Method changes do not secretly modify the fixed ranking calculation.
  assert.equal(read.rankingDigest,changed.rankingDigest);
  const wrong={...deps,selectedReceiptIds:deps.selectedReceiptIds.map((v,i)=>i? v:id(9999))};
  await assert.rejects(()=>readServer(wrong),/exact_row_missing_wk_chart_capture_attempts_v1/);
  await assert.rejects(()=>readServer({...deps,parserAccessBySource:null}),/parser_authority_missing/);
  await assert.rejects(()=>readServer({...deps,sourceConstitutionVersion:null}),
    /server_constitution_missing/);
  await assert.rejects(()=>readServer({...deps,caller:{...deps.caller,
    rpc:async()=>({data:false,error:null})}}),/caller_capability_missing/);
  await assert.rejects(()=>readServer({...deps,eligibilityPolicySha256:'f'.repeat(64)}),
    /current_w5_policy_mismatch/);
  await assert.rejects(()=>readServer({...deps,storage:{from:()=>({download:async()=>({error:new Error('denied')})})}}),
    /private_raw_unavailable/);
});
test('restricted reader gates exact current service-only method, parser and constitution',async()=>{
  const deny=async (change,expected)=>{
    const f=fixture(),deps=fakeServiceBackend(f);
    change(deps);
    await assert.rejects(()=>readServer(deps),expected);
  };
  await deny(x=>{x.methodRows.length=0},/source_method_not_current/);
  await deny(x=>{x.methodRows[0].decision_state='paused'},/source_method_not_current/);
  await deny(x=>{x.methodRows[0].authorization_expires_at='2000-01-01T00:00:00Z'},
    /source_method_not_current/);
  await deny(x=>{x.methodRows[0].provider_key='spotify_ke'},/source_method_not_current/);
  await deny(x=>{x.methodRows[0].contract_version='forged'},/source_method_not_current/);
  await deny(x=>{x.methodRows[0].parser_class='wrong'},/source_method_not_current/);
  await deny(x=>{x.methodRows[0].constitution_version='old'},/source_method_not_current/);
  await deny(x=>{x.methodRows[0].native_period_state='provider_defined'},
    /source_method_not_current/);
  await deny(x=>{x.methodRows.push({...x.methodRows[0]})},/source_method_not_current/);
  await deny(x=>{x.methodRows.find(y=>y.provider_key==='youtube_ke').method_class='reviewed_page_adapter'},
    /source_method_not_current/);
  await deny(x=>{x.db.rpc=async()=>({data:null,error:new Error('denied')})},
    /source_method_projection_unavailable/);
  await deny(x=>{x.db.rpc=null},/service_method_reader_missing/);
});
test('private ranking rejects source admission revoked during immutable replay',async()=>{
  const deps=fakeServiceBackend(fixture());
  const original=deps.db.rpc;let reads=0;
  deps.db.rpc=async name=>{
    const result=await original(name);
    reads+=1;
    if(reads===2)result.data[0].decision_revision+=1;
    return result;
  };
  await assert.rejects(()=>readServer(deps),/source_method_changed/);
  assert.equal(reads,2);
});


function completeW8Week(){
  const contracts=families.map((family,i)=>({
    id:id(900+i),source_key:family+'_weekly_songs',
    provider_key:family,market:'KE',native_metric:family==='youtube_ke'?
      'rank_and_count':'rank',expected_depth:family==='shazam_ke'?200:100,
    admission_state:'candidate',
  }));
  const attempts=[];let seq=11000;
  for(const c of contracts){
    const days=c.provider_key==='apple_ke'?7:1;
    for(let day=0;day<days;day++){
      const d=c.provider_key==='youtube_ke'?6:day;
      attempts.push({
        id:id(seq++),contract_id:c.id,week_start_eat:W,status:'succeeded',
        observed_depth:c.expected_depth,record_count:c.expected_depth,
        fetched_at:plusDay(W,d)+'T12:00:00Z',
        native_period_authority:c.provider_key==='youtube_ke'?
          'provider_defined':'observed_as_of',
        native_period_start:c.provider_key==='youtube_ke'?
          '2026-11-08T00:00:00Z':null,
        native_period_end:c.provider_key==='youtube_ke'?
          '2026-11-15T00:00:00Z':null,
        native_period_evidence_ref:c.provider_key==='youtube_ke'?
          'weekly:20261108:20261114:ke':null,
      });
    }
  }
  return {weekStartEat:W,contracts,attempts};
}
test('W8 reader rejects saved W5 policy revision changed during source replay',async()=>{
  const deps=fakeServiceBackend(fixture());
  const rpc=deps.caller.rpc;let draftReads=0;
  deps.caller.rpc=async (method,args)=>{
    const response=await rpc(method,args);
    if(method==='wk100_get_admin_draft_v1'&&++draftReads===2)
      return {data:{...response.data,revision:2},error:null};
    return response;
  };
  await assert.rejects(()=>readServer(deps),/current_w5_policy_changed/);
  assert.equal(draftReads,2);
});
test('W8B/W9 deterministic week selection requires 11 actual complete checkpoints',()=>{
  const clean=completeW8Week();
  const ready=inspectWk100RankWeek(clean);
  assert.equal(ready.readyForPrivateReplay,true);
  assert.equal(ready.selectedReceiptIds.length,11);
  assert.equal(ready.canStage,false);
  assert.equal(ready.canPublish,false);
  const shuffled=inspectWk100RankWeek({...clean,attempts:[...clean.attempts].reverse()});
  assert.deepEqual(ready.selectedReceiptIds,shuffled.selectedReceiptIds);
  assert.deepEqual(ready.families.map(x=>x.issues),shuffled.families.map(x=>x.issues));
  const missing=inspectWk100RankWeek({...clean,
    attempts:clean.attempts.filter(x=>x.id!==clean.attempts[0].id)});
  assert.equal(missing.readyForPrivateReplay,false);
  assert.equal(missing.selectedReceiptIds.length,4);
  assert(missing.families[0].issues.includes('checkpoints_missing'));
  const partial=structuredClone(clean);
  partial.attempts.find(x=>x.contract_id===partial.contracts[2].id).status='partial_depth';
  partial.attempts.find(x=>x.contract_id===partial.contracts[2].id).observed_depth=99;
  partial.attempts.find(x=>x.contract_id===partial.contracts[2].id).record_count=99;
  const held=inspectWk100RankWeek(partial);
  assert.equal(held.readyForPrivateReplay,false);
  assert(held.families[2].issues.includes('partial_original_retained'));
  const unknown=structuredClone(clean);
  unknown.attempts.find(x=>x.contract_id===unknown.contracts[0].id)
    .native_period_authority='unknown';
  const unverified=inspectWk100RankWeek(unknown);
  assert.equal(unverified.readyForPrivateReplay,false);
  assert(unverified.families[0].issues.includes('native_period_unverified'));
  const duplicate=structuredClone(clean);
  duplicate.attempts.push({...duplicate.attempts[0],id:id(123456)});
  const ambiguous=inspectWk100RankWeek(duplicate);
  assert.equal(ambiguous.readyForPrivateReplay,false);
  assert(ambiguous.families[0].issues.includes('duplicate_day_or_receipt'));
  const olderFailed=structuredClone(clean);
  olderFailed.attempts.push({...olderFailed.attempts[0],
    id:id(99881),status:'partial_depth',observed_depth:99,record_count:99,
    native_period_authority:'unknown'});
  assert.equal(inspectWk100RankWeek(olderFailed).readyForPrivateReplay,true);
  const competing=structuredClone(clean);
  competing.contracts.push({...competing.contracts[0],id:id(99999)});
  assert.equal(inspectWk100RankWeek(competing).readyForPrivateReplay,false);
});
test('W8B does not promote 399 retained Production-shaped positions into a Top 100',()=>{
  const x=completeW8Week();
  const kept=new Set(['apple_ke','shazam_ke','mdundo_ke']);
  x.contracts=x.contracts.filter(c=>kept.has(c.provider_key));
  x.attempts=x.attempts.filter(a=>x.contracts.some(c=>c.id===a.contract_id));
  x.attempts=x.attempts.filter(a=>a.contract_id!==x.contracts[0].id||
    a.id===x.attempts[0].id);
  x.attempts.forEach(a=>{a.native_period_authority='unknown';});
  const m=x.attempts.find(a=>a.contract_id===x.contracts[2].id);
  m.status='partial_depth';m.observed_depth=99;m.record_count=99;
  const r=inspectWk100RankWeek(x);
  assert.equal(r.readyForPrivateReplay,false);
  assert.deepEqual(r.selectedReceiptIds,[]);
  assert.equal(r.families.find(f=>f.family==='youtube_ke').observedAttempts,0);
  assert.equal(r.families.find(f=>f.family==='audiomack_ke').observedAttempts,0);
});
test('W8 W8S W8B W9 server contract remains JWT-gated, read-only and nonpublishing',async()=>{
  const src=await readFile('supabase/functions/wk100-source-admin-read/index.ts','utf8');
  const ui=await readFile('src/pages/admin/charts/wk100-operations/Wk100Ranking.tsx','utf8');
  assert.match(src,/read_private_ranking/);
  assert.match(src,/readWk100AttestedRankingPrivate/);
  assert.match(src,/registry_review_not_authorized/);
  assert.match(src,/sourceConstitutionVersion:version/);
  assert.match(src,/selectedReceiptIds:inventory.selectedReceiptIds/);
  assert.match(src,/canStage:false,canPublish:false/);
  assert.doesNotMatch(src,/action==='ranking'.{0,200}publishImmediately/s);
  for(const stage of ['data-wk100-w8-ranking','data-wk100-w8s-explanation',
    'data-wk100-w8b-incomplete','data-wk100-w9-readiness'])
    assert(ui.includes(stage),stage);
  assert.match(ui,/No staging or publication command is available on this screen/);
  assert.match(ui,/rankingState==='private_candidate'/);
  assert.match(ui,/r\.canStage!==false\|\|r\.canPublish!==false/);
});
