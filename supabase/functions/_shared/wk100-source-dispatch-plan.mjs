/**
 * Deterministic, nonpublishing WK100 service dispatch plan.
 * Pure decision function: never fetches, grants approval, writes a capture
 * receipt, modifies Registry identity, scores or publishes.
 *
 * approvedDecisions MUST come from a trusted server-side admitted-method
 * authority, never browser payloads or a source proposal alone. The separate
 * deployment execution switch remains OFF by default.
 */
import { checkpointsForSource } from './chart-weekly-evidence.mjs';
import { validEatWeek } from './wk100-source-admin-projection.mjs';
import { resolveCaptureParser } from './chart-capture-runtime.mjs';

const SHA=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/;
const failure=c=>{throw new Error(c)};
function exactUtc(s){
  return typeof s==='string'&&UTC.test(s)&&!Number.isNaN(Date.parse(s))&&
    new Date(s).toISOString().replace('.000Z','Z')===s;
}
// PostgREST serializes PostgreSQL timestamptz as +00:00 (sometimes with
// microseconds). A byte-for-byte comparison to planner slots ending in Z
// would miss an existing attempt and could dispatch an unauthorized retry.
const SQL_INSTANT=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/;
function sqlInstant(value){
  if(typeof value!=='string'||!SQL_INSTANT.test(value))return null;
  const ms=Date.parse(value);
  return Number.isFinite(ms)?ms:null;
}
function asKernelContract(c){
  return {
    source_key:c.source_key,behavior:c.behavior,metric:c.native_metric,
    market:c.market,depth:c.expected_depth,adapter_version:c.adapter_version,
    source_contract_version:c.contract_version,required:false,
    cadence:{kind:c.cadence_kind,hours:c.interval_hours??undefined,
      eat_hour:c.eat_hour,eat_minute:c.eat_minute,weekday_eat:c.weekday_eat??undefined},
    minimum_healthy_checkpoints:c.minimum_healthy_checkpoints,
  };
}
function isQualified(d,c,now) {
  if(!d||d.source_key!==c.source_key||d.contract_version!==c.contract_version||
    d.provider_key!==c.provider_key)return 'source_decision_mismatch';
  if(d.state!=='collector_admitted'||d.enabled!==true)return 'source_not_admitted';
  if(d.native_period_state!=='provider_defined'||typeof d.native_period_evidence_ref!=='string'||
    d.native_period_evidence_ref.length<3)return 'native_period_unverified';
  if(typeof d.authorization_ref!=='string'||d.authorization_ref.length<3||
    !SHA.test(d.evidence_sha256)||!SHA.test(d.endpoint_sha256)||
    typeof d.constitution_version!=='string'||d.constitution_version.length<2)
    return 'source_authority_incomplete';
  if(!exactUtc(d.authorization_expires_at)||Date.parse(d.authorization_expires_at)<=now)
    return 'source_authority_expired';
  if(!resolveCaptureParser(c,{parser_class:d.parser_class}))
    return 'source_parser_unimplemented';
  return null;
}
/**
 * One deterministic job per due (source, version, EAT slot), bounded retries.
 * Attempt receipts are authoritative; retrying cannot manufacture a second
 * independent observation for a source/slot. An actual worker still must use
 * the database's atomic reservation and an independently verified access
 * manifest before any GET.
 */
