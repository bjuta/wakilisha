import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817184500_post_thread_presentation.sql",
  "utf8",
);

describe("WAKILISHA M8C.3 authored Thread presentation", () => {
  it("wraps the canonical Post reader without replacing Post identity", () => {
    expect(migration).toContain(
      "alter function public.community_get_post(uuid)",
    );
    expect(migration).toContain("community_get_post_legacy_m8c3");
    expect(migration).toContain("'thread_id',v_thread_id");
    expect(migration).toContain("'thread_position',v_thread_position");
    expect(migration).not.toContain("create table public.community_thread_posts");
  });

  it("keeps the legacy reader private behind the public wrapper", () => {
    expect(migration).toContain(
      "revoke all\non function public.community_get_post_legacy_m8c3(uuid)\nfrom public,anon,authenticated",
    );
    expect(migration).toContain(
      "grant execute\non function public.community_get_post_legacy_m8c3(uuid)\nto service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.community_get_post(uuid) to anon,authenticated",
    );
  });

  it("collapses replies so Following receives one visible item per Thread", () => {
    expect(migration).toContain("community_get_social_feed_legacy_m8c3");
    expect(migration).toContain("post.thread_id is not null");
    expect(migration).toContain("select min(sibling.thread_position)");
    expect(migration).toContain("sibling.status='published'");
    expect(migration).toContain("jsonb_agg(item.value order by item.ordinality)");
  });

  it("allows a later published item to represent a Thread if an earlier item is withdrawn", () => {
    expect(migration).toContain(
      "post.thread_position > (\n          select min(sibling.thread_position)",
    );
    expect(migration).toContain("sibling.status='published'");
  });

  it("preserves the reviewed RPC classification vocabulary", () => {
    expect(migration).toContain("'community_get_post(uuid)'");
    expect(migration).toContain("'public_read'");
    expect(migration).toContain(
      "'community_get_social_feed(integer,timestamp with time zone,text)'",
    );
    expect(migration).toContain("'authenticated_read'");
  });

  it("keeps runtime SQL free of em and en dashes", () => {
    expect(migration).not.toContain("—");
    expect(migration).not.toContain("–");
  });
});
