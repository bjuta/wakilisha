// Verified source-based private review, independent of Registry enrichment.
// A same-title and same-artist pairing is only a review lead, never proof of
// recording identity. This helper has no write, approval or publish path.
import {
  CHARTS2_PRIVATE_METHODOLOGY_V1,
  scoreCharts2PrivatePreviewV1,
} from './charts2-private-scoring-v1.mjs';

const SOURCE_ORDER = ['youtube_ke','mdundo_ke','apple_ke','audiomack_ke','shazam_ke'];
const SOURCE_DEPTH = {youtube_ke:100,mdundo_ke:100,apple_ke:100,audiomack_ke:100,shazam_ke:200};
const label = value => typeof value === 'string'
  ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g,'') : '';
const display = units => (units / 200).toFixed(2);
function fail(code) {throw new Error(code);}

export function buildCharts2PrivateNativeReviewV1({receipts}={}) {
  // Reuse all existing original, period, rank, depth and five-source checks.
  const checked = scoreCharts2PrivatePreviewV1({receipts,registry_links:[]});
  if(checked.source_coverage.length !== 5 || checked.source_coverage.some(x=>x.observed_status!=='succeeded'))
    fail('charts2_native_review_requires_five_full_originals');
  const sourceByKey = new Map(receipts.map(r=>[r.source_key,r]));
  const labelsPerSource = new Map();
  const nativePerSource = new Map();
  const records = [];
  for(const source_key of SOURCE_ORDER){
    const receipt = sourceByKey.get(source_key);
    if(!receipt || receipt.observations.length !== SOURCE_DEPTH[source_key])
      fail('charts2_native_review_source_depth_invalid');
    const weight = CHARTS2_PRIVATE_METHODOLOGY_V1.sources[source_key].weight_points;
    const seenNative = new Set();
    for(const o of receipt.observations){
      const native_id = o.provider_track_id?.trim() || null;
      if(native_id){
        if(seenNative.has(native_id))fail('charts2_native_review_duplicate_provider_recording');
        seenNative.add(native_id);
      }
      const artist = label(o.artist), title=label(o.title);
      const match_label = title && artist ? title+'\u0000'+artist : null;
      const record = {
        source_key, receipt_id:receipt.id, original_sha256:receipt.original_sha256,
        native_rank:o.rank, provider_track_id:native_id, title:o.title.trim(),
        artist:typeof o.artist==='string' && o.artist.trim()?o.artist.trim():null,
        match_label, weight_points:weight,
        credit_units:weight*(200/SOURCE_DEPTH[source_key])*(SOURCE_DEPTH[source_key]-o.rank+1),
      };
      records.push(record);
      if(match_label){
        const k=source_key+'\u0000'+match_label;
        labelsPerSource.set(k,(labelsPerSource.get(k)??0)+1);
      }
    }
    nativePerSource.set(source_key,seenNative.size);
  }
  const groups = new Map();
  let ambiguous_source_labels=0,unanchored_observations=0;
  for(const r of records){
    if(r.source_key==='shazam_ke')continue;
    if(!r.provider_track_id || (r.source_key!=='apple_ke' && !r.match_label)){
      unanchored_observations++;continue;
    }
    if(r.match_label && labelsPerSource.get(r.source_key+'\u0000'+r.match_label)>1){
      ambiguous_source_labels++;continue;
    }
    // Apple provides track IDs and titles, but no artists. Do not infer one
    // from another provider's same-title observation.
    const key=r.source_key==='apple_ke'
      ? 'native:apple_ke:'+r.provider_track_id
      : 'label:'+r.match_label;
    const group=groups.get(key)??{key,title:r.title,artist:r.artist,source_contributions:[],score_units:0};
    group.source_contributions.push(r);group.score_units+=r.credit_units;
    groups.set(key,group);
  }
  // Shazam original rows lack native recording IDs. Only an exact label
  // already anchored by another source can support a provisional group.
  for(const r of records.filter(r=>r.source_key==='shazam_ke')){
    if(!r.match_label || labelsPerSource.get('shazam_ke\u0000'+r.match_label)!==1){
      unanchored_observations++;continue;
    }
    const group=groups.get('label:'+r.match_label);
    if(!group){unanchored_observations++;continue;}
    group.source_contributions.push(r);group.score_units+=r.credit_units;
  }
  // Report every source overlap, not just those within the Top 100.
  // An exact display label is not an authoritative recording identity.
  const all=[...groups.values()].map(g=>({
    identity_key:g.key,
    title:g.title,artist:g.artist,score_units:g.score_units,
    score_points:display(g.score_units),
    source_count:g.source_contributions.length,
    needs_recording_review:g.source_contributions.length>1,
    needs_artist_credit:!g.artist,
    contributions:g.source_contributions.sort((a,b)=>SOURCE_ORDER.indexOf(a.source_key)-SOURCE_ORDER.indexOf(b.source_key)),
  })).sort((a,b)=>b.score_units-a.score_units||
    (a.identity_key<b.identity_key?-1:a.identity_key>b.identity_key?1:0));
  const top=all.slice(0,100).map((r,i)=>({position:i+1,...r}));
  const multi_source_occurrences=all.filter(r=>r.source_count>1);
  const source_occurrences_in_groups=multi_source_occurrences.reduce((n,r)=>n+r.source_count,0);
  const multi_source_by_count=Object.fromEntries([2,3,4,5].map(n=>[
    String(n),multi_source_occurrences.filter(r=>r.source_count===n).length,
  ]));
  // Apple has native IDs and titles but no artist labels in these originals.
  // Expose every possible title match without merging unverified points.
  const titles=new Map();
  for(const r of records.filter(r=>r.source_key!=='apple_ke')){
    const k=label(r.title), bucket=titles.get(k)??[];
    bucket.push(r);titles.set(k,bucket);
  }
  const apple_title_review=[];
  for(const r of records.filter(r=>r.source_key==='apple_ke')){
    const matches=titles.get(label(r.title))??[];
    if(!matches.length)continue;
    apple_title_review.push({
      title:r.title,apple_rank:r.native_rank,
      apple_provider_track_id:r.provider_track_id,
      possible_sources:[...new Set(matches.map(x=>x.source_key))].sort(),
      possible_artists:[...new Set(matches.map(x=>x.artist).filter(Boolean))].sort(),
      other_source_positions:matches.map(x=>({
        source_key:x.source_key,rank:x.native_rank,title:x.title,artist:x.artist,
        provider_track_id:x.provider_track_id,
      })),
      needs_recording_review:true,contributes_extra_score:false,
    });
  }
  return {
    contract:'charts2-private-native-review/v1',
    methodology_version:CHARTS2_PRIVATE_METHODOLOGY_V1.version,
    scoring_policy_version:'charts2-native-label-review-v1',
    count:top.length,candidate_count:all.length,
    native_recording_ids:Object.fromEntries(nativePerSource),
    unanchored_observations,ambiguous_source_labels,
    entries:top,multi_source_occurrences,multi_source_by_count,
    source_occurrences_in_groups,apple_title_review,
    review_required:true,freeze_ready:false,can_publish:false,
  };
}

