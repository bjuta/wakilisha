/**
 * WK100 fixed-ranking: restricted server data adapter, no Edge/browser route.
 * The caller MUST separately verify source-method admission. This helper
 * independently checks the signed-in actor's ingest, charts and Registry read
 * permissions, then reads the current W5 draft through its existing RPC. The service DB
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
  db,storage,caller,weekStartEat,selectedReceiptIds,eligibilityPolicySha256,
  parserAccessBySource,parseNativeRows,
}){
  need(db&&typeof db.from==='function'&&
    storage&&typeof storage.from==='function'&&caller&&
    typeof caller.rpc==='function'&&typeof caller.auth?.getUser==='function',
    'restricted_backend_missing');
  need(typeof parserAccessBySource==='function','parser_authority_missing');
  const identity=await caller.auth.getUser();
  need(!identity.error&&UUID.test(identity.data?.user?.id),
    'authenticated_caller_missing');
  for(const required_capability of ['manage_ingest','manage_charts','view_registry']){
    const result=await caller.rpc('current_user_has_capability',{required_capability});
    need(!result.error&&result.data===true,'caller_capability_missing');
  }
  const loadedDraft=await caller.rpc('wk100_get_admin_draft_v1',{p_week:weekStartEat});
  need(!loadedDraft.error&&loadedDraft.data,'current_w5_draft_unavailable');
  const current=loadedDraft.data;
  need(current.weekStartEat===weekStartEat&&Number.isSafeInteger(current.revision)&&
    current.revision>0&&typeof current.updatedAt==='string'&&
    Number.isFinite(Date.parse(current.updatedAt))&&current.config&&
    current.config.ingestPolicySha256===eligibilityPolicySha256,
    'current_w5_policy_mismatch');
  const savedDraft={week_start_eat:weekStartEat,revision:current.revision,
    updated_by:identity.data.user.id,updated_at:current.updatedAt,
    config_json:current.config};
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
    // Missing native IDs are preserved as unresolved W4 positions, not
    // invented identifiers or an excuse to compress the original ranks.
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
    const resolvedIds=uniq(activeTracks.map(x=>x.id));
    const registryTracks=resolvedIds.length?await readInBatches(db,'registry_tracks',
      'id,slug,title,isrc,release_id,duration_ms,explicit,preview_url,status,metadata,updated_at',
      [['eq','status','active']],'id',resolvedIds,400):[];
    const registryCredits=resolvedIds.length?await readInBatches(db,'registry_track_artists',
      'id,track_id,artist_id,role,is_primary,status',[],
      'track_id',resolvedIds,400):[];
    const artistIds=uniq(registryCredits.map(x=>x.artist_id).filter(x=>typeof x==='string'));
    const releaseIds=uniq(registryTracks.map(x=>x.release_id).filter(x=>typeof x==='string'));
    const registryArtists=artistIds.length?await readInBatches(db,'registry_artists',
      'id,slug,status,origin_iso2,gender,artist_type,metadata',[],
      'id',artistIds,400):[];
    const registryReleases=releaseIds.length?await readInBatches(db,'registry_releases',
      'id,slug,status,release_type,release_date,metadata,updated_at',[],
      'id',releaseIds,400):[];
    return {typedLinks,legacyLinks,activeTracks,registryTracks,registryCredits,
      registryArtists,registryReleases};
  };
  return prepareWk100AttestedPrivateRanking({weekStartEat,selectedReceiptIds,
    eligibilityPolicySha256,loadCapture,readPrivateBytes,loadRegistry,
    loadW5Draft:async()=>savedDraft,...(parseNativeRows?{parseNativeRows}:{})});
}
