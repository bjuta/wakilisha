import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCandidate(): string {
  const migrationDir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k4c_p1_playlist_shared_event_convergence.sql",
      ),
    );

  if (matches.length === 1) {
    return fs.readFileSync(
      path.join(migrationDir, matches[0]),
      "utf8",
    );
  }

  expect(matches).toHaveLength(0);
  return fs.readFileSync(
    path.resolve(
      "docs/engineering/work-in-progress/phase-7a-k4c-p1-playlist-shared-event-convergence.sql",
    ),
    "utf8",
  );
}

function functionBody(source: string, name: string): string {
  const declaration = "create or replace function";
  const lowerSource = source.toLowerCase();
  const lowerName = name.toLowerCase();
  let searchFrom = 0;
  let start = -1;

  while (true) {
    const candidate = lowerSource.indexOf(
      declaration,
      searchFrom,
    );
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
    "scripts/control-plane/verify-phase-7a-k4c-p1-playlist-shared-event-convergence.sql",
  ),
  "utf8",
);

describe("Phase 7A K4C-P1 Playlist shared-event convergence", () => {
  it("introduces hardened reusable shared Resource event append helpers", () => {
    expect(migration).toContain(
      "editorial.append_resource_lifecycle_event",
    );
    expect(migration).toContain(
      "editorial.append_resource_review_event",
    );
    expect(migration).toContain(
      "set search_path to\n  'pg_catalog',\n  'editorial',\n  'platform_private'",
    );
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;",
    );
  });

  it("catches up Playlist compatibility history without rewriting source rows", () => {
    expect(migration).toContain(
      "legacy_source_authority = 'playlist_lifecycle'",
    );
    expect(migration).toContain(
      "legacy_source_authority = 'playlist_review'",
    );
    expect(migration).toContain(
      "'playlist_lifecycle',\n  missing.id",
    );
    expect(migration).toContain(
      "'playlist_review',\n  missing.id",
    );
    expect(migration).toContain(
      "K4C-P1 mutated Playlist typed event history",
    );
    expect(migration).not.toMatch(
      /update\s+editorial\.playlist_(review|lifecycle)_events/i,
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+editorial\.playlist_(review|lifecycle)_events/i,
    );
  });

  it("moves Playlist submit to canonical Resource pointers and shared events", () => {
    const body = functionBody(
      migration,
      "public.submit_playlist_for_review",
    );

    expect(body).toContain(
      "v_resource.current_working_version_id",
    );
    expect(body).toContain(
      "v_resource.current_published_version_id",
    );
    expect(body).toContain(
      "update editorial.resources resource_update",
    );
    expect(body).toContain(
      "editorial.append_resource_lifecycle_event",
    );
    expect(body).toContain(
      "editorial.append_resource_review_event",
    );
    expect(body).not.toContain(
      "insert into editorial.playlist_review_events",
    );
    expect(body).not.toContain("v_binding.current_");
  });

  it("targets exact canonical submitted identity during Playlist review", () => {
    const body = functionBody(
      migration,
      "public.review_playlist",
    );

    expect(body).toContain(
      "v_resource.current_submitted_version_id",
    );
    expect(body).toContain(
      "editorial.append_resource_review_event",
    );
    expect(body).toContain(
      "editorial.append_resource_lifecycle_event",
    );
    expect(body).toContain(
      "if p_decision in (\n        'request_changes',\n        'approve'",
    );
    expect(body).not.toContain(
      "insert into editorial.playlist_review_events",
    );
    expect(body).not.toContain("v_binding.current_");
  });

  it("does not invent a lifecycle transition for review_started", () => {
    const body = functionBody(
      migration,
      "public.review_playlist",
    );

    expect(body).toContain("'review_started'");
    expect(body).toContain(
      "if p_decision in (\n        'request_changes',\n        'approve'",
    );
  });

  it("turns the Playlist lifecycle helper into a one-way shared adapter", () => {
    const body = functionBody(
      migration,
      "editorial.append_playlist_lifecycle_event",
    );

    expect(body).toContain(
      "editorial.append_resource_lifecycle_event",
    );
    expect(body).toContain(
      "platform_private.command_receipts",
    );
    expect(body).toContain("'correlation_id'");
    expect(body).not.toContain(
      "insert into editorial.playlist_lifecycle_events",
    );
  });

  it("reads Playlist workspace history and lifecycle position from shared Resource authority", () => {
    const body = functionBody(
      migration,
      "public.get_playlist_review_workspace",
    );

    expect(body).toContain(
      "from editorial.resource_review_events event",
    );
    expect(body).toContain(
      "from editorial.resource_lifecycle_events event",
    );
    expect(body).toContain(
      "v_resource.current_working_version_id",
    );
    expect(body).toContain(
      "v_resource.current_submitted_version_id",
    );
    expect(body).toContain(
      "v_resource.current_approved_version_id",
    );
    expect(body).toContain(
      "v_resource.current_published_version_id",
    );
    expect(body).not.toContain(
      "editorial.playlist_review_events",
    );
    expect(body).not.toContain(
      "editorial.playlist_lifecycle_events",
    );
  });

  it("uses the canonical Resource working pointer in Playlist content fingerprinting", () => {
    const body = functionBody(
      migration,
      "editorial.playlist_current_content_fingerprint",
    );

    expect(body).toContain(
      "resource_row.current_working_version_id",
    );
    expect(body).not.toContain(
      "binding.current_working_version_id",
    );
  });

  it("preserves the accepted public Playlist RPC execution perimeter", () => {
    for (const signature of [
      "public.submit_playlist_for_review",
      "public.review_playlist",
      "public.get_playlist_review_workspace",
    ]) {
      expect(migration).toContain(signature);
    }

    expect(migration).toContain("from public, anon;");
    expect(migration).toContain(
      "to authenticated, service_role;",
    );
    expect(migration).toContain(
      "K4C-P1 broadened anonymous Playlist RPC execution",
    );
  });

  it("does not drop Playlist typed history or K1 pointer compatibility in P1", () => {
    expect(migration).not.toMatch(
      /drop\s+table\s+(?:if\s+exists\s+)?editorial\.playlist_(review|lifecycle)_events/i,
    );
    expect(migration).not.toMatch(
      /drop\s+column\s+current_(working|submitted|approved|published)_version_id/i,
    );
    expect(migration).not.toContain(
      "drop trigger playlist_resources_sync_shared_lifecycle",
    );
  });

  it("does not renew typed Video event authority or rewrite Audio and Article commands", () => {
    expect(migration).not.toMatch(
      /create\s+table\s+video\.(publication_)?(review|lifecycle)_events/i,
    );
    expect(migration).not.toContain(
      "create or replace function public.review_audio_publication",
    );
    expect(migration).not.toContain(
      "create or replace function public.submit_article_for_review",
    );
  });

  it("keeps the permanent verifier read-only and enforces P1 authority ratchets", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain(
      "set local transaction read only;",
    );
    expect(verifier).toContain(
      "PHASE_7A_K4C_P1_PLAYLIST_SHARED_EVENT_CONVERGENCE_PASS",
    );
    expect(verifier).toContain(
      "live function(s) still write Playlist typed event authority",
    );
    expect(verifier).toContain(
      "Playlist public RPC execution perimeter is invalid",
    );
    expect(verifier).toContain(
      "Playlist Resource pointer mirror divergence",
    );
    expect(verifier).toContain(
      "typed Video event authority exists",
    );
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
