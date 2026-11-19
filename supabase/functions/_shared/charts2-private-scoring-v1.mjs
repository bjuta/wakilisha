// Charts 2.0 Phase 2, Take 1 — private-only deterministic ordinal scoring.
// Pure, read-only kernel. Caller must supply server-read immutable receipts and
// Registry/MIZIZI provider bindings; browser claims are never identity authority.
// No Registry writes, editions, score persistence, publishing or schedule.
import {listCharts2SourceContracts} from './charts2-original-candidate.mjs';

export const CHARTS2_PRIVATE_METHODOLOGY_V1 = Object.freeze({
  version: 'consumption_led_cultural_presence_v1',
  scoring_policy_version: 'charts2-private-ordinal-v1',
  score_unit_denominator: 200,
  sources: Object.freeze({
    youtube_ke: Object.freeze({provider_key:'youtube',weight_points:30,method:'POST'}),
    mdundo_ke: Object.freeze({provider_key:'mdundo',weight_points:25,method:'GET'}),
    apple_ke: Object.freeze({provider_key:'apple_music',weight_points:20,method:'GET'}),
    audiomack_ke: Object.freeze({provider_key:'audiomack',weight_points:15,method:'GET'}),
    shazam_ke: Object.freeze({provider_key:'shazam',weight_points:10,method:'GET'}),
  }),
  tie_break: 'score_units_desc_then_canonical_track_uuid_asc',
});
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const SOURCE_CONTRACTS = new Map(
  listCharts2SourceContracts().map(s=>[s.source_key,s])
);
const SOURCE_KEYS=Object.keys(CHARTS2_PRIVATE_METHODOLOGY_V1.sources).sort();
// Existing Registry accepts manual evidence, ISRC claims and title-based matches.
// Charts 2.0 deliberately credits only an explicitly broker-reviewed manual
// provider link with immutable original receipt provenance.
const ALLOWED_MATCH_METHODS=new Set(['manual']);
function fail(code){throw new Error(code);}
function validDate(v){return typeof v==='string' && Number.isFinite(Date.parse(v));}
function positiveInteger(v){return Number.isSafeInteger(v)&&v>=1;}
function labelSource(s){
  const contract=SOURCE_CONTRACTS.get(s);
  const policy=CHARTS2_PRIVATE_METHODOLOGY_V1.sources[s];
  if(!contract || !policy || !positiveInteger(contract.depth) ||
     (contract.depth!==100&&contract.depth!==200))fail('charts2_scoring_contract_invalid');
  return {contract,policy};
}
function scoreUnits(weight,depth,rank){
  // LCM(100,200)=200; all arithmetic is exact safe integers, never floats.
  if(!Number.isInteger(weight)||!positiveInteger(depth)||
     !positiveInteger(rank)||rank>depth||200%depth!==0)
    fail('charts2_scoring_rank_invalid');
  return weight*(200/depth)*(depth-rank+1);
}
function displayPoints(units){
  const whole=Math.floor(units/200);
  const decimals=String((units%200)/2).padStart(2,'0');
  return whole+'.'+decimals;
}
function readReceipt(receipt){
  if(!receipt || typeof receipt!=='object' || Array.isArray(receipt))
    fail('charts2_scoring_receipt_invalid');
  const {contract,policy}=labelSource(receipt.source_key);
  if(receipt.receipt_schema!=='charts2-original-receipt/v1' ||
     !UUID.test(receipt.id) ||
     receipt.market!=='KE'||receipt.source_endpoint!==contract.first_party_endpoint||
     receipt.capture_mode!=='service_original'||
     !positiveInteger(receipt.method_revision)||
     receipt.original_bucket!=='charts2-evidence-private-v1'||
     !SHA.test(receipt.original_sha256)||
     !positiveInteger(receipt.original_byte_length)||
     !validDate(receipt.observed_at)||!validDate(receipt.original_verified_at)||
     Date.parse(receipt.original_verified_at)<Date.parse(receipt.observed_at)||
     receipt.candidate_only!==true||receipt.can_score!==false||
     receipt.can_publish!==false||
     receipt.expected_depth!==contract.depth ||
     !Array.isArray(receipt.observations) ||
     !positiveInteger(receipt.observed_depth) ||
     receipt.observed_depth!==receipt.observations.length ||
     receipt.observed_depth>contract.depth ||
     (receipt.observed_depth===contract.depth
       ? receipt.observed_status!=='succeeded'
       : receipt.observed_status!=='partial_depth'))
    fail('charts2_scoring_unqualified_receipt');
  if(receipt.source_key==='youtube_ke') {
    if(receipt.native_period_authority!=='provider_declared_end_date'||
       !/^\d{4}-\d{2}-\d{2}$/.test(receipt.provider_week_ending_date??''))
      fail('charts2_scoring_youtube_period_unqualified');
  } else if(receipt.native_period_authority==='provider_declared_end_date' &&
            !validDate(receipt.provider_week_ending_date))
    fail('charts2_scoring_provider_period_invalid');
  const ext=receipt.source_key==='youtube_ke'?'.json':
    receipt.source_key==='shazam_ke'?'.csv':'.html';
  const key=receipt.source_key+'/'+receipt.original_sha256.slice(0,2)+'/'+
    receipt.original_sha256+ext;
  if(receipt.original_object_key!==key)
    fail('charts2_scoring_original_key_mismatch');
  const byRank=new Map();
  for(const o of receipt.observations){
    if(!o||typeof o!=='object'||!positiveInteger(o.rank)||
       o.rank>contract.depth||byRank.has(o.rank)||
       typeof o.title!=='string'||!o.title.trim()||
       (o.provider_track_id!=null &&
         (typeof o.provider_track_id!=='string'||!o.provider_track_id.trim())))
      fail('charts2_scoring_observation_unqualified');
    byRank.set(o.rank,o);
  }
  for(let n=1;n<=receipt.observed_depth;n++)
    if(!byRank.has(n))fail('charts2_scoring_rank_gap');
  return {receipt,policy,contract,ordered:[...byRank.values()].sort((a,b)=>a.rank-b.rank)};
}
function indexAuthoritativeLinks(links){
  if(!Array.isArray(links))fail('charts2_scoring_registry_links_invalid');
  const index=new Map();
  for(const link of links){
    if(!link||typeof link!=='object')fail('charts2_scoring_registry_link_invalid');
    // This is an allowlist of strong, reviewed Registry evidence. Existing
    // exact_title_artist/fuzzy links do not pass; never infer from title.
    if(link.match_status!=='matched' ||
       !ALLOWED_MATCH_METHODS.has(link.match_method))continue;
    if(!UUID.test(link.id)||!UUID.test(link.track_id)||
       link.track_status!=='active' ||
       typeof link.provider_track_id!=='string'||!link.provider_track_id.trim() ||
       typeof link.provider_key!=='string')
      fail('charts2_scoring_registry_link_unqualified');
    const key=link.provider_key+'\0'+link.provider_track_id;
    const bucket=index.get(key)??[];
    if(!bucket.some(b=>b.id===link.id))bucket.push(link);
    index.set(key,bucket);
  }
  return index;
}
/**
 * A preview of source-rank credits, NOT a frozen edition or chart ranking.
 *
 * receipt inputs are trusted ONLY after Take 2 server-side read of immutable
 * Production receipts; registry_links ONLY after server-side Registry read.
 * Neither parameter is a browser-submitted identity decision.
 */
