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
