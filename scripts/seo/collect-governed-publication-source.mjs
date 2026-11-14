#!/usr/bin/env node
// Authority-bounded OUT-OF-BAND source evidence collector, not a publisher.
// No invocation from npm run build, browser code, Supabase Edge or CI.
// Captures a REPEATABLE READ, READ ONLY SQL snapshot, returning digests only.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://wakilisha.africa';
const PROJECT = 'pgzizndxdyhqmtyywjmt';
const PAGE_SIZE = 250;
const MAX_ROWS_PER_TABLE = 20_000;
const MAX_ROWS_TOTAL = 100_000;
const MAX_QUERIES = 600;
const MAX_ELAPSED_MS = 90_000;
const SURFACES = Object.freeze([
  'static', 'magazine', 'artists', 'releases', 'tracks', 'genres',
  'labels', 'guides', 'briefings', 'charts', 'playlists', 'people',
  'organizations', 'taxonomy', 'authors',
]);

// Exact current authoritative source classes. Include both published and
// nonpublished rows: loss of publication is itself a material mutation.
// The output is hashes only; no body, emails, preview tokens, or secrets.
const DEFINITIONS = Object.freeze([
  { name:'articles', schema:'public', table:'wk_articles', key:['id'], columns:['id','slug','title','excerpt','content_html','author','published_at','modified_at','categories','tags','seo','wp_status','updated_at','hero_image_url','hero_image_id','draft_version'], surfaces:['magazine','taxonomy','authors','briefings','people','organizations'] },
  { name:'artists', schema:'public', table:'registry_artists', key:['id'], columns:['id','slug','display_name','bio','artist_type','public_image_url','public_image_id','status','metadata','updated_at','living_memory_status','living_memory_updated_at'], surfaces:['artists','people'] },
  { name:'releases', schema:'public', table:'registry_releases', key:['id'], columns:['id','slug','title','release_type','release_date','label_id','artwork_url','artwork_image_id','description','status','metadata','updated_at','living_memory_status','living_memory_updated_at'], surfaces:['releases','tracks','artists'] },
  { name:'tracks', schema:'public', table:'registry_tracks', key:['id'], columns:['id','slug','title','release_id','duration_ms','explicit','artwork_url','artwork_image_id','preview_url','status','metadata','updated_at','living_memory_status','living_memory_updated_at'], surfaces:['tracks','releases','artists'] },
  { name:'release_tracks', schema:'public', table:'registry_release_tracks', key:['id'], columns:['id','release_id','track_id','disc_number','track_number','status','metadata','updated_at'], surfaces:['releases','tracks'] },
  { name:'release_artists', schema:'public', table:'registry_release_artists', key:['id'], columns:['id','release_id','artist_id','artist_slug','artist_name_text','role','is_primary','is_featured','credit_order','display_credit','status','metadata','updated_at'], surfaces:['releases','artists'] },
  { name:'track_artists', schema:'public', table:'registry_track_artists', key:['id'], columns:['id','track_id','artist_id','artist_slug','artist_name_text','role','is_primary','is_featured','credit_order','display_credit','status','metadata','updated_at'], surfaces:['tracks','artists'] },
  { name:'genres', schema:'public', table:'registry_genres', key:['id'], columns:['id','slug','name','parent_genre_id','description','status','metadata','updated_at'], surfaces:['genres'] },
  { name:'labels', schema:'public', table:'registry_labels', key:['id'], columns:['id','slug','name','description','country_code','status','metadata','updated_at'], surfaces:['labels','releases'] },
  { name:'guides', schema:'public', table:'guides', key:['id'], columns:['id','source_wp_post_id','slug','title','excerpt','dek','content','status','published_at','created_at','updated_at','hero_url','hero_image_id','download_url','download_label','downloadables','metadata'], surfaces:['guides','briefings','magazine'] },
  { name:'authors', schema:'public', table:'registry_authors', key:['id'], columns:['id','slug','name','bio','url','avatar_url','cover_url','role','location','social_links','updated_at'], surfaces:['authors','magazine'] },
  { name:'resources', schema:'editorial', table:'resources', key:['id'], columns:['id','resource_kind','owner_id','visibility','lifecycle_state','created_by','created_at','updated_at','current_working_version_id','current_submitted_version_id','current_approved_version_id','current_published_version_id'], surfaces:['people','organizations','playlists','magazine'] },
  { name:'resource_aliases', schema:'editorial', table:'resource_aliases', key:['id'], columns:['id','resource_id','path','is_canonical','redirect_status','retired_at','replacement_alias_id','created_by','created_at'], surfaces:['people','organizations','playlists','magazine','taxonomy'] },
  { name:'article_resources', schema:'editorial', table:'article_resources', key:['resource_id'], columns:['resource_id','resource_kind','article_id'], surfaces:['magazine','people'] },
  { name:'registry_artist_resources', schema:'editorial', table:'registry_artist_resources', key:['resource_id'], columns:['resource_id','resource_kind','artist_id'], surfaces:['artists','people'] },
  { name:'organizations', schema:'editorial', table:'organizations', key:['resource_id'], columns:['resource_id','resource_kind','organization_state','display_name','description','logo_url','cover_url','location_text','website_url','updated_at'], surfaces:['organizations'] },
  { name:'person_identity_events', schema:'editorial', table:'person_identity_events', key:['id'], columns:['id','person_resource_id','event_type','identity_link_id','related_person_resource_id','prior_identity_revision','resulting_identity_revision','reason','created_at'], surfaces:['people'] },
  { name:'playlists', schema:'public', table:'wk_playlists', key:['id'], columns:['id','title','slug','description','status','cover_image_url','canonical_url','published_at','updated_at','authority_revision','playlist_kind'], surfaces:['playlists'] },
  { name:'playlist_items', schema:'public', table:'wk_playlist_items', key:['id'], columns:['id','playlist_id','position','registry_track_id','registry_release_id','provider_key','provider_track_id','title','artist_names','artwork_url','match_status','lifecycle_state','removed_at','updated_at'], surfaces:['playlists'] },
  { name:'playlist_snapshots', schema:'editorial', table:'playlist_publication_snapshots', key:['id'], columns:['id','resource_id','playlist_id','version_id','slug','title','description','cover_url','item_count','content_fingerprint','payload','published_at','created_at'], surfaces:['playlists'] },
  { name:'playlist_events', schema:'editorial', table:'playlist_lifecycle_events', key:['id'], columns:['id','resource_id','playlist_id','event_number','version_id','action','prior_status','resulting_status','metadata','command_receipt_id','created_at'], surfaces:['playlists'] },
  { name:'playlist_versions', schema:'editorial', table:'playlist_versions', key:['id'], columns:['id','resource_id','playlist_id','version_number','version_kind','source_authority_revision','title','slug','description','status','metadata','item_count','content_fingerprint','created_at','cover_asset_revision_id'], surfaces:['playlists'] },
  { name:'playlist_version_items', schema:'editorial', table:'playlist_version_items', key:['playlist_version_id','playlist_item_resource_id'], columns:['playlist_version_id','playlist_item_resource_id','playlist_item_id','position','registry_track_id','registry_release_id','provider_key','provider_track_id','title','artist_names','artwork_url','normalization_payload','match_status'], surfaces:['playlists'] },
  { name:'playlist_reviews', schema:'editorial', table:'playlist_review_events', key:['id'], columns:['id','resource_id','playlist_id','event_number','target_version_id','result_version_id','action','prior_status','resulting_status','reason','created_at'], surfaces:['playlists'] },
  { name:'playlist_trust', schema:'editorial', table:'playlist_version_trust_revisions', key:['playlist_version_id'], columns:['playlist_version_id','citation_revision','credit_revision','updated_at'], surfaces:['playlists'] },
  { name:'playlist_schedule', schema:'editorial', table:'playlist_scheduled_publications', key:['id'], columns:['id','resource_id','playlist_id','version_id','run_after','status','updated_at','published_at','failure_reason'], surfaces:['playlists'] },
  { name:'playlist_resources', schema:'editorial', table:'playlist_resources', key:['resource_id'], columns:['resource_id','resource_kind','playlist_id'], surfaces:['playlists'] },
  { name:'playlist_item_resources', schema:'editorial', table:'playlist_item_resources', key:['resource_id'], columns:['resource_id','resource_kind','playlist_item_id'], surfaces:['playlists'] },
  { name:'person_artist_links', schema:'editorial', table:'person_registry_artist_links', key:['id'], columns:['id','person_resource_id','registry_artist_id','link_state','link_reason','supersedes_link_id','superseded_by_link_id','created_at','retired_at','retired_reason'], surfaces:['people','artists'] },
  { name:'organization_label_links', schema:'editorial', table:'organization_registry_label_links', key:['organization_resource_id','registry_label_id'], columns:['organization_resource_id','registry_label_id','link_state','link_reason','created_at','retired_at','retired_reason'], surfaces:['organizations','labels'] },
  { name:'media_asset_resources', schema:'editorial', table:'media_asset_resources', key:['resource_id'], columns:['resource_id','resource_kind','asset_id'], surfaces:['magazine','artists','releases','tracks','people','organizations','playlists'] },
  { name:'magazine_featured_guides', schema:'public', table:'wk_magazine_featured_guides', key:['id'], columns:['id','guide_slug','display_order','created_at'], surfaces:['magazine','guides'] },
  { name:'chart_programs', schema:'public', table:'wk_chart_programs_v2', key:['id'], columns:['id','series_slug','market_slug','public_slug','public_label','default_methodology_version','chart_size','updated_at'], surfaces:['charts'] },
  { name:'chart_editions', schema:'public', table:'wk_chart_editions_v2', key:['id'], columns:['id','program_id','edition_slug','edition_date','status','rule_set_snapshot','methodology_version','entry_count','published_at','updated_at'], surfaces:['charts'] },
  { name:'chart_entries', schema:'public', table:'wk_chart_entries_v2', key:['id'], columns:['id','edition_id','rank','track_slug','track_title','artist_slug','artist_name','artwork_url','canonical_track_id','canonical_release_id','canonical_artist_id','eligibility_status','total_score','updated_at'], surfaces:['charts'] },
  { name:'chart_aliases', schema:'public', table:'wk_chart_slug_aliases_v2', key:['id'], columns:['id','legacy_slug','canonical_slug','entity_type','redirect_status'], surfaces:['charts','taxonomy'] },
  { name:'chart_markets', schema:'public', table:'wk_chart_markets_v2', key:['market_slug'], columns:['market_slug','market_label','market_type','country_code','timezone','default_language'], surfaces:['charts'] },
  { name:'provider_sources', schema:'public', table:'registry_provider_sources', key:['id'], columns:['id','entity_type','entity_id','provider','provider_url','is_primary_source','metadata','status','last_seen_at'], surfaces:['artists','releases','tracks'] },
  { name:'seo_overrides', schema:'public', table:'seo_content_overrides', key:['id'], columns:['id','target_url','title','description','social_title','social_description','payload','status','applied_at','archived_at','updated_at'], surfaces:['magazine','artists','releases','tracks','genres','labels','guides','briefings','charts','playlists','people','organizations','taxonomy','authors','static'] },
  { name:'media_assets', schema:'public', table:'registry_media_assets', key:['id'], columns:['id','source_entity','source_record_id','url','status','rights_status','credit_text','metadata','updated_at'], surfaces:['magazine','artists','releases','tracks','people','organizations','playlists'] },
]);
// Registered inputs are physical source relations with declared unique keys.
// Preserve the optional cardinality safeguard for future explicitly reviewed inputs.
const UNCONSTRAINED_KEY_TABLES = new Set();
const STATIC_INPUTS = Object.freeze([
  'src/router/config.tsx',
  'public/seo-prerender-routes.txt',
  'scripts/seo/prerender-metadata.mjs',
]);

