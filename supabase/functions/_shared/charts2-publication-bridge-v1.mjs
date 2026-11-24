// Charts 2.0 Phase 3, Slice A: offline Chart V2 proposal verification.
// Deliberately not an Edge route or a publisher. The caller must obtain freeze,
// preflight, methodology, programme and Registry tracks from trusted DB reads;
// passing client-controlled objects here would NOT establish authority.
// No database calls, mutation, actor impersonation or publication is possible.
import {YOUTUBE_EXPORT_PERIOD_AUTHORITY} from './charts2-youtube-official-export.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{64}$/;
const SOURCES = Object.freeze({
  youtube_ke: Object.freeze({weight:30,depth:100}),
  mdundo_ke: Object.freeze({weight:25,depth:100}),
  apple_ke: Object.freeze({weight:20,depth:100}),
  audiomack_ke: Object.freeze({weight:15,depth:100}),
  shazam_ke: Object.freeze({weight:10,depth:200}),
});
const SOURCE_NAMES = Object.keys(SOURCES).sort();
function fail(reason) { throw new Error('charts2_bridge_'+reason); }
const int = n => Number.isSafeInteger(n) && n >= 0;
const obj = n => n && typeof n === 'object' && !Array.isArray(n);
const validDate = s => typeof s === 'string' && Number.isFinite(Date.parse(s));
const points = units => (units / 200).toFixed(2);

