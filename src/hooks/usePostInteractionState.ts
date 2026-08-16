import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useEntityActions } from "@/hooks/useCommunityActions";
import {
  getFollowingFeed,
  getReactionStateForPublicTargets,
  getUserFollowing,
  getUserSaves,
  type CommunityPublicReactionState,
  type ReactionType,
  type ReportReason,
} from "@/services/community";
import { getArtistRepresentationState } from "@/services/artists/claimedArtist";
import {
  getActorRepostState,
  getBlockState,
  reportPost,
  setBlockState,
  setPostRepostState,
  type CommunityPost,
  type PostActor,
  type PostRepostState,
} from "@/services/community/posts";

function actorKey(actor: PostActor): string {
  return `${actor.type}:${actor.id}`;
}

function reactionTargetType(post: CommunityPost): "post" | "artist_update" {
  return post.actor.type === "artist" ? "artist_update" : "post";
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

  const [viewerActor, setViewerActor] = useState<PostActor | null>(null);
  const [savedPostIds, setSavedPostIds] = useState<Set<string>>(() => new Set());
  const [reactionStates, setReactionStates] = useState<Map<string, CommunityPublicReactionState>>(() => new Map());
  const [followedActorKeys, setFollowedActorKeys] = useState<Set<string>>(() => new Set());
  const [manageableActorKeys, setManageableActorKeys] = useState<Set<string>>(() => new Set());
  const [repostStates, setRepostStates] = useState<Map<string, PostRepostState>>(() => new Map());
  const [blockedActorKeys, setBlockedActorKeys] = useState<Set<string>>(() => new Set());
  const [savingPostIds, setSavingPostIds] = useState<Set<string>>(() => new Set());
  const [reactingPostIds, setReactingPostIds] = useState<Set<string>>(() => new Set());
  const [followingActorKeys, setFollowingActorKeys] = useState<Set<string>>(() => new Set());
  const [repostingPostIds, setRepostingPostIds] = useState<Set<string>>(() => new Set());
  const [blockingActorKeys, setBlockingActorKeys] = useState<Set<string>>(() => new Set());
  const [reportingPostIds, setReportingPostIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;

    if (posts.length === 0) {
      setSavedPostIds(new Set());
      setReactionStates(new Map());
      setFollowedActorKeys(new Set());
      setManageableActorKeys(new Set());
      setRepostStates(new Map());
      setBlockedActorKeys(new Set());
      if (user.loading || !user.id) setViewerActor(null);
      return () => { alive = false; };
    }

    void (async () => {
      try {
        const states = await getReactionStateForPublicTargets(
          posts.map((post) => ({
            targetType: reactionTargetType(post),
            targetId: post.id,
          })),
        );
        if (alive) setReactionStates(new Map(states.map((state) => [state.targetId, state])));
      } catch {
        if (alive) setReactionStates(new Map());
      }

      if (user.loading || !user.id) {
        if (alive) {
          setViewerActor(null);
          setSavedPostIds(new Set());
          setFollowedActorKeys(new Set());
          setManageableActorKeys(new Set());
          setRepostStates(new Map());
          setBlockedActorKeys(new Set());
        }
        return;
      }

      const [savesResult, followsResult, feedResult] = await Promise.allSettled([
        getUserSaves(user.id),
        getUserFollowing(user.id),
        getFollowingFeed({ limit: 1 }),
      ]);

      if (!alive) return;

      setSavedPostIds(
        savesResult.status === "fulfilled"
          ? readSavedPostIds(savesResult.value)
          : new Set(),
      );
      setFollowedActorKeys(
        followsResult.status === "fulfilled"
          ? readFollowedActorKeys(followsResult.value)
          : new Set(),
      );

      const nextViewerActor =
        feedResult.status === "fulfilled" &&
        feedResult.value.viewerActor?.type === "person"
          ? feedResult.value.viewerActor
          : null;

      setViewerActor(nextViewerActor);

      if (nextViewerActor) {
        try {
          const states = await getActorRepostState(
            nextViewerActor,
            posts.map((post) => post.id),
          );
          if (alive) setRepostStates(new Map(states.map((state) => [state.postId, state])));
        } catch {
          if (alive) setRepostStates(new Map());
        }
      } else {
        setRepostStates(new Map());
      }

      const uniqueActors = Array.from(
        new Map(posts.map((post) => [actorKey(post.actor), post.actor])).values(),
      );

      const blockStates = await Promise.allSettled(
        uniqueActors.map(async (actor) => ({
          actor,
          state: await getBlockState(actor),
        })),
      );

      if (!alive) return;

      const blocked = new Set<string>();
      for (const result of blockStates) {
        if (result.status !== "fulfilled") continue;
        if (result.value.state.blocked) blocked.add(actorKey(result.value.actor));
      }
      setBlockedActorKeys(blocked);

      const manageable = new Set<string>();
      const artistIds = Array.from(new Set(
        posts
          .filter((post) => post.actor.type === "artist")
          .map((post) => post.actor.id),
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

      if (nextViewerActor) manageable.add(actorKey(nextViewerActor));
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

  const toggleReaction = useCallback(async (
    post: CommunityPost,
    reactionType: ReactionType,
  ) => {
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

  const toggleRepost = useCallback(async (post: CommunityPost) => {
    if (!viewerActor) return null;
    const next = !repostStates.get(post.id)?.viewerReposted;
    setRepostingPostIds((current) => new Set(current).add(post.id));
    try {
      await setPostRepostState({
        actor: viewerActor,
        postId: post.id,
        reposted: next,
      });
      const [refreshed] = await getActorRepostState(viewerActor, [post.id]);
      if (refreshed) {
        setRepostStates((current) => new Map(current).set(post.id, refreshed));
      }
      return refreshed ?? null;
    } finally {
      setRepostingPostIds((current) => {
        const updated = new Set(current);
        updated.delete(post.id);
        return updated;
      });
    }
  }, [viewerActor, repostStates]);

  const toggleBlock = useCallback(async (actor: PostActor) => {
    const key = actorKey(actor);
    const next = !blockedActorKeys.has(key);
    setBlockingActorKeys((current) => new Set(current).add(key));
    try {
      const result = await setBlockState(actor, next);
      setBlockedActorKeys((current) => {
        const updated = new Set(current);
        result.blocked ? updated.add(key) : updated.delete(key);
        return updated;
      });
      if (result.blocked) {
        setFollowedActorKeys((current) => {
          const updated = new Set(current);
          updated.delete(key);
          return updated;
        });
      }
      return result.blocked;
    } finally {
      setBlockingActorKeys((current) => {
        const updated = new Set(current);
        updated.delete(key);
        return updated;
      });
    }
  }, [blockedActorKeys]);

  const submitReport = useCallback(async (
    post: CommunityPost,
    reason: ReportReason,
  ) => {
    setReportingPostIds((current) => new Set(current).add(post.id));
    try {
      await reportPost({
        postId: post.id,
        reason,
        details: `Reported Post from ${post.actor.name}`,
      });
    } finally {
      setReportingPostIds((current) => {
        const updated = new Set(current);
        updated.delete(post.id);
        return updated;
      });
    }
  }, []);

  return {
    viewerActor,
    savedPostIds,
    reactionStates,
    followedActorKeys,
    manageableActorKeys,
    repostStates,
    blockedActorKeys,
    savingPostIds,
    reactingPostIds,
    followingActorKeys,
    repostingPostIds,
    blockingActorKeys,
    reportingPostIds,
    toggleSave,
    toggleFollow,
    toggleReaction,
    toggleRepost,
    toggleBlock,
    submitReport,
  };
}
