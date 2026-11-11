/**
 * WK100 server-only, private evidence -> fixed ranking primitive bridge.
 *
 * This is not an Edge route, publication service, or source admission command.
 * The invoking restricted server must supply its authenticated service-owned
 * exact-receipt reader, private Storage-byte reader and currently authorized
 * W5 policy/Registry evaluator. No client-provided rankings or Registry IDs.
 * The bridge does not infer missing identities or claim every source is ready.
 */
import {computeWk100PrivateRankingCandidate,
  WK100_RANKING_SPECIFICATION_V1 as SPEC} from './wk100-ranking-primitive.mjs';
import {projectWk100IdentifyObservations} from './wk100-identify-observations.mjs';
import {parseCaptureNativeRows} from './chart-capture-runtime.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA=/^[a-f0-9]{64}$/;
const RAW=/^v1\/\d{4}-\d{2}-\d{2}\/[a-z][a-z0-9_-]{1,63}\/\d{8}T\d{6}Z-[1-8]\/[a-f0-9]{64}\.(?:html|csv|json|bin)$/;
const MAX_BYTES=4_194_304;
const fail=code=>{throw new Error('wk100_rank_evidence_'+code);};
const need=(v,code)=>{if(!v)fail(code);};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const unique=xs=>new Set(xs).size===xs.length;
const order=(a,b)=>a<b?-1:a>b?1:0;
const canonicalUtc=value=>{
  need(typeof value==='string'&&Number.isFinite(Date.parse(value))&&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value),
    'time_invalid');
  return new Date(value).toISOString().replace(/\.000Z$/,'Z');
};
async function hashBytes(data){
  const result=new Uint8Array(await crypto.subtle.digest('SHA-256',data));
  return Array.from(result,x=>x.toString(16).padStart(2,'0')).join('');
}
const encode=x=>new TextEncoder().encode(JSON.stringify(x));
const sum=x=>hashBytes(encode(x));
const requiredSources=Object.freeze({apple_ke:7,shazam_ke:1,mdundo_ke:1,
  youtube_ke:1,audiomack_ke:1});
const numberFromSqlBigint=x=>{
  if(Number.isSafeInteger(x)&&x>=0)return x;
  if(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x)&&
    Number.isSafeInteger(Number(x)))return Number(x);
  return null;
};
const nativeValue=(row,family)=>family==='youtube_ke'?
  (Object.hasOwn(row,'view_count')?numberFromSqlBigint(row.view_count):null):null;

/**
 * Run only inside a separately authenticated, restricted service boundary.
 * loadCapture(id) MUST load immutable attempt + contract + all stored rows from
 * the exact ID, not browser-submitted records. readPrivateBytes(attempt) MUST
 * use the existing private bucket. loadRegistry(...) MUST read live Registry
 * links and active tracks. evaluateW5Row(...) MUST re-evaluate the current
 * saved eligibility policy and return the original registry-facts SHA.
 * The default parser is the established exact native collection parser.
 * The parser override exists for isolated synthetic tests, never user input.
 *
 * This function does not authorize source access, admission, or publication.
 */
