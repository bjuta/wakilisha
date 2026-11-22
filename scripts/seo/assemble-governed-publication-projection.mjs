#!/usr/bin/env node
// Out-of-band, zero-network SEO source assembly. Not an activation authority.
// Input files are captured separately, independently pinned and publication-safe.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const SITE = "https://wakilisha.africa";
const HEX = /^[a-f0-9]{64}$/;
const EXPECTED_ROLE = "supabase_read_only_user";
const SCAN_PROTOCOL = "pg-jsonb-row-sha256-v2";
const MANIFEST_MIN = 3000;
const MANIFEST_MAX = 6000;
const ARTICLE_MAX = 500;

function fail(message) { throw new Error("[governed-projection] " + message); }
function sha(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }
function pinned(filename, pin, label, maxBytes = 24*1024*1024) {
  if (!path.isAbsolute(filename) || typeof pin !== "string" || !HEX.test(pin))
    fail("Missing independently pinned absolute input: " + label);
  const stat = fs.lstatSync(filename,{throwIfNoEntry:false});
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > maxBytes)
    fail("Missing, unsafe or oversized input: " + label);
  const bytes = fs.readFileSync(filename);
  if (sha(bytes) !== pin) fail("SHA-256 pin mismatch: " + label);
  try {return JSON.parse(bytes.toString("utf8"));} catch {fail("Invalid JSON input: " + label);}
}
function time(value,label) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value))
    fail("Invalid source capture timestamp: "+label);
  const parsed=Date.parse(value);
  if (!Number.isFinite(parsed)) fail("Invalid source capture time: "+label);
  return parsed;
}
function scanReceipt(scan,label) {
  if (!scan || scan.kind !== "wakilisha-governed-source-scan" ||
      scan.format !== 1 || scan.origin !== SITE ||
      scan.projectRef !== "pgzizndxdyhqmtyywjmt" ||
      scan.protocol !== SCAN_PROTOCOL ||
      scan.databaseRole !== EXPECTED_ROLE ||
      scan.readOnly !== true || scan.isolation !== "single-managed-readonly-statement" ||
      scan.completeAllowlistScan !== true ||
      scan.publicationReceipt !== false || scan.publicationActivationAuthority !== false ||
      scan.queryCount !== 1 || !HEX.test(scan.sourceEpoch || "") ||
      !HEX.test(scan.querySha256 || "") ||
      !scan.tables || Object.keys(scan.tables).length !== 42 ||
      !scan.tables.published_articles || !scan.tables.article_versions ||
      !scan.surfaces || Object.keys(scan.surfaces).length !== 15) {
    fail("Incomplete or unauthorized managed source receipt: "+label);
  }
  time(scan.capturedAt,label);
  return scan;
}
function captureWrapper(raw,label) {
  if (!raw || typeof raw !== "object" ||
      raw.httpStatus !== 200 || raw.projectRef !== "pgzizndxdyhqmtyywjmt" ||
      typeof raw.capturedAt !== "string" || !raw.response) {
    fail("Invalid public API capture envelope: "+label);
  }
  time(raw.capturedAt,label);
  return raw.response;
}
function validPublicPath(p) {
  return typeof p === "string" && /^\/[a-zA-Z0-9/._-]{0,319}$/.test(p) &&
    !p.includes("//") && (p === "/" || !p.endsWith("/")) &&
    !p.split("/").some(x=>x==="."||x==="..") &&
    !/^\/(?:admin|auth|settings|preview|following|messages|profile)(?:\/|$)/.test(p);
}

