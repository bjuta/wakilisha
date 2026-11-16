/**
 * WK100 W4: read-only, exact-evidence recording review projection.
 *
 * This is a chart-side inspector, not an identity resolution authority.
 * Only confirmed provider links to active Registry Tracks count as resolved.
 * No title/artist similarity, inferred provider ID, Registry mutation, ranking,
 * or publication occurs here. The operator chooses an exact immutable receipt.
 */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA=/^[a-f0-9]{64}$/;
const fail=code=>{throw new Error('wk100_identify_'+code);};
const check=(ok,code)=>{if(!ok)fail(code);};
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const text=x=>typeof x==='string'&&x.length>0?x:null;

// Convert the five fixed WK100 capture families to the existing Registry's
// provider-neutral identity vocabulary. W8 imports this same exact mapping.
// Unknown providers fail closed; this does not infer a recording match.
const WK100_REGISTRY_PROVIDERS=Object.freeze({
  apple_ke:'apple_music',audiomack_ke:'audiomack',mdundo_ke:'mdundo',
  shazam_ke:'shazam',youtube_ke:'youtube',
});
export function wk100RegistryProviderKey(providerKey){
  if(!Object.prototype.hasOwnProperty.call(WK100_REGISTRY_PROVIDERS,providerKey))
    fail('provider_unsupported');
  return WK100_REGISTRY_PROVIDERS[providerKey];
}

/**
 * A chart-scoped observation reference, never a Registry Track identity.
 *
 * The caller must first independently verify the native original bytes and
 * the exact immutable receipt/row binding. Provider-native IDs are opaque:
 * case, punctuation and leading zeros are part of provider identity.
 *
 * Same provider + same native ID can retain one chart identity across the
 * provider's daily panels. Different providers are NEVER joined by a title,
 * Artist name or this helper. A missing native ID remains one receipt-local
 * observation and cannot claim repeat/cross-provider corroboration.
 *
 * This produces no canonical UUID and grants no scoring/publication rights.
 */
export async function wk100ChartScopedObservationRef({
  providerKey, providerTrackId, receiptSha256, captureRowId,
}){
  const provider=wk100RegistryProviderKey(providerKey);
  check(typeof receiptSha256==='string'&&SHA.test(receiptSha256)&&
    typeof captureRowId==='string'&&UUID.test(captureRowId),
    'chart_observation_receipt_invalid');
  if(providerTrackId===null){
    return 'wk100:obs:v1:'+receiptSha256+':'+captureRowId.toLowerCase();
  }
  check(typeof providerTrackId==='string'&&providerTrackId.length>=1&&
    providerTrackId.length<=200&&providerTrackId===providerTrackId.trim()&&
    !/[\u0000-\u001f\u007f]/u.test(providerTrackId),
    'chart_provider_id_invalid');
  check(typeof crypto?.subtle?.digest==='function','chart_digest_unavailable');
  const payload=JSON.stringify(['wk100-chart-native-observation/v1',provider,providerTrackId]);
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',
    new TextEncoder().encode(payload)));
  const hex=Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
  return 'wk100:source:v1:'+provider+':'+hex;
}

