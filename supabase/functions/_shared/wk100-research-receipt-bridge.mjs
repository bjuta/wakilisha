/**
 * WAKILISHA 100 researcher-directed original CSV handoff (pure, nonpublishing).
 *
 * This validates the EXISTING offline Shazam receipt against the original bytes
 * without network traffic, DB mutation, or private Storage credentials.
 * The accepted researcher-authenticated Edge route must separately enforce the
 * live JWT/capability, secure create-only private Storage readback, and durable
 * DB identity/immutability ledger before an import becomes a server receipt.
 * A matching SHA authenticates bytes against a supplied receipt, NOT provider
 * origin, legal source admission, native measurement dates, or scoring rights.
 */
import { parseShazamKenya } from './chart-public-source-observations.mjs';

const SHA = /^[a-f0-9]{64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;
const OPERATOR = /^[a-zA-Z0-9][a-zA-Z0-9_./:-]{7,239}$/;
const MAX_BYTES = 4_194_304;
const URLs = new Set([
  'https://www.shazam.com/charts/top-200/kenya',
  'https://www.shazam.com/services/charts/csv/top-200/kenya',
]);
const RECEIPT_KEYS = [
  'schema_version', 'source_key', 'source_url', 'observed_at',
  'operator_ref', 'acquisition_mode', 'raw_sha256', 'byte_length',
  'observed_depth', 'source_native_period', 'identity_state', 'can_publish',
];
const PERIOD_KEYS = ['authority', 'starts_at', 'ends_at'];
const fail = reason => { throw new Error('wk100_research_import_' + reason); };
const obj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const exact = (value, keys) => obj(value) && Object.keys(value).length === keys.length &&
  keys.every(k => Object.hasOwn(value, k));
function validMonday(value) {
  if (typeof value !== 'string' || !DAY.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value && parsed.getUTCDay() === 1;
}
function validUTC(value) {
  if (typeof value !== 'string' || !UTC.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().replace('.000Z', 'Z') === value;
}
async function sha256(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest].map(b => b.toString(16).padStart(2, '0')).join('');
}
/**
 * The return contains PRIVATE observation labels. Never serialize it into an
 * ordinary browser response or treat it as a publisher/ranking admission.
 */
export async function verifyWk100ShazamResearchImport({
  originalBytes, receipt, researchWeekStartEat,
}) {
  if (!validMonday(researchWeekStartEat)) fail('week_invalid');
  if (!(originalBytes instanceof Uint8Array) ||
      originalBytes.byteLength < 1 || originalBytes.byteLength > MAX_BYTES)
    fail('byte_size_invalid');
  if (!exact(receipt, RECEIPT_KEYS) ||
      receipt.schema_version !== 'wk100-shazam-research-receipt-v1' ||
      receipt.source_key !== 'shazam_ke' || !URLs.has(receipt.source_url) ||
      receipt.acquisition_mode !== 'researcher_directed_public_csv' ||
      !validUTC(receipt.observed_at) || typeof receipt.operator_ref !== 'string' ||
      !OPERATOR.test(receipt.operator_ref) ||
      !SHA.test(receipt.raw_sha256) ||
      receipt.byte_length !== originalBytes.byteLength ||
      !Number.isInteger(receipt.observed_depth) ||
      receipt.observed_depth < 1 || receipt.observed_depth > 200 ||
      !exact(receipt.source_native_period, PERIOD_KEYS) ||
      receipt.source_native_period.authority !== 'unknown' ||
      receipt.source_native_period.starts_at !== null ||
      receipt.source_native_period.ends_at !== null ||
      receipt.identity_state !== 'unresolved' || receipt.can_publish !== false)
    fail('receipt_invalid');

  if (await sha256(originalBytes) !== receipt.raw_sha256)
    fail('original_bytes_mismatch');
  let parsed;
  try {
    parsed = parseShazamKenya(new TextDecoder('utf-8', {fatal:true}).decode(originalBytes));
  } catch { fail('source_native_parse_failed'); }
  if (parsed.source_key !== 'shazam_ke' || parsed.market !== 'KE' ||
      parsed.behavior !== 'discovery' || parsed.metric !== 'rank' ||
      parsed.observed_depth !== receipt.observed_depth ||
      parsed.rows.length !== receipt.observed_depth ||
      parsed.rows.some((r,i) => r.rank !== i+1 ||
        r.provider_track_id !== null || typeof r.title !== 'string' ||
        typeof r.artist !== 'string' || !r.title || !r.artist ||
        r.view_count !== undefined || r.stream_count !== undefined))
    fail('native_observation_mismatch');

  return Object.freeze({
    schema_version:'wk100-private-research-import-verified-v1',
    source_key:'shazam_ke',market:'KE',research_week_start_eat:researchWeekStartEat,
    observation_time_utc:receipt.observed_at,
    acquisition_mode:'researcher_directed_public_csv',
    raw_sha256:receipt.raw_sha256,byte_length:originalBytes.byteLength,
    source_native_metric:'rank',source_behavior:'discovery',
    native_period_authority:'unknown',source_origin_independently_attested:false,
    source_admitted:false,can_score:false,can_publish:false,
    private_rows:Object.freeze(parsed.rows.map(row => Object.freeze({
      row_ref:`${receipt.raw_sha256}:${row.rank}`,
      source_rank:row.rank,title_observed:row.title,artist_observed:row.artist,
      provider_track_id:null,canonical_track_id:null,source_native_count:null,
    }))),
  });
}


const LOCAL_FIELDS=[
 'schema_version','source_key','market','source_page_url',
 'original_byte_length','original_sha256','checked_at_utc',
 'source_retrieved_at_utc','source_fetch_verified','observed_rank_count',
 'advertised_chart_depth','complete_chart','behavior','native_metric',
 'provider_period_label','provider_snapshot_date','provider_rolling_window_days',
 'native_period_start','native_period_end','native_period_authority',
 'source_admitted','original_bytes_in_receipt','hosted_receipt_verified',
 'can_score','can_publish',
];
const LOCAL_AT=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
const AUTH_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Promote only the *format* of a verified local research receipt, not its
 * evidence authority. The time is the local check time, not provider fetch.
 * The real authenticated actor replaces any caller-supplied operator claim.
 * The downstream strict legacy bridge still parses and verifies original rows.
 */
export async function coerceWk100ShazamResearchIntakeReceipt({
 originalBytes,receipt,researchWeekStartEat,authenticatedUserId,now=new Date(),
}){
 if(receipt?.schema_version!=='wk100-local-public-research-receipt/v1')
   return receipt; // The legacy receipt verifier remains authoritative.
 if(!validMonday(researchWeekStartEat)||
   !(originalBytes instanceof Uint8Array)||
   originalBytes.byteLength<1||originalBytes.byteLength>MAX_BYTES||
   !AUTH_UUID.test(authenticatedUserId??'')||
   !(now instanceof Date)||!Number.isFinite(now.valueOf())||
   !exact(receipt,LOCAL_FIELDS)||
   receipt.source_key!=='shazam_ke'||receipt.market!=='KE'||
   receipt.source_page_url!=='https://www.shazam.com/charts/top-200/kenya'||
   !SHA.test(receipt.original_sha256)||
   receipt.original_byte_length!==originalBytes.byteLength||
   typeof receipt.checked_at_utc!=='string'||!LOCAL_AT.test(receipt.checked_at_utc)||
   !Number.isFinite(Date.parse(receipt.checked_at_utc))||
   new Date(receipt.checked_at_utc).toISOString()!==receipt.checked_at_utc||
   receipt.source_retrieved_at_utc!==null||
   receipt.source_fetch_verified!==false||
   receipt.advertised_chart_depth!==200||
   receipt.behavior!=='discovery'||receipt.native_metric!=='rank'||
   receipt.native_period_start!==null||receipt.native_period_end!==null||
   receipt.native_period_authority!=='unknown'||
   receipt.source_admitted!==false||receipt.original_bytes_in_receipt!==false||
   receipt.hosted_receipt_verified!==false||
   receipt.can_score!==false||receipt.can_publish!==false)fail('receipt_invalid');
 const at=Date.parse(receipt.checked_at_utc);
 const start=Date.parse(researchWeekStartEat+'T00:00:00Z')-3*3600000;
 if(at<start||at>=start+7*86400000||at>now.valueOf()+600000)
   fail('observation_time_invalid');
 if(await sha256(originalBytes)!==receipt.original_sha256)
   fail('original_bytes_mismatch');
 let parsed;
 try{parsed=parseShazamKenya(new TextDecoder('utf-8',{fatal:true}).decode(originalBytes));}
 catch{fail('source_native_parse_failed');}
 if(parsed.source_key!=='shazam_ke'||parsed.market!=='KE'||
   parsed.behavior!=='discovery'||parsed.metric!=='rank'||
   parsed.native_period!=='unknown'||parsed.eligible_for_scoring!==false||
   parsed.observed_depth!==receipt.observed_rank_count||
   parsed.observed_depth<1||parsed.observed_depth>200||
   receipt.complete_chart!==(parsed.observed_depth===200)||
   receipt.provider_period_label!==(parsed.provider_period_label??null)||
   receipt.provider_snapshot_date!==(parsed.provider_snapshot_date??null)||
   receipt.provider_rolling_window_days!==(parsed.provider_rolling_window_days??null))
   fail('native_observation_mismatch');
 return Object.freeze({
   schema_version:'wk100-shazam-research-receipt-v1',source_key:'shazam_ke',
   source_url:'https://www.shazam.com/charts/top-200/kenya',
   observed_at:new Date(at).toISOString().replace(/\.\d{3}Z$/,'Z'),
   operator_ref:'auth_user:'+authenticatedUserId,
   acquisition_mode:'researcher_directed_public_csv',
   raw_sha256:receipt.original_sha256,byte_length:originalBytes.byteLength,
   observed_depth:parsed.observed_depth,
   source_native_period:{authority:'unknown',starts_at:null,ends_at:null},
   identity_state:'unresolved',can_publish:false,
 });
}

/** Strict sanitized browser projection; original titles, raw bytes and actor omitted. */
export function projectWk100ResearchImportStatus(verified) {
  if (!verified || verified.schema_version !== 'wk100-private-research-import-verified-v1' ||
      verified.source_admitted !== false || verified.can_score !== false ||
      verified.can_publish !== false || !Array.isArray(verified.private_rows))
    fail('unverified_projection');
  return Object.freeze({
    source:'Shazam Kenya',research_week_start_eat:verified.research_week_start_eat,
    observed_depth:verified.private_rows.length,source_native_metric:'discovery_rank',
    native_period_authority:'unknown',status:'research_only',
    can_score:false,can_publish:false,
  });
}
