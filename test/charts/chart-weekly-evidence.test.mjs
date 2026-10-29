import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
 trackingWeek, checkpointsForSource, validateReceipt, prepareWeeklyEvidenceFreeze,
} from '../../supabase/functions/_shared/chart-weekly-evidence.mjs';

const SH = 'f'.repeat(64);
const day = (source_key='audiomack_ke') => ({
  source_key,behavior:'consumption',metric:'rank',market:'KE',depth:100,
  adapter_version:'adapter-v1',source_contract_version:'const-v1',required:true,
  cadence:{kind:'daily',eat_hour:10,eat_minute:0},minimum_healthy_checkpoints:7,
});
const weekly=()=>({ ...day('youtube_ke'), behavior:'video_consumption', metric:'rank_and_count',
  cadence:{kind:'weekly',weekday_eat:3,eat_hour:12,eat_minute:0},minimum_healthy_checkpoints:1 });
const receipt=(slot,c=day(),extra={})=>({source_key:c.source_key, scheduled_at:slot.scheduled_at,
 fetched_at:new Date(Date.parse(slot.scheduled_at)+60_000).toISOString(),
 status:'succeeded',payload_sha256:SH,observed_depth:100,record_count:100,
 source_native_period:{starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z',authority:'provider_defined',evidence_ref:'provider-2026-w43'},metric:c.metric,adapter_version:c.adapter_version,
 contract_version:c.source_contract_version,market:'KE',upstream_reference:'provider/chart/ke',...extra });
const assemble=(source=day())=>({week_start_eat:'2026-10-19',source_contracts:[source],
 receipts:checkpointsForSource('2026-10-19',source).map(s=>receipt(s,source)),constitution_version:'source-v1',methodology_version:'method-v1'});

test('EAT week begins Sunday 21:00 UTC, ends the next Sunday 21:00 UTC',()=>{
  assert.deepEqual(trackingWeek('2026-10-19'),{week_start_eat:'2026-10-19',starts_at:'2026-10-18T21:00:00Z',ends_at:'2026-10-25T21:00:00Z'});
  assert.throws(()=>trackingWeek('2026-10-20'),/must be Monday/);
  assert.throws(()=>trackingWeek('2026-02-30'),/calendar date/);
});
test('daily checkpoints are one per Kenya day, regardless of UTC boundary',()=>{
  const x=checkpointsForSource('2026-10-19',day());assert.equal(x.length,7);
  assert.equal(x[0].scheduled_at,'2026-10-19T07:00:00Z');
  assert.equal(x[6].scheduled_at,'2026-10-25T07:00:00Z');
});
test('six-hour checkpoints are exactly 28 and no end-boundary slot leaks in',()=>{
  const src={...day(),cadence:{kind:'interval_hours',hours:6,eat_hour:0,eat_minute:0},minimum_healthy_checkpoints:28};
  const r=checkpointsForSource('2026-10-19',src);assert.equal(r.length,28);
  assert.equal(r[0].scheduled_at,'2026-10-18T21:00:00Z');
  assert.equal(r[27].scheduled_at,'2026-10-25T15:00:00Z');
});
test('weekly checkpoint waits for the configured source day',()=>{
  const r=checkpointsForSource('2026-10-19',weekly());assert.equal(r.length,1);
  assert.equal(r[0].scheduled_at,'2026-10-22T09:00:00Z');
});
test('a complete unchanged daily feed has seven captures, not seven consumption events',async()=>{
  const m=await prepareWeeklyEvidenceFreeze(assemble());
  assert.equal(m.state,'evidence_ready_for_independent_review');assert.equal(m.can_publish,false);
  assert.equal(m.source_summary[0].healthy_checkpoints,7);
  assert.equal(m.source_summary[0].distinct_consecutive_payloads,1);
  assert.equal(m.receipts.length,7);
  assert.match(m.sha256,/^[a-f0-9]{64}$/);
});
test('freeze hash is deterministic independent of input ordering or object-key ordering',async()=>{
  const p=assemble();let a=await prepareWeeklyEvidenceFreeze(p);
  let b=await prepareWeeklyEvidenceFreeze({...p,receipts:p.receipts.slice().reverse(),source_contracts:p.source_contracts.map(s=>({...s,cadence:{eat_minute:0,eat_hour:10,kind:'daily'}}))});
  assert.equal(a.sha256,b.sha256);
});
test('a missing daily checkpoint blocks a required source',async()=>{
  let p=assemble();p.receipts.pop();const m=await prepareWeeklyEvidenceFreeze(p);
  assert.equal(m.state,'blocked');assert.equal(m.source_summary[0].healthy_checkpoints,6);
  assert.equal(m.source_summary[0].failures[0].reason,'missing_checkpoint');
});
test('an explicit partial-depth fetch is degraded and blocks minimum seven',async()=>{
  let p=assemble();p.receipts[1]={...p.receipts[1],status:'partial_depth',observed_depth:70,record_count:70};
  const m=await prepareWeeklyEvidenceFreeze(p);assert.equal(m.state,'blocked');
});
test('failed fetch cannot count fake records as healthy',()=>{
  const src=day(),slot=checkpointsForSource('2026-10-19',src)[0];
  assert.throws(()=>validateReceipt(receipt(slot,src,{status:'transport_failed',failure_code:'timeout'}),src,trackingWeek('2026-10-19')),/masquerade/);
});
test('noncritical source failure degrades rather than silently reweights required source',async()=>{
  const a=day(),b={...weekly(),required:false};let p=assemble(a);p.source_contracts=[a,b];
  const m=await prepareWeeklyEvidenceFreeze(p);assert.equal(m.state,'evidence_ready_for_independent_review');
  assert.equal(m.source_summary[1].status,'insufficient');assert.equal(m.can_publish,false);
});
test('reject unknown sources, unscheduled time, duplicate checkpoint and out-of-week time',async()=>{
  let p=assemble();await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[...p.receipts,{...p.receipts[0],source_key:'other'}]}),/unknown source/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[...p.receipts,p.receipts[0]]}),/duplicate checkpoint/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[...p.receipts.slice(1),{...p.receipts[0],scheduled_at:'2026-10-19T08:00:00Z',fetched_at:'2026-10-19T08:01:00Z'}]}),/unplanned checkpoint/);
});
test('reject wrong source-native metric, territory, and absent raw-content hash',async()=>{
  const p=assemble();for(const delta of [{metric:'event_count'},{market:'UG'},{payload_sha256:null}]){
    await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],...delta},...p.receipts.slice(1)]}));
  }
});
test('required unverified upstream period blocks readiness even after successful fetch',async()=>{
  const p=assemble();p.receipts[0]={...p.receipts[0],source_native_period:'unknown'};
  const m=await prepareWeeklyEvidenceFreeze(p);assert.equal(m.state,'blocked');
  assert.match(m.blocking.join(' '),/upstream period semantics unverified/);
});
test('freeze result is detached from caller mutation and deeply immutable',async()=>{
  const p=assemble();const m=await prepareWeeklyEvidenceFreeze(p);
  const original=m.receipts[0].source_native_period;
  p.receipts[0].source_native_period='mutated-after-hash';
  assert.equal(m.receipts[0].source_native_period,original);
  assert.equal(Object.isFrozen(m.receipts[0]),true);
  assert.throws(()=>{m.receipts[0].status='forged'},TypeError);
});
test('native source periods require typed provider boundaries and evidence',async()=>{
  const p=assemble();
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],source_native_period:{authority:'provider_defined',starts_at:'2026-10-25T21:00:00Z',ends_at:'2026-10-18T21:00:00Z',evidence_ref:'a'}},...p.receipts.slice(1)]}),/positive interval/);
});
test('source and receipt fields fail closed on unexpected confidential or untyped payloads',async()=>{
  const p=assemble();
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,source_contracts:[{...p.source_contracts[0],credential:'never-store'}]}),/unexpected field/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],api_token:'never-store'},...p.receipts.slice(1)]}),/unexpected field/);
  await assert.rejects(()=>prepareWeeklyEvidenceFreeze({...p,receipts:[{...p.receipts[0],source_native_period:{...p.receipts[0].source_native_period,raw_api_reply:{secret:'x'}}},...p.receipts.slice(1)]}),/unexpected field/);
});
test('the kernel has no policy for converting native rank to stream counts',()=>{
  assert.notEqual(day().metric,weekly().metric);
  assert.notEqual(day().behavior,weekly().behavior);
});

