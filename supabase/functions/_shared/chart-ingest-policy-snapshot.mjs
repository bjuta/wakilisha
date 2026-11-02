/**
 * WAKILISHA Chart Ingest: immutable run-level filter policy v1.
 *
 * This module validates the complete *submitted* profile, freezes an immutable
 * value snapshot in the run's rule_snapshot_json, and checks its digest. It is
 * deliberately NOT an eligibility evaluator, a Registry writer, or source
 * qualification. Caller authorization must already be checked by the API.
 *
 * INTEGRATION HOLD: this module is not independently deployable until the
 * Phase-2 server evaluator enforces every accepted active predicate.
 */

export const CHART_INGEST_SNAPSHOT_CONTRACT = 'chart-ingest-full-filter-snapshot/v1';
export const CHART_INGEST_EVALUATOR_STATE = 'PENDING_FULL_FILTER_EVALUATOR';

export class ChartIngestPolicyError extends Error {
  constructor(code, detail) {
    super(`${code}: ${detail}`);
    this.name = 'ChartIngestPolicyError';
    this.code = code;
  }
}

function fail(code, detail) {
  throw new ChartIngestPolicyError(code, detail);
}

function object(value, key) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('invalid_policy_object', `${key} must be a JSON object`);
  }
  return value;
}

function keys(value, permitted, key) {
  for (const item of Object.keys(value)) {
    if (!permitted.includes(item)) fail('unsupported_policy_key', `${key}.${item}`);
  }
}

function string(value, key) {
  if (typeof value !== 'string' || !value.trim()) fail('invalid_policy_string', key);
  return value.trim();
}

function optionalString(value, key) {
  if (value == null) return;
  string(value, key);
}

function flag(value, key) {
  if (typeof value !== 'boolean') fail('invalid_policy_boolean', key);
}

function optionalFlag(value, key) {
  if (value != null) flag(value, key);
}

function enumeration(value, allowed, key) {
  if (!allowed.includes(value)) fail('unsupported_policy_value', `${key}:${String(value)}`);
}

function list(value, key, {max = 100, check = null} = {}) {
  if (!Array.isArray(value) || value.length > max) fail('invalid_policy_list', key);
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) fail('invalid_policy_list_item', key);
    if (check) check(item, key);
  }
  if (new Set(value.map(x => x.trim().toUpperCase())).size !== value.length) fail('duplicate_policy_list_entry', key);
}

function iso2(value, key) {
  if (!/^[A-Z]{2}$/.test(value)) fail('invalid_iso2', `${key}:${String(value)}`);
}

function intBound(value, key, min = 0, max = 1000000) {
  if (!Number.isInteger(value) || value < min || value > max) fail('invalid_policy_integer', key);
}

function date(value, key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('invalid_policy_date', key);
  const [year, month, day] = value.split('-').map(Number);
  const time = Date.UTC(year, month - 1, day);
  if (new Date(time).toISOString().slice(0, 10) !== value) fail('invalid_policy_date', key);
}

