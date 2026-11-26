/**
 * Charts 2.0, Phase 1: one pure, fail-closed original-byte observation gateway.
 *
 * No network, Storage, SQL, publication, scoring or method-admission action.
 * The caller MUST verify provider access and securely archive the exact original
 * before elevating any candidate into a trusted collection receipt.
 */
import {
  parseMdundoKenya, parseAudiomackKenya, parseShazamKenya,
  parseAppleKenyaPublicHtml,
  CHARTS2_AUDIOMACK_KE_PUBLIC_CHART_URL,
  CHARTS2_APPLE_KE_PUBLIC_CHART_URL,
  CHARTS2_YOUTUBE_KE_CHART_RESPONSE_URL,
} from './charts2-source-parsers.mjs';
import {parseYouTubeKenyaWeeklyCandidate} from './charts2-youtube-native-row.mjs';
import {parseYouTubeKenyaOfficialExport,YOUTUBE_EXPORT_ENDPOINT,YOUTUBE_EXPORT_MODE}
  from './charts2-youtube-official-export.mjs';

const MAX_ORIGINAL_BYTES = 4_000_000;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const SOURCE_CONTRACTS = Object.freeze({
  apple_ke: Object.freeze({
    market: 'KE', depth: 100, behavior: 'consumption', metric: 'rank',
    canonical_chart: 'Apple Music Kenya Top 100',
    first_party_endpoint: CHARTS2_APPLE_KE_PUBLIC_CHART_URL,
    endpoint_state: 'archive_research_reference_not_new_access_approval',
  }),
  shazam_ke: Object.freeze({
    market: 'KE', depth: 200, behavior: 'discovery', metric: 'rank',
    canonical_chart: 'Shazam Kenya Top 200',
    first_party_endpoint: 'https://www.shazam.com/services/charts/csv/top-200/kenya',
    endpoint_state: 'verified_first_party_csv_research_original_collector_method_held',
  }),
  mdundo_ke: Object.freeze({
    market: 'KE', depth: 100, behavior: 'consumption', metric: 'rank',
    canonical_chart: 'Mdundo Kenya Top Songs',
    first_party_endpoint: 'https://play.mdundo.com/top-charts/ke',
    endpoint_state: 'verified_first_party_research_original_collector_method_held',
  }),
  youtube_ke: Object.freeze({
    market: 'KE', depth: 100, behavior: 'video_consumption',
    metric: 'rank_and_count', canonical_chart: 'YouTube Kenya Weekly Top Songs',
    first_party_endpoint: CHARTS2_YOUTUBE_KE_CHART_RESPONSE_URL,
    endpoint_state: 'web_client_internal_post_not_approved_for_unattended_use',
  }),
  audiomack_ke: Object.freeze({
    market: 'KE', depth: 100, behavior: 'consumption', metric: 'rank',
    canonical_chart: 'Audiomack Kenya Weekly 100',
    first_party_endpoint: CHARTS2_AUDIOMACK_KE_PUBLIC_CHART_URL,
    endpoint_state: 'archive_research_reference_not_new_access_approval',
  }),
});

function fail(code) { throw new Error(code); }
function validUtc(value) {
  return typeof value === 'string' && UTC.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value;
}
function toBytes(value) {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 ||
    value.byteLength > MAX_ORIGINAL_BYTES) fail('charts2_original_bytes_invalid');
  return value;
}
/** Recheck bytes at every private research read. Receipt metadata by itself is
 * not proof that the stored original is present and unchanged. No provider
 * access, new source permission, or identity conclusion is implied.
 */
