import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {prepareWk100AttestedPrivateRanking as prepare}
  from '../../supabase/functions/_shared/wk100-ranking-attested-evidence.mjs';
import {readWk100AttestedRankingPrivate as readServer}
  from '../../supabase/functions/_shared/wk100-ranking-attested-reader.mjs';

const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const sha=x=>createHash('sha256').update(x).digest('hex');
const plusDay=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
const families=['apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke'];
const W='2026-11-09';
const POLICY='a'.repeat(64);
function fixture(week=W){
  const panels=new Map(),originals=new Map();let receiptSeq=10000,rowSeq=40000,contractSeq=9000;
  for(const family of families){
    const days=family==='apple_ke'?7:1,depth=family==='shazam_ke'?200:100;
    const contract={id:id(contractSeq++),source_key:family+'_kenya',provider_key:family,
      market:'KE',native_metric:family==='youtube_ke'?'rank_and_count':'rank',
      admission_state:'candidate',adapter_version:'v1',expected_depth:depth};
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
        raw_object_key:'v1/'+week+'/'+family+'/20261114T120000Z-1/'+digest+'.json',
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
    typedLinks:rows.map(row=>({provider_key:contract.provider_key==='apple_ke'?'apple_music':contract.provider_key,
      provider_track_id:row.provider_track_id,track_id:id(Number(row.provider_track_id.slice(7))),
      match_status:'matched'})),legacyLinks:[],
    activeTracks:rows.map(row=>({id:id(Number(row.provider_track_id.slice(7))),status:'active'})),
  }),
  evaluateW5Row:async ({policySha256})=>({outcome:'ELIGIBLE',policySha256,
    registryFactsSha256:'b'.repeat(64)}),
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
  const changed=await prepare({...config,evaluateW5Row:async (...args)=>
    ({...await config.evaluateW5Row(...args),registryFactsSha256:'c'.repeat(64)})});
  assert.notEqual(result.registrySnapshotSha256,changed.registrySnapshotSha256);
  assert.notEqual(result.rankingDigest,changed.rankingDigest);
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
  await deny((f,a)=>{f.panels.get(f.ids[0]).contract.provider_key='spotify_ke'},/capture_contract_invalid/);
  await deny((f,a)=>{a.loadRegistry=async()=>({typedLinks:[],legacyLinks:[],activeTracks:[]})},/registry_identity_unresolved/);
  await deny((f,a)=>{a.evaluateW5Row=async()=>({outcome:'EXCLUDED',policySha256:POLICY,
    registryFactsSha256:'b'.repeat(64)})},/eligibility_or_registry_facts_unverified/);
  await deny((f,a)=>{a.evaluateW5Row=async()=>({outcome:'ELIGIBLE',policySha256:'f'.repeat(64),
    registryFactsSha256:'b'.repeat(64)})},/eligibility_or_registry_facts_unverified/);
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
    registry_tracks:Array.from({length:200},(_,i)=>({id:id(i+1),status:'active',updated_at:'2026-11-11T10:00:00Z'})),
  };
  const db={from(table){
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
    eligibilityPolicySha256:POLICY,
    evaluateW5Row:async ({policySha256})=>({outcome:'ELIGIBLE',policySha256,
      registryFactsSha256:'b'.repeat(64)}),
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
  const wrong={...deps,selectedReceiptIds:deps.selectedReceiptIds.map((v,i)=>i? v:id(9999))};
  await assert.rejects(()=>readServer(wrong),/exact_row_missing_wk_chart_capture_attempts_v1/);
  await assert.rejects(()=>readServer({...deps,parserAccessBySource:null}),/policy_or_parser_authority_missing/);
  await assert.rejects(()=>readServer({...deps,storage:{from:()=>({download:async()=>({error:new Error('denied')})})}}),
    /private_raw_unavailable/);
});
