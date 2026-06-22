import { useState, useEffect, useCallback } from 'react';
import type { CommunityEntity, CommunityThread, CommunityComment, SortMode } from '@/services/community';
import {
  getOrCreateThread,
  getThreadComments,
  createComment,
  hydrateCommentsWithUserState,
  hydrateCommentWithReplies,
  getCommentCount,
} from '@/services/community';

export function useCommunityThread(entity: CommunityEntity, userId?: string) {
  const [thread, setThread] = useState<CommunityThread | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>('best');

  const loadThread = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { thread: t } = await getOrCreateThread(entity);
      setThread(t);

      const rootComments = await getThreadComments(t.id, { sortBy, limit: 50 });
      const hydrated = await hydrateCommentsWithUserState(rootComments, userId);
      setComments(hydrated);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load thread'));
    } finally {
      setLoading(false);
    }
  }, [entity, sortBy, userId]);

  useEffect(() => {
    loadThread();
  }, [loadThread]);

  const postComment = useCallback(
    async (body: string, parentId?: string) => {
      if (!thread) return null;
      const result = await createComment({
        threadId: thread.id,
        parentId: parentId || null,
        bodyMarkdown: body,
        bodyPlain: body,
      });
      await loadThread();
      return result.comment;
    },
    [thread, loadThread]
  );

  const loadReplies = useCallback(
    async (commentId: string) => {
      const comment = comments.find((c) => c.id === commentId);
      if (!comment) return null;
      const withReplies = await hydrateCommentWithReplies(comment, userId, 10);
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? withReplies : c))
      );
      return withReplies;
    },
    [comments, userId]
  );

  return {
    thread,
    comments,
    loading,
    error,
    sortBy,
    setSortBy,
    refresh: loadThread,
    postComment,
    loadReplies,
    commentCount: thread?.commentCount || 0,
  };
}

export function useEntityCommentCount(entity: CommunityEntity) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCommentCount(entity.type, entity.id, entity.slug)
      .then((c) => setCount(c))
      .finally(() => setLoading(false));
  }, [entity.type, entity.id, entity.slug]);

  return { count, loading };
}