// Source-native parser boundary: this is NOT an admission test and exercises
// static fixtures, not the current provider HTTP surfaces.
import {
  parseMdundoKenya, parseAudiomackKenya, parseBoomplayKenya,
  parseShazamKenya, parseAppleKenya, parseYouTubeKenyaWeekly,
} from '../../supabase/functions/_shared/chart-public-source-observations.mjs';

test('Mdundo parses explicit Kenya playlist ranks, and rejects unexplained rank gaps',()=>{
  const html='<div class="md-playlist-song-item" data-index="1" data-id="543" data-playlist-url="/top-charts/ke" data-title="Song A" data-artist="A"></div>'+
    '<div class="md-playlist-song-item" data-index="2" data-id="544" data-playlist-url="/top-charts/ke" data-title="Song B" data-artist="B"></div>';
  const r=parseMdundoKenya(html);
  assert.equal(r.behavior,'consumption');assert.equal(r.native_period,'unknown');assert.equal(r.eligible_for_scoring,false);
  assert.equal(r.rows[0].provider_track_id,'543');assert.equal(r.rows[1].rank,2);
  assert.throws(()=>parseMdundoKenya(html.replace('data-index="2"','data-index="3"')),/duplicate_or_invalid_rank|noncontiguous_rank/);
});

test('Audiomack observations preserve ordered provider song IDs and partial depth',()=>{
  const html='<script>{"track_count":3}</script><meta property="music:song" content="https://audiomack.com/ke-artist/song-1"><meta property="music:song" content="https://audiomack.com/ke-artist/song-2">';
  const r=parseAudiomackKenya(html);
  assert.equal(r.status,'partial_depth');assert.equal(r.chart_depth,3);
  assert.equal(r.rows[0].provider_track_id,'ke-artist/song-1');
  assert.throws(()=>parseAudiomackKenya(html.replace('https://audiomack.com/ke-artist/song-2','https://evil.example/song-2')),/untrusted_song_origin/);
});

