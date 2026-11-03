/**
 * WK100: read-only capture -> optional Registry identity -> private rank kernel.
 *
 * Caller MUST supply a service-role-only database reader and a private Storage
 * object reader behind an existing authenticated server boundary. This module
 * never fetches providers, mutates the Registry or writes a Chart Edition.
 * Unresolved identities are distinct source-anchored scoring candidates, not
 * cross-source matches. All receipts are explicit (no latest-wins).
 */
import {buildWk100CaptureRankingInput} from './wk100-capture-ranking-bridge.mjs';
import {buildWk100PrivatePreview} from './wk100-private-preview-core.mjs';
import {parseCaptureNativeRows} from './chart-capture-runtime.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const KEY=/^[a-z][a-z0-9_:-]{2,79}$/;
const MAX_BYTES=4194304;
const fail=code=>{throw new Error(`wk100_reader_${code}`);};
const demand=(value,code)=>{if(!value)fail(code);};
const uniq=xs=>[...new Set(xs)];
const stableJson=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)
  ?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
async function digestBytes(bytes){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
    .map(b=>b.toString(16).padStart(2,'0')).join('');
}

async function read(db,table,columns,filters,limit=200) {
  demand(db&&typeof db.from==='function','service_reader_missing');
  let q=db.from(table).select(columns);
  demand(q&&typeof q.eq==='function'&&typeof q.in==='function'&&typeof q.limit==='function',
    'query_adapter_missing');
  for(const [operator,column,value] of filters)q=q[operator](column,value);
  const {data,error}=await q.limit(limit+1);
  if(error)fail(`query_${table}`);
  demand(Array.isArray(data)&&data.length<=limit,'read_overflow');
  return data;
}

async function verifyPrivateRaw(readRawBytes,attempt) {
  demand(typeof readRawBytes==='function','raw_reader_missing');
  demand(typeof attempt.raw_object_key==='string'&&attempt.raw_object_key.length>=12&&
    SHA.test(attempt.payload_sha256),'raw_reference_invalid');
  const bytes=await readRawBytes(attempt.raw_object_key,attempt.id);
  demand(bytes instanceof Uint8Array&&bytes.byteLength>=1&&bytes.byteLength<=MAX_BYTES,
    'raw_bytes_invalid');
  const digest=await digestBytes(bytes);
  demand(digest===attempt.payload_sha256,'raw_digest_mismatch');
  return bytes;
}

/**
 * A receipt SHA proves only the private object's bytes. For an authorized
 * candidate, independently replay the collector's exact native parser and
 * compare every immutable database rank/identity/measurement field. The
 * provider's legal grant and native-period truth remain separate review gates.
 */
function verifyNativeRows(bytes,contract,attempt,rows) {
  let replayed;
  try {
    replayed=parseCaptureNativeRows(bytes,contract,{
      native_period_key:attempt.native_period_evidence_ref,
      parser_class:contract.adapter_version,
    });
  } catch {
    fail('native_replay_unavailable');
  }
  demand(replayed.length===rows.length,'native_row_mismatch');
  const byRank=new Map(rows.map(row=>[row.source_rank,row]));
  demand(byRank.size===rows.length,'native_row_mismatch');
  for(const native of replayed) {
    const stored=byRank.get(native.rank);
    demand(stored&&
      stored.provider_track_id===native.provider_track_id&&
      stored.title_observed===native.title&&
      stored.artist_observed===native.artist&&
      stored.source_native_count===(Object.hasOwn(native,'view_count')?native.view_count:null),
      'native_row_mismatch');
  }
}

/**
 * Only exact, existing matched provider links count as a resolved recording.
 * A missing, conflicting, inactive or non-UUID Registry identity is queued
 * for independent enrichment, never inferred from title/artist similarity.
 * Accepted provider/Track links
 * from both existing authorities must agree if both have evidence.
 */
