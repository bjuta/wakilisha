import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCandidate(): string {
  const migrationDir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k4c_ar1_article_review_editorial_event_convergence.sql",
      ),
    );

  expect(matches).toHaveLength(1);
  return fs.readFileSync(path.join(migrationDir, matches[0]), "utf8");
}

function functionBody(source: string, name: string): string {
  const declaration = "create or replace function";
  const lowerSource = source.toLowerCase();
  const lowerName = name.toLowerCase();
  let searchFrom = 0;
  let start = -1;

  while (true) {
    const candidate = lowerSource.indexOf(declaration, searchFrom);
    if (candidate < 0) break;

    const headerEnd = lowerSource.indexOf("as $function$", candidate);
    if (headerEnd < 0) break;

    const header = lowerSource.slice(candidate, headerEnd);
    if (header.includes(lowerName)) {
      start = candidate;
      break;
    }

    searchFrom = candidate + declaration.length;
  }

  expect(start).toBeGreaterThan(-1);
  const bodyEnd = source.indexOf("$function$;", start);
  expect(bodyEnd).toBeGreaterThan(start);
  return source.slice(start, bodyEnd + "$function$;".length);
}

const migration = readCandidate();
const verifier = fs.readFileSync(
  path.resolve(
    "scripts/control-plane/verify-phase-7a-k4c-ar1-article-review-editorial-event-convergence.sql",
  ),
  "utf8",
);