export async function verifyCharts2OriginalBytesV1(receipt,original_bytes) {
  if (!receipt || receipt.original_bucket !== 'charts2-evidence-private-v1' ||
      typeof receipt.original_object_key !== 'string' || !receipt.original_object_key ||
      typeof receipt.original_sha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(receipt.original_sha256) ||
      !Number.isSafeInteger(receipt.original_byte_length) ||
      receipt.original_byte_length < 1 || receipt.original_byte_length > MAX_ORIGINAL_BYTES)
    fail('charts2_original_receipt_invalid');
  if (!(original_bytes instanceof Uint8Array) ||
      original_bytes.byteLength !== receipt.original_byte_length)
    fail('charts2_original_bytes_mismatch');
  const digest = await crypto.subtle.digest('SHA-256', original_bytes);
  const hash = Array.from(new Uint8Array(digest), x =>
    x.toString(16).padStart(2,'0')).join('');
  if (hash !== receipt.original_sha256) fail('charts2_original_bytes_mismatch');
  return true;
}
function toText(bytes) {
  try { return new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
  catch { fail('charts2_original_utf8_invalid'); }
}
function parseJson(bytes) {
  try { return JSON.parse(toText(bytes)); }
  catch { fail('charts2_original_json_invalid'); }
}
function endpointAllowed(sourceKey, endpoint, officialExport=false) {
  if (typeof endpoint !== 'string' || endpoint.length > 2048)
    fail('charts2_source_endpoint_missing');
  const spec = SOURCE_CONTRACTS[sourceKey];
  if(officialExport){
    if(sourceKey!=='youtube_ke'||endpoint!==YOUTUBE_EXPORT_ENDPOINT)
      fail('charts2_source_endpoint_unreviewed');
    return;
  }
  // An exact chart URL prevents title-only/unrelated Shazam and Mdundo
  // pages from ever being recorded as the selected national ranking.
  if (!spec.first_party_endpoint || endpoint !== spec.first_party_endpoint)
    fail('charts2_source_endpoint_unreviewed');
}

export function listCharts2SourceContracts() {
  return Object.entries(SOURCE_CONTRACTS).map(([source_key, spec]) =>
    Object.freeze({source_key, ...spec}));
}

/**
 * Reuse the archived, Production-proven YouTube Kenya weekly Top Songs
 * request shape. This is only a request builder, not source-method admission.
 * The collector and SQL gateway must separately authorize exact POST access.
 */
export function charts2YouTubeNativeWeeklyPost(sourceKey, endpoint, targetPeriodKey) {
  if (sourceKey !== 'youtube_ke' ||
      endpoint !== SOURCE_CONTRACTS.youtube_ke.first_party_endpoint)
    fail('charts2_youtube_post_source_unqualified');
  const parts = typeof targetPeriodKey === 'string'
    ? /^weekly:(\d{8}):(\d{8}):ke$/.exec(targetPeriodKey) : null;
  if (!parts) fail('charts2_youtube_post_period_unqualified');
  const parseDay = value => {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (!m) return null;
    const time = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return new Date(time).toISOString().slice(0, 10).replaceAll('-', '') === value
      ? time : null;
  };
  const start = parseDay(parts[1]), end = parseDay(parts[2]);
  if (start === null || end === null || end - start !== 6 * 86400000 ||
      new Date(end).getUTCDay() !== 4)
    fail('charts2_youtube_post_period_unqualified');
  return Object.freeze({
    method: 'POST',
    body: JSON.stringify({
      context: {client: {clientName: 'WEB_MUSIC_ANALYTICS', clientVersion: '2.0',
        hl: 'en-GB', gl: 'KE', theme: 'MUSIC'}},
      browseId: 'FEmusic_analytics_charts_home',
      query: 'perspective=CHART_DETAILS&chart_params_country_code=ke' +
        '&chart_params_chart_type=TRACKS&chart_params_period_type=WEEKLY' +
        '&chart_params_end_date=' + parts[2],
    }),
  });
}

/**
 * Offline-only decoding of a privately supplied original. This function does
 * not assert that an external endpoint was reached or that its bytes are
 * genuine. Provider-byte provenance must be established by the caller.
 */
export async function decodeCharts2Original({
  source_key, original_bytes, endpoint, observed_at, target_period_key = null,
  capture_mode = null, operator_export_acknowledgement = null,
} = {}) {
  if (!Object.hasOwn(SOURCE_CONTRACTS, source_key))
    fail('charts2_source_not_selected');
  if (!validUtc(observed_at)) fail('charts2_observed_time_invalid');
  const officialExport=capture_mode===YOUTUBE_EXPORT_MODE;
  if(!officialExport&&operator_export_acknowledgement!==null)
    fail('charts2_export_acknowledgement_wrong_mode');
  endpointAllowed(source_key, endpoint, officialExport);
  const bytes = toBytes(original_bytes);
  let parsed;
  switch (source_key) {
    case 'apple_ke':
      parsed = parseAppleKenyaPublicHtml(toText(bytes), {endpoint});
      break;
    case 'mdundo_ke':
      parsed = parseMdundoKenya(toText(bytes));
      break;
    case 'audiomack_ke':
      parsed = parseAudiomackKenya(toText(bytes), {endpoint});
      break;
    case 'shazam_ke':
      parsed = parseShazamKenya(toText(bytes));
      break;
    case 'youtube_ke':
      if (typeof target_period_key !== 'string' ||
        !/^weekly:\d{8}:\d{8}:ke$/.test(target_period_key))
        fail('charts2_youtube_target_period_missing');
      parsed = officialExport
        ? parseYouTubeKenyaOfficialExport(toText(bytes),target_period_key,{
            endpoint,observed_at,acknowledgement:operator_export_acknowledgement})
        : parseYouTubeKenyaWeeklyCandidate(parseJson(bytes),target_period_key,{endpoint});
      break;
    default:
      fail('charts2_source_not_selected');
  }
  const contract = SOURCE_CONTRACTS[source_key];
  if (parsed.source_key !== source_key || parsed.market !== contract.market ||
    parsed.chart_depth !== contract.depth ||
    parsed.behavior !== contract.behavior || parsed.metric !== contract.metric ||
    parsed.observed_depth !== parsed.rows.length || !parsed.rows.length ||
    parsed.rows.length > contract.depth)
    fail('charts2_source_contract_mismatch');
  if (parsed.rows.some((r, i) => r.rank !== i+1 ||
      (r.provider_track_id !== null && r.provider_track_id !== undefined &&
       typeof r.provider_track_id !== 'string')))
    fail('charts2_source_rows_invalid');
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const payload_sha256 = Array.from(new Uint8Array(digest), x =>
    x.toString(16).padStart(2,'0')).join('');
  const unresolved_identity_count =
    parsed.rows.filter(r => !r.provider_track_id).length;
  const status = parsed.observed_depth === contract.depth
    ? 'succeeded' : 'partial_depth';
  if (parsed.status !== status) fail('charts2_source_status_mismatch');
  return Object.freeze({
    schema: 'charts2-original-candidate/v1', source_key, market: 'KE',
    observed_at, original_byte_length: bytes.byteLength,
    payload_sha256, original_storage_verified: false,
    source_access_authorized: false, source_method_state: 'requires_new_review',
    evidence_only: true, can_score: false, can_publish: false,
    source_endpoint: endpoint, target_period_key, status,
    native_period: parsed.native_period ?? 'unknown',
    ...(officialExport?{native_period_authority:parsed.native_period_authority}:{}),
    provider_updated_at: parsed.provider_updated_at ?? null,
    provider_week_ending_date: parsed.provider_week_ending_date ?? null,
    declared_depth: contract.depth, observed_depth: parsed.rows.length,
    unresolved_identity_count,
    // Source rows are private research material; never log this object.
    rows: Object.freeze(parsed.rows.map(r => Object.freeze({...r}))),
  });
}
