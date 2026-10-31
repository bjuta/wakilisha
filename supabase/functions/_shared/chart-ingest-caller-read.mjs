/**
 * WAKILISHA Chart Ingest — same-run, read-only, caller-scoped evidence loader.
 * Research candidate ONLY. This module has NO writes, no role elevation,
 * no scoring or publication authority. The caller MUST pass the existing
 * caller-JWT Supabase client, after normal `manage_ingest` authorization.
 *
 * Schema paths were checked against the active Supabase information_schema on
 * 2026-10-30. Query column lists contain only currently existing fields.
 * Reads return original field names; they do not synthesize Registry evidence.
 */

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validId = x => typeof x === 'string' && ID.test(x);
const unique = a => [...new Set(a)];
export class IngestReadHold extends Error {
  constructor(code, table) {
    super(`ingest_read_hold:${code}:${table}`);
    this.name = 'IngestReadHold';
    this.code = code;
    this.table = table;
  }
}

// Notably NO raw_payload_json, Registry biography, private artist data or user data.
// Sensitive input is never embedded in error messages.
export const REQUIRED_READS = Object.freeze({
  chart_ingest_runs: 'id,status,market_slug,eligibility_profile_id,market_scope_snapshot_json,rule_snapshot_json,updated_at',
  chart_ingest_run_sources: 'id,run_id,provider,source_url,enabled,fetch_status',
  chart_ingest_raw_rows: 'id,run_id,source_id,provider,provider_track_id,provider_release_id,source_position,isrc,explicit,preview_url,raw_payload_hash',
  chart_ingest_candidates: 'id,run_id,provider_ids_json,source_count,status,title,artist_display,isrc,release_date,explicit,preview_url,updated_at,version',
  chart_ingest_matches: 'id,run_id,candidate_id,entity_type,status,canonical_entity_id,match_method',
  chart_ingest_exclusions: 'id,run_id,candidate_id,reason_code,source_stage,severity',
  chart_ingest_review_issues: 'id,run_id,candidate_id,issue_type,blocking,status',
  registry_tracks: 'id,title,isrc,status,release_id,explicit,duration_ms,preview_url,metadata',
  registry_track_artists: 'id,track_id,artist_id,role,is_primary,is_featured,status,credit_order',
  registry_artists: 'id,status,origin_iso2,gender,artist_type,metadata',
  registry_releases: 'id,status,release_type,release_date,metadata',
  registry_track_provider_links: 'id,track_id,provider_key,provider_track_id,match_status',
});
function assertClient(db){if(!db || typeof db.from!=='function')throw new TypeError('caller-scoped client required');}
function assertRows(response,table){
  if(response?.error)throw new IngestReadHold('query_failed',table);
  if(!Array.isArray(response?.data))throw new IngestReadHold('invalid_response',table);
  if(!Number.isSafeInteger(response.count)||response.count<0)throw new IngestReadHold('exact_count_missing',table);
}
/**
 * Read COMPLETE rows through stable id pagination, not a silent first-1000 API
 * result. If permissions, counts or batches are inconsistent, hold the run.
 */
async function allRows(db,table,where,{pageSize,maxRows}){
  let offset=0,expected=null,out=[],seen=new Set();
  do {
    let q=db.from(table).select(REQUIRED_READS[table],{count:'exact'});
    for(const [kind,col,value] of where){
      if(kind==='eq')q=q.eq(col,value);
      else if(kind==='in')q=q.in(col,value);
      else throw new IngestReadHold('unknown_filter',table);
    }
    let response;
    try {response=await q.order('id',{ascending:true}).range(offset,offset+pageSize-1);}
    catch {throw new IngestReadHold('query_failed',table);}
    assertRows(response,table);
    if(expected===null){expected=response.count;if(expected>maxRows)throw new IngestReadHold('row_limit_exceeded',table);}
    else if(expected!==response.count)throw new IngestReadHold('result_changed_during_read',table);
    if(response.data.length!==Math.min(pageSize,expected-offset))throw new IngestReadHold('incomplete_page',table);
    for(const row of response.data){
      if(!row || typeof row.id!=='string'||seen.has(row.id))throw new IngestReadHold('row_identity_duplicate_or_absent',table);
      seen.add(row.id);
    }
    out.push(...response.data);offset+=response.data.length;
  }while(offset<expected);
  if(out.length!==expected)throw new IngestReadHold('count_mismatch',table);
  return out;
}
async function byIds(db,table,column,ids,limits){
  if(!ids.length)return [];
  if(ids.some(id=>!validId(id)))throw new IngestReadHold('invalid_registry_uuid',table);
  const result=[];
  for(let start=0;start<ids.length;start+=100){
    result.push(...await allRows(db,table,[['in',column,ids.slice(start,start+100)]],limits));
    if(result.length>limits.maxRows)throw new IngestReadHold('row_limit_exceeded',table);
  }
  const seen=new Set();
  for(const row of result){if(seen.has(row.id))throw new IngestReadHold('duplicate_across_chunks',table);seen.add(row.id);}
  return result;
}

