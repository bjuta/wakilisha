/**
 * Strict bridge for real-clock, Admin-authorized one-time WK100 acquisition.
 * Receives ONLY the service-role, immutable SQL request projection. A client
 * cannot choose a source, clock, endpoint, parser, or authorization here.
 * Does not score, publish, revise admissions, or change scheduled cadence.
 */
import { validEatWeek } from './wk100-source-admin-projection.mjs';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fail=code=>{throw new Error('wk100_collect_now_'+code);};
function instant(s){
  if(typeof s!=='string'||s.length>40)return null;
  const n=Date.parse(s);
  return Number.isFinite(n)?n:null;
}
export function selectWk100CollectNowDispatch({
  requests,sourceContracts,approvedDecisions,attempts,nowUtc,weekStartEat,
}){
  if(!validEatWeek(weekStartEat)||!Array.isArray(requests)||
    !Array.isArray(sourceContracts)||!Array.isArray(approvedDecisions)||
    !Array.isArray(attempts)||requests.length>100||sourceContracts.length>100||
    approvedDecisions.length>100||attempts.length>5000)fail('input_invalid');
  const now=instant(nowUtc);
  if(now===null)fail('clock_invalid');
  const contracts=new Map();
  const decisions=new Map();
  for(const c of sourceContracts){
    if(!c||!UUID.test(c.id)||typeof c.source_key!=='string'||
      typeof c.contract_version!=='string')fail('contract_invalid');
    const id=c.source_key+'/'+c.contract_version;
    if(contracts.has(id))fail('contract_duplicate');
    contracts.set(id,c);
  }
  for(const d of approvedDecisions){
    if(!d||typeof d.source_key!=='string'||typeof d.contract_version!=='string')
      fail('method_invalid');
    const id=d.source_key+'/'+d.contract_version;
    if(decisions.has(id))fail('method_duplicate');
    decisions.set(id,d);
  }
  const jobs=[],seen=new Set();
  for(const r of requests){
    const when=instant(r?.scheduled_at);
    const key=r?.source_key+'/'+r?.contract_version;
    const c=contracts.get(key),d=decisions.get(key);
    if(!c||!d||r.contract_id!==c.id||r.week_start_eat!==weekStartEat||
      d.state!=='collector_admitted'||d.enabled!==true||when===null||
      when%60000!==0||now<when||now-when>20*60000||
      !UUID.test(r.operation_id??'')||!UUID.test(r.actor_user_id??''))
      continue;
    const serial=c.id+'/'+when;
    if(seen.has(serial))fail('request_duplicate');
    seen.add(serial);
    if(attempts.some(a=>a?.contract_id===c.id&&instant(a?.scheduled_at)===when))
      continue;
    jobs.push({
      source_key:c.source_key,contract_version:c.contract_version,
      week_start_eat:weekStartEat,
      scheduled_at:new Date(when).toISOString().replace(/\.000Z$/,'Z'),
      attempt_number:1,collection_mode:'collect_now',
    });
  }
  jobs.sort((a,b)=>a.scheduled_at.localeCompare(b.scheduled_at)||
    a.source_key.localeCompare(b.source_key));
  return Object.freeze({jobs:Object.freeze(jobs),canScore:false,canPublish:false});
}
