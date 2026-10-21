import { createHash } from 'node:crypto';

const BEHAVIORS = new Set(['consumption', 'video_consumption', 'discovery', 'broadcast_exposure']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID = /^[a-z][a-z0-9_:-]{2,79}$/;
const SHA = /^[0-9a-f]{64}$/;
const UTC = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
function check(value, code) { if (!value) throw new Error(`wk100_preview_${code}`); }
function exactFields(value, fields, code) {
  check(value && typeof value === 'object' && !Array.isArray(value), `${code}_shape`);
  check(Object.keys(value).every(k => fields.includes(k)) && fields.every(k => Object.hasOwn(value,k)), `${code}_fields`);
}
function validUtc(value) {
  return typeof value === 'string' && UTC.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().replace('.000Z','Z') === value;
}
function weekBounds(day) {
  check(typeof day === 'string' && /^\d{4}-\d\d-\d\d$/.test(day), 'week_format');
  const ms = Date.parse(`${day}T00:00:00Z`);
  check(Number.isFinite(ms) && new Date(ms).toISOString().startsWith(`${day}T`) && new Date(ms).getUTCDay() === 1, 'week_monday_eat');
  return [ms-10800000,ms+7*86400000-10800000];
}
const hash = value => createHash('sha256').update(value).digest('hex');
const rankScore = (rank, depth) => (depth - rank + 1) / depth;
const round = n => Math.round((n+Number.EPSILON)*1e8)/1e8;

function validate(input) {
  exactFields(input,['schema_version','week_start_eat','dataset_mode','method','sources'],'input');
  check(input.schema_version === 'wk100-private-preview-v1','schema_version');
  check(['synthetic','authorized_candidate'].includes(input.dataset_mode),'dataset_mode');
  const [start,end] = weekBounds(input.week_start_eat);
  const method = input.method;
  exactFields(method,['version','behavior_weights','operator_slots','minimum_operators','minimum_behaviors','minimum_corrob_tracks','maximum_operator_share'],'method');
  check(typeof method.version === 'string' && /^preview-[a-z0-9-]{2,48}$/.test(method.version),'method_version');
  const weights=method.behavior_weights;
  check(weights && typeof weights==='object' && !Array.isArray(weights),'weights_shape');
  const bkeys=Object.keys(weights);
  check(bkeys.length>=2 && bkeys.length<=4 && bkeys.every(k=>BEHAVIORS.has(k) && Number.isFinite(weights[k]) && weights[k]>0 && weights[k]<=1),'weights_value');
  check(Math.abs(bkeys.reduce((n,k)=>n+weights[k],0)-1)<1e-8,'weights_total');
  const slots=method.operator_slots;
  check(slots && typeof slots==='object' && !Array.isArray(slots) && Object.keys(slots).length===bkeys.length &&
    bkeys.every(k=>Object.hasOwn(slots,k) && Number.isInteger(slots[k]) && slots[k]>=1 && slots[k]<=8), 'operator_slots');
  check(Number.isInteger(method.minimum_operators)&&method.minimum_operators>=2&&method.minimum_operators<=8,'operator_floor');
  check(Number.isInteger(method.minimum_behaviors)&&method.minimum_behaviors>=2&&method.minimum_behaviors<=4,'behavior_floor');
  check(Number.isInteger(method.minimum_corrob_tracks)&&method.minimum_corrob_tracks>=1&&method.minimum_corrob_tracks<=1000,'corroboration_floor');
  check(typeof method.maximum_operator_share==='number'&&method.maximum_operator_share>0&&method.maximum_operator_share<=1,'concentration_floor');
  check(Array.isArray(input.sources)&&input.sources.length>=2&&input.sources.length<=8,'source_count');
  const sourceIds=new Set(), operatorIds=new Set(), behaviors=new Set();
  for(const source of input.sources){
    exactFields(source,['source_key','operator_key','behavior','market','expected_depth','native_period','authority_ref','admission','raw_sha256','entries'],'source');
    check(typeof source.source_key==='string'&&ID.test(source.source_key)&&!sourceIds.has(source.source_key),'source_key');
    check(typeof source.operator_key==='string'&&ID.test(source.operator_key)&&!operatorIds.has(source.operator_key),'operator_key');
    sourceIds.add(source.source_key);operatorIds.add(source.operator_key);
    check(BEHAVIORS.has(source.behavior)&&Object.hasOwn(weights,source.behavior),'behavior_unsupported');
    behaviors.add(source.behavior);
    check(source.market==='KE','market');
    check(Number.isInteger(source.expected_depth)&&source.expected_depth>=1&&source.expected_depth<=200,'depth');
    check(typeof source.authority_ref==='string'&&ID.test(source.authority_ref),'authority_ref');
    check(source.admission===(input.dataset_mode==='synthetic'?'synthetic':'approved'),'admission_mismatch');
    check(typeof source.raw_sha256==='string'&&SHA.test(source.raw_sha256),'raw_sha256');
    exactFields(source.native_period,['starts_at','ends_at','evidence_ref'],'period');
    const period=source.native_period;
    check(validUtc(period.starts_at)&&validUtc(period.ends_at)&&Date.parse(period.starts_at)<Date.parse(period.ends_at),'period_invalid');
    check(Date.parse(period.starts_at)<end&&Date.parse(period.ends_at)>start,'period_outside_week');
    check(typeof period.evidence_ref==='string'&&ID.test(period.evidence_ref),'period_evidence');
    check(Array.isArray(source.entries)&&source.entries.length===source.expected_depth,'rows_depth');
    const seen=new Set();
    for(let i=0;i<source.entries.length;i++){
      const row=source.entries[i];exactFields(row,['recording_id','rank'],'row');
      check(typeof row.recording_id==='string'&&UUID.test(row.recording_id),'registry_identity_required');
      check(row.rank===i+1,'rank_contiguous');
      check(!seen.has(row.recording_id),'recording_duplicate');seen.add(row.recording_id);
    }
  }
  for(const behavior of behaviors){
    check(input.sources.filter(s=>s.behavior===behavior).length<=slots[behavior], 'operator_slots_exceeded');
  }
  return {operators:[...operatorIds],behaviors:[...behaviors]};
}

function calculate(input, excluded=null) {
  const sources=[...input.sources].sort((a,b)=>a.source_key.localeCompare(b.source_key));
  // Fixed private operator slots; missing operators NEVER redistribute their weight.
  const denominators=input.method.operator_slots;
  const recordings=new Map();
  for(const source of sources){
    if(source.operator_key===excluded) continue;
    const factor=input.method.behavior_weights[source.behavior]/denominators[source.behavior];
    for(const row of source.entries){
      let v=recordings.get(row.recording_id);
      if(!v){v={recording_id:row.recording_id,score:0,contributions:[],operators:new Set()};recordings.set(row.recording_id,v);}
      const contribution=factor*rankScore(row.rank,source.expected_depth);
      v.score+=contribution;v.operators.add(source.operator_key);
      v.contributions.push({source_key:source.source_key,operator_key:source.operator_key,behavior:source.behavior,source_rank:row.rank,value:round(contribution)});
    }
  }
  return [...recordings.values()].sort((a,b)=>b.score-a.score||a.recording_id.localeCompare(b.recording_id))
    .map((v,i)=>({position:i+1,recording_id:v.recording_id,score:round(v.score),operator_count:v.operators.size,
      max_operator_share:v.score===0?0:round(Math.max(...v.contributions.map(c=>c.value))/v.score),contributions:v.contributions}));
}

// Input is private. Returned audit is private. publicSummary has a deliberately disjoint field allowlist.
export function buildWk100PrivatePreview(input, inputSha256=null) {
  const info=validate(input), rows=calculate(input), top=rows.slice(0,100);
  const failures=[];
  if(info.operators.length<input.method.minimum_operators) failures.push('insufficient_independent_operators');
  if(info.behaviors.length<input.method.minimum_behaviors) failures.push('insufficient_behavior_families');
  if(top.length<100) failures.push('fewer_than_100_identified_recordings');
  const corroborated=top.filter(x=>x.operator_count>=2).length;
  if(corroborated<input.method.minimum_corrob_tracks) failures.push('insufficient_cross_operator_corroboration');
  if(top.some(x=>x.max_operator_share>input.method.maximum_operator_share+1e-8)) failures.push('single_operator_concentration');
  const sensitivity=info.operators.map(operator_key=>{
    const other=calculate(input,operator_key), places=new Map(other.map(x=>[x.recording_id,x.position]));
    const movement=top.map(x=>({recording_id:x.recording_id,original:x.position,
      excluded_position:places.get(x.recording_id)??null,delta:places.has(x.recording_id)?places.get(x.recording_id)-x.position:null}));
    const diffs=movement.map(x=>Math.abs(x.delta??100)).sort((a,b)=>b-a);
    return {operator_key,remaining_top100_overlap:top.filter(x=>(places.get(x.recording_id)??Infinity)<=100).length,
      maximum_absolute_rank_change:diffs[0]??0,changed_rank_details:movement};
  });
  const privateAudit={schema_version:'wk100-private-audit-v1',week_start_eat:input.week_start_eat,
    data_classification:'RESTRICTED',dataset_mode:input.dataset_mode,method_version:input.method.version,
    method_configuration:structuredClone(input.method),source_manifest:input.sources.map(s=>({
      source_key:s.source_key,operator_key:s.operator_key,behavior:s.behavior,market:s.market,
      expected_depth:s.expected_depth,native_period:s.native_period,authority_ref:s.authority_ref,
      admission:s.admission,raw_sha256:s.raw_sha256})),
    input_sha256:inputSha256,source_raw_digests_independently_verified:false,
    identities_externally_attested:false,source_authority_externally_verified:false,
    operator_count:info.operators.length,behavior_count:info.behaviors.length,recording_count:rows.length,
    corroborated_top100:corroborated,coverage_status:failures.length?'below_proposed_quality_floor':'provisional_quality_floor_met',
    failures,top100:top,sensitivity,
    can_publish:false,can_write_registry:false,can_promote_to_edition:false};
  const publicSummary={schema_version:'wk100-public-methodology-summary-v1',
    product:'WAKILISHA 100',week_start_eat:input.week_start_eat,
    publication_status:'NOT_PUBLISHED',
    methodology:'Independent recordings are compared through source-native ranked observations from multiple operators and measurement families. Exact source identities, weights and computational configuration are not disclosed.',
    scope_note:'A defined multi-source evidence panel, not a census of all listening in Kenya.',
    privacy_note:'Individual partners and detailed scoring inputs are confidential; verification requires controlled independent audit.',
    verification_status:'INTERNAL_PREVIEW_ONLY',
    can_publish:false};
  return {privateAudit,publicSummary};
}

export function previewInputDigest(bytes){check(typeof bytes==='string'||bytes instanceof Uint8Array,'input_bytes');return hash(bytes);}
