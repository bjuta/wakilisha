/**
 * WK100 candidate-only collection orchestrator.
 * Reuses the accepted bounded transport, raw evidence hash, native source parsers,
 * and EAT kernel. Real adapters are injected; no built-in endpoint or credentials.
 * Does not publish a chart, rank providers against each other or alter the Registry.
 */
import { fetchCandidateBytes, archiveCandidateBytes, sha256Hex,
  CandidateCaptureError } from './chart-candidate-capture.mjs';
import { checkpointsForSource } from './chart-weekly-evidence.mjs';
import { parseMdundoKenya, parseAudiomackKenya, parseBoomplayKenya,
  parseShazamKenya, parseAppleKenya, parseYouTubeKenyaWeekly,
  parseSpotifyKenyaWeeklyCandidate,
} from './chart-public-source-observations.mjs';

const PARSERS = Object.freeze({
  mdundo_ke: bytes => parseMdundoKenya(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),
  audiomack_ke: bytes => parseAudiomackKenya(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),
  boomplay_ke: bytes => parseBoomplayKenya(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),
  shazam_ke: bytes => parseShazamKenya(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),
  spotify_ke: bytes => parseSpotifyKenyaWeeklyCandidate(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),
  apple_ke: (bytes, access) => parseAppleKenya(
    JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)), access),
  youtube_ke: (bytes, access) => parseYouTubeKenyaWeekly(
    JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)), access.native_period_key),
});

/** A source ID is distinct from its provider parser; IDs never grant fetch authority.
 * Provider-scoped sources need a manifest-bound parser class, while historical
 * provider-only contracts remain replayable without a class. */
const PARSER_CLASS=Object.freeze({
  mdundo_ke:'mdundo_kenya_chart_v1',
  audiomack_ke:'audiomack_kenya_chart_v1',
  boomplay_ke:'boomplay_kenya_chart_v1',
  shazam_ke:'shazam_kenya_discovery_v1',
  spotify_ke:'spotify_kenya_offered_chart_csv_v1',
  apple_ke:'apple_kenya_chart_v1',
  youtube_ke:'youtube_kenya_weekly_top_songs_v1',
});
export function resolveCaptureParser(contract,access={}) {
  if(!contract || typeof contract.source_key!=='string')return null;
  const key=contract.source_key;
  // No legacy Spotify collector existed. Never let a bare provider name
  // bypass the scoped adapter digest and separately reviewed method.
  if(key==='spotify_ke')return null;
  // Historical capture contracts selected the parser solely by source_key.
  // Their separate provider_key may be a legacy operator identifier,
  // not a native parser key. A conflicting known provider still fails.
  if(Object.hasOwn(PARSERS,key)) {
    const declared=contract.provider_key;
    if(typeof declared==='string' && Object.hasOwn(PARSERS,declared) && declared!==key)
      return null;
    return Object.freeze({providerKey:key,legacy:true});
  }
  // New provider-scoped identities require the exact sealed parser class
  // AND immutable adapter revision. Never infer a parser from the ID alone.
  const provider=contract.provider_key;
  if(typeof provider!=='string'||!Object.hasOwn(PARSERS,provider))return null;
  if(key.length>64 || !new RegExp('^'+provider+'_[a-z][a-z0-9_]{1,45}$').test(key) ||
     access.parser_class!==PARSER_CLASS[provider] ||
     contract.adapter_version!==PARSER_CLASS[provider])return null;
  return Object.freeze({providerKey:provider,legacy:false});
}
const exactUtc = x => typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(x)
  && !Number.isNaN(Date.parse(x)) && new Date(x).toISOString().replace('.000Z','Z') === x;