test('Boomplay page repeats do not become extra ranked observations; scope stays unverified',()=>{
  const html='<a href="/songs/41">A</a><a href="/songs/41">A again</a><a href="/songs/44">B</a>';
  const r=parseBoomplayKenya(html);
  assert.equal(r.rows.length,2);assert.equal(r.rows[1].provider_track_id,'44');
  assert.equal(r.officiality,'unverified');assert.equal(r.native_period,'unknown');
});

test('Shazam quoted comma is parsed and evidence remains discovery, not streaming',()=>{
  const r=parseShazamKenya('Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n1,"Artist, Guest","Tune, Mix"\n2,Other,Second\n');
  assert.equal(r.behavior,'discovery');assert.equal(r.metric,'rank');
  assert.equal(r.rows[0].artist,'Artist, Guest');assert.equal(r.rows[0].title,'Tune, Mix');
  assert.equal(r.provider_period_label,'2026-W42');assert.equal(r.native_period,'unknown');
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,X\n1,B,Y\n'),/duplicate_or_invalid_rank/);
});

test('Shazam preserves literal interior quotes inside quoted public CSV fields',()=>{
  const csv='Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n'+
    '1,"The "Real" Artist","Song "Love" Edit"\n'+
    '2,"The ""Official"" Artist","Song, Version"\n';
  const r=parseShazamKenya(csv);
  assert.equal(r.rows.length,2);
  assert.deepEqual(r.rows.map(x=>[x.rank,x.artist,x.title]),[
    [1,'The "Real" Artist','Song "Love" Edit'],
    [2,'The "Official" Artist','Song, Version'],
  ]);
  assert.equal(r.native_period,'unknown');
  assert.ok(r.rows.every(x=>x.provider_track_id===null));
});

test('Shazam 200-row public CSV with an interior quote on physical line 116 retains all ranks',()=>{
  const rows=Array.from({length:200},(_,i)=>i===112
    ?`113,"The "Real" Artist","Song "Love" Edit"`
    :`${i+1},Artist ${i+1},Song ${i+1}`);
  const csv=`Shazam Top 200 Kenya\n2026-W42\nRank,Artist,Title\n${rows.join('\n')}\n`;
  const r=parseShazamKenya(csv);
  assert.equal(r.rows.length,200);
  assert.equal(r.rows[112].rank,113);
  assert.equal(r.rows[112].artist,'The "Real" Artist');
  assert.equal(r.rows[112].title,'Song "Love" Edit');
  assert.equal(r.chart_depth,200);
  assert.equal(r.native_period,'unknown');
});

