import { collectWithClient, DEFINITIONS as SOURCE_SCAN_TABLES, stableJson as stableSourceJson, exactEnvironment as exactSourceEnvironment } from "../../scripts/seo/collect-governed-publication-source.mjs";

import crypto from "node:crypto";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import { SURFACES, verifyReceipt, differences, extractSeo, auditArtifact } from "../../scripts/seo/verify-governed-publication.mjs";

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

describe("incident-safe offline SEO build", () => {
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


describe("governed source scanning is an out-of-band read-only transaction", () => {
  const fixture = () => {
    const root = mkdtempSync(path.join(tmpdir(), "wk-source-scan-"));
    for (const name of ["src/router/config.tsx", "public/seo-prerender-routes.txt", "scripts/seo/prerender-metadata.mjs"]) {
      const target = path.join(root, name);
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, name + "\n");
    }
    return root;
  };

  const mockDb = (options: { writeGrant?: boolean; drift?: boolean; bypassRls?: boolean } = {}) => {
    const commands: string[] = [];
    let title = "Published";
    const client = {
      async query(sql: string, args?: unknown[]) {
        commands.push(sql);
        if (sql.startsWith("BEGIN") || sql.startsWith("SET LOCAL") || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
        if (sql.includes("current_user AS role")) return { rows: [{
          role: "supabase_read_only_user", database: "postgres", read_only: "on",
          isolation: "repeatable read", tx_snapshot: "5:5:", captured_at: "2026-11-14T10:00:00Z",
        }] };
        if (sql.includes("FROM pg_roles")) return { rows: [{
          rolsuper: false, rolbypassrls: options.bypassRls !== false,
          rolcreaterole: false, rolcreatedb: false, rolreplication: false,
        }] };
        if (sql.includes("to_regclass")) return { rows: [{
          relkind: "r", sel: true, ins: Boolean(options.writeGrant), upd: false, del: false, trunc: false,
        }] };
        if (sql.startsWith("SELECT txid_current_snapshot()")) return { rows: [{
          tx_snapshot: options.drift ? "different" : "5:5:", captured_at: "2026-11-14T10:00:00Z",
        }] };
        if (sql.includes("to_jsonb(src)")) return { rows:
          sql.includes('"wk_articles"') && Number(args?.[1]) === 0
            ? [{ row: { id: "a1", title } }] : [],
        };
        throw new Error("Unexpected source-scan SQL");
      },
    };
    return { client, commands, change: () => { title = "Corrected"; } };
  };

  it("fingerprints source corrections and preserves one bounded repeatable-read transaction", async () => {
    const root = fixture();
    try {
      const db = mockDb();
      const first = await collectWithClient(db.client, { role: "supabase_read_only_user", repositoryRoot: root });
      expect(first.sourceEpoch).toMatch(/^[a-f0-9]{64}$/);
      expect(first.completeSourceScan).toBe(true);
      expect(first.publicationReceipt).toBe(false);
      expect(first.publicationActivationAuthority).toBe(false);
      expect(first.tables.articles.rowCount).toBe(1);
      expect(Object.keys(first.surfaces)).toHaveLength(15);
      expect(db.commands[0]).toContain("REPEATABLE READ READ ONLY");
      expect(db.commands.at(-1)).toBe("COMMIT");
      expect(JSON.stringify(first)).not.toContain("Published");
      expect(stableSourceJson({ z: 1, a: { y: 2, b: 3 } }))
        .toBe(stableSourceJson({ a: { b: 3, y: 2 }, z: 1 }));
      db.change();
      const corrected = await collectWithClient(db.client, { role: "supabase_read_only_user", repositoryRoot: root });
      expect(corrected.sourceEpoch).not.toBe(first.sourceEpoch);
      expect(SOURCE_SCAN_TABLES.length).toBe(37);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects unsafe credentials, write privileges, RLS-filtered readers and torn source snapshots", async () => {
    const env = {
      WAKILISHA_SEO_SOURCE_PROJECT_REF: "pgzizndxdyhqmtyywjmt",
      WAKILISHA_SEO_SOURCE_DB_HOST: "db.pgzizndxdyhqmtyywjmt.supabase.co",
      WAKILISHA_SEO_SOURCE_DB_ROLE: "supabase_read_only_user",
      WAKILISHA_SEO_SOURCE_DATABASE_URL: "postgres://supabase_read_only_user:fixture@db.pgzizndxdyhqmtyywjmt.supabase.co/postgres",
    };
    expect(exactSourceEnvironment(env).config.ssl.rejectUnauthorized).toBe(true);
    expect(() => exactSourceEnvironment({ ...env, WAKILISHA_SEO_SOURCE_PROJECT_REF: "other" })).toThrow("Unapproved");
    expect(() => exactSourceEnvironment({ ...env, WAKILISHA_SEO_SOURCE_DATABASE_URL: env.WAKILISHA_SEO_SOURCE_DATABASE_URL + "?sslmode=no-verify" })).toThrow("no connection-string overrides");
    const root = fixture();
    try {
      for (const options of [{ writeGrant: true }, { bypassRls: false }, { drift: true }]) {
        const db = mockDb(options);
        await expect(collectWithClient(db.client, {
          role: "supabase_read_only_user", repositoryRoot: root,
        })).rejects.toThrow();
        expect(db.commands.at(-1)).toBe("ROLLBACK");
        expect(db.commands).not.toContain("COMMIT");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