const fail = c => { throw new CandidateCaptureError(c); };
function requireValue(x, code) { if (!x) fail(code); }
function sourceContractForKernel(c) {
  return {source_key:c.source_key,behavior:c.behavior,metric:c.native_metric,
    market:c.market,depth:c.expected_depth,adapter_version:c.adapter_version,
    source_contract_version:c.contract_version,required:false,
    cadence:{kind:c.cadence_kind,hours:c.interval_hours??undefined,
      eat_hour:c.eat_hour,eat_minute:c.eat_minute,weekday_eat:c.weekday_eat??undefined},
    minimum_healthy_checkpoints:c.minimum_healthy_checkpoints};
}
export function validateCaptureSlot({contract,weekStartEat,scheduledAt,attemptNumber,access={},clock=new Date()}) {
  requireValue(resolveCaptureParser(contract,access),'source_unimplemented');
  requireValue(contract.admission_state==='candidate' && contract.market==='KE', 'source_unadmitted');
  requireValue(exactUtc(scheduledAt),'slot_invalid');
  requireValue(Number.isInteger(attemptNumber)&&attemptNumber>=1&&attemptNumber<=8,'attempt_number_invalid');
  requireValue(clock instanceof Date && !Number.isNaN(clock.valueOf()),'clock_invalid');
  const slots=checkpointsForSource(weekStartEat,sourceContractForKernel(contract));
  requireValue(slots.some(x=>x.scheduled_at===scheduledAt),'slot_unexpected');
  const elapsed=clock.valueOf()-Date.parse(scheduledAt);
  requireValue(elapsed>=0 && elapsed<=20*60*1000,'slot_outside_capture_window');
}
function normalizeNativeRows(parsed,contract,providerKey) {
  requireValue(parsed && parsed.candidate_only===true && parsed.eligible_for_scoring===false,
    'parser_cannot_admit_source');
  requireValue(parsed.source_key===providerKey && parsed.market==='KE' &&
    parsed.metric===contract.native_metric && parsed.behavior===contract.behavior,
    'parser_contract_mismatch');
  requireValue(Array.isArray(parsed.rows) && parsed.rows.length>=1 &&
    parsed.rows.length<=contract.expected_depth,'parser_depth_invalid');
  return parsed.rows.map((r,i)=>{
    requireValue(r.rank===i+1 && Number.isInteger(r.rank),'parser_rank_invalid');
    const item={rank:r.rank,
      provider_track_id:r.provider_track_id??null,
      title:r.title??null,artist:r.artist??null};
    if(contract.native_metric==='rank_and_count') {
      // Spotify streams and YouTube views are separate source-native metrics.
      // The immutable SQL column is generic source_native_count; the legacy
      // SQL RPC accepts 'view_count' only as its *wire field*. Keep that alias
      // confined to the final DB call rather than returning Spotify views.
      const spotify=providerKey==='spotify_ke';
      const count=spotify?r.chart_eligible_stream_count:r.view_count;
      requireValue(Number.isSafeInteger(count)&&count>=0,'parser_native_count_invalid');
      if(spotify)item.source_native_count=count;
      else item.view_count=count;
    } else requireValue(!Object.hasOwn(r,'view_count') &&
      !Object.hasOwn(r,'chart_eligible_stream_count'),'parser_native_metric_conflict');
    return item;
  });
}
/** The exact source-native decoder used for collection and later private replay. */
export function parseCaptureNativeRows(bytes,contract,access={}) {
  requireValue(bytes instanceof Uint8Array&&bytes.byteLength>=1&&
    bytes.byteLength<=4_194_304,'raw_bytes_invalid');
  const adapter=resolveCaptureParser(contract,access);
  requireValue(adapter,'source_unimplemented');
  return normalizeNativeRows(PARSERS[adapter.providerKey](bytes,access),contract,adapter.providerKey);
}

function dependency(db, names) {
  requireValue(db && names.every(n=>typeof db[n]==='function'),'capture_backend_missing');
}

/**
 * The authority/credential/source manifest must be independently approved.
 * No catch-up: execution is allowed only at the designated EAT checkpoint within 20 min.
 * Reservation precedes fetch; a bound object is always resumed from Storage,
 * NEVER silently re-fetched after crash. Source-invalid errors are not receipt claims.
 */
