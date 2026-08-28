import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

function readCandidate(): string {
  const migrationDir = path.resolve("supabase/migrations");
  const matches = fs
    .readdirSync(migrationDir)
    .filter((name) =>
      name.endsWith(
        "_phase_7a_k4c_a1_audio_shared_event_convergence.sql",
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
    "scripts/control-plane/verify-phase-7a-k4c-a1-audio-shared-event-convergence.sql",
  ),
  "utf8",
);

describe("Phase 7A K4C-A1 Audio shared-event convergence", () => {
  it("catches up typed Audio compatibility history without rewriting source rows", () => {
    expect(migration).toContain(
      "legacy_source_authority = 'audio_publication_lifecycle'",
    );
    expect(migration).toContain(
      "legacy_source_authority = 'audio_publication_review'",
    );
    expect(migration).toContain(
      "'audio_publication_lifecycle',\n  missing.id",
    );
    expect(migration).toContain(
      "'audio_publication_review',\n  missing.id",
    );
    expect(migration).toContain(
      "K4C-A1 mutated typed Audio event history",
    );
    expect(migration).not.toMatch(
      /update\s+audio\.publication_(review|lifecycle)_events/i,
    );
    expect(migration).not.toMatch(
      /delete\s+from\s+audio\.publication_(review|lifecycle)_events/i,
    );
  });

  it("requires the accepted shared append helpers without recreating them", () => {
    expect(migration).toContain(
      "editorial.append_resource_lifecycle_event",
    );
    expect(migration).toContain(
      "editorial.append_resource_review_event",
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.append_resource_lifecycle_event/i,
    );
    expect(migration).not.toMatch(
      /create\s+or\s+replace\s+function\s+editorial\.append_resource_review_event/i,
    );
  });

  it("moves Audio submit to canonical Resource pointers and shared events", () => {
    const body = functionBody(
      migration,
      "public.submit_audio_publication_for_review",
    );

    expect(body).toContain("v_resource");
    expect(body).toContain("update editorial.resources resource_update");
    expect(body).toContain("current_submitted_version_id");
    expect(body).toContain(
      "current_submitted_version_id = v_snapshot.version_id",
    );
    expect(migration).toContain(
      "position(\'current_submitted_version_id = v_snapshot.version_id\' in v_definition) = 0",
    );
    expect(verifier).toContain(
      "position(\'current_submitted_version_id = v_snapshot.version_id\' in v_definition) = 0",
    );
    expect(body).toContain("current_approved_version_id = null");
    expect(body).toContain("editorial.append_resource_lifecycle_event");
    expect(body).toContain("editorial.append_resource_review_event");
    expect(body).toContain("audio.insert_current_publication_snapshot");
    expect(body).toContain("audio.current_publication_master");
    expect(body).toContain("audio_publication_media_not_publishable");
    expect(body).not.toContain("insert into audio.publication_review_events");
    expect(body).not.toContain("update editorial.audio_publication_resources");
  });

  it("keeps submit Media public-safety gates intact", () => {
    const body = functionBody(
      migration,
      "public.submit_audio_publication_for_review",
    );

    for (const required of [
      "audio_delivery",
      "audio/mpeg",
      "approved_public",
      "approved_redacted",
      "granted",
      "not_required",
      "restricted",
      "released",
      "https://media.wakilisha.africa/derivatives/",
    ]) {
      expect(body).toContain(required);
    }
  });

  it("targets exact canonical submitted identity during Audio review", () => {
    const body = functionBody(
      migration,
      "public.review_audio_publication",
    );

    expect(body).toContain("v_resource.current_submitted_version_id");
    expect(body).toContain("audio_submitted_version_stale");
    expect(body).toContain("audio.copy_publication_version_snapshot");
    expect(body).toContain("editorial.append_resource_review_event");
    expect(body).toContain("editorial.append_resource_lifecycle_event");
    expect(body).toContain("update editorial.resources resource_update");
    expect(body).not.toContain("insert into audio.publication_review_events");
    expect(body).not.toContain("v_binding.current_submitted_version_id");
  });

  it("does not invent a lifecycle transition for review_started", () => {
    const body = functionBody(
      migration,
      "public.review_audio_publication",
    );

    expect(body).toContain("'review_started'");
    expect(body).toContain(
      "if p_decision in (\n        'request_changes',\n        'approve'",
    );
    expect(body).toContain("v_prior_lifecycle_status");
  });

  it("publishes exact canonical approved identity while preserving Media and feed contracts", () => {
    const body = functionBody(
      migration,
      "public.publish_audio_publication_version",
    );

    expect(body).toContain("v_resource.current_approved_version_id");
    expect(body).toContain("current_published_version_id = v_published.version_id");
    expect(body).toContain("editorial.append_resource_lifecycle_event");
    expect(body).toContain("audio.assert_publishable_version_media");
    expect(body).toContain("audio.copy_publication_version_snapshot");
    expect(body).toContain("audio.publication_feed_identities");
    expect(body).toContain("audio.publication_snapshots");
    expect(body).toContain("'urn:uuid:'");
    expect(body).toContain("https://wakilisha.africa/audio/enclosures/");
    expect(body).not.toContain("update editorial.audio_publication_resources");
  });

  it("turns the Audio lifecycle helper into a one-way shared adapter", () => {
    const body = functionBody(
      migration,
      "audio.append_publication_lifecycle_event",
    );

    expect(body).toContain("editorial.append_resource_lifecycle_event");
    expect(body).toContain("platform_private.command_receipts");
    expect(body).toContain("correlation_id");
    expect(body).toContain("publication_id");
    expect(body).not.toContain("insert into audio.publication_lifecycle_events");
    expect(body).toContain(
      "set search_path to\n  'pg_catalog',\n  'audio'",
    );
  });

  it("moves admin workspace history and lifecycle position to shared Resource authority", () => {
    const body = functionBody(
      migration,
      "public.get_admin_audio_publication_workspace",
    );

    expect(body).toContain("from editorial.resource_review_events e");
    expect(body).toContain("from editorial.resource_lifecycle_events e");
    expect(body).toContain("v_resource.current_working_version_id");
    expect(body).toContain("v_resource.current_submitted_version_id");
    expect(body).toContain("v_resource.current_approved_version_id");
    expect(body).toContain("v_resource.current_published_version_id");
    expect(body).not.toContain("audio.publication_review_events");
    expect(body).not.toContain("audio.publication_lifecycle_events");

    for (const key of [
      "'publication'",
      "'versions'",
      "'master'",
      "'transcript'",
      "'chapters'",
      "'review_events'",
      "'lifecycle_events'",
      "'trust'",
      "'feed_identity'",
    ]) {
      expect(body).toContain(key);
    }
  });

  it("keeps the Audio editorial workbench version-bound while switching submitted pointer authority", () => {
    const body = functionBody(
      migration,
      "public.get_audio_editorial_workbench",
    );

    expect(body).toContain("v_resource.current_submitted_version_id");
    expect(body).not.toContain("v_binding.current_submitted_version_id");
    expect(body).toContain("audio.publication_version_review_media");
    expect(body).toContain("audio.publication_version_chapters");
    expect(body).toContain("audio.publication_review_threads");
    expect(body).toContain("audio.publication_review_comments");
    expect(body).toContain("'waveform_url'");
    expect(body).toContain("'duration_seconds'");
  });

  it("binds timed review creation and trigger integrity to exact canonical submitted version", () => {
    const createBody = functionBody(
      migration,
      "public.create_audio_time_review_thread",
    );
    const triggerBody = functionBody(
      migration,
      "audio.assert_publication_review_thread_integrity",
    );

    expect(createBody).toContain("v_resource.current_submitted_version_id");
    expect(createBody).not.toContain("v_binding.current_submitted_version_id");
    expect(createBody).toContain("'time_point'");
    expect(createBody).toContain("'time_range'");
    expect(createBody).toContain("audio.publication_review_threads");
    expect(createBody).toContain("audio.publication_review_comments");

    expect(triggerBody).toContain("v_resource.current_submitted_version_id");
    expect(triggerBody).not.toContain("v_binding.current_submitted_version_id");
    expect(triggerBody).toContain("audio.publication_version_review_media");
    expect(triggerBody).toContain("duration_seconds");
  });

  it("preserves public RPC and internal helper security perimeters", () => {
    expect(migration).toContain("from public, anon;");
    expect(migration).toContain("to authenticated, service_role;");
    expect(migration).toContain(
      "from public, anon, authenticated, service_role;",
    );

    for (const functionName of [
      "public.submit_audio_publication_for_review",
      "public.review_audio_publication",
      "public.publish_audio_publication_version",
      "public.get_admin_audio_publication_workspace",
      "public.get_audio_editorial_workbench",
      "public.create_audio_time_review_thread",
    ]) {
      expect(migration).toContain(functionName);
    }
  });

  it("retains typed Audio event tables and all four K1 pointer mirrors in A1", () => {
    expect(migration).not.toMatch(
      /drop\s+table\s+(?:if\s+exists\s+)?audio\.publication_(review|lifecycle)_events/i,
    );
    expect(migration).not.toMatch(
      /drop\s+column\s+current_(working|submitted|approved|published)_version_id/i,
    );
    expect(migration).not.toContain(
      "drop trigger audio_publication_resources_sync_shared_lifecycle",
    );
  });

  it("does not migrate timed review discussion into shared event ledgers", () => {
    expect(migration).not.toMatch(
      /insert\s+into\s+editorial\.resource_(review|lifecycle)_events[\s\S]{0,500}publication_review_(threads|comments)/i,
    );
    expect(migration).not.toMatch(
      /drop\s+table\s+(?:if\s+exists\s+)?audio\.publication_review_(threads|comments)/i,
    );
  });

  it("keeps Playlist P3 and Video typed-event ratchets intact", () => {
    expect(migration).toContain("Playlist P3 pointer retirement");
    expect(migration).toContain("A1 renewed typed Video event authority");
    expect(migration).not.toMatch(
      /add\s+column\s+current_(working|submitted|approved|published)_version_id/i,
    );
    expect(migration).not.toMatch(
      /create\s+table\s+video\.(publication_)?(review|lifecycle)_events/i,
    );
  });

  it("keeps the permanent verifier read-only and enforces all A1 authority ratchets", () => {
    expect(verifier).toMatch(/^begin;/);
    expect(verifier).toContain("set local transaction read only;");
    expect(verifier).toContain(
      "PHASE_7A_K4C_A1_AUDIO_SHARED_EVENT_CONVERGENCE_PASS",
    );
    expect(verifier).toContain(
      "live function(s) still write Audio typed event authority",
    );
    expect(verifier).toContain(
      "Audio submit shared-event or Media contract drifted",
    );
    expect(verifier).toContain(
      "Audio review shared-event authority drifted",
    );
    expect(verifier).toContain(
      "Audio publish shared lifecycle/feed identity drifted",
    );
    expect(verifier).toContain(
      "Audio editorial workbench timed-review contract drifted",
    );
    expect(verifier).toContain(
      "Audio Resource pointer mirror divergence",
    );
    expect(verifier).toContain("Playlist P3 pointer retirement regressed");
    expect(verifier).toContain("typed Video event authority exists");
    expect(verifier).toContain("Audio public RPC execution perimeter is invalid");
    expect(verifier).not.toMatch(
      /^\s*(insert|update|delete|alter|drop|create|grant|revoke)\b/im,
    );
  });
});
