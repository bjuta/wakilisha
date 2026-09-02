import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Community Track Registry identity", () => {
  const migration = readFileSync(
    "supabase/migrations/20260901170500_community_track_registry_identity.sql",
    "utf8",
  );
  const verifier = readFileSync(
    "scripts/control-plane/verify-community-track-registry-identity.sql",
    "utf8",
  );
  const drawer = readFileSync(
    "src/components/feature/community/TrackMomentDrawer.tsx",
    "utf8",
  );
  const overlay = readFileSync(
    "src/components/feature/community/TrackMomentPlaybackOverlay.tsx",
    "utf8",
  );

  it("keeps Registry Track ID as durable Community identity", () => {
    expect(drawer).toContain(
      "playerTrackIdentity(track)",
    );
    expect(drawer).toContain(
      "id: trackIdentity",
    );
    expect(overlay).toContain(
      "id: playerTrackIdentity(track)",
    );
    expect(drawer).toContain(
      "slug: trackSlug",
    );
    expect(overlay).toContain(
      "slug: trackSlug",
    );
  });

  it("retires global Track slug uniqueness without weakening non-Track uniqueness", () => {
    expect(migration).toContain(
      "drop constraint if exists community_threads_entity_type_entity_slug_key",
    );
    expect(migration).toContain(
      "community_threads_non_track_entity_slug_key",
    );
    expect(migration).toContain(
      "where entity_type <> 'track'",
    );
    expect(verifier).toContain(
      "community_threads_entity_type_entity_id_key",
    );
  });

  it("backfills only deterministic unique Track targets", () => {
    expect(migration).toContain(
      "primary_route_match",
    );
    expect(migration).toContain(
      "redirect_route_match",
    );
    expect(migration).toContain(
      "artist_credit_match",
    );
    expect(migration).toContain(
      "global_unique_slug_match",
    );
    expect(migration).toContain(
      "having count(*) = 1",
    );
    expect(migration).toContain(
      "entity_id = safe.track_id::text",
    );
  });

  it("makes Track thread resolution Registry-ID-first and preserves exact-route legacy binding", () => {
    expect(migration).toContain(
      "v_canonical_track_id",
    );
    expect(migration).toContain(
      "thread.entity_id =",
    );
    expect(migration).toContain(
      "v_canonical_track_id::text",
    );
    expect(migration).toContain(
      "v_legacy_count = 1",
    );
    expect(migration).toContain(
      "registry_track_artists",
    );
    expect(migration).toContain(
      "'/tracks/' ||",
    );
  });

  it("fails closed when canonical Track UUID disagrees with the supplied route", () => {
    expect(migration).toContain(
      "Canonical Registry Track identity does not match the supplied Track route",
    );
    expect(migration).toContain(
      "and v_canonical_track_id is null",
    );
    expect(migration).toContain(
      "using errcode = '22023'",
    );
  });

  it("preserves the public read and authenticated write boundaries", () => {
    expect(migration).toContain(
      "to anon, authenticated, service_role",
    );
    expect(migration).toContain(
      "from public, anon",
    );
    expect(migration).toContain(
      "to authenticated, service_role",
    );
    expect(verifier).toContain(
      "has_function_privilege",
    );
  });

  it("ships a permanent read-only verifier", () => {
    expect(verifier).toContain(
      "community_track_registry_identity_pass",
    );
    expect(verifier).toContain(
      "registry_bound_track_threads",
    );
    expect(verifier).toContain(
      "legacy_unbound_track_threads",
    );
  });
});