function assemble({first,second,metaCapture,articleCapture,acceptedManifest,secondSha}) {
  scanReceipt(first,"first"); scanReceipt(second,"second");
  const elapsed=time(second.capturedAt,"second") - time(first.capturedAt,"first");
  if (elapsed < 0 || elapsed > 15*60*1000 ||
      first.sourceEpoch !== second.sourceEpoch || first.querySha256 !== second.querySha256) {
    fail("Source epoch changed, replay was reversed or source capture window exceeded 15 minutes");
  }
  const metatime=time(metaCapture.capturedAt,"metadata");
  const articletime=time(articleCapture.capturedAt,"magazine");
  for (const t of [metatime,articletime]) {
    if (t < time(first.capturedAt,"first") || t > time(second.capturedAt,"second"))
      fail("Public API capture outside two trusted managed source reads");
  }
  const meta=captureWrapper(metaCapture,"metadata");
  const article=captureWrapper(articleCapture,"magazine");
  if (meta.ok !== true || !meta.data || typeof meta.data.metadata !== "object" ||
      !meta.data.metadata || Array.isArray(meta.data.metadata) ||
      !Number.isSafeInteger(meta.data.count) || meta.data.count !== Object.keys(meta.data.metadata).length) {
    fail("Untrusted or incomplete live SEO metadata listing");
  }
  const metadata=meta.data.metadata;
  if (Object.keys(metadata).length < MANIFEST_MIN || Object.keys(metadata).length > MANIFEST_MAX)
    fail("Out-of-range complete public metadata inventory");
  for (const [route,entry] of Object.entries(metadata)) {
    if (!validPublicPath(route) || !entry || typeof entry !== "object" ||
        typeof entry.title !== "string" || !entry.title.trim() ||
        (entry.sourceTable && !entry.sourceId)) {
      fail("Invalid current public route metadata: "+route);
    }
  }
  const old=acceptedManifest;
  if (!old || typeof old !== "object" || Array.isArray(old) ||
      Object.keys(old).length < MANIFEST_MIN || Object.keys(old).length > MANIFEST_MAX)
    fail("Invalid independently accepted baseline metadata");
  const missing=Object.keys(old).filter(x=>!Object.hasOwn(metadata,x));
  if (missing.length) {
    fail("Public route retirement needs independently accepted 410/308 publication authority; first missing route: "+missing[0]+" (total="+missing.length+")");
  }
  const stories=article?.data?.stories || article?.stories;
  if (!Array.isArray(stories) || stories.length < 1 || stories.length > ARTICLE_MAX)
    fail("Incomplete current published Magazine list");
  const published=new Set();
  for (const row of stories) {
    const slug=String(row?.slug||"");
    const route="/magazine/"+slug;
    const entry=metadata[route];
    const selected=String(row?.heroUrl||"");
    if (!/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/.test(slug) || published.has(slug) ||
        !entry || entry.sourceTable !== "wk_article_publication_snapshots" ||
        String(entry.sourceId||"") !== String(row.id||"") ||
        String(row.title||"").trim() === "" ||
        String(entry.image||"") !== selected) {
      fail("Published Article/source snapshot/selected image divergence: "+slug);
    }
    published.add(slug);
  }
  for (const [route,entry] of Object.entries(metadata)) {
    if (entry.sourceTable === "wk_article_publication_snapshots" &&
        (!route.startsWith("/magazine/") || !published.has(route.slice("/magazine/".length)))) {
      fail("Published Article metadata has no matching active snapshot list row: "+route);
    }
  }
  return {
    format:1,origin:SITE,complete:true,
    capturedAt:second.capturedAt,
    sourceEpoch:second.sourceEpoch,sourceScanSha256:secondSha,
    metadata,articles:stories,
    artists:{},releases:{},tracks:{},charts:{},
    nonCanonicalPaths:[],
    publicationActivationAuthority:false,
    generatedFrom:"managed-42-source-replay-and-bounded-public-projections",
  };
}
function main() {
  if (process.argv.length !== 9 || process.argv[2] !== "--assemble")
    fail("Use --assemble FIRST_SCAN SECOND_SCAN SEO_CAPTURE MAGAZINE_CAPTURE ACCEPTED_METADATA OUTPUT");
  const [firstPath,secondPath,metaPath,articlesPath,baselinePath,outPath]=process.argv.slice(3);
  const keys=[
    "WAKILISHA_FIRST_MANAGED_SCAN_SHA256",
    "WAKILISHA_SECOND_MANAGED_SCAN_SHA256",
    "WAKILISHA_SEO_METADATA_CAPTURE_SHA256",
    "WAKILISHA_MAGAZINE_CAPTURE_SHA256",
    "WAKILISHA_ACCEPTED_METADATA_SHA256",
  ];
  const [first,second,metaCapture,articleCapture,acceptedManifest] =
    [firstPath,secondPath,metaPath,articlesPath,baselinePath].map((file,i)=>pinned(file,process.env[keys[i]],keys[i]));
  const projected=assemble({first,second,metaCapture,articleCapture,acceptedManifest,
    secondSha:process.env[keys[1]]});
  if (!path.isAbsolute(outPath) || path.extname(outPath) !== ".json" ||
      fs.existsSync(outPath)) fail("Output must be a fresh absolute .json path");
  const out=JSON.stringify(projected,null,2)+"\n";
  fs.writeFileSync(outPath,out,{flag:"wx",mode:0o600});
  console.log("GOVERNED_SEO_PROJECTION_SHA256="+sha(out));
  console.log("GOVERNED_SEO_SOURCE_EPOCH="+projected.sourceEpoch);
  console.log("GOVERNED_SEO_SOURCE_SCAN_SHA256="+projected.sourceScanSha256);
  console.log("GOVERNED_SEO_ARTICLE_ROWS="+projected.articles.length);
  console.log("GOVERNED_SEO_METADATA_ROUTES="+Object.keys(projected.metadata).length);
  console.log("GOVERNED_SEO_EXTERNAL_READS=0");
  console.log("PUBLICATION_ACTIVATION_AUTHORITY=NONE");
}
export {assemble,scanReceipt,captureWrapper,validPublicPath};
if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {main();} catch(err) {console.error(err instanceof Error?err.message:String(err)); process.exitCode=1;}
}
