#!/usr/bin/env node
// Offline verification only. The trusted operator's private signing key is never
// generated, read or stored here. This is not a GitHub check or deployment permit.
import fs from 'node:fs';
import path from 'node:path';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const REQUIRED_LOCAL_LANES=Object.freeze(['core','browser','source-preflight','mizizi-sql','mizizi-auth','wk100','public-runtime']);
const sha=x=>createHash('sha256').update(x).digest('hex');
const hex40=x=>/^[0-9a-f]{40}$/.test(x??'');
const hex64=x=>/^[0-9a-f]{64}$/.test(x??'');
export function validateReceipt({bytes,signature,publicKeyPem,trustedKeySha256,expectedHead,expectedBase}){
 const errors=[];let receipt;
 try{receipt=JSON.parse(bytes.toString('utf8'));}catch{return ['Invalid receipt JSON'];}
 if(!hex40(expectedHead)||!hex40(expectedBase)||receipt.head!==expectedHead||receipt.base!==expectedBase)errors.push('Candidate or base is missing/stale');
 if(receipt.kind!=='mac-local-development-acceptance-v1'||receipt.githubHostedCheck!==false||receipt.productionDeploymentAuthorized!==false)errors.push('Wrong receipt authority');
 if(!hex64(trustedKeySha256))errors.push('Independent trusted key fingerprint is required');
 try{
  const key=createPublicKey(publicKeyPem);
  const fingerprint=sha(key.export({type:'spki',format:'der'}));
  if(key.asymmetricKeyType!=='ed25519'||fingerprint!==trustedKeySha256)errors.push('Signing key is not independently pinned');
  if(!signature||!verify(null,bytes,key,signature))errors.push('Independent operator signature is missing/invalid');
 }catch{errors.push('Invalid trusted key/signature');}
 if(!hex64(receipt.planSha256))errors.push('Missing command plan digest');
 const lanes=receipt.lanes??[];
 if(lanes.length!==REQUIRED_LOCAL_LANES.length||new Set(lanes.map(x=>x.lane)).size!==lanes.length)errors.push('Missing, duplicate or extra acceptance scope');
 for(const lane of REQUIRED_LOCAL_LANES){
  const r=lanes.find(x=>x.lane===lane);
  if(!r||r.result!=='pass'||r.head!==expectedHead||r.base!==expectedBase||r.planSha256!==receipt.planSha256||!hex64(r.reportSha256)||!hex64(r.bundleSha256)||(!Number.isInteger(r.stepCount)||r.stepCount<1)||r.nonzeroSteps!==0)errors.push('Incomplete/stale/failed scope: '+lane);
  if(['mizizi-sql','mizizi-auth','wk100'].includes(lane)&&(r?.cleanup!=='pass'||r?.unrelatedResourcesPreserved!==true))errors.push('Unproven disposable cleanup/isolation: '+lane);
 }
 if(receipt.constraints?.liveSchemaDriftRequiresSeparateEvidence!==true||receipt.constraints?.productionPreflightsRequireSeparateAuthorization!==true||receipt.constraints?.enforcedMergePolicyRequiresSeparateEvidence!==true)errors.push('Release safety constraints missing');
 return errors;
}
export function prepareReceipt({head,base,reportPaths}){
 if(!hex40(head)||!hex40(base))throw Error('Exact candidate and base required');
 let planSha256;
 const lanes=reportPaths.map(reportPath=>{
  const bytes=fs.readFileSync(reportPath),r=JSON.parse(bytes);
  if(r.kind!=='mac-local-verification-v1'||r.head!==head||r.base!==base||r.result!=='pass'||!r.finished)throw Error('Report is not successful exact-head/base evidence: '+r.lane);
  if(!planSha256)planSha256=r.plan_sha256;
  if(r.plan_sha256!==planSha256)throw Error('Mixed command plans');
  if(!Array.isArray(r.steps)||!r.steps.length||r.steps.some(s=>s.exit!==0))throw Error('Incomplete/failed step evidence');
  for(const [i,step] of r.steps.entries())if(sha(fs.readFileSync(path.join(path.dirname(reportPath),i+'.log')))!==step.log_sha256)throw Error('Step log changed');
  if(!Array.isArray(r.files)||!r.files.length)throw Error('Evidence inventory missing');
  for(const f of r.files){
   if(path.isAbsolute(f.path)||f.path.split(/[\\/]/).includes('..'))throw Error('Evidence path escapes bundle');
   const evidencePath=path.join(path.dirname(reportPath),f.path);
   if(!fs.realpathSync(evidencePath).startsWith(fs.realpathSync(path.dirname(reportPath))+path.sep)||!fs.statSync(evidencePath).isFile())throw Error('Evidence is not a file inside the bundle');
   if(sha(fs.readFileSync(evidencePath))!==f.sha256)throw Error('Evidence file changed');
  }
  return {lane:r.lane,result:r.result,head:r.head,base:r.base,planSha256:r.plan_sha256,reportSha256:sha(bytes),bundleSha256:sha(JSON.stringify(r.files)),stepCount:r.steps.length,nonzeroSteps:r.steps.filter(s=>s.exit!==0).length,cleanup:r.cleanup,unrelatedResourcesPreserved:r.unrelated_resources_preserved};
 });
 if(lanes.length!==REQUIRED_LOCAL_LANES.length||REQUIRED_LOCAL_LANES.some(l=>lanes.filter(x=>x.lane===l).length!==1))throw Error('All seven distinct real acceptance scopes are required');
 return {kind:'mac-local-development-acceptance-v1',head,base,planSha256,githubHostedCheck:false,productionDeploymentAuthorized:false,lanes:lanes.sort((a,b)=>a.lane.localeCompare(b.lane)),constraints:{liveSchemaDriftRequiresSeparateEvidence:true,productionPreflightsRequireSeparateAuthorization:true,enforcedMergePolicyRequiresSeparateEvidence:true}};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [mode,...args]=process.argv.slice(2);
  if(mode==='prepare'){
   const [head,base,out,...reportPaths]=args;
   const receipt=prepareReceipt({head,base,reportPaths});
   fs.writeFileSync(out,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});console.log('Unsigned review package prepared; no acceptance or deployment authority granted');
  }else if(mode==='verify'){
   const [receiptFile,signatureFile,keyFile,expectedHead,expectedBase]=args;
   const errors=validateReceipt({bytes:fs.readFileSync(receiptFile),signature:fs.readFileSync(signatureFile),publicKeyPem:fs.readFileSync(keyFile),trustedKeySha256:process.env.WK_TRUSTED_OPERATOR_KEY_SHA256,expectedHead,expectedBase});
   if(errors.length)throw Error(errors.join('; '));
   console.log('Independent local development receipt verified; deployment, live-schema and merge-policy gates remain separate');
  }else throw Error('Use prepare HEAD BASE OUT REPORT... or verify RECEIPT SIGNATURE TRUSTED_PUBLIC_KEY HEAD BASE');
 }catch(e){console.error('STOP: '+e.message);process.exitCode=1;}
}