export function projectWk100IdentifyObservations({
  weekStartEat,contract,attempt,rows,typedLinks,legacyLinks,activeTracks,
}){
  check(typeof weekStartEat==='string'&&/^\d{4}-\d\d-\d\d$/.test(weekStartEat)&&
    Number.isFinite(Date.parse(weekStartEat+'T00:00:00Z'))&&
    new Date(weekStartEat+'T00:00:00Z').toISOString().slice(0,10)===weekStartEat&&
    new Date(weekStartEat+'T00:00:00Z').getUTCDay()===1,'week_invalid');
  check(object(contract)&&UUID.test(contract.id)&&
    typeof contract.source_key==='string'&&
    /^[a-z][a-z0-9_]{2,63}$/.test(contract.source_key)&&
    typeof contract.provider_key==='string'&&
    /^[a-z][a-z0-9_]{2,63}$/.test(contract.provider_key)&&
    contract.market==='KE'&&Number.isInteger(contract.expected_depth)&&
    contract.expected_depth>=1&&contract.expected_depth<=200,'contract_invalid');
  check(object(attempt)&&UUID.test(attempt.id)&&
    attempt.contract_id===contract.id&&attempt.week_start_eat===weekStartEat&&
    ['succeeded','partial_depth'].includes(attempt.status)&&
    SHA.test(attempt.payload_sha256),'receipt_invalid');
  check(Array.isArray(rows)&&rows.length>=1&&rows.length<=200&&
    Number.isInteger(attempt.record_count)&&attempt.record_count===rows.length&&
    attempt.observed_depth===rows.length&&
    (attempt.status==='succeeded'?rows.length===contract.expected_depth:
      rows.length<contract.expected_depth),'receipt_depth_invalid');
  check(Array.isArray(typedLinks)&&typedLinks.length<=400&&
    Array.isArray(legacyLinks)&&legacyLinks.length<=400&&
    Array.isArray(activeTracks)&&activeTracks.length<=400,'links_invalid');

  const registryProvider=wk100RegistryProviderKey(contract.provider_key);
  const exact=new Map();
  const add=(providerId,trackId)=>{
    if(!text(providerId)||!UUID.test(trackId))return;
    const prior=exact.get(providerId)??new Set();
    prior.add(trackId.toLowerCase());exact.set(providerId,prior);
  };
  for(const link of typedLinks){
    if(object(link)&&link.provider_key===registryProvider&&link.match_status==='matched')
      add(link.provider_track_id,link.track_id);
  }
  for(const link of legacyLinks){
    if(object(link)&&link.provider===registryProvider&&
      link.registry_entity_type==='track'&&link.match_status==='confirmed')
      add(link.provider_entity_id,link.registry_entity_id);
  }
  const active=new Set(activeTracks.filter(x=>object(x)&&x.status==='active'&&UUID.test(x.id))
    .map(x=>x.id.toLowerCase()));
  const ids=new Set(),ranks=new Set();
  const ordered=[...rows].sort((a,b)=>a.source_rank-b.source_rank);
  const results=ordered.map((row,i)=>{
    check(object(row)&&UUID.test(row.id)&&row.attempt_id===attempt.id&&
      Number.isInteger(row.source_rank)&&row.source_rank===i+1&&
      !ranks.has(row.source_rank)&&!ids.has(row.id),'row_invalid');
    ranks.add(row.source_rank);ids.add(row.id);
    check(row.provider_track_id===null||typeof row.provider_track_id==='string','provider_id_invalid');
    check(row.title_observed===null||typeof row.title_observed==='string','title_invalid');
    check(row.artist_observed===null||typeof row.artist_observed==='string','artist_invalid');
    const providerId=text(row.provider_track_id);
    const possible=providerId?[...(exact.get(providerId)??[])]:[];
    let identityState='needs_review',reviewReason='provider_link_missing',canonicalTrackId=null;
    if(!providerId)reviewReason='provider_identity_unavailable';
    else if(possible.length>1){identityState='conflicting';reviewReason='conflicting_registry_links';}
    else if(possible.length===1){
      if(active.has(possible[0])){identityState='resolved';reviewReason=null;canonicalTrackId=possible[0];}
      else{identityState='inactive';reviewReason='linked_track_not_active';}
    }
    return {
      captureRowId:row.id,rank:row.source_rank,
      observedTitle:text(row.title_observed),observedArtist:text(row.artist_observed),
      providerTrackId:providerId,
      canonicalTrackId,identityState,reviewReason,
      provisionalRef:canonicalTrackId?null:
        'wk100:obs:v1:'+attempt.payload_sha256+':'+row.id.toLowerCase(),
    };
  });
  const totals={
    observed:results.length,resolved:results.filter(x=>x.identityState==='resolved').length,
    needsReview:results.filter(x=>x.identityState==='needs_review').length,
    conflicting:results.filter(x=>x.identityState==='conflicting').length,
    inactive:results.filter(x=>x.identityState==='inactive').length,
  };
  return {
    schemaVersion:'wk100-admin-identify-observations-v1',
    weekStartEat,contractId:contract.id,receiptId:attempt.id,
    sourceKey:contract.source_key,providerKey:contract.provider_key,
    registryProviderKey:registryProvider,
    receiptStatus:attempt.status,expectedDepth:contract.expected_depth,
    observedDepth:results.length,payloadSha256:attempt.payload_sha256,
    originalReadbackInThisRequest:false,identityStatus:'exact_provider_links_only',
    rows:results,totals,
    canWriteRegistry:false,canScore:false,canPublish:false,
  };
}
