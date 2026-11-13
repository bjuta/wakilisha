/**
 * Pure service-side bridge from immutable database admission to candidate
 * scheduler eligibility. No browser/CLI payload can create this authority.
 * A provider method decision, a matching capture contract, a SHA-sealed
 * server manifest and an explicitly selected constitution must all agree.
 */
import { isWk100YouTubeNativePost } from './chart-candidate-capture.mjs';
const SHA=/^[0-9a-f]{64}$/;
const IDENT=/^[a-z][a-z0-9_]{2,63}$/;
function fail(code){throw new Error(code);}
/**
 * Enforce provider-owned transport before constructing scheduler jobs and in
 * the independently called capture worker. Source admission is still separate.
 * Other provider-scoped routes retain their existing GET-only behavior.
 */
export function isWk100FirstPartyTransport(sourceKey,method,endpoint,nativePeriodKey){
  if(typeof sourceKey!=='string'||!IDENT.test(sourceKey)||
    typeof endpoint!=='string')return false;
  if(sourceKey==='youtube_ke'||sourceKey.startsWith('youtube_ke_'))
    return method==='POST'&&
      isWk100YouTubeNativePost(sourceKey,endpoint,nativePeriodKey);
  if(sourceKey==='audiomack_ke'||sourceKey.startsWith('audiomack_ke_'))
    return method==='GET'&&nativePeriodKey===null&&
      endpoint==='https://audiomack.com/geo-charts/playlist/kenya';
  return method==='GET';
}
export function wk100EatWeekFromUtc(now){
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))fail('scheduler_clock_invalid');
  const k=new Date(now.valueOf()+3*60*60*1000);
  k.setUTCDate(k.getUTCDate()-((k.getUTCDay()+6)%7));
  return k.toISOString().slice(0,10);
}
/**
 * Sealed weekly YouTube date rollover selects only a REQUEST hypothesis.
 * The first-party weekly original must still declare this exact endDate.
 * This does not attest to source publication or native consumption bounds.
 */
export function wk100YouTubePeriodForSlot(sourceKey,entry,scheduledAt){
  if(typeof sourceKey!=='string'||!sourceKey.startsWith('youtube_ke_')||
    !entry||typeof entry!=='object'||
    !isWk100YouTubeNativePost(sourceKey,entry.endpoint,entry.native_period_key))
    return null;
  const mode=entry.native_period_rollover??null;
  if(mode!==null&&mode!=='completed_weekly_thursday_v1')return null;
  const m=/^weekly:(\d{8}):(\d{8}):ke$/.exec(entry.native_period_key);
  const day=s=>{
    const found=/^(\d{4})(\d{2})(\d{2})$/.exec(s??'');
    if(!found)return null;
    const t=Date.UTC(+found[1],+found[2]-1,+found[3]);
    return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10).replaceAll('-','')===s
      ?t:null;
  };
  const baselineEnd=day(m?.[2]);
  const at=scheduledAt instanceof Date?scheduledAt:new Date(scheduledAt);
  if(baselineEnd===null||!Number.isFinite(at.valueOf()))return null;
  // Thursday native chart end + four days = following EAT Monday.
  const anchorMonday=baselineEnd+4*86_400_000;
  const observationWeek=Date.parse(wk100EatWeekFromUtc(at)+'T00:00:00Z');
  const weeks=(observationWeek-anchorMonday)/(7*86_400_000);
  if(!Number.isInteger(weeks)||weeks<0||weeks>57)return null;
  // A pinned, non-rolling weekly key must never be reused next week.
  if(mode===null&&weeks!==0)return null;
  const targetEnd=baselineEnd+weeks*7*86_400_000;
  if(targetEnd>=at.valueOf())return null;
  const fmt=t=>new Date(t).toISOString().slice(0,10).replaceAll('-','');
  const query='weekly:'+fmt(targetEnd-6*86_400_000)+':'+fmt(targetEnd)+':ke';
  return isWk100YouTubeNativePost(sourceKey,entry.endpoint,query)?query:null;
}

