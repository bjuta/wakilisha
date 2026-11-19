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
  ? value.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase() : '';
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
  return {
    contract:'charts2-private-native-review/v1',
    methodology_version:CHARTS2_PRIVATE_METHODOLOGY_V1.version,
    scoring_policy_version:'charts2-native-label-review-v1',
    count:top.length,candidate_count:all.length,
    native_recording_ids:Object.fromEntries(nativePerSource),
    unanchored_observations,ambiguous_source_labels,
    entries:top,review_required:true,freeze_ready:false,can_publish:false,
  };
}