export async function prepareWk100AttestedPrivateRanking({
  weekStartEat,selectedReceiptIds,eligibilityPolicySha256,
  loadCapture,readPrivateBytes,loadRegistry,evaluateW5Row,
  parseNativeRows=parseCaptureNativeRows,
}){
  need(typeof weekStartEat==='string'&&/^\d{4}-\d\d-\d\d$/.test(weekStartEat),
    'week_invalid');
  const monday=Date.parse(weekStartEat+'T00:00:00Z');
  need(Number.isFinite(monday)&&new Date(monday).toISOString().slice(0,10)===weekStartEat&&
    new Date(monday).getUTCDay()===1,'week_invalid');
  need(typeof eligibilityPolicySha256==='string'&&SHA.test(eligibilityPolicySha256),
    'policy_sha_invalid');
  need(Array.isArray(selectedReceiptIds)&&selectedReceiptIds.length===11&&
    selectedReceiptIds.every(x=>typeof x==='string'&&UUID.test(x))&&
    unique(selectedReceiptIds),'selection_invalid');
  need([loadCapture,readPrivateBytes,loadRegistry,evaluateW5Row,parseNativeRows]
    .every(x=>typeof x==='function'),'restricted_server_dependencies_missing');
  const snapshots=[],attestationFacts=[],familySourceKeys=new Map();
  const seenFamilies=new Map(SPEC.families.map(f=>[f,0]));
  const allCaptureRows=new Set();
  for(const receiptId of selectedReceiptIds){
    const loaded=await loadCapture(receiptId);
    need(object(loaded)&&object(loaded.contract)&&object(loaded.attempt)&&
      Array.isArray(loaded.rows),'receipt_read_invalid');
    const {contract,attempt,rows}=loaded;
    const family=contract.provider_key;
    need(SPEC.families.includes(family)&&contract.market==='KE'&&
      contract.native_metric===SPEC.nativeMetrics[family]&&
      typeof contract.source_key==='string'&&/^[a-z][a-z0-9_]{2,63}$/.test(contract.source_key)&&
      typeof contract.adapter_version==='string'&&contract.adapter_version.length>0,
      'capture_contract_invalid');
    // Candidate in the existing SQL means a collected original, never a
    // publication-qualifying source. The real source-admission gate is W8.
    need(contract.admission_state==='candidate'&&
      attempt.id===receiptId&&attempt.contract_id===contract.id&&
      attempt.week_start_eat===weekStartEat&&attempt.status==='succeeded'&&
      attempt.observed_market==='KE'&&
      Number.isInteger(contract.expected_depth)&&contract.expected_depth>=100&&
      contract.expected_depth<=200&&rows.length===contract.expected_depth&&
      attempt.record_count===rows.length&&attempt.observed_depth===rows.length&&
      typeof attempt.payload_sha256==='string'&&SHA.test(attempt.payload_sha256)&&
      typeof attempt.raw_object_key==='string'&&RAW.test(attempt.raw_object_key)&&
      attempt.raw_object_key.startsWith('v1/'+weekStartEat+'/'+contract.source_key+'/')&&
      attempt.raw_object_key.includes('/'+attempt.payload_sha256+'.'),
      'receipt_incomplete_or_unbound');
    need(!familySourceKeys.has(family)||familySourceKeys.get(family)===contract.source_key,
      'family_source_changed');
    familySourceKeys.set(family,contract.source_key);
    seenFamilies.set(family,seenFamilies.get(family)+1);
    const bytes=await readPrivateBytes(attempt);
    need(bytes instanceof Uint8Array&&bytes.byteLength>0&&bytes.byteLength<=MAX_BYTES,
      'private_original_unavailable');
    need(await hashBytes(bytes)===attempt.payload_sha256,'original_digest_mismatch');
    let native;
    try {native=await parseNativeRows(bytes,contract,loaded.parserAccess??{});}
    catch {fail('native_replay_invalid');}
    need(Array.isArray(native)&&native.length===rows.length,'native_row_count_mismatch');
    const ordered=[...rows].sort((a,b)=>a.source_rank-b.source_rank);
    const seen=new Set();
    for(let i=0;i<ordered.length;i++){
      const row=ordered[i],parsed=native[i];
      need(object(row)&&UUID.test(row.id)&&row.attempt_id===receiptId&&
        row.source_rank===i+1&&!allCaptureRows.has(row.id)&&!seen.has(row.id),
        'capture_rows_invalid');
      seen.add(row.id);allCaptureRows.add(row.id);
      need(object(parsed)&&parsed.rank===i+1&&
        (parsed.provider_track_id??null)===(row.provider_track_id??null)&&
        (parsed.title??null)===(row.title_observed??null)&&
        (parsed.artist??null)===(row.artist_observed??null)&&
        (family==='youtube_ke'?nativeValue(parsed,family)===
          numberFromSqlBigint(row.source_native_count):row.source_native_count===null),
        'native_original_does_not_match_database');
      if(family==='youtube_ke')need(nativeValue(parsed,family)!==null&&
        numberFromSqlBigint(row.source_native_count)!==null&&
        nativeValue(parsed,family)===numberFromSqlBigint(row.source_native_count),
        'youtube_native_count_invalid');
    }
    const evidence=await loadRegistry({contract,attempt,rows:ordered});
    need(object(evidence)&&Array.isArray(evidence.typedLinks)&&
      Array.isArray(evidence.legacyLinks)&&Array.isArray(evidence.activeTracks),
      'registry_read_invalid');
    let identified;
    try{identified=projectWk100IdentifyObservations({weekStartEat,contract,attempt,
      rows:ordered,typedLinks:evidence.typedLinks,
      legacyLinks:evidence.legacyLinks,activeTracks:evidence.activeTracks});}
    catch{fail('registry_link_replay_invalid');}
    need(identified.rows.length===ordered.length&&identified.totals.resolved===ordered.length&&
      identified.totals.conflicting===0&&identified.totals.inactive===0&&
      identified.totals.needsReview===0,'registry_identity_unresolved');
    const rankingRows=[];
    for(let i=0;i<identified.rows.length;i++){
      const row=identified.rows[i];
      const verdict=await evaluateW5Row({weekStartEat,contract,attempt,
        captureRow:ordered[i],canonicalTrackId:row.canonicalTrackId,
        policySha256:eligibilityPolicySha256});
      need(object(verdict)&&verdict.outcome==='ELIGIBLE'&&
        verdict.policySha256===eligibilityPolicySha256&&
        typeof verdict.registryFactsSha256==='string'&&
        SHA.test(verdict.registryFactsSha256),'eligibility_or_registry_facts_unverified');
      rankingRows.push({recordingId:row.canonicalTrackId,rank:row.rank,
        ...(family==='youtube_ke'?
          {nativeCount:numberFromSqlBigint(ordered[i].source_native_count)}:{})});
      attestationFacts.push([family,receiptId,ordered[i].id,
        row.canonicalTrackId,verdict.registryFactsSha256]);
    }
    const period=attempt.native_period_authority;
    if(period==='provider_defined')need(
      typeof attempt.native_period_evidence_ref==='string'&&
      attempt.native_period_evidence_ref.length>0,'native_period_evidence_missing');
    if(family==='youtube_ke')need(typeof attempt.native_period_evidence_ref==='string'&&
      attempt.native_period_evidence_ref.length>0&&
      loaded.parserAccess?.native_period_key===attempt.native_period_evidence_ref,
      'youtube_period_original_unbound');
    const present=period==='provider_defined'&&
      attempt.native_period_start!=null&&attempt.native_period_end!=null;
    const observed=canonicalUtc(attempt.fetched_at);
    const snapshot={family,sourceKey:contract.source_key,
      captureReceiptId:receiptId,captureReceiptSha256:attempt.payload_sha256,
      market:'KE',nativeMetric:contract.native_metric,
      observedAtUtc:observed,
      nativePeriodAuthority:present?'provider_defined':
        (period==='observed_as_of'?'observed_as_of':period),
      nativePeriodStartUtc:present?canonicalUtc(attempt.native_period_start):null,
      nativePeriodEndUtc:present?canonicalUtc(attempt.native_period_end):null,
      providerPeriodStartDate:null,providerPeriodEndDate:null,
      declaredDepth:contract.expected_depth,rows:rankingRows};
    if(!present&&period!=='observed_as_of')fail('native_period_not_qualified');
    if(period==='observed_as_of'&&
      (attempt.native_period_start!=null||attempt.native_period_end!=null))
      fail('native_period_contradiction');
    snapshots.push(snapshot);
  }
  need(SPEC.families.every(f=>seenFamilies.get(f)===requiredSources[f]),
    'fixed_family_checkpoints_missing');
  attestationFacts.sort((a,b)=>order(JSON.stringify(a),JSON.stringify(b)));
  const registrySnapshotSha256=await sum(attestationFacts);
  const candidate=await computeWk100PrivateRankingCandidate({weekStartEat,
    eligibilityPolicySha256,registrySnapshotSha256,snapshots});
  need(candidate.canPublish===false&&candidate.canStage===false&&
    candidate.sourcePanelCount===11,'rank_preview_authority_invalid');
  return Object.freeze({schemaVersion:'wk100-attested-private-ranking-handoff/v1',
    weekStartEat,sourceReceiptCount:11,registrySnapshotSha256,
    policySha256:eligibilityPolicySha256,
    rankingDigest:candidate.rankingDigest,privateRanking:candidate,
    // This does not prove hosted admission or authorize W8 staging.
    status:'private_research_handoff',canStage:false,canPublish:false});
}
