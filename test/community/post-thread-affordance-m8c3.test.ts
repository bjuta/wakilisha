import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817194000_post_thread_item_count.sql",
  "utf8",
);

describe("WAKILISHA M8C.3 Thread feed affordance", () => {
  it("extends the canonical Post payload instead of adding a second Thread read per feed item", () => {
    expect(migration).toContain("create or replace function public.community_get_post(");
    expect(migration).toContain("public.community_get_post_legacy_m8c3(p_post_id)");
    expect(migration).toContain("'thread_item_count',v_thread_item_count");
    expect(migration).not.toContain("create function public.community_get_thread_item_count");
  });

  it("counts only currently published Posts in the authored Thread", () => {
    expect(migration).toContain("sibling.thread_id=v_thread_id");
    expect(migration).toContain("sibling.status='published'");
    expect(migration).toContain("if v_thread_id is not null then");
  });

  it("keeps the canonical public Post read grant and classification", () => {
    expect(migration).toContain(
      "grant execute on function public.community_get_post(uuid) to anon,authenticated",
    );
    expect(migration).toContain(
      "where function_signature='community_get_post(uuid)'",
    );
    expect(migration).toContain("published item count");
  });

  it("keeps runtime copy punctuation clean", () => {
    expect(migration).not.toContain("—");
    expect(migration).not.toContain("–");
  });
});
