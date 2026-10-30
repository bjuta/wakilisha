/**
 * Convert selected immutable WK100 capture receipts into the existing private
 * ranking preview's source-native input shape. This is a pure projection:
 * no provider requests, Registry writes, scoring weights, or edition changes.
 *
 * The caller supplies a fixed source/operator constitution and optional
 * verified Registry Track UUIDs. Unresolved rows get source-evidence-anchored,
 * non-UUID observation references; no inferred cross-source equivalence.
 * A receipt never acquires canonical identity authority through this bridge.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA = /^[a-f0-9]{64}$/;
const KEY = /^[a-z][a-z0-9_:-]{2,79}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BEHAVIORS = new Set(['consumption','video_consumption','discovery','broadcast_exposure']);
const VALID_DATASETS = new Set(['synthetic','authorized_candidate']);
const fail = code => { throw new Error(`wk100_bridge_${code}`); };
const requireValue = (value, code) => { if (!value) fail(code); };
const isObject = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const validTime = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(x)
  && Number.isFinite(Date.parse(x));
const utcTime = x => new Date(x).toISOString().replace('.000Z','Z');

/**
 * @param {object} options
 * @param {string} options.week_start_eat Monday in Africa/Nairobi
 * @param {'synthetic'|'authorized_candidate'} options.dataset_mode
 * @param {object} options.method Existing private-preview method, passed unchanged
 * @param {Array<{contract: object, attempt: object, rows: object[], operator_key: string, authority_ref: string}>} options.sources
 * @param {Array<{capture_row_id:string, recording_id:string}>} options.resolutions
 * @returns {{input:object, provenance:object[], can_publish:false}}
 * Provisional refs are NOT Registry UUIDs and must never be put in canonical_track_id.
 */
export function buildWk100CaptureRankingInput({
  week_start_eat, dataset_mode, method, sources, resolutions,
}) {
  requireValue(typeof week_start_eat === 'string' && DATE.test(week_start_eat), 'week_invalid');
  const weekMs = Date.parse(`${week_start_eat}T00:00:00Z`);
  requireValue(Number.isFinite(weekMs) &&
    new Date(weekMs).toISOString().startsWith(`${week_start_eat}T`) &&
    new Date(weekMs).getUTCDay() === 1, 'week_not_monday');
  requireValue(VALID_DATASETS.has(dataset_mode), 'dataset_invalid');
  requireValue(isObject(method), 'method_missing');
  requireValue(Array.isArray(sources) && sources.length >= 1 && sources.length <= 8,
    'sources_invalid');
  requireValue(Array.isArray(resolutions), 'resolutions_invalid');

  const mapped = new Map();
  for (const resolution of resolutions) {
    requireValue(isObject(resolution) && UUID.test(resolution.capture_row_id) &&
      UUID.test(resolution.recording_id), 'resolution_invalid');
    requireValue(!mapped.has(resolution.capture_row_id), 'resolution_duplicate');
    mapped.set(resolution.capture_row_id, resolution.recording_id);
  }

  const usedRows = new Set(), sourceKeys = new Set(), operatorKeys = new Set();
  const provenance = [];
  const previewSources = [];
  for (const source of sources) {
    requireValue(isObject(source) && isObject(source.contract) &&
      isObject(source.attempt) && Array.isArray(source.rows), 'source_invalid');
    const {contract, attempt, rows, operator_key, authority_ref} = source;
    requireValue(UUID.test(contract.id) && UUID.test(attempt.id) &&
      attempt.contract_id === contract.id && attempt.week_start_eat === week_start_eat,
      'receipt_contract_mismatch');
    requireValue(typeof contract.source_key === 'string' && KEY.test(contract.source_key) &&
      typeof operator_key === 'string' && KEY.test(operator_key) &&
      typeof authority_ref === 'string' && KEY.test(authority_ref),
      'source_identity_invalid');
    requireValue(!sourceKeys.has(contract.source_key) && !operatorKeys.has(operator_key),
      'source_or_operator_duplicate');
    sourceKeys.add(contract.source_key);
    operatorKeys.add(operator_key);
    requireValue(contract.market === 'KE' && BEHAVIORS.has(contract.behavior) &&
      ['rank','rank_and_count'].includes(contract.native_metric),
      'source_measurement_invalid');
    requireValue(attempt.status === 'succeeded' && SHA.test(attempt.payload_sha256) &&
      Number.isInteger(contract.expected_depth) && contract.expected_depth >= 1 &&
      contract.expected_depth <= 200 &&
      attempt.observed_depth === contract.expected_depth &&
      attempt.record_count === rows.length && rows.length === contract.expected_depth,
      'receipt_depth_incomplete');
    requireValue(attempt.native_period_authority === 'provider_defined' &&
      validTime(attempt.native_period_start) && validTime(attempt.native_period_end) &&
      Date.parse(attempt.native_period_start) < Date.parse(attempt.native_period_end) &&
      typeof attempt.native_period_evidence_ref === 'string' &&
      KEY.test(attempt.native_period_evidence_ref), 'native_period_invalid');
    const ranks = new Set(), recordings = new Set(), entries = [];
    for (const row of rows) {
      requireValue(isObject(row) && UUID.test(row.id) && row.attempt_id === attempt.id &&
        Number.isInteger(row.source_rank) && row.source_rank >= 1 &&
        row.source_rank <= contract.expected_depth && !ranks.has(row.source_rank),
        'rank_invalid');
      requireValue(!usedRows.has(row.id), 'capture_row_reused');
      ranks.add(row.source_rank); usedRows.add(row.id);
      // An unlinked observation is its own recording *candidate*, never an
      // implicit vote for another source's similarly titled recording.
      const canonical_id = mapped.get(row.id) ?? null;
      const recording_id = canonical_id ??
        `wk100:obs:v1:${attempt.payload_sha256}:${row.id.toLowerCase()}`;
      requireValue(!recordings.has(recording_id), 'recording_duplicate_within_source');
      recordings.add(recording_id);
      entries.push({recording_id, rank: row.source_rank});
      provenance.push({source_key:contract.source_key,operator_key,attempt_id:attempt.id,
        capture_row_id:row.id,recording_id:canonical_id,
        provisional_ref:canonical_id ? null : recording_id,
        identity_state:canonical_id ? 'canonical' : 'provisional',
        title_observed:typeof row.title_observed==='string' ? row.title_observed : null,
        artist_observed:typeof row.artist_observed==='string' ? row.artist_observed : null,
        source_rank:row.source_rank});
    }
    entries.sort((a,b)=>a.rank-b.rank);
    requireValue(entries.every((row,i)=>row.rank === i+1), 'rank_not_contiguous');
    previewSources.push({
      source_key:contract.source_key, operator_key, behavior:contract.behavior,
      market:'KE', expected_depth:contract.expected_depth,
      native_period:{starts_at:utcTime(attempt.native_period_start),
        ends_at:utcTime(attempt.native_period_end),evidence_ref:attempt.native_period_evidence_ref},
      authority_ref, admission:dataset_mode === 'synthetic' ? 'synthetic' : 'approved',
      raw_sha256:attempt.payload_sha256, entries,
    });
  }
  for (const id of mapped.keys()) requireValue(usedRows.has(id), 'orphan_resolution');
  previewSources.sort((a,b)=>a.source_key.localeCompare(b.source_key));
  provenance.sort((a,b)=>a.source_key.localeCompare(b.source_key) || a.source_rank-b.source_rank);
  return Object.freeze({
    input:{schema_version:'wk100-private-preview-v1',week_start_eat,dataset_mode,
      method, sources:previewSources},
    provenance, can_publish:false,
  });
}