export async function runCandidateCapture({
  contract,weekStartEat,scheduledAt,attemptNumber=1,access,
  verifyAccess,db,storage,fetchImpl=fetch,clock=()=>new Date(),
  enabled=false, timeoutMs=12000,
}) {
  requireValue(enabled===true,'capture_not_enabled');
  dependency(db,['reserve','advance','commit','fail']);
  requireValue(storage && typeof storage.putCreateOnly==='function' &&
    typeof storage.readPrivate==='function','storage_adapter_missing');
  requireValue(access && access.source_key===contract?.source_key &&
    typeof verifyAccess==='function' &&
    typeof access.endpoint==='string' && typeof access.authorization_ref==='string',
    'access_not_configured');
  validateCaptureSlot({contract,weekStartEat,scheduledAt,attemptNumber,access,clock:clock()});
  const accessDecision={source_key:contract.source_key,exact_endpoint:access.endpoint,
    authorization_ref:access.authorization_ref,purpose:'candidate_raw_evidence'};
  // Do not reserve an unauthorized endpoint. Bound authority check also stops
  // a stalled verifier before any database claim, never dispatching a GET late.
  let authorityTimer;
  let allowed;
  try {
    allowed=await Promise.race([
      verifyAccess(accessDecision,{sourceKey:contract.source_key,
        endpoint:access.endpoint,stage:'preflight'}),
      new Promise((_,reject)=>{authorityTimer=setTimeout(
        ()=>reject(new CandidateCaptureError('source_access_timeout')),
        Math.min(timeoutMs,5000));}),
    ]);
  } finally {clearTimeout(authorityTimer);}
  requireValue(allowed===true,'source_access_not_authorized');
  const reservation=await db.reserve({p_contract_id:contract.id,
    p_week_start_eat:weekStartEat,p_scheduled_at:scheduledAt,p_attempt_number:attemptNumber});
  requireValue(reservation && typeof reservation.state==='string','reservation_invalid');
  if (reservation.state==='committed') return Object.freeze({status:'already_committed',
    receipt_id:reservation.receipt_id,can_publish:false});
  const resId=reservation.reservation_id,lease=reservation.lease_id;
  requireValue(typeof resId==='string'&&typeof lease==='string','reservation_invalid');

  let capture, raw;
  if (reservation.state==='reserved') {
    try {
      capture=await fetchCandidateBytes({sourceKey:contract.source_key,
        endpoint:access.endpoint,accessDecision,verifyAccess,
        providerAuthorization:access.providerAuthorization,fetchImpl,timeoutMs,now:clock});
    } catch(e) {
      if (e instanceof CandidateCaptureError &&
        ['transport_failed','transport_timeout','upstream_http_unaccepted',
         'redirect_forbidden','upstream_content_type_unaccepted','raw_body_empty',
         'raw_body_too_large','raw_stream_chunk_invalid','raw_body_stream_required'].includes(e.code)) {
        const receipt=await db.fail({p_reservation_id:resId,p_lease_id:lease,
          p_outcome:'transport_failed',p_upstream_reference:access.authorization_ref,
          p_failure_code:e.code==='transport_timeout'?'transport_timeout':'transport_failed'});
        return Object.freeze({...receipt,can_publish:false});
      }
      throw e;
    }
    const ledger={record:async event=>{
      if(event.state==='reserved') return db.advance({p_reservation_id:resId,p_lease_id:lease,
        p_action:'bind',p_object_key:event.object_key,p_payload_sha256:event.payload_sha256,
        p_content_type:event.content_type,p_byte_length:event.byte_length,p_fetched_at:capture.fetched_at});
      if(event.state==='uploaded_unverified') return db.advance({p_reservation_id:resId,p_lease_id:lease,p_action:'uploaded'});
      if(event.state==='verified') return db.advance({p_reservation_id:resId,p_lease_id:lease,p_action:'verified'});
      fail('unknown_ledger_transition');
    }};
    raw=await archiveCandidateBytes({capture,weekStartEat,scheduledAt,
      attemptNumber,storage,ledger});
  } else {
    // Strong restart semantics: once a digest is bound, NEVER poll provider anew.
    requireValue(['bound','uploaded','verified'].includes(reservation.state),
      'reservation_phase_invalid');
    let bytes;
    try {bytes=await storage.readPrivate(reservation.object_key);}
    catch {fail('reconciliation_object_missing');}
    requireValue(bytes instanceof Uint8Array && bytes.byteLength===reservation.byte_length &&
      await sha256Hex(bytes)===reservation.payload_sha256,'reconciliation_digest_mismatch');
    capture={source_key:contract.source_key,bytes,payload_sha256:reservation.payload_sha256,
      content_type:reservation.content_type,byte_length:reservation.byte_length,
      fetched_at:reservation.fetched_at,http_status:200};
    if(reservation.state==='bound') await db.advance({p_reservation_id:resId,p_lease_id:lease,p_action:'uploaded'});
    if(reservation.state!=='verified') await db.advance({p_reservation_id:resId,p_lease_id:lease,p_action:'verified'});
    raw={object_key:reservation.object_key,payload_sha256:reservation.payload_sha256};
  }
  let rows=[],outcome='parse_failed',failureCode=null;
  try {
    rows=parseCaptureNativeRows(capture.bytes,contract,access);
    outcome=rows.length===contract.expected_depth?'succeeded':'partial_depth';
  } catch (error) {
    // A real provider response for a *different* weekly chart is not a
    // malformed source body. Preserve its original private bytes and exact
    // receipt, but quarantine the due slot as target_period_unavailable.
    // Never infer provider-native start/end timestamps from an EAT slot.
    const wrongWeek=error instanceof Error &&
      error.message==='youtube_target_period_unavailable' &&
      resolveCaptureParser(contract,access)?.providerKey==='youtube_ke';
    outcome=wrongWeek?'target_period_unavailable':'parse_failed';
    failureCode=wrongWeek?'source_target_period_unavailable':'source_parse_failed';
  }
  // Preserve the old restricted SQL wire format without mislabelling
  // Spotify stream counts in any exported normalized provider observation.
  const sqlRows=rows.map(({source_native_count,...native})=>
    source_native_count===undefined?native:{...native,view_count:source_native_count});
  const receipt=await db.commit({p_reservation_id:resId,p_lease_id:lease,
    p_outcome:outcome,p_rows:sqlRows,p_upstream_reference:access.authorization_ref,
    p_failure_code:failureCode,
    p_native_period_start:null,p_native_period_end:null,p_native_period_evidence_ref:null});
  return Object.freeze({...receipt,raw_object_key:raw.object_key,
    payload_sha256:raw.payload_sha256,can_publish:false});
}
