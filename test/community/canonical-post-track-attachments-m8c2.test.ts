import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260816235000_community_post_track_attachments.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-community-post-track-attachments.sql",
  "utf8",
);

describe("WAKILISHA M8C.2 canonical Post Track authority", () => {
  it("adds one canonical Registry Track reference instead of a parallel attachment table", () => {
    expect(migration).toContain("add column registry_track_id uuid");
    expect(migration).toContain("references public.registry_tracks(id)");
    expect(migration).not.toContain("create table public.community_post_track");
    expect(migration).not.toContain("create table public.post_track");
  });

  it("removes caption-first validity while keeping completely empty Posts invalid", () => {
    expect(migration).toContain("drop constraint artist_updates_body_length");
    expect(migration).toContain("community_posts_body_length");
    expect(migration).toContain("community_posts_content_required");
    expect(migration).toContain("nullif(btrim(body),'') is not null");
    expect(migration).toContain("or registry_track_id is not null");
    expect(migration).toContain("if char_length(v_body)>2000");
    expect(migration).toContain("invalid_post_content");
    expect(migration).not.toContain("char_length(v_body) not between 1 and 2000");
  });

  it("accepts only active canonical Registry Tracks on writes", () => {
    expect(migration).toContain("where track.id=p_registry_track_id");
    expect(migration).toContain("and track.status='active'");
    expect(migration).toContain("post_track_not_available");
  });

  it("retires old PostgREST writer signatures instead of leaving RPC overloads", () => {
    expect(migration).toContain(
      "drop function public.community_publish_post(text,uuid,text,text,text,text);",
    );
    expect(migration).toContain(
      "drop function public.community_edit_post(uuid,text,text,text,text);",
    );
    expect(migration).toContain(
      "drop function public.community_quote_post(text,uuid,uuid,text,text,text,text);",
    );
    expect(migration).toContain(
      "community_publish_post(text,uuid,text,text,text,text,uuid)",
    );
    expect(migration).toContain(
      "community_edit_post(uuid,text,text,text,text,uuid)",
    );
    expect(migration).toContain(
      "community_quote_post(text,uuid,uuid,text,text,text,text,uuid)",
    );
  });

  it("keeps existing Person and Artist posting authority while extending content", () => {
    expect(migration).toContain("editorial.current_person_post_actor()");
    expect(migration).toContain("editorial.current_artist_representation");
    expect(migration).toContain("v_rep.can_post_updates");
    expect(migration).toContain("artist_update_published");
    expect(migration).toContain("artist_update_edited");
  });

  it("preserves truthful Block semantics for quoted Posts", () => {
    expect(migration).toContain("private.community_is_blocked_target");
    expect(migration).toContain("'unavailable_reason','blocked'");
    expect(migration).toContain("'unavailable_reason','unavailable'");
  });

  it("hydrates a public-safe Track payload through the one canonical Post reader", () => {
    expect(migration).toContain("private.community_present_post_track");
    expect(migration).toContain("'track',v_track");
    expect(migration).toContain("'track',v_quoted_track");
    expect(migration).toContain("coalesce(track.artwork_url,release.artwork_url)");
    expect(migration).toContain("where track.id=p_registry_track_id");
    expect(migration).toContain("and track.status='active'");
  });

  it("keeps bodyless Posts addressable in Following instead of dropping them at decode", () => {
    expect(migration).toContain("community_get_social_feed_legacy_m8c2");
    expect(migration).toContain("item.value->'post'->'track'->>'title'");
    expect(migration).toContain("item.value->'post'->>'link_label'");
    expect(migration).toContain("'Post from '");
    expect(migration).toContain(
      "'community_get_social_feed(integer,timestamp with time zone,text)'",
    );
    expect(verifier).toContain("social_feed_legacy_wrapper");
  });

  it("updates the reviewed RPC classification ledger to the new signatures", () => {
    expect(migration).toContain("delete from private.phase_0a_rpc_classification");
    expect(migration).toContain("'authenticated_command'");
    expect(verifier).toContain("old_publish_retired");
    expect(verifier).toContain("old_edit_retired");
    expect(verifier).toContain("old_quote_retired");
  });

  it("ships a read-only verifier", () => {
    expect(verifier).toContain("begin read only;");
    expect(verifier).toContain("rollback;");
    expect(verifier).not.toContain("insert into");
    expect(verifier).not.toContain("alter table");
  });

  it("keeps new runtime SQL copy free of em and en dashes", () => {
    expect(migration).not.toContain("—");
    expect(migration).not.toContain("–");
  });
});