// Normalized title equality only discovers candidates. Punctuation/case
// normalization never authorizes a recording identity or a credit.
export const charts2RegistryDiscoveryKeyV1 = value => typeof value==="string"
  ? value.normalize("NFKC").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]/gu,"") : "";

// Inputs are the server's unresolved positions and active Registry readback.
// Each position retains its exact source coordinates; no transitive grouping,
// fabricated provider ID, automatic selection, or identity mutation.
export function buildCharts2RegistryDiscoveryV1({unresolved,tracks}){
  if(!Array.isArray(unresolved)||unresolved.length>600||
     !Array.isArray(tracks)||tracks.length>300)
    fail("charts2_registry_discovery_input_bounds");
  const index=new Map();
  for(const track of tracks){
    const key=charts2RegistryDiscoveryKeyV1(track.title);
    if(track.status!=="active"||!key)continue;
    const matches=index.get(key)??[];
    if(!matches.some(item=>item.id===track.id))matches.push(track);
    index.set(key,matches);
  }
  const groups=new Map();
  let unique_positions=0,ambiguous_positions=0,unmatched_positions=0;
  for(const row of unresolved){
    const matches=index.get(charts2RegistryDiscoveryKeyV1(row.title))??[];
    if(matches.length===1)unique_positions++;
    else if(matches.length>1)ambiguous_positions++;
    else unmatched_positions++;
    for(const track of matches){
      const observed=charts2RegistryDiscoveryKeyV1(row.artist);
      const activeCredits=(track.artist_credits??[]).filter(c=>c.artist_status==="active");
      const agrees=!!observed&&activeCredits.some(c=>
        [c.canonical_name,...(c.alias_names??[])].some(name=>charts2RegistryDiscoveryKeyV1(name)===observed));
      const group=groups.get(track.id)??{track,positions:[]};
      group.positions.push({
        ...row,candidate_count:matches.length,
        credit_evidence:!observed?"artist_not_supplied":agrees?"artist_credit_agrees":"artist_credit_unconfirmed",
      });
      groups.set(track.id,group);
    }
  }
  return {contract:"charts2-registry-discovery/v1",candidate_only:true,can_publish:false,
    unique_positions,ambiguous_positions,unmatched_positions,
    groups:[...groups.values()].sort((a,b)=>b.positions.length-a.positions.length||
      a.track.title.localeCompare(b.track.title)||a.track.id.localeCompare(b.track.id))};
}