test('Shazam retains strict columns, field boundaries and rank integrity',()=>{
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,"Artist"tail,Song\n'),
    /shazam_unterminated_csv_quote/);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,Artist"bad,Song\n'),
    /shazam_invalid_quoted_csv/);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,"Artist"x",Song,Injected\n'),
    /shazam_invalid_chart_row/);
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,Song,Injected\n'),
    /shazam_invalid_chart_row/);
  // With two rows, a source rank of 3 exceeds declared depth 2 and
  // fails the rank-range check before the subsequent contiguity check.
  assert.throws(()=>parseShazamKenya('Rank,Artist,Title\n1,A,Song\n3,B,Other\n'),
    /shazam_ke_duplicate_or_invalid_rank/);
});

test('Apple public most-played is not inferred to be a seven-day consumption total',()=>{
  const payload={feed:{country:'KE',updated:'2026-10-19T00:00:00Z',results:[{id:'121',name:'Song',artistName:'Artist',artistId:'22'}]}};
  const r=parseAppleKenya(payload);
  assert.equal(r.metric,'rank');assert.equal(r.native_period,'unknown');
  assert.equal(r.provider_updated_at,'2026-10-19T00:00:00Z');
  assert.throws(()=>parseAppleKenya({...payload,feed:{...payload.feed,country:'US'}}),/territory_unverified/);
});

test('YouTube provider weekly observation retains views, exact target period and separate behavior',()=>{
  const target='weekly:20261016:20261022:ke';
  const payload={metadata:{periodKey:target},charts:{trackViews:[
    {encryptedVideoId:'xyz',name:'Track',artists:[{name:'Singer'}],viewCount:'12,400',chartEntryMetadata:{currentPosition:1}}
  ]}};
  const r=parseYouTubeKenyaWeekly(payload,target);
  assert.equal(r.metric,'rank_and_count');assert.equal(r.behavior,'video_consumption');
  assert.equal(r.rows[0].view_count,12400);assert.equal(r.source_period_key,target);
  assert.throws(()=>parseYouTubeKenyaWeekly(payload,'weekly:20261009:20261015:ke'),/target_period_unavailable/);
});

test('YouTube rejects absent counts, duplicated ranks and invented provider periods',()=>{
  const target='weekly:20261016:20261022:ke';
  const payload={period:target,trackViews:[
    {encryptedVideoId:'a',viewCount:0,chartEntryMetadata:{currentPosition:1}},
    {encryptedVideoId:'b',viewCount:1,chartEntryMetadata:{currentPosition:2}},
  ]};
  assert.equal(parseYouTubeKenyaWeekly(payload,target).rows[0].view_count,0);
  assert.throws(()=>parseYouTubeKenyaWeekly({...payload,trackViews:[payload.trackViews[0],{...payload.trackViews[1],viewCount:'NaN'}]},target),/missing_native_view_count/);
  assert.throws(()=>parseYouTubeKenyaWeekly({...payload,trackViews:[payload.trackViews[0],{...payload.trackViews[1],chartEntryMetadata:{currentPosition:1}}]},target),/duplicate_or_invalid_rank/);
});

test('all source parsers fail closed on empty inputs and never assign a country-level audience estimate',()=>{
  for (const f of [parseMdundoKenya,parseAudiomackKenya,parseBoomplayKenya,parseShazamKenya])
    assert.throws(()=>f(''),Error);
  assert.throws(()=>parseAppleKenya({}),/invalid_feed/);
  assert.throws(()=>parseYouTubeKenyaWeekly({},'weekly:20261016:20261022:ke'),/target_period_unavailable/);
  const r=parseShazamKenya('Rank,Artist,Title\n1,A,B\n');
  assert.equal('plays' in r,false);assert.equal('estimated_listeners' in r,false);
});


test('a provider-native chart interval cannot silently replace the edition tracking week',async()=>{
  const p=assemble();
  p.receipts[0]={...p.receipts[0],source_native_period:{...p.receipts[0].source_native_period,
    starts_at:'2026-10-11T21:00:00Z',ends_at:'2026-10-18T21:00:00Z'}};
  const out=await prepareWeeklyEvidenceFreeze(p);
  assert.equal(out.state,'blocked');
  assert.equal(out.source_summary[0].periods_outside_week,1);
  assert.match(out.blocking.join(';'),/outside tracking week/);

  const q=assemble();
  // YouTube may use a provider-native Friday–Thursday week while a product
  // edition uses a different window; the relation needs explicit authority.
  q.receipts[0]={...q.receipts[0],source_native_period:{...q.receipts[0].source_native_period,
    starts_at:'2026-10-15T21:00:00Z',ends_at:'2026-10-22T21:00:00Z'}};
  const partial=await prepareWeeklyEvidenceFreeze(q);
  assert.equal(partial.state,'blocked');
  assert.equal(partial.source_summary[0].periods_crossing_week_boundary,1);
  assert.match(partial.blocking.join(';'),/explicit alignment policy required/);
});

