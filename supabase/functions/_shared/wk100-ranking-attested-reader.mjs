/**
 * WK100 fixed-ranking: restricted server data adapter, no Edge/browser route.
 * The caller MUST already have authenticated a privileged Admin/service actor,
 * verified source admission and resolved the saved W5 policy. The service DB
 * key and private Storage client must never leave the server. No writes.
 *
 * This adapter reuses the exact existing capture, private Storage and Registry
 * authorities; it never queries latest source or infers links from song titles.
 */
import {prepareWk100AttestedPrivateRanking}
  from './wk100-ranking-attested-evidence.mjs';
import {wk100RegistryProviderKey}
  from './wk100-identify-observations.mjs';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=code=>{throw new Error('wk100_rank_reader_'+code);};
const need=(v,c)=>{if(!v)fail(c);};
const uniq=xs=>[...new Set(xs)];
const BUCKET='wk-chart-raw-evidence-v1';
const MAX_BYTES=4_194_304;
async function query(db,table,columns,where,limit){
  let q=db.from(table).select(columns);
  need(q&&typeof q.eq==='function'&&typeof q.in==='function'&&
    typeof q.limit==='function','query_boundary_missing');
  for(const [op,key,value] of where)q=q[op](key,value);
  const {data,error}=await q.limit(limit+1);
  need(!error&&Array.isArray(data)&&data.length<=limit,'query_invalid_'+table);
  return data;
}
async function one(db,table,columns,where){
  const items=await query(db,table,columns,where,1);
  need(items.length===1,'exact_row_missing_'+table);
  return items[0];
}
async function readInBatches(db,table,columns,where,key,ids,limit=400){
  const output=[];
  for(let i=0;i<ids.length;i+=120){
    const items=await query(db,table,columns,
      [...where,['in',key,ids.slice(i,i+120)]],limit);
    output.push(...items);
    need(output.length<=limit,'query_overflow_'+table);
  }
  return output;
}
/**
 * Server-only. No database keys, storage bytes, source metadata, scores or
 * rejected-row details are returned to a browser. The stored W5 policy and
 * an independently verified eligibility evaluator are REQUIRED dependencies.
 */
export async function readWk100AttestedRankingPrivate({
  db,storage,weekStartEat,selectedReceiptIds,eligibilityPolicySha256,
  evaluateW5Row,parserAccessBySource,parseNativeRows,
}){
  need(db&&typeof db.from==='function'&&
    storage&&typeof storage.from==='function','restricted_backend_missing');
  need(typeof evaluateW5Row==='function'&&typeof parserAccessBySource==='function',
    'policy_or_parser_authority_missing');
  const bucket=storage.from(BUCKET);
  need(bucket&&typeof bucket.download==='function','private_bucket_missing');
  const loadCapture=async receiptId=>{
    need(typeof receiptId==='string'&&UUID.test(receiptId),'receipt_selection_invalid');
    const attempt=await one(db,'wk_chart_capture_attempts_v1',
      'id,contract_id,week_start_eat,status,observed_market,observed_depth,record_count,fetched_at,payload_sha256,raw_object_key,native_period_authority,native_period_start,native_period_end,native_period_evidence_ref',
      [['eq','id',receiptId],['eq','week_start_eat',weekStartEat]]);
    const contract=await one(db,'wk_chart_capture_contracts_v1',
      'id,source_key,provider_key,market,native_metric,expected_depth,adapter_version,admission_state',
      [['eq','id',attempt.contract_id]]);
    const rows=await query(db,'wk_chart_capture_rows_v1',
      'id,attempt_id,source_rank,provider_track_id,title_observed,artist_observed,source_native_count',
      [['eq','attempt_id',receiptId]],200);
    const parserAccess=await parserAccessBySource(contract,attempt);
    need(parserAccess!==null&&typeof parserAccess==='object'&&!Array.isArray(parserAccess),
      'parser_scope_invalid');
    return {attempt,contract,rows,parserAccess};
  };
  const readPrivateBytes=async attempt=>{
    const {data,error}=await bucket.download(attempt.raw_object_key);
    need(!error&&data&&typeof data.arrayBuffer==='function'&&
      Number.isInteger(data.size)&&data.size>=1&&data.size<=MAX_BYTES,
      'private_raw_unavailable');
    const bytes=new Uint8Array(await data.arrayBuffer());
    need(bytes.byteLength===data.size,'private_raw_size_mismatch');
    return bytes;
  };
  const loadRegistry=async ({contract,rows})=>{
    const provider=wk100RegistryProviderKey(contract.provider_key);
    const providerIds=uniq(rows.map(row=>row.provider_track_id)
      .filter(x=>typeof x==='string'&&x.length>0));
    need(providerIds.length===rows.length,'provider_identity_unavailable_or_repeated');
    const typedLinks=await readInBatches(db,'registry_track_provider_links',
      'provider_key,provider_track_id,track_id,match_status',
      [['eq','provider_key',provider],['eq','match_status','matched']],
      'provider_track_id',providerIds,400);
    const legacyLinks=await readInBatches(db,'provider_entity_links',
      'provider,provider_entity_id,registry_entity_id,registry_entity_type,match_status',
      [['eq','provider',provider],['eq','registry_entity_type','track'],
       ['eq','match_status','confirmed']], 'provider_entity_id',providerIds,400);
    const trackIds=uniq([...typedLinks.map(l=>l.track_id),
      ...legacyLinks.map(l=>l.registry_entity_id)].filter(x=>typeof x==='string'&&UUID.test(x)));
    const activeTracks=trackIds.length?await readInBatches(db,'registry_tracks',
      'id,status,updated_at',[['eq','status','active']],'id',trackIds,400):[];
    return {typedLinks,legacyLinks,activeTracks};
  };
  return prepareWk100AttestedPrivateRanking({weekStartEat,selectedReceiptIds,
    eligibilityPolicySha256,loadCapture,readPrivateBytes,loadRegistry,
    evaluateW5Row,...(parseNativeRows?{parseNativeRows}:{})});
}
