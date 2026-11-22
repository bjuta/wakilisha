import crypto from "node:crypto";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { SURFACES, verifyReceipt, differences, extractSeo, auditArtifact } from "../../scripts/seo/verify-governed-publication.mjs";
import { readGovernedOfflineProjection, assertFreshGovernedViteShell, activateGovernedOfflineProjection, seoBlockForPath, htmlForPath } from "../../scripts/seo/prerender-metadata.mjs";
import { assemble as assembleGovernedProjection, stableJson as stableManagedJson, managedMagazineSql, verifyManagedMagazineEvidence } from "../../scripts/seo/assemble-governed-publication-projection.mjs";
import { sql as magazinePublicationSql, validateCapture as validateMagazinePublicationCapture, verifySourcePair as verifyMagazinePublicationReplay, makeArticleMetadata as makeMagazinePublicationMetadata } from "../../scripts/seo/publish-magazine-snapshots.mjs";

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  describe,
  expect,
  it,
} from "vitest";

const router =
  readFileSync(
    "src/router/config.tsx",
    "utf8",
  );

const seoEdge =
  readFileSync(
    "supabase/functions/seo-sitemap-admin/index.ts",
    "utf8",
  );

const prerender =
  readFileSync(
    "scripts/seo/prerender-metadata.mjs",
    "utf8",
  );

const seoAudit =
  readFileSync(
    "scripts/seo/audit-prerender-output.mjs",
    "utf8",
  );

const sitemapBuilder =
  readFileSync(
    "scripts/seo/build-public-sitemap-html.mjs",
    "utf8",
  );

const routeManifest =
  readFileSync(
    "public/seo-prerender-routes.txt",
    "utf8",
  );

const adminSeo =
  readFileSync(
    "src/pages/admin/settings/seo/page.tsx",
    "utf8",
  );

describe("bounded, immutable Magazine publication onto accepted static HTML", () => {
  const article={
    id:"cfbcb1a2-f9e7-4d6c-8db9-aa0b2ffed343",
    slug:"album-review-alusa-continua",title:"Album Review: Alusa Continua",
    author:"Hafare Segelan",excerpt:"Published description",
    seo:{title:"Social review",description:"Published review"},
    heroUrl:"https://media.wakilisha.africa/uploads/selected.webp",
    publishedAt:"2026-11-22T07:59:32.784Z",modifiedAt:"2026-11-22T08:05:00.000Z",
  };
  const capture=(time="2026-11-22T09:00:00.000Z")=>({
    evidence:{protocol:"wakilisha-public-article-read-v1",
      projectRef:"pgzizndxdyhqmtyywjmt",role:"supabase_read_only_user",
      transactionReadOnly:"on",capturedAt:time,
      count:1,articles:[structuredClone(article)],overrides:[]},
  });
  it("emits exactly a bounded SELECT on published snapshots and approved overrides",()=>{
    const sql=magazinePublicationSql();
    expect(sql).toContain("FROM public.wk_article_publication_snapshots");
    expect(sql).toContain("WHERE is_active = true AND wp_status = 'publish'");
    expect(sql).toContain("FROM public.seo_content_overrides");
    expect(sql).toContain("LIMIT 501");
    expect(sql).not.toMatch(/\\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CALL|PERFORM)\\b/i);
    expect(sql).not.toMatch(/registry_artists|registry_releases|registry_tracks|publish_due_article_publications/);
  });
  it("replays identical entire published Magazine source under managed read-only role",()=>{
    const evidence=verifyMagazinePublicationReplay(
      capture(),capture("2026-11-22T09:02:00.000Z"));
    expect(evidence.capture.articles).toHaveLength(1);
    expect(evidence.sourceEpoch).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects writer privilege, incomplete rowset and changed source epoch",()=>{
    const writer=capture();writer.evidence.role="postgres";
    expect(()=>validateMagazinePublicationCapture(writer)).toThrow("unauthorised");
    const torn=capture();torn.evidence.count=2;
    expect(()=>validateMagazinePublicationCapture(torn)).toThrow("Incomplete");
    const revised=capture("2026-11-22T09:02:00.000Z");
    revised.evidence.articles[0].heroUrl="https://media.wakilisha.africa/uploads/other.webp";
    expect(()=>verifyMagazinePublicationReplay(capture(),revised)).toThrow("changed during");
  });
  it("keeps unrelated Registry metadata intact and detects retired Article routes",()=>{
    const live=capture().evidence;
    live.overrides=[{
      targetUrl:"https://wakilisha.africa/magazine/album-review-alusa-continua",
      title:"Approved SEO title",description:"Approved description",
      socialTitle:"Approved social",socialDescription:"Approved social copy",
    }];
    const baseline={
      "/artists/unchanged":{title:"Keep this Artist unchanged"},
      "/magazine/old-removed":{sourceTable:"wk_articles",kind:"article",title:"Prior"},
    };
    const result=makeMagazinePublicationMetadata(live,baseline);
    expect(result.retired).toEqual(["/magazine/old-removed"]);
    expect(result.metadata["/artists/unchanged"]).toEqual(baseline["/artists/unchanged"]);
    const updated=result.metadata["/magazine/album-review-alusa-continua"];
    expect(updated.sourceTable).toBe("wk_article_publication_snapshots");
    expect(updated.sourceId).toBe(article.id);
    expect(updated.image).toBe(article.heroUrl);
    expect(updated.description).toBe("Approved description");
    expect(updated.socialTitle).toBe("Approved social");
  });
  it("rejects an unsafe selected image without inventing one where none exists",()=>{
    const absent=capture();absent.evidence.articles[0].heroUrl="";
    expect(validateMagazinePublicationCapture(absent).articles).toHaveLength(1);
    const invalid=capture();invalid.evidence.articles[0].heroUrl="http://unsafe.example/image.jpg";
    expect(()=>validateMagazinePublicationCapture(invalid)).toThrow("Invalid");
  });
});

