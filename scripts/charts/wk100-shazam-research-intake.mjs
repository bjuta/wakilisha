#!/usr/bin/env node
/** Locally archive an already-downloaded, publicly offered Shazam Kenya CSV. */
import { readFile, lstat } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { archiveShazamResearchEvidence } from './wk100-shazam-research-evidence.mjs';

async function main(){
  const opts={};
  const argv=process.argv.slice(2);
  if(argv.length!==10)throw new Error('usage: --csv ABS_PATH --archive-dir ABS_PATH --source-url URL --observed-at UTC --operator-ref PRIVATE_ID');
  for(let i=0;i<argv.length;i+=2){
    if(!['--csv','--archive-dir','--source-url','--observed-at','--operator-ref'].includes(argv[i])||
      !argv[i+1]||Object.hasOwn(opts,argv[i]))throw new Error('invalid_options');
    opts[argv[i]]=argv[i+1];
  }
  const path=opts['--csv'];
  if(!isAbsolute(path))throw new Error('csv_path_not_absolute');
  const st=await lstat(resolve(path));
  if(!st.isFile()||st.isSymbolicLink()||st.size<1||st.size>4_194_304)throw new Error('csv_file_invalid');
  const raw=await readFile(path);
  const result=await archiveShazamResearchEvidence({csvBytes:raw,
    source_url:opts['--source-url'],observed_at:opts['--observed-at'],
    operator_ref:opts['--operator-ref'],archive_dir:opts['--archive-dir']});
  // Never print the original chart, operator secret, filesystem paths, Registry IDs or titles.
  process.stdout.write(`WK100_SHAZAM_RESEARCH_ARCHIVE=PASS\nRAW_SHA256=${result.raw_sha256}\nOBSERVED_ROWS=${result.receipt.observed_depth}\nPRIVATE_FILES=3\nNATIVE_PERIOD=UNVERIFIED\nREGISTRY_IDENTITIES=UNRESOLVED\nCAN_PUBLISH=FALSE\n`);
}
main().catch(e=>{process.stderr.write(`WK100_SHAZAM_RESEARCH_ARCHIVE=FAIL\nREASON=${String(e.message).replace(/[^a-zA-Z0-9_:.-]/g,'_').slice(0,100)}\n`);process.exitCode=1;});