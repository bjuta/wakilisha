/**
 * WAKILISHA 100, fixed v1 ranking calculation.
 *
 * A pure, private computation over previously authenticated and independently
 * attested source observations and canonical Registry recording identities.
 * It does NOT fetch providers, confer source/identity admission, freeze an
 * Edition, stage it or publish it. Only a trusted server may assemble inputs.
 * Historical methodologies are not configuration inputs to this primitive.
 */
export const WK100_RANKING_SPECIFICATION_V1 = Object.freeze({
  id:'wk100-kenya-traction-ordinal-v1',
  market:'KE',
  families:Object.freeze(['apple_ke','shazam_ke','mdundo_ke','youtube_ke','audiomack_ke']),
  familyWeightPercent:20,
  familyCount:5,
  expectedSnapshots:Object.freeze({apple_ke:7,shazam_ke:1,mdundo_ke:1,youtube_ke:1,audiomack_ke:1}),
  nativeMetrics:Object.freeze({apple_ke:'rank',shazam_ke:'rank',mdundo_ke:'rank',
    youtube_ke:'rank_and_count',audiomack_ke:'rank'}),
  spotifyContributionPercent:0,
  tieBreak:'canonical_recording_id_ascending',
  rankedSize:100,
  scoreScale:1_000_000,
  // Conservative inaugural rule: incomplete provider depth or checkpoints
  // cannot be silently filled, imputed, or redistributed.
  incompleteSourcePolicy:'hold_all_families_required',
});
const S=WK100_RANKING_SPECIFICATION_V1;
const SHA=/^[a-f0-9]{64}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MONDAY=/^\d{4}-\d{2}-\d{2}$/;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&
  Object.keys(x).every(key=>keys.includes(key));
const fail=code=>{throw new Error('wk100_rank_'+code)};
const time=value=>{
  if(typeof value!=='string'||!UTC.test(value))fail('timestamp_invalid');
  const ms=Date.parse(value);
  if(!Number.isFinite(ms)||new Date(ms).toISOString().replace(/\.000Z$/,'Z')!==
    value.replace(/\.000Z$/,'Z'))fail('timestamp_invalid');
  return ms;
};
const weekStart=value=>{
  if(typeof value!=='string'||!MONDAY.test(value))fail('week_invalid');
  const ms=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==value||
     new Date(ms).getUTCDay()!==1)fail('week_invalid');
  return ms-3*60*60*1000;
};
const eatDay=(ms)=>new Date(ms+3*60*60*1000).toISOString().slice(0,10);
const qMicro=(rank,depth)=>Math.floor(((depth-rank+1)*S.scoreScale+Math.floor(depth/2))/depth);
const snapshotFields=['family','sourceKey','captureReceiptId','captureReceiptSha256','market',
  'nativeMetric','observedAtUtc','nativePeriodAuthority','nativePeriodStartUtc',
  'nativePeriodEndUtc','providerPeriodStartDate','providerPeriodEndDate',
  'declaredDepth','rows'];
const rowKeysRank=['recordingId','rank'];
const rowKeysCount=['recordingId','rank','nativeCount'];

/**
 * Compute a deterministically ranked PRIVATE candidate. The input must come
 * from a trusted, receipt-attesting, Registry-verifying server integration.
 * Strings/digests supplied here are validated for shape, not cryptographically
 * verified against Storage. This function is not itself an admission RPC.
 */
