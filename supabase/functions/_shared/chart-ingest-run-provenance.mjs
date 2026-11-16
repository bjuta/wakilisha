/**
 * WAKILISHA Chart Ingest — production-shaped read-only evidence association.
 * NONDEPLOYABLE until source-native week, Registry lineage, full metadata,
 * same-page review and DB stage acceptance are proven.
 *
 * The accepted normalizer stores candidate.provider_ids_json and raw rows
 * separately; raw rows have NO persisted candidate_id. This module must
 * never pretend otherwise. Association uses an exact, unique provider key
 * plus provider_track_id claim within ONE run; never title/artist text.
 */
import {evaluateRegistryChartCandidate} from './chart-ingest-registry-facts.mjs';
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const uuid=x=>typeof x==='string'&&/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(x);
const val=x=>typeof x==='string'&&x.trim()?x.trim():null;
// Mirror the accepted shared provider-identity alias table. Provider spelling
// and track IDs have different normalization contracts; never conflate them.
const PROVIDER_ALIASES={applemusic:'apple_music',youtube_music:'youtube',youtubemusic:'youtube',yt_music:'youtube',amazonmusic:'amazon_music',tiktok_music:'tiktok'};
const pkey=x=>{const k=val(x)?.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'')||null;return k ? (PROVIDER_ALIASES[k]||k) : null;};
// Mirror the accepted chart-ingest-api addProviderIdToBag() primitive.
// Candidate IDs are already stored in compact form, while raw IDs are not.
const compactId=x=>val(x)?.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')||null;
const key=(p,id)=>pkey(p)&&compactId(id)?JSON.stringify([pkey(p),compactId(id)]):null;
const uniq=x=>[...new Set(x)];
const sortEvents=x=>x.sort((a,b)=>`${a.code}:${a.candidateId??''}:${a.rawRowId??''}`.localeCompare(`${b.code}:${b.candidateId??''}:${b.rawRowId??''}`));
const rec=(code,reason,extra={})=>({code,reason,...extra});

/**
 * Produce explicit evidence association certificates and blockers using the
 * ACTUAL chart_ingest_raw_rows/source/candidate storage fields. Does not issue
 * SQL requests and does not create candidate_id on any original raw object.
 */