// WAKILISHA 100 candidate-only source transport/private-byte contract.
// Consolidated into the existing chart kernel suite, not a new permanent test.
import {
  CandidateCaptureError, fetchCandidateBytes, archiveCandidateBytes, sha256Hex,
} from '../../supabase/functions/_shared/chart-candidate-capture.mjs';

const wkCapUrl = 'https://example.org/chart/ke';
const wkCapAuthority = { source_key:'mdundo_ke', exact_endpoint:wkCapUrl,
  authorization_ref:'wk-source-access-v1/fixture', purpose:'candidate_raw_evidence' };
const wkCapBytes = new TextEncoder().encode('<html>KE source fixture</html>');
const wkCapWeek = '2026-10-19';
const wkCapSlot = '2026-10-19T09:00:00Z';
const wkCapInput = (overrides={}) => ({sourceKey:'mdundo_ke',endpoint:wkCapUrl,
  accessDecision:wkCapAuthority,verifyAccess:async()=>true,
  fetchImpl:async (_url,opts)=>{
    assert.equal(opts.redirect,'manual');
    assert.equal(opts.credentials,'omit');
    return new Response(wkCapBytes,{status:200,headers:{'content-type':'text/html'}});
  },now:()=>new Date('2026-10-19T09:02:00Z'),...overrides});
const wkCapReject = (fn,code)=>assert.rejects(fn,
  e=>e instanceof CandidateCaptureError && e.code===code);
const wkCapStorage = () => {
  const objects=new Map(),events=[],entries=[];
  const storage={
    async putCreateOnly(key,bytes,config) {
      events.push('put');assert.equal(config.upsert,false);
      if(objects.has(key))throw Error('collision');objects.set(key,new Uint8Array(bytes));
    },
    async readPrivate(key){events.push('read');return objects.get(key);},
  };
  const ledger={async record(entry){events.push(entry.state);entries.push(entry);}};
  return {objects,events,entries,storage,ledger};
};

test('candidate capture never runs before exact externally verified source access',async()=>{
  let calls=0;
  const transport=async()=>{calls++;return new Response(wkCapBytes);};
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({verifyAccess:async()=>false,fetchImpl:transport})), 'source_access_not_authorized');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({verifyAccess:null,fetchImpl:transport})), 'source_access_verifier_required');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({accessDecision:{...wkCapAuthority,source_key:'apple_ke'},fetchImpl:transport})), 'source_access_invalid');
  for(const url of ['http://example.org/chart/ke','https://127.0.0.1/a','https://host.local/a','https://evil.com@valid.org/a','https://example.org:9000/a'])
    await wkCapReject(()=>fetchCandidateBytes(wkCapInput({endpoint:url,fetchImpl:transport})), 'endpoint_invalid');
  assert.equal(calls,0);
  // A delayed approval must not start a request after the deadline expires.
  let grantLateAccess;
  const lateAccess = new Promise(resolve => { grantLateAccess = resolve; });
  await wkCapReject(() => fetchCandidateBytes(wkCapInput({
    timeoutMs: 100, verifyAccess: () => lateAccess, fetchImpl: transport,
  })), 'transport_timeout');
  grantLateAccess(true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls,0);
});

test('candidate HTTP evidence retains exact bytes but refuses redirect, MIME, overage and timeout',async()=>{
  const captured=await fetchCandidateBytes(wkCapInput());
  assert.deepEqual(captured.bytes,wkCapBytes);
  assert.equal(captured.payload_sha256,await sha256Hex(wkCapBytes));
  assert.equal(captured.byte_length,wkCapBytes.length);
  assert.equal('can_publish' in captured,false);
  const fixtureResponse=(body,status,type,extra={})=>async()=>new Response(body,{status,headers:{'content-type':type,...extra}});
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse(null,302,'text/html',{location:'https://wrong.tld'})})), 'redirect_forbidden');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse('oops',503,'text/html')})), 'upstream_http_unaccepted');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse('oops',200,'text/plain')})), 'upstream_content_type_unaccepted');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({fetchImpl:fixtureResponse(new Uint8Array(4_194_305),200,'application/octet-stream')})), 'raw_body_too_large');
  await wkCapReject(()=>fetchCandidateBytes(wkCapInput({timeoutMs:100,fetchImpl:async()=>new Promise(()=>{})})), 'transport_timeout');
});