export async function computeWk100PrivateRankingCandidate(input){
  if(!exact(input,['weekStartEat','eligibilityPolicySha256','registrySnapshotSha256','snapshots'])||
    !SHA.test(input.eligibilityPolicySha256)||!SHA.test(input.registrySnapshotSha256)||
    !Array.isArray(input.snapshots)||input.snapshots.length!==11)
    fail('input_invalid');
  const start=weekStart(input.weekStartEat),end=start+7*86_400_000;
  const counted=new Map(S.families.map(f=>[f,[]]));
  const receiptIds=new Set(),sourceIds=new Map();
  const normalized=[];
  for(const raw of input.snapshots){
    if(!exact(raw,snapshotFields)||!S.families.includes(raw.family)||
      raw.market!=='KE'||raw.nativeMetric!==S.nativeMetrics[raw.family]||
      typeof raw.sourceKey!=='string'||!/^([a-z][a-z0-9_]{2,63})$/.test(raw.sourceKey)||
      !UUID.test(raw.captureReceiptId)||!SHA.test(raw.captureReceiptSha256)||
      !Number.isInteger(raw.declaredDepth)||raw.declaredDepth<100||raw.declaredDepth>1000||
      !Array.isArray(raw.rows)||raw.rows.length!==raw.declaredDepth)
      fail('snapshot_invalid');
    if(receiptIds.has(raw.captureReceiptId))fail('receipt_reused');
    receiptIds.add(raw.captureReceiptId);
    if(sourceIds.has(raw.family)&&sourceIds.get(raw.family)!==raw.sourceKey)
      fail('family_source_changed');
    sourceIds.set(raw.family,raw.sourceKey);
    const observed=time(raw.observedAtUtc);
    if(observed<start||observed>=end)fail('observation_outside_week');
    if(raw.nativePeriodAuthority==='provider_defined'){
      if(raw.providerPeriodStartDate!==null||raw.providerPeriodEndDate!==null)
        fail('period_authority_invalid');
      const from=time(raw.nativePeriodStartUtc),to=time(raw.nativePeriodEndUtc);
      if(from>=to||to>observed||to<=start||to>end)fail('native_period_incompatible');
      if(raw.family==='youtube_ke'&&(to-from)!==7*86_400_000)
        fail('youtube_week_incorrect');
    }else if(raw.nativePeriodAuthority==='provider_declared_dates'){
      // Provider calendar dates are not UTC instants. Do not invent a clock or
      // convert reported source dates into an alleged exact seven-day interval.
      if(raw.nativePeriodStartUtc!==null||raw.nativePeriodEndUtc!==null||
        typeof raw.providerPeriodStartDate!=='string'||
        typeof raw.providerPeriodEndDate!=='string'||
        !MONDAY.test(raw.providerPeriodStartDate)||
        !MONDAY.test(raw.providerPeriodEndDate))fail('period_authority_invalid');
      const from=Date.parse(raw.providerPeriodStartDate+'T00:00:00Z');
      const to=Date.parse(raw.providerPeriodEndDate+'T00:00:00Z');
      if(!Number.isFinite(from)||!Number.isFinite(to)||
        new Date(from).toISOString().slice(0,10)!==raw.providerPeriodStartDate||
        new Date(to).toISOString().slice(0,10)!==raw.providerPeriodEndDate||
        from>to||raw.providerPeriodEndDate<eatDay(start)||
        raw.providerPeriodEndDate>=eatDay(end)||
        raw.providerPeriodEndDate>eatDay(observed))fail('native_period_incompatible');
      if(raw.family==='youtube_ke'&&(to-from)!==6*86_400_000)
        fail('youtube_week_incorrect');
      // Date-only observations must not claim that the period ended at an
      // inferred timezone-specific UTC instant.
    }else if(raw.nativePeriodAuthority==='observed_as_of'){
      if(raw.family==='youtube_ke'||raw.nativePeriodStartUtc!==null||
        raw.nativePeriodEndUtc!==null||raw.providerPeriodStartDate!==null||
        raw.providerPeriodEndDate!==null)fail('period_authority_invalid');
    }else fail('period_authority_invalid');
    const seenRecording=new Set(),seenRanks=new Set();
    const rows=raw.rows.map(row=>{
      if(!exact(row,raw.family==='youtube_ke'?rowKeysCount:rowKeysRank)||
        !UUID.test(row.recordingId)||!Number.isInteger(row.rank)||
        row.rank<1||row.rank>raw.declaredDepth||
        seenRecording.has(row.recordingId)||seenRanks.has(row.rank))
        fail('rank_or_identity_invalid');
      seenRecording.add(row.recordingId);seenRanks.add(row.rank);
      if(raw.family==='youtube_ke'){
        if(!Number.isSafeInteger(row.nativeCount)||row.nativeCount<0)
          fail('youtube_native_count_invalid');
      }
      return {recordingId:row.recordingId,rank:row.rank,
        ...(raw.family==='youtube_ke'?{nativeCount:row.nativeCount}:{})};
    }).sort((a,b)=>a.rank-b.rank);
    // Contiguous ordered originals are mandatory for this initial primitive.
    for(let i=0;i<rows.length;i++)if(rows[i].rank!==i+1)fail('rank_gap');
    if(raw.family==='youtube_ke')for(let i=1;i<rows.length;i++)
      if(rows[i].nativeCount>rows[i-1].nativeCount)
        fail('youtube_count_order_invalid');
    const normalizedSnapshot={family:raw.family,sourceKey:raw.sourceKey,
      captureReceiptId:raw.captureReceiptId,captureReceiptSha256:raw.captureReceiptSha256,
      market:'KE',nativeMetric:raw.nativeMetric,observedAtUtc:raw.observedAtUtc,
      nativePeriodAuthority:raw.nativePeriodAuthority,
      nativePeriodStartUtc:raw.nativePeriodStartUtc,nativePeriodEndUtc:raw.nativePeriodEndUtc,
      providerPeriodStartDate:raw.providerPeriodStartDate,
      providerPeriodEndDate:raw.providerPeriodEndDate,declaredDepth:raw.declaredDepth,rows};
    normalized.push(normalizedSnapshot);
    counted.get(raw.family).push(normalizedSnapshot);
  }
  for(const family of S.families){
    const panels=counted.get(family);
    if(panels.length!==S.expectedSnapshots[family])fail('family_checkpoints_incomplete');
    if(family==='apple_ke'){
      const days=panels.map(p=>eatDay(time(p.observedAtUtc)));
      if(new Set(days).size!==7)fail('apple_daily_checkpoints_incomplete');
    }
  }
  // A source's original is one observation. Seven Apple daily snapshots do
  // not give Apple seven provider votes; every family is exactly one fifth.
  const familyContributions=new Map();
  for(const family of S.families){
    const panels=counted.get(family),acc=new Map();
    for(const panel of panels){
      for(const row of panel.rows)acc.set(row.recordingId,
        (acc.get(row.recordingId)||0)+qMicro(row.rank,panel.declaredDepth));
    }
    for(const [id,total] of acc){
      const micro=Math.floor((total+Math.floor(panels.length/2))/panels.length);
      if(!familyContributions.has(id))familyContributions.set(id,{});
      familyContributions.get(id)[family]=micro;
    }
  }
  if(familyContributions.size<S.rankedSize)fail('fewer_than_100_recordings');
  const ranked=[...familyContributions].map(([recordingId,parts])=>{
    const contributions=Object.fromEntries(S.families.map(f=>[f,parts[f]||0]));
    const totalMicros=S.families.reduce((sum,f)=>sum+20*contributions[f],0);
    return {recordingId,totalMicros,score:Number((totalMicros/S.scoreScale).toFixed(6)),
      contributions,
      listedFamilyCount:S.families.filter(f=>Object.hasOwn(parts,f)).length};
  }).sort((a,b)=>b.totalMicros-a.totalMicros||a.recordingId.localeCompare(b.recordingId))
    .slice(0,S.rankedSize).map((v,i)=>Object.freeze({...v,rank:i+1,
      contributions:Object.freeze(v.contributions)}));
  normalized.sort((a,b)=>S.families.indexOf(a.family)-S.families.indexOf(b.family)||
    a.observedAtUtc.localeCompare(b.observedAtUtc));
  // Content digest is deterministic over sorted source evidence and the exact
  // mathematical output. Authentication, raw-byte verification and signing
  // belong to the trusted integration and independent Edition authority.
  const canonical=JSON.stringify({specificationId:S.id,weekStartEat:input.weekStartEat,
    eligibilityPolicySha256:input.eligibilityPolicySha256,
    registrySnapshotSha256:input.registrySnapshotSha256,snapshots:normalized,ranked});
  if(!globalThis.crypto?.subtle)fail('crypto_unavailable');
  const hashed=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical));
  const rankingDigest=Array.from(new Uint8Array(hashed),x=>x.toString(16).padStart(2,'0')).join('');
  return Object.freeze({schemaVersion:'wk100-private-ranking-candidate/v1',
    specificationId:S.id,weekStartEat:input.weekStartEat,rankingDigest,
    ranked:Object.freeze(ranked),eligibleRecordings:familyContributions.size,
    sourceFamilies:Object.freeze([...S.families]),sourcePanelCount:normalized.length,
    sourceCompleteness:'all_required_panels_present',
    scoreMeaning:'ordinal_chart_traction_not_streams',
    status:'private_research_candidate',
    // No public, staging or autonomous approval authority in a math function.
    canStage:false,canPublish:false});
}
