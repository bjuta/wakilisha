/**
 * Read-only WAKILISHA 100 evidence readiness. No methodology, extra source,
 * ranking weights, freeze, scoring, persistence or publication authority.
 * This view consumes already-reconciled Admin source/method reads, but cannot
 * verify the raw original bytes or canonical Registry identity on its own.
 */
import {WK100_RANKING_SPECIFICATION_V1 as RANK} from './wk100-ranking-primitive.mjs';
const SHA=/^[a-f0-9]{64}$/;
const YYYY_MM_DD=/^\d{4}-\d{2}-\d{2}$/;
const STAMP=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const hold=code=>{throw new Error('wk100_ranking_review_'+code);};
function startOfEatWeek(week){
  if(typeof week!=='string'||!YYYY_MM_DD.test(week))hold('week_invalid');
  const ms=Date.parse(week+'T00:00:00Z');
  if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==week||
     new Date(ms).getUTCDay()!==1)hold('week_invalid');
  return ms-3*3600000;
}
const isStamped=s=>typeof s==='string'&&STAMP.test(s)&&Number.isFinite(Date.parse(s));
const inWeek=(instant,start)=>isStamped(instant)&&
  Date.parse(instant)>=start&&Date.parse(instant)<start+7*86400000;
const original=s=>typeof s.receiptSha256==='string'&&SHA.test(s.receiptSha256)&&
  ['succeeded','partial_depth'].includes(s.captureState)&&
  Number.isInteger(s.observedDepth)&&s.observedDepth>0&&
  Number.isInteger(s.expectedDepth)&&s.observedDepth<=s.expectedDepth;
const native=(s,start)=>{
  if(s.nativePeriodAuthority!=='provider_defined'||
     !isStamped(s.nativePeriodStart)||!isStamped(s.nativePeriodEnd))return false;
  const from=Date.parse(s.nativePeriodStart),to=Date.parse(s.nativePeriodEnd);
  return from<to&&from>=start&&to<=start+7*86400000;
};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function reviewWk100RankingEvidence({weekStartEat,sources=[],methods=[],reviewedSourceIds=[]}={}){
  const start=startOfEatWeek(weekStartEat);
  if(!Array.isArray(sources)||sources.length>200||
     !Array.isArray(methods)||methods.length>500||
     !Array.isArray(reviewedSourceIds)||reviewedSourceIds.length>200||
     sources.some(s=>!obj(s))||methods.some(m=>!obj(m)))hold('read_unavailable');
  const keys=sources.map(s=>s.sourceKey);
  if(keys.some(k=>typeof k!=='string'||!k.trim())||
     new Set(keys).size!==keys.length)hold('source_identity_invalid');
  if(reviewedSourceIds.some(id=>typeof id!=='string'||!id.trim())||
     new Set(reviewedSourceIds).size!==reviewedSourceIds.length)hold('review_authority_invalid');
  const liveIds=new Set(reviewedSourceIds);
  const core=RANK.families.map(family=>{
    const list=sources.filter(s=>s.provider===family&&s.market===RANK.market);
    let originalCount=0,methodCandidateCount=0,nativeWindowCount=0;
    let asOfCount=0,metricMatchCount=0,chainCandidateCount=0;
    for(const s of list){
      const hasOriginal=original(s);
      const metric=s.metric===RANK.nativeMetrics[family];
      // An earlier admitted method cannot survive a later pause or retirement.
      const decisions=methods.filter(m=>m.sourceKey===s.sourceKey&&m.providerKey===family);
      const valid=decisions.filter(m=>Number.isInteger(m.decisionRevision)&&m.decisionRevision>0);
      const latest=Math.max(0,...valid.map(m=>m.decisionRevision));
      const current=valid.filter(m=>m.decisionRevision===latest);
      const method=current.length===1&&valid.length===decisions.length?current[0]:null;
      const candidate=!!method&&liveIds.has(s.id)&&
        method.captureContractVersion===s.version&&
        method.decisionState==='collector_admitted'&&method.hasMethodEvidence===true;
      const nativeWindow=native(s,start)&&method?.nativePeriodAuthority==='provider_defined';
      const asOf=family!=='youtube_ke'&&s.nativePeriodAuthority==='unknown'&&
        method?.nativePeriodAuthority==='observed_as_of'&&inWeek(s.lastSuccessfulAt,start);
      if(hasOriginal)originalCount++;
      if(metric)metricMatchCount++;
      if(candidate)methodCandidateCount++;
      if(nativeWindow)nativeWindowCount++;
      if(asOf)asOfCount++;
      if(hasOriginal&&metric&&candidate&&(nativeWindow||asOf))chainCandidateCount++;
    }
    const holds=[];
    if(!list.length)holds.push('no_enrolled_source_report');
    if(!originalCount)holds.push('no_original_receipt_in_report');
    if(!methodCandidateCount)holds.push('method_admission_not_confirmed');
    if(!metricMatchCount)holds.push('native_metric_not_confirmed');
    if(!nativeWindowCount&&!asOfCount)holds.push('native_period_not_verified');
    if(asOfCount&&!nativeWindowCount)holds.push('as_of_not_weekly_total');
    if(!chainCandidateCount)holds.push('evidence_chain_incomplete');
    holds.push('registry_identity_and_week_alignment_unattested');
    return Object.freeze({family,sourceCount:list.length,originalCount,methodCandidateCount,
      nativeWindowCount,asOfCount,metricMatchCount,chainCandidateCount,
      holds:Object.freeze(holds),canScore:false,canFreeze:false});
  });
  return Object.freeze({schemaVersion:'wk100-ranking-evidence-review/v1',
    specificationId:RANK.id,weekStartEat,core:Object.freeze(core),
    chainCandidateFamilies:core.filter(x=>x.chainCandidateCount>0).length,
    requiredFamilies:RANK.familyCount,sourceCoverageConfirmed:false,
    nativeFormulaApproved:false,weekCompletenessApproved:false,
    concentrationAndSensitivityApproved:false,independentApprovalRecorded:false,
    canScore:false,canFreeze:false,canPublish:false});
}