function fail(reason) { throw new Error('[governed-source-scan] ' + reason); }
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function stableJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'number' && !Number.isFinite(value)) fail('Non-finite SQL numeric');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+stableJson(value[k])).join(',') + '}';
  }
  fail('Unsupported SQL value for canonical hashing');
}
function fixedDefinition(d) {
  for (const atom of [d.schema,d.table,...d.key,...d.columns]) if (!/^[a-z][a-z0-9_]*$/.test(atom)) fail('Unsafe source schema configuration');
  if (new Set(d.columns).size !== d.columns.length || d.key.some(k=>!d.columns.includes(k))) fail('Ambiguous source schema configuration: '+d.name);
  if (new Set(d.key).size !== d.key.length || !d.surfaces.length || d.surfaces.some(s=>!SURFACES.includes(s))) fail('Invalid source surface registration: '+d.name);
  return d;
}
for (const d of DEFINITIONS) fixedDefinition(d);
if (new Set(DEFINITIONS.map(d=>d.name)).size !== DEFINITIONS.length) fail('Duplicate source definition');
for (const s of SURFACES) if (s !== 'static' && !DEFINITIONS.some(d=>d.surfaces.includes(s))) fail('Uncovered source surface: '+s);

function tableSQL(d) {
  fixedDefinition(d);
  const names = d.columns.map(x=>'"'+x+'"').join(', ');
  const order = d.key.map(x=>'"'+x+'" ASC').join(', ');
  return `SELECT to_jsonb(src) AS row FROM (SELECT ${names} FROM "${d.schema}"."${d.table}" ORDER BY ${order} LIMIT $1 OFFSET $2) AS src`;
}
function staticEvidence(root) {
  const rows = [];
  for (const relative of STATIC_INPUTS) {
    const target = path.resolve(root,relative);
    if (!target.startsWith(root+path.sep)) fail('Static path escapes repo');
    const stat = fs.lstatSync(target,{throwIfNoEntry:false});
    if (!stat || !stat.isFile() || stat.isSymbolicLink() || !fs.realpathSync(target).startsWith(root+path.sep)) fail('Missing or unsafe static source: '+relative);
    rows.push({path:relative, sha256:digest(fs.readFileSync(target))});
  }
  return { rowCount:rows.length, digest:digest(stableJson(rows)) };
}
function strictUrl(raw,role,hostname) {
  if (!raw) fail('Missing explicit WAKILISHA_SEO_SOURCE_DATABASE_URL');
  let url; try { url=new URL(raw); } catch { fail('Invalid database URL'); }
  if (!['postgresql:','postgres:'].includes(url.protocol) || url.hostname!==hostname || url.username!==role || !url.password || url.search || url.hash || url.pathname!=='/postgres') fail('Database URL must match pinned host, dedicated role, and database; no connection-string overrides');
  if (url.port && (!/^\d+$/.test(url.port) || Number(url.port)<1 || Number(url.port)>65535)) fail('Invalid database port');
  return {host:hostname,port:Number(url.port)||5432,database:'postgres',user:role,password:decodeURIComponent(url.password),ssl:{rejectUnauthorized:true},connectionTimeoutMillis:8000,query_timeout:8000};
}
function projectDbCa(env) {
  const filename=env.WAKILISHA_SEO_SOURCE_DB_CA_FILE;
  if (typeof filename!=='string' || !path.isAbsolute(filename)) fail('Approved Supabase database CA file requires an absolute path');
  const stat=fs.lstatSync(filename,{throwIfNoEntry:false});
  if (!stat || !stat.isFile() || stat.isSymbolicLink() || stat.size>32768) fail('Missing or unsafe approved database CA file');
  const pem=fs.readFileSync(filename,'utf8');
  if (!/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(pem)) fail('Invalid database CA PEM (exactly one certificate required)');
  let certificate;
  try {certificate=new crypto.X509Certificate(pem);} catch {fail('Invalid database CA certificate');}
  const now=Date.now();
  if (!certificate.ca || Date.parse(certificate.validFrom)>now || Date.parse(certificate.validTo)<=now) fail('Supplied database CA is not a currently valid CA');
  return pem;
}
function exactEnvironment(env) {
  const host = env.WAKILISHA_SEO_SOURCE_DB_HOST;
  const role = env.WAKILISHA_SEO_SOURCE_DB_ROLE;
  if (env.WAKILISHA_SEO_SOURCE_PROJECT_REF!==PROJECT || host!==`db.${PROJECT}.supabase.co` || role!=='supabase_read_only_user') fail('Unapproved database host, project ref, or dedicated read-only role');
  const config=strictUrl(env.WAKILISHA_SEO_SOURCE_DATABASE_URL,role,host);
  config.ssl.ca=projectDbCa(env);
  config.ssl.servername=host;
  return {host,role,config};
}
async function ensureReadAuthority(client,role) {
  const state=await client.query(`SELECT current_user AS role, current_database() AS database, current_setting('transaction_read_only') AS read_only, current_setting('transaction_isolation') AS isolation, txid_current_snapshot()::text AS tx_snapshot, clock_timestamp()::text AS captured_at`);
  if (state.rows.length!==1 || state.rows[0].role!==role || state.rows[0].database!=='postgres' || state.rows[0].read_only!=='on' || state.rows[0].isolation!=='repeatable read') fail('Unexpected SQL identity or unsafe transaction mode');
  const meta=await client.query('SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolreplication FROM pg_roles WHERE rolname=current_user');
  const r=meta.rows[0];
  if (meta.rows.length!==1 || r.rolsuper!==false || r.rolbypassrls!==true || r.rolcreaterole!==false || r.rolcreatedb!==false || r.rolreplication!==false) fail('Completeness requires a dedicated non-superuser, non-mutating BYPASSRLS source-reader role');
  for (const d of DEFINITIONS) {
    const relation=d.schema+'.'+d.table;
    const q=await client.query(`SELECT c.relkind,has_table_privilege(current_user,c.oid,'SELECT') AS sel, has_table_privilege(current_user,c.oid,'INSERT') AS ins, has_table_privilege(current_user,c.oid,'UPDATE') AS upd, has_table_privilege(current_user,c.oid,'DELETE') AS del, has_table_privilege(current_user,c.oid,'TRUNCATE') AS trunc FROM pg_class c WHERE c.oid=to_regclass($1)`,[relation]);
    const x=q.rows[0];
    if (q.rows.length!==1 || !['r','p'].includes(x.relkind) || x.sel!==true || x.ins!==false || x.upd!==false || x.del!==false || x.trunc!==false) fail('Missing read-only/unfiltered source permission for '+relation);
  }
  return state.rows[0];
}
async function scanTable(client,d,budget) {
  let exactCount=null;
  if (UNCONSTRAINED_KEY_TABLES.has(d.name)) {
    if (++budget.queries>MAX_QUERIES) fail('Source scan query budget exhausted');
    const column=d.key.map(x=>'"'+x+'"').join(',');
    const countSql=`SELECT count(*)::text AS total, count(DISTINCT (${column}))::text AS unique_count FROM "${d.schema}"."${d.table}"`;
    const checked=await client.query(countSql);
    const row=checked.rows?.[0];
    const total=Number(row?.total), unique=Number(row?.unique_count);
    if (checked.rows.length!==1 || !Number.isSafeInteger(total) || !Number.isSafeInteger(unique) || total!==unique || total>MAX_ROWS_PER_TABLE) fail('Nonunique or oversized source key in '+d.name);
    exactCount=total;
  }
  const hash=crypto.createHash('sha256');
  hash.update(d.schema+'.'+d.table+'\n');
  let rows=0;
  const sql=tableSQL(d);
  let previousKey=null;
  for (;;) {
    if (Date.now()-budget.startedAt>MAX_ELAPSED_MS) fail('Source scan wall-clock budget exhausted');
    if (++budget.queries>MAX_QUERIES) fail('Source scan query budget exhausted');
    const result=await client.query(sql,[PAGE_SIZE,rows]);
    if (!Array.isArray(result.rows) || result.rows.length>PAGE_SIZE) fail('Malformed source page from '+d.name);
    for (const wrapped of result.rows) {
      const row=wrapped.row;
      if (!row || typeof row!=='object' || Array.isArray(row)) fail('Malformed source row from '+d.name);
      const key=d.key.map(k=>row[k]);
      if (key.some(v=>v===undefined||v===null)) fail('Missing canonical row key in '+d.name);
      const serialized=stableJson(key);
      if (serialized===previousKey) fail('Duplicate adjacent canonical row key in '+d.name);
      previousKey=serialized;
      hash.update(stableJson(row)+'\n');
    }
    rows+=result.rows.length;
    budget.rows+=result.rows.length;
    if (rows>MAX_ROWS_PER_TABLE || budget.rows>MAX_ROWS_TOTAL) fail('Source scan row budget exhausted');
    if (result.rows.length<PAGE_SIZE) break;
  }
  if (exactCount!==null && rows!==exactCount) fail('Source pagination count mismatch in '+d.name);
  return {rowCount:rows,digest:hash.digest('hex')};
}
async function collectWithClient(client,{role,repositoryRoot,now}={}) {
  if (!role || !repositoryRoot) fail('Missing collector authority');
  const root=fs.realpathSync(repositoryRoot);
  const staticFiles=staticEvidence(root);
  let begun=false;
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    begun=true;
    await client.query("SET LOCAL statement_timeout = '6500ms'");
    await client.query("SET LOCAL lock_timeout = '750ms'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '15000ms'");
    const evidence=await ensureReadAuthority(client,role);
    const budget={queries:0,rows:0,startedAt:Date.now()};
    const tables={};
    for (const d of DEFINITIONS) tables[d.name]=await scanTable(client,d,budget);
    const finish=await client.query('SELECT txid_current_snapshot()::text AS tx_snapshot, clock_timestamp()::text AS captured_at');
    if (finish.rows.length!==1 || finish.rows[0].tx_snapshot!==evidence.tx_snapshot) fail('Lost repeatable-read transaction snapshot');
    if (staticEvidence(root).digest!==staticFiles.digest) fail('Static route/code authority changed during source scan');
    await client.query('COMMIT'); begun=false;
    const surfaces={};
    for (const surface of SURFACES) {
      const refs=DEFINITIONS.filter(d=>d.surfaces.includes(surface)).map(d=>({table:d.schema+'.'+d.table,rowCount:tables[d.name].rowCount,digest:tables[d.name].digest}));
      if (surface==='static' || surface==='briefings' || surface==='taxonomy') refs.push({table:'repository.static-SEO-authority',...staticFiles});
      surfaces[surface]={rowCount:refs.reduce((n,x)=>n+x.rowCount,0),digest:digest(stableJson(refs)),tableCount:refs.length};
    }
    const sourceEpoch=digest(stableJson({project:PROJECT,surfaces}));
    return {format:1,kind:'wakilisha-governed-source-scan',origin:ORIGIN,projectRef:PROJECT,readOnly:true,isolation:'repeatable read',databaseRole:role,transactionSnapshot:evidence.tx_snapshot,sourceEpoch,capturedAt:now||new Date(finish.rows[0].captured_at).toISOString(),tables,surfaces,static:staticFiles,queryCount:budget.queries,rowCount:budget.rows,completeAllowlistScan:true,sourceAuthorityCoverage:'review-required',publicationReceipt:false,publicationActivationAuthority:false};
  } catch (err) {
    if (begun) {try {await client.query('ROLLBACK');} catch { /* no output on failed transaction */ }}
    throw err;
  }
}
function safeWriteExclusive(filename,obj) {
  if (!path.isAbsolute(filename)) fail('Output filename must be an absolute path');
  const directory=fs.realpathSync(path.dirname(filename));
  const resolved=path.join(directory,path.basename(filename));
  if (fs.existsSync(resolved)) fail('Source scan output exists; do not overwrite evidence');
  if (!/\.json$/.test(resolved)) fail('Source scan output must be .json');
  const serialized=JSON.stringify(obj,null,2)+'\n';
  fs.writeFileSync(resolved,serialized,{flag:'wx',mode:0o600});
  return digest(Buffer.from(serialized));
}
async function main() {
  if (process.argv[2]==='--inventory' && process.argv.length===3) {
    console.log(JSON.stringify({type:'out-of-band source scan only',projectRef:PROJECT,tableCount:DEFINITIONS.length,surfaces:SURFACES,tableNames:DEFINITIONS.map(d=>d.schema+'.'+d.table),transaction:'REPEATABLE READ READ ONLY',pageSize:PAGE_SIZE,maxRowsPerTable:MAX_ROWS_PER_TABLE,maxRowsTotal:MAX_ROWS_TOTAL},null,2));
    return;
  }
  if (process.argv[2]!=='--collect' || process.argv.length!==4) fail('Use --inventory or --collect /absolute/scan-evidence.json');
  const {host,role,config}=exactEnvironment(process.env);
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.VITE_PUBLIC_SUPABASE_URL==='http://localhost') fail('Direct production source scan forbidden in CI or frontend build context');
  const {default:pg}=await import('pg');
  const client=new pg.Client(config);
  try {
    await client.connect();
    const result=await collectWithClient(client,{role,repositoryRoot:process.cwd()});
    const sha=safeWriteExclusive(process.argv[3],result);
    console.log('GOVERNED_SOURCE_TRANSACTION_READ_ONLY=PASS');
    console.log('GOVERNED_SOURCE_SCAN_TABLES='+DEFINITIONS.length);
    console.log('GOVERNED_SOURCE_SCAN_ROWS='+result.rowCount);
    console.log('GOVERNED_SOURCE_SCAN_SQL_QUERIES='+result.queryCount);
    console.log('GOVERNED_SOURCE_EPOCH='+result.sourceEpoch);
    console.log('GOVERNED_SOURCE_SCAN_SHA256='+sha);
    console.log('PUBLICATION_RECEIPT=NOT_YET_GENERATED');
    console.log('PUBLICATION_ACTIVATION_AUTHORITY=NONE');
  } finally {await client.end();}
}

export {PROJECT,SURFACES,DEFINITIONS,STATIC_INPUTS,PAGE_SIZE,MAX_ROWS_PER_TABLE,stableJson,staticEvidence,strictUrl,exactEnvironment,tableSQL,scanTable,collectWithClient,safeWriteExclusive};
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) main().catch(err=>{console.error(err instanceof Error?err.message:String(err));process.exitCode=1;});
