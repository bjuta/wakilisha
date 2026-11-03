/**
 * Pure service-side bridge from immutable database admission to candidate
 * scheduler eligibility. No browser/CLI payload can create this authority.
 * A provider method decision, a matching capture contract, a SHA-sealed
 * server manifest and an explicitly selected constitution must all agree.
 */
const SHA=/^[0-9a-f]{64}$/;
const IDENT=/^[a-z][a-z0-9_]{2,63}$/;
function fail(code){throw new Error(code);}
export function wk100EatWeekFromUtc(now){
  if(!(now instanceof Date)||!Number.isFinite(now.valueOf()))fail('scheduler_clock_invalid');
  const k=new Date(now.valueOf()+3*60*60*1000);
  k.setUTCDate(k.getUTCDate()-((k.getUTCDay()+6)%7));
  return k.toISOString().slice(0,10);
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
    if(!contract||!entry||entry.enabled!==true||entry.market!=='KE'||
      entry.method!=='GET'||entry.purpose!=='candidate_raw_evidence'||
      contract.provider_key!==row.provider_key||
      contract.adapter_version!==row.parser_class||
      contract.admission_state!=='candidate'||contract.market!=='KE'||
      row.native_period_state!=='provider_defined'||!SHA.test(row.evidence_sha256)||
      !SHA.test(row.endpoint_sha256)||typeof entry.endpoint!=='string'||
      entry.endpoint.length>1200||
      entry.parser_class!==row.parser_class||
      entry.authorization_ref!==row.authorization_ref||
      typeof entry.native_period_key!=='string'||
      entry.native_period_key.length<3||entry.native_period_key.length>240||
      /[?&=#<>]/.test(entry.native_period_key))
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
      authorization_expires_at:new Date(expires).toISOString().replace('.000Z','Z'),
      constitution_version:row.constitution_version,
    }));
  }
  return Object.freeze(decisions);
}