export function reconcileRunRawEvidence({runId,candidates,rawRows,runSources}={}) {
  if(!uuid(runId)) throw new TypeError('runId must be a UUID');
  for (const [name,rows] of Object.entries({candidates,rawRows,runSources}))
    if(!Array.isArray(rows)) throw new TypeError(`${name} must be complete arrays, not null/undefined`);
  const events=[],sources=new Map(),cmap=new Map(),owners=new Map(),linked=new Map(),orphanRaw=[],seenRaw=new Set(),originalIdsByAlias=new Map();
  for(const s of runSources){
    if(!uuid(s?.id)||sources.has(s.id)) {events.push(rec('source_row_key_conflict','Duplicate/malformed source', {sourceId:s?.id??null}));continue;}
    sources.set(s.id,s);
    if(s.run_id!==runId) events.push(rec('source_wrong_run','Source must belong to requested run',{sourceId:s.id}));
  }
  for(const c of candidates){
    if(!uuid(c?.id)||cmap.has(c.id)) {events.push(rec('candidate_row_key_conflict','Duplicate/malformed candidate',{candidateId:c?.id??null}));continue;}
    cmap.set(c.id,c);linked.set(c.id,[]);
    if(c.run_id!==runId)events.push(rec('candidate_wrong_run','Candidate must belong to requested run',{candidateId:c.id}));
    if(!isObject(c.provider_ids_json)){
      events.push(rec('candidate_provider_bag_unknown','Missing provider IDs',{candidateId:c.id}));continue;
    }
    for(const [provider,ids] of Object.entries(c.provider_ids_json)){
      const iterable=Array.isArray(ids)?ids:[ids];
      for(const id of iterable){
        const alias=key(provider,id);
        if(!alias){events.push(rec('candidate_provider_claim_invalid','Invalid provider claim',{candidateId:c.id}));continue;}
        if(!owners.has(alias))owners.set(alias,new Set());
        owners.get(alias).add(c.id);
      }
    }
  }
  for(const row of rawRows){
    const rawRowId=uuid(row?.id)?row.id:null;
    if(rawRowId&&seenRaw.has(rawRowId)){events.push(rec('raw_row_duplicate_id','Duplicate raw source UUID; cannot count twice',{rawRowId}));orphanRaw.push(rawRowId);continue;}
    if(rawRowId)seenRaw.add(rawRowId);
    if(!rawRowId||row.run_id!==runId){events.push(rec('raw_wrong_run_or_key','Raw row ID or run isolation invalid',{rawRowId}));orphanRaw.push(rawRowId);continue;}
    if(Object.prototype.hasOwnProperty.call(row,'candidate_id')){
      events.push(rec('untrusted_raw_candidate_id','Raw schema must not assert candidate ownership',{rawRowId}));orphanRaw.push(rawRowId);continue;
    }
    const s=sources.get(row.source_id);
    if(!s){events.push(rec('raw_source_missing','No matching source in run',{rawRowId}));orphanRaw.push(rawRowId);continue;}
    if(s.run_id!==runId||s.enabled!==true||pkey(s.provider)!==pkey(row.provider)){
      events.push(rec('raw_source_contract_conflict','Disabled, cross-run or provider-mismatched source',{rawRowId,sourceId:s.id}));orphanRaw.push(rawRowId);continue;
    }
    const alias=key(row.provider,row.provider_track_id);
    if(!alias){events.push(rec('raw_strong_identity_missing','Raw row has no strong provider-track ID; no text fallback',{rawRowId}));orphanRaw.push(rawRowId);continue;}
    // Compaction is lossy: retain distinct original raw IDs as a collision gate.
    // Never certify two different provider IDs that collapse to the same alias.
    if(!originalIdsByAlias.has(alias))originalIdsByAlias.set(alias,new Set());
    originalIdsByAlias.get(alias).add(val(row.provider_track_id));
    const target=owners.get(alias)||new Set();
    if(target.size!==1){events.push(rec(target.size?'raw_candidate_ownership_ambiguous':'raw_candidate_owner_missing','Cannot prove unique candidate by provider ID',{rawRowId}));orphanRaw.push(rawRowId);for(const id of target)events.push(rec('candidate_provider_identity_collision','Claimed provider ID shared across candidates',{candidateId:id,rawRowId}));continue;}
    const candidateId=[...target][0];
    if(cmap.get(candidateId)?.run_id!==runId){events.push(rec('candidate_wrong_run','Candidate row belongs to another run',{candidateId,rawRowId}));orphanRaw.push(rawRowId);continue;}
    const certificate={candidateId,rawRowId,runId,sourceId:s.id,provider:pkey(row.provider),providerTrackId:val(row.provider_track_id),method:'NORMALIZED_UNIQUE_PROVIDER_TRACK_ID_IN_RUN',mayScore:false};
    linked.get(candidateId).push({rawRow:row,certificate});
  }
  for(const [alias,rawIds] of originalIdsByAlias){
    if(rawIds.size>1)events.push(rec('raw_provider_identity_compaction_collision',
      'Distinct raw provider IDs collapse to one stored candidate alias; require review'));
  }
  const perCandidate=[...cmap].sort(([a],[b])=>a.localeCompare(b)).map(([candidateId,candidate])=>{
    const items=linked.get(candidateId)||[];
    const problems=events.filter(e=>e.candidateId===candidateId);
    const operators=uniq(items.map(i=>i.certificate.provider)); // Spotify's 20 playlists = one provider operator.
    if(items.length===0)problems.push(rec('candidate_no_certified_raw_evidence','No strong source-to-candidate link',{candidateId}));
    const declaredCount=Number(candidate.source_count);
    if(!Number.isInteger(declaredCount)||declaredCount<0)problems.push(rec('candidate_source_count_invalid','Declared source count unavailable or invalid',{candidateId}));
    else if(declaredCount!==operators.length)problems.push(rec('candidate_source_count_mismatch','Declared count differs from unique linked provider operators',{candidateId}));
    if(operators.length>1)problems.push(rec('multi_operator_aggregation_unverified','Requires full native period and operator aggregation',{candidateId}));
    if(items.length>1&&operators.length===1)problems.push(rec('duplicate_provider_observations_need_reconciliation','Multiple rows of one provider require source-native dedupe',{candidateId}));
    return {candidateId,certificates:items.map(i=>i.certificate),operatorKeys:operators,problems,mayScore:false,mayPublish:false};
  });
  const runIntegrityComplete=events.length===0&&perCandidate.every(c=>c.problems.length===0);
  return {runId,perCandidate,events:sortEvents(events),orphanRawRowIds:orphanRaw,runIntegrityComplete,mayScore:false,mayPublish:false};
}