// A *projection* of a DB-accepted private freeze. Never an approval, stage or
// publication capability. The actual future publisher needs its own actor-bound
// transaction, verified digest, Chart V2 integrity and founder confirmation.
export function inspectCharts2FrozenEditionProjectionV1({freeze,preflight,programme,methodology,registryTracks}={}) {
  if(!obj(freeze) || !UUID.test(freeze.id ?? '') ||
     !UUID.test(freeze.frozen_by ?? '') || !validDate(freeze.frozen_at) ||
     freeze.lifecycle !== 'frozen_private' || freeze.can_publish !== false ||
     freeze.methodology_version !== 'consumption_led_cultural_presence_v1' ||
     freeze.scoring_policy_version !== 'charts2-private-ordinal-v1' ||
     !SHA.test(freeze.input_sha256 ?? '') || !SHA.test(freeze.ranking_sha256 ?? ''))
    fail('immutable_private_freeze_required');

  // This service-only preflight must be recomputed from current genuine receipts
  // and reviewed Registry ledger, NOT accepted as a browser-provided score.
  if(!obj(preflight) || preflight.contract !== 'charts2-private-freeze-preflight/v1' ||
     preflight.freeze_ready !== true || preflight.can_publish !== false ||
     !int(preflight.eligible_count) || preflight.eligible_count < 100 ||
     preflight.conflict_count !== 0 ||
     preflight.input_sha256 !== freeze.input_sha256 ||
     preflight.ranking_sha256 !== freeze.ranking_sha256 ||
     preflight.latest_freeze_id !== freeze.id ||
     !Array.isArray(preflight.recent_freezes) ||
     !preflight.recent_freezes.some(row => row.id === freeze.id &&
       row.input_sha256 === freeze.input_sha256 &&
       row.ranking_sha256 === freeze.ranking_sha256 && row.frozen_private === true))
    fail('current_authority_or_digest_missing');

  if(!obj(programme) || programme.id !== 'top100' ||
     programme.series_slug !== 'top100' || programme.public_slug !== 'top100' ||
     programme.market_slug !== 'KE' || programme.chart_size !== 100 ||
     programme.default_methodology_version !== 'weighted_streaming_v1')
    fail('programme_not_prospectively_authorized');
  if(!obj(methodology) ||
     methodology.methodology_version !== freeze.methodology_version ||
     methodology.scoring_policy_version !== freeze.scoring_policy_version ||
     !obj(methodology.rule_set) ||
     methodology.rule_set.scope !== 'private_review_only' ||
     methodology.rule_set.can_publish !== false ||
     methodology.rule_set.unit_denominator !== 200 ||
     !obj(methodology.rule_set.weights) ||
     SOURCE_NAMES.some(key => methodology.rule_set.weights[key] !== SOURCES[key].weight))
    fail('methodology_authority_drift');

  if(!Array.isArray(freeze.source_receipts) || freeze.source_receipts.length !== 5 ||
     !Array.isArray(preflight.source_receipts) || preflight.source_receipts.length !== 5)
    fail('five_receipts_required');
  const receipts = new Map();
  for(const row of freeze.source_receipts){
    if(!obj(row) || !Object.hasOwn(SOURCES,row.source_key) ||
       receipts.has(row.source_key) || !UUID.test(row.receipt_id ?? '') ||
       !SHA.test(row.original_sha256 ?? '') || !validDate(row.observed_at))
      fail('unqualified_receipt');
    const current = preflight.source_receipts.find(x => x.source_key === row.source_key);
    if(!current || current.receipt_id !== row.receipt_id ||
       current.original_sha256 !== row.original_sha256 ||
       current.native_period_authority !== row.native_period_authority ||
       current.observed_at !== row.observed_at ||
       current.provider_week_ending_date !== row.provider_week_ending_date ||
       current.provider_updated_at !== row.provider_updated_at)
      fail('source_original_changed');
    if(row.source_key === 'youtube_ke') {
      if(!['provider_declared_end_date',YOUTUBE_EXPORT_PERIOD_AUTHORITY].includes(row.native_period_authority)||
         !/^\d{4}-\d{2}-\d{2}$/.test(row.provider_week_ending_date ?? ''))
        fail('native_youtube_period_missing');
      if(row.native_period_authority===YOUTUBE_EXPORT_PERIOD_AUTHORITY){
        const end=Date.parse(row.provider_week_ending_date+'T00:00:00Z');
        if(!Number.isFinite(end)||new Date(end).toISOString().slice(0,10)!==row.provider_week_ending_date||
           new Date(end).getUTCDay()!==4||Date.parse(row.observed_at)<end+86400000)
          fail('native_youtube_period_missing');
      }
    }else if(row.native_period_authority===YOUTUBE_EXPORT_PERIOD_AUTHORITY)
      fail('unqualified_receipt');
    receipts.set(row.source_key,row);
  }
  if(SOURCE_NAMES.some(s => !receipts.has(s)))fail('five_receipts_required');

  // A public edition's fields cannot be invented from a source display name.
  // Registry Tracks must be independently loaded from authoritative DB rows.
  if(!Array.isArray(registryTracks) || registryTracks.length !== 100)
    fail('registry_track_set_incomplete');
  const trackMap = new Map();
  for(const t of registryTracks){
    if(!obj(t) || !UUID.test(t.id ?? '') || t.status !== 'active' ||
       typeof t.title !== 'string' || !t.title.trim() ||
       typeof t.slug !== 'string' || !t.slug.trim() ||
       trackMap.has(t.id.toLowerCase()))fail('registry_track_invalid');
    trackMap.set(t.id.toLowerCase(),t);
  }
  if(!Array.isArray(freeze.ranking) || freeze.ranking.length !== 100 ||
     !Array.isArray(preflight.ranking) || preflight.ranking.length !== 100)
    fail('exact_100_rank_required');
  const seen = new Set(), rows = [];
  let prevUnits = Infinity, prevTrack = '';
  for(let i=0;i<100;i++){
    const row=freeze.ranking[i], current=preflight.ranking[i];
    if(!obj(row) || row.position !== i+1 || !UUID.test(row.track_id ?? '') ||
       row.track_id !== row.track_id.toLowerCase() ||
       !int(row.score_units) || row.score_units < 1 || row.score_units > 20000 ||
       row.score_points !== points(row.score_units) ||
       seen.has(row.track_id) || !trackMap.has(row.track_id) ||
       row.score_units > prevUnits ||
       (row.score_units === prevUnits && row.track_id <= prevTrack))
      fail('ranking_or_track_identity_invalid');
    if(!obj(current) || current.position !== row.position ||
       current.track_id !== row.track_id ||
       current.score_units !== row.score_units ||
       current.score_points !== row.score_points)
      fail('current_ranking_changed');
    if(!Array.isArray(row.source_contributions) || row.source_contributions.length < 1 ||
       row.source_contributions.length > 5 || !Array.isArray(current.source_contributions) ||
       current.source_contributions.length !== row.source_contributions.length)
      fail('source_contributions_invalid');
    let sum=0;
    const used=new Set();
    for(const c of row.source_contributions){
      const s=SOURCES[c?.source_key],receipt=receipts.get(c?.source_key);
      if(!s || used.has(c.source_key) || !int(c.rank) || c.rank < 1 ||
         c.rank > s.depth || c.source_weight_points !== s.weight ||
         c.receipt_id !== receipt.receipt_id ||
         c.original_sha256 !== receipt.original_sha256 ||
         !(c.source_key === 'shazam_ke'
           ? (UUID.test(c.registry_observation_resolution_id ?? '') &&
              c.registry_provider_link_id == null)
           : (UUID.test(c.registry_provider_link_id ?? '') &&
              c.registry_observation_resolution_id == null)) ||
         c.credit_units !== s.weight * (200/s.depth) * (s.depth-c.rank+1))
        fail('source_credit_invalid');
      const same = current.source_contributions.find(x=>x.source_key===c.source_key);
      if(!same || same.receipt_id !== c.receipt_id ||
         same.original_sha256 !== c.original_sha256 ||
         same.registry_provider_link_id !== c.registry_provider_link_id ||
         same.registry_observation_resolution_id !== c.registry_observation_resolution_id ||
         same.rank !== c.rank || same.credit_units !== c.credit_units)
        fail('current_source_credit_changed');
      used.add(c.source_key);sum += c.credit_units;
    }
    if(sum !== row.score_units)fail('score_sum_invalid');
    seen.add(row.track_id);prevUnits=row.score_units;prevTrack=row.track_id;
    rows.push(Object.freeze({position:i+1,canonical_track_id:row.track_id,
      track_slug:trackMap.get(row.track_id).slug,
      track_title:trackMap.get(row.track_id).title,
      score_units:row.score_units,score_points:row.score_points,
      source_count:row.source_contributions.length}));
  }
  // Charts 2.0 artist country-of-origin is informational, NOT a ranking,
  // eligibility, or public-release gate. The retained Chart V2 integrity RPC
  // currently blocks unresolved/non-KE origins, so Phase 3 must prospectively
  // scope its replacement ONLY to the new top100 methodology before release.
  // Do not weaken historical edition or toprnb integrity rules.
  // No invented artist, week, Edition ID, approval or publication fields.
  return Object.freeze({contract:'charts2-chart-v2-projection/v1',
    state:'offline_private_review_only',freeze_id:freeze.id,
    input_sha256:freeze.input_sha256,ranking_sha256:freeze.ranking_sha256,
    programme_id:'top100',market:'KE',entry_count:100,
    artist_origin_policy:'informational_non_blocking',
    entries:Object.freeze(rows),can_stage:false,can_publish:false,
    outstanding_gates:Object.freeze([
      'actor_bound_release_approval','top100_scoped_origin_neutral_integrity',
      'prospective_methodology_promotion','chart_v2_transactional_publisher',
      'founder_edition_confirmation',
    ])});
}