test('candidate private archive persists reservation before create-only, rechecks bytes and never publishes',async()=>{
  const capture=await fetchCandidateBytes(wkCapInput());
  const f=wkCapStorage();
  const args={capture,weekStartEat:wkCapWeek,scheduledAt:wkCapSlot,attemptNumber:1,storage:f.storage,ledger:f.ledger};
  const result=await archiveCandidateBytes(args);
  assert.deepEqual(f.events,['reserved','put','uploaded_unverified','read','verified']);
  assert.match(result.object_key,/^v1\/2026-10-19\/mdundo_ke\/20261019T090000Z-1\/[a-f0-9]{64}\.html$/);
  assert.equal(result.status,'candidate_only_verified');
  assert.equal(result.can_publish,false);
  assert.equal(f.objects.size,1);
  await wkCapReject(()=>archiveCandidateBytes(args),'raw_storage_create_failed');
  assert.equal(f.objects.size,1);
  assert.equal(f.entries.at(-1).state,'reserved');
});

test('candidate archive stops on digest, missing ledger, corrupt readback and invalid EAT slot',async()=>{
  const capture=await fetchCandidateBytes(wkCapInput());
  const f=wkCapStorage();
  const args={capture,weekStartEat:wkCapWeek,scheduledAt:wkCapSlot,attemptNumber:1,storage:f.storage,ledger:f.ledger};
  await wkCapReject(()=>archiveCandidateBytes({...args,capture:{...capture,payload_sha256:'0'.repeat(64)}}),'capture_digest_mismatch');
  await wkCapReject(()=>archiveCandidateBytes({...args,scheduledAt:'2026-10-25T21:00:00Z'}),'slot_outside_eat_week');
  await wkCapReject(()=>archiveCandidateBytes({...args,attemptNumber:9}),'attempt_number_invalid');
  assert.deepEqual(f.events,[]);
  await assert.rejects(()=>archiveCandidateBytes({...args,ledger:{record:async()=>{throw Error('durability unavailable')}}}),/durability unavailable/);
  assert.equal(f.objects.size,0);
  await wkCapReject(()=>archiveCandidateBytes({...args,storage:{...f.storage,readPrivate:async(key)=>new Uint8Array((await f.storage.readPrivate(key)).length)}}),'raw_storage_integrity_mismatch');
  assert.equal(f.objects.size,1); // retained for explicit reconciliation, never deleted
  assert.deepEqual(f.entries.map(x=>x.state),['reserved','uploaded_unverified']);
});

// Integrated WK100 candidate-only collector contract. Existing chart suite owner.
import { runCandidateCapture,validateCaptureSlot } from '../../supabase/functions/_shared/chart-capture-runtime.mjs';
const wkRuntimeSlot='2026-10-19T09:00:00Z';
const wkRuntimeWeek='2026-10-19';
const wkRuntimeBytes=new TextEncoder().encode('<div class="md-playlist-song-item" data-index="1" data-id="123" data-playlist-url="/top-charts/ke" data-title="Song" data-artist="Singer"></div>');
const wkRuntimeContract={id:'10000000-0000-4000-8000-000000000001',source_key:'mdundo_ke',contract_version:'fixture-v1',
  admission_state:'candidate',market:'KE',behavior:'consumption',native_metric:'rank',expected_depth:1,
  cadence_kind:'daily',interval_hours:null,eat_hour:12,eat_minute:0,weekday_eat:null,
  minimum_healthy_checkpoints:1,adapter_version:'fixture-v1'};
const wkRuntimeAccess={source_key:'mdundo_ke',endpoint:'https://example.org/chart/ke',
  authorization_ref:'WK100-ACCESS-TEST-1'};