/**
 * One provider-native observation may be retained for chart research without
 * creating a Registry identity. This is deliberately narrower than a recording
 * match: the exact provider+native-ID pair proves only a provider-local source
 * reference, never equivalence across providers, versions or collaborators.
 *
 * Inputs are server-owned, complete run evidence. The caller must separately
 * prove source authorization, native period, frozen chart policy and scoring.
 * Nothing returned here grants Registry admission, scoring or publication.
 */
export async function projectChartOnlySourceIdentity({
  association,rawRows,acceptedMatches,candidateId,
}={}){
  const held=(reason)=>Object.freeze({candidateId,status:'HELD',reason,
    chartRecordingRef:null,canonicalTrackId:null,
    canScore:false,canCommit:false,canPublish:false,canAdmitRegistry:false});
  if(!uuid(candidateId)||!Array.isArray(rawRows)||!Array.isArray(acceptedMatches)||
     !isObject(association)||association.runIntegrityComplete!==true||
     !Array.isArray(association.perCandidate))
    return held('complete_source_evidence_unverified');
  const snapshot=association.perCandidate.find(x=>x.candidateId===candidateId);
  if(!snapshot||snapshot.problems.length>0||
     snapshot.certificates.length!==1||snapshot.operatorKeys.length!==1)
    return held('unique_provider_observation_unverified');
  const matches=acceptedMatches.filter(m=>m.candidate_id===candidateId);
  if(matches.length!==0)return held('registry_match_requires_separate_review');
  const cert=snapshot.certificates[0];
  const original=rawRows.find(x=>x.id===cert.rawRowId);
  if(!original||original.run_id!==association.runId||
     original.provider_track_id!==cert.providerTrackId||
     pkey(original.provider)!==cert.provider||
     !val(original.title_raw)||!val(original.artist_raw)||
     typeof cert.providerTrackId!=='string'||cert.providerTrackId.length>250||
     !/^[a-z][a-z0-9_]{1,40}$/.test(cert.provider)||
     /[\u0000-\u001f\u007f]/u.test(cert.providerTrackId))
    return held('exact_native_observation_unverified');
  // A provider-local ID is not proof that distinct provider observations
  // identify distinct recordings. A shared exact ISRC across two independent
  // candidate owners is an equivalence conflict, not a second Chart entry.
  // Never infer equivalence from title or Artist spelling.
  const normalizedIsrc=row=>{
    const id=val(row?.isrc)?.toUpperCase().replace(/[\s-]/g,'')||null;
    return id&&/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(id)?id:null;
  };
  const isrc=normalizedIsrc(original);
  if(isrc&&association.perCandidate.some(p=>
    p.candidateId!==candidateId&&p.certificates.some(c=>
      normalizedIsrc(rawRows.find(r=>r.id===c.rawRowId))===isrc)))
    return held('cross_candidate_isrc_equivalence_unreviewed');
  if(typeof globalThis.crypto?.subtle?.digest!=='function')
    return held('digest_authority_unavailable');
  const bytes=new TextEncoder().encode(JSON.stringify([
    'wakilisha-chart-only-native/v1',cert.provider,cert.providerTrackId,
  ]));
  const hash=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes));
  const hex=Array.from(hash,x=>x.toString(16).padStart(2,'0')).join('');
  return Object.freeze({candidateId,status:'SOURCE_ONLY',
    chartRecordingRef:'wkchart:source:v1:'+cert.provider+':'+hex,
    canonicalTrackId:null,rawRowId:cert.rawRowId,
    identityScope:'PROVIDER_ONLY_UNREVIEWED',
    canScore:false,canCommit:false,canPublish:false,canAdmitRegistry:false});
}

