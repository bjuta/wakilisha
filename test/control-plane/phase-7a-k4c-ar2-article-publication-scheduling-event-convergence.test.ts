import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCandidate(): string {
  const migrationDir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k4c_ar2_article_publication_scheduling_event_convergence.sql",
      ),
    );

  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(migrationDir, matches[0]), "utf8");
}

function functionBody(source: string, name: string): string {
  const declaration = "create or replace function";
  const createDeclaration = "create function";
  const lowerSource = source.toLowerCase();
  const lowerName = name.toLowerCase();
  let searchFrom = 0;
  let start = -1;

  while (true) {
    const replaceCandidate = lowerSource.indexOf(declaration, searchFrom);
    const createCandidate = lowerSource.indexOf(createDeclaration, searchFrom);
    const candidates = [replaceCandidate, createCandidate].filter(
      (candidate) => candidate >= 0,
    );

    if (candidates.length === 0) break;

    const candidate = Math.min(...candidates);
    const headerEnd = lowerSource.indexOf("as $function$", candidate);
    if (headerEnd < 0) break;

    const header = lowerSource.slice(candidate, headerEnd);
    if (header.includes(lowerName)) {
      start = candidate;
      break;
    }

    searchFrom = candidate + 1;
  }

  expect(start).toBeGreaterThan(-1);
  const bodyEnd = source.indexOf("$function$;", start);
  expect(bodyEnd).toBeGreaterThan(start);
  return source.slice(start, bodyEnd + "$function$;".length);
}

const migration = readCandidate();
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4c-ar2-article-publication-scheduling-event-convergence.sql",
  ),
  "utf8",
);

