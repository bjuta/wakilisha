#!/usr/bin/env node
/**
 * WAKILISHA: bounded offline Article publication onto the accepted static
 * frontend, without a live metadata Edge endpoint or an all-Registry scan.
 *
 * The sole live source is a single read-only SQL statement executed twice
 * as the managed Supabase read-only role. All mutation is to a local candidate
 * `dist` tree. This tool NEVER modifies production or the source database.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE='https://wakilisha.africa';
const PROJECT='pgzizndxdyhqmtyywjmt';
const ROLE='supabase_read_only_user';
const PROTOCOL='wakilisha-public-article-read-v1';
const MAX_ARTICLES=500;
const HEX=/^[a-f0-9]{64}$/;
const INDEX='wakilisha-accepted-prerender-index.json';
const ARTICLE=/^\/magazine\/[a-z0-9]+(?:[-_][a-z0-9]+)*$/;
function fail(message){throw Error('[article-publication] '+message);}
function sha(data){return crypto.createHash('sha256').update(data).digest('hex');}
function stable(v){if(v===null||typeof v==='boolean'||typeof v==='number'||typeof v==='string')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
 if(v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype)return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
 fail('Noncanonical JSON data');}
function absolute(file, label){if(typeof file!=='string'||!path.isAbsolute(file))fail(label+' requires an absolute path');return file;}
function fileAt(dir,filename){const file=path.join(dir,filename);const stat=fs.lstatSync(file,{throwIfNoEntry:false});if(!stat?.isFile()||stat.isSymbolicLink())fail('Missing or unsafe file: '+filename);return file;}
function pinnedJson(filename,expected,label,maxSize=2_000_000){absolute(filename,label);if(!HEX.test(expected||''))fail('Independent SHA-256 required: '+label);const st=fs.lstatSync(filename,{throwIfNoEntry:false});if(!st?.isFile()||st.isSymbolicLink()||st.size>maxSize)fail('Missing or oversized '+label);const bytes=fs.readFileSync(filename);if(sha(bytes)!==expected)fail('SHA-256 mismatch: '+label);try{return JSON.parse(bytes.toString('utf8'));}catch{fail('Bad JSON: '+label);}}
function validUrl(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}}
function ts(raw,label){if(typeof raw!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(raw)||!Number.isFinite(Date.parse(raw)))fail('Invalid timestamp '+label);return Date.parse(raw);}
function unwrap(obj){if(obj&&typeof obj==='object'&&!Array.isArray(obj)&&Array.isArray(obj.result))obj=obj.result;
 if(Array.isArray(obj)){if(obj.length!==1)fail('Expected single SQL response');obj=obj[0];}
 if(obj?.evidence)obj=obj.evidence;
 if(typeof obj==='string'){try{obj=JSON.parse(obj);}catch{fail('Invalid SQL JSON wrapper');}}
 return obj;}
function validateCapture(original){const v=unwrap(original);
 if(!v||typeof v!=='object'||v.protocol!==PROTOCOL||v.projectRef!==PROJECT||v.role!==ROLE||v.transactionReadOnly!=='on'||v.count<1||v.count>MAX_ARTICLES||!Number.isSafeInteger(v.count)||!Array.isArray(v.articles)||v.articles.length!==v.count||!Array.isArray(v.overrides)||v.overrides.length>500)fail('Incomplete or unauthorised published Article source');
 ts(v.capturedAt,'capturedAt');
 const seen=new Set();
 for(const article of v.articles){const route='/magazine/'+article?.slug;
  if(!ARTICLE.test(route)||seen.has(route)||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(String(article.id||''))||typeof article.title!=='string'||!article.title.trim()||!article.author?.trim()||!article.publishedAt||!Number.isFinite(Date.parse(article.publishedAt))|| (article.heroUrl&&!validUrl(article.heroUrl)))fail('Invalid or duplicate published Article: '+route);
  seen.add(route);
 }
 const keys=new Set();
 for(const override of v.overrides){let route=override?.targetUrl;
  if(typeof route!=='string')fail('Invalid override target');
  if(route.startsWith(SITE))route=route.slice(SITE.length);
  route=route.replace(/\/$/,'');
  if(!ARTICLE.test(route)||keys.has(route))fail('Ambiguous or non-Article active SEO override: '+route);
  keys.add(route);
 }
 return v;
}
function sql(){return `/* WAKILISHA Article-only governed publication source: one read-only SELECT.
   Approved execution: Supabase CLI v3 db query --read-only --remote=${PROJECT}.
   No editor rows, scheduled-publication RPCs, Registry fanout or writes. */