function wkRuntimeHarness(extra={}) {
  const events=[],objects=new Map();
  const db={
    async reserve() {events.push('reserve');return {state:'reserved',reservation_id:'reservation1',lease_id:'lease1'};},
    async advance(p){events.push(`advance:${p.p_action}`);return {accepted:true};},
    async commit(p){events.push('commit');assert.equal(p.p_rows.length,p.p_outcome==='succeeded'?1:0);
      return {status:p.p_outcome,receipt_id:'receipt1'};},
    async fail(p){events.push('fail');return {status:p.p_outcome,receipt_id:'failed1'};},
  };
  const storage={
    async putCreateOnly(key,bytes,options){events.push('put');assert.equal(options.upsert,false);
      if(objects.has(key))throw Error('duplicate');objects.set(key,new Uint8Array(bytes));},
    async readPrivate(key){events.push('read');const bytes=objects.get(key);
      if(!bytes)throw Error('missing');return new Uint8Array(bytes);},
  };
  const args={contract:wkRuntimeContract,weekStartEat:wkRuntimeWeek,
    scheduledAt:wkRuntimeSlot,attemptNumber:1,access:wkRuntimeAccess,
    verifyAccess:async()=>{events.push('authorize');return true;},
    db,storage,enabled:true,
    clock:()=>new Date('2026-10-19T09:02:00Z'),
    fetchImpl:async()=>{events.push('fetch');return new Response(wkRuntimeBytes,{status:200,headers:{'content-type':'text/html'}});},
    ...extra};
  return {events,objects,db,storage,args};
}

test('WK100 integrated collector authorizes source before durable slot claim, stores and commits without publishing',async()=>{
  const f=wkRuntimeHarness();const r=await runCandidateCapture(f.args);
  assert.deepEqual(f.events,['authorize','reserve','authorize','fetch','advance:bind','put','advance:uploaded','read','advance:verified','commit']);
  assert.equal(r.status,'succeeded');assert.equal(r.can_publish,false);
  assert.equal(f.objects.size,1);
  assert.match(r.raw_object_key,/^v1\/2026-10-19\/mdundo_ke\/20261019T090000Z-1\/[a-f0-9]{64}\.html$/);
});

test('WK100 integrated collector rejects inactive, unapproved and mistimed sources before any claim',async()=>{
  const f=wkRuntimeHarness();
  await assert.rejects(()=>runCandidateCapture({...f.args,enabled:false}),/capture_not_enabled/);
  await assert.rejects(()=>runCandidateCapture({...f.args,verifyAccess:async()=>false}),/source_access_not_authorized/);
  await assert.rejects(()=>runCandidateCapture({...f.args,scheduledAt:'2026-10-19T10:00:00Z'}),/slot_unexpected/);
  await assert.rejects(()=>runCandidateCapture({...f.args,clock:()=>new Date('2026-10-19T09:21:00Z')}),/slot_outside_capture_window/);
  assert.deepEqual(f.events,[]);
});

test('WK100 integrated collector resumes bound original bytes, never silently polls a changed provider',async()=>{
  const f=wkRuntimeHarness();
  const digest=await (await import('../../supabase/functions/_shared/chart-candidate-capture.mjs')).sha256Hex(wkRuntimeBytes);
  const key=`v1/${wkRuntimeWeek}/mdundo_ke/20261019T090000Z-1/${digest}.html`;
  f.objects.set(key,new Uint8Array(wkRuntimeBytes));
  f.args.db.reserve=async()=>({state:'bound',reservation_id:'reservation1',lease_id:'lease1',
    object_key:key,payload_sha256:digest,byte_length:wkRuntimeBytes.length,
    content_type:'text/html',fetched_at:'2026-10-19T09:01:00.000Z'});
  f.args.fetchImpl=async()=>{throw Error('provider must NOT be polled on restart');};
  const result=await runCandidateCapture(f.args);
  assert.equal(result.status,'succeeded');assert.equal(result.can_publish,false);
  assert(!f.events.includes('fetch'));assert.deepEqual(f.events,['authorize','read','advance:uploaded','advance:verified','commit']);
  f.objects.set(key,new Uint8Array([0,1,2]));
  await assert.rejects(()=>runCandidateCapture(f.args),/reconciliation_digest_mismatch/);
});

test('WK100 integrated collector persists a transport failure and never commits truncated raw rows',async()=>{
  const f=wkRuntimeHarness({fetchImpl:async()=>new Response('blocked',{status:503,headers:{'content-type':'text/html'}})});
  const result=await runCandidateCapture(f.args);
  assert.equal(result.status,'transport_failed');assert.equal(result.can_publish,false);
  assert(f.events.includes('fail'));assert(!f.events.includes('commit'));assert.equal(f.objects.size,0);
  const g=wkRuntimeHarness();
  g.storage.readPrivate=async()=>{g.events.push('read');return new Uint8Array([1,2,3]);};
  await assert.rejects(()=>runCandidateCapture(g.args),/raw_storage_integrity_mismatch/);
  assert(!g.events.includes('commit'));assert.equal(g.objects.size,1);
});


