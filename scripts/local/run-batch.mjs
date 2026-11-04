#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {REQUIRED_LOCAL_LANES,prepareReceipt} from './receipt.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
if(git('status','--porcelain'))throw Error('Commit the reviewed candidate first');
const head=git('rev-parse','HEAD'),base=git('rev-parse','origin/main');
const output=path.join(root,'artifacts/local','batch-'+Date.now());fs.mkdirSync(output,{recursive:true,mode:0o700});
const reports=()=>fs.readdirSync(path.join(root,'artifacts/local'),{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>path.join(root,'artifacts/local',d.name,'report.json')).filter(f=>fs.existsSync(f));
const state={kind:'mac-local-exact-head-batch-v1',head,base,started:new Date().toISOString(),result:'running',releaseAcceptance:'blocked',lanes:[]};
const save=()=>fs.writeFileSync(path.join(output,'batch.json'),JSON.stringify(state,null,2)+'\n',{mode:0o600});save();
for(const lane of REQUIRED_LOCAL_LANES){
 if(git('rev-parse','HEAD')!==head||git('rev-parse','origin/main')!==base||git('status','--porcelain'))throw Error('Candidate/base changed during batch');
 const before=new Set(reports());console.log('START '+lane);
 const child=spawnSync(process.execPath,['scripts/local/verify.mjs',lane],{cwd:root,env:process.env,stdio:'inherit'});
 const added=reports().filter(p=>!before.has(p));
 const match=added.filter(p=>{const d=JSON.parse(fs.readFileSync(p));return d.lane===lane&&d.head===head&&d.base===base;});
 const item={lane,exit:child.status,report:match.length===1?match[0]:null};state.lanes.push(item);save();
 if(item.report){
  const r=JSON.parse(fs.readFileSync(item.report));
  if(r.cleanup==='fail'||r.unrelated_resources_preserved===false){state.result='safety-stop';save();throw Error('Disposable cleanup/isolation needs attention');}
 }
}
if(state.lanes.some(x=>x.exit!==0||!x.report)){state.result='fail';state.finished=new Date().toISOString();save();console.error('Batch has failed/missing scopes; no receipt prepared');process.exitCode=1;}
else{
 const receipt=prepareReceipt({head,base,reportPaths:state.lanes.map(x=>x.report)});
 fs.writeFileSync(path.join(output,'unsigned-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
 state.result='pass';state.finished=new Date().toISOString();save();console.log('EXACT_HEAD_LOCAL_DEVELOPMENT_BATCH=PASS');console.log('Unsigned review package: '+output);console.log('Release remains blocked pending independent signature, enforced merge policy and production gates');
}