describe("governed offline SEO projection and selected Article image authority", () => {
  it("assembles public route membership only between identical managed source epochs", () => {
    const metadata: Record<string, Record<string, unknown>> = {};
    for (let i=0; i<3000; i+=1) metadata["/genres/fixture-"+i] = {
      title: "Genre "+i,sourceTable:"registry_genres",sourceId:"genre-"+i,
    };
    const baseline={...metadata};
    const snapshotId="cfbcb1a2-f9e7-4d6c-8db9-aa0b2ffed343";
    const slug="album-review-alusa-continua";
    const route="/magazine/"+slug;
    const hero="https://media.wakilisha.africa/uploads/selected.webp";
    metadata[route]={title:"Album Review: Alusa Continua",sourceTable:"wk_article_publication_snapshots",
      sourceId:snapshotId,image:hero};
    const surfaces=Object.fromEntries([
      "static","magazine","artists","releases","tracks","genres","labels","guides",
      "briefings","charts","playlists","people","organizations","taxonomy","authors",
    ].map(name=>[name,{digest:"a".repeat(64),rowCount:1}]));
    const sourceEpoch=crypto.createHash("sha256").update(stableManagedJson({
      protocol:"pg-jsonb-row-sha256-v2",project:"pgzizndxdyhqmtyywjmt",surfaces,
    })).digest("hex");
    const tables=Object.fromEntries(Array.from({length:40},(_,i)=>["table-"+i,{rowCount:0,digest:"a".repeat(64)}]));
    tables.published_articles={rowCount:210,digest:"b".repeat(64)};
    tables.article_versions={rowCount:323,digest:"c".repeat(64)};
    const scan={
      format:1,kind:"wakilisha-governed-source-scan",origin:"https://wakilisha.africa",
      projectRef:"pgzizndxdyhqmtyywjmt",protocol:"pg-jsonb-row-sha256-v2",
      databaseRole:"supabase_read_only_user",readOnly:true,
      isolation:"single-managed-readonly-statement",completeAllowlistScan:true,
      publicationReceipt:false,publicationActivationAuthority:false,
      queryCount:1,querySha256:"f".repeat(64),sourceEpoch,surfaces,tables,
      capturedAt:"2026-11-22T09:00:00.000Z",
    };
    const metaCapture={capturedAt:"2026-11-22T09:02:00.000Z",httpStatus:200,
      projectRef:"pgzizndxdyhqmtyywjmt",response:{ok:true,data:{
        count:Object.keys(metadata).length,metadata,
      }}};
    const articleCapture={evidence:{
      protocol:"wk-governed-magazine-managed-read-v1",projectRef:"pgzizndxdyhqmtyywjmt",
      role:"supabase_read_only_user",transactionReadOnly:"on",
      capturedAt:"2026-11-22T09:03:00.000Z",count:1,stories:[{
        id:snapshotId,slug,title:"Album Review: Alusa Continua",heroUrl:hero,
        dek:"Public editorial description",author:"Hafare Segelan",date:"2026-11-22",
      }],
    }};
    const opts={first:scan,second:{...scan,capturedAt:"2026-11-22T09:05:00.000Z"},
      metaCapture,articleCapture,acceptedManifest:baseline,secondSha:"e".repeat(64)};
    const readOnlySql=managedMagazineSql();
    expect(readOnlySql).toContain("FROM public.wk_article_publication_snapshots");
    expect(readOnlySql).toContain("WHERE is_active = true AND wp_status = 'publish'");
    expect(readOnlySql).toContain("LIMIT 501");
    expect(readOnlySql).not.toMatch(/\\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CALL)\\b/);
    expect(readOnlySql).not.toContain("public-content-read/magazine");
    expect(readOnlySql).not.toContain("publish_due_article_publications(");
    expect(verifyManagedMagazineEvidence(articleCapture).count).toBe(1);
    const wrongRole={evidence:{...articleCapture.evidence,role:"postgres"}};
    expect(() => verifyManagedMagazineEvidence(wrongRole)).toThrow("approved read-only role");
    expect(() => verifyManagedMagazineEvidence({
      evidence:{...articleCapture.evidence,count:2},
    })).toThrow("incomplete");
    const assembled=assembleGovernedProjection(opts);
    expect(assembled.articles).toHaveLength(1);
    expect(assembled.metadata[route].image).toBe(hero);
    expect(assembled.sourceEpoch).toBe(sourceEpoch);
    expect(assembled.publicationActivationAuthority).toBe(false);
    expect(() => assembleGovernedProjection({
      ...opts,
      metaCapture:{...metaCapture,response:{ok:true,data:{count:Object.keys(metadata).length,
        metadata:{...metadata,[route]:{...metadata[route],image:"https://media.wakilisha.africa/uploads/wrong.jpg"}}}}},
    })).toThrow("selected image divergence");
    expect(() => assembleGovernedProjection({
      ...opts,acceptedManifest:{...baseline,"/people/withdrawn":{title:"Withdrawn"}},
    })).toThrow("route retirement");
    expect(() => assembleGovernedProjection({
      ...opts,second:{...opts.second,sourceEpoch:"0".repeat(64)},
    })).toThrow("source epoch");
  });


  const fixture = () => ({
    format: 1,
    origin: "https://wakilisha.africa",
    complete: true,
    sourceEpoch: "a".repeat(64),
    sourceScanSha256: "b".repeat(64),
    metadata: {
      "/magazine/album-review-alusa-continua": {
        sourceTable: "wk_article_publication_snapshots",
        sourceId: "review-record",
        title: "Album Review: Alusa Continua",
        description: "A complete editorial review of Bien's Alusa Continua.",
        image: "https://media.wakilisha.africa/uploads/wrong.jpg",
        kind: "article",
        ogType: "article",
      },
    },
    articles: [{
      id: "review-record",
      slug: "album-review-alusa-continua",
      title: "Album Review: Alusa Continua",
      author: "Hafare Segelan",
      dek: "A complete editorial review of Bien's Alusa Continua.",
      date: "2026-11-22",
      heroUrl: "https://media.wakilisha.africa/uploads/selected.webp",
    }],
    artists: {},
    releases: {},
    tracks: {},
    charts: {},
    nonCanonicalPaths: [],
  });

  it("requires independent projection, scan and source-epoch SHA pins", () => {
    const root = mkdtempSync(path.join(tmpdir(), "wk-offline-projection-"));
    try {
      const filename = path.join(root, "projection.json");
      const source = fixture();
      const data = JSON.stringify(source);
      writeFileSync(filename, data);
      const inputs = {
        WAKILISHA_GOVERNED_SEO_PROJECTION: filename,
        WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256: crypto.createHash("sha256").update(data).digest("hex"),
        WAKILISHA_APPROVED_SOURCE_EPOCH: source.sourceEpoch,
        WAKILISHA_APPROVED_SOURCE_SCAN_SHA256: source.sourceScanSha256,
      };
      const accepted = readGovernedOfflineProjection(inputs);
      expect(accepted.articles).toHaveLength(1);
      const legacy = fixture();
      legacy.metadata["/"] = { title: "WAKILISHA" };
      legacy.articles.push({
        ...legacy.articles[0],
        id: "legacy-id",
        slug: "album-review-time2023-by-h_art-the-band",
      });
      legacy.metadata["/magazine/album-review-time2023-by-h_art-the-band"] = {
        ...legacy.metadata["/magazine/album-review-alusa-continua"],
        sourceId: "legacy-id",
      };
      const legacyData = JSON.stringify(legacy);
      writeFileSync(filename, legacyData);
      expect(readGovernedOfflineProjection({
        ...inputs,
        WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256: crypto.createHash("sha256").update(legacyData).digest("hex"),
      }).articles).toHaveLength(2);
      writeFileSync(filename, data);
      const untrustedSource = fixture();
      untrustedSource.metadata["/magazine/album-review-alusa-continua"].sourceId = "wrong-working-copy";
      const badBytes = JSON.stringify(untrustedSource);
      writeFileSync(filename,badBytes);
      expect(() => readGovernedOfflineProjection({
        ...inputs,
        WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256: crypto.createHash("sha256").update(badBytes).digest("hex"),
      })).toThrow("active immutable publication snapshot");
      writeFileSync(filename,data);
      expect(() => readGovernedOfflineProjection({
        ...inputs, WAKILISHA_APPROVED_SOURCE_EPOCH: "c".repeat(64),
      })).toThrow("unapproved");
      expect(() => readGovernedOfflineProjection({
        ...inputs, WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256: "0".repeat(64),
      })).toThrow("checksum mismatch");
      const spoofed = { ...source, complete: false };
      const payload = JSON.stringify(spoofed);
      writeFileSync(filename, payload);
      expect(() => readGovernedOfflineProjection({
        ...inputs,
        WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256: crypto.createHash("sha256").update(payload).digest("hex"),
      })).toThrow("Incomplete or unapproved");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to carry retired or stale route HTML into a new governed candidate", () => {
    const root = mkdtempSync(path.join(tmpdir(), "wk-fresh-vite-seo-"));
    try {
      writeFileSync(path.join(root, "index.html"), "<html><head></head></html>");
      mkdirSync(path.join(root, "assets"));
      writeFileSync(path.join(root, "assets", "index-hash.js"), "/* fixture */");
      expect(() => assertFreshGovernedViteShell(root)).not.toThrow();
      mkdirSync(path.join(root, "magazine", "retired"), { recursive: true });
      writeFileSync(path.join(root, "magazine", "retired", "index.html"), "stale");
      expect(() => assertFreshGovernedViteShell(root)).toThrow("fresh Vite shell");
      rmSync(path.join(root, "magazine"), { recursive: true, force: true });
      writeFileSync(path.join(root, "seo-metadata-manifest.json"), "{}");
      expect(() => assertFreshGovernedViteShell(root)).toThrow("fresh Vite shell");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("materializes the exact selected image in zero-network Magazine fallback and homepage from one pinned source epoch", () => {
    const root = mkdtempSync(path.join(tmpdir(), "wk-offline-fallback-"));
    try {
      const dist = path.join(root, "dist");
      mkdirSync(path.join(dist, "magazine"), { recursive: true });
      const shell = "<!doctype html><html><head></head><body><div id=\"root\"></div></body></html>";
      writeFileSync(path.join(dist, "index.html"), shell);
      writeFileSync(path.join(dist, "magazine", "index.html"), shell);
      const projection = {
        format: 1, origin: "https://wakilisha.africa", complete: true,
        sourceEpoch: "a".repeat(64), sourceScanSha256: "b".repeat(64),
        capturedAt: "2026-11-22T09:01:00.000Z",
        metadata: { "/magazine/album-review-alusa-continua": {
          title: "Album Review: Alusa Continua", sourceTable: "wk_article_publication_snapshots", sourceId: "article-1",
        }},
        articles: [{
          id: "article-1", slug: "album-review-alusa-continua", title: "Album Review: Alusa Continua",
          author: "Hafare Segelan", heroUrl: "https://media.wakilisha.africa/uploads/selected.webp",
          date: "2026-11-22", dek: "Editorial review", section: "Review",
        }],
        artists: {}, releases: {}, tracks: {}, charts: {}, nonCanonicalPaths: [],
      };
      const bytes = JSON.stringify(projection);
      const input = path.join(root, "source.json");
      writeFileSync(input, bytes);
      const result = spawnSync("node", [
        path.resolve("scripts/seo/build-public-magazine-fallback.mjs"), "--governed-offline",
      ], {
        cwd: root, encoding: "utf8", env: {
          ...process.env,
          WAKILISHA_GOVERNED_SEO_PROJECTION: input,
          WAKILISHA_GOVERNED_SEO_PROJECTION_SHA256: crypto.createHash("sha256").update(bytes).digest("hex"),
          WAKILISHA_APPROVED_SOURCE_EPOCH: projection.sourceEpoch,
          WAKILISHA_APPROVED_SOURCE_SCAN_SHA256: projection.sourceScanSha256,
          VITE_PUBLIC_SUPABASE_URL: "",
          VITE_PUBLIC_SUPABASE_ANON_KEY: "",
        },
      });
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout).toContain("GOVERNED_MAGAZINE_FALLBACK_NETWORK_READS=0");
      const fallback = JSON.parse(readFileSync(path.join(dist,"public-magazine-fallback.json"),"utf8"));
      expect(fallback.generatedAt).toBe("2026-11-22T09:01:00.000Z");
      expect(fallback.stories[0].title).toBe("Album Review: Alusa Continua");
      expect(fallback.stories[0].heroUrl).toBe("https://media.wakilisha.africa/uploads/selected.webp");
      const magazine = readFileSync(path.join(dist,"magazine","index.html"),"utf8");
      expect(magazine).toContain('data-wakilisha-lcp-preload="magazine"');
      expect(magazine).toContain("selected.webp");
      expect(readFileSync(path.join(dist,"index.html"),"utf8")).toContain('id="wk-magazine-fallback"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("renders a new Article's exact editor-selected image in initial HTTP SEO and Article JSON-LD without network fetches", () => {
    const input = fixture();
    activateGovernedOfflineProjection(input);
    const articlePath = "/magazine/album-review-alusa-continua";
    const block = seoBlockForPath(articlePath);
    expect(block).toContain("Album Review: Alusa Continua | WAKILISHA");
    expect(block).toContain('property="og:type" content="article"');
    expect(block).toContain('property="og:url" content="https://wakilisha.africa/magazine/album-review-alusa-continua"');
    expect(block).toContain('property="og:image" content="https://media.wakilisha.africa/uploads/selected.webp"');
    expect(block).toContain('name="twitter:image" content="https://media.wakilisha.africa/uploads/selected.webp"');
    expect(block).not.toContain("wrong.jpg");
    expect(block).not.toContain('property="og:image:width"');
    expect(block).toContain('"author":{"@type":"Person","name":"Hafare Segelan"}');
    expect(block).toContain("2026-11-22");
    expect(block).toContain('"@type":"Article"');
    const model = input.metadata[articlePath];
    model.socialTitle = "A Special Published Social Headline";
    model.socialDescription = "This is the deliberately approved social summary.";
    activateGovernedOfflineProjection(input);
    const social = seoBlockForPath(articlePath);
    expect(social).toContain('property="og:title" content="A Special Published Social Headline | WAKILISHA"');
    expect(social).toContain('name="twitter:description" content="This is the deliberately approved social summary."');
    expect(social).toContain('<title>Album Review: Alusa Continua | WAKILISHA</title>');
    expect(social).toContain('property="og:image" content="https://media.wakilisha.africa/uploads/selected.webp"');

    const html = htmlForPath("<html><head></head><body><main></main></body></html>", articlePath);
    expect(html).toContain("selected.webp");
    expect(html).not.toContain('content="https://wakilisha.africa/"');
  });
});

describe("incident-safe offline SEO build", () => {
  it("preserves the exact library-selected media identity in Article versions", () => {
    const panel = readFileSync(
      "src/pages/admin/content/articles/detail/components/ArticleMetaPanel.tsx", "utf8",
    );
    const editor = readFileSync(
      "src/pages/admin/content/articles/detail/ArticleEditorWorkspace.tsx", "utf8",
    );
    const service = readFileSync(
      "src/services/articles/articleAdminService.ts", "utf8",
    );
    expect(panel).toContain("onHeroImageSave?.(url, assetId)");
    expect(panel).toContain("onHeroImageSave?.(heroUrlInput, null)");
    expect(panel).toContain('onHeroImageSave?.("", null)');
    expect(editor).toContain("hero_image_url: url || null, hero_image_id: assetId");
    expect(service).toContain("hero_image_id?: string | null");
  });

  it("does not invent social-image dimensions for editorial media", () => {
    const client = readFileSync("src/components/seo/MetaTags.tsx", "utf8");
    expect(client).not.toContain('setMetaTag("og:image:width", "1200")');
    expect(client).not.toContain('setMetaTag("og:image:height", "630")');
    expect(prerender).not.toContain('<meta property="og:image:width" content="1200" />');
    expect(prerender).not.toContain('<meta property="og:image:height" content="630" />');
    expect(prerender).toContain('<meta property="og:image" content="${escapeAttr(image)}" />');
  });

  it("keeps the default build entirely off live SEO and public-content functions", () => {
    const build = JSON.parse(readFileSync("package.json", "utf8")).scripts.build as string;
    const restore = readFileSync("scripts/seo/restore-accepted-prerender.mjs", "utf8");
    expect(build).toContain("restore-accepted-prerender.mjs --check");
    expect(build).toContain("restore-accepted-prerender.mjs --restore");
    expect(build).not.toContain("node scripts/seo/prerender-metadata.mjs");
    expect(build).not.toContain("node scripts/seo/build-public-magazine-fallback.mjs");
    expect(restore).not.toContain("fetch(");
    expect(restore).toContain("WAKILISHA_ACCEPTED_PRERENDER_SHA256");
  });

  it("stops frontend deployment before dependencies, tests or SSH if accepted SEO inputs are absent or invalid", () => {
    const runner = path.resolve("scripts/deploy/production-frontend.sh");
    const run = (envOverrides: Record<string, string>) => spawnSync("bash", [
      runner,
      "--expected-main", "a".repeat(40),
      "--label", "seo-preflight-test",
    ], {
      cwd: process.cwd(),
      env: { ...process.env, ...envOverrides },
      encoding: "utf8",
    });

    const missingDir = run({
      WAKILISHA_ACCEPTED_PRERENDER_DIR: "",
      WAKILISHA_ACCEPTED_PRERENDER_SHA256: "",
    });
    expect(missingDir.status).not.toBe(0);
    expect(missingDir.stdout).toContain("PRODUCTION_FRONTEND_RUNNER=FAIL_ACCEPTED_PRERENDER_DIR_UNSET");

    const missingPin = run({
      WAKILISHA_ACCEPTED_PRERENDER_DIR: path.resolve("."),
      WAKILISHA_ACCEPTED_PRERENDER_SHA256: "",
    });
    expect(missingPin.status).not.toBe(0);
    expect(missingPin.stdout).toContain("PRODUCTION_FRONTEND_RUNNER=FAIL_ACCEPTED_PRERENDER_PIN_UNSET");

    const invalidSource = run({
      WAKILISHA_ACCEPTED_PRERENDER_DIR: path.resolve("."),
      WAKILISHA_ACCEPTED_PRERENDER_SHA256: "0".repeat(64),
    });
    expect(invalidSource.status).not.toBe(0);
    expect(invalidSource.stdout).toContain("PRODUCTION_FRONTEND_RUNNER=FAIL_ACCEPTED_PRERENDER_CHECK");

    for (const result of [missingDir, missingPin, invalidSource]) {
      expect(result.stdout).not.toContain("EXACT_MERGED_MAIN=PASS");
      expect(result.stdout).not.toContain("MERGED_MAIN_DEPENDENCIES=PASS");
      expect(result.stdout).not.toContain("ROLLBACK_SNAPSHOT=PASS");
      expect(result.stdout).not.toContain("FRONTEND_ACTIVATION=COMPLETE");
    }
  });

  it("rehydrates an accepted SEO snapshot with new app assets, and fails on tampering", () => {
    const root = mkdtempSync(path.join(tmpdir(), "wk-incident-seo-"));
    const accepted = path.join(root, "accepted");
    const work = path.join(root, "work");
    const output = path.join(work, "dist");
    const script = path.resolve("scripts/seo/restore-accepted-prerender.mjs");
    const fallback = {
      generatedAt: "2026-11-13T00:00:00.000Z",
      stories: [{ id: "a", slug: "story", title: "Story", heroUrl: "https://media.wakilisha.africa/uploads/story.webp" }],
    };
    const inline = '<script id="wk-magazine-fallback" type="application/json">' + JSON.stringify(fallback) + '</script>';
    const hero = '<link rel="preload" as="image" href="https://media.wakilisha.africa/uploads/story.webp" fetchpriority="high" data-wakilisha-lcp-preload="magazine" data-wakilisha-lcp-path="/magazine" />';
    const html = (route: string, body: string) => '<!doctype html><html><head>' +
      '<title>' + route + ' | WAKILISHA</title>' +
      '<meta name="robots" content="index, follow" />' +
      '<link rel="canonical" href="https://wakilisha.africa' + route + '" />' +
      '<meta property="og:title" content="WAKILISHA" />' +
      '<script id="wk-jsonld-primary" type="application/ld+json">' + JSON.stringify({ "@context": "https://schema.org", "@type": "WebPage", url: "https://wakilisha.africa" + route }) + '</script>' +
      '</head><body><div id="root"></div>' + body + '</body></html>';
    const env = { ...process.env, WAKILISHA_ACCEPTED_PRERENDER_DIR: accepted, WAKILISHA_ACCEPTED_PRERENDER_SHA256: "" };

    try {
      mkdirSync(path.join(accepted, "magazine"), { recursive: true });
      mkdirSync(output, { recursive: true });
      writeFileSync(path.join(accepted, "index.html"), html("/", inline));
      writeFileSync(path.join(accepted, "magazine", "index.html"), html("/magazine", hero + inline));
      writeFileSync(path.join(accepted, "seo-metadata-manifest.json"), JSON.stringify({ "/magazine": { title: "Magazine" } }));
      writeFileSync(path.join(accepted, "public-magazine-fallback.json"), JSON.stringify(fallback));
      writeFileSync(path.join(accepted, "sitemap.xml"), '<urlset><url><loc>https://wakilisha.africa/magazine</loc></url></urlset>');
      writeFileSync(path.join(output, "index.html"), '<!doctype html><html><head><title>New application</title><link rel="canonical" href="https://wakilisha.africa/" /></head><body><div id="root"></div><script src="/assets/new-entry.js"></script></body></html>');

      const magazinePath = path.join(accepted, "magazine", "index.html");
      const acceptedMagazine = readFileSync(magazinePath, "utf8");
      writeFileSync(magazinePath, acceptedMagazine.replace(
        'href="https://wakilisha.africa/magazine"',
        'href="https://wakilisha.africa/not-magazine"',
      ));
      const badCanonicalSeal = spawnSync(process.execPath, [script, "--seal"], { cwd: work, env, encoding: "utf8" });
      expect(badCanonicalSeal.status).not.toBe(0);
      expect(badCanonicalSeal.stderr).toContain("Canonical route mismatch");
      writeFileSync(magazinePath, acceptedMagazine);

      const fallbackPath = path.join(accepted, "public-magazine-fallback.json");
      writeFileSync(fallbackPath, JSON.stringify({
        ...fallback,
        stories: [{ ...fallback.stories[0], title: "Unaccepted change" }],
      }));
      const badFallbackSeal = spawnSync(process.execPath, [script, "--seal"], { cwd: work, env, encoding: "utf8" });
      expect(badFallbackSeal.status).not.toBe(0);
      expect(badFallbackSeal.stderr).toContain("Magazine inline fallback differs");
      writeFileSync(fallbackPath, JSON.stringify(fallback));

      const seal = spawnSync(process.execPath, [script, "--seal"], { cwd: work, env, encoding: "utf8" });
      expect(seal.status, seal.stderr).toBe(0);
      const hash = seal.stdout.match(/ACCEPTED_PRERENDER_SHA256=([a-f0-9]{64})/)?.[1];
      expect(hash).toMatch(/^[a-f0-9]{64}$/);

      const pinned = { ...env, WAKILISHA_ACCEPTED_PRERENDER_SHA256: hash };
      const check = spawnSync(process.execPath, [script, "--check"], { cwd: work, env: pinned, encoding: "utf8" });
      expect(check.status, check.stderr).toBe(0);
      const restore = spawnSync(process.execPath, [script, "--restore"], { cwd: work, env: pinned, encoding: "utf8" });
      expect(restore.status, restore.stderr).toBe(0);
      const rootHtml = readFileSync(path.join(output, "index.html"), "utf8");
      const magazineHtml = readFileSync(path.join(output, "magazine", "index.html"), "utf8");
      expect(rootHtml).toContain("/assets/new-entry.js");
      expect(rootHtml).toContain("wk-jsonld-primary");
      expect(rootHtml).toContain("wk-magazine-fallback");
      expect(magazineHtml).toContain(hero);
      expect(magazineHtml).toContain("https://wakilisha.africa/magazine");
      expect(readFileSync(path.join(output, "sitemap.xml"), "utf8")).toContain("<urlset>");

      writeFileSync(path.join(accepted, "seo-metadata-manifest.json"), '{"changed":true}');
      const tamper = spawnSync(process.execPath, [script, "--check"], { cwd: work, env: pinned, encoding: "utf8" });
      expect(tamper.status).not.toBe(0);
      expect(tamper.stderr).toContain("Accepted snapshot file changed");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe(
  "public SEO vertical contract",
  () => {
    it(
      "keeps Playlists first class across route, sitemap, metadata, prerender, and audit authority",
      () => {
        expect(router)
          .toContain(
            'path: "/playlists"',
          );

        expect(router)
          .toContain(
            'path: "/playlists/:slug"',
          );

        expect(seoEdge)
          .toContain(
            '{ loc: makeUrl("/playlists"), url_type: "static" }',
          );

        expect(seoEdge)
          .toContain(
            '"list_public_playlists"',
          );

        expect(seoEdge)
          .toContain(
            '"public_playlist"',
          );

        expect(seoEdge)
          .toContain(
            'kind: "playlist"',
          );

        expect(seoEdge)
          .toContain(
            'ogType: "music.playlist"',
          );

        expect(prerender)
          .toContain(
            '"/playlists": {',
          );

        expect(prerender)
          .toContain(
            'model.kind === "playlist"',
          );

        expect(prerender)
          .toContain(
            '"MusicPlaylist"',
          );

        expect(prerender)
          .toContain(
            'Playlist metadata manifest loaded:',
          );

        expect(routeManifest)
          .toContain(
            "/playlists",
          );

        expect(sitemapBuilder)
          .toContain(
            '<a href="/playlists">Playlists</a>',
          );

        expect(seoAudit)
          .toContain(
            '"/playlists: missing from SEO metadata manifest."',
          );

        expect(adminSeo)
          .toContain(
            '"playlist_detail"',
          );

        expect(adminSeo)
          .toContain(
            '"playlist"',
          );
      },
    );

    it(
      "keeps work-backed public People in dynamic SEO metadata and prerender authority without inventing a People collection page",
      () => {
        expect(router)
          .toContain(
            'path: "/people/:slug"',
          );

        expect(router)
          .not.toContain(
            'path: "/people"',
          );

        expect(seoEdge)
          .toContain(
            '.from("wk_resource_index")',
          );

        expect(seoEdge)
          .toContain(
            '"get_public_person"',
          );

        expect(seoEdge)
          .toContain(
            '"list_public_person_work"',
          );

        expect(seoEdge)
          .toContain(
            "workData.length === 0",
          );

        expect(seoEdge)
          .toContain(
            '"public_person"',
          );

        expect(seoEdge)
          .toContain(
            'kind: "person"',
          );

        expect(prerender)
          .toContain(
            'model.kind === "person"',
          );

        expect(prerender)
          .toContain(
            'Person metadata manifest loaded:',
          );

        expect(sitemapBuilder)
          .toContain(
            '"people"',
          );

        expect(adminSeo)
          .toContain(
            '"person_detail"',
          );

        expect(adminSeo)
          .toContain(
            '"person"',
          );
      },
    );

    it(
      "derives Article image and typed author metadata from one public Magazine listing fetch",
      () => {
        expect(
          prerender.match(
            /\/magazine\?limit=1000/g,
          )?.length,
        ).toBe(1);

        expect(prerender)
          .toContain(
            "async function fetchArticleManifests()",
          );

        expect(prerender)
          .toContain(
            "ARTICLE_IMAGE_BY_PATH = articleManifests.imageByPath;",
          );

        expect(prerender)
          .toContain(
            "ARTICLE_METADATA_BY_PATH = articleManifests.metadataByPath;",
          );

        expect(prerender)
          .not.toContain(
            "fetchArticleImageManifest()",
          );

        expect(prerender)
          .not.toContain(
            "fetchArticleMetadataManifest()",
          );
      },
    );

    it(
      "uses manifest timeout and retry authority for Artist metadata",
      () => {
        const start =
          prerender.indexOf(
            "async function fetchArtistMetadataManifest()",
          );
        const end =
          prerender.indexOf(
            "\n\nfunction cleanPath",
            start,
          );
        const artistManifest =
          prerender.slice(
            start,
            end,
          );

        expect(start)
          .toBeGreaterThanOrEqual(0);
        expect(end)
          .toBeGreaterThan(start);
        expect(artistManifest)
          .toContain(
            "PRERENDER_MANIFEST_TIMEOUT_MS",
          );
        expect(artistManifest)
          .toContain(
            "PRERENDER_MANIFEST_RETRY_COUNT",
          );
        expect(artistManifest)
          .toContain(
            "Artist metadata manifest retry",
          );
        expect(artistManifest)
          .toContain(
            "Artist metadata manifest unavailable after",
          );
      },
    );

    it(
      "keeps work-backed public Organizations in dynamic SEO authority without inventing an Organization collection page",
      () => {
        expect(router)
          .toContain(
            'path: "/organizations/:slug"',
          );

        expect(router)
          .not.toContain(
            'path: "/organizations"',
          );

        expect(seoEdge)
          .toContain(
            '"list_public_article_author_organization_paths"',
          );

        expect(seoEdge)
          .toContain(
            '"get_public_organization"',
          );

        expect(seoEdge)
          .toContain(
            '"list_public_organization_work"',
          );

        expect(seoEdge)
          .toContain(
            '"public_organization"',
          );

        expect(seoEdge)
          .toContain(
            'kind: "organization"',
          );

        expect(prerender)
          .toContain(
            'authorOrganizationPath',
          );

        expect(prerender)
          .toContain(
            'model.kind === "organization"',
          );

        expect(prerender)
          .toContain(
            'Organization metadata manifest loaded:',
          );

        expect(prerender)
          .toContain(
            '"@type": "Organization"',
          );

        expect(sitemapBuilder)
          .toContain(
            '"organizations"',
          );

        expect(seoAudit)
          .toContain(
            '"/organizations/"',
          );

        expect(seoAudit)
          .toContain(
            '"public_organization"',
          );

        expect(adminSeo)
          .toContain(
            '"organization_detail"',
          );

        expect(adminSeo)
          .toContain(
            '"organization"',
          );
      },
    );

    it(
      "keeps private or personal product surfaces outside this SEO contract",
      () => {
        expect(seoEdge)
          .not.toContain(
            'makeUrl("/following")',
          );

        expect(seoEdge)
          .not.toContain(
            'makeUrl("/start")',
          );

        expect(routeManifest)
          .not.toContain(
            "/following",
          );

        expect(routeManifest)
          .not.toContain(
            "/start",
          );
      },
    );
  },
);


describe("governed publication receipt parity", () => {
  // The current receipt is only trustworthy after a separate, governed source
  // projection. These deterministic cases test parity, not receipt acquisition.
  const sha = (value: string | Buffer) =>
    crypto.createHash("sha256").update(value).digest("hex");

  const html = (route: string) =>
    '<!doctype html><html><head><title>' + route + ' | WAKILISHA</title>' +
    '<meta name="robots" content="index, follow" />' +
    '<link rel="canonical" href="https://wakilisha.africa' + route + '" />' +
    '<meta property="og:title" content="WAKILISHA" />' +
    '<script id="wk-jsonld-primary" type="application/ld+json">' +
    JSON.stringify({ "@type": "WebPage", url: "https://wakilisha.africa" + route }) +
    '</script></head><body></body></html>';

  const item = (route: string, source: string, subjectId: string, revision = "v1") => ({
    path: route,
    source,
    subjectId,
    revision: sha(revision),
    seoSha256: extractSeo(html(route), route),
  });

  const receipt = (): any => {
    const epoch = sha("epoch-one");
    return {
      format: 1,
      origin: "https://wakilisha.africa",
      complete: true,
      sourceEpoch: epoch,
      capturedAt: "2026-11-14T10:00:00Z",
      surfaces: Object.fromEntries(SURFACES.map(source => [
        source,
        { complete: true, sourceEpoch: epoch, rowCount: source === "static" ? 2 : 0, digest: sha(source) },
      ])),
      routes: [
        item("/", "static", "root"),
        item("/magazine", "static", "magazine"),
      ],
      retired: [],
    };
  };
  const nextEpoch = (value: any) => {
    const epoch = sha("epoch-two");
    value.sourceEpoch = epoch;
    for (const surface of Object.values(value.surfaces) as any[]) surface.sourceEpoch = epoch;
  };
  const put = (root: string, relative: string, body: string) => {
    const target = path.join(root, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, body);
  };

  it("replays an unchanged complete source and invalidates new publications or corrections", () => {
    const accepted = receipt();
    const current = structuredClone(accepted);
    nextEpoch(current);
    expect(differences(accepted, current)).toEqual([]);

    current.routes.push(item("/artists/new-artist", "artists", "artist-uuid"));
    current.surfaces.artists.digest = sha("new publication");
    expect(differences(accepted, current)).toContain("ROUTE_ADDED /artists/new-artist");

    current.routes.pop();
    current.routes[1].revision = sha("corrected article");
    current.surfaces.static.digest = sha("corrected SEO source");
    expect(differences(accepted, current)).toContain("ROUTE_CHANGED /magazine");
    current.sourceEpoch = accepted.sourceEpoch;
    for (const surface of Object.values(current.surfaces) as any[]) {
      surface.sourceEpoch = accepted.sourceEpoch;
    }
    assert.throws(() => differences(accepted, current), /Content changed inside one source epoch/);
  });

  it("requires exact withdrawal and route-retirement receipts without resurrecting private paths", () => {
    const accepted = receipt();
    const current = structuredClone(accepted);
    nextEpoch(current);
    current.routes.pop();
    assert.throws(() => differences(accepted, current), /without exact governed retirement/);

    current.retired.push({
      path: "/magazine",
      source: "static",
      subjectId: "magazine",
      reason: "withdrawn",
      eventSha256: sha("withdrawal-event"),
    });
    expect(differences(accepted, current)).toContain("ROUTE_RETIRED /magazine reason=withdrawn");

    current.routes.push(item("/journal", "static", "magazine"));
    assert.throws(() => verifyReceipt(current, "bad"), /Nonpublic subject still has active route/);
    current.retired[0].reason = "redirected";
    current.retired[0].target = "/journal";
    expect(differences(accepted, current)).toContain("ROUTE_ADDED /journal");
    current.retired[0].target = "/";
    assert.throws(() => verifyReceipt(current, "bad"), /Redirect target missing or changes subject/);
  });

  it("rejects incomplete scans, stale receipts, changed path ownership, and private-route leaks", () => {
    const accepted = receipt();
    const current = structuredClone(accepted);
    current.surfaces.people.complete = false;
    assert.throws(() => differences(accepted, current), /Incomplete source scan/);

    const older = structuredClone(accepted);
    older.capturedAt = "2026-11-13T10:00:00Z";
    assert.throws(() => differences(accepted, older), /predates accepted publication/);

    const reused = structuredClone(accepted);
    nextEpoch(reused);
    reused.routes[1].subjectId = "different-subject";
    assert.throws(() => differences(accepted, reused), /Canonical path reused/);

    const privateRoute = structuredClone(accepted);
    privateRoute.routes.push(item("/admin/secret", "static", "secret"));
    assert.throws(() => verifyReceipt(privateRoute, "bad"), /Private route/);
  });

  it("pins both receipts, rejects tampering, and audits real SEO output without network reads", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "wk-governed-seo-"));
    const accepted = receipt();
    const currentFile = path.join(dir, "current.json");
    const acceptedFile = path.join(dir, "accepted.json");
    const script = path.resolve("scripts/seo/verify-governed-publication.mjs");
    try {
      put(dir, "index.html", html("/"));
      put(dir, "magazine/index.html", html("/magazine"));
      put(dir, "seo-metadata-manifest.json", JSON.stringify({ "/": {}, "/magazine": {} }));
      put(dir, "sitemap.xml", '<urlset><url><loc>https://wakilisha.africa/</loc></url><url><loc>https://wakilisha.africa/magazine</loc></url></urlset>');
      expect(auditArtifact(dir, accepted)).toBe(2);

      put(dir, "accepted.json", JSON.stringify(accepted));
      put(dir, "current.json", JSON.stringify(accepted));
      const env = {
        ...process.env,
        WAKILISHA_ACCEPTED_PUBLICATION_SHA256: sha(readFileSync(acceptedFile)),
        WAKILISHA_CURRENT_PUBLICATION_SHA256: sha(readFileSync(currentFile)),
      };
      const passed = spawnSync(process.execPath, [script, "--verify", acceptedFile, currentFile, dir], { env, encoding: "utf8" });
      expect(passed.status, passed.stderr).toBe(0);
      expect(passed.stdout).toContain("PRODUCTION_NETWORK_READS=0");
      expect(passed.stdout).toContain("GOVERNED_PUBLICATION_ARTIFACT_PARITY=PASS");

      put(dir, "current.json", JSON.stringify({ ...accepted, extra: "tamper" }));
      const tampered = spawnSync(process.execPath, [script, "--verify", acceptedFile, currentFile, dir], { env, encoding: "utf8" });
      expect(tampered.status).not.toBe(0);
      expect(tampered.stderr).toContain("current receipt hash mismatch");

      put(dir, "magazine/index.html", html("/changed-canonical"));
      assert.throws(() => auditArtifact(dir, accepted), /Canonical mismatch/);
      put(dir, "magazine/index.html", html("/magazine"));

      accepted.routes.pop();
      accepted.retired.push({
        path: "/magazine",
        source: "static",
        subjectId: "magazine",
        reason: "withdrawn",
        eventSha256: sha("withdrawal"),
      });
      assert.throws(() => auditArtifact(dir, accepted), /Unlisted public sitemap route/);
      put(dir, "sitemap.xml", '<urlset><url><loc>https://wakilisha.africa/</loc></url></urlset>');
      assert.throws(() => auditArtifact(dir, accepted), /Retired route still has public HTML/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