// Server-side read-only admission input. The caller must first verify the
// original Storage bytes using the existing Charts Studio verifier. The
// snapshot must come from the service-only Studio SQL reader, never a browser.
// This projection does not admit a case, issue a grant or authorize research.
export function buildCharts2InvestigationInputV1(snapshot) {
  if (snapshot?.contract !== "charts2-private-studio/v1" ||
      !Array.isArray(snapshot.receipts) ||
      !Array.isArray(snapshot.registry_links) ||
      !Array.isArray(snapshot.observation_reviews)) {
    fail("charts2_investigation_snapshot_invalid");
  }
  const scored = scoreCharts2PrivatePreviewV1(snapshot);
  if (scored.source_coverage.some(row => row.observed_status !== "succeeded" ||
      row.observed_depth !== row.expected_depth)) {
    fail("charts2_investigation_requires_full_receipts");
  }
  const sources = scored.source_coverage.map(row => ({
    source_key: row.source_key,
    receipt_id: row.receipt_id,
    original_sha256: row.original_sha256,
    observed_depth: row.observed_depth,
  }));
  if (new Set(sources.map(row => row.receipt_id)).size !== sources.length) {
    fail("charts2_investigation_duplicate_receipt_id");
  }
  const sourceByKey = new Map(sources.map(row => [row.source_key, row]));
  const seen = new Set();
  const bind = (row, disposition) => {
    const receipt = sourceByKey.get(row.source_key);
    if (!receipt || row.receipt_id !== receipt.receipt_id ||
        !Number.isSafeInteger(row.rank) || row.rank < 1 || row.rank > receipt.observed_depth) {
      fail("charts2_investigation_coordinate_invalid");
    }
    const coordinate = JSON.stringify([row.source_key, row.receipt_id, row.rank]);
    if (seen.has(coordinate)) fail("charts2_investigation_duplicate_position");
    seen.add(coordinate);
    return {
      ...row,
      original_sha256: receipt.original_sha256,
      disposition,
    };
  };
  const unresolved = scored.unresolved.map(row => bind(row, "research"));
  // Existing conflicts remain explicit blocked decisions; they must not enter
  // a high-confidence grouping merely because title/Artist labels agree.
  const conflicts = scored.conflicts.map(row => bind(row, "blocked"));
  const resolved = scored.candidates.flatMap(row => row.source_contributions);
  for (const row of resolved) bind(row, "resolved");
  const total = sources.reduce((sum, row) => sum + row.observed_depth, 0);
  if (seen.size !== total) fail("charts2_investigation_incomplete_partition");
  return {
    contract: "charts2-investigation-input/v1",
    methodology_version: scored.methodology_version,
    scoring_policy_version: scored.scoring_policy_version,
    sources,
    total_positions: total,
    resolved_positions: resolved.length,
    eligible_recordings: scored.candidates.length,
    unresolved,
    conflicts,
    candidate_only: true,
    can_publish: false,
  };
}

// Compare the independently computed JS partition with the private SQL
// projection, including position dispositions and original labels. The caller
// must verify Storage bytes first; this comparison never authorizes a write.
export function verifyCharts2InvestigationParityV1(input, database) {
  if(input?.contract!=="charts2-investigation-input/v1" ||
     database?.contract!=="charts2-private-freeze-preflight/v1" ||
     database.methodology_version!==input.methodology_version ||
     database.scoring_policy_version!==input.scoring_policy_version ||
     database.can_publish!==false ||
     !/^[a-f0-9]{64}$/.test(database.input_sha256??"") ||
     !Array.isArray(database.source_receipts) ||
     !Array.isArray(database.investigation_positions) ||
     database.eligible_count!==input.eligible_recordings ||
     database.unresolved_count!==input.unresolved.length ||
     database.conflict_count!==input.conflicts.length ||
     database.investigation_positions.length!==input.unresolved.length+input.conflicts.length ||
     input.sources.length!==5 || database.source_receipts.length!==5)
    fail("charts2_investigation_score_disagreement");
  const manifestKey = r=>JSON.stringify([r.source_key,r.receipt_id,r.original_sha256]);
  const sources=new Set(input.sources.map(manifestKey));
  if(sources.size!==5 ||
     new Set(database.source_receipts.map(manifestKey)).size!==5 ||
     database.source_receipts.some(r=>!sources.has(manifestKey(r))))
    fail("charts2_investigation_receipt_disagreement");
  const coordinate = r=>JSON.stringify([r.source_key,r.receipt_id,r.rank]);
  const positions=new Map([...input.unresolved,...input.conflicts].map(r=>[coordinate(r),r]));
  if(positions.size!==database.investigation_positions.length)
    fail("charts2_investigation_position_disagreement");
  for(const row of database.investigation_positions){
    const key=coordinate(row), expected=positions.get(key);
    if(!expected || ["original_sha256","disposition","title","artist","provider_track_id"]
      .some(field=>row[field]!==expected[field]))
      fail("charts2_investigation_position_disagreement");
    positions.delete(key);
  }
  if(positions.size!==0)fail("charts2_investigation_position_disagreement");
  return database.input_sha256;
}