export function planWk100SourceDispatch({
  weekStartEat,nowUtc,sourceContracts=[],approvedDecisions=[],attempts=[],
  executionEnabled=false,
}) {
  if(!validEatWeek(weekStartEat)||!exactUtc(nowUtc)||
    !Array.isArray(sourceContracts)||!Array.isArray(approvedDecisions)||
    !Array.isArray(attempts)||sourceContracts.length>100||
    approvedDecisions.length>100||attempts.length>5000)
    failure('wk100_dispatch_input_invalid');
  const never={canScore:false,canPublish:false};
  if(executionEnabled!==true) return Object.freeze({
    schemaVersion:'wk100-source-dispatch-plan-v1',weekStartEat,
    jobs:[],blocked:[{code:'scheduler_disabled'}],...never,
  });
  const now=Date.parse(nowUtc), jobs=[],blocked=[];
  const seenKeys=new Set(),seenDecisions=new Set();
  for(const d of approvedDecisions){
    if(!d||typeof d.source_key!=='string'||seenDecisions.has(d.source_key))
      failure('wk100_duplicate_or_invalid_source_decision');
    seenDecisions.add(d.source_key);
  }
  const decisions=new Map(approvedDecisions.map(d=>[d.source_key,d]));
  for(const c of sourceContracts){
    if(!c||typeof c.source_key!=='string'||typeof c.contract_version!=='string'||
       seenKeys.has(c.source_key))failure('wk100_duplicate_or_invalid_source_contract');
    seenKeys.add(c.source_key);
    const decision=decisions.get(c.source_key);
    if(!decision) {blocked.push({sourceKey:c.source_key,code:'source_decision_absent'});continue;}
    const reason=isQualified(decision,c,now);
    if(reason){blocked.push({sourceKey:c.source_key,code:reason});continue;}
    let slots;
    try{slots=checkpointsForSource(weekStartEat,asKernelContract(c))}
    catch{blocked.push({sourceKey:c.source_key,code:'source_slot_contract_invalid'});continue;}
    // If the SQL attempt timestamps for this contract are malformed, do
    // not silently overlook them and invent another attempt for this source.
    if(attempts.some(a=>a?.contract_id===c.id&&sqlInstant(a.scheduled_at)===null)){
      blocked.push({sourceKey:c.source_key,code:'attempt_history_invalid'});
      continue;
    }
    for(const slot of slots){
      const delta=now-Date.parse(slot.scheduled_at);
      if(delta<0||delta>20*60_000)continue; // no catch-up/backfill
      const same=attempts.filter(a=>a?.contract_id===c.id&&
        sqlInstant(a.scheduled_at)===Date.parse(slot.scheduled_at));
      if(same.some(a=>['succeeded','partial_depth'].includes(a.status))){
        blocked.push({sourceKey:c.source_key,scheduledAt:slot.scheduled_at,code:'slot_already_observed'});
        continue;
      }
      if(same.some(a=>['parse_failed','target_period_unavailable'].includes(a.status))){
        blocked.push({sourceKey:c.source_key,scheduledAt:slot.scheduled_at,code:'source_quarantined'});
        continue;
      }
      if(same.some(a=>!['transport_failed','missed'].includes(a.status))){
        blocked.push({sourceKey:c.source_key,scheduledAt:slot.scheduled_at,code:'slot_reservation_unresolved'});
        continue;
      }
      const nums=same.map(a=>a.attempt_number);
      if(nums.some(n=>!Number.isInteger(n)||n<1||n>8)||new Set(nums).size!==nums.length){
        blocked.push({sourceKey:c.source_key,scheduledAt:slot.scheduled_at,code:'attempt_history_invalid'});
        continue;
      }
      const attempt=Math.max(0,...nums)+1;
      if(attempt>8){blocked.push({sourceKey:c.source_key,scheduledAt:slot.scheduled_at,code:'retry_budget_exhausted'});continue;}
      jobs.push(Object.freeze({
        source_key:c.source_key,contract_version:c.contract_version,
        week_start_eat:weekStartEat,scheduled_at:slot.scheduled_at,
        attempt_number:attempt,
      }));
    }
  }
  jobs.sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||a.source_key.localeCompare(b.source_key));
  return Object.freeze({schemaVersion:'wk100-source-dispatch-plan-v1',weekStartEat,
    jobs:Object.freeze(jobs),blocked:Object.freeze(blocked),...never});
}

/**
 * Enforce the founder-governed W3 retry request at the service dispatcher.
 * First attempts remain automatic when separately admitted; attempt 2..8
 * needs an exact, durable, actor-audited SQL request for the same contract,
 * source, EAT week and slot. An irrelevant request cannot grant a dispatch.
 * This does not override method admission, leases, TTL or native-period gates.
 */
export function selectWk100AuditedDispatch({jobs,sourceContracts,retryRequests}){
  if(!Array.isArray(jobs)||!Array.isArray(sourceContracts)||
    !Array.isArray(retryRequests)||jobs.length>5000||
    sourceContracts.length>100||retryRequests.length>500)
    failure('wk100_retry_dispatch_invalid');
  const ids=new Map();
  for(const c of sourceContracts){
    if(!c||typeof c.id!=='string'||!c.id||
      typeof c.source_key!=='string'||typeof c.contract_version!=='string')
      failure('wk100_retry_dispatch_invalid');
    const key=c.source_key+'/'+c.contract_version;
    if(ids.has(key))failure('wk100_retry_dispatch_invalid');
    ids.set(key,c.id);
  }
  const requested=new Set();
  for(const r of retryRequests){
    const when=sqlInstant(r?.scheduled_at);
    if(!r||typeof r.contract_id!=='string'||!r.contract_id||
      typeof r.source_key!=='string'||!validEatWeek(r.week_start_eat)||
      when===null||!Number.isInteger(r.attempt_number)||
      r.attempt_number<2||r.attempt_number>8)
      failure('wk100_retry_dispatch_invalid');
    requested.add(JSON.stringify([r.contract_id,r.source_key,
      r.week_start_eat,when,r.attempt_number]));
  }
  const selected=jobs.filter(job=>{
    if(job.attempt_number===1)return true;
    const id=ids.get(job.source_key+'/'+job.contract_version);
    if(!id||job.attempt_number<2||job.attempt_number>8)return false;
    const when=sqlInstant(job.scheduled_at);
    return when!==null&&requested.has(JSON.stringify([
      id,job.source_key,job.week_start_eat,when,job.attempt_number]));
  });
  // Honor explicit retry requests before unattended first attempts when
  // the current trigger can execute only four slots.
  selected.sort((a,b)=>
    Number(b.attempt_number>1)-Number(a.attempt_number>1)||
    a.scheduled_at.localeCompare(b.scheduled_at)||
    a.source_key.localeCompare(b.source_key));
  return Object.freeze({
    jobs:Object.freeze(selected),withheldRetryCount:jobs.length-selected.length,
  });
}