export async function bindWk100DispatchAuthority({
  methodRows,manifest,sourceContracts,sha256Hex,nowUtc,constitutionVersion,
}){
  if(!Array.isArray(methodRows)||!Array.isArray(sourceContracts)||
    !manifest||typeof manifest!=='object'||!Array.isArray(manifest.sources)||
    manifest.sources.length>8||methodRows.length>100||sourceContracts.length>100||
    typeof sha256Hex!=='function'||typeof constitutionVersion!=='string'||
    !/^[a-zA-Z0-9._-]{2,100}$/.test(constitutionVersion)||
    !(nowUtc instanceof Date)||!Number.isFinite(nowUtc.valueOf()))
    fail('scheduler_authority_input_invalid');
  const keyOf=v=>String(v.source_key)+'/'+String(v.contract_version);
  const entries=new Map();
  for(const e of manifest.sources){
    if(!e||typeof e!=='object'||typeof e.source_key!=='string'||
      !IDENT.test(e.source_key)||typeof e.contract_version!=='string'||
      entries.has(keyOf(e)))fail('scheduler_manifest_ambiguous');
    entries.set(keyOf(e),e);
  }
  const contracts=new Map();
  for(const c of sourceContracts){
    if(!c||typeof c!=='object'||typeof c.source_key!=='string'||
      typeof c.contract_version!=='string'||contracts.has(keyOf(c)))
      fail('scheduler_contract_ambiguous');
    contracts.set(keyOf(c),c);
  }
  const decisions=[];
  const seen=new Set();
  for(const row of methodRows){
    if(!row||typeof row!=='object'||!IDENT.test(row.source_key)||
      typeof row.contract_version!=='string'||seen.has(keyOf(row)))
      fail('scheduler_method_rows_invalid');
    seen.add(keyOf(row));
    if(row.decision_state!=='collector_admitted'||row.constitution_version!==constitutionVersion)
      continue;
    const contract=contracts.get(keyOf(row)),entry=entries.get(keyOf(row));
    // A scheduler may plan the current EAT week only when the signed source
    // date selector is fresh. The worker repeats this with the exact slot.
    if((row.provider_key==='youtube_ke'&&
        !wk100YouTubePeriodForSlot(row.source_key,entry,nowUtc))||
       (row.provider_key!=='youtube_ke'&&entry?.native_period_rollover!=null))
      continue;
    if(!contract||!entry||entry.enabled!==true||entry.market!=='KE'||
      !isWk100FirstPartyTransport(row.source_key,entry.method,entry.endpoint,entry.native_period_key)||
      (row.provider_key==='youtube_ke'&&
        !(entry.method==='POST'&&row.method_class==='provider_api'&&
          row.native_period_state==='provider_defined'))||
      (row.provider_key==='audiomack_ke'&&
        !(entry.method==='GET'&&row.method_class==='reviewed_page_adapter'))||
      entry.purpose!=='candidate_raw_evidence'||
      contract.provider_key!==row.provider_key||
      contract.adapter_version!==row.parser_class||
      !SHA.test(contract.adapter_sha256)||!SHA.test(entry.adapter_sha256)||
      contract.adapter_sha256!==entry.adapter_sha256||
      contract.admission_state!=='candidate'||contract.market!=='KE'||
      !['provider_defined','observed_as_of'].includes(row.native_period_state)||
      (row.native_period_state==='observed_as_of'&&
        (!/^observed_as_of\/[a-z0-9][a-z0-9_.-]{2,119}$/.test(row.native_period_evidence_ref??'')||
         !['apple_ke','shazam_ke','mdundo_ke','audiomack_ke'].includes(row.provider_key)))||
      !SHA.test(row.evidence_sha256)||
      !SHA.test(row.endpoint_sha256)||typeof entry.endpoint!=='string'||
      entry.endpoint.length>1200||
      entry.parser_class!==row.parser_class||
      entry.authorization_ref!==row.authorization_ref||
      (row.native_period_state==='provider_defined' &&
        (typeof entry.native_period_key!=='string'||
         entry.native_period_key.length<3||entry.native_period_key.length>240||
         /[?&=#<>]/.test(entry.native_period_key)))||
      // The as-of evidence class MUST NOT fabricate a provider period key.
      (row.native_period_state==='observed_as_of' && entry.native_period_key!=null))
      continue;
    const expires=Date.parse(row.authorization_expires_at);
    if(!Number.isFinite(expires)||expires<=nowUtc.valueOf()||
      Date.parse(entry.authorization_expires_at)!==expires)
      continue;
    const hash=await sha256Hex(new TextEncoder().encode(entry.endpoint));
    if(hash!==row.endpoint_sha256)continue;
    decisions.push(Object.freeze({
      source_key:row.source_key,provider_key:row.provider_key,
      contract_version:row.contract_version,state:'collector_admitted',
      enabled:true,native_period_state:row.native_period_state,
      native_period_evidence_ref:row.native_period_evidence_ref,
      parser_class:row.parser_class,
      evidence_sha256:row.evidence_sha256,endpoint_sha256:row.endpoint_sha256,
      authorization_ref:row.authorization_ref,
      // SQL keeps subsecond expiries; the exact expiry was checked above.
      // Round DOWN only for the planner's strict whole-second UTC wire format.
      authorization_expires_at:new Date(expires).toISOString().replace(/\.\d{3}Z$/,'Z'),
      constitution_version:row.constitution_version,
    }));
  }
  // One provider may register many independently named sources, but there
  // must never be competing admitted contract versions for the SAME source.
  // Refuse ambiguous manifests rather than choosing newest-wins.
  const admittedSourceIds=new Set();
  for(const d of decisions){
    if(admittedSourceIds.has(d.source_key))
      fail('scheduler_multiple_admitted_contract_versions');
    admittedSourceIds.add(d.source_key);
  }
  return Object.freeze(decisions);
}

/**
 * Defense in depth for direct service-role calls to wk-chart-capture.
 * Scheduler dispatch does not grant standalone worker authority. The worker
 * must independently check the current service-only database projection
 * against the founder-approved constitution before reservation and before GET.
 *
 * Callers pass only server-held evidence; a browser cannot supply the rows.
 */
export function isWk100CaptureConstitutionCurrent({
  rows,sourceKey,contractVersion,endpointSha256,authorizationRef,
  parserClass,constitutionVersion,nowUtc,httpMethod='GET',
}){
  if(!['GET','POST'].includes(httpMethod)||!Array.isArray(rows)||rows.length>100||
    typeof sourceKey!=='string'||!IDENT.test(sourceKey)||
    typeof contractVersion!=='string'||contractVersion.length<2||
    typeof endpointSha256!=='string'||!SHA.test(endpointSha256)||
    typeof authorizationRef!=='string'||authorizationRef.length<3||
    typeof parserClass!=='string'||parserClass.length<3||
    typeof constitutionVersion!=='string'||
    !/^[a-zA-Z0-9._-]{2,100}$/.test(constitutionVersion)||
    !(nowUtc instanceof Date)||!Number.isFinite(nowUtc.valueOf()))
    return false;
  const hits=rows.filter(r=>r && typeof r==='object' &&
    r.source_key===sourceKey &&
    r.contract_version===contractVersion &&
    r.decision_state==='collector_admitted' &&
    r.constitution_version===constitutionVersion &&
    r.endpoint_sha256===endpointSha256 &&
    r.authorization_ref===authorizationRef &&
    r.parser_class===parserClass &&
    (r.provider_key==='youtube_ke'
      ? httpMethod==='POST'&&r.method_class==='provider_api'&&
        r.native_period_state==='provider_defined'
      : r.provider_key==='audiomack_ke'
        ? httpMethod==='GET'&&r.method_class==='reviewed_page_adapter'
        : httpMethod==='GET') &&
    ['provider_defined','observed_as_of'].includes(r.native_period_state) &&
    (r.native_period_state!=='observed_as_of'||
      (/^observed_as_of\/[a-z0-9][a-z0-9_.-]{2,119}$/.test(r.native_period_evidence_ref??'')&&
       /^(apple_ke|shazam_ke|mdundo_ke|audiomack_ke)_/.test(r.source_key))) &&
    typeof r.native_period_evidence_ref==='string' &&
    r.native_period_evidence_ref.length>=3 &&
    Number.isFinite(Date.parse(r.authorization_expires_at)) &&
    Date.parse(r.authorization_expires_at)>nowUtc.valueOf());
  return hits.length===1;
}