/**
 * A canonical Registry Track may carry provider links that are not yet matched.
 * The accepted production RLS originally exposed only matched links, hiding
 * review-state conflicts from caller-scoped readers. The accompanying narrow
 * view_registry SELECT policy must be live before this proof is considered
 * complete. Never turn a hidden/unknown or contradicted link into eligibility.
 *
 * This does not require a provider link for every raw observation: independently
 * accepted provider evidence may not yet have a materialized Registry link.
 * However a link already attached to the SAME canonical Track and provider
 * cannot silently contradict the original raw provider-track ID.
 */
export function assessRegistryProviderLinkEvidence({registryProviderLinks,canonicalTrackId,provider,providerTrackId}) {
  if(!Array.isArray(registryProviderLinks))throw new TypeError('complete Registry provider-link rows required');
  if(!uuid(canonicalTrackId))return [{severity:'REVIEW_REQUIRED',code:'provider_link_track_unresolved',detail:'registry_track_provider_links.track_id'}];
  const code=pkey(provider), sourceId=compactId(providerTrackId);
  if(!code||!sourceId)return [{severity:'REVIEW_REQUIRED',code:'provider_link_source_identity_unresolved',detail:'registry_track_provider_links.provider_track_id'}];
  const links=registryProviderLinks.filter(p=>p?.track_id===canonicalTrackId&&pkey(p?.provider_key)===code);
  const matches=links.filter(p=>compactId(p?.provider_track_id)===sourceId);
  const result=[];
  if(matches.length>1)result.push({severity:'CONFLICTED',code:'provider_link_compaction_collision',detail:'registry_track_provider_links.provider_track_id'});
  for(const link of matches){
    if(link.match_status==='matched')continue;
    const severity=link.match_status==='rejected'?'CONFLICTED':'REVIEW_REQUIRED';
    result.push({severity,code:'provider_link_not_accepted',detail:'registry_track_provider_links.match_status'});
  }
  if(links.length>0&&matches.length===0)result.push({severity:'REVIEW_REQUIRED',code:'provider_link_identity_unverified',detail:'registry_track_provider_links.provider_track_id'});
  return result;
}

/**
 * Non-authorizing, offline single-row bridge for the verified data path.
 * The derived candidate_id is ONLY sent to the earlier pure prototype after
 * its exact provider-ID ownership certificate is established. It is NOT a
 * claim that chart_ingest_raw_rows stores that field.
 */
export async function inspectProductionShapedRunCandidate(frozen,input,candidateId) {
  const association=reconcileRunRawEvidence(input);
  const summary=association.perCandidate.find(c=>c.candidateId===candidateId);
  if(!summary)throw new TypeError('Candidate not found in run');
  if(!association.runIntegrityComplete||summary.certificates.length!==1)
    return {outcome:'REVIEW_REQUIRED',reasonCodes:uniq(summary.problems.map(x=>x.code).concat(association.events.map(e=>e.code))),association,mayScore:false,mayPublish:false};
  const cert=summary.certificates[0];
  const candidate=input.candidates.find(c=>c.id===candidateId);
  const raw=input.rawRows.find(r=>r.id===cert.rawRowId);
  const acceptedMatches=(input.acceptedMatches||[]).filter(m=>m.candidate_id===candidateId);
  const trackId=acceptedMatches.find(m=>m.status==='accepted'&&m.entity_type==='track')?.canonical_entity_id;
  const registryTrack=(input.registryTracks||[]).find(t=>t.id===trackId)||null;
  const credits=(input.registryCredits||[]).filter(c=>c.track_id===trackId);
  const artistIds=new Set(credits.map(c=>c.artist_id));
  const registryArtists=(input.registryArtists||[]).filter(a=>artistIds.has(a.id));
  // All supplemental facts below must come from separately verified typed
  // Registry/source reads, not arbitrary raw_payload_json or display strings.
  const trackMetadata=(input.verifiedTrackMetadata||[]).find(t=>t.id===trackId)||{};
  const releaseMetadata=(input.verifiedReleaseMetadata||[]).find(t=>t.track_id===trackId)||{};
  const result=await evaluateRegistryChartCandidate(frozen,{
    candidate,acceptedMatches,registryTrack,credits,registryArtists,
    sourceObservation:{...raw,candidate_id:candidateId},
    marketIso2:input.marketIso2??null,trackMetadata,releaseMetadata,
  });
  const linkBlockers=assessRegistryProviderLinkEvidence({
    registryProviderLinks:input.registryProviderLinks,
    canonicalTrackId:trackId,provider:raw.provider,providerTrackId:raw.provider_track_id,
  });
  const hasConflict=linkBlockers.some(b=>b.severity==='CONFLICTED');
  const hasReview=linkBlockers.some(b=>b.severity==='REVIEW_REQUIRED');
  const resolvedOutcome=hasConflict?'CONFLICTED':
    (hasReview && result.outcome==='ELIGIBLE'?'REVIEW_REQUIRED':result.outcome);
  const originalProviderEvidence=[{rawRowId:cert.rawRowId,sourceId:cert.sourceId,provider:cert.provider,
    sourcePosition:Number.isInteger(raw.source_position)&&raw.source_position>0?raw.source_position:null}];
  return {...result,outcome:resolvedOutcome,blockers:[...(result.blockers||[]),...linkBlockers],
    associationCertificate:cert,operatorKeys:summary.operatorKeys,originalProviderEvidence,mayScore:false,mayPublish:false};
}