export async function readWk100PrivateRankingEvidence({
  db,readRawBytes,week_start_eat,selected_attempt_ids,constitution,
  method,dataset_mode='synthetic',
}) {
  demand(typeof week_start_eat==='string'&&/^\d{4}-\d\d-\d\d$/.test(week_start_eat),
    'week_invalid');
  const date=Date.parse(`${week_start_eat}T00:00:00Z`);
  demand(Number.isFinite(date)&&new Date(date).toISOString().startsWith(`${week_start_eat}T`)&&
    new Date(date).getUTCDay()===1,'week_invalid');
  demand(['synthetic','authorized_candidate'].includes(dataset_mode),'mode_invalid');
  demand(Array.isArray(selected_attempt_ids)&&selected_attempt_ids.length>=2&&
    selected_attempt_ids.length<=8&&selected_attempt_ids.every(x=>UUID.test(x))&&
    uniq(selected_attempt_ids).length===selected_attempt_ids.length,'attempt_selection_invalid');
  demand(Array.isArray(constitution)&&constitution.length===selected_attempt_ids.length,
    'constitution_count_invalid');
  demand(constitution.every(s=>s&&typeof s.source_key==='string'&&KEY.test(s.source_key)&&
    typeof s.operator_key==='string'&&KEY.test(s.operator_key)&&
    typeof s.authority_ref==='string'&&KEY.test(s.authority_ref)),
    'constitution_invalid');
  demand(uniq(constitution.map(s=>s.source_key)).length===constitution.length&&
    uniq(constitution.map(s=>s.operator_key)).length===constitution.length,
    'constitution_duplicate');

  // Explicit selected attempt IDs, not a query for the latest capture.
  const attempts=await read(db,'wk_chart_capture_attempts_v1',
    'id,contract_id,week_start_eat,scheduled_at,attempt_number,status,observed_market,observed_depth,record_count,payload_sha256,raw_object_key,native_period_authority,native_period_start,native_period_end,native_period_evidence_ref',
    [['in','id',selected_attempt_ids],['eq','week_start_eat',week_start_eat]],8);
  demand(attempts.length===selected_attempt_ids.length,'attempt_missing');
  const attemptIds=uniq(attempts.map(a=>a.id));
  demand(attemptIds.length===attempts.length,'attempt_duplicate');
  const contracts=await read(db,'wk_chart_capture_contracts_v1',
    'id,source_key,provider_key,market,behavior,native_metric,expected_depth,contract_version,admission_state',
    [['in','id',uniq(attempts.map(a=>a.contract_id))]],8);
  const contractById=new Map(contracts.map(c=>[c.id,c]));
  demand(contracts.length===uniq(attempts.map(a=>a.contract_id)).length,'contract_missing');
  const authorityBySource=new Map(constitution.map(s=>[s.source_key,s]));
  const selected=[];
  const sourcesSeen=new Set(),operatorsSeen=new Set(),providersSeen=new Set();
  for(const attempt of attempts) {
    const contract=contractById.get(attempt.contract_id), authority=authorityBySource.get(contract?.source_key);
    demand(contract&&authority&&attempt.status==='succeeded'&&attempt.observed_market==='KE'&&
      contract.market==='KE'&&contract.admission_state==='candidate', 'selected_receipt_invalid');
    demand(!sourcesSeen.has(contract.source_key)&&!operatorsSeen.has(authority.operator_key)&&
      !providersSeen.has(contract.provider_key),'independent_source_duplicate');
    sourcesSeen.add(contract.source_key);operatorsSeen.add(authority.operator_key);
    providersSeen.add(contract.provider_key);
    demand(Number.isInteger(contract.expected_depth)&&contract.expected_depth>=1&&
      contract.expected_depth<=200&&attempt.observed_depth===contract.expected_depth&&
      attempt.record_count===contract.expected_depth,'selected_depth_invalid');
    const rows=await read(db,'wk_chart_capture_rows_v1',
      'id,attempt_id,source_rank,provider_track_id,title_observed,artist_observed,source_native_count',
      [['eq','attempt_id',attempt.id]],200);
    demand(rows.length===contract.expected_depth,'rows_incomplete');
    const rawBytes=await verifyPrivateRaw(readRawBytes,attempt);
    if(dataset_mode==='authorized_candidate')
      verifyNativeRows(rawBytes,contract,attempt,rows);
    selected.push({attempt,contract,authority,rows});
  }
  demand(sourcesSeen.size===constitution.length,'constitution_source_missing');

  // Look up exact provider-native IDs in WAKILISHA's existing Registry links.
  const allCandidateIds=new Set(),possibleByRow=new Map();
  for(const source of selected) {
    const provider=source.contract.provider_key;
    const ids=uniq(source.rows.map(row=>row.provider_track_id).filter(x=>typeof x==='string'&&x.length>0));
    const links=ids.length?await read(db,'registry_track_provider_links',
      'provider_key,provider_track_id,track_id,match_status',
      [['eq','provider_key',provider],['eq','match_status','matched'],['in','provider_track_id',ids]],200):[];
    const legacy=ids.length?await read(db,'provider_entity_links',
      'provider,provider_entity_id,registry_entity_id,registry_entity_type,match_status',
      [['eq','provider',provider],['eq','registry_entity_type','track'],
       ['eq','match_status','confirmed'],['in','provider_entity_id',ids]],200):[];
    for(const row of source.rows) {
      const matched=[...links.filter(x=>x.provider_track_id===row.provider_track_id).map(x=>x.track_id),
        ...legacy.filter(x=>x.provider_entity_id===row.provider_track_id).map(x=>x.registry_entity_id)];
      const unique=uniq(matched);
      possibleByRow.set(row.id,unique);
      for(const id of unique)if(UUID.test(id))allCandidateIds.add(id);
    }
  }
  // Verify all resolved candidates are live Registry Tracks, not inactive shells.
  const ids=[...allCandidateIds];
  const active=new Set();
  for(let i=0;i<ids.length;i+=200) {
    const matches=await read(db,'registry_tracks','id,status',
      [['in','id',ids.slice(i,i+200)],['eq','status','active']],200);
    for(const track of matches)if(UUID.test(track.id)&&track.status==='active')active.add(track.id);
  }
  const resolutions=[],reviews=[];
  for(const source of selected)for(const row of source.rows) {
    const candidates=possibleByRow.get(row.id)||[];
    if(candidates.length===1&&active.has(candidates[0])&&UUID.test(candidates[0])) {
      resolutions.push({capture_row_id:row.id,recording_id:candidates[0]});
    } else {
      reviews.push({source_key:source.contract.source_key,capture_row_id:row.id,
        provider_track_id:row.provider_track_id,
        reason:candidates.length===0?'unresolved':candidates.length>1?'conflicting_identity':'inactive_identity'});
    }
  }
  reviews.sort((a,b)=>a.source_key.localeCompare(b.source_key)||
    a.capture_row_id.localeCompare(b.capture_row_id));
  const projected=buildWk100CaptureRankingInput({week_start_eat,dataset_mode,method,
    sources:selected.map(s=>({contract:s.contract,attempt:s.attempt,rows:s.rows,
      operator_key:s.authority.operator_key,authority_ref:s.authority.authority_ref})),
    resolutions});
  const inputSha256=await digestBytes(new TextEncoder().encode(stableJson(projected.input)));
  const preview=buildWk100PrivatePreview(projected.input,inputSha256);
  return {status:'private_preview',week_start_eat,
    selected_attempt_ids:[...selected_attempt_ids].sort(),
    verified_receipts:selected.length, resolved_rows:resolutions.length,
    pending_identity_rows:reviews.length,review_rows:reviews,
    rank_input_sha256:inputSha256,provenance:projected.provenance,private_audit:preview.privateAudit,
    public_methodology_summary:preview.publicSummary,can_publish:false};
}
