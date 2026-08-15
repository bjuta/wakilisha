import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260815043000_community_posts_social_layer.sql",
  "utf8",
);
const verifier = readFileSync(
  "scripts/control-plane/verify-community-posts-social-layer.sql",
  "utf8",
);
const postsService = readFileSync("src/services/community/posts.ts", "utf8");
const postMedia = readFileSync("src/services/community/postMedia.ts", "utf8");
const composer = readFileSync("src/components/community/PostComposer.tsx", "utf8");
const followingService = readFileSync("src/services/community/followingFeed.ts", "utf8");
const followingPage = readFileSync("src/pages/following/page.tsx", "utf8");
const shareSheet = readFileSync("src/components/design-system/share/ShareSheet.tsx", "utf8");
const router = readFileSync("src/router/config.tsx", "utf8");

describe("WAKILISHA universal Posts social layer", () => {
  it("promotes Artist Updates instead of forking authored posts", () => {
    expect(migration).toContain("alter table public.artist_updates rename to community_posts");
    expect(migration).toContain("create view public.artist_updates as");
    expect(migration).toContain("community_posts_actor_identity_check");
    expect(migration).toContain("references editorial.people(resource_id)");
    expect(migration).not.toContain("create table public.community_posts");
    expect(migration).not.toContain("drop table public.artist_updates");
  });

  it("contains SQL only and never generator shell syntax", () => {
    expect(migration).not.toContain('$MIGRATION');
    expect(migration).not.toContain("<<'SQL'");
    expect(migration).not.toContain("cat >> ");
    expect(migration.trimStart()).toMatch(/^-- WAKILISHA M7:/);
    expect(migration.trimEnd()).toMatch(/commit;$/);
  });

  it("gives the signed-in canonical Person self-post authority", () => {
    expect(migration).toContain("editorial.current_person_post_actor()");
    expect(migration).toContain("editorial.person_identity_links");
    expect(migration).toContain("profile.status='active'");
    expect(migration).toContain("profile.is_public");
    expect(migration).toContain("insufficient_person_post_privilege");
  });

  it("keeps Artist posting on existing representation authority", () => {
    expect(migration).toContain("editorial.current_artist_representation");
    expect(migration).toContain("v_rep.can_post_updates");
    expect(migration).toContain("artist_update_published");
    expect(migration).toContain("artist_update_edited");
    expect(migration).toContain("artist_update_withdrawn");
  });

  it("wraps mature Save and Reaction authority rather than cloning it", () => {
    expect(migration).toContain("community_set_saved_state_legacy_m7");
    expect(migration).toContain("community_react_to_target_legacy_m7");
    expect(migration).toContain("community_get_reaction_state_for_public_targets_legacy_m7");
    expect(migration).toContain("'post'");
    expect(migration).toContain("community_saves_entity_type_capability_check");
  });

  it("layers social Posts on the existing Following feed", () => {
    expect(migration).toContain("community_get_social_feed");
    expect(migration).toContain("community_get_following_feed");
    expect(migration).toContain("'viewer_actor'");
    expect(migration).toContain("'post'::text as item_type");
    expect(followingService).toContain("community_get_social_feed");
    expect(followingService).toContain('| "post"');
    expect(followingService).toContain("record.viewer_actor");
    expect(followingService).toContain("const viewerActor =");
    expect(followingService).toContain("viewerActor,");
    expect(followingPage).toContain("PostComposer");
    expect(followingPage).toContain('followId: "self"');
    expect(followingPage).toContain("setViewerActor(feed.viewerActor)");
  });

  it("uses one self-owned media boundary for Person Posts", () => {
    expect(postMedia).toContain(
      "uploads/profiles/${safePart(userData.user.id)}/posts/${actor.type}/${safePart(actor.id)}",
    );
    expect(postMedia).toContain("media-upload-api");
    expect(postMedia).not.toContain('form.append("storage_path"');
  });

  it("ships the same social composer grammar to ordinary users", () => {
    expect(composer).toContain("Share something as");
    expect(composer).toContain("Create Post");
    expect(composer).toContain("h-[100dvh]");
    expect(composer).toContain("max-h-[100dvh]");
    expect(composer).toContain("overscroll-contain");
    expect(composer).toContain("env(safe-area-inset-top)");
    expect(composer).toContain("env(safe-area-inset-bottom)");
    expect(composer).toContain("Photo");
    expect(composer).toContain("Link");
    expect(composer).toContain("publishPost");
    expect(composer).toContain("editPost");
    expect(postsService).toContain("supabase.rpc.bind(supabase)");
  });

  it("makes Person Posts canonical public resources", () => {
    expect(router).toContain('"/people/:slug/posts/:postId"');
    expect(postsService).toContain("community_get_post");
    expect(shareSheet).toContain('| "post"');
    expect(shareSheet).toContain('post: "post"');
  });

  it("ships a read-only live verifier", () => {
    expect(verifier).toContain("community_posts is not a table");
    expect(verifier).toContain("artist_updates is not the compatibility view");
    expect(verifier).toContain("wakilisha_m7_posts_verification");
  });

  it("keeps new runtime source free of em and en dashes", () => {
    for (const source of [postsService, postMedia, composer, followingPage]) {
      expect(source).not.toContain("—");
      expect(source).not.toContain("–");
    }
  });
});