function validateProfile(profile, selectedId) {
  object(profile, 'eligibilityProfileSnapshot');
  keys(profile, ['id','name','slug','description','visibility','publicLabel','internalNotes','artistOriginEligibility','artistGenderEligibility','artistTypeEligibility','releaseEligibility','trackEligibility','collaborationRules','sourceRules','reviewRules','createdAt','updatedAt'], 'profile');
  const id = string(profile.id, 'profile.id');
  if (id !== selectedId && profile.slug !== selectedId) fail('policy_profile_mismatch', `${selectedId}!=${id}`);
  string(profile.name, 'profile.name');
  string(profile.slug, 'profile.slug');
  optionalString(profile.description, 'profile.description');
  if (profile.visibility != null) enumeration(profile.visibility, ['public','admin_only'], 'profile.visibility');
  for (const k of ['publicLabel','internalNotes','createdAt','updatedAt']) optionalString(profile[k], `profile.${k}`);

  const origin = object(profile.artistOriginEligibility, 'profile.artistOriginEligibility');
  keys(origin, ['mode','countries','regions','cities','diasporaMarkets'], 'origin');
  enumeration(origin.mode, ['any','country_only','multi_country','region_only','diaspora_only','custom'], 'origin.mode');
  list(origin.countries, 'origin.countries', {check: iso2});
  list(origin.regions, 'origin.regions');
  if (origin.cities != null) list(origin.cities, 'origin.cities');
  if (origin.diasporaMarkets != null) list(origin.diasporaMarkets, 'origin.diasporaMarkets');
  if (['country_only','multi_country'].includes(origin.mode) && origin.countries.length === 0) fail('missing_origin_countries', 'country selection is required');
  if (origin.mode === 'country_only' && origin.countries.length !== 1) fail('country_only_requires_one_iso2', 'origin.countries');
  if (origin.mode === 'region_only' && origin.regions.length === 0) fail('missing_origin_regions', 'region selection is required');
  if (origin.mode === 'diaspora_only' && !(origin.diasporaMarkets?.length)) fail('missing_diaspora_markets', 'diaspora selection is required');

  const gender = object(profile.artistGenderEligibility, 'profile.artistGenderEligibility');
  keys(gender, ['mode','publicLabel','internalNotes'], 'gender');
  enumeration(gender.mode, ['any','female_only','male_only','mixed_gender_only','non_binary_inclusive','custom'], 'gender.mode');
  optionalString(gender.publicLabel, 'gender.publicLabel');
  optionalString(gender.internalNotes, 'gender.internalNotes');

  const artistType = object(profile.artistTypeEligibility, 'profile.artistTypeEligibility');
  keys(artistType, ['mode'], 'artistType');
  enumeration(artistType.mode, ['any','solo_artists_only','groups_collectives_only','bands_only','duos_only','labels_only','custom'], 'artistType.mode');

  const release = object(profile.releaseEligibility, 'profile.releaseEligibility');
  keys(release, ['releaseTypes','releaseWindowFrom','releaseWindowTo','includeReissues','includeRemixes','includeAcousticVersions','includeInstrumentals'], 'release');
  list(release.releaseTypes, 'release.releaseTypes');
  if (release.releaseTypes.length === 0) fail('empty_release_types', 'release.releaseTypes');
  for (const type of release.releaseTypes) enumeration(type, ['single','ep','album','mixtape','compilation','video','live'], 'release.releaseTypes');
  for (const field of ['releaseWindowFrom','releaseWindowTo']) {
    if (release[field] != null) date(release[field], `release.${field}`);
  }
  if (release.releaseWindowFrom && release.releaseWindowTo && release.releaseWindowFrom > release.releaseWindowTo) fail('reversed_release_window', 'release dates');
  for (const field of ['includeReissues','includeRemixes','includeAcousticVersions','includeInstrumentals']) flag(release[field], `release.${field}`);

  const track = object(profile.trackEligibility, 'profile.trackEligibility');
  keys(track, ['explicitAllowed','minDurationMs','maxDurationMs','requireIsrc','requirePreview','allowedLanguages','allowedGenres','excludedGenres'], 'track');
  for (const field of ['explicitAllowed','requireIsrc','requirePreview']) flag(track[field], `track.${field}`);
  for (const field of ['minDurationMs','maxDurationMs']) if (track[field] != null) intBound(track[field], `track.${field}`, 1, 86400000);
  if (track.minDurationMs != null && track.maxDurationMs != null && track.minDurationMs > track.maxDurationMs) fail('reversed_duration_bounds', 'track duration');
  for (const field of ['allowedLanguages','allowedGenres','excludedGenres']) if (track[field] != null) list(track[field], `track.${field}`);
  const allowedGenres = new Set((track.allowedGenres || []).map(x => x.toLowerCase()));
  for (const g of track.excludedGenres || []) if (allowedGenres.has(g.toLowerCase())) fail('contradictory_genre_rules', g);

  const collaboration = object(profile.collaborationRules, 'profile.collaborationRules');
  keys(collaboration, ['allowFeaturedArtists','countFeaturedArtistNationality','primaryArtistMustMatchEligibility','allArtistsMustMatchEligibility','minEligibleArtistsRequired'], 'collaboration');
  for (const field of ['allowFeaturedArtists','countFeaturedArtistNationality','primaryArtistMustMatchEligibility','allArtistsMustMatchEligibility']) flag(collaboration[field], `collaboration.${field}`);
  if (collaboration.minEligibleArtistsRequired != null) intBound(collaboration.minEligibleArtistsRequired, 'collaboration.minEligibleArtistsRequired', 1, 100);

  const source = object(profile.sourceRules, 'profile.sourceRules');
  keys(source, ['allowedProviders','requireAtLeastOneProviderId','requireProviderAvailabilityInMarket'], 'source');
  list(source.allowedProviders, 'source.allowedProviders');
  for (const provider of source.allowedProviders) {
    enumeration(provider, ['spotify','apple_music','youtube','airplay','manual','registry','shazam','mdundo','audiomack','boomplay'], 'source.allowedProviders');
  }
  for (const field of ['requireAtLeastOneProviderId','requireProviderAvailabilityInMarket']) flag(source[field], `source.${field}`);

  const review = object(profile.reviewRules, 'profile.reviewRules');
  keys(review, ['requireManualReviewForUnknownGender','requireManualReviewForUnknownNationality','requireManualReviewForUnknownArtistType','requireManualReviewForGroups','allowUnknownMetadataWithWarning'], 'review');
  for (const field of ['requireManualReviewForUnknownGender','requireManualReviewForUnknownNationality','requireManualReviewForUnknownArtistType','requireManualReviewForGroups','allowUnknownMetadataWithWarning']) flag(review[field], `review.${field}`);
}

