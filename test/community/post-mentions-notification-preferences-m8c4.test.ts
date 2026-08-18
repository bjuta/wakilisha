import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260818103000_canonical_post_mentions_notification_preferences.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-canonical-post-mentions-m8c4.sql",
  "utf8",
);

describe("WAKILISHA M8C.4 canonical Post mentions", () => {
  it("creates canonical Person mention authority without adding mention state to Drafts", () => {
    expect(migration).toContain("create table public.community_post_mentions");
    expect(migration).toContain("person_resource_id uuid not null");
    expect(migration).toContain("unique (post_id,person_resource_id)");
    expect(migration).not.toMatch(/alter table private\.community_post_drafts[\s\S]*mention/i);
  });

  it("denies direct browser CRUD on mention rows", () => {
    expect(migration).toContain("alter table public.community_post_mentions enable row level security");
    expect(migration).toContain("from public,anon,authenticated");
  });

  it("resolves authored @handles through active public account Person identity", () => {
    expect(migration).toContain("private.community_resolve_post_mentions");
    expect(migration).toContain("profile.username_normalized=candidate.handle");
    expect(migration).toContain("editorial.resolve_person_follow_target");
    expect(migration).toContain("resolved.followable");
  });

  it("keeps an authored Mention bound to its original Person across username reuse", () => {
    expect(migration).toContain("private.community_extract_post_mention_handles");
    expect(migration).toContain("community_post_mentions_post_handle_key");
    expect(migration).toContain("mention.handle_at_mention=any(v_handles)");
    expect(migration).toContain("retain that original binding");
    expect(verifier).toContain(
      "PASS: handle reuse and URL-contained tokens cannot silently retarget Mentions.",
    );
  });

  it("does not treat handles inside ordinary http or https URLs as Mention authority", () => {
    expect(migration).toContain("'https?://[^[:space:]]+'");
    expect(migration).toContain("regexp_replace(");
  });

  it("keeps unknown handles harmless by only persisting resolved candidates", () => {
    expect(migration).toContain("join public.user_profiles profile");
    expect(migration).toContain("public.community_username_is_valid(candidate.handle)");
  });

  it("reconciles mentions from canonical Posts rather than Thread wrappers", () => {
    expect(migration).toContain("after insert or update of body,status");
    expect(migration).toContain("on public.community_posts");
    expect(migration).not.toContain("community_thread_mentions");
  });

  it("prevents duplicate Mention alerts and self alerts", () => {
    expect(migration).toContain("community_notifications_post_mention_once");
    expect(migration).toContain("v_target.mentioned_user_id<>v_post.author_user_id");
    expect(migration).toContain("on conflict (");
    expect(migration).toContain("where notification_type='post_mention'");
  });

  it("suppresses Mention delivery across either Block direction", () => {
    const uses = migration.match(/community_is_blocked_target\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("v_target.mentioned_user_id");
    expect(migration).toContain("v_post.author_user_id");
  });

  it("makes Mention and Reply notification preferences authoritative", () => {
    expect(migration).toContain("mention_notifications");
    expect(migration).toContain("reply_notifications");
    expect(migration).toContain("private.community_notification_preference_enabled");
    expect(migration).toContain("create or replace function public.community_distribute_notifications");
  });

  it("removes stale Mention notifications after edit removal or Post withdrawal", () => {
    expect(migration).toContain("delete from public.community_notifications notification");
    expect(migration).toContain("notification.entity_id=p_post_id::text");
    expect(migration).toContain("using public.community_post_mentions mention");
    expect(migration).toContain("if v_post.status<>'published' then");
    expect(verifier).toContain(
      "PASS: removed or withdrawn Mentions cannot leave stale Post notifications.",
    );
  });

  it("adds mention presentation through the canonical Post reader", () => {
    expect(migration).toContain("rename to community_get_post_legacy_m8c4");
    expect(migration).toContain("public.community_get_post_mentions(p_post_id)");
    expect(migration).toContain("'{quoted_post,mentions}'");
  });

  it("keeps the permanent live verifier executable as SQL", () => {
    expect(verifier).not.toContain("1/0::text");
    expect(verifier).toContain(
      "pg_catalog.current_setting('wakilisha.m8c4_verifier_assertion_failed')",
    );
  });

  it("ships a permanent live verifier for the same authority", () => {
    expect(verifier).toContain("PASS: canonical Post mention table exists.");
    expect(verifier).toContain("PASS: canonical Posts own mention reconciliation.");
    expect(verifier).toContain("PASS: Mention alerts enforce Block and self-mention suppression.");
    expect(verifier).toContain("PASS: Reply notification delivery honors the stored preference.");
  });
});