/**
 * Review projection for the EXISTING ingest-run workbench. No write actions.
 * Summaries use the explicit four-state disposition, rather than promoting
 * missing/unknown metadata into ELIGIBLE or losing it under excluded rows.
 * Original provider ranks remain attached as observations, NOT chart ranks.
 */
export function projectSameRunMetadataReview(evaluations) {
  if(!Array.isArray(evaluations))throw new TypeError('evaluations must be an array');
  const rows=[],seen=new Set();
  for(const item of evaluations){
    const candidateId=val(item?.candidateId);
    if(!uuid(candidateId)||seen.has(candidateId))throw new TypeError('review projection needs unique candidate UUIDs');
    seen.add(candidateId);
    const evaluation=item.evaluation;
    const outcome=evaluation?.outcome;
    if(!['ELIGIBLE','EXCLUDED','REVIEW_REQUIRED','CONFLICTED'].includes(outcome))throw new TypeError('invalid/unverified evaluator result');
    if(evaluation?.mayScore!==false||evaluation?.mayPublish!==false)throw new TypeError('review input unexpectedly authorizes scoring/publication');
    const reasons=[...(evaluation.blockers||[]).map(b=>({code:b.code,field:b.detail??null,category:'source_or_identity',severity:b.severity})),
      ...(evaluation.filter?.reasons||[]).map(r=>({code:r.code,field:r.field,category:'eligibility',severity:r.status})),
      ...(evaluation.reasonCodes||[]).map(code=>({code,field:null,category:'run_evidence',severity:'REVIEW_REQUIRED'}))];
    const uniqueReasons=[...new Map(reasons.map(r=>[`${r.category}:${r.code}:${r.field??''}`,r])).values()];
    rows.push({candidateId,outcome,requiresReview:outcome==='REVIEW_REQUIRED'||outcome==='CONFLICTED',
      reasons:uniqueReasons,originalProviderEvidence:(evaluation.originalProviderEvidence||[]).map(r=>({rawRowId:r.rawRowId??null,sourcePosition:r.sourcePosition??null,provider:r.provider??null})),
      mayScore:false,mayPublish:false});
  }
  const counts={ELIGIBLE:0,EXCLUDED:0,REVIEW_REQUIRED:0,CONFLICTED:0};
  for(const row of rows)counts[row.outcome]++;
  return {rows,counts,reviewRowCount:counts.REVIEW_REQUIRED+counts.CONFLICTED,
    noBlockingReviewRows:counts.REVIEW_REQUIRED+counts.CONFLICTED===0,
    canAdvanceToScoring:false,mayScore:false,mayPublish:false};
}