function validateMarket(scope, marketId) {
  object(scope, 'marketScopeSnapshot');
  keys(scope, ['id','name','slug','description','visibility','primaryMarketSlug','includedMarkets','aggregationMode','artistOriginCountries','artistOriginUnknownMode'], 'marketScope');
  if (string(scope.id, 'marketScope.id') !== marketId && scope.slug !== marketId) fail('policy_market_mismatch', marketId);
  string(scope.slug, 'marketScope.slug');
  string(scope.primaryMarketSlug, 'marketScope.primaryMarketSlug');
  if (scope.visibility != null) enumeration(scope.visibility, ['public','admin_only'], 'marketScope.visibility');
  enumeration(scope.aggregationMode, ['combined','separate_then_combined','weighted','minimum_presence','editorial'], 'marketScope.aggregationMode');
  if (!Array.isArray(scope.includedMarkets) || scope.includedMarkets.length === 0 || scope.includedMarkets.length > 100) fail('invalid_included_markets', 'marketScope.includedMarkets');
  for (const m of scope.includedMarkets) {
    object(m, 'marketScope.includedMarket');
    keys(m, ['marketSlug','countryCode','weight'], 'marketScope.includedMarket');
    string(m.marketSlug, 'marketScope.includedMarket.marketSlug');
    iso2(m.countryCode, 'marketScope.includedMarket.countryCode');
    if (m.weight != null && (typeof m.weight !== 'number' || !Number.isFinite(m.weight) || m.weight < 0 || m.weight > 1)) fail('invalid_market_weight', 'marketScope.includedMarket.weight');
  }
  list(scope.artistOriginCountries, 'marketScope.artistOriginCountries', {check: iso2});
  enumeration(scope.artistOriginUnknownMode, ['exclude','warn','include'], 'marketScope.artistOriginUnknownMode');
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
}

function jsonCopy(value) {
  try {
    const copy = JSON.parse(JSON.stringify(value));
    if (copy == null) fail('invalid_json_value', 'snapshot must not be null');
    return copy;
  } catch {
    fail('invalid_json_value', 'snapshot must be serializable JSON');
  }
}

