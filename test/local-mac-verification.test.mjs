import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {localDisposableContext} from '../scripts/local/disposable-context.mjs';
test('all eight workflows are retired and plans match preserved commands',()=>{
 const r=spawnSync(process.execPath,['scripts/local/verify.mjs','audit'],{encoding:'utf8'});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/LOCAL_WORKFLOW_AUDIT=PASS/);
});
test('ambient local flag cannot authorize writes in a user checkout',()=>{
 const old={...process.env};
 try{process.env.WK_LOCAL_DISPOSABLE='1';process.env.WK_LOCAL_DISPOSABLE_DIR=process.cwd();delete process.env.GITHUB_ACTIONS;assert.equal(localDisposableContext(),false);}
 finally{process.env=old;}
});
test('linked or credentialed scratch trees cannot authorize disposable writes',()=>{
 const cwd=process.cwd(),old={...process.env};
 const scratch=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'wakilisha-local-test-'));
 try{
  process.chdir(scratch);process.env.WK_LOCAL_DISPOSABLE='1';process.env.WK_LOCAL_DISPOSABLE_DIR=scratch;
  for(const k of ['GITHUB_ACTIONS','SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_REF','DATABASE_URL','PGHOST'])delete process.env[k];
  assert.equal(localDisposableContext(),true);
  process.env.DATABASE_URL='postgres://invalid.invalid';assert.equal(localDisposableContext(),false);delete process.env.DATABASE_URL;
  fs.mkdirSync('supabase/.temp',{recursive:true});fs.writeFileSync('supabase/.temp/project-ref','invalid');assert.equal(localDisposableContext(),false);
 }finally{process.chdir(cwd);process.env=old;fs.rmSync(scratch,{recursive:true});}
});
test('all scopes retain real suites and explicitly block incomplete release acceptance',()=>{
 for(const lane of ['core','browser','source-preflight','mizizi-sql','mizizi-auth','wk100']){
  const r=spawnSync(process.execPath,['scripts/local/verify.mjs',lane,'--plan'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);const p=JSON.parse(r.stdout);assert.ok(p.steps.length>0);assert.equal(p.productionMutation,false);assert.ok(p.blockedReleaseGates.includes('trusted local replay provenance'));
 }
});
