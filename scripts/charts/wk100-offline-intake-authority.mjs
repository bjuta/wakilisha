import { createHash, timingSafeEqual } from 'node:crypto';

const HEX=/^[a-f0-9]{64}$/;
const sha = bytes=>createHash('sha256').update(bytes).digest('hex');
const deny = reason=>{ throw new Error('wk100_intake_'+reason); };
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
const fields=(o,names,label)=>{
 if(!plain(o)||Object.keys(o).some(k=>!names.includes(k))||names.some(k=>!Object.hasOwn(o,k)))deny(label+'_schema');
};
const equal=(a,b)=>{ const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length&&timingSafeEqual(x,y); };
function safeParse(bytes,label){
 if(!(bytes instanceof Uint8Array)||bytes.length<2||bytes.length>4194304)deny(label+'_size');
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
 catch{deny(label+'_json');}
}
function canonicalRows(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>200)deny('row_count');
 const ids=new Set();
 return rows.map((r,i)=>{
  fields(r,['recording_id','rank'],'row');
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(r.recording_id)||r.rank!==i+1||ids.has(r.recording_id))deny('row_invalid');
  ids.add(r.recording_id);
  return {recording_id:r.recording_id,rank:r.rank};
 });
}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
/**
 * Offline authority-bound observation intake: one trusted authority manifest and one
 * separately delivered provider observation file. Neither file is ever fetched by this
 * module; the caller controls private byte paths. It returns only candidate inputs.
 * Real licence provenance and MIZIZI IDs remain independently reviewable obligations.
 */
export function verifyWk100OfflineIntake({authorityBytes,authorityExpectedSha256,observationBytes,now=new Date()}){
 if(typeof authorityExpectedSha256!=='string'||!HEX.test(authorityExpectedSha256))deny('trusted_authority_digest_missing');
 if(!Number.isFinite(now.getTime()))deny('clock');
 const authority=safeParse(authorityBytes,'authority');
 if(!equal(sha(authorityBytes),authorityExpectedSha256))deny('authority_hash_mismatch');
 fields(authority,['schema_version','source_key','operator_key','market','behavior','authorized_purpose','observation_format','valid_from','valid_until','approved_by','evidence_ref'],'authority');
 if(authority.schema_version!=='wk100-offline-authority-v1'||authority.market!=='KE'||
    authority.authorized_purpose!=='candidate_evidence_only'||authority.observation_format!=='wk100-delivered-ordinal-v1'||
    !/^[a-z][a-z0-9_:-]{2,79}$/.test(authority.source_key)||
    !/^[a-z][a-z0-9_:-]{2,79}$/.test(authority.operator_key)||
    !['consumption','video_consumption','discovery','broadcast_exposure'].includes(authority.behavior)||
    typeof authority.approved_by!=='string'||authority.approved_by.length<3||
    typeof authority.evidence_ref!=='string'||authority.evidence_ref.length<3)deny('authority_invalid');
 const from=Date.parse(authority.valid_from),until=Date.parse(authority.valid_until);
 if(!Number.isFinite(from)||!Number.isFinite(until)||from>=until||now.getTime()<from||now.getTime()>=until)deny('authority_expired');
 const delivery=safeParse(observationBytes,'observation');
 fields(delivery,['schema_version','source_key','operator_key','market','behavior','native_period','entries'],'observation');
 if(delivery.schema_version!==authority.observation_format||
    delivery.source_key!==authority.source_key||delivery.operator_key!==authority.operator_key||
    delivery.market!=='KE'||delivery.behavior!==authority.behavior)deny('observation_authority_mismatch');
 fields(delivery.native_period,['starts_at','ends_at','evidence_ref'],'period');
 const start=Date.parse(delivery.native_period.starts_at),end=Date.parse(delivery.native_period.ends_at);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end||
    typeof delivery.native_period.evidence_ref!=='string'||delivery.native_period.evidence_ref.length<3)deny('native_period_invalid');
 const entries=canonicalRows(delivery.entries);
 return Object.freeze({
  source_key:authority.source_key,operator_key:authority.operator_key,
  behavior:authority.behavior,market:'KE',expected_depth:entries.length,
  native_period:structuredClone(delivery.native_period),authority_ref:authority.evidence_ref,
  admission:'approved',raw_sha256:sha(observationBytes),entries,
  independently_verified:{original_bytes_sha256:true,authority_manifest_sha256:true,
    provider_origin:false,legal_grant:false,registry_identity:false}
 });
}