/**
 * Freeze the entire Admin-submitted configuration. The calling API must have
 * authenticated the manage_ingest principal. A validated snapshot is NOT
 * permission to score: evaluatorState explicitly remains held.
 */
export async function createIngestPolicySnapshot(request, actorId, frozenAt) {
  object(request, 'request');
  const profileId = string(request.eligibilityProfileId, 'eligibilityProfileId');
  const marketId = string(request.marketScopeId, 'marketScopeId');
  const actor = string(actorId, 'actorId');
  const frozen = string(frozenAt, 'frozenAt');
  if (!Number.isFinite(Date.parse(frozen)) || !frozen.endsWith('Z')) fail('invalid_frozen_timestamp', 'frozenAt');

  const profile = jsonCopy(request.eligibilityProfileSnapshot);
  const scope = jsonCopy(request.marketScopeSnapshot);
  validateProfile(profile, profileId);
  validateMarket(scope, marketId);

  // Explicit release-window request values may not override the selected profile.
  const from = profile.releaseEligibility.releaseWindowFrom || null;
  const to = profile.releaseEligibility.releaseWindowTo || null;
  if (request.releaseWindowStart != null && request.releaseWindowStart !== from) fail('release_window_snapshot_mismatch', 'releaseWindowStart');
  if (request.releaseWindowEnd != null && request.releaseWindowEnd !== to) fail('release_window_snapshot_mismatch', 'releaseWindowEnd');

  const value = {
    contractVersion: CHART_INGEST_SNAPSHOT_CONTRACT,
    evaluatorState: CHART_INGEST_EVALUATOR_STATE,
    profileId,
    marketScopeId: marketId,
    createdBy: actor,
    frozenAt: frozen,
    eligibilityProfileSnapshot: profile,
    marketScopeSnapshot: scope,
    releaseWindowStart: from,
    releaseWindowEnd: to,
  };
  return {...value, sha256: await sha256(stable(value))};
}

/** Detect unexpected mutation of this run's frozen policy. A digest is not a signature. */
export async function verifyIngestPolicySnapshot(snapshot) {
  try {
    object(snapshot, 'rule_snapshot_json');
    const {sha256: declaredDigest, ...value} = snapshot;
    if (typeof declaredDigest !== 'string' || !/^[a-f0-9]{64}$/.test(declaredDigest)) fail('missing_rule_digest', 'sha256');
    if (value.contractVersion !== CHART_INGEST_SNAPSHOT_CONTRACT) fail('unknown_rule_contract', 'contractVersion');
    if (value.evaluatorState !== CHART_INGEST_EVALUATOR_STATE) fail('rule_evaluator_state_mismatch', 'evaluatorState');
    const actualDigest = await sha256(stable(value));
    if (actualDigest !== declaredDigest) fail('modified_rule_snapshot', 'sha256');
    validateProfile(value.eligibilityProfileSnapshot, value.profileId);
    validateMarket(value.marketScopeSnapshot, value.marketScopeId);
    if ((value.releaseWindowStart || null) !== (value.eligibilityProfileSnapshot.releaseEligibility.releaseWindowFrom || null) || (value.releaseWindowEnd || null) !== (value.eligibilityProfileSnapshot.releaseEligibility.releaseWindowTo || null)) fail('rule_window_mismatch', 'releaseWindow');
    return {ok: true, code: 'snapshot_verified', snapshot: value};
  } catch (error) {
    return {ok: false, code: error instanceof ChartIngestPolicyError ? error.code : 'invalid_rule_snapshot'};
  }
}

/** Phase 2 must replace this hold with complete rule evaluation before deployment. */
export async function assertIngestEvaluatorReady(snapshot) {
  const check = await verifyIngestPolicySnapshot(snapshot);
  if (!check.ok) return check;
  return {ok: false, code: 'full_filter_evaluator_pending', detail: 'A frozen policy is not the same as an executed policy.'};
}
