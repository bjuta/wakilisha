import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260817183000_post_drafts_authored_threads.sql",
  "utf8",
);
const orderHardeningMigration = readFileSync(
  "supabase/migrations/20260817185000_post_draft_order_hardening.sql",
  "utf8",
);
const rlsHardeningMigration = readFileSync(
  "supabase/migrations/20260817192000_post_thread_rls_hardening.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-post-drafts-authored-threads.sql",
  "utf8",
);

describe("WAKILISHA M8C.3 Post drafts and authored Threads", () => {
  it("keeps drafts in a private store outside canonical public Posts", () => {
    expect(migration).toContain("create table private.community_post_drafts");
    expect(migration).toContain(
      "revoke all on table private.community_post_drafts from public,anon,authenticated",
    );
    expect(migration).not.toContain("add column status text");
    expect(migration).not.toContain("status='draft'");
  });

  it("keeps published Thread items as canonical Posts with deterministic order", () => {
    expect(migration).toContain("create table public.community_post_threads");
    expect(migration).toContain("add column thread_id uuid");
    expect(migration).toContain("add column thread_position integer");
    expect(migration).toContain("community_posts_thread_pair_check");
    expect(migration).toContain("community_posts_thread_position_key");
    expect(migration).toContain("order by draft.position,draft.id");
  });

  it("requires every draft in a Thread to keep one authored identity", () => {
    expect(migration).toContain("thread_draft_actor_mismatch");
    expect(migration).toContain("private.community_resolve_post_command_actor");
    expect(migration).toContain(
      "sibling.person_resource_id is distinct from v_actor.person_resource_id",
    );
    expect(migration).toContain(
      "sibling.artist_id is distinct from v_actor.artist_id",
    );
  });

  it("lets drafts preserve the complete M8C.2 content grammar", () => {
    expect(migration).toContain("registry_track_id uuid");
    expect(migration).toContain("quoted_post_id uuid");
    expect(migration).toContain("image_url text");
    expect(migration).toContain("link_url text");
    expect(migration).toContain("link_label text");
    expect(migration).toContain("private.community_present_post_track");
  });

  it("allows incomplete private work but enforces valid content at publication", () => {
    const tableStart = migration.indexOf(
      "create table private.community_post_drafts",
    );
    const tableEnd = migration.indexOf(
      "create index community_post_drafts_owner_updated_idx",
    );
    const draftTable = migration.slice(tableStart, tableEnd);

    expect(draftTable).not.toContain("content_required");
    expect(migration).toContain("invalid_post_content");
    expect(migration).toContain("v_draft.registry_track_id is null");
  });

  it("publishes atomically by reusing canonical Post and Quote Post writers", () => {
    expect(migration).toContain("public.community_publish_post(");
    expect(migration).toContain("public.community_quote_post(");
    expect(migration).toContain("v_posts:=v_posts || jsonb_build_array");
    expect(migration).toContain(
      "delete from private.community_post_drafts draft",
    );
    expect(migration).not.toContain("insert into public.community_notifications");
    expect(migration).not.toContain("record_artist_representation_event");
  });

  it("publishes one-item drafts as ordinary Posts and groups only real Threads", () => {
    expect(migration).toContain("if v_count>1 then");
    expect(migration).toContain("insert into public.community_post_threads");
    expect(migration).toContain("'thread_id',v_thread_id");
  });

  it("exposes ordered published Thread reads without granting the backing table", () => {
    expect(migration).toContain("public.community_get_thread");
    expect(migration).toContain("post.status='published'");
    expect(migration).toContain(
      "jsonb_agg(item.payload order by item.thread_position,item.post_id)",
    );
    expect(migration).toContain(
      "revoke all on table public.community_post_threads from public,anon,authenticated",
    );
    expect(migration).toContain(
      "grant execute on function public.community_get_thread(uuid) to anon,authenticated",
    );
  });

  it("hardens the public Thread backing table with RLS and no browser policies", () => {
    expect(rlsHardeningMigration).toContain(
      "alter table public.community_post_threads enable row level security",
    );
    expect(rlsHardeningMigration).toContain(
      "revoke all on table public.community_post_threads from public,anon,authenticated",
    );
    expect(rlsHardeningMigration).toContain(
      "grant select on table public.community_post_threads to service_role",
    );
    expect(rlsHardeningMigration).toContain(
      "policy.tablename='community_post_threads'",
    );
    expect(verifier).toContain("thread_store_rls");
    expect(verifier).toContain("thread_table_has_browser_policy");
  });

  it("caps Thread drafts at 50 Posts and reorders under a deferrable uniqueness constraint", () => {
    expect(orderHardeningMigration).toContain(
      "check (position between 1 and 50)",
    );
    expect(orderHardeningMigration).toContain(
      "deferrable initially immediate",
    );
    expect(orderHardeningMigration).toContain(
      "set constraints community_post_drafts_owner_group_position_key deferred",
    );
    expect(orderHardeningMigration).not.toContain("position=1000+");
    expect(verifier).toContain("community_post_drafts_position_check");
    expect(verifier).toContain("community_post_drafts_owner_group_position_key");
  });

  it("supports owner-scoped save, read, delete, reorder, and publish commands", () => {
    expect(migration).toContain("community_save_post_draft");
    expect(migration).toContain("community_get_post_drafts");
    expect(migration).toContain("community_delete_post_draft");
    expect(migration).toContain("community_reorder_post_draft_group");
    expect(migration).toContain("community_publish_post_draft_group");
    expect(migration).toContain("draft.author_user_id=v_user");
  });

  it("classifies every browser-reachable RPC", () => {
    expect(migration).toContain("private.phase_0a_rpc_classification");
    expect(migration).toContain("'authenticated_command'");
    expect(migration).toContain("'authenticated_read'");
    expect(migration).toContain("'public_read'");
    expect(verifier).toContain("function_signature");
    expect(verifier).toContain("access_class");
  });

  it("ships a read-only live verifier and keeps runtime copy punctuation clean", () => {
    expect(verifier).toContain("begin read only;");
    expect(verifier).toContain("rollback;");
    expect(verifier).not.toContain("insert into");
    expect(verifier).not.toContain("alter table");
    expect(migration).not.toContain("—");
    expect(migration).not.toContain("–");
    expect(orderHardeningMigration).not.toContain("—");
    expect(orderHardeningMigration).not.toContain("–");
    expect(rlsHardeningMigration).not.toContain("—");
    expect(rlsHardeningMigration).not.toContain("–");
  });
});
