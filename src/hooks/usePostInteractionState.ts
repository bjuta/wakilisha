import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useEntityActions } from "@/hooks/useCommunityActions";
import {
  getFollowingFeed,
  getReactionStateForPublicTargets,
  getUserFollowing,
  getUserSaves,
  type CommunityPublicReactionState,
  type ReactionType,
} from "@/services/community";
import { getArtistRepresentationState } from "@/services/artists/claimedArtist";
import type { CommunityPost, PostActor } from "@/services/community/posts";

function actorKey(actor: PostActor): string {
  return `${actor.type}:${actor.id}`;
}

function reactionTargetType(
  post: CommunityPost,
): "post" | "artist_update" {
  return post.actor.type === "artist"
    ? "artist_update"
    : "post";
}

function readSavedPostIds(rows: unknown[]): Set<string> {
  const result = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const type = typeof record.entity_type === "string" ? record.entity_type : "";
    const id = typeof record.entity_id === "string" ? record.entity_id : "";
    if (id && (type === "post" || type === "artist_update")) result.add(id);
  }
  return result;
}

function readFollowedActorKeys(rows: unknown[]): Set<string> {
  const result = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const record = row as Record<string, unknown>;
    const type = typeof record.targetType === "string" ? record.targetType : "";
    const id = typeof record.targetId === "string" ? record.targetId : "";
    if (id && (type === "person" || type === "artist")) result.add(`${type}:${id}`);
  }
  return result;
}

export function usePostInteractionState(posts: CommunityPost[]) {
  const user = useAuthUser();
  const { setSaved, setFollow, react } = useEntityActions(
    !user.loading ? user.id || undefined : undefined,
  );

  const postKey = useMemo(
    () => posts.map((post) => `${post.id}:${post.updatedAt}`).join("|"),
    [posts],
  );

  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set());
  const [reactionStates, setReactionStates] = useState<Map<string, CommunityPublicReactionState>>(() => new Map());
  const [followedActorKeys, setFollowedActorKeys] = useState<Set<string>>(() => new Set());
  const [manageableActorKeys, setManageableActorKeys] = useState<Set<string>>(() => new Set());
  const [savingPostIds, setSavingPostIds] = useState<Set<string>>(() => new Set());
  const [reactingPostIds, setReactingPostIds] = useState<Set<string>>(() => new Set());
  const [followingActorKeys, setFollowingActorKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;

    if (posts.length === 0) {
      setSavedPostIds(new Set());
      setReactionStates(new Map());
      setFollowedActorKeys(new Set());
      setManageableActorKeys(new Set());
      return () => { alive = false; };
    }

    void (async () => {
      try {
        const states = await getReactionStateForPublicTargets(
          posts.map((post) => ({ targetType: reactionTargetType(post), targetId: post.id })),
        );
        if (alive) setReactionStates(new Map(states.map((state) => [state.targetId, state])));
      } catch {
        if (alive) setReactionStates(new Map());
      }

      if (user.loading || !user.id) {
        if (alive) {
          setSavedPostIds(new Set());
          setFollowedActorKeys(new Set());
          setManageableActorKeys(new Set());
        }
        return;
      }

      const [savesResult, followsResult] = await Promise.allSettled([
        getUserSaves(user.id),
        getUserFollowing(user.id),
      ]);

      if (!alive) return;
      setSavedPostIds(savesResult.status === "fulfilled" ? readSavedPostIds(savesResult.value) : new Set());
      setFollowedActorKeys(followsResult.status === "fulfilled" ? readFollowedActorKeys(followsResult.value) : new Set());

      const manageable = new Set<string>();
      const artistIds = Array.from(new Set(
        posts.filter((post) => post.actor.type === "artist").map((post) => post.actor.id),
      ));

      const artistStates = await Promise.allSettled(
        artistIds.map(async (artistId) => ({
          artistId,
          state: await getArtistRepresentationState(artistId),
        })),
      );

      if (!alive) return;
      for (const result of artistStates) {
        if (result.status !== "fulfilled") continue;
        const { artistId, state } = result.value;
        if (
          state.representation?.status === "active" &&
          state.representation.permissions.updates
        ) {
          manageable.add(`artist:${artistId}`);
        }
      }

      if (posts.some((post) => post.actor.type === "person")) {
        try {
          const feed = await getFollowingFeed({ limit: 1 });
          if (alive && feed.viewerActor?.type === "person") {
            manageable.add(actorKey(feed.viewerActor));
          }
        } catch {
          // Never guess Person ownership when the authority read is unavailable.
        }
      }

      if (alive) setManageableActorKeys(manageable);
    })();

    return () => { alive = false; };
  }, [postKey, user.loading, user.id]);

  const toggleSave = useCallback(async (post: CommunityPost) => {
    const next = !savedPostIds.has(post.id);
    setSavingPostIds((current) => new Set(current).add(post.id));
    try {
      const result = await setSaved({
        entityType: "post",
        entityId: post.id,
        entityUrl: post.canonicalPath,
        title: `Post from ${post.actor.name}`,
        subtitle: post.body,
        imageUrl: post.imageUrl || undefined,
      }, next);
      if (!result) return;
      setSavedPostIds((current) => {
        const updated = new Set(current);
        result.saved ? updated.add(post.id) : updated.delete(post.id);
        return updated;
      });
    } finally {
      setSavingPostIds((current) => {
        const updated = new Set(current);
        updated.delete(post.id);
        return updated;
      });
    }
  }, [savedPostIds, setSaved]);

  const toggleFollow = useCallback(async (actor: PostActor) => {
    const key = actorKey(actor);
    const next = !followedActorKeys.has(key);
    setFollowingActorKeys((current) => new Set(current).add(key));
    try {
      const result = await setFollow(actor.type, actor.id, actor.slug, next);
      if (!result) return;
      setFollowedActorKeys((current) => {
        const updated = new Set(current);
        result.followed ? updated.add(key) : updated.delete(key);
        return updated;
      });
    } finally {
      setFollowingActorKeys((current) => {
        const updated = new Set(current);
        updated.delete(key);
        return updated;
      });
    }
  }, [followedActorKeys, setFollow]);

  const toggleReaction = useCallback(async (post: CommunityPost, reactionType: ReactionType) => {
    setReactingPostIds((current) => new Set(current).add(post.id));
    try {
      const result = await react(reactionTargetType(post), post.id, reactionType);
      if (!result) return;
      const [refreshed] = await getReactionStateForPublicTargets([
        { targetType: reactionTargetType(post), targetId: post.id },
      ]);
      if (refreshed) {
        setReactionStates((current) => new Map(current).set(post.id, refreshed));
      }
    } finally {
      setReactingPostIds((current) => {
        const updated = new Set(current);
        updated.delete(post.id);
        return updated;
      });
    }
  }, [react]);

  return {
    savedPostIds,
    reactionStates,
    followedActorKeys,
    manageableActorKeys,
    savingPostIds,
    reactingPostIds,
    followingActorKeys,
    toggleSave,
    toggleFollow,
    toggleReaction,
  };
}