describe("Phase 7A K4C-AR1 Article review/editorial event convergence", () => {
  it("binds the exact accepted 61/A3 target function authority", () => {
    for (const hash of [
      "26471eff401a949ec29288825a6b4fae",
      "a90d3d8c3a131decab7902ba788b4a84",
      "a5293f222abfee6f9ec3c3107d0a371b",
      "4895ad69e2272d8d07126c20be216197",
      "223b2362b7acacd12b1f7bd33095e400",
    ]) {
      expect(migration).toContain(hash);
    }
  });

  it("catches up legacy Article history without rewriting typed source rows", () => {
    expect(migration).toContain(
      "legacy_source_authority = 'article_lifecycle'",
    );
    expect(migration).toContain(
      "'article_lifecycle',\n  missing.id",
    );
    expect(migration).toContain(
      "changed typed Article lifecycle compatibility history",
    );
    expect(migration).not.toMatch(
      /update\s+editorial\.article_lifecycle_events/i,
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+editorial\.article_lifecycle_events/i,
    );
  });

  it("reuses the accepted shared Resource append helpers byte-for-byte", () => {
    expect(migration).toContain(
      "d84d503da70733c010a93025bca7cda7",
    );
    expect(migration).toContain(
      "54b3f889a5b91bf399bb64b52b830134",
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.append_resource_lifecycle_event/i,
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.append_resource_review_event/i,
    );
  });

  it("creates only an internal legacy Article receipt bridge", () => {
    const body = functionBody(
      migration,
      "platform_private.begin_legacy_authenticated_article_command",
    );

    expect(body).toContain("platform_private.begin_authenticated_resource_command");
    expect(body).toContain("legacy-article:");
    expect(body).toContain("legacy_rpc_bridge");
    expect(body).toContain("extensions.gen_random_uuid()");
    expect(body).toContain(
      "article.review.suggestion.accept",
    );
    expect(migration).toContain(
      "revoke execute\non function platform_private.begin_legacy_authenticated_article_command",
    );
  });

  it("moves Article submit to shared lifecycle and review ledgers without changing the public signature", () => {
    const body = functionBody(
      migration,
      "public.submit_article_for_review",
    );

    expect(body).toContain("p_expected_draft_version bigint");
    expect(body).toContain("article.review.submit");
    expect(body).toContain("current_submitted_version_id = v_version_id");
    expect(body).toContain("editorial.insert_article_lifecycle_version_from_article");
    expect(body).toContain("editorial.append_resource_lifecycle_event");
    expect(body).toContain("editorial.append_resource_review_event");
    expect(body).toContain("platform_private.complete_resource_command");
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("keeps changes-requested semantics and binds the exact reviewed version", () => {
    const body = functionBody(
      migration,
      "public.request_article_changes",
    );

    expect(body).toContain("Requested changes note is required");
    expect(body).toContain("article.review.request_changes");
    expect(body).toContain("v_resource.current_submitted_version_id");
    expect(body).toContain("v_target_version_id");
    expect(body).toContain("lifecycle_state = 'draft'");
    expect(body).toContain("editorial.append_resource_review_event");
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("records approval as reviewed source to immutable approved result", () => {
    const body = functionBody(
      migration,
      "public.approve_article_version",
    );

    expect(body).toContain("article.review.approve");
    expect(body).toContain("editorial.copy_article_lifecycle_version");
    expect(body).toContain("v_source_version_id");
    expect(body).toContain("current_approved_version_id = v_version_id");
    expect(body).toContain(
      "v_source_version_id,\n    v_version_id,\n    'approved'",
    );
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("preserves suggestion audit authority while adding canonical review history", () => {
    const body = functionBody(
      migration,
      "public.accept_article_suggestion",
    );

    expect(body).toContain("article.review.suggestion.accept");
    expect(body).toContain("editorial.apply_article_review_snapshot");
    expect(body).toContain("editorial.article_suggestion_events");
    expect(body).toContain("remaining_open_suggestions_marked_stale");
    expect(body).toContain("v_thread.target_version_id");
    expect(body).toContain("v_new_version_id");
    expect(body).toContain("editorial.append_resource_review_event");
    expect(body).not.toContain("insert into editorial.article_lifecycle_events");
  });

  it("leaves the stale suggestion branch behavior unchanged", () => {
    const body = functionBody(
      migration,
      "public.accept_article_suggestion",
    );
    const bridgeIndex = body.indexOf(
      "platform_private.begin_legacy_authenticated_article_command",
    );
    const staleReturnIndex = body.indexOf(
      "decision_status := 'stale'",
    );

    expect(staleReturnIndex).toBeGreaterThan(-1);
    expect(bridgeIndex).toBeGreaterThan(staleReturnIndex);
    expect(body).toContain(
      "Suggestion no longer targets the active submitted version",
    );
  });

  it("moves list_article_lifecycle_events to shared Resource history without changing its return shape", () => {
    const body = functionBody(
      migration,
      "public.list_article_lifecycle_events",
    );

    expect(body).toContain("returns table(");
    expect(body).toContain("actor_label text");
    expect(body).toContain("editorial.article_resources");
    expect(body).toContain("editorial.resource_lifecycle_events");
    expect(body).toContain("editorial.article_versions");
    expect(body).toContain("auth.users");
    expect(body).not.toContain("editorial.article_lifecycle_events");
  });

  it("leaves all six AR2 publication and scheduling functions byte-pinned", () => {
    for (const hash of [
      "d3c2a715d0596e4033e7e319c0b3d4f4",
      "09b9ecbbec742481f6146fdaa250b435",
      "105d47e009ec279e3a7e5a362662a31d",
      "8f52aca8823b4d23ec995526745176dc",
      "bc19cc8ba0945d118d743eb709b80d2d",
      "d4239c78dd5cbb2f7da7823b7cf60873",
    ]) {
      expect(migration).toContain(hash);
      expect(verifier).toContain(hash);
    }
  });

  it("keeps AR1 command vocabulary narrow and explicit", () => {
    for (const command of [
      "article.review.submit",
      "article.review.request_changes",
      "article.review.approve",
      "article.review.suggestion.accept",
    ]) {
      expect(migration).toContain(command);
      expect(verifier).toContain(command);
    }

    expect(migration).not.toContain("article.publish");
    expect(migration).not.toContain("article.schedule");
  });

  it("keeps Playlist, Audio, and Video convergence ratchets in the permanent verifier", () => {
    expect(verifier).toContain("playlist_resources");
    expect(verifier).toContain("audio_publication_resources");
    expect(verifier).toContain("video.publication_review_events");
    expect(verifier).toContain("video.publication_lifecycle_events");
    expect(verifier).toContain(
      "PHASE_7A_K4C_AR1_ARTICLE_REVIEW_EDITORIAL_EVENT_CONVERGENCE_PASS",
    );
  });
});