/**
 * Return a typed, non-authorizing read set for ONE run. No score/commit flag.
 * This intentionally DOES NOT claim full snapshot isolation across tables:
 * release acceptance must revalidate versions and evidence at commit time.
 */
export async function readCallerScopedChartRun(db,runId,{pageSize=200,maxRowsPerTable=5000}={}){
  assertClient(db);
  if(!validId(runId))throw new TypeError('valid run UUID required');
  if(!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw new TypeError('pageSize outside 1..500');
  if(!Number.isInteger(maxRowsPerTable)||maxRowsPerTable<1||maxRowsPerTable>20000)throw new TypeError('maxRowsPerTable outside 1..20000');
  const limits={pageSize,maxRows:maxRowsPerTable};
  const r=await allRows(db,'chart_ingest_runs',[['eq','id',runId]],limits);
  if(r.length!==1||r[0].id!==runId)throw new IngestReadHold('run_missing_or_unauthorized','chart_ingest_runs');
  const [runSources,rawRows,candidates,acceptedMatches,exclusions,reviewIssues]=await Promise.all([
    allRows(db,'chart_ingest_run_sources',[['eq','run_id',runId]],limits),
    allRows(db,'chart_ingest_raw_rows',[['eq','run_id',runId]],limits),
    allRows(db,'chart_ingest_candidates',[['eq','run_id',runId]],limits),
    allRows(db,'chart_ingest_matches',[['eq','run_id',runId]],limits),
    allRows(db,'chart_ingest_exclusions',[['eq','run_id',runId]],limits),
    allRows(db,'chart_ingest_review_issues',[['eq','run_id',runId]],limits),
  ]);
  for(const [table,rows] of Object.entries({chart_ingest_run_sources:runSources,chart_ingest_raw_rows:rawRows,chart_ingest_candidates:candidates,chart_ingest_matches:acceptedMatches,chart_ingest_exclusions:exclusions,chart_ingest_review_issues:reviewIssues})){
    if(rows.some(x=>x.run_id!==runId))throw new IngestReadHold('cross_run_row',table);
  }
  // Only accepted track identities are eligible for Registry lookup; mismatched
  // or malformed accepted IDs hold instead of being omitted silently.
  const accepted=acceptedMatches.filter(m=>m.status==='accepted'&&m.entity_type==='track');
  const trackIds=unique(accepted.map(m=>m.canonical_entity_id));
  if(trackIds.some(x=>!validId(x)))throw new IngestReadHold('accepted_track_uuid_invalid','chart_ingest_matches');
  const registryTracks=await byIds(db,'registry_tracks','id',trackIds,limits);
  const registryCredits=await byIds(db,'registry_track_artists','track_id',trackIds,limits);
  const artistIds=unique(registryCredits.map(c=>c.artist_id).filter(Boolean));
  if(registryCredits.some(c=>c.artist_id!==null&&!validId(c.artist_id)))throw new IngestReadHold('credit_artist_uuid_invalid','registry_track_artists');
  const registryArtists=await byIds(db,'registry_artists','id',artistIds,limits);
  const releaseIds=unique(registryTracks.map(t=>t.release_id).filter(Boolean));
  if(releaseIds.some(id=>!validId(id)))throw new IngestReadHold('release_uuid_invalid','registry_tracks');
  const registryReleases=await byIds(db,'registry_releases','id',releaseIds,limits);
  const registryProviderLinks=await byIds(db,'registry_track_provider_links','track_id',trackIds,limits);
  // Completeness: absence of a referenced Registry entity is a REVIEW HOLD,
  // never a guessed canonical relation or an empty successful review queue.
  const missingTracks=trackIds.filter(id=>!registryTracks.some(t=>t.id===id));
  const missingArtists=artistIds.filter(id=>!registryArtists.some(a=>a.id===id));
  const missingReleases=releaseIds.filter(id=>!registryReleases.some(a=>a.id===id));
  return {
    runId,run:r[0],runSources,rawRows,candidates,acceptedMatches,exclusions,reviewIssues,
    registryTracks,registryCredits,registryArtists,registryReleases,registryProviderLinks,
    missingEntities:{trackIds:missingTracks,artistIds:missingArtists,releaseIds:missingReleases},
    readCompleteness:missingTracks.length===0&&missingArtists.length===0&&missingReleases.length===0,
    sourceNativePeriodVerified:false,callerAuthorizationVerified:false,
    mayScore:false,mayPublish:false,canAdvanceToScoring:false,
  };
}
