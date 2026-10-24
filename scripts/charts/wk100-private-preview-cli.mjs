#!/usr/bin/env node
// Local offline WK100 preview; both input and audit stay outside the PUBLIC repository.
import { readFile, stat, lstat, realpath, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWk100PrivatePreview,previewInputDigest } from './wk100-private-preview.mjs';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const insideRepo=path=>{const rel=relative(repoRoot,path);return !rel.startsWith('..')&&!isAbsolute(rel);};
async function main(args) {
  if(args.length!==4||args[0]!=='--input'||args[2]!=='--output-dir')
    throw new Error('usage: node scripts/charts/wk100-private-preview-cli.mjs --input /private/input.json --output-dir /private/NEW-directory');
  const input=resolve(args[1]),out=resolve(args[3]);
  if(insideRepo(out)||insideRepo(input)) throw new Error('wk100_preview_private_paths_must_be_outside_public_repository');
  // Resolve symlinks before validating that neither private input nor output enters the public repository.
  const inputReal=await realpath(input);
  const parentReal=await realpath(dirname(out));
  if(insideRepo(inputReal)||insideRepo(parentReal)) throw new Error('wk100_preview_private_paths_must_be_outside_public_repository');
  const inputLink=await lstat(input);
  if(inputLink.isSymbolicLink()) throw new Error('wk100_preview_input_symlink_forbidden');
  const metadata=await stat(input);
  if(!metadata.isFile()||metadata.size>4_194_304||metadata.size<2) throw new Error('wk100_preview_input_size');
  if(process.platform!=='win32'&&(metadata.mode&0o077)!==0) throw new Error('wk100_preview_input_permissions_require_0600');
  const bytes=await readFile(input),obj=JSON.parse(bytes.toString('utf8'));
  const {privateAudit,publicSummary}=buildWk100PrivatePreview(obj,previewInputDigest(bytes));
  if(process.platform!=='win32' && (((await stat(parentReal)).mode & 0o002)!==0)) throw new Error('wk100_preview_world_writable_output_parent');
  // Exclusive directory creation, never overwrite a prior confidential audit.
  await mkdir(out,{mode:0o700});
  try{
    await writeFile(resolve(out,'private-audit.json'),JSON.stringify(privateAudit,null,2)+'\n',{flag:'wx',mode:0o600});
    await writeFile(resolve(out,'public-methodology-summary.json'),JSON.stringify(publicSummary,null,2)+'\n',{flag:'wx',mode:0o600});
  }catch(error){await rm(out,{recursive:true,force:true});throw error;}
  process.stdout.write('WK100_PRIVATE_PREVIEW_WRITTEN=PASS\nWK100_CAN_PUBLISH=false\n');
}
main(process.argv.slice(2)).catch(error=>{process.stderr.write(`${error?.message??'wk100_preview_failed'}\n`);process.exitCode=1;});