WITH articles AS MATERIALIZED (
 SELECT id::text AS id,slug,title,author,
        coalesce(excerpt,'') AS excerpt,
        coalesce(seo,'{}'::jsonb) AS seo,
        coalesce(hero_image_url,'') AS hero_url,
        to_char(published_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS published_at,
        to_char(coalesce(modified_at,published_at) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS modified_at
 FROM public.wk_article_publication_snapshots
 WHERE is_active = true AND wp_status = 'publish'
 ORDER BY slug,id LIMIT ${MAX_ARTICLES+1}
), overrides AS MATERIALIZED (
 SELECT target_url,title,description,social_title,social_description,applied_at,updated_at
 FROM public.seo_content_overrides
 WHERE status='active' AND (target_url LIKE '/magazine/%' OR target_url LIKE '${SITE}/magazine/%')
 ORDER BY target_url LIMIT 501
)
SELECT jsonb_build_object(
 'protocol','${PROTOCOL}',
 'projectRef','${PROJECT}',
 'role',current_user,
 'transactionReadOnly',current_setting('transaction_read_only'),
 'capturedAt',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
 'count',(SELECT count(*)::int FROM articles),
 'articles',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'id',id,'slug',slug,'title',title,'author',author,'excerpt',excerpt,
    'seo',seo,'heroUrl',hero_url,'publishedAt',published_at,'modifiedAt',modified_at
 ) ORDER BY slug,id) FROM articles),'[]'::jsonb),
 'overrides',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'targetUrl',target_url,'title',title,'description',description,
    'socialTitle',social_title,'socialDescription',social_description,
    'appliedAt',applied_at,'updatedAt',updated_at
 ) ORDER BY target_url) FROM overrides),'[]'::jsonb)
) AS evidence;
`;}
function verifySourcePair(first,second){const a=validateCapture(first),b=validateCapture(second);
 const duration=ts(b.capturedAt,'second')-ts(a.capturedAt,'first');
 if(duration<0||duration>15*60*1000)fail('Source replays outside 15-minute window');
 const payload=x=>({articles:x.articles,overrides:x.overrides,count:x.count});
 const ah=sha(stable(payload(a))),bh=sha(stable(payload(b)));
 if(ah!==bh)fail('Article source changed during read-only replay; recapture');
 return {capture:b,sourceEpoch:bh};
}
function validateSnapshot(dir,pin){absolute(dir,'accepted snapshot');
 if(!HEX.test(pin||''))fail('Accepted snapshot index requires independently approved hash');
 const real=fs.realpathSync(dir),indexFile=fileAt(real,INDEX);
 if(sha(fs.readFileSync(indexFile))!==pin)fail('Accepted source inventory pin mismatch');
 const index=JSON.parse(fs.readFileSync(indexFile,'utf8'));
 if(index.format!==1||!index.files||Object.keys(index.files).length<3000)fail('Accepted source inventory incomplete');
 const entries=Object.keys(index.files);
 for(const name of entries){if(!name||name.startsWith('/')||name.includes('..')||name.includes('\\')||!HEX.test(index.files[name]))fail('Unsafe source snapshot index');
  if(sha(fs.readFileSync(fileAt(real,name)))!==index.files[name])fail('Accepted HTML snapshot tampered: '+name);
 }
 for(const req of ['index.html','seo-metadata-manifest.json','sitemap.xml','public-magazine-fallback.json'])if(!entries.includes(req))fail('Accepted source missing '+req);
 return real;
}
function makeArticleMetadata(capture, baseline){const next={...baseline};const articles=new Set();
 const overrides=new Map(capture.overrides.map(row=>[String(row.targetUrl).replace(SITE,'').replace(/\/$/,''),row]));
 for(const a of capture.articles){const route='/magazine/'+a.slug;articles.add(route);
  const meta=a.seo&&typeof a.seo==='object'&&!Array.isArray(a.seo)?a.seo:{};
  const seoOverride=overrides.get(route);
  const title=String(seoOverride?.title||a.title).trim();
  const description=String(seoOverride?.description||meta.description||a.excerpt||'').trim();
  const image=String(a.heroUrl||'');
  next[route]={title,entityName:a.title,description,
    ...(seoOverride?.socialTitle||meta.title?{socialTitle:String(seoOverride?.socialTitle||meta.title)}:{}),
    ...(seoOverride?.socialDescription?{socialDescription:String(seoOverride.socialDescription)}:{}),
    robots:'index, follow',ogType:'article',kind:'article',image:image||null,
    publishedAt:a.publishedAt,modifiedAt:a.modifiedAt,
    sourceTable:'wk_article_publication_snapshots',sourceId:a.id};
 }
 const retired=[];
 for(const [route,entry] of Object.entries(baseline)){
  if(route.startsWith('/magazine/')&&(entry?.sourceTable==='wk_article_publication_snapshots'||entry?.sourceTable==='wk_articles'||entry?.kind==='article')&&!articles.has(route))retired.push(route);
 }
 for(const route of retired)delete next[route];
 return {metadata:next,retired};
}
function readonlyCopy(src,dest){if(fs.existsSync(dest))fail('Candidate output already exists');
 const copy=(a,b)=>{const st=fs.lstatSync(a);if(st.isSymbolicLink())fail('Symlink in baseline snapshot');if(st.isDirectory()){fs.mkdirSync(b,{mode:0o700});for(const entry of fs.readdirSync(a))if(entry!==INDEX)copy(path.join(a,entry),path.join(b,entry));}else if(st.isFile()){fs.copyFileSync(a,b,fs.constants.COPYFILE_EXCL);}else fail('Unexpected snapshot node');};
 copy(src,dest);
}
function inspectArticleHtml(html,route,entry){const canonical=SITE+route;
 if(!html.includes('<meta property="og:type" content="article"')||!html.includes('href="'+canonical+'"')||!html.includes('content="'+canonical+'"'))fail('Wrong Article HTML canonical/OG: '+route);
 if(entry.image && (!html.includes('property="og:image" content="'+entry.image+'"')||!html.includes('name="twitter:image" content="'+entry.image+'"')))fail('Published image not present in prerendered HTML: '+route);
 if(!html.includes('id="wk-jsonld-primary"'))fail('Article structured data missing: '+route);
}
function run(cmd,args,options={}){const r=spawnSync(cmd,args,{stdio:'inherit',...options});if(r.status!==0)fail('Subcommand failed: '+cmd+' '+args.join(' '));}
async function assemble({first,second,acceptedDir,acceptedSha,outputDir,sourcePins}){
 const {capture,sourceEpoch}=verifySourcePair(first,second);
 const baseline=validateSnapshot(acceptedDir,acceptedSha);
 const dest=absolute(outputDir,'candidate');
 if(path.basename(dest)!=='dist')fail('Candidate must be a fresh dist folder for canonical SEO tooling');
 if(dest===baseline||dest.startsWith(baseline+path.sep)||baseline.startsWith(dest+path.sep))fail('Candidate and baseline roots overlap');
 const rawMetadata=JSON.parse(fs.readFileSync(fileAt(baseline,'seo-metadata-manifest.json'),'utf8'));
 const {metadata,retired}=makeArticleMetadata(capture,rawMetadata);
 // A withdrawn Article must not fall back to the SPA and return a false HTTP 200.
 // Until a verified 410/308 origin rule is accepted, refuse its activation.
 if(retired.length)fail('Unpublished Article routes require accepted Nginx 410/308 authority before activation: '+retired.slice(0,4).join(', '));
 readonlyCopy(baseline,dest);
 const {activateGovernedOfflineProjection,htmlForPath}=await import('./prerender-metadata.mjs');
 const stories=capture.articles.map(a=>({id:a.id,slug:a.slug,title:a.title,author:a.author,
  dek:String(a.seo?.description||a.excerpt||''),date:a.publishedAt,modifiedAt:a.modifiedAt,heroUrl:a.heroUrl}));
 const projection={format:1,origin:SITE,complete:true,capturedAt:capture.capturedAt,
   sourceEpoch,sourceScanSha256:sourcePins[1],metadata,articles:stories,
   artists:{},releases:{},tracks:{},charts:{},nonCanonicalPaths:[],publicationActivationAuthority:false};
 activateGovernedOfflineProjection(projection);
 const baseHtml=fs.readFileSync(fileAt(baseline,'index.html'),'utf8');
 let newCount=0,changedCount=0;
 for(const a of capture.articles){const route='/magazine/'+a.slug;
  const oldFile=path.join(baseline,'magazine',a.slug,'index.html');
  const oldHtml=fs.existsSync(oldFile)?fs.readFileSync(oldFile,'utf8'):null;
  const html=htmlForPath(baseHtml,route);
  inspectArticleHtml(html,route,metadata[route]);
  const file=path.join(dest,'magazine',a.slug,'index.html');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,html,{mode:0o600});
  if(!oldHtml)newCount++;else if(oldHtml!==html)changedCount++;
 }
 fs.writeFileSync(path.join(dest,'seo-metadata-manifest.json'),JSON.stringify(metadata,null,2)+'\n',{mode:0o600});
 const projectionFile=dest+'.article-source.json';
 fs.writeFileSync(projectionFile,JSON.stringify(projection,null,2)+'\n',{flag:'wx',mode:0o600});
 const environment={...process.env,
  WAKILISHA_GOVERNED_SEO_PROJECTION:projectionFile,
  WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256:sha(fs.readFileSync(projectionFile)),
  WAKILISHA_APPROVED_SOURCE_EPOCH:sourceEpoch,
  WAKILISHA_APPROVED_SOURCE_SCAN_SHA256:sourcePins[1]};
 run(process.execPath,['scripts/seo/build-public-magazine-fallback.mjs','--governed-offline'],{cwd:ROOT,env:environment});
 run(process.execPath,['scripts/seo/build-public-sitemap-html.mjs'],{cwd:ROOT,env:environment});
 run(process.execPath,['scripts/seo/audit-prerender-output.mjs'],{cwd:ROOT,env:environment});
 const firstArticle=capture.articles.find(a=>a.slug==='album-review-alusa-continua');
 if(firstArticle){const h=fs.readFileSync(fileAt(dest,'magazine/album-review-alusa-continua/index.html'),'utf8');
  inspectArticleHtml(h,'/magazine/album-review-alusa-continua',metadata['/magazine/album-review-alusa-continua']);}
 const entries={};
 const walker=(dir,relative='')=>{for(const item of fs.readdirSync(dir,{withFileTypes:true})){if(item.isSymbolicLink())fail('Output symlink not allowed');const p=relative?relative+'/'+item.name:item.name;
  if(item.isDirectory())walker(path.join(dir,item.name),p);else if(item.isFile()){
    if(p==='index.html'||p.endsWith('/index.html')||['seo-metadata-manifest.json','public-magazine-fallback.json','sitemap.xml'].includes(p))
      entries[p]=sha(fs.readFileSync(path.join(dir,item.name)));
  }else fail('Unsupported candidate entry');}};
 walker(dest);
 const indexContents=JSON.stringify({format:1,files:Object.fromEntries(Object.entries(entries).sort(([a],[b])=>a<b?-1:a>b?1:0))},null,2)+'\n';
 fs.writeFileSync(path.join(dest,INDEX),indexContents,{flag:'wx',mode:0o600});
 const receipt={format:1,kind:'wakilisha-governed-article-candidate',origin:SITE,
  sourceEpoch,sourceReplaySha256:sourcePins,acceptedBaselineIndexSha256:acceptedSha,
  candidateIndexSha256:sha(indexContents),capturedAt:capture.capturedAt,
  publishedArticles:capture.articles.length,newArticles:newCount,changedArticles:changedCount,
  retirementCount:retired.length,activationAuthority:false};
 const receiptFile=dest+'.article-publication-receipt.json';
 fs.writeFileSync(receiptFile,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('ARTICLE_PUBLICATION_CANDIDATE_SHA256='+receipt.candidateIndexSha256);
 console.log('ARTICLE_PUBLICATION_RECEIPT_SHA256='+sha(fs.readFileSync(receiptFile)));
 console.log('ARTICLE_PUBLISHED_COUNT='+capture.articles.length);
 console.log('ARTICLE_NEW_ROUTES='+newCount);
 console.log('ARTICLE_CORRECTED_ROUTES='+changedCount);
 console.log('ARTICLE_SOURCE_EPOCH='+sourceEpoch);
 console.log('ARTICLE_SOURCE_HTTP_CALLS=0');
 console.log('ARTICLE_SOURCE_DB_READS_BY_PUBLISHER=0');
 console.log('PUBLICATION_ACTIVATION_AUTHORITY=NONE');
 return receipt;
}
async function main(){const args=process.argv.slice(2);
 if(args[0]==='--emit-sql'&&args.length===2){const f=absolute(args[1],'SQL');if(fs.existsSync(f)||path.extname(f)!=='.sql')fail('Fresh absolute .sql output required');const s=sql();fs.writeFileSync(f,s,{flag:'wx',mode:0o600});console.log('ARTICLE_READONLY_SQL_SHA256='+sha(s));console.log('ARTICLE_READONLY_SQL_STATEMENTS=1');return;}
 if(args[0]==='--assemble'&&args.length===5){const pins=[process.env.WAKILISHA_ARTICLE_SOURCE_FIRST_SHA256,process.env.WAKILISHA_ARTICLE_SOURCE_SECOND_SHA256];
  const first=pinnedJson(args[1],pins[0],'first source');const second=pinnedJson(args[2],pins[1],'second source');
  await assemble({first,second,acceptedDir:args[3],acceptedSha:process.env.WAKILISHA_ACCEPTED_PRERENDER_SHA256,outputDir:args[4],sourcePins:pins});return;}
 fail('Use --emit-sql /absolute/query.sql or --assemble FIRST_CAPTURE SECOND_CAPTURE ACCEPTED_DIR /absolute/path/dist');}
export {sql,unwrap,validateCapture,verifySourcePair,makeArticleMetadata,validateSnapshot,inspectArticleHtml,assemble};
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e);process.exitCode=1;});