describe("Phase 7A K4C-AR2 Article publication/scheduling convergence", () => {
  it("pins the exact accepted 62/AR1 publication authority", () => {
    for (const hash of [
      "d3c2a715d0596e4033e7e319c0b3d4f4",
      "09b9ecbbec742481f6146fdaa250b435",
      "105d47e009ec279e3a7e5a362662a31d",
      "8f52aca8823b4d23ec995526745176dc",
      "bc19cc8ba0945d118d743eb709b80d2d",
      "d4239c78dd5cbb2f7da7823b7cf60873",
    ]) {
      expect(migration).toContain(hash);
    }
  });

  it("catches up post-AR1 typed lifecycle history without modifying typed source rows", () => {
    expect(migration).toContain(
      "legacy_source_authority = 'article_lifecycle'",
    );
    expect(migration).toContain(
      "'article_lifecycle',\n  missing.id",
    );
    expect(migration).not.toMatch(
      /update\s+editorial\.article_lifecycle_events/i,
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+editorial\.article_lifecycle_events/i,
    );
  });

  it("reuses shared lifecycle and publication snapshot primitives byte-pinned", () => {
    expect(migration).toContain("d84d503da70733c010a93025bca7cda7");
    expect(migration).toContain("790c6a5667abd56406ed6fe8eb174997");
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.append_resource_lifecycle_event/i,
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.publish_article_snapshot/i,
    );
  });

  it("extends the accepted authenticated Article bridge instead of forking another editor bridge", () => {
    const body = functionBody(
      migration,
      "platform_private.begin_legacy_authenticated_article_command",
    );

    for (const command of [
      "article.review.submit",
      "article.review.request_changes",
      "article.review.approve",
      "article.review.suggestion.accept",
      "article.publication.publish",
      "article.publication.schedule",
      "article.publication.publish_scheduled",
      "article.publication.unpublish",
      "article.publication.archive",
      "article.publication.restore",
    ]) {
      expect(body).toContain(command);
    }

    expect(body).toContain(
      "platform_private.begin_authenticated_resource_command",
    );
  });

  it("creates one internal service-only scheduled publication receipt bridge", () => {
    const body = functionBody(
      migration,
      "platform_private.begin_legacy_service_article_command",
    );

    expect(body).toContain("service:service_role");
    expect(body).toContain("legacy-scheduled-article:");
    expect(body).toContain("scheduled_publication_id");
    expect(body).toContain(
      "platform_private.command_request_fingerprint",
    );
    expect(body).toContain("actor_user_id");
    expect(body).toContain("null");
    expect(migration).toContain(
      "revoke execute\non function platform_private.begin_legacy_service_article_command",
    );
  });

  it("moves direct publish onto shared lifecycle authority without changing snapshot publication", () => {
    const body = functionBody(migration, "public.publish_article_version");

    expect(body).toContain("article.publication.publish");
    expect(body).toContain("editorial.copy_article_lifecycle_version");
    expect(body).toContain("editorial.publish_article_snapshot");
    expect(body).toContain("current_published_version_id = v_version_id");
    expect(body).toContain("publication_mode");
    expect(body).toContain("editorial.append_resource_lifecycle_event");
    expect(body).toContain("platform_private.complete_resource_command");
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("repairs only the known scheduler version_kind defect while preserving schedule authority", () => {
    const body = functionBody(
      migration,
      "public.schedule_article_publication",
    );

    expect(body).toContain("version.version_kind = 'approved'");
    expect(body).not.toContain("version.kind = 'approved'");
    expect(body).toContain("Scheduled publish time must be in the future");
    expect(body).toContain("editorial.article_scheduled_publications");
    expect(body).toContain("returning id");
    expect(body).toContain("scheduledPublicationId");
    expect(body).toContain("article.publication.schedule");
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("creates one receipt per due scheduled Article and preserves skip-locked batch execution", () => {
    const body = functionBody(
      migration,
      "public.publish_due_article_publications",
    );

    expect(body).toContain("for update skip locked");
    expect(body).toContain(
      "platform_private.begin_legacy_service_article_command",
    );
    expect(body).toContain(
      "platform_private.begin_legacy_authenticated_article_command",
    );
    expect(body).toContain("article.publication.publish_scheduled");
    expect(body).toContain("scheduledPublicationId");
    expect(body).toContain("status = 'published'");
    expect(body).toContain("editorial.publish_article_snapshot");
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("moves unpublish, archive, and restore onto shared lifecycle authority", () => {
    for (const [name, command, action] of [
      [
        "public.unpublish_article",
        "article.publication.unpublish",
        "'unpublished'",
      ],
      [
        "public.archive_article",
        "article.publication.archive",
        "'archived'",
      ],
      [
        "public.restore_article_from_archive",
        "article.publication.restore",
        "'restored'",
      ],
    ]) {
      const body = functionBody(migration, name);
      expect(body).toContain(command);
      expect(body).toContain(action);
      expect(body).toContain("editorial.append_resource_lifecycle_event");
      expect(body).toContain("platform_private.complete_resource_command");
      expect(body).not.toContain("insert into editorial.article_lifecycle_events");
    }
  });

  it("registers exactly the six bounded AR2 publication command types", () => {
    for (const command of [
      "article.publication.publish",
      "article.publication.schedule",
      "article.publication.publish_scheduled",
      "article.publication.unpublish",
      "article.publication.archive",
      "article.publication.restore",
    ]) {
      expect(migration).toContain(command);
      expect(verifier).toContain(command);
    }
  });

  it("restores the accepted public Article publication RPC ACL explicitly", () => {
    for (const signature of [
      "public.publish_article_version(",
      "public.schedule_article_publication(",
      "public.publish_due_article_publications(integer)",
      "public.unpublish_article(uuid,text)",
      "public.archive_article(uuid,text)",
      "public.restore_article_from_archive(uuid,text)",
    ]) {
      expect(migration).toContain(signature);
    }

    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("to authenticated, service_role;");
  });

  it("pins AR1 review RPCs so publication convergence cannot rewrite review authority", () => {
    for (const hash of [
      "539bf98f189212294b8e1ce65d97e00e",
      "0421228df4bf205da2f663cc14c41e80",
      "707058aadc9c53746bfcaaa62d893f7f",
      "d92af169eeb9e48e65e4c749cf9e6403",
      "f5c977c58e87556e18f0fd07573dabe3",
    ]) {
      expect(verifier).toContain(hash);
    }
  });

  it("pins the two deferred AR3 typed-history readers unchanged", () => {
    expect(migration).toContain("3bdd9467a857da7a8f6373a50e237295");
    expect(migration).toContain("f89b6060e68ae2e1154f689a741dc831");
    expect(verifier).toContain(
      "editorial.correction_article_publication_proof",
    );
    expect(verifier).toContain(
      "editorial.derive_publishing_editorial_state",
    );
  });

  it("requires zero typed Article writers after AR2 while leaving exactly two AR3 readers", () => {
    expect(verifier).toContain(
      "typed Article lifecycle writers remain",
    );
    expect(verifier).toContain(
      "remaining_typed_article_writer_count",
    );
    expect(verifier).toContain(
      "remaining_typed_article_reader_count",
    );
    expect(verifier).toContain(
      "PHASE_7A_K4C_AR2_ARTICLE_PUBLICATION_SCHEDULING_EVENT_CONVERGENCE_PASS",
    );
  });

  it("keeps Playlist, Audio, and Video convergence ratchets closed", () => {
    expect(verifier).toContain("playlist_resources");
    expect(verifier).toContain("audio_publication_resources");
    expect(verifier).toContain("video.publication_review_events");
    expect(verifier).toContain("video.publication_lifecycle_events");
  });
});