// The Edge gateway authenticates the signature. These tests seal the handler's
// additional fail-closed checks; decoding alone is NEVER a signature verifier.
import { readFileSync } from 'node:fs';
import { isGatewayVerifiedServiceRole, runtimeProjectApiUrl } from
  '../../supabase/functions/_shared/chart-capture-gateway-role.mjs';

const wkJwt = (role='service_role',exp=2_108_002_896,iss='supabase',ref='zogdfvoizohrhwmovlpv') => {
  const base64=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
  return base64({alg:'HS256',typ:'JWT'})+'.'+base64({role,exp,iss,ref})+'.'+('a'.repeat(43));
};

test('WK100 Edge gateway service identity rejects anon, malformed, expired and mismatched keys',()=>{
  const valid=wkJwt(),now=1_792_480_000_000;
  assert.equal(isGatewayVerifiedServiceRole(valid,valid,now),true);
  assert.equal(isGatewayVerifiedServiceRole(wkJwt('anon'),wkJwt('anon'),now),false);
  assert.equal(isGatewayVerifiedServiceRole(wkJwt('service_role',123),wkJwt('service_role',123),now),false);
  assert.equal(isGatewayVerifiedServiceRole(wkJwt('service_role',2_108_002_896,'unknown'),wkJwt('service_role',2_108_002_896,'unknown'),now),false);
  assert.equal(isGatewayVerifiedServiceRole(valid,'wrong',now),false);
  assert.equal(isGatewayVerifiedServiceRole('not-a-jwt','not-a-jwt',now),false);
  assert.equal(isGatewayVerifiedServiceRole('',valid,now),false);
});

test('WK100 Edge runtime authorization is inseparable from verified gateway and project origin',()=>{
  const config=readFileSync(new URL('../../supabase/config.toml',import.meta.url),'utf8');
  assert.match(config,/\[functions\.wk-chart-capture\]\s*verify_jwt\s*=\s*true/);
  const edge=readFileSync(new URL('../../supabase/functions/wk-chart-capture/index.ts',import.meta.url),'utf8');
  assert.match(edge,/isGatewayVerifiedServiceRole\(bearer,req\.headers\.get\('apikey'\)\)/);
  assert.match(edge,/runtimeProjectApiUrl\(bearer,Deno\.env\.get\('WK100_CAPTURE_PROJECT_REF'\)\)/);
  assert.match(edge,/createClient\(url,bearer,/);
  assert.doesNotMatch(edge,/Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/);
  const ref='zogdfvoizohrhwmovlpv', production='pgzizndxdyhqmtyywjmt';
  const now=1_792_480_000_000;
  const valid=wkJwt();
  assert.equal(runtimeProjectApiUrl(valid,ref,now),'https://'+ref+'.supabase.co');
  assert.equal(runtimeProjectApiUrl(wkJwt('anon'),ref,now),null);
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',123),ref,now),null);
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',2_108_002_896,'bad'),ref,now),null);
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',2_108_002_896,'supabase','invalid'),ref,now),null);
  assert.equal(runtimeProjectApiUrl('invalid',ref,now),null);
  // The helper only decodes claims. The hosted gateway MUST verify signatures
  // and the separate platform-configured project identity must agree as well.
  assert.equal(runtimeProjectApiUrl(wkJwt('service_role',2_108_002_896,'supabase',production),ref,now),null);
  assert.equal(runtimeProjectApiUrl(valid,production,now),null);
  assert.equal(runtimeProjectApiUrl(valid,'',now),null);
  assert.equal(runtimeProjectApiUrl(valid,'invalid',now),null);
  assert.equal(runtimeProjectApiUrl(valid,undefined,now),null);
  assert.doesNotMatch(edge,/Deno\.env\.get\('SUPABASE_URL'\)/);
  assert.doesNotMatch(edge,/runtimeProjectApiUrl\(bearer,req\.url\)/);
  assert(edge.indexOf("candidate_collector_disabled") < edge.indexOf("WK100_CAPTURE_PROJECT_REF"));
});
