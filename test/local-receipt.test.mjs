import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {REQUIRED_LOCAL_LANES,validateReceipt} from '../scripts/local/receipt.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('independent pinned operator signature binds complete exact-head development evidence',()=>{
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 const other=generateKeyPairSync('ed25519');
 const head='a'.repeat(40),base='b'.repeat(40),plan='c'.repeat(64);
 const payload={kind:'mac-local-development-acceptance-v1',head,base,planSha256:plan,githubHostedCheck:false,productionDeploymentAuthorized:false,
  lanes:REQUIRED_LOCAL_LANES.map(lane=>({lane,result:'pass',head,base,planSha256:plan,reportSha256:'d'.repeat(64),bundleSha256:'e'.repeat(64),stepCount:2,nonzeroSteps:0,cleanup:'pass',unrelatedResourcesPreserved:true})),
  constraints:{liveSchemaDriftRequiresSeparateEvidence:true,productionPreflightsRequireSeparateAuthorization:true,enforcedMergePolicyRequiresSeparateEvidence:true}};
 const pin=sha(publicKey.export({type:'spki',format:'der'}));
 const check=(data=payload,extra={})=>{const bytes=Buffer.from(JSON.stringify(data));return validateReceipt({bytes,signature:sign(null,bytes,privateKey),publicKeyPem:publicKey.export({type:'spki',format:'pem'}),trustedKeySha256:pin,expectedHead:head,expectedBase:base,...extra});};
 assert.deepEqual(check(),[]);
 assert.ok(check(payload,{signature:undefined}).includes('Independent operator signature is missing/invalid'));
 assert.ok(check(payload,{trustedKeySha256:undefined}).includes('Independent trusted key fingerprint is required'));
 assert.ok(check(payload,{publicKeyPem:other.publicKey.export({type:'spki',format:'pem'})}).includes('Signing key is not independently pinned'));
 assert.ok(check(payload,{expectedHead:'f'.repeat(40)}).includes('Candidate or base is missing/stale'));
 assert.ok(check(payload,{expectedBase:'f'.repeat(40)}).includes('Candidate or base is missing/stale'));
 assert.ok(check({...payload,lanes:payload.lanes.slice(1)}).includes('Missing, duplicate or extra acceptance scope'));
 assert.ok(check({...payload,lanes:payload.lanes.map(x=>x.lane==='wk100'?{...x,cleanup:'fail'}:x)}).includes('Unproven disposable cleanup/isolation: wk100'));
 assert.ok(check({...payload,productionDeploymentAuthorized:true}).includes('Wrong receipt authority'));
 const bytes=Buffer.from(JSON.stringify(payload)),signature=sign(null,bytes,privateKey);
 assert.ok(validateReceipt({bytes:Buffer.from(JSON.stringify({...payload,head:'f'.repeat(40)})),signature,publicKeyPem:publicKey.export({type:'spki',format:'pem'}),trustedKeySha256:pin,expectedHead:head,expectedBase:base}).includes('Independent operator signature is missing/invalid'));
});
