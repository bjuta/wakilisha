import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817201000_post_thread_publish_actor_resolution_fix.sql",
  "utf8",
);

describe("WAKILISHA M8C.3 Thread publication actor resolution", () => {
  it("does not aggregate nullable UUID actor identities", () => {
    expect(migration).not.toContain("min(draft.person_resource_id)");
    expect(migration).not.toContain("min(draft.artist_id)");
  });

  it("resolves the authored identity from the first deterministic Draft row", () => {
    expect(migration).toContain("select count(*) into v_count");
    expect(migration).toContain("order by draft.position,draft.id");
    expect(migration).toContain("limit 1;");
  });

  it("retains the same-author guard across the whole Draft group", () => {
    expect(migration).toContain("thread_draft_actor_mismatch");
    expect(migration).toContain(
      "draft.person_resource_id is distinct from v_person_id",
    );
    expect(migration).toContain(
      "draft.artist_id is distinct from v_artist_id",
    );
  });

  it("still publishes through canonical Post and Quote Post writers", () => {
    expect(migration).toContain("public.community_publish_post(");
    expect(migration).toContain("public.community_quote_post(");
    expect(migration).toContain("public.community_get_post(v_post_id)");
    expect(migration).toContain("delete from private.community_post_drafts draft");
  });

  it("self-checks that the invalid UUID aggregate cannot survive deployment", () => {
    expect(migration).toContain("pg_get_functiondef");
    expect(migration).toContain("UUID aggregate actor resolution is still present");
    expect(migration).toContain("deterministic authored identity resolution did not land");
  });
});
