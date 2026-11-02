/**
 * WK100 proposed source configuration, not source admission or capture authority.
 * Stateless boundary used before a versioned, audited write. It never chooses
 * an endpoint, fetches a provider, writes a capture contract or enables scoring.
 */
const PROVIDERS = new Set(['youtube_ke', 'spotify_ke', 'boomplay_ke', 'apple_ke',
  'mdundo_ke', 'shazam_ke', 'audiomack_ke']);
const METHODS = new Set(['provider_api', 'offered_export', 'reviewed_page_adapter',
  'research_only']);
const BEHAVIORS = new Set(['consumption', 'video_consumption', 'discovery',
  'ugc_curation', 'broadcast_exposure']);
const METRICS = new Set(['rank', 'rank_and_count', 'event_count']);
const CADENCES = new Set(['daily', 'interval_hours', 'weekly']);
const FIELDS = new Set(['providerKey', 'sourceKey', 'surface', 'methodClass', 'behavior',
  'metric', 'expectedDepth', 'cadence', 'intervalHours', 'eatHour', 'eatMinute',
  'weekdayEat', 'minimumHealthyCheckpoints', 'evidenceReference', 'reason']);
const fail = code => { throw new Wk100SourceProposalError(code); };
export class Wk100SourceProposalError extends Error {
  constructor(code) { super(code); this.code=code; }
}
const int = (v, low, high) => Number.isInteger(v) && v >= low && v <= high;
const plain = (v, limit) => typeof v === 'string' && v === v.trim()
  && v.length > 0 && v.length <= limit && !/[\u0000-\u001f\u007f<>]/u.test(v);
const readOptional = (v, max) => v === null || (typeof v === 'string' &&
  v === v.trim() && v.length <= max && !/[\u0000-\u001f\u007f<>]/u.test(v));

/**
 * Strict input shape. No actor, approval, admission, credentials, endpoint,
 * parser digest, flags or publisher fields can be supplied by the browser.
 * A later authorized server command owns identity, revision and auditing.
 */
export function validateWk100SourceProposal(input) {
  if(!input || typeof input !== 'object' || Array.isArray(input) ||
     Object.getPrototypeOf(input)!==Object.prototype) fail('proposal_invalid');
  if(Object.keys(input).some(field=>!FIELDS.has(field)) ||
     Object.keys(input).length !== FIELDS.size) fail('proposal_fields_invalid');
  if(!PROVIDERS.has(input.providerKey)) fail('provider_unsupported');
  // Stable provider-scoped source identity; not the provider itself or its label.
  // Enables multiple independently governed surfaces under one platform.
  if(typeof input.sourceKey!=='string' || input.sourceKey.length>64 ||
     !new RegExp('^'+input.providerKey+'_[a-z][a-z0-9_]{1,45}$').test(input.sourceKey))
    fail('source_key_invalid');
  if(!plain(input.surface, 180) || input.surface.length < 3) fail('surface_invalid');
  if(!METHODS.has(input.methodClass)) fail('method_invalid');
  if(!BEHAVIORS.has(input.behavior) || !METRICS.has(input.metric))
    fail('measurement_invalid');
  if(input.behavior==='video_consumption' && input.metric==='event_count')
    fail('measurement_invalid');
  if(!int(input.expectedDepth,1,500)) fail('depth_invalid');
  if(!CADENCES.has(input.cadence) || !int(input.eatHour,0,23) ||
     !int(input.eatMinute,0,59)) fail('cadence_invalid');
  if(input.cadence==='weekly') {
    if(input.intervalHours!==null || !int(input.weekdayEat,0,6) ||
       input.minimumHealthyCheckpoints!==1) fail('cadence_invalid');
  } else if(input.cadence==='daily') {
    if(input.intervalHours!==null || input.weekdayEat!==null ||
       !int(input.minimumHealthyCheckpoints,1,7)) fail('cadence_invalid');
  } else {
    if(![3,4,6,8,12,24].includes(input.intervalHours) ||
       input.weekdayEat!==null || !int(input.minimumHealthyCheckpoints,1,
         168/input.intervalHours)) fail('cadence_invalid');
  }
  if(!plain(input.evidenceReference,240) || /(?:\?|&|#|=|\/\/|@)/u.test(input.evidenceReference))
    fail('evidence_reference_invalid');
  if(!readOptional(input.reason,500)) fail('reason_invalid');
  return Object.freeze({
    schemaVersion:'wk100-source-proposal-v1',providerKey:input.providerKey,sourceKey:input.sourceKey,
    surface:input.surface,methodClass:input.methodClass,
    behavior:input.behavior,metric:input.metric,
    expectedDepth:input.expectedDepth,cadence:input.cadence,
    intervalHours:input.intervalHours,eatHour:input.eatHour,
    eatMinute:input.eatMinute,weekdayEat:input.weekdayEat,
    minimumHealthyCheckpoints:input.minimumHealthyCheckpoints,
    evidenceReference:input.evidenceReference,reason:input.reason,
    market:'KE',state:'proposed',
    canCollect:false,canScore:false,canPublish:false,
  });
}