export function scoreCharts2PrivatePreviewV1({receipts,registry_links=[]}={}){
  if(!Array.isArray(receipts)||receipts.length!==SOURCE_KEYS.length)
    fail('charts2_scoring_receipt_set_incomplete');
  const perSource=new Map();
  for(const receipt of receipts){
    if(perSource.has(receipt?.source_key))
      fail('charts2_scoring_duplicate_source_receipt');
    const value=readReceipt(receipt);
    perSource.set(receipt.source_key,value);
  }
  if(SOURCE_KEYS.some(s=>!perSource.has(s)))
    fail('charts2_scoring_receipt_set_incomplete');
  const bindings=indexAuthoritativeLinks(registry_links);
  const scores=new Map(),unresolved=[],conflicts=[],coverage=[];
  const seenCanonicalBySource=new Map();
  for(const source_key of SOURCE_KEYS){
    const {receipt,contract,policy,ordered}=perSource.get(source_key);
    coverage.push({
      source_key,receipt_id:receipt.id,source_weight_points:policy.weight_points,
      expected_depth:contract.depth,observed_depth:receipt.observed_depth,
      observed_status:receipt.observed_status,observed_at:receipt.observed_at,
      provider_updated_at:receipt.provider_updated_at??null,
      provider_week_ending_date:receipt.provider_week_ending_date??null,
      native_period_authority:receipt.native_period_authority??'unknown',
      original_sha256:receipt.original_sha256,
    });
    for(const o of ordered){
      const observation={
        source_key,receipt_id:receipt.id,rank:o.rank,
        provider_track_id:o.provider_track_id??null,
        title:o.title,artist:o.artist??null,
      };
      if(!o.provider_track_id){
        unresolved.push({...observation,reason:'provider_recording_id_missing'});
        continue;
      }
      const key=policy.provider_key+'\0'+o.provider_track_id;
      const matches=(bindings.get(key)??[]).filter(link=>{
        if(link.match_method!=='manual')return true;
        const proof=link.review_evidence;
        return proof?.charts2_studio_review_v1===true &&
          proof?.source_key===source_key && proof?.receipt_id===receipt.id &&
          proof?.original_sha256===receipt.original_sha256 &&
          proof?.provider_track_id===o.provider_track_id &&
          typeof proof?.review_note==='string' &&
          proof.review_note.trim().length>=40 &&
          typeof proof?.evidence_url==='string' &&
          /^https:\/\//.test(proof.evidence_url) &&
          Number(link.match_confidence)===1;
      });
      if(matches.length===0){
        unresolved.push({...observation,reason:'registry_authoritative_link_missing'});
        continue;
      }
      if(new Set(matches.map(m=>m.track_id)).size!==1){
        conflicts.push({...observation,reason:'registry_provider_identity_conflict'});
        continue;
      }
      const binding=matches[0],track_id=binding.track_id.toLowerCase();
      const canonicalKey=source_key+'\0'+track_id;
      if(seenCanonicalBySource.has(canonicalKey)){
        conflicts.push({...observation,reason:'duplicate_source_recording',
          earlier_rank:seenCanonicalBySource.get(canonicalKey)});
        continue;
      }
      seenCanonicalBySource.set(canonicalKey,o.rank);
      const units=scoreUnits(policy.weight_points,contract.depth,o.rank);
      const current=scores.get(track_id)??{track_id,score_units:0,source_contributions:[]};
      current.score_units+=units;
      current.source_contributions.push({
        source_key,receipt_id:receipt.id,rank:o.rank,depth:contract.depth,
        weight_points:policy.weight_points,credit_units:units,
        credit_points:displayPoints(units),registry_provider_link_id:binding.id,
      });
      scores.set(track_id,current);
    }
  }
  const candidates=[...scores.values()].map(r=>({
    ...r,score_points:displayPoints(r.score_units),
    source_count:r.source_contributions.length,
    // Missing observations are absence of awarded credit, never measured zeros.
    source_contributions:r.source_contributions.sort((a,b)=>
      a.source_key<b.source_key?-1:a.source_key>b.source_key?1:0),
  })).sort((a,b)=>b.score_units-a.score_units||
    (a.track_id<b.track_id?-1:a.track_id>b.track_id?1:0));
  return {
    methodology_version:CHARTS2_PRIVATE_METHODOLOGY_V1.version,
    scoring_policy_version:CHARTS2_PRIVATE_METHODOLOGY_V1.scoring_policy_version,
    unit_denominator:200,
    source_coverage:coverage,
    candidates,
    unresolved,conflicts,
    // Some providers (notably native Shazam CSV) disclose rankings without
    // provider recording IDs. Missing observations stay explicitly unresolved,
    // but they never fabricate rank credit or bar 100 genuinely linked tracks.
    review_status:conflicts.length?'identity_conflict':
      candidates.length<100?'identity_review_required':
      'eligible_for_private_review',
    frozen:false,can_publish:false,
  };
